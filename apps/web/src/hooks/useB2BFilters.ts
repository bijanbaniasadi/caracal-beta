/**
 * useB2BFilters - B2B Catalog Filter State Management
 * Coordinates sidebar/drawer interaction with category and search filtering
 * Location: apps/web/src/hooks/useB2BFilters.ts
 */

'use client';

import { useState, useCallback, useMemo } from 'react';

export interface FilterState {
  activeCategory: string | null;
  searchQuery: string;
  priceRange: [number, number] | null;
  sortBy: 'featured' | 'price_asc' | 'price_desc' | 'newest' | 'sku_asc';
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'ALL';
  tradeOnly: boolean;
}

interface UseB2BFiltersOptions {
  onCategoryChange?: (slug: string | null) => void;
  initialCategory?: string | null;
}

export function useB2BFilters(options: UseB2BFiltersOptions = {}) {
  const { onCategoryChange, initialCategory = null } = options;

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    activeCategory: initialCategory,
    searchQuery: '',
    priceRange: null,
    sortBy: 'featured',
    stockStatus: 'ALL',
    tradeOnly: false,
  });

  // UI state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCompactMode, setIsCompactMode] = useState(false);

  // Category selection handler
  const handleCategorySelect = useCallback((slug: string | null) => {
    setFilters((prev) => ({ ...prev, activeCategory: slug }));
    setIsDrawerOpen(false); // Auto-close drawer on mobile
    onCategoryChange?.(slug);
  }, [onCategoryChange]);

  // Search handler
  const handleSearch = useCallback((query: string) => {
    setFilters((prev) => ({ ...prev, searchQuery: query }));
  }, []);

  // Sort handler
  const handleSort = useCallback(
    (sortBy: FilterState['sortBy']) => {
      setFilters((prev) => ({ ...prev, sortBy }));
    },
    []
  );

  // Stock filter handler
  const handleStockFilter = useCallback(
    (status: FilterState['stockStatus']) => {
      setFilters((prev) => ({ ...prev, stockStatus: status }));
    },
    []
  );

  // Trade-only toggle
  const handleTradeOnlyToggle = useCallback(() => {
    setFilters((prev) => ({ ...prev, tradeOnly: !prev.tradeOnly }));
  }, []);

  // Price range handler
  const handlePriceRange = useCallback((min: number, max: number) => {
    setFilters((prev) => ({ ...prev, priceRange: [min, max] }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({
      activeCategory: null,
      searchQuery: '',
      priceRange: null,
      sortBy: 'featured',
      stockStatus: 'ALL',
      tradeOnly: false,
    });
  }, []);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      filters.activeCategory !== null ||
      filters.searchQuery !== '' ||
      filters.priceRange !== null ||
      filters.sortBy !== 'featured' ||
      filters.stockStatus !== 'ALL' ||
      filters.tradeOnly
    );
  }, [filters]);

  return {
    // Filter state
    filters,
    activeCategory: filters.activeCategory,
    searchQuery: filters.searchQuery,
    sortBy: filters.sortBy,
    stockStatus: filters.stockStatus,
    tradeOnly: filters.tradeOnly,
    priceRange: filters.priceRange,

    // UI state
    isDrawerOpen,
    isCompactMode,
    hasActiveFilters,

    // Handlers
    handleCategorySelect,
    handleSearch,
    handleSort,
    handleStockFilter,
    handleTradeOnlyToggle,
    handlePriceRange,
    clearFilters,
    setIsDrawerOpen,
    setIsCompactMode,
  };
}

/**
 * Filter summary utility - formats active filters for display
 */
export function getFilterSummary(filters: FilterState): string[] {
  const summary: string[] = [];

  if (filters.activeCategory) {
    summary.push(`Category: ${filters.activeCategory}`);
  }
  if (filters.searchQuery) {
    summary.push(`Search: "${filters.searchQuery}"`);
  }
  if (filters.sortBy !== 'featured') {
    summary.push(`Sort: ${filters.sortBy}`);
  }
  if (filters.stockStatus !== 'ALL') {
    summary.push(`Stock: ${filters.stockStatus}`);
  }
  if (filters.tradeOnly) {
    summary.push('Trade Only');
  }
  if (filters.priceRange) {
    summary.push(`Price: ₪${filters.priceRange[0]} - ₪${filters.priceRange[1]}`);
  }

  return summary;
}
