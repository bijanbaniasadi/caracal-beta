/**
 * B2B Category Sidebar - Persistent Desktop Filter Navigation
 * Handles deep taxonomy with item count tracking
 * Location: apps/web/src/components/catalog/b2b-category-sidebar.tsx
 */

'use client';

import { useState, useCallback } from 'react';
import type { B2BCategoryTree } from '@/lib/api/b2b-catalog-types';

interface B2BCategorySidebarProps {
  categories: B2BCategoryTree[];
  activeCategory?: string | null;
  onCategorySelect: (slug: string | null) => void;
  isLoading?: boolean;
}

export function B2BCategorySidebar({
  categories,
  activeCategory,
  onCategorySelect,
  isLoading = false,
}: B2BCategorySidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleExpanded = useCallback((slug: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  }, []);

  if (isLoading) {
    return (
      <div className="w-64 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-slate-800" />
        ))}
      </div>
    );
  }

  return (
    <div className="w-64 flex flex-col gap-1">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50">
        <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">
          Categories
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {categories.length} categories
        </p>
      </div>

      {/* "Show All" option */}
      <button
        onClick={() => onCategorySelect(null)}
        className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors rounded-lg mx-1 ${
          activeCategory === null || activeCategory === undefined
            ? 'bg-slate-800 text-slate-100 border-l-2 border-orange-500'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
        }`}
      >
        <span className="flex-1 text-left font-medium">All Products</span>
        <span className="text-xs bg-slate-700 rounded-full px-2 py-0.5">
          {categories.reduce((sum, cat) => sum + (cat.productCount || 0), 0)}
        </span>
      </button>

      {/* Category tree */}
      <nav className="flex-1 overflow-y-auto space-y-0.5 px-1">
        <CategoryTreeNode
          categories={categories}
          activeCategory={activeCategory}
          onCategorySelect={onCategorySelect}
          expandedCategories={expandedCategories}
          onToggleExpanded={toggleExpanded}
          depth={0}
        />
      </nav>

      {/* Footer with info */}
      <div className="border-t border-slate-700/50 px-4 py-2 text-xs text-slate-500">
        <p>💡 Select a category to filter products</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface CategoryTreeNodeProps {
  categories: B2BCategoryTree[];
  activeCategory?: string | null;
  onCategorySelect: (slug: string) => void;
  expandedCategories: Set<string>;
  onToggleExpanded: (slug: string) => void;
  depth: number;
}

function CategoryTreeNode({
  categories,
  activeCategory,
  onCategorySelect,
  expandedCategories,
  onToggleExpanded,
  depth,
}: CategoryTreeNodeProps) {
  return (
    <div className="space-y-0.5">
      {categories.map((category) => {
        const isExpanded = expandedCategories.has(category.slug);
        const isActive = activeCategory === category.slug;
        const hasChildren = category.children && category.children.length > 0;
        const paddingLeft = depth * 12;

        return (
          <div key={category.slug}>
            {/* Category item */}
            <div className="flex items-center gap-0.5 group" style={{ paddingLeft: `${paddingLeft}px` }}>
              {/* Expand toggle */}
              {hasChildren ? (
                <button
                  onClick={() => onToggleExpanded(category.slug)}
                  className="p-1 hover:bg-slate-700/50 rounded transition-colors"
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                >
                  <svg
                    className={`h-3 w-3 text-slate-500 transition-transform ${
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
              ) : (
                <div className="w-5" />
              )}

              {/* Category button */}
              <button
                onClick={() => onCategorySelect(category.slug)}
                className={`flex-1 flex items-center justify-between gap-2 px-2 py-2 rounded text-xs transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-slate-100 font-semibold border-l-2 border-orange-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <span className="line-clamp-1">{category.name}</span>
                <span className={`text-xs rounded-full px-1.5 py-0.5 ${
                  isActive
                    ? 'bg-orange-500/20 text-orange-400'
                    : 'bg-slate-700/50 text-slate-500'
                }`}>
                  {category.productCount}
                </span>
              </button>
            </div>

            {/* Child categories (recursively) */}
            {hasChildren && isExpanded && (
              <CategoryTreeNode
                categories={category.children}
                activeCategory={activeCategory}
                onCategorySelect={onCategorySelect}
                expandedCategories={expandedCategories}
                onToggleExpanded={onToggleExpanded}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
