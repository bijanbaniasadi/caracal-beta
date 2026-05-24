import 'dotenv/config';

import { PrismaClient, type InventoryStatus } from '@prisma/client';

const prisma = new PrismaClient();

interface SeedProduct {
  sku: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  categorySlug: string;
  supplierSlug: string;
  priceCents: number;
  tradePriceCents?: number;
  isFeatured?: boolean;
  isB2BEligible?: boolean;
  isTradeOnly?: boolean;
  quantityOnHand: number;
  reorderPoint: number;
  inventoryStatus: InventoryStatus;
  imageUrl: string;
  attributes: Record<string, unknown>;
}

const categories = [
  {
    name: 'ECU and TCU Tuning Tools',
    slug: 'ecu-tcu-tuning-tools',
    description: 'Professional flashing, calibration, and programming tools.',
    sortOrder: 10,
  },
  {
    name: 'Calibration Software',
    slug: 'calibration-software',
    description: 'Software products for map editing and calibration workflows.',
    sortOrder: 20,
  },
  {
    name: 'Workshop Equipment',
    slug: 'workshop-equipment',
    description: 'Power, bench, and diagnostic equipment for tuning workshops.',
    sortOrder: 30,
  },
  {
    name: 'ECU Adapters',
    slug: 'ecu-adapters',
    description: 'Adapters, harnesses, and bench accessories for ECU work.',
    sortOrder: 40,
  },
] as const;

const suppliers = [
  {
    name: 'Alientech',
    slug: 'alientech',
    websiteUrl: 'https://www.alientech-tools.com',
  },
  {
    name: 'AutoTuner',
    slug: 'autotuner',
    websiteUrl: 'https://www.autotuner-tool.com',
  },
  {
    name: 'BFlash',
    slug: 'bflash',
    websiteUrl: 'https://www.bflash.eu',
  },
  {
    name: 'EVC',
    slug: 'evc',
    websiteUrl: 'https://www.evc.de',
  },
  {
    name: 'Caracal Workshop Supply',
    slug: 'caracal-workshop-supply',
    websiteUrl: 'https://caracaltechmotors.com',
  },
] as const;

const products: SeedProduct[] = [
  {
    sku: 'KESS3-MASTER',
    slug: 'kess3-master',
    name: 'KESS3 ECU and TCU Programming Tool',
    shortDescription: 'Alientech KESS3 hardware for OBD, bench, and boot tuning workflows.',
    description:
      'Professional ECU and TCU programming platform for workshops handling modern diagnostic and calibration workflows.',
    categorySlug: 'ecu-tcu-tuning-tools',
    supplierSlug: 'alientech',
    priceCents: 680000,
    tradePriceCents: 625000,
    isFeatured: true,
    isB2BEligible: true,
    quantityOnHand: 4,
    reorderPoint: 1,
    inventoryStatus: 'IN_STOCK',
    imageUrl: '/catalog/kess3-master.jpg',
    attributes: {
      brand: 'Alientech',
      channels: ['OBD', 'Bench', 'Boot'],
      inquiryReady: true,
    },
  },
  {
    sku: 'AUTOTUNER-TOOL',
    slug: 'autotuner-tool',
    name: 'AutoTuner ECU Programming Tool',
    shortDescription: 'AutoTuner flashing hardware for professional ECU tuning support.',
    description:
      'Compact ECU programming hardware for diagnostic, bench, and service workflows across supported vehicles.',
    categorySlug: 'ecu-tcu-tuning-tools',
    supplierSlug: 'autotuner',
    priceCents: 720000,
    tradePriceCents: 670000,
    isFeatured: true,
    isB2BEligible: true,
    quantityOnHand: 3,
    reorderPoint: 1,
    inventoryStatus: 'IN_STOCK',
    imageUrl: '/catalog/autotuner-tool.jpg',
    attributes: {
      brand: 'AutoTuner',
      channels: ['OBD', 'Bench'],
      inquiryReady: true,
    },
  },
  {
    sku: 'BFLASH-MASTER',
    slug: 'bflash-master',
    name: 'BFlash Master Tool',
    shortDescription: 'BFlash master tooling for ECU and TCU reading and writing.',
    description:
      'Professional BFlash tooling for calibration businesses that need stable ECU and TCU operations.',
    categorySlug: 'ecu-tcu-tuning-tools',
    supplierSlug: 'bflash',
    priceCents: 650000,
    tradePriceCents: 610000,
    isFeatured: false,
    isB2BEligible: true,
    quantityOnHand: 2,
    reorderPoint: 1,
    inventoryStatus: 'LOW_STOCK',
    imageUrl: '/catalog/bflash-master.jpg',
    attributes: {
      brand: 'BFlash',
      channels: ['OBD', 'Bench', 'Boot'],
      inquiryReady: true,
    },
  },
  {
    sku: 'WINOLS-LICENSE',
    slug: 'winols-license',
    name: 'WinOLS Calibration Software',
    shortDescription: 'EVC WinOLS license for professional map editing and calibration work.',
    description:
      'Calibration software license for map editing, project comparison, checksum workflows, and tuning file development.',
    categorySlug: 'calibration-software',
    supplierSlug: 'evc',
    priceCents: 480000,
    tradePriceCents: 455000,
    isFeatured: true,
    isB2BEligible: true,
    isTradeOnly: true,
    quantityOnHand: 12,
    reorderPoint: 2,
    inventoryStatus: 'IN_STOCK',
    imageUrl: '/catalog/winols-license.jpg',
    attributes: {
      brand: 'EVC',
      delivery: 'License',
      inquiryReady: true,
    },
  },
  {
    sku: 'BENCH-PSU-120A',
    slug: 'bench-power-supply-120a',
    name: 'Bench Power Supply 120A',
    shortDescription: 'Stable high-current power supply for ECU bench flashing and diagnostics.',
    description:
      'Workshop bench power supply for maintaining stable voltage during flashing, diagnostics, and module programming.',
    categorySlug: 'workshop-equipment',
    supplierSlug: 'caracal-workshop-supply',
    priceCents: 185000,
    tradePriceCents: 165000,
    isB2BEligible: true,
    quantityOnHand: 6,
    reorderPoint: 2,
    inventoryStatus: 'IN_STOCK',
    imageUrl: '/catalog/bench-power-supply-120a.jpg',
    attributes: {
      outputCurrentAmps: 120,
      useCases: ['Bench flashing', 'Diagnostics', 'Module programming'],
      inquiryReady: true,
    },
  },
  {
    sku: 'ECU-ADAPTER-KIT',
    slug: 'ecu-adapter-kit',
    name: 'ECU Bench Adapter Kit',
    shortDescription: 'Adapter set for common ECU bench and boot-mode connection workflows.',
    description:
      'Workshop adapter kit for reliable ECU pinout connection during bench flashing and boot recovery operations.',
    categorySlug: 'ecu-adapters',
    supplierSlug: 'caracal-workshop-supply',
    priceCents: 95000,
    tradePriceCents: 82000,
    isB2BEligible: true,
    quantityOnHand: 9,
    reorderPoint: 3,
    inventoryStatus: 'IN_STOCK',
    imageUrl: '/catalog/ecu-adapter-kit.jpg',
    attributes: {
      adapterTypes: ['Bench harness', 'Boot probes', 'Power leads'],
      inquiryReady: true,
    },
  },
];

async function seedCatalog(): Promise<SeedProduct[]> {
  const categoryBySlug = new Map<string, string>();
  const supplierBySlug = new Map<string, string>();

  for (const category of categories) {
    const record = await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
      select: { id: true, slug: true },
    });
    categoryBySlug.set(record.slug, record.id);
  }

  for (const supplier of suppliers) {
    const record = await prisma.supplier.upsert({
      where: { slug: supplier.slug },
      update: supplier,
      create: supplier,
      select: { id: true, slug: true },
    });
    supplierBySlug.set(record.slug, record.id);
  }

  for (const product of products) {
    const categoryId = categoryBySlug.get(product.categorySlug);
    const supplierId = supplierBySlug.get(product.supplierSlug);

    if (!categoryId || !supplierId) {
      throw new Error(`Missing catalog dependency for ${product.sku}`);
    }

    const record = await prisma.product.upsert({
      where: { sku: product.sku },
      update: {
        slug: product.slug,
        name: product.name,
        shortDescription: product.shortDescription,
        description: product.description,
        status: 'ACTIVE',
        priceCents: product.priceCents,
        currency: 'AED',
        tradePriceCents: product.tradePriceCents,
        isFeatured: product.isFeatured ?? false,
        isB2BEligible: product.isB2BEligible ?? false,
        isTradeOnly: product.isTradeOnly ?? false,
        categoryId,
        supplierId,
        attributes: product.attributes,
        metadata: { seeded: true },
        publishedAt: new Date(),
      },
      create: {
        sku: product.sku,
        slug: product.slug,
        name: product.name,
        shortDescription: product.shortDescription,
        description: product.description,
        status: 'ACTIVE',
        priceCents: product.priceCents,
        currency: 'AED',
        tradePriceCents: product.tradePriceCents,
        isFeatured: product.isFeatured ?? false,
        isB2BEligible: product.isB2BEligible ?? false,
        isTradeOnly: product.isTradeOnly ?? false,
        categoryId,
        supplierId,
        attributes: product.attributes,
        metadata: { seeded: true },
        publishedAt: new Date(),
      },
      select: { id: true },
    });

    await prisma.productImage.deleteMany({
      where: { productId: record.id },
    });
    await prisma.productImage.create({
      data: {
        productId: record.id,
        url: product.imageUrl,
        altText: product.name,
        sortOrder: 0,
        isPrimary: true,
        metadata: { seeded: true },
      },
    });

    await prisma.inventoryItem.upsert({
      where: {
        productId_locationKey: {
          productId: record.id,
          locationKey: 'dubai-hq',
        },
      },
      update: {
        locationLabel: 'Dubai HQ',
        quantityOnHand: product.quantityOnHand,
        quantityReserved: 0,
        reorderPoint: product.reorderPoint,
        status: product.inventoryStatus,
        metadata: { seeded: true },
      },
      create: {
        productId: record.id,
        locationKey: 'dubai-hq',
        locationLabel: 'Dubai HQ',
        quantityOnHand: product.quantityOnHand,
        quantityReserved: 0,
        reorderPoint: product.reorderPoint,
        status: product.inventoryStatus,
        metadata: { seeded: true },
      },
    });
  }

  return products;
}

async function main(): Promise<void> {
  const seededProducts = await seedCatalog();
  const kess3 = await prisma.product.findUniqueOrThrow({
    where: { sku: 'KESS3-MASTER' },
    select: { id: true, sku: true, name: true },
  });

  const [user, quoteRequest, productInquiry, workshopLead] = await prisma.$transaction([
    prisma.user.upsert({
      where: { email: 'dev@caracaltechmotors.com' },
      update: { name: 'Caracal Dev' },
      create: {
        email: 'dev@caracaltechmotors.com',
        name: 'Caracal Dev',
      },
      select: { id: true, email: true },
    }),
    prisma.quoteRequest.upsert({
      where: { referenceCode: 'QR-SEED-LOCAL' },
      update: {
        customerName: 'Local Seed Customer',
        customerEmail: 'seed.quote@caracaltechmotors.com',
        customerPhone: '+971500000001',
        vehicleDetails: 'Seed calibration intake',
        requestedItems: ['ECU calibration', 'Bench flash'],
        message: 'Seed quote request for local backend validation.',
        source: 'seed',
        metadata: { seeded: true },
      },
      create: {
        referenceCode: 'QR-SEED-LOCAL',
        customerName: 'Local Seed Customer',
        customerEmail: 'seed.quote@caracaltechmotors.com',
        customerPhone: '+971500000001',
        vehicleDetails: 'Seed calibration intake',
        requestedItems: ['ECU calibration', 'Bench flash'],
        message: 'Seed quote request for local backend validation.',
        source: 'seed',
        metadata: { seeded: true },
      },
      select: { id: true, referenceCode: true },
    }),
    prisma.productInquiry.upsert({
      where: { referenceCode: 'PI-SEED-LOCAL' },
      update: {
        productId: kess3.id,
        productSku: kess3.sku,
        productName: kess3.name,
        customerName: 'Seed Product Customer',
        customerEmail: 'seed.product@caracaltechmotors.com',
        quantity: 1,
        message: 'Seed product inquiry for local backend validation.',
        source: 'seed',
        metadata: { seeded: true },
      },
      create: {
        referenceCode: 'PI-SEED-LOCAL',
        productId: kess3.id,
        productSku: kess3.sku,
        productName: kess3.name,
        customerName: 'Seed Product Customer',
        customerEmail: 'seed.product@caracaltechmotors.com',
        quantity: 1,
        message: 'Seed product inquiry for local backend validation.',
        source: 'seed',
        metadata: { seeded: true },
      },
      select: { id: true, referenceCode: true },
    }),
    prisma.workshopConsultationLead.upsert({
      where: { referenceCode: 'WC-SEED-LOCAL' },
      update: {
        workshopName: 'Seed Workshop',
        contactName: 'Seed Workshop Contact',
        contactEmail: 'seed.workshop@caracaltechmotors.com',
        contactPhone: '+971500000002',
        location: 'Dubai',
        monthlyVolume: 12,
        serviceInterests: ['Diagnostics', 'Remote tuning'],
        preferredTimeline: '30 days',
        message: 'Seed workshop lead for local backend validation.',
        source: 'seed',
        metadata: { seeded: true },
      },
      create: {
        referenceCode: 'WC-SEED-LOCAL',
        workshopName: 'Seed Workshop',
        contactName: 'Seed Workshop Contact',
        contactEmail: 'seed.workshop@caracaltechmotors.com',
        contactPhone: '+971500000002',
        location: 'Dubai',
        monthlyVolume: 12,
        serviceInterests: ['Diagnostics', 'Remote tuning'],
        preferredTimeline: '30 days',
        message: 'Seed workshop lead for local backend validation.',
        source: 'seed',
        metadata: { seeded: true },
      },
      select: { id: true, referenceCode: true },
    }),
  ]);

  await prisma.auditLog.create({
    data: {
      actorType: 'SYSTEM',
      action: 'seed.completed',
      entityType: 'SeedRun',
      metadata: {
        userEmail: user.email,
        quoteReferenceCode: quoteRequest.referenceCode,
        productReferenceCode: productInquiry.referenceCode,
        workshopReferenceCode: workshopLead.referenceCode,
        catalogProductSkus: seededProducts.map((product) => product.sku),
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        seeded: true,
        records: {
          user,
          quoteRequest,
          productInquiry,
          workshopLead,
          catalogProducts: seededProducts.map((product) => product.sku),
        },
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
