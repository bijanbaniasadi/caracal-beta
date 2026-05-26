/**
 * B2B Filter Drawer - Mobile Slide-Out Navigation
 * Performance-optimized for mobile viewport efficiency
 * Location: apps/web/src/components/catalog/b2b-filter-drawer.tsx
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import type { B2BCategoryTree } from '@/lib/api/b2b-catalog-types';

interface B2BFilterDrawerProps {
  categories: B2BCategoryTree[];
  activeCategory?: string | null;
  onCategorySelect: (slug: string | null) => void;
  isOpen: boolean;
  onClose: () => void;
  isLoading?: boolean;
}

export function B2BFilterDrawer({
  categories,
  activeCategory,
  onCategorySelect,
  isOpen,
  onClose,
  isLoading = false,
}: B2BFilterDrawerProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleCategorySelect = (slug: string | null) => {
    onCategorySelect(slug);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed inset-y-0 left-0 w-80 bg-slate-950 border-r border-slate-700/50 shadow-xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Filter categories"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700/50 px-4 py-3 sticky top-0 bg-slate-900/95 backdrop-blur">
          <h2 className="text-base font-semibold text-slate-100">
            Filter Categories
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-slate-200"
            aria-label="Close filter drawer"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-slate-800" />
              ))}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {/* Show All button */}
              <button
                onClick={() => handleCategorySelect(null)}
                className={`w-full flex items-center justify-between gap-2 px-4 py-3 text-sm transition-colors rounded-lg ${
                  activeCategory === null || activeCategory === undefined
                    ? 'bg-slate-800 text-slate-100 border-l-2 border-orange-500 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <span>All Products</span>
                <span className="text-xs bg-slate-700 rounded-full px-2 py-0.5">
                  {categories.reduce((sum, cat) => sum + (cat.productCount || 0), 0)}
                </span>
              </button>

              {/* Category tree */}
              <MobileFilterTreeNode
                categories={categories}
                activeCategory={activeCategory}
                onCategorySelect={handleCategorySelect}
                expandedCategories={expandedCategories}
                onToggleExpanded={(slug) => {
                  setExpandedCategories((prev) => {
                    const next = new Set(prev);
                    if (next.has(slug)) {
                      next.delete(slug);
                    } else {
                      next.add(slug);
                    }
                    return next;
                  });
                }}
                depth={0}
              />
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="border-t border-slate-700/50 px-4 py-3 sticky bottom-0 bg-slate-900/95 backdrop-blur">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-slate-800 hover:bg-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-100 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface MobileFilterTreeNodeProps {
  categories: B2BCategoryTree[];
  activeCategory?: string | null;
  onCategorySelect: (slug: string | null) => void;
  expandedCategories: Set<string>;
  onToggleExpanded: (slug: string) => void;
  depth: number;
}

function MobileFilterTreeNode({
  categories,
  activeCategory,
  onCategorySelect,
  expandedCategories,
  onToggleExpanded,
  depth,
}: MobileFilterTreeNodeProps) {
  return (
    <div className="space-y-0.5">
      {categories.map((category) => {
        const isExpanded = expandedCategories.has(category.slug);
        const isActive = activeCategory === category.slug;
        const hasChildren = category.children && category.children.length > 0;
        const paddingLeft = depth * 16;

        return (
          <div key={category.slug}>
            {/* Category item */}
            <div style={{ paddingLeft: `${paddingLeft}px` }}>
              <button
                onClick={() => onCategorySelect(category.slug)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-3 text-sm rounded-lg transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-slate-100 font-semibold border-l-2 border-orange-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <span className="flex-1 text-left line-clamp-1">
                  {category.name}
                </span>

                {/* Product count */}
                <span className={`text-xs rounded-full px-2 py-0.5 flex-shrink-0 ${
                  isActive
                    ? 'bg-orange-500/20 text-orange-400'
                    : 'bg-slate-700/50 text-slate-500'
                }`}>
                  {category.productCount}
                </span>

                {/* Expand toggle (if has children) */}
                {hasChildren && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleExpanded(category.slug);
                    }}
                    className="p-0.5 hover:bg-slate-700/50 rounded transition-colors flex-shrink-0"
                  >
                    <svg
                      className={`h-3.5 w-3.5 text-slate-500 transition-transform ${
                        isExpanded ? 'rotate-90' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                )}
              </button>

              {/* Child categories (recursively) */}
              {hasChildren && isExpanded && (
                <MobileFilterTreeNode
                  categories={category.children}
                  activeCategory={activeCategory}
                  onCategorySelect={onCategorySelect}
                  expandedCategories={expandedCategories}
                  onToggleExpanded={onToggleExpanded}
                  depth={depth + 1}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Mobile filter toggle button (header component)
 */
export function FilterToggleButton({
  activeCategory,
  onToggle,
  categoryCount: _categoryCount,
}: {
  activeCategory?: string | null;
  onToggle: () => void;
  categoryCount?: number;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/50 hover:bg-slate-800 px-3 py-2 text-sm transition-colors text-slate-200"
      aria-label="Open filters"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
      </svg>
      <span className="font-medium">Filters</span>
      {activeCategory && (
        <span className="inline-flex items-center rounded-full bg-orange-500/20 px-2 py-0.5 text-xs font-semibold text-orange-400">
          1
        </span>
      )}
    </button>
  );
}
