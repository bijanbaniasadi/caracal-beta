/**
 * B2B Shop Layout - Integrated Catalog Interface
 * Combines sidebar (desktop), drawer (mobile), grid, and filter controls
 * Location: apps/web/src/components/catalog/b2b-shop-layout.tsx
 */

'use client';

import { useState, useEffect } from 'react';
import type { B2BProduct, B2BCategoryTree } from '@/lib/api/b2b-catalog-types';
import { B2BCategorySidebar } from './b2b-category-sidebar';
import { B2BFilterDrawer, FilterToggleButton } from './b2b-filter-drawer';
import { B2BProductCard, B2BProductCardSkeleton } from './b2b-product-card';
import { B2BProductGridLayout, B2BCompactGrid } from './b2b-responsive-grid';
import { useB2BFilters, getFilterSummary } from '@/hooks/useB2BFilters';

interface B2BShopLayoutProps {
  categories: B2BCategoryTree[];
  products: B2BProduct[];
  isLoading?: boolean;
  onCategoryChange?: (slug: string | null) => void;
  initialCategory?: string | null;
}

export function B2BShopLayout({
  categories,
  products,
  isLoading = false,
  onCategoryChange,
  initialCategory = null,
}: B2BShopLayoutProps) {
  const {
    filters,
    activeCategory,
    isDrawerOpen,
    isCompactMode,
    hasActiveFilters,
    handleCategorySelect,
    handleSearch,
    clearFilters,
    setIsDrawerOpen,
    setIsCompactMode,
  } = useB2BFilters({ onCategoryChange, initialCategory });

  const [filteredProducts, setFilteredProducts] = useState<B2BProduct[]>(products);

  // Apply filters to products
  useEffect(() => {
    let filtered = [...products];

    // Category filter
    if (filters.activeCategory) {
      filtered = filtered.filter((p) => p.category?.slug === filters.activeCategory);
    }

    // Search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.sku.toLowerCase().includes(query) ||
          p.shortDescription?.toLowerCase().includes(query)
      );
    }

    // Stock status filter
    if (filters.stockStatus !== 'ALL') {
      filtered = filtered.filter((p) => p.inventory.status === filters.stockStatus);
    }

    // Trade-only filter
    if (filters.tradeOnly) {
      filtered = filtered.filter((p) => p.isTradeOnly);
    }

    // Price range filter
    if (filters.priceRange) {
      filtered = filtered.filter(
        (p) => p.price >= filters.priceRange![0] && p.price <= filters.priceRange![1]
      );
    }

    // Sort
    const sortedProducts = [...filtered];
    switch (filters.sortBy) {
      case 'price_asc':
        sortedProducts.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        sortedProducts.sort((a, b) => b.price - a.price);
        break;
      case 'newest':
        sortedProducts.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        break;
      case 'sku_asc':
        sortedProducts.sort((a, b) => a.sku.localeCompare(b.sku));
        break;
      case 'featured':
      default:
        break;
    }

    setFilteredProducts(sortedProducts);
  }, [products, filters]);

  const filterSummary = getFilterSummary(filters);
  const activeProductCount = filteredProducts.length;
  const totalProductCount = products.length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {/* Header with search & filters */}
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 border-b border-slate-800/50 bg-slate-950/95 backdrop-blur-lg">
        <div className="mx-auto max-w-full px-4 py-4 sm:px-6 lg:px-8">
          {/* Search bar and mobile filter toggle */}
          <div className="flex items-center gap-3 mb-4">
            {/* Mobile filter button */}
            <button
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
              className="lg:hidden"
            >
              <FilterToggleButton
                activeCategory={activeCategory}
                onToggle={() => setIsDrawerOpen(!isDrawerOpen)}
                categoryCount={categories.length}
              />
            </button>

            {/* Search input */}
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search SKU, name, or specs..."
                value={filters.searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-700/50 bg-slate-800/50 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
              />
              {filters.searchQuery && (
                <button
                  onClick={() => handleSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Compact mode toggle */}
            <button
              onClick={() => setIsCompactMode(!isCompactMode)}
              className="rounded-lg border border-slate-700/50 bg-slate-800/50 hover:bg-slate-800 px-3 py-2.5 text-sm font-medium text-slate-300 hover:text-slate-100 transition-colors"
              title={isCompactMode ? 'Standard view' : 'Compact view'}
            >
              {isCompactMode ? '⊞' : '⊡'}
            </button>
          </div>

          {/* Filter summary & controls */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {filterSummary.length > 0 ? (
                <>
                  {filterSummary.map((summary) => (
                    <span
                      key={summary}
                      className="inline-flex items-center rounded-full bg-slate-800/50 px-3 py-1 text-xs font-medium text-slate-300 border border-slate-700/50"
                    >
                      {summary}
                    </span>
                  ))}
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                </>
              ) : (
                <span className="text-xs text-slate-500">No filters applied</span>
              )}
            </div>

            {/* Result count */}
            <span className="text-xs text-slate-400">
              {activeProductCount} / {totalProductCount}
            </span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {/* Main content with sidebar + grid */}
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      <div className="flex">
        {/* Desktop sidebar (hidden on mobile) */}
        <aside className="hidden lg:block w-64 border-r border-slate-800/50 sticky top-20 h-[calc(100vh-80px)] overflow-y-auto bg-slate-950/50">
          <B2BCategorySidebar
            categories={categories}
            activeCategory={activeCategory}
            onCategorySelect={handleCategorySelect}
            isLoading={isLoading}
          />
        </aside>

        {/* Mobile drawer */}
        <B2BFilterDrawer
          categories={categories}
          activeCategory={activeCategory}
          onCategorySelect={handleCategorySelect}
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          isLoading={isLoading}
        />

        {/* Product grid */}
        <main className="flex-1 min-h-[calc(100vh-120px)] p-4 sm:p-6 lg:p-8">
          {isLoading ? (
            <B2BCompactGrid>
              {Array.from({ length: 24 }).map((_, i) => (
                <B2BProductCardSkeleton key={i} isCompact={isCompactMode} />
              ))}
            </B2BCompactGrid>
          ) : filteredProducts.length > 0 ? (
            <B2BProductGridLayout isCompactMode={isCompactMode} sidebarOpen={false}>
              {filteredProducts.map((product) => (
                <B2BProductCard
                  key={product.id}
                  product={product}
                  isCompact={isCompactMode}
                />
              ))}
            </B2BProductGridLayout>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-lg border border-slate-700/30 bg-slate-800/20">
              <div className="text-center">
                <svg
                  className="mx-auto h-12 w-12 text-slate-600 mb-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
                  />
                </svg>
                <p className="text-sm font-medium text-slate-400">No products found</p>
                <p className="text-xs text-slate-500 mt-1">
                  Try adjusting your filters or search query
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="mt-3 text-xs font-medium text-orange-500 hover:text-orange-400 transition-colors"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
