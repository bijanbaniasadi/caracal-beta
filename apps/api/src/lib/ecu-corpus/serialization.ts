export function toJsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item))
  ) as T;
}

export function sizeBucket(sizeBytes: bigint | number): string {
  const size = typeof sizeBytes === 'bigint' ? Number(sizeBytes) : sizeBytes;

  if (size <= 0) return 'empty';
  if (size < 64 * 1024) return '<64k';
  if (size < 256 * 1024) return '64k-256k';
  if (size < 512 * 1024) return '256k-512k';
  if (size < 1024 * 1024) return '512k-1m';
  if (size < 2 * 1024 * 1024) return '1m-2m';
  if (size < 4 * 1024 * 1024) return '2m-4m';
  if (size < 8 * 1024 * 1024) return '4m-8m';
  if (size < 16 * 1024 * 1024) return '8m-16m';
  return '16m+';
}

export function stableKey(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 160);
}
