from __future__ import annotations

import asyncio
import random
import time
import urllib.request
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Iterable, Mapping


DEFAULT_USER_AGENTS = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/16.6 Safari/605.1.15",
    "CaracalTechMotorsCatalogBot/1.0 (+https://caracaltechmotors.com)",
)


@dataclass(frozen=True)
class ScrapedProduct:
    source_slug: str
    source_name: str
    source_base_url: str
    source_currency: str
    external_url: str
    sku: str | None
    name: str
    price_cents: int | None
    currency: str | None
    stock_status: str
    brand: str | None = None
    category_name: str | None = None
    image_url: str | None = None
    raw_data: Mapping[str, object] | None = None

    def to_prisma_payload(self) -> dict[str, object | None]:
        return {
            "sourceSlug": self.source_slug,
            "sourceName": self.source_name,
            "sourceBaseUrl": self.source_base_url,
            "sourceCurrency": self.source_currency,
            "externalUrl": self.external_url,
            "sku": self.sku,
            "name": self.name,
            "brand": self.brand,
            "categoryName": self.category_name,
            "priceCents": self.price_cents,
            "currency": self.currency,
            "stockStatus": self.stock_status,
            "imageUrl": self.image_url,
            "rawData": dict(self.raw_data or {}),
        }


class BaseScraper(ABC):
    def __init__(
        self,
        *,
        base_url: str,
        user_agents: Iterable[str] = DEFAULT_USER_AGENTS,
        min_delay_seconds: float = 1.0,
        max_delay_seconds: float = 2.5,
        request_timeout_seconds: float = 30.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.user_agents = tuple(user_agents) or DEFAULT_USER_AGENTS
        self.min_delay_seconds = min_delay_seconds
        self.max_delay_seconds = max(max_delay_seconds, min_delay_seconds)
        self.request_timeout_seconds = request_timeout_seconds
        self._last_request_at = 0.0
        self._lock = asyncio.Lock()

    def choose_user_agent(self) -> str:
        return random.choice(self.user_agents)

    def headers(self, user_agent: str | None = None) -> dict[str, str]:
        return {
            "User-Agent": user_agent or self.choose_user_agent(),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
        }

    async def rate_limit(self) -> None:
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self._last_request_at
            target_delay = random.uniform(self.min_delay_seconds, self.max_delay_seconds)
            if elapsed < target_delay:
                await asyncio.sleep(target_delay - elapsed)
            self._last_request_at = time.monotonic()

    async def fetch_text(self, url: str) -> str:
        await self.rate_limit()
        request = urllib.request.Request(url, headers=self.headers())

        def read() -> str:
            with urllib.request.urlopen(
                request, timeout=self.request_timeout_seconds
            ) as response:
                charset = response.headers.get_content_charset() or "utf-8"
                return response.read().decode(charset, errors="replace")

        return await asyncio.to_thread(read)

    @abstractmethod
    async def scrape(self, limit: int = 20) -> list[ScrapedProduct]:
        """Return normalized product rows ready for staging."""
