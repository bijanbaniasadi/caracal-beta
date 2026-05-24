import { z } from 'zod';

function firstQueryValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

const optionalQueryText = (max = 200) =>
  z.preprocess(firstQueryValue, z.string().trim().min(1).max(max)).optional();

const optionalQueryBoolean = z
  .preprocess(firstQueryValue, z.enum(['true', 'false', '1', '0']))
  .transform((value) => value === 'true' || value === '1')
  .optional();

const queryBooleanWithDefault = (defaultValue: boolean) =>
  z
    .preprocess(
      (value) => {
        const firstValue = firstQueryValue(value);

        if (firstValue === undefined) {
          return defaultValue ? 'true' : 'false';
        }

        return firstValue;
      },
      z.enum(['true', 'false', '1', '0'])
    )
    .transform((value) => value === 'true' || value === '1');

const queryLimit = z
  .preprocess(firstQueryValue, z.coerce.number().int().min(1).max(100))
  .default(24);

const optionalPriceCents = z
  .preprocess(firstQueryValue, z.coerce.number().int().nonnegative())
  .optional();

export const productListQuerySchema = z.object({
  q: optionalQueryText(200),
  search: optionalQueryText(200),
  category: optionalQueryText(120),
  categorySlug: optionalQueryText(120),
  supplier: optionalQueryText(120),
  sku: optionalQueryText(120).transform((value) => value?.toUpperCase()),
  status: z.preprocess(firstQueryValue, z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED'])).default('ACTIVE'),
  featured: optionalQueryBoolean,
  b2b: optionalQueryBoolean,
  tradeOnly: optionalQueryBoolean,
  inStock: optionalQueryBoolean,
  minPriceCents: optionalPriceCents,
  maxPriceCents: optionalPriceCents,
  cursor: optionalQueryText(120),
  limit: queryLimit,
  sort: z
    .preprocess(firstQueryValue, z.enum(['featured', 'newest', 'name', 'price_asc', 'price_desc']))
    .default('featured'),
});

export const categoryListQuerySchema = z.object({
  includeInactive: queryBooleanWithDefault(false),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;
export type CategoryListQuery = z.infer<typeof categoryListQuerySchema>;
