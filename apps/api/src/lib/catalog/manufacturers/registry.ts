/**
 * Brand → manufacturer fetcher registry (M2a).
 *
 * Add new brands here as fetchers are written. Lookup is by normalised brand
 * slug so the orchestrator can route a master_product.manufacturerSlug.
 */
import type { ManufacturerFetcher } from './types.js';
import { AlientechFetcher } from './alientech.js';
import { AutotunerFetcher } from './autotuner.js';

const fetchers = new Map<string, ManufacturerFetcher>([
  ['autotuner', new AutotunerFetcher()],
  ['alientech', new AlientechFetcher()],
]);

export function getManufacturerFetcher(brandSlug: string): ManufacturerFetcher | null {
  return fetchers.get(brandSlug.toLowerCase()) ?? null;
}

export function listManufacturerFetchers(): ManufacturerFetcher[] {
  return Array.from(fetchers.values());
}
