export interface DatabaseStatus {
  configured: boolean;
}

export function getDatabaseStatus(databaseUrl = process.env.DATABASE_URL): DatabaseStatus {
  return {
    configured: Boolean(databaseUrl),
  };
}
