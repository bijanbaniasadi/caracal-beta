import 'dotenv/config';

import bcrypt from 'bcryptjs';
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
  {
    name: 'Diagnostic Tools',
    slug: 'diagnostic-tools',
    description: 'Diagnostic interfaces, pass-thru devices, key tools, and programming hardware.',
    sortOrder: 50,
  },
  {
    name: 'Cables and Adapters',
    slug: 'cables-adapters',
    description: 'OBD, bench, breakout, and jumper adapters for ECU and module work.',
    sortOrder: 60,
  },
  {
    name: 'Key Programming',
    slug: 'key-programming',
    description: 'Key, remote, immobilizer, and security-programming accessories.',
    sortOrder: 70,
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
  { name: 'Xhorse', slug: 'xhorse', websiteUrl: 'https://www.xhorsevvdi.com' },
  { name: 'CGDI', slug: 'cgdi', websiteUrl: 'https://www.cgprogcar.com' },
  { name: 'Microtronik', slug: 'microtronik', websiteUrl: 'https://www.microtronik.com' },
  { name: 'ECU-Soft', slug: 'ecu-soft', websiteUrl: 'https://ecu-soft.com' },
  { name: 'Abrites', slug: 'abrites', websiteUrl: 'https://abrites.com' },
  { name: 'Autel', slug: 'autel', websiteUrl: 'https://www.autel.com' },
  { name: 'Scanmatik', slug: 'scanmatik', websiteUrl: 'https://scanmatik.ru' },
  { name: 'VNCI', slug: 'vnci', websiteUrl: null },
  { name: 'GODIAG', slug: 'godiag', websiteUrl: 'https://www.godiag.com' },
  { name: 'GromCalcTool', slug: 'gromcalctool', websiteUrl: null },
  { name: 'IO Terminal', slug: 'io-terminal', websiteUrl: 'https://ioterminal.com' },
  { name: 'ProBYTE', slug: 'probyte', websiteUrl: null },
  { name: 'MMCFlash', slug: 'mmcflash', websiteUrl: 'https://mmcflash.ru' },
  { name: 'Fortin', slug: 'fortin', websiteUrl: 'https://fortin.ca' },
  { name: 'KEYDIY', slug: 'keydiy', websiteUrl: 'https://www.keydiy.com' },
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
    imageUrl: '/images/devices/kess3.png',
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
    imageUrl: '/images/devices/autotuner.png',
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
    imageUrl: '/images/devices/bflash.png',
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
    imageUrl: '/images/diagnostic-bench.png',
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
    imageUrl: '/images/diagnostic-bench.png',
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
    imageUrl: '/images/diagnostic-bench.png',
    attributes: {
      adapterTypes: ['Bench harness', 'Boot probes', 'Power leads'],
      inquiryReady: true,
    },
  },
];

interface LegacyProductInput {
  sku: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  categorySlug: string;
  supplierSlug: string;
  priceCents: number;
  compareAtPriceCents: number;
  brand: string;
  legacyId: string;
  quantityOnHand: number;
  reorderPoint: number;
  imageUrl?: string;
  inventoryStatus?: InventoryStatus;
  isFeatured?: boolean;
  attributes?: Record<string, unknown>;
}

function legacyProduct(input: LegacyProductInput): SeedProduct {
  return {
    sku: input.sku,
    slug: input.slug,
    name: input.name,
    shortDescription: input.shortDescription,
    description: input.description,
    categorySlug: input.categorySlug,
    supplierSlug: input.supplierSlug,
    priceCents: input.priceCents,
    isFeatured: input.isFeatured,
    isB2BEligible: true,
    quantityOnHand: input.quantityOnHand,
    reorderPoint: input.reorderPoint,
    inventoryStatus: input.inventoryStatus ?? 'IN_STOCK',
    imageUrl: input.imageUrl ?? '/images/diagnostic-bench.png',
    attributes: {
      brand: input.brand,
      legacyId: input.legacyId,
      compareAtPriceCents: input.compareAtPriceCents,
      inquiryReady: true,
      ...input.attributes,
    },
  };
}

products.push(
  legacyProduct({
    sku: 'MK18000',
    slug: 'alientech-kessv3-ecu-and-tcu-programmer-obd-bench-boot',
    name: 'ALIENTECH KESSv3 ECU and TCU Programmer - OBD, Bench and Boot',
    shortDescription: 'Professional ECU and TCU programmer for OBD, bench, and boot protocols.',
    description:
      'Professional ECU and TCU programmer for cars, trucks, agriculture, motorcycles, and marine applications.',
    categorySlug: 'ecu-tcu-tuning-tools',
    supplierSlug: 'alientech',
    priceCents: 328592,
    compareAtPriceCents: 388336,
    brand: 'Alientech',
    legacyId: 'CT-0001',
    quantityOnHand: 8,
    reorderPoint: 2,
    imageUrl: '/images/devices/kess3.png',
    attributes: {
      channels: ['OBD', 'Bench', 'Boot'],
      vehicleTypes: ['Cars', 'Trucks', 'Agriculture', 'Motorcycles', 'Marine'],
    },
  }),
  legacyProduct({
    sku: 'MKON482',
    slug: 'alientech-kess3-slave-cars-agriculture-truck-bikes-marine-ob',
    name: 'Alientech KESS3 Slave - Cars, Agriculture, Trucks, Bikes and Marine',
    shortDescription: 'KESS3 Slave programmer with OBD, bench, and boot coverage.',
    description:
      'KESS3 Slave programmer with broad vehicle coverage across OBD, bench, and boot read/write workflows.',
    categorySlug: 'ecu-tcu-tuning-tools',
    supplierSlug: 'alientech',
    priceCents: 2102994,
    compareAtPriceCents: 2485357,
    brand: 'Alientech',
    legacyId: 'CT-0002',
    quantityOnHand: 4,
    reorderPoint: 1,
    isFeatured: true,
    imageUrl: '/images/devices/kess3.png',
    attributes: {
      channels: ['OBD', 'Bench', 'Boot'],
      vehicleTypes: ['Cars', 'Agriculture', 'Trucks', 'Bikes', 'Marine'],
    },
  }),
  legacyProduct({
    sku: 'MKON481',
    slug: 'alientech-kess3-master-cars-agriculture-truck-bikes-marine-o',
    name: 'Alientech KESS3 Master - Cars, Agriculture, Trucks, Bikes and Marine',
    shortDescription: 'KESS3 Master programmer for professional ECU and TCU work.',
    description:
      'KESS3 Master programmer with OBD, bench, and boot read/write support for cars, agriculture, trucks, bikes, and marine applications.',
    categorySlug: 'ecu-tcu-tuning-tools',
    supplierSlug: 'alientech',
    priceCents: 4074552,
    compareAtPriceCents: 4815380,
    brand: 'Alientech',
    legacyId: 'CT-0003',
    quantityOnHand: 3,
    reorderPoint: 1,
    isFeatured: true,
    imageUrl: '/images/devices/kess3.png',
    attributes: {
      channels: ['OBD', 'Bench', 'Boot'],
      vehicleTypes: ['Cars', 'Agriculture', 'Trucks', 'Bikes', 'Marine'],
    },
  }),
  legacyProduct({
    sku: 'MKON332',
    slug: 'autotuner-tool-device-master-version',
    name: 'AutoTuner Tool Device - Master Version',
    shortDescription: 'AutoTuner Master ECU remapping tool with OBD, bench, and boot support.',
    description:
      'AutoTuner Master professional ECU remapping device for wide car, truck, and agricultural ECU coverage.',
    categorySlug: 'ecu-tcu-tuning-tools',
    supplierSlug: 'autotuner',
    priceCents: 2300149,
    compareAtPriceCents: 2718358,
    brand: 'AutoTuner',
    legacyId: 'CT-0004',
    quantityOnHand: 3,
    reorderPoint: 1,
    isFeatured: true,
    imageUrl: '/images/devices/autotuner.png',
    attributes: {
      channels: ['OBD', 'Bench', 'Boot'],
    },
  }),
  legacyProduct({
    sku: 'MKON331',
    slug: 'autotuner-tool-device-slave-version',
    name: 'AutoTuner Tool Device - Slave Version',
    shortDescription: 'AutoTuner Slave programmer for professional read/write workflows.',
    description:
      'AutoTuner Slave programmer with full OBD, bench, and boot read/write workflows for supported vehicles.',
    categorySlug: 'ecu-tcu-tuning-tools',
    supplierSlug: 'autotuner',
    priceCents: 1361313,
    compareAtPriceCents: 1608824,
    brand: 'AutoTuner',
    legacyId: 'CT-0005',
    quantityOnHand: 4,
    reorderPoint: 1,
    imageUrl: '/images/devices/autotuner.png',
    attributes: {
      channels: ['OBD', 'Bench', 'Boot'],
    },
  }),
  legacyProduct({
    sku: 'MKON525',
    slug: 'autotuner-one-multi-brand-obd-ii-personal-flasher',
    name: 'AutoTuner One Multi-brand OBD-II Personal Flasher',
    shortDescription: 'Compact multi-brand OBD-II personal flasher.',
    description:
      'Compact OBD-II personal flasher for supported ECU and TCU updates across a wide range of vehicles.',
    categorySlug: 'ecu-tcu-tuning-tools',
    supplierSlug: 'autotuner',
    priceCents: 93884,
    compareAtPriceCents: 110954,
    brand: 'AutoTuner',
    legacyId: 'CT-0006',
    quantityOnHand: 10,
    reorderPoint: 2,
    imageUrl: '/images/devices/autotuner.png',
    attributes: {
      channels: ['OBD'],
    },
  }),
  legacyProduct({
    sku: 'MK22621',
    slug: 'xhorse-xdmpg0gl-multi-prog-ecu-programmer-free-mqb48-akl-lic',
    name: 'Xhorse Multi-Prog ECU Programmer with MQB48 AKL License',
    shortDescription: 'Multi-protocol ECU programmer with MQB48 all-keys-lost licence.',
    description:
      'Xhorse Multi-Prog ECU programmer for OBD, bench, and boot workflows with MQB48 AKL coverage.',
    categorySlug: 'ecu-tcu-tuning-tools',
    supplierSlug: 'xhorse',
    priceCents: 322960,
    compareAtPriceCents: 381680,
    brand: 'Xhorse',
    legacyId: 'CT-0007',
    quantityOnHand: 6,
    reorderPoint: 2,
    attributes: {
      channels: ['OBD', 'Bench', 'Boot'],
    },
  }),
  legacyProduct({
    sku: 'MK17318',
    slug: 'cgdi-cg-fc200-ecu-programmer-full-version',
    name: 'CGDI CG FC200 ECU Programmer - Full Version',
    shortDescription: 'Full-version ECU programmer for clone, read, and write workflows.',
    description:
      'CGDI CG FC200 full-version ECU programmer supporting ECU clone, read, and write operations across broad ECU coverage.',
    categorySlug: 'ecu-tcu-tuning-tools',
    supplierSlug: 'cgdi',
    priceCents: 282186,
    compareAtPriceCents: 333493,
    brand: 'CGDI',
    legacyId: 'CT-0008',
    quantityOnHand: 6,
    reorderPoint: 2,
    attributes: {
      channels: ['OBD', 'Bench', 'Boot'],
    },
  }),
  legacyProduct({
    sku: 'MK22671',
    slug: 'microtronik-hexprog-ii-lite-chip-tuning-tool',
    name: 'Microtronik Hexprog II Lite Chip Tuning Tool',
    shortDescription: 'Chip-tuning platform for ECU read, write, and checksum workflows.',
    description:
      'Hexprog II Lite chip-tuning platform for ECU read/write operations and checksum correction on supported ECU families.',
    categorySlug: 'ecu-tcu-tuning-tools',
    supplierSlug: 'microtronik',
    priceCents: 215980,
    compareAtPriceCents: 255249,
    brand: 'Microtronik',
    legacyId: 'CT-0009',
    quantityOnHand: 5,
    reorderPoint: 1,
    attributes: {
      channels: ['Bench', 'Boot'],
    },
  }),
  legacyProduct({
    sku: 'MK26269',
    slug: 'ecu-soft-powerbox-for-pcmflash',
    name: 'ECU-Soft PowerBox for PCMFlash',
    shortDescription: 'Bench power supply and breakout support for PCMFlash workflows.',
    description:
      'Bench power supply designed for PCMFlash ECU programming with stable power and OBD breakout support.',
    categorySlug: 'workshop-equipment',
    supplierSlug: 'ecu-soft',
    priceCents: 322960,
    compareAtPriceCents: 381680,
    brand: 'ECU-Soft',
    legacyId: 'CT-0010',
    quantityOnHand: 5,
    reorderPoint: 1,
    attributes: {
      useCases: ['PCMFlash', 'Bench programming', 'Stable power'],
    },
  }),
  legacyProduct({
    sku: 'MKON553',
    slug: 'xhorse-key-tool-midi-advanced-version-xdkmd0en',
    name: 'Xhorse Key Tool MIDI Advanced Version',
    shortDescription: 'Advanced key-programming device for smart keys and remotes.',
    description:
      'Advanced Xhorse MIDI key programming device for smart keys, proximity keys, and remote generation workflows.',
    categorySlug: 'key-programming',
    supplierSlug: 'xhorse',
    priceCents: 322556,
    compareAtPriceCents: 381203,
    brand: 'Xhorse',
    legacyId: 'CT-0011',
    quantityOnHand: 6,
    reorderPoint: 2,
  }),
  legacyProduct({
    sku: 'MK26449',
    slug: 'xhorse-key-tool-midi-basic-version-xdkmd0en',
    name: 'Xhorse Key Tool MIDI Basic Version',
    shortDescription: 'Basic key-programming device for mainstream OBD and blade-key work.',
    description:
      'Basic Xhorse MIDI key programming device for mainstream OBD and blade-key support workflows.',
    categorySlug: 'key-programming',
    supplierSlug: 'xhorse',
    priceCents: 241816,
    compareAtPriceCents: 285783,
    brand: 'Xhorse',
    legacyId: 'CT-0012',
    quantityOnHand: 6,
    reorderPoint: 2,
  }),
  legacyProduct({
    sku: 'MKON184',
    slug: 'avdi-abrites-vehicle-diagnostics-interface',
    name: 'AVDI Abrites Vehicle Diagnostics Interface',
    shortDescription: 'Advanced diagnostic interface for coding, programming, and diagnostics.',
    description:
      'AVDI diagnostics interface for advanced coding, programming, and diagnostics across supported BMW, Mercedes, VAG, Land Rover, and other platforms.',
    categorySlug: 'diagnostic-tools',
    supplierSlug: 'abrites',
    priceCents: 352063,
    compareAtPriceCents: 416074,
    brand: 'Abrites',
    legacyId: 'CT-0013',
    quantityOnHand: 4,
    reorderPoint: 1,
  }),
  legacyProduct({
    sku: 'MK17353',
    slug: 'autel-maxibas-bt608-battery-and-electrical-system-diagnostic',
    name: 'Autel MaxiBAS BT608 Battery and Electrical System Diagnostic Tool',
    shortDescription: 'Battery and electrical tester for 12V and 24V systems.',
    description:
      'Professional Autel battery and electrical tester for 12V and 24V batteries, starter, alternator, and charging system checks.',
    categorySlug: 'diagnostic-tools',
    supplierSlug: 'autel',
    priceCents: 201850,
    compareAtPriceCents: 238550,
    brand: 'Autel',
    legacyId: 'CT-0014',
    quantityOnHand: 7,
    reorderPoint: 2,
  }),
  legacyProduct({
    sku: 'MKON501',
    slug: 'genuine-scanmatik-3-tool-with-tunerwire-boot-bench-cable',
    name: 'Genuine Scanmatik 3 Tool with TunerWire Boot and Bench Cable',
    shortDescription: 'Scanmatik 3 bundle with TunerWire bench and boot cable.',
    description:
      'Scanmatik 3 with TunerWire bench and boot cable for read, write, checksum, scanning, and reprogramming workflows.',
    categorySlug: 'diagnostic-tools',
    supplierSlug: 'scanmatik',
    priceCents: 193586,
    compareAtPriceCents: 228784,
    brand: 'Scanmatik',
    legacyId: 'CT-0015',
    quantityOnHand: 6,
    reorderPoint: 2,
    attributes: {
      channels: ['OBD', 'Bench', 'Boot'],
    },
  }),
  legacyProduct({
    sku: 'MK25248',
    slug: 'genuine-scanmatik-3-professional-scan-and-reprogramming-tool',
    name: 'Genuine Scanmatik 3 Professional Scan and Reprogramming Tool',
    shortDescription: 'Professional scan and reprogramming interface for diagnostics and ECU work.',
    description:
      'Scanmatik 3 professional scanning and reprogramming interface for OBD diagnostics and ECU data operations.',
    categorySlug: 'diagnostic-tools',
    supplierSlug: 'scanmatik',
    priceCents: 174188,
    compareAtPriceCents: 205859,
    brand: 'Scanmatik',
    legacyId: 'CT-0016',
    quantityOnHand: 6,
    reorderPoint: 2,
  }),
  legacyProduct({
    sku: 'MK25353',
    slug: 'vnci-jlr-doip-jaguar-land-rover-diagnostic-interface',
    name: 'VNCI JLR DoIP Jaguar Land Rover Diagnostic Interface',
    shortDescription: 'DoIP interface for Jaguar and Land Rover diagnostics.',
    description:
      'VNCI DoIP interface for Jaguar and Land Rover diagnostics, SDD, Pathfinder, and supported online programming workflows.',
    categorySlug: 'diagnostic-tools',
    supplierSlug: 'vnci',
    priceCents: 108595,
    compareAtPriceCents: 128340,
    brand: 'VNCI',
    legacyId: 'CT-0017',
    quantityOnHand: 5,
    reorderPoint: 1,
    attributes: {
      protocols: ['DoIP'],
    },
  }),
  legacyProduct({
    sku: 'MKON289',
    slug: 'godiag-gt100-pro-breakout-box-bmw-cas4-fem-bdc-test-platform',
    name: 'GODIAG GT100 Pro Breakout Box with BMW CAS4 FEM BDC Test Platform',
    shortDescription: 'Breakout box and BMW module test platform bundle.',
    description:
      'GODIAG GT100 Pro breakout box bundle for ECU bench testing and BMW CAS4, FEM, and BDC programming support.',
    categorySlug: 'cables-adapters',
    supplierSlug: 'godiag',
    priceCents: 80336,
    compareAtPriceCents: 94943,
    brand: 'GODIAG',
    legacyId: 'CT-0018',
    quantityOnHand: 8,
    reorderPoint: 2,
    attributes: {
      useCases: ['Breakout box', 'BMW CAS4', 'FEM', 'BDC'],
    },
  }),
  legacyProduct({
    sku: 'MK25522',
    slug: 'gromcalctool-srs-full-package',
    name: 'GromCalcTool SRS Full Package',
    shortDescription: 'SRS crash-data and airbag reset package for supported modules.',
    description:
      'Complete SRS airbag reset and crash-data removal solution for supported vehicle modules and service workflows.',
    categorySlug: 'diagnostic-tools',
    supplierSlug: 'gromcalctool',
    priceCents: 413793,
    compareAtPriceCents: 489028,
    brand: 'GromCalcTool',
    legacyId: 'CT-0019',
    quantityOnHand: 3,
    reorderPoint: 1,
    inventoryStatus: 'LOW_STOCK',
    attributes: {
      serviceArea: 'SRS',
    },
  }),
  legacyProduct({
    sku: 'MK24017',
    slug: 'autel-maxiflash-elite-j2534-ecu-programming-device',
    name: 'Autel MaxiFlash Elite J2534 ECU Programming Device',
    shortDescription: 'J2534 pass-thru device for OEM programming workflows.',
    description:
      'Autel MaxiFlash Elite J2534 pass-thru programming device for ECU updates and OEM reprogramming workflows.',
    categorySlug: 'diagnostic-tools',
    supplierSlug: 'autel',
    priceCents: 242220,
    compareAtPriceCents: 286260,
    brand: 'Autel',
    legacyId: 'CT-0020',
    quantityOnHand: 5,
    reorderPoint: 2,
    attributes: {
      protocols: ['J2534'],
    },
  }),
  legacyProduct({
    sku: 'MK19872',
    slug: 'i-o-io-terminal-multi-tool-device',
    name: 'I/O IO Terminal Multi Tool Device',
    shortDescription: 'Multi-function IO Terminal for ECU, TCU, and key programming.',
    description:
      'Multi-function IO Terminal for ECU, TCU, and key programming with K-Line, CAN, and LIN protocol support.',
    categorySlug: 'diagnostic-tools',
    supplierSlug: 'io-terminal',
    priceCents: 140891,
    compareAtPriceCents: 166508,
    brand: 'IO Terminal',
    legacyId: 'CT-0021',
    quantityOnHand: 5,
    reorderPoint: 1,
    attributes: {
      protocols: ['K-Line', 'CAN', 'LIN'],
    },
  }),
  legacyProduct({
    sku: 'MK26801',
    slug: 'probyte-usb-security-dongle',
    name: 'ProBYTE USB Security Dongle',
    shortDescription: 'USB security dongle for tuning and diagnostic software activation.',
    description:
      'USB security dongle for activating supported tuning and diagnostic software licences.',
    categorySlug: 'calibration-software',
    supplierSlug: 'probyte',
    priceCents: 60151,
    compareAtPriceCents: 71088,
    brand: 'ProBYTE',
    legacyId: 'CT-0022',
    quantityOnHand: 12,
    reorderPoint: 3,
    attributes: {
      delivery: 'Hardware dongle',
    },
  }),
  legacyProduct({
    sku: 'MK24914',
    slug: 'mmcflash-usb-dongle-key',
    name: 'MMCFlash USB Dongle Key',
    shortDescription: 'USB dongle for MMCFlash tuning platform activation.',
    description:
      'USB dongle key for MMCFlash chip tuning platform activation and supported bench and OBD workflows.',
    categorySlug: 'calibration-software',
    supplierSlug: 'mmcflash',
    priceCents: 52077,
    compareAtPriceCents: 61546,
    brand: 'MMCFlash',
    legacyId: 'CT-0023',
    quantityOnHand: 12,
    reorderPoint: 3,
    attributes: {
      delivery: 'Hardware dongle',
    },
  }),
  legacyProduct({
    sku: 'MK12384',
    slug: 'autel-charging-station-back-to-back-pedestal',
    name: 'Autel Charging Station Back-to-Back Pedestal',
    shortDescription: 'Dual back-to-back charging pedestal for Autel diagnostic tablets.',
    description:
      'Autel back-to-back charging pedestal for workshop tablet storage and charging setups.',
    categorySlug: 'workshop-equipment',
    supplierSlug: 'autel',
    priceCents: 80336,
    compareAtPriceCents: 94943,
    brand: 'Autel',
    legacyId: 'CT-0024',
    quantityOnHand: 5,
    reorderPoint: 1,
  }),
  legacyProduct({
    sku: 'MKON533',
    slug: 'io-terminal-obd-cable-and-godiag-obd2-jumper-adapter',
    name: 'IO Terminal OBD Cable and GODIAG OBD2 Jumper Adapter',
    shortDescription: 'OBD cable and jumper adapter for direct ECU bench connection.',
    description:
      'IO Terminal OBD cable with GODIAG OBD2 jumper adapter for direct ECU bench connection without vehicle power.',
    categorySlug: 'cables-adapters',
    supplierSlug: 'godiag',
    priceCents: 90130,
    compareAtPriceCents: 106517,
    brand: 'GODIAG',
    legacyId: 'CT-0025',
    quantityOnHand: 10,
    reorderPoint: 3,
    attributes: {
      adapterTypes: ['OBD cable', 'OBD2 jumper'],
    },
  }),
  legacyProduct({
    sku: 'MK20125',
    slug: 'fortin-flashlink-4-firmware-update-usb-flash-link',
    name: 'Fortin Flashlink 4 Firmware Update USB Flash Link',
    shortDescription: 'USB flash link for Fortin bypass module firmware updates.',
    description:
      'Fortin Flashlink 4 USB flash link for updating supported Fortin bypass module firmware through bootloader workflows.',
    categorySlug: 'key-programming',
    supplierSlug: 'fortin',
    priceCents: 18167,
    compareAtPriceCents: 21470,
    brand: 'Fortin',
    legacyId: 'CT-0026',
    quantityOnHand: 15,
    reorderPoint: 5,
  }),
  legacyProduct({
    sku: 'MK20064',
    slug: 'fortin-evo-one-remote-starter-and-security-system-interface',
    name: 'Fortin EVO-ONE Remote Starter and Security System Interface',
    shortDescription: 'Remote starter and security bypass interface.',
    description:
      'Fortin EVO-ONE remote starter and security bypass interface with broad vehicle and harness compatibility.',
    categorySlug: 'key-programming',
    supplierSlug: 'fortin',
    priceCents: 36333,
    compareAtPriceCents: 42939,
    brand: 'Fortin',
    legacyId: 'CT-0027',
    quantityOnHand: 12,
    reorderPoint: 4,
  }),
  legacyProduct({
    sku: 'MK20056',
    slug: 'keydiy-kd-cs01-cloud-key-5-button-universal-garage-remote-22',
    name: 'KEYDIY KD CS01 Cloud Key 5-Button Universal Garage Remote',
    shortDescription: 'Universal 5-button garage remote for the KD Cloud key platform.',
    description:
      'KEYDIY KD CS01 universal cloud garage remote with five buttons and adjustable 225-915MHz frequency support.',
    categorySlug: 'key-programming',
    supplierSlug: 'keydiy',
    priceCents: 2019,
    compareAtPriceCents: 2386,
    brand: 'KEYDIY',
    legacyId: 'CT-0028',
    quantityOnHand: 25,
    reorderPoint: 8,
    attributes: {
      frequency: '225-915MHz',
    },
  }),
  legacyProduct({
    sku: 'MK15798',
    slug: 'keydiy-kd-universal-remote-key-4-buttons-garage-type-b31',
    name: 'KEYDIY KD Universal Remote Key 4 Buttons Garage Type B31',
    shortDescription: 'Universal 4-button KD garage remote key.',
    description:
      'KEYDIY KD Type B31 universal 4-button garage remote key for supported KD remote cloning workflows.',
    categorySlug: 'key-programming',
    supplierSlug: 'keydiy',
    priceCents: 1413,
    compareAtPriceCents: 1670,
    brand: 'KEYDIY',
    legacyId: 'CT-0029',
    quantityOnHand: 25,
    reorderPoint: 8,
  })
);

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
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@caracaltechmotors.com';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'ChangeMeAdmin123!';
  const adminPasswordHash = await bcrypt.hash(
    adminPassword,
    Number.parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10)
  );
  const kess3 = await prisma.product.findUniqueOrThrow({
    where: { sku: 'KESS3-MASTER' },
    select: { id: true, sku: true, name: true },
  });

  const [user, quoteRequest, productInquiry, workshopLead] = await prisma.$transaction([
    prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        name: 'Caracal Admin',
        passwordHash: adminPasswordHash,
        role: 'ADMIN',
        isActive: true,
      },
      create: {
        email: adminEmail,
        name: 'Caracal Admin',
        passwordHash: adminPasswordHash,
        role: 'ADMIN',
        isActive: true,
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
        adminEmail,
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
