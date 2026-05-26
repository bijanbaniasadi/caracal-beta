import { disconnectPrismaClient } from '@caracal/db';

import { ensureMk3VendorSource } from '../src/lib/catalog/mk3/ingestion.js';

function stringify(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, item) => (typeof item === 'bigint' ? item.toString() : item),
    2
  );
}

ensureMk3VendorSource()
  .then((vendor) => {
    console.log(
      stringify({
        ok: true,
        vendor: {
          id: vendor.id,
          slug: vendor.slug,
          name: vendor.name,
          baseUrl: vendor.baseUrl,
          enabled: vendor.enabled,
        },
      })
    );
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrismaClient();
  });
