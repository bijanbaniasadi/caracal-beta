import { describe, expect, it } from 'vitest';

import { computeDiscountPct, computeSellPriceAed, convertToAed } from '../pricing.js';

const rates = {
  AED: 1,
  USD: 3.6725,
  EUR: 4,
  GBP: 4.65,
};

describe('catalog automatic pricing helpers', () => {
  it('converts vendor costs to AED cents using configured rates', () => {
    expect(convertToAed(10000, 'AED', rates)).toBe(10000);
    expect(convertToAed(10000, 'USD', rates)).toBe(36725);
    expect(convertToAed(12345, 'EUR', rates)).toBe(49380);
    expect(convertToAed(10000, 'gbp', rates)).toBe(46500);
  });

  it('applies margin and rounds sell price up to nearest 10 AED', () => {
    expect(computeSellPriceAed(36725, 1500, 1000)).toBe(43000);
    expect(computeSellPriceAed(10000, 1500, 1000)).toBe(12000);
    expect(computeSellPriceAed(10001, 0, 1000)).toBe(11000);
  });

  it('returns null for compare-at discount when no real RRP exists', () => {
    expect(computeDiscountPct(43000, null)).toBeNull();
  });

  it('returns null when compare-at is not above sell price', () => {
    expect(computeDiscountPct(43000, 43000)).toBeNull();
    expect(computeDiscountPct(43000, 42000)).toBeNull();
  });

  it('derives integer discount percentage when compare-at is above sell price', () => {
    expect(computeDiscountPct(43000, 50000)).toBe(14);
    expect(computeDiscountPct(75000, 100000)).toBe(25);
  });

  it('guards zero and negative values safely', () => {
    expect(convertToAed(-1, 'AED', rates)).toBeNull();
    expect(convertToAed(100, 'JPY', rates)).toBeNull();
    expect(computeSellPriceAed(-1, 1500, 1000)).toBeNull();
    expect(computeSellPriceAed(100, -1, 1000)).toBeNull();
    expect(computeSellPriceAed(100, 1500, 0)).toBeNull();
    expect(computeSellPriceAed(0, 1500, 1000)).toBe(0);
    expect(computeDiscountPct(-1, 1000)).toBeNull();
    expect(computeDiscountPct(1000, 0)).toBeNull();
  });
});
