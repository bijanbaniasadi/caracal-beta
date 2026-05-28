/**
 * Legacy shop import — Phase M1 (skeleton).
 *
 * Imports the 29 products from the previous Caracal Tech shop into the new
 * layered catalog. Source of truth: data/products-import.sql from the old
 * backup (caracaltechmotors_public_html_manual_backup_2026-05-22). The values
 * are embedded below verbatim so the script is self-contained and reviewable.
 *
 * Behaviour:
 *   - Upserts 4 categories (tuning-tools, diagnostic-tools, cables-adapters, key-programming).
 *   - Upserts manufacturers inferred from product titles.
 *   - For each product: creates / updates a master_product, creates a synthetic
 *     mk3 vendor offer (AED-denominated cost = old_sell / 1.10, just to satisfy
 *     the active-offer publish gate), attaches a brand-logo placeholder image,
 *     and PUBLISHES with priced_sell_cents = the original old AED price.
 *   - Skips the old fabricated +30% compare-at price entirely. A3.1 fills real
 *     compare-at later from a real manufacturer RRP.
 *
 * Why directly freeze the old price instead of letting the A1 snapshot recompute?
 *   The old prices were set by a "+10% on mk3 list" rule we no longer have data
 *   for; recomputing them through the new 15%-margin engine would shift every
 *   number. M1 preserves what shop.php showed. M2 (manufacturer enrichment +
 *   dealer-cost sync engine) repopulates real costs and reprices through the
 *   normal A1/A3/A3.1 path.
 *
 * Run inside the prod api container:
 *   docker compose -f docker-compose.prod.yml --env-file .env.production \
 *     exec api sh -c 'cd /app && pnpm --filter @caracal/api exec tsx scripts/import-legacy-shop.ts'
 *
 * Idempotent: upsert by slug. Safe to re-run after corrections.
 *
 * Before running, drop these placeholder logos into /var/www/caracal-media/ on the VPS:
 *   alientech-logo.png  (Alientech / KESS family)
 *   autotuner-logo.png  (AutoTuner family)
 *   bflash-logo.png     (BFlash family — kept for parity even if none of the 29 use it)
 *   caracal-logo.png    (generic fallback for everything else)
 * The originals live in the old backup root (kess3.png, autotuner.png, bflash.png, logo.png).
 */
import { disconnectPrismaClient, getPrismaClient } from '@caracal/db';

import {
  buildMk3Fingerprint,
  inferMk3Manufacturer,
  inferMk3MpnOrSku,
  inferMk3VariantKey,
  slugifyCatalogValue,
} from '../src/lib/catalog/mk3/fingerprint.js';
import {
  projectMasterProductToSearch,
  refreshPublicProductsMaterializedViewDebounced,
} from '../src/lib/catalog/projection.js';
import { ensureMk3VendorSource } from '../src/lib/catalog/mk3/ingestion.js';
import { ensureStageUser } from './seed-mk3-stage1-references.js';

process.env.CATALOG_MATVIEW_REFRESH_DEBOUNCE_MS ??= '0';

// --------------------------------------------------------------------------
// Categories (4)
// --------------------------------------------------------------------------
interface CategorySeed {
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
}

const CATEGORIES: CategorySeed[] = [
  { slug: 'tuning-tools', name: 'Tuning Tools', description: 'ECU and TCU programmers for OBD, Bench and Boot tuning.', sortOrder: 1 },
  { slug: 'diagnostic-tools', name: 'Diagnostic Tools', description: 'Scanners, programmers and diagnostic interfaces for workshops.', sortOrder: 2 },
  { slug: 'cables-adapters', name: 'Cables & Adapters', description: 'Bench, boot and protocol cables and adapter harnesses.', sortOrder: 3 },
  { slug: 'key-programming', name: 'Key Programming', description: 'Key programmers, remotes and immobiliser tools.', sortOrder: 4 },
];

// --------------------------------------------------------------------------
// Brand placeholder logos
// --------------------------------------------------------------------------
const LOGO_FILES = {
  alientech: 'alientech-logo.png',
  autotuner: 'autotuner-logo.png',
  bflash: 'bflash-logo.png',
  caracal: 'caracal-logo.png',
} as const;

function logoFileFor(brandSlug: string): string {
  if (brandSlug.includes('alientech') || brandSlug.includes('kess')) return LOGO_FILES.alientech;
  if (brandSlug.includes('autotuner')) return LOGO_FILES.autotuner;
  if (brandSlug.includes('bflash')) return LOGO_FILES.bflash;
  return LOGO_FILES.caracal;
}

// --------------------------------------------------------------------------
// The 29 products, copied verbatim from data/products-import.sql (May 2026).
// price_minor is the FROZEN AED sell price; compare_price_minor is dropped on
// import (it was a fabricated +30% markup, not a real manufacturer RRP).
// --------------------------------------------------------------------------
interface LegacyProduct {
  ctId: string;
  sku: string;
  slug: string;
  categorySlug: 'tuning-tools' | 'diagnostic-tools' | 'cables-adapters' | 'key-programming';
  titleEn: string;
  descriptionEn: string;
  priceMinor: number; // AED cents — frozen as priced_sell_cents
  sortOrder: number;
  /** Explicit brand for the product. Overrides inferMk3Manufacturer so we don't
   *  end up with "Unknown" for brands the parser doesn't recognise (Xhorse, CGDI,
   *  Scanmatik, VNCI, GODIAG, Fortin, KEYDIY, …). M2 enrichment can refine. */
  brand: string;
}

const LEGACY_PRODUCTS: LegacyProduct[] = [
  { ctId: 'CT-0001', sku: 'MK18000', slug: 'alientech-kessv3-ecu-and-tcu-programmer-obd-bench-boot', categorySlug: 'tuning-tools', titleEn: 'ALIENTECH KESSv3 ECU and TCU Programmer — OBD, Bench & Boot', descriptionEn: 'Professional ECU and TCU programmer. Reads and writes via OBD, Bench and Boot protocols for cars, trucks, agriculture and marine vessels.', priceMinor: 328592, sortOrder: 1, brand: 'Alientech' },
  { ctId: 'CT-0002', sku: 'MKON482', slug: 'alientech-kess3-slave-cars-agriculture-truck-bikes-marine-ob', categorySlug: 'tuning-tools', titleEn: 'Alientech KESS3 Slave — Cars, Agriculture, Truck, Bikes, Marine (OBD-Bench-Boot)', descriptionEn: 'KESS3 Slave programmer with full vehicle coverage. Supports all read/write protocols: OBD, Bench, and Boot across all vehicle categories.', priceMinor: 2102994, sortOrder: 2, brand: 'Alientech' },
  { ctId: 'CT-0003', sku: 'MKON481', slug: 'alientech-kess3-master-cars-agriculture-truck-bikes-marine-o', categorySlug: 'tuning-tools', titleEn: 'Alientech KESS3 Master — Cars, Agriculture, Truck, Bikes, Marine (OBD-Bench-Boot)', descriptionEn: 'KESS3 Master programmer with the widest vehicle coverage. Full OBD, Bench and Boot read/write for cars, agriculture, trucks, bikes and marine.', priceMinor: 4074552, sortOrder: 3, brand: 'Alientech' },
  { ctId: 'CT-0004', sku: 'MKON332', slug: 'autotuner-tool-device-master-version', categorySlug: 'tuning-tools', titleEn: 'AutoTuner Tool Device — Master Version', descriptionEn: 'AutoTuner Master: professional ECU remapping device with OBD, Bench and Boot support. Wide coverage of car, truck and agricultural ECUs.', priceMinor: 2300149, sortOrder: 4, brand: 'AutoTuner' },
  { ctId: 'CT-0005', sku: 'MKON331', slug: 'autotuner-tool-device-slave-version', categorySlug: 'tuning-tools', titleEn: 'AutoTuner Tool Device — Slave Version', descriptionEn: 'AutoTuner Slave programmer. Full read and write via OBD, Bench and Boot. Operates with AutoTuner Master or standalone.', priceMinor: 1361313, sortOrder: 5, brand: 'AutoTuner' },
  { ctId: 'CT-0006', sku: 'MKON525', slug: 'autotuner-one-multi-brand-obd-ii-personal-flasher', categorySlug: 'tuning-tools', titleEn: 'AutoTuner One Multi-brand OBD-II Personal Flasher', descriptionEn: 'Compact multi-brand OBD-II personal flasher. Quick ECU and TCU updates via OBD for a wide range of vehicles.', priceMinor: 93884, sortOrder: 6, brand: 'AutoTuner' },
  { ctId: 'CT-0007', sku: 'MK22621', slug: 'xhorse-xdmpg0gl-multi-prog-ecu-programmer-free-mqb48-akl-lic', categorySlug: 'tuning-tools', titleEn: 'Xhorse XDMPG0GL Multi-Prog ECU Programmer + FREE MQB48 AKL License', descriptionEn: 'Multi-protocol ECU programmer with complimentary MQB48 all-keys-lost license. Reads and writes via OBD, Bench and Boot.', priceMinor: 322960, sortOrder: 7, brand: 'Xhorse' },
  { ctId: 'CT-0008', sku: 'MK17318', slug: 'cgdi-cg-fc200-ecu-programmer-full-version', categorySlug: 'tuning-tools', titleEn: 'CGDI CG FC200 ECU Programmer — Full Version', descriptionEn: 'Full-version ECU programmer supporting over 4200 ECU types. Clone, read and write ECU data via OBD, Bench and Boot.', priceMinor: 282186, sortOrder: 8, brand: 'CGDI' },
  { ctId: 'CT-0009', sku: 'MK22671', slug: 'microtronik-hexprog-ii-lite-chip-tuning-tool', categorySlug: 'tuning-tools', titleEn: 'Microtronik Hexprog II Lite Chip Tuning Tool', descriptionEn: 'Hexprog II Lite chip tuning platform. Full ECU read, write and checksum correction for popular petrol and diesel ECUs.', priceMinor: 215980, sortOrder: 9, brand: 'Microtronik' },
  { ctId: 'CT-0010', sku: 'MK26269', slug: 'ecu-soft-powerbox-for-pcmflash', categorySlug: 'tuning-tools', titleEn: 'ECU-Soft PowerBox for PCMFlash', descriptionEn: 'Bench power supply designed for PCMFlash ECU programming. Stable power with OBD pinout breakout for direct ECU bench work.', priceMinor: 322960, sortOrder: 10, brand: 'ECU-Soft' },
  { ctId: 'CT-0011', sku: 'MKON553', slug: 'xhorse-key-tool-midi-advanced-version-xdkmd0en', categorySlug: 'diagnostic-tools', titleEn: 'Xhorse Key Tool MIDI Advanced Version (XDKMD0EN)', descriptionEn: 'Advanced MIDI key programming device. Supports smart keys, proximity keys and remote generation for a wide range of vehicles.', priceMinor: 322556, sortOrder: 11, brand: 'Xhorse' },
  { ctId: 'CT-0012', sku: 'MK26449', slug: 'xhorse-key-tool-midi-basic-version-xdkmd0en', categorySlug: 'diagnostic-tools', titleEn: 'Xhorse Key Tool MIDI Basic Version (XDKMD0EN)', descriptionEn: 'Basic MIDI key programming device. OBD and blade key support for mainstream vehicles.', priceMinor: 241816, sortOrder: 12, brand: 'Xhorse' },
  { ctId: 'CT-0013', sku: 'MKON184', slug: 'avdi-abrites-vehicle-diagnostics-interface', categorySlug: 'diagnostic-tools', titleEn: 'AVDI — Abrites Vehicle Diagnostics Interface', descriptionEn: 'AVDI diagnostics interface for advanced coding, programming and diagnostics on BMW, Mercedes, VAG, Land Rover and more.', priceMinor: 352063, sortOrder: 13, brand: 'Abrites' },
  { ctId: 'CT-0014', sku: 'MK17353', slug: 'autel-maxibas-bt608-battery-and-electrical-system-diagnostic', categorySlug: 'diagnostic-tools', titleEn: 'Autel MaxiBAS BT608 Battery and Electrical System Diagnostic Tool', descriptionEn: 'Professional battery and electrical tester. Tests 12V/24V batteries, starter, alternator and charging system.', priceMinor: 201850, sortOrder: 14, brand: 'Autel' },
  { ctId: 'CT-0015', sku: 'MKON501', slug: 'genuine-scanmatik-3-tool-with-tunerwire-boot-bench-cable', categorySlug: 'diagnostic-tools', titleEn: 'Genuine Scanmatik 3 Tool with TunerWire Boot/Bench Cable', descriptionEn: 'Scanmatik 3 with TunerWire bench and boot cable. Full read, write and checksum for a wide range of ECUs.', priceMinor: 193586, sortOrder: 15, brand: 'Scanmatik' },
  { ctId: 'CT-0016', sku: 'MK25248', slug: 'genuine-scanmatik-3-professional-scan-and-reprogramming-tool', categorySlug: 'diagnostic-tools', titleEn: 'Genuine Scanmatik 3 Professional Scan and Reprogramming Tool', descriptionEn: 'Scanmatik 3 professional: scanning and reprogramming with OBD diagnostics and ECU data operations.', priceMinor: 174188, sortOrder: 16, brand: 'Scanmatik' },
  { ctId: 'CT-0017', sku: 'MK25353', slug: 'vnci-jlr-doip-jaguar-land-rover-diagnostic-interface', categorySlug: 'diagnostic-tools', titleEn: 'VNCI JLR DoIP Jaguar Land Rover Diagnostic Interface', descriptionEn: 'Genuine VNCI DoIP interface for Jaguar and Land Rover. Full SDD and Pathfinder diagnostics including online programming.', priceMinor: 108595, sortOrder: 17, brand: 'VNCI' },
  { ctId: 'CT-0018', sku: 'MKON289', slug: 'godiag-gt100-pro-breakout-box-bmw-cas4-fem-bdc-test-platform', categorySlug: 'diagnostic-tools', titleEn: 'GODIAG GT100 Pro Breakout Box + BMW CAS4 / FEM / BDC Test Platform Bundle', descriptionEn: 'GT100 Pro ECU breakout box with BMW CAS4 and FEM/BDC test platform. Bench testing and programming without the vehicle.', priceMinor: 80336, sortOrder: 18, brand: 'GODIAG' },
  { ctId: 'CT-0019', sku: 'MK25522', slug: 'gromcalctool-srs-full-package', categorySlug: 'diagnostic-tools', titleEn: 'GromCalcTool SRS Full Package', descriptionEn: 'Complete SRS airbag reset and crash data removal solution. Supports a wide range of vehicle makes with full module coverage.', priceMinor: 413793, sortOrder: 19, brand: 'GromCalcTool' },
  { ctId: 'CT-0020', sku: 'MK24017', slug: 'autel-maxiflash-elite-j2534-ecu-programming-device', categorySlug: 'diagnostic-tools', titleEn: 'Autel MaxiFlash Elite J2534 ECU Programming Device', descriptionEn: 'J2534 pass-thru ECU programming device compatible with all OEM dealer software for ECU updates and reprogramming.', priceMinor: 242220, sortOrder: 20, brand: 'Autel' },
  { ctId: 'CT-0021', sku: 'MK19872', slug: 'i-o-io-terminal-multi-tool-device', categorySlug: 'diagnostic-tools', titleEn: 'I/O IO Terminal Multi Tool Device', descriptionEn: 'Multi-function IO Terminal for ECU, TCU and key programming. Supports K-Line, CAN and LIN protocols.', priceMinor: 140891, sortOrder: 21, brand: 'IO Terminal' },
  { ctId: 'CT-0022', sku: 'MK26801', slug: 'probyte-usb-security-dongle', categorySlug: 'diagnostic-tools', titleEn: 'ProBYTE USB Security Dongle', descriptionEn: 'USB security dongle for tuning and diagnostic software license activation.', priceMinor: 60151, sortOrder: 22, brand: 'ProBYTE' },
  { ctId: 'CT-0023', sku: 'MK24914', slug: 'mmcflash-usb-dongle-key', categorySlug: 'diagnostic-tools', titleEn: 'MMCFlash USB Dongle Key', descriptionEn: 'USB dongle for MMCFlash chip tuning platform activation. Enables bench and OBD read/write for supported ECU families.', priceMinor: 52077, sortOrder: 23, brand: 'MMCFlash' },
  { ctId: 'CT-0024', sku: 'MK12384', slug: 'autel-charging-station-back-to-back-pedestal', categorySlug: 'diagnostic-tools', titleEn: 'Autel Charging Station Back-to-Back Pedestal', descriptionEn: 'Dual back-to-back charging pedestal for Autel diagnostic tablets.', priceMinor: 80336, sortOrder: 24, brand: 'Autel' },
  { ctId: 'CT-0025', sku: 'MKON533', slug: 'io-terminal-obd-cable-and-godiag-obd2-jumper-adapter', categorySlug: 'cables-adapters', titleEn: 'IO Terminal OBD Cable and GODIAG OBD2 Jumper Adapter', descriptionEn: 'IO Terminal OBD cable with GODIAG OBD2 jumper adapter for direct ECU bench connection without vehicle power.', priceMinor: 90130, sortOrder: 25, brand: 'IO Terminal' },
  { ctId: 'CT-0026', sku: 'MK20125', slug: 'fortin-flashlink-4-firmware-update-usb-flash-link', categorySlug: 'key-programming', titleEn: 'Fortin Flashlink 4 Firmware Update USB Flash Link', descriptionEn: 'USB flash link for updating Fortin bypass module firmware via bootloader. Required for firmware maintenance.', priceMinor: 18167, sortOrder: 26, brand: 'Fortin' },
  { ctId: 'CT-0027', sku: 'MK20064', slug: 'fortin-evo-one-remote-starter-and-security-system-interface', categorySlug: 'key-programming', titleEn: 'Fortin EVO-ONE Remote Starter and Security System Interface', descriptionEn: 'EVO-ONE remote starter and security bypass for a wide range of vehicles. Plug-and-play T-harness compatibility.', priceMinor: 36333, sortOrder: 27, brand: 'Fortin' },
  { ctId: 'CT-0028', sku: 'MK20056', slug: 'keydiy-kd-cs01-cloud-key-5-button-universal-garage-remote-22', categorySlug: 'key-programming', titleEn: 'KEYDIY KD CS01 Cloud Key 5-Button Universal Garage Remote 225-915MHz', descriptionEn: 'Universal cloud garage remote. 5 buttons, 225-915MHz adjustable frequency. Compatible with KD Cloud key platform.', priceMinor: 2019, sortOrder: 28, brand: 'KEYDIY' },
  { ctId: 'CT-0029', sku: 'MK15798', slug: 'keydiy-kd-universal-remote-key-4-buttons-garage-type-b31', categorySlug: 'key-programming', titleEn: 'Keydiy KD Universal Remote Key 4 Buttons Garage Type B31', descriptionEn: 'Universal 4-button KD garage remote Type B31 for most KD-based remote cloning systems.', priceMinor: 1413, sortOrder: 29, brand: 'KEYDIY' },
];

function stringify(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2);
}

async function upsertCategory(seed: CategorySeed) {
  const prisma = getPrismaClient();
  const existing = await prisma.catalogCategory.findFirst({
    where: { parentId: null, slug: seed.slug },
  });
  if (existing) {
    return prisma.catalogCategory.update({
      where: { id: existing.id },
      data: { name: seed.name, description: seed.description, sortOrder: seed.sortOrder },
    });
  }
  return prisma.catalogCategory.create({
    data: {
      slug: seed.slug,
      name: seed.name,
      description: seed.description,
      sortOrder: seed.sortOrder,
    },
  });
}

async function main(): Promise<void> {
  const prisma = getPrismaClient();
  const publicSiteUrl = (process.env.PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');
  if (!publicSiteUrl) {
    throw new Error('PUBLIC_SITE_URL must be set (used to build placeholder /media/ image URLs).');
  }

  // Stage users (creator + publisher, two-person publish gate spirit).
  const creator = await ensureStageUser({
    id: 'caracal-import-creator',
    email: 'import.creator@caracal.local',
    name: 'Legacy Import Creator',
    role: 'ADMIN',
  });
  const publisher = await ensureStageUser({
    id: 'caracal-import-publisher',
    email: 'import.publisher@caracal.local',
    name: 'Legacy Import Publisher',
    role: 'ADMIN',
  });

  // Vendor (mk3) and categories.
  const vendor = await ensureMk3VendorSource();
  const categoriesBySlug = new Map<string, { id: bigint }>();
  for (const seed of CATEGORIES) {
    const cat = await upsertCategory(seed);
    categoriesBySlug.set(seed.slug, cat);
  }

  const published: Array<{
    slug: string;
    masterId: string;
    brand: string;
    pricedSellCentsAed: string;
    imageUrl: string;
  }> = [];
  const errors: Array<{ slug: string; error: string }> = [];

  for (const product of LEGACY_PRODUCTS) {
    try {
      // Explicit per-product brand wins over inferMk3Manufacturer's narrow list
      // (which only knows Alientech/Autotuner/Autel and falls back to "Unknown"
      // for everyone else). Slug derived consistently with the rest of the system.
      const manufacturer = product.brand
        ? { slug: slugifyCatalogValue(product.brand) || 'unknown', name: product.brand }
        : inferMk3Manufacturer(product.titleEn);
      const mpnOrSku = inferMk3MpnOrSku(product.titleEn, product.sku);
      const variantKey = inferMk3VariantKey(product.titleEn);
      const fingerprint = buildMk3Fingerprint({
        manufacturerSlug: manufacturer.slug,
        manufacturerName: manufacturer.name,
        mpnOrSku,
        variantKey,
      });

      const manufacturerRow = await prisma.manufacturer.upsert({
        where: { slug: manufacturer.slug },
        create: { slug: manufacturer.slug, name: manufacturer.name },
        update: { name: manufacturer.name },
      });

      const category = categoriesBySlug.get(product.categorySlug);
      if (!category) throw new Error(`Unknown category slug: ${product.categorySlug}`);

      const imageUrl = `${publicSiteUrl}/media/${logoFileFor(manufacturer.slug)}`;

      // Master (PENDING_REVIEW first, creator).
      const master = await prisma.masterProduct.upsert({
        where: { slug: product.slug },
        create: {
          slug: product.slug,
          sku: product.sku,
          mpn: product.sku,
          name: product.titleEn,
          shortDescription: product.descriptionEn.slice(0, 200),
          longDescriptionMd: product.descriptionEn,
          manufacturerId: manufacturerRow.id,
          manufacturerSlug: manufacturerRow.slug,
          manufacturerName: manufacturerRow.name,
          categoryId: category.id,
          status: 'PENDING_REVIEW',
          fingerprint,
          sortOrder: product.sortOrder,
          featured: false,
          createdById: creator.id,
          updatedById: creator.id,
        },
        update: {
          name: product.titleEn,
          shortDescription: product.descriptionEn.slice(0, 200),
          longDescriptionMd: product.descriptionEn,
          manufacturerId: manufacturerRow.id,
          manufacturerSlug: manufacturerRow.slug,
          manufacturerName: manufacturerRow.name,
          categoryId: category.id,
          fingerprint,
          sortOrder: product.sortOrder,
          updatedById: creator.id,
        },
      });

      // Synthetic mk3 vendor offer — AED-denominated rough back-derive of mk3
      // list (old_price / 1.10). Exists only to satisfy publishBlockers; M2
      // engine replaces it with the real EUR/USD dealer cost.
      const vendorUrl = `https://www.mk3.com/products/${product.slug}`;
      const offerCents = BigInt(Math.round(product.priceMinor / 1.10));
      await prisma.vendorOffer.upsert({
        where: { vendorId_vendorUrl: { vendorId: vendor.id, vendorUrl } },
        create: {
          productId: master.id,
          vendorId: vendor.id,
          vendorSku: product.sku,
          vendorUrl,
          priceCents: offerCents,
          currency: 'AED',
          inStock: true,
          lastSeenAt: new Date(),
          status: 'ACTIVE',
          notes: 'M1 legacy-import synthetic offer; replace with real dealer cost during M2 enrichment.',
        },
        update: {
          productId: master.id,
          priceCents: offerCents,
          currency: 'AED',
          inStock: true,
          lastSeenAt: new Date(),
          status: 'ACTIVE',
        },
      });

      // Primary image — brand-logo placeholder.
      const existingImage = await prisma.catalogProductImage.findFirst({
        where: { productId: master.id, storageKey: imageUrl },
        select: { id: true },
      });
      if (!existingImage) {
        await prisma.catalogProductImage.updateMany({
          where: { productId: master.id },
          data: { isPrimary: false },
        });
        await prisma.catalogProductImage.create({
          data: {
            productId: master.id,
            storageKey: imageUrl,
            mimeType: 'image/png',
            altText: product.titleEn,
            isPrimary: true,
            sortOrder: 0,
            sourceVendorId: vendor.id,
          },
        });
      }

      // DIRECT publish freezing the OLD AED price exactly (no snapshot recompute).
      // M2 enrichment will run the engine reprice once real cost data lands.
      const publishedAt = new Date();
      await prisma.masterProduct.update({
        where: { id: master.id },
        data: {
          status: 'PUBLISHED',
          publishedAt,
          archivedAt: null,
          updatedById: publisher.id,
          pricedSellCents: BigInt(product.priceMinor),
          pricedCurrency: 'AED',
          pricedAt: publishedAt,
          pricedSourceCostCents: offerCents,
          pricedSourceCurrency: 'AED',
          pricedFxRateToAed: '1.000000',
          pricedMarginBps: 1500,
          compareAtCents: null,
          compareAtCurrency: null,
          rrpSourceCents: null,
          rrpSourceCurrency: null,
        },
      });

      published.push({
        slug: product.slug,
        masterId: master.id.toString(),
        brand: manufacturer.name,
        pricedSellCentsAed: product.priceMinor.toString(),
        imageUrl,
      });
    } catch (error) {
      errors.push({ slug: product.slug, error: error instanceof Error ? error.message : String(error) });
    }
  }

  // Refresh matview and project each to Typesense (best-effort).
  await refreshPublicProductsMaterializedViewDebounced();
  const searchResults: Array<{ masterId: string; ok: boolean; error?: string }> = [];
  for (const item of published) {
    try {
      await projectMasterProductToSearch(item.masterId);
      searchResults.push({ masterId: item.masterId, ok: true });
    } catch (error) {
      searchResults.push({
        masterId: item.masterId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const slugs = published.map((p) => p.slug);
  const verification = await prisma.$queryRaw<
    Array<{ slug: string; sell_price_cents: bigint | null; has_image: boolean }>
  >`
    SELECT pp.slug::text AS slug,
           pp.sell_price_cents,
           (pp.primary_image IS NOT NULL) AS has_image
    FROM public_products pp
    WHERE pp.slug = ANY(${slugs}::citext[])
    ORDER BY pp.slug
  `;

  const report = {
    ok: errors.length === 0 && published.length === LEGACY_PRODUCTS.length,
    publicSiteUrl,
    counts: {
      requested: LEGACY_PRODUCTS.length,
      published: published.length,
      errors: errors.length,
      inPublicProducts: verification.length,
    },
    categories: Array.from(categoriesBySlug.keys()),
    published,
    errors,
    publicProductsSample: verification.slice(0, 5).map((row) => ({
      slug: row.slug,
      sellPriceCentsAed: row.sell_price_cents ? row.sell_price_cents.toString() : null,
      hasPrimaryImage: row.has_image,
    })),
    typesenseSummary: {
      total: searchResults.length,
      ok: searchResults.filter((r) => r.ok).length,
      failed: searchResults.filter((r) => !r.ok).length,
      firstError: searchResults.find((r) => !r.ok)?.error ?? null,
    },
    note:
      'M1 import: brand-logo placeholders + old AED prices preserved exactly. ' +
      'Run a full Typesense alias-swap reindex after this if search count looks off.',
  };

  console.log(stringify(report));
  if (!report.ok) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrismaClient();
  });
