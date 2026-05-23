import { PrismaClient } from '@prisma/client';

export interface DatabaseStatus {
  configured: boolean;
}

let prismaClient: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient();
  }

  return prismaClient;
}

export async function disconnectPrismaClient(): Promise<void> {
  if (prismaClient) {
    await prismaClient.$disconnect();
    prismaClient = null;
  }
}

export function getDatabaseStatus(databaseUrl = process.env.DATABASE_URL): DatabaseStatus {
  return {
    configured: Boolean(databaseUrl),
  };
}
