import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { disconnectPrismaClient, getPrismaClient } from '@caracal/db';
import type { UserRole } from '@prisma/client';

import type { AuthenticatedUser } from '../src/lib/auth.js';
import {
  buildMk3Fingerprint,
  inferMk3Manufacturer,
  inferMk3MpnOrSku,
  inferMk3VariantKey,
} from '../src/lib/catalog/mk3/fingerprint.js';

function stringify(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, item) => (typeof item === 'bigint' ? item.toString() : item),
    2
  );
}

function mk3Fingerprint(input: { name: string; sku: string; brand: string }): string {
  const manufacturer = inferMk3Manufacturer(input.name, input.brand);

  return buildMk3Fingerprint({
    manufacturerSlug: manufacturer.slug,
    manufacturerName: manufacturer.name,
    mpnOrSku: inferMk3MpnOrSku(input.name, input.sku),
    variantKey: inferMk3VariantKey(input.name),
  });
}

export async function ensureStageUser(input: {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}): Promise<AuthenticatedUser> {
  const prisma = getPrismaClient();
  const user = await prisma.user.upsert({
    where: { email: input.email },
    create: {
      id: input.id,
      email: input.email,
      name: input.name,
      role: input.role,
      isActive: true,
    },
    update: {
      name: input.name,
      role: input.role,
      isActive: true,
    },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
  };
}

export async function seedMk3Stage1References(creatorId: string) {
  const prisma = getPrismaClient();
  const existingCategory = await prisma.catalogCategory.findFirst({
    where: {
      parentId: null,
      slug: 'stage1-validation-tools',
    },
  });
  const category = existingCategory
    ? await prisma.catalogCategory.update({
        where: { id: existingCategory.id },
        data: {
          name: 'Stage 1 Validation Tools',
          description: 'Local-only Stage 1 catalog validation category.',
        },
      })
    : await prisma.catalogCategory.create({
        data: {
          slug: 'stage1-validation-tools',
          name: 'Stage 1 Validation Tools',
          description: 'Local-only Stage 1 catalog validation category.',
        },
      });
  const [alientech, autotuner] = await Promise.all([
    prisma.manufacturer.upsert({
      where: { slug: 'alientech' },
      create: { slug: 'alientech', name: 'Alientech' },
      update: { name: 'Alientech' },
    }),
    prisma.manufacturer.upsert({
      where: { slug: 'autotuner' },
      create: { slug: 'autotuner', name: 'Autotuner' },
      update: { name: 'Autotuner' },
    }),
  ]);

  const exactFingerprint = mk3Fingerprint({
    name: 'Alientech KESS3 Master Kit Stage 1',
    sku: 'STAGE1-KESS3-MASTER',
    brand: 'Alientech',
  });
  const fuzzyFingerprint = mk3Fingerprint({
    name: 'Alientech KESS3 Master Variant Reference Stage 1',
    sku: 'STAGE1-KESS3',
    brand: 'Alientech',
  });

  const [exactMaster, fuzzyMaster] = await Promise.all([
    prisma.masterProduct.upsert({
      where: { slug: 'stage1-mk3-kess3-master-reference' },
      create: {
        slug: 'stage1-mk3-kess3-master-reference',
        sku: 'STAGE1-KESS3-MASTER',
        mpn: 'STAGE1-KESS3-MASTER',
        name: 'Alientech KESS3 Master Kit Stage 1 Reference',
        shortDescription: 'Reference master used for exact MK3 fingerprint validation.',
        longDescriptionMd: 'Reference-only master for Stage 1 exact-match validation.',
        manufacturerId: alientech.id,
        manufacturerSlug: alientech.slug,
        manufacturerName: alientech.name,
        categoryId: category.id,
        status: 'DRAFT',
        fingerprint: exactFingerprint,
        featured: false,
        createdById: creatorId,
        updatedById: creatorId,
      },
      update: {
        manufacturerId: alientech.id,
        manufacturerSlug: alientech.slug,
        manufacturerName: alientech.name,
        categoryId: category.id,
        fingerprint: exactFingerprint,
        updatedById: creatorId,
      },
    }),
    prisma.masterProduct.upsert({
      where: { slug: 'stage1-mk3-kess3-variant-reference' },
      create: {
        slug: 'stage1-mk3-kess3-variant-reference',
        sku: 'STAGE1-KESS3',
        mpn: 'STAGE1-KESS3',
        name: 'Alientech KESS3 Master Variant Stage 1 Reference',
        shortDescription: 'Reference master used for fuzzy MK3 review validation.',
        longDescriptionMd: 'Reference-only master for Stage 1 fuzzy-match validation.',
        manufacturerId: alientech.id,
        manufacturerSlug: alientech.slug,
        manufacturerName: alientech.name,
        categoryId: category.id,
        status: 'DRAFT',
        fingerprint: fuzzyFingerprint,
        featured: false,
        createdById: creatorId,
        updatedById: creatorId,
      },
      update: {
        manufacturerId: alientech.id,
        manufacturerSlug: alientech.slug,
        manufacturerName: alientech.name,
        categoryId: category.id,
        fingerprint: fuzzyFingerprint,
        updatedById: creatorId,
      },
    }),
  ]);

  return { category, alientech, autotuner, exactMaster, fuzzyMaster };
}

async function main(): Promise<void> {
  const creator = await ensureStageUser({
    id: 'stage1-catalog-creator',
    email: 'stage1.catalog.creator@caracal.local',
    name: 'Stage 1 Catalog Creator',
    role: 'ADMIN',
  });
  const references = await seedMk3Stage1References(creator.id);

  console.log(
    stringify({
      ok: true,
      user: creator.email,
      category: references.category.slug,
      manufacturers: [references.alientech.slug, references.autotuner.slug],
      masterProducts: [references.exactMaster.slug, references.fuzzyMaster.slug],
    })
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await disconnectPrismaClient();
    });
}
