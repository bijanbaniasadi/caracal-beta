import { getPrismaClient } from '@caracal/db';
import type { Prisma } from '@prisma/client';

import { normalizeFingerprintPart } from './fingerprint.js';

export interface Mk3RawMatchInput {
  id: bigint;
  vendorId: bigint;
  vendorUrl: string;
  vendorSku: string | null;
  rawName: string | null;
  parsedPriceCents: bigint | null;
  parsedCurrency: string | null;
  parsedInStock: boolean | null;
  fingerprint: string;
  rawSpecs: Prisma.JsonValue | null;
  scrapedAt: Date;
}

export interface Mk3MasterCandidate {
  id: bigint;
  name: string;
  sku: string | null;
  mpn: string | null;
  fingerprint: string;
  manufacturerSlug: string;
  manufacturerName: string;
}

export type Mk3MatchDecision =
  | { kind: 'exact'; confidence: 1; productId: bigint }
  | { kind: 'review'; confidence: number; productId: bigint | null; reason: string };

function rawSpecText(rawSpecs: Prisma.JsonValue | null, key: string): string | null {
  if (!rawSpecs || typeof rawSpecs !== 'object' || Array.isArray(rawSpecs)) return null;
  const value = (rawSpecs as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function tokenSet(value: string | null | undefined): Set<string> {
  return new Set(
    normalizeFingerprintPart(value)
      .split(/\s+/)
      .filter((token) => token.length >= 2 && token !== 'unknown')
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = Array.from(a).filter((item) => b.has(item)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

function productCode(candidate: Mk3MasterCandidate): string {
  return normalizeFingerprintPart(candidate.mpn ?? candidate.sku ?? candidate.name);
}

export function decideMk3Match(
  raw: Mk3RawMatchInput,
  candidates: Mk3MasterCandidate[]
): Mk3MatchDecision {
  const exact = candidates.find((candidate) => candidate.fingerprint === raw.fingerprint);
  if (exact) {
    return { kind: 'exact', confidence: 1, productId: exact.id };
  }

  const rawManufacturer = normalizeFingerprintPart(
    rawSpecText(raw.rawSpecs, 'manufacturerSlug') ?? rawSpecText(raw.rawSpecs, 'manufacturerName')
  );
  const rawMpn = normalizeFingerprintPart(rawSpecText(raw.rawSpecs, 'mpnOrSku') ?? raw.vendorSku ?? raw.rawName);
  const rawNameTokens = tokenSet(raw.rawName);
  let best: Mk3MatchDecision = {
    kind: 'review',
    confidence: 0,
    productId: null,
    reason: 'no candidate above threshold',
  };

  for (const candidate of candidates) {
    const sameManufacturer =
      normalizeFingerprintPart(candidate.manufacturerSlug) === rawManufacturer ||
      normalizeFingerprintPart(candidate.manufacturerName) === rawManufacturer;
    const sameProductCode = productCode(candidate) === rawMpn;

    if (sameManufacturer && sameProductCode && best.confidence < 0.8) {
      best = {
        kind: 'review',
        confidence: 0.8,
        productId: candidate.id,
        reason: 'same manufacturer and product code; variant differs',
      };
      continue;
    }

    const nameSimilarity = jaccard(rawNameTokens, tokenSet(candidate.name));
    const confidence = sameManufacturer && nameSimilarity >= 0.7 ? 0.6 + nameSimilarity * 0.19 : 0;

    if (confidence > best.confidence) {
      best = {
        kind: 'review',
        confidence: Math.min(0.79, Number(confidence.toFixed(2))),
        productId: candidate.id,
        reason: 'same manufacturer and fuzzy name candidate',
      };
    }
  }

  return best;
}

async function findCandidates(raw: Mk3RawMatchInput): Promise<Mk3MasterCandidate[]> {
  const prisma = getPrismaClient();
  const manufacturerSlug = rawSpecText(raw.rawSpecs, 'manufacturerSlug');
  const nameToken = raw.rawName?.split(/\s+/).find((token) => token.length >= 4);

  return prisma.masterProduct.findMany({
    where: {
      status: { not: 'ARCHIVED' },
      OR: [
        { fingerprint: raw.fingerprint },
        ...(manufacturerSlug ? [{ manufacturerSlug: { equals: manufacturerSlug, mode: 'insensitive' as const } }] : []),
        ...(nameToken ? [{ name: { contains: nameToken, mode: 'insensitive' as const } }] : []),
      ],
    },
    select: {
      id: true,
      name: true,
      sku: true,
      mpn: true,
      fingerprint: true,
      manufacturerSlug: true,
      manufacturerName: true,
    },
    take: 50,
  });
}

async function recordPriceHistoryIfChanged(
  tx: Prisma.TransactionClient,
  input: {
    offerId: bigint;
    priceCents: bigint | null;
    currency: string;
    inStock: boolean | null;
    observedAt: Date;
  }
): Promise<void> {
  if (input.priceCents === null) return;

  const existing = await tx.priceHistory.findFirst({
    where: {
      offerId: input.offerId,
      priceCents: input.priceCents,
      currency: input.currency,
      observedAt: input.observedAt,
    },
    select: { id: true },
  });

  if (!existing) {
    await tx.priceHistory.create({
      data: {
        offerId: input.offerId,
        priceCents: input.priceCents,
        currency: input.currency,
        inStock: input.inStock,
        observedAt: input.observedAt,
      },
    });
  }
}

async function recordReviewQueueCandidate(
  tx: Prisma.TransactionClient,
  raw: Mk3RawMatchInput,
  decision: Extract<Mk3MatchDecision, { kind: 'review' }>
): Promise<void> {
  await tx.vendorRawProduct.update({
    where: { id: raw.id },
    data: {
      matchStatus: 'UNMATCHED',
      matchConfidence: decision.confidence > 0 ? decision.confidence : null,
    },
  });

  const existing = await tx.reviewQueue.findUnique({ where: { rawProductId: raw.id } });
  const data = {
    suggestedProductId: decision.productId,
    suggestedConfidence: decision.confidence > 0 ? decision.confidence : null,
    priority: decision.confidence >= 0.8 ? 40 : decision.confidence >= 0.6 ? 80 : 120,
    notes: `MK3 staged ingestion: ${decision.reason}`,
  };

  if (!existing) {
    await tx.reviewQueue.create({
      data: {
        rawProductId: raw.id,
        ...data,
      },
    });
  } else if (!existing.resolvedAt) {
    await tx.reviewQueue.update({
      where: { id: existing.id },
      data,
    });
  }
}

export async function processMk3RawProductFingerprint(rawProductId: string) {
  const prisma = getPrismaClient();
  const raw = await prisma.vendorRawProduct.findUnique({
    where: { id: BigInt(rawProductId) },
    include: { vendor: true },
  });

  if (!raw) return { action: 'missing-raw-product' as const };
  if (raw.vendor.slug !== 'mk3') return { action: 'skipped-non-mk3' as const };

  const rawInput: Mk3RawMatchInput = {
    id: raw.id,
    vendorId: raw.vendorId,
    vendorUrl: raw.vendorUrl,
    vendorSku: raw.vendorSku,
    rawName: raw.rawName,
    parsedPriceCents: raw.parsedPriceCents,
    parsedCurrency: raw.parsedCurrency,
    parsedInStock: raw.parsedInStock,
    fingerprint: raw.fingerprint,
    rawSpecs: raw.rawSpecs,
    scrapedAt: raw.scrapedAt,
  };
  const candidates = await findCandidates(rawInput);
  const decision = decideMk3Match(rawInput, candidates);

  if (decision.kind === 'review') {
    await prisma.$transaction((tx) => recordReviewQueueCandidate(tx, rawInput, decision));
    return {
      action: 'queued-review' as const,
      rawProductId,
      suggestedProductId: decision.productId?.toString() ?? null,
      confidence: decision.confidence,
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.vendorRawProduct.update({
      where: { id: rawInput.id },
      data: {
        matchedProductId: decision.productId,
        matchStatus: 'AUTO_MATCHED',
        matchConfidence: 1,
      },
    });

    const offer = await tx.vendorOffer.upsert({
      where: {
        vendorId_vendorUrl: {
          vendorId: rawInput.vendorId,
          vendorUrl: rawInput.vendorUrl,
        },
      },
      create: {
        productId: decision.productId,
        vendorId: rawInput.vendorId,
        vendorSku: rawInput.vendorSku,
        vendorUrl: rawInput.vendorUrl,
        priceCents: rawInput.parsedPriceCents,
        currency: rawInput.parsedCurrency ?? 'USD',
        inStock: rawInput.parsedInStock,
        lastSeenAt: rawInput.scrapedAt,
        status: 'ACTIVE',
        confidence: 1,
        notes: 'MK3 exact deterministic fingerprint match',
      },
      update: {
        productId: decision.productId,
        vendorSku: rawInput.vendorSku,
        priceCents: rawInput.parsedPriceCents,
        currency: rawInput.parsedCurrency ?? 'USD',
        inStock: rawInput.parsedInStock,
        lastSeenAt: rawInput.scrapedAt,
        status: 'ACTIVE',
        confidence: 1,
        notes: 'MK3 exact deterministic fingerprint match',
      },
    });

    await recordPriceHistoryIfChanged(tx, {
      offerId: offer.id,
      priceCents: rawInput.parsedPriceCents,
      currency: rawInput.parsedCurrency ?? offer.currency,
      inStock: rawInput.parsedInStock,
      observedAt: rawInput.scrapedAt,
    });

    return offer;
  });

  return {
    action: 'exact-match-offer-upserted' as const,
    rawProductId,
    masterProductId: decision.productId.toString(),
    offerId: result.id.toString(),
    confidence: decision.confidence,
  };
}
