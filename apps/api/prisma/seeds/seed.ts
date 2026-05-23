import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
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
        productSku: 'SEED-ECU-01',
        productName: 'Seed ECU Service',
        customerName: 'Seed Product Customer',
        customerEmail: 'seed.product@caracaltechmotors.com',
        quantity: 1,
        message: 'Seed product inquiry for local backend validation.',
        source: 'seed',
        metadata: { seeded: true },
      },
      create: {
        referenceCode: 'PI-SEED-LOCAL',
        productSku: 'SEED-ECU-01',
        productName: 'Seed ECU Service',
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
