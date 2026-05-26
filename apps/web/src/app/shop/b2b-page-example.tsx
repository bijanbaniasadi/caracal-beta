/**
 * B2B Shop Page Example Implementation
 * Shows how to integrate B2BShopLayout with API data fetching
 *
 * INTEGRATION GUIDE:
 * 1. Replace the existing shop page (apps/web/src/app/shop/page.tsx) with similar structure
 * 2. Update the API calls to fetch from your backend
 * 3. Adjust type conversions if your backend schema differs from B2BProduct/B2BCategoryTree
 *
 * Location: apps/web/src/app/shop/b2b-page-example.tsx
 */

'use client';

import { useEffect, useState } from 'react';
import type { B2BProduct, B2BCategoryTree } from '@/lib/api/b2b-catalog-types';
import { B2BShopLayout } from '@/components/catalog/b2b-shop-layout';

interface ShopPageProps {
  searchParams?: {
    category?: string;
    search?: string;
  };
}

export default function B2BShopPageExample({ searchParams }: ShopPageProps) {
  const [categories, setCategories] = useState<B2BCategoryTree[]>([]);
  const [products, setProducts] = useState<B2BProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch categories and products from your API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Fetch categories
        // Replace with your actual API endpoint
        const categoriesResponse = await fetch('/api/catalog/categories');
        if (!categoriesResponse.ok) {
          throw new Error('Failed to fetch categories');
        }
        const categoriesData = await categoriesResponse.json();
        setCategories(categoriesData);

        // Fetch products
        // Replace with your actual API endpoint
        // Add query parameters for filtering if needed
        const productsResponse = await fetch('/api/catalog/products');
        if (!productsResponse.ok) {
          throw new Error('Failed to fetch products');
        }
        const productsData = await productsResponse.json();
        setProducts(productsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const initialCategory = searchParams?.category || null;

  const handleCategoryChange = (slug: string | null) => {
    // Optional: Update URL with selected category
    const url = new URL(window.location.href);
    if (slug) {
      url.searchParams.set('category', slug);
    } else {
      url.searchParams.delete('category');
    }
    window.history.pushState({}, '', url);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Error loading catalog</h1>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <B2BShopLayout
      categories={categories}
      products={products}
      isLoading={isLoading}
      onCategoryChange={handleCategoryChange}
      initialCategory={initialCategory}
    />
  );
}

/**
 * BACKEND API RESPONSE EXAMPLES
 *
 * GET /api/catalog/categories
 * Returns: B2BCategoryTree[]
 * Example:
 * [
 *   {
 *     id: "cat-1",
 *     slug: "power-tools",
 *     name: "Power Tools",
 *     parentId: null,
 *     depth: 0,
 *     productCount: 156,
 *     children: [
 *       {
 *         id: "cat-2",
 *         slug: "drills",
 *         name: "Drills",
 *         parentId: "cat-1",
 *         depth: 1,
 *         productCount: 42,
 *         children: []
 *       }
 *     ]
 *   }
 * ]
 *
 * GET /api/catalog/products
 * Returns: B2BProduct[]
 * Example:
 * [
 *   {
 *     id: "prod-1",
 *     sku: "DRL-001-BLK",
 *     name: "Professional Cordless Drill",
 *     slug: "professional-cordless-drill",
 *     price: 89900, // cents
 *     originalPrice: 119900,
 *     discountPercent: 25,
 *     isTradeOnly: false,
 *     category: { id: "cat-2", slug: "drills", name: "Drills" },
 *     shortDescription: "High-power drill with variable speed",
 *     technicalSpecs: [
 *       { label: "Voltage", value: "20V" },
 *       { label: "Torque", value: "100 Nm" }
 *     ],
 *     warranty: "2 years",
 *     leadTimeDays: 2,
 *     images: [
 *       { url: "/images/drill-1.jpg", altText: "Drill front view", isPrimary: true }
 *     ],
 *     inventory: {
 *       status: "IN_STOCK",
 *       quantity: 145
 *     },
 *     volumePricing: [
 *       { minQuantity: 10, maxQuantity: 49, pricePerUnit: 85000, discountPercent: 5 },
 *       { minQuantity: 50, maxQuantity: null, pricePerUnit: 80000, discountPercent: 11 }
 *     ],
 *     createdAt: "2026-01-15T10:30:00Z"
 *   }
 * ]
 *
 * MIGRATION NOTES:
 * - If your existing /api/products endpoint returns different field names,
 *   transform the response before passing to B2BShopLayout
 * - Prices should be in cents (multiply by 100 if needed)
 * - Ensure category structure matches B2BCategoryTree with recursive children
 * - The component handles null inventory gracefully but expects the structure shown above
 */
