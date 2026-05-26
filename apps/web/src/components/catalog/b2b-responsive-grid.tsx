/**
 * B2B Responsive Grid Wrapper
 * Adapts column count and component density based on viewport
 * Location: apps/web/src/components/catalog/b2b-responsive-grid.tsx
 */

'use client';

import type { ReactNode } from 'react';

interface B2BResponsiveGridProps {
  children: ReactNode;
  className?: string;
}

export function B2BResponsiveGrid({ children, className = '' }: B2BResponsiveGridProps) {
  return (
    <div
      className={`
        grid gap-3
        sm:grid-cols-2
        md:grid-cols-3
        lg:grid-cols-4
        xl:grid-cols-5
        2xl:grid-cols-6
        auto-rows-max
        ${className}
      `}
    >
      {children}
    </div>
  );
}

/**
 * B2B Compact Grid - Ultra-dense 5-6 column layout for technical scanning
 */
export function B2BCompactGrid({ children, className = '' }: B2BResponsiveGridProps) {
  return (
    <div
      className={`
        grid gap-2
        sm:grid-cols-3
        md:grid-cols-4
        lg:grid-cols-5
        xl:grid-cols-6
        2xl:grid-cols-7
        auto-rows-max
        ${className}
      `}
    >
      {children}
    </div>
  );
}

/**
 * Product grid wrapper with sidebar integration
 */
interface B2BProductGridLayoutProps {
  children: ReactNode;
  sidebarOpen: boolean;
  isCompactMode?: boolean;
}

export function B2BProductGridLayout({
  children,
  sidebarOpen,
  isCompactMode = false,
}: B2BProductGridLayoutProps) {
  const GridComponent = isCompactMode ? B2BCompactGrid : B2BResponsiveGrid;

  return (
    <div
      className={`
        transition-all duration-300
        ${sidebarOpen ? 'lg:ml-0' : 'lg:ml-0'}
      `}
    >
      <GridComponent>{children}</GridComponent>
    </div>
  );
}
