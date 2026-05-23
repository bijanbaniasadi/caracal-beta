import { randomBytes } from 'node:crypto';

export function createReferenceCode(prefix: string): string {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const suffix = randomBytes(4).toString('hex').toUpperCase();

  return `${prefix}-${date}-${suffix}`;
}
