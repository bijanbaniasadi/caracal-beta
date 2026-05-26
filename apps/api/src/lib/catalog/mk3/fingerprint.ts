import { createHash } from 'node:crypto';

const STOP_WORDS = new Set(['kit', 'full', 'pcs', 'pc', 'set', 'tool', 'tools', 'new']);

export interface Mk3FingerprintParts {
  manufacturerSlug: string;
  manufacturerName: string;
  mpnOrSku: string;
  variantKey: string;
}

function stripDiacritics(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeFingerprintPart(value: string | null | undefined): string {
  const normalized = stripDiacritics(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token && !STOP_WORDS.has(token))
    .join(' ');

  return normalized || 'unknown';
}

export function slugifyCatalogValue(value: string | null | undefined): string {
  return normalizeFingerprintPart(value).replace(/\s+/g, '-');
}

export function inferMk3Manufacturer(name: string, explicitBrand?: string | null): {
  slug: string;
  name: string;
} {
  const source = `${explicitBrand ?? ''} ${name}`.toLowerCase();
  const known = [
    ['alientech', 'Alientech'],
    ['kess', 'Alientech'],
    ['ktag', 'Alientech'],
    ['autotuner', 'Autotuner'],
    ['magicmotorsport', 'Magicmotorsport'],
    ['magic motorsport', 'Magicmotorsport'],
    ['flex', 'Magicmotorsport'],
    ['dimsport', 'Dimsport'],
    ['new genius', 'Dimsport'],
    ['trasdata', 'Dimsport'],
    ['cmd', 'CMD'],
    ['autel', 'Autel'],
    ['launch', 'Launch'],
    ['obdstar', 'OBDSTAR'],
  ].find(([needle]) => source.includes(needle));

  const nameValue = explicitBrand?.trim() || known?.[1] || 'Unknown';

  return {
    slug: slugifyCatalogValue(nameValue),
    name: nameValue,
  };
}

export function inferMk3VariantKey(name: string): string {
  const normalized = normalizeFingerprintPart(name);
  const axes: string[] = [];

  if (/\bmaster\b/.test(normalized)) axes.push('master');
  if (/\bslave\b/.test(normalized)) axes.push('slave');
  if (/\bobd\b/.test(normalized)) axes.push('obd');
  if (/\bbench\b/.test(normalized)) axes.push('bench');
  if (/\bboot\b/.test(normalized)) axes.push('boot');
  if (/\beu\b|\beurope\b/.test(normalized)) axes.push('eu');
  if (/\bus\b|\busa\b/.test(normalized)) axes.push('us');

  return axes.length > 0 ? axes.join('-') : 'standard';
}

export function inferMk3MpnOrSku(name: string, sku?: string | null, mpn?: string | null): string {
  if (mpn?.trim()) return mpn.trim();
  if (sku?.trim()) return sku.trim();

  const patterns = [
    /\bKESS\s*V?\s*3\b/i,
    /\bKTAG\b/i,
    /\bKTM\s*200\b/i,
    /\bFLEX\b/i,
    /\bAUTOTUNER\b/i,
    /\bNEW\s*GENIUS\b/i,
    /\bTRASDATA\b/i,
    /\bCMD\s*FLASH\b/i,
    /\bMAXI(?:SYS|IM|COM)[A-Z0-9-]*\b/i,
  ];
  const match = patterns.map((pattern) => name.match(pattern)?.[0]).find(Boolean);

  return match ?? name.split(/\s+/).slice(0, 5).join(' ');
}

export function buildMk3Fingerprint(parts: Mk3FingerprintParts): string {
  const input = [
    normalizeFingerprintPart(parts.manufacturerSlug),
    normalizeFingerprintPart(parts.mpnOrSku),
    normalizeFingerprintPart(parts.variantKey),
  ].join('|');

  return createHash('sha1').update(input).digest('hex');
}
