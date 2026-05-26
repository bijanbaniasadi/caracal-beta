from __future__ import annotations

import argparse
import asyncio
import json
import re
import subprocess
from pathlib import Path
from urllib.parse import urljoin

from playwright.async_api import async_playwright

try:
    from .base_scraper import BaseScraper, ScrapedProduct
except ImportError:
    from base_scraper import BaseScraper, ScrapedProduct


PRICE_RE = re.compile(r"(?:AED|د\.إ)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)", re.I)
SKU_RE = re.compile(r"\b(?:SKU|Model|Item\s*No\.?|Product\s*Code)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._/-]{2,})", re.I)


class AutomaxToolsScraper(BaseScraper):
    source_slug = "automaxtools"
    source_name = "Automax Tools"
    source_base_url = "https://automaxtools.me"
    source_currency = "AED"

    def __init__(self, **kwargs: object) -> None:
        super().__init__(base_url=self.source_base_url, **kwargs)

    async def discover_product_urls(self, page, limit: int) -> list[str]:
        urls: list[str] = []
        seen: set[str] = set()
        entry_points = [
            "/",
            "/collections/all",
            "/collections/diagnostic-tools",
            "/collections/key-programmers",
            "/collections/programming-tools",
        ]

        for path in entry_points:
            if len(urls) >= limit:
                break
            await self.rate_limit()
            await page.goto(urljoin(self.base_url, path), wait_until="domcontentloaded", timeout=60000)
            links = await page.eval_on_selector_all(
                "a[href]",
                "(nodes) => nodes.map((node) => node.href)",
            )
            for href in links:
                if not isinstance(href, str):
                    continue
                if "/products/" not in href:
                    continue
                clean = href.split("?")[0].split("#")[0]
                if clean in seen:
                    continue
                seen.add(clean)
                urls.append(clean)
                if len(urls) >= limit:
                    break

        return urls

    async def parse_product(self, page, url: str) -> ScrapedProduct | None:
        await self.rate_limit()
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(750)

        name = await self._first_text(page, ["h1", "[data-product-title]", ".product__title"])
        body_text = await page.locator("body").inner_text(timeout=10000)
        price_text = await self._first_text(
            page,
            [
                "[class*='price']",
                ".product__price",
                "[data-product-price]",
                "[data-price]",
            ],
        )
        sku = self._extract_sku(body_text)
        price_cents = self._extract_price_cents(price_text or body_text)
        stock_status = self._extract_stock_status(body_text)

        if not name:
            return None

        return ScrapedProduct(
            source_slug=self.source_slug,
            source_name=self.source_name,
            source_base_url=self.source_base_url,
            source_currency=self.source_currency,
            external_url=url,
            sku=sku,
            name=name,
            price_cents=price_cents,
            currency="AED",
            stock_status=stock_status,
            raw_data={
                "bodySample": body_text[:2000],
                "priceText": price_text,
            },
        )

    async def scrape(self, limit: int = 20) -> list[ScrapedProduct]:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent=self.choose_user_agent(),
                extra_http_headers=self.headers(),
                viewport={"width": 1440, "height": 1100},
            )
            page = await context.new_page()
            try:
                urls = await self.discover_product_urls(page, limit)
                products: list[ScrapedProduct] = []
                for url in urls:
                    product = await self.parse_product(page, url)
                    if product is not None:
                        products.append(product)
                return products
            finally:
                await context.close()
                await browser.close()

    async def _first_text(self, page, selectors: list[str]) -> str | None:
        for selector in selectors:
            locator = page.locator(selector).first
            try:
                if await locator.count() > 0:
                    text = await locator.inner_text(timeout=3000)
                    cleaned = " ".join(text.split())
                    if cleaned:
                        return cleaned
            except Exception:
                continue
        return None

    def _extract_sku(self, text: str) -> str | None:
        match = SKU_RE.search(text)
        if not match:
            return None
        return re.sub(r"[^\w.-]+", "", match.group(1).upper())[:80]

    def _extract_price_cents(self, text: str) -> int | None:
        match = PRICE_RE.search(text.replace(",", ""))
        if not match:
            return None
        try:
            return round(float(match.group(1)) * 100)
        except ValueError:
            return None

    def _extract_stock_status(self, text: str) -> str:
        lower = text.lower()
        if "discontinued" in lower:
            return "DISCONTINUED"
        if any(term in lower for term in ("out of stock", "sold out", "unavailable")):
            return "OUT_OF_STOCK"
        if any(term in lower for term in ("low stock", "limited stock")):
            return "LOW_STOCK"
        return "IN_STOCK"

    def save_to_prisma(self, products: list[ScrapedProduct]) -> dict[str, object]:
        repo_root = Path(__file__).resolve().parents[3]
        payload = json.dumps([product.to_prisma_payload() for product in products])
        command = ["pnpm", "--filter", "@caracal/api", "supplier:upsert-staging"]
        completed = subprocess.run(
            command,
            input=payload,
            text=True,
            cwd=repo_root,
            capture_output=True,
            check=True,
        )
        return json.loads(completed.stdout)


async def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape Automax Tools into staging products.")
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--save", action="store_true")
    args = parser.parse_args()

    scraper = AutomaxToolsScraper()
    products = await scraper.scrape(limit=args.limit)
    if args.save:
        print(json.dumps(scraper.save_to_prisma(products), indent=2))
    else:
        print(json.dumps([product.to_prisma_payload() for product in products], indent=2))


if __name__ == "__main__":
    asyncio.run(main())
