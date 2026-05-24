import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface DatabaseIdentity {
  current_database: string;
  current_user: string;
}

interface MigrationRow {
  migration_name: string;
  finished_at: Date | null;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const [databaseIdentity] = await prisma.$queryRaw<DatabaseIdentity[]>`
    SELECT current_database() AS current_database, current_user AS current_user
  `;

  const migrations = await prisma.$queryRaw<MigrationRow[]>`
    SELECT migration_name, finished_at
    FROM "_prisma_migrations"
    ORDER BY finished_at DESC NULLS LAST
  `;

  const probeRequestId = `health-${Date.now()}`;
  const probe = await prisma.auditLog.create({
    data: {
      actorType: 'SYSTEM',
      action: 'health_diagnostics.probe',
      entityType: 'DiagnosticProbe',
      entityId: probeRequestId,
      requestId: probeRequestId,
      metadata: { probe: true },
    },
    select: {
      id: true,
      action: true,
      entityType: true,
      requestId: true,
      createdAt: true,
    },
  });

  const selectedProbe = await prisma.auditLog.findUniqueOrThrow({
    where: { id: probe.id },
    select: {
      id: true,
      action: true,
      entityType: true,
      requestId: true,
    },
  });

  await prisma.auditLog.delete({ where: { id: probe.id } });

  const [
    suppliers,
    categories,
    products,
    productImages,
    inventoryItems,
    carts,
    cartItems,
    quoteRequests,
    productInquiries,
    workshopLeads,
    binUploads,
    binAnalysisJobs,
    binAnalysisResults,
    auditLogs,
  ] = await prisma.$transaction([
    prisma.supplier.count(),
    prisma.category.count(),
    prisma.product.count(),
    prisma.productImage.count(),
    prisma.inventoryItem.count(),
    prisma.cart.count(),
    prisma.cartItem.count(),
    prisma.quoteRequest.count(),
    prisma.productInquiry.count(),
    prisma.workshopConsultationLead.count(),
    prisma.binUpload.count(),
    prisma.binAnalysisJob.count(),
    prisma.binAnalysisResult.count(),
    prisma.auditLog.count(),
  ]);

  console.log(
    JSON.stringify(
      {
        status: 'ok',
        database: {
          configured: true,
          name: databaseIdentity.current_database,
          user: databaseIdentity.current_user,
        },
        migrations: migrations.map((migration) => ({
          name: migration.migration_name,
          applied: Boolean(migration.finished_at),
        })),
        prisma: {
          connected: true,
          insertSelectDeleteProbe: {
            insertedId: probe.id,
            selectedId: selectedProbe.id,
            requestId: selectedProbe.requestId,
            action: selectedProbe.action,
            entityType: selectedProbe.entityType,
            cleanedUp: true,
          },
        },
        counts: {
          suppliers,
          categories,
          products,
          productImages,
          inventoryItems,
          carts,
          cartItems,
          quoteRequests,
          productInquiries,
          workshopLeads,
          binUploads,
          binAnalysisJobs,
          binAnalysisResults,
          auditLogs,
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
