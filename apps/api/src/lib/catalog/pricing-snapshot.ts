import { getPrismaClient } from '@caracal/db';
import type { Prisma } from '@prisma/client';

import {
  AED_CURRENCY,
  DEFAULT_MARGIN_BPS,
  DEFAULT_ROUNDING_INCREMENT_CENTS,
  computeSellPriceAed,
  convertToAed,
  type CurrencyRates,
} from './pricing.js';
import { enqueueCatalogProjectionJob } from './queues.js';

export interface PricingSnapshotOffer {
  id?: bigint;
  vendorId: bigint;
  priceCents: bigint | number;
  currency: string;
}

export interface PricingSnapshotPolicy {
  scope: 'global' | 'vendor' | string;
  vendorId: bigint | null;
  marginBps: number;
  roundingIncrementCents: bigint | number;
}

export interface MasterPricingSnapshot {
  sellPriceCents: number;
  currency: typeof AED_CURRENCY;
  pricedAt: Date;
  sourceOfferId?: bigint;
  sourceCostCents: number;
  sourceCurrency: string;
  sourceCostAedCents: number;
  fxRateToAed: number;
  marginBps: number;
  roundingIncrementCents: number;
}

interface ComputePricingSnapshotInput {
  offers: PricingSnapshotOffer[];
  rates: CurrencyRates;
  policies: PricingSnapshotPolicy[];
  now?: Date;
}

function normalizeCurrency(currency: string): string {
  return currency.trim().toUpperCase();
}

function toFiniteNumber(value: bigint | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;

  const numeric = typeof value === 'bigint' ? Number(value) : value;
  return Number.isFinite(numeric) ? numeric : null;
}

function selectPolicyForVendor(
  vendorId: bigint,
  policies: PricingSnapshotPolicy[]
): { marginBps: number; roundingIncrementCents: number } {
  const vendorPolicy = policies.find(
    (policy) => policy.scope === 'vendor' && policy.vendorId === vendorId
  );
  const globalPolicy = policies.find(
    (policy) => policy.scope === 'global' && policy.vendorId === null
  );
  const policy = vendorPolicy ?? globalPolicy;

  return {
    marginBps: policy?.marginBps ?? DEFAULT_MARGIN_BPS,
    roundingIncrementCents:
      toFiniteNumber(policy?.roundingIncrementCents) ?? DEFAULT_ROUNDING_INCREMENT_CENTS,
  };
}

export function projectedSellPriceCents(
  pricedSellCents: number | null | undefined,
  liveComputedSellCents: number | null | undefined
): number | null {
  return pricedSellCents ?? liveComputedSellCents ?? null;
}

export function computePricingSnapshot(
  input: ComputePricingSnapshotInput
): MasterPricingSnapshot | null {
  const candidates = input.offers
    .map((offer) => {
      const currency = normalizeCurrency(offer.currency);
      const sourceCostCents = toFiniteNumber(offer.priceCents);
      const fxRateToAed = input.rates[currency];
      const sourceCostAedCents = convertToAed(sourceCostCents, currency, input.rates);

      if (
        sourceCostCents === null ||
        sourceCostAedCents === null ||
        !Number.isFinite(fxRateToAed) ||
        fxRateToAed <= 0
      ) {
        return null;
      }

      return {
        ...offer,
        currency,
        sourceCostCents,
        sourceCostAedCents,
        fxRateToAed,
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
    .sort((left, right) => {
      const costDelta = left.sourceCostAedCents - right.sourceCostAedCents;
      if (costDelta !== 0) return costDelta;
      if (left.id === undefined || right.id === undefined) return 0;
      return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    });
  const selected = candidates[0];
  if (!selected) return null;

  const policy = selectPolicyForVendor(selected.vendorId, input.policies);
  const sellPriceCents = computeSellPriceAed(
    selected.sourceCostAedCents,
    policy.marginBps,
    policy.roundingIncrementCents
  );

  if (sellPriceCents === null) return null;

  return {
    sellPriceCents,
    currency: AED_CURRENCY,
    pricedAt: input.now ?? new Date(),
    sourceOfferId: selected.id,
    sourceCostCents: selected.sourceCostCents,
    sourceCurrency: selected.currency,
    sourceCostAedCents: selected.sourceCostAedCents,
    fxRateToAed: selected.fxRateToAed,
    marginBps: policy.marginBps,
    roundingIncrementCents: policy.roundingIncrementCents,
  };
}

export function pricingSnapshotUpdateData(
  snapshot: MasterPricingSnapshot | null
): Prisma.MasterProductUncheckedUpdateInput {
  if (!snapshot) {
    return {
      pricedSellCents: null,
      pricedCurrency: AED_CURRENCY,
      pricedAt: null,
      pricedSourceCostCents: null,
      pricedSourceCurrency: null,
      pricedFxRateToAed: null,
      pricedMarginBps: null,
    };
  }

  return {
    pricedSellCents: BigInt(snapshot.sellPriceCents),
    pricedCurrency: snapshot.currency,
    pricedAt: snapshot.pricedAt,
    pricedSourceCostCents: BigInt(snapshot.sourceCostCents),
    pricedSourceCurrency: snapshot.sourceCurrency,
    pricedFxRateToAed: snapshot.fxRateToAed.toFixed(6),
    pricedMarginBps: snapshot.marginBps,
  };
}

export async function buildMasterPricingSnapshotUpdate(
  tx: Prisma.TransactionClient,
  masterProductId: bigint,
  now = new Date()
): Promise<{
  snapshot: MasterPricingSnapshot | null;
  data: Prisma.MasterProductUncheckedUpdateInput;
}> {
  const offerRows = await tx.vendorOffer.findMany({
    where: {
      productId: masterProductId,
      status: 'ACTIVE',
      inStock: true,
      priceCents: { not: null },
    },
    select: {
      id: true,
      vendorId: true,
      priceCents: true,
      currency: true,
    },
  });
  const offers: PricingSnapshotOffer[] = offerRows
    .filter((offer) => offer.priceCents !== null)
    .map((offer) => ({
      id: offer.id,
      vendorId: offer.vendorId,
      priceCents: offer.priceCents as bigint,
      currency: offer.currency,
    }));
  const vendorIds = [...new Set(offers.map((offer) => offer.vendorId))];
  const [rateRows, policies] = await Promise.all([
    tx.currencyRate.findMany({
      select: {
        currency: true,
        rateToAed: true,
      },
    }),
    tx.catalogPricingPolicy.findMany({
      where: {
        enabled: true,
        OR: [
          { scope: 'global', vendorId: null },
          ...(vendorIds.length > 0 ? [{ scope: 'vendor', vendorId: { in: vendorIds } }] : []),
        ],
      },
      select: {
        scope: true,
        vendorId: true,
        marginBps: true,
        roundingIncrementCents: true,
      },
    }),
  ]);
  const rates = rateRows.reduce<Record<string, number>>((accumulator, row) => {
    accumulator[normalizeCurrency(row.currency)] = row.rateToAed.toNumber();
    return accumulator;
  }, {});
  const snapshot = computePricingSnapshot({
    offers,
    rates,
    policies,
    now,
  });

  return {
    snapshot,
    data: pricingSnapshotUpdateData(snapshot),
  };
}

export async function repriceMasterInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    masterProductId: bigint;
    updatedById?: string;
    now?: Date;
  }
): Promise<MasterPricingSnapshot | null> {
  const { snapshot, data } = await buildMasterPricingSnapshotUpdate(
    tx,
    input.masterProductId,
    input.now
  );

  await tx.masterProduct.update({
    where: { id: input.masterProductId },
    data: {
      ...data,
      ...(input.updatedById ? { updatedById: input.updatedById } : {}),
    },
  });

  return snapshot;
}

/**
 * Explicit live-price recalculation entrypoint. Vendor-cost changes, FX changes,
 * and margin-policy edits intentionally do not call this automatically.
 */
export async function repriceMaster(masterProductId: bigint | string): Promise<{
  masterProductId: string;
  snapshot: MasterPricingSnapshot | null;
}> {
  const id = typeof masterProductId === 'bigint' ? masterProductId : BigInt(masterProductId);
  const prisma = getPrismaClient();
  const snapshot = await prisma.$transaction((tx) =>
    repriceMasterInTransaction(tx, { masterProductId: id })
  );

  await enqueueCatalogProjectionJob({
    type: 'project-product',
    masterProductId: id.toString(),
    reason: 'admin.reprice',
  });

  return {
    masterProductId: id.toString(),
    snapshot,
  };
}
