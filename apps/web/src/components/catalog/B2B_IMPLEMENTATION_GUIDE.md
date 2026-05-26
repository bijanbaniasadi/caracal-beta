# B2B Catalog Interface - Complete Implementation Guide

## Overview

This guide describes the production-grade B2B catalog components created to transform your retail-oriented `/shop` view into a high-density, technical B2B catalog interface. All components are built with Next.js 15, React 18, and Tailwind CSS 3, with no backend schema or runtime modifications required.

---

## Component Architecture

### Type System (`b2b-catalog-types.ts`)

Foundation layer extending your existing catalog schema:

```typescript
// Key interfaces
B2BProduct           // Extends Product with SKU, volume pricing, specs
B2BCategoryTree      // Hierarchical category with recursive children
FilterState          // Maintains filter selections
VolumePriceTier      // Bulk pricing breakpoints
```

### Core Components

#### 1. **B2BProductCard** (`b2b-product-card.tsx`)
High-density product display optimized for technical scanning.

**Features:**
- Prominent SKU in uppercase monospace font
- Trade-only and discount badges
- Technical specs mini-summary (compact mode)
- Product count and inventory status
- Quick action menu integration
- Two density modes: standard and ultra-compact (5-6 columns)

**Props:**
```typescript
{
  product: B2BProduct
  isCompact?: boolean // Enables 5-6 column grid
}
```

**Usage:**
```tsx
<B2BProductCard product={product} isCompact={false} />
```

---

#### 2. **B2BPriceDisplay** (`b2b-price-display.tsx`)
Professional pricing with discount visualization.

**Features:**
- Original price strikethrough when discount exists
- Discount percentage badge (red styling)
- Auto-calculates discount from originalPrice if not provided
- VolumePricingTiers sub-component for detail pages
- Currency symbol handling (₪)

**Components:**
- `B2BPriceDisplay` - Full display (size: sm|md|lg)
- `B2BPriceInline` - Compact table view
- `VolumePricingTiers` - Volume discount display

**Usage:**
```tsx
<B2BPriceDisplay 
  price={8990}
  originalPrice={11990}
  discountPercent={25}
  size="md"
/>
```

---

#### 3. **QuickActionMenu** (`quick-action-menu.tsx`)
Multi-channel customer engagement interface.

**Features:**
- WhatsApp inquiry button with pre-filled messages
- Add to Quote CTA
- Full Details link
- Click-outside detection
- DetailPageCTASection for product pages

**WhatsApp Integration:**
```
Message format: "Hi Caracal Tech, I am inquiring about:\n\nSKU: [SKU]\nProduct: [NAME]"
Link: https://wa.me/971000000000?text=[encoded-message]
```

**⚠️ IMPORTANT:** Replace `971000000000` with your actual WhatsApp Business number.

**Usage:**
```tsx
<QuickActionMenu product={product} variant="card" />

// On detail pages:
<DetailPageCTASection product={product} />
```

---

#### 4. **B2BCategorySidebar** (`b2b-category-sidebar.tsx`)
Persistent left sidebar for desktop navigation.

**Features:**
- Recursive category tree with expand/collapse
- Product count badges per category
- "Show All Products" button as filter reset
- Active state with orange accent border
- Depth-based indentation for nested categories
- Loading skeleton state

**Props:**
```typescript
{
  categories: B2BCategoryTree[]
  activeCategory?: string
  onCategorySelect: (slug: string | null) => void
  isLoading?: boolean
}
```

**Usage:**
```tsx
<B2BCategorySidebar
  categories={categories}
  activeCategory={activeCategory}
  onCategorySelect={handleCategorySelect}
  isLoading={isLoading}
/>
```

---

#### 5. **B2BFilterDrawer** (`b2b-filter-drawer.tsx`)
Performance-optimized mobile filter navigation.

**Features:**
- Slide-out drawer animation (300ms ease-in-out)
- Backdrop overlay
- Escape key & body scroll handling
- FilterToggleButton for header integration
- MobileFilterTreeNode for responsive category display

**Props:**
```typescript
{
  categories: B2BCategoryTree[]
  activeCategory?: string
  onCategorySelect: (slug: string | null) => void
  isOpen: boolean
  onClose: () => void
  isLoading?: boolean
}
```

**Usage:**
```tsx
<B2BFilterDrawer
  categories={categories}
  activeCategory={activeCategory}
  onCategorySelect={handleCategorySelect}
  isOpen={isDrawerOpen}
  onClose={() => setIsDrawerOpen(false)}
  isLoading={isLoading}
/>

// Header integration:
<FilterToggleButton
  activeCategory={activeCategory}
  onToggle={() => setIsDrawerOpen(!isDrawerOpen)}
  categoryCount={categories.length}
/>
```

---

#### 6. **B2BShopLayout** (`b2b-shop-layout.tsx`)
Complete integrated catalog interface combining all components.

**Features:**
- Responsive sidebar (desktop) → drawer (mobile) transition
- Real-time product filtering (category, search, stock, price)
- Sorting options (featured, price, SKU)
- Compact/standard view toggle
- Filter summary display with clear-all button
- Result counting (X / Total)
- Empty state messaging

**Props:**
```typescript
{
  categories: B2BCategoryTree[]
  products: B2BProduct[]
  isLoading?: boolean
  onCategoryChange?: (slug: string | null) => void
  initialCategory?: string | null
}
```

**Usage:**
```tsx
<B2BShopLayout
  categories={categories}
  products={products}
  isLoading={isLoading}
  onCategoryChange={handleCategoryChange}
  initialCategory={initialCategory}
/>
```

---

### Supporting Components

#### **B2BResponsiveGrid** (`b2b-responsive-grid.tsx`)
Adaptive grid container for product cards.

**Breakpoints:**
- Small: 2 columns
- Medium: 3 columns
- Large: 4 columns
- XL: 5 columns
- 2XL: 6 columns

```tsx
<B2BResponsiveGrid>
  {products.map(p => <B2BProductCard key={p.id} product={p} />)}
</B2BResponsiveGrid>
```

#### **InventoryBadge** (`status-badge.tsx`)
Stock status visual indicator.

**Statuses:**
- IN_STOCK (green checkmark)
- LIMITED (amber warning)
- BACKORDER (blue cycle icon)
- OUT_OF_STOCK (red X)
- DISCONTINUED (gray dash)

```tsx
<InventoryBadge status="IN_STOCK" isCompact={false} />
```

---

### State Management

#### **useB2BFilters** (`useB2BFilters.ts`)
Custom hook managing filter and UI state.

**Returns:**
```typescript
{
  // Filter state
  filters: FilterState
  activeCategory: string | null
  searchQuery: string
  sortBy: SortOption
  stockStatus: StockStatusFilter
  tradeOnly: boolean
  priceRange: [number, number] | null

  // UI state
  isDrawerOpen: boolean
  isCompactMode: boolean
  hasActiveFilters: boolean

  // Handlers
  handleCategorySelect(slug: string | null): void
  handleSearch(query: string): void
  handleSort(sortBy: SortOption): void
  handleStockFilter(status: StockStatusFilter): void
  handleTradeOnlyToggle(): void
  handlePriceRange(min: number, max: number): void
  clearFilters(): void
  setIsDrawerOpen(open: boolean): void
  setIsCompactMode(compact: boolean): void
}
```

**Usage:**
```tsx
const {
  filters,
  activeCategory,
  handleCategorySelect,
  isDrawerOpen,
  setIsDrawerOpen,
  // ... other handlers
} = useB2BFilters({
  onCategoryChange: (slug) => console.log('Category:', slug),
  initialCategory: 'power-tools'
});
```

---

## Integration Steps

### Step 1: Update Type Definitions

Create/update `apps/web/src/lib/api/b2b-catalog-types.ts` with the provided types. Map your existing Product schema to B2BProduct:

```typescript
// Example transformation
interface B2BProduct {
  id: string
  sku: string                    // From product code field
  name: string                   // From product name
  slug: string                   // From product slug
  price: number                  // In cents
  originalPrice?: number         // For discounts
  discountPercent?: number       // Optional
  isTradeOnly: boolean          // From trade-only flag
  // ... other fields
}
```

### Step 2: Update Shop Page

Replace or update your existing shop page (`apps/web/src/app/shop/page.tsx`):

```typescript
import { B2BShopLayout } from '@/components/catalog/b2b-shop-layout'

export default async function ShopPage() {
  // Fetch categories and products from your API
  const categories = await fetchCategories()
  const products = await fetchProducts()

  return (
    <B2BShopLayout
      categories={categories}
      products={products}
      onCategoryChange={(slug) => {
        // Optional: Update URL or analytics
      }}
    />
  )
}
```

### Step 3: API Integration

Your backend should provide two endpoints:

**GET /api/catalog/categories**
```json
[
  {
    "id": "cat-1",
    "slug": "power-tools",
    "name": "Power Tools",
    "parentId": null,
    "depth": 0,
    "productCount": 156,
    "children": [...]
  }
]
```

**GET /api/catalog/products**
```json
[
  {
    "id": "prod-1",
    "sku": "DRL-001-BLK",
    "name": "Professional Cordless Drill",
    "price": 89900,
    "originalPrice": 119900,
    "category": { "id": "cat-1", "slug": "drills", "name": "Drills" },
    "images": [{ "url": "...", "isPrimary": true }],
    "inventory": { "status": "IN_STOCK", "quantity": 145 },
    "technicalSpecs": [{ "label": "Voltage", "value": "20V" }],
    ...
  }
]
```

### Step 4: Configure WhatsApp

Update the WhatsApp phone number in:
- `quick-action-menu.tsx` line 39: `https://wa.me/971000000000?text=...`
- `quick-action-menu.tsx` line 139: Same URL in DetailPageCTASection

Replace `971000000000` with your WhatsApp Business account number.

### Step 5: (Optional) Add Product Detail Page Updates

For product detail pages, update to display B2B-specific information:

```tsx
import { DetailPageCTASection } from '@/components/catalog/quick-action-menu'
import { VolumePricingTiers } from '@/components/catalog/b2b-price-display'

export function ProductDetailPage({ product }: { product: B2BProduct }) {
  return (
    <>
      {/* ... existing detail content ... */}
      
      {product.volumePricing && (
        <VolumePricingTiers tiers={product.volumePricing} />
      )}
      
      <DetailPageCTASection product={product} />
    </>
  )
}
```

---

## Responsive Behavior

### Desktop (lg breakpoint and above)
- **Sidebar:** Always visible on left, sticky position
- **Grid:** 4-5 columns standard, 5-6 columns compact mode
- **Navigation:** Sidebar with expand/collapse categories

### Tablet (md-lg)
- **Sidebar:** Hidden
- **Filter:** Mobile drawer with toggle button
- **Grid:** 3-4 columns standard, 4-5 columns compact mode

### Mobile (sm-md)
- **Sidebar:** Hidden
- **Filter:** Mobile drawer accessible via header toggle button
- **Grid:** 2-3 columns standard, 3-4 columns compact mode

---

## Styling & Customization

### Color Scheme
All components use Tailwind CSS dark mode tokens:
- Primary backgrounds: `slate-950`, `slate-900`
- Accent color: `orange-500` (active states)
- Text: `slate-100` (primary), `slate-400` (secondary)

### Customization Points

**Sidebar width:**
```tsx
// In b2b-shop-layout.tsx, change class from 'w-64' to desired width
<aside className="hidden lg:block w-80"> {/* 20rem → 20rem */}
```

**Grid gaps and spacing:**
```tsx
// In b2b-responsive-grid.tsx
<div className="grid gap-3"> {/* gap-3 → gap-4 for more space */}
```

**Card density:**
```tsx
// Toggle isCompact prop to switch between dense and standard display
<B2BProductCard product={product} isCompact={true} />
```

---

## Performance Considerations

### Built-in Optimizations

1. **Image Handling:** Next.js Image component with responsive sizes
2. **Skeleton Loading:** Animated placeholders during data fetch
3. **Efficient Filtering:** Client-side filter application (works for <10k products)
4. **Responsive Design:** Mobile-first CSS prevents unnecessary rendering
5. **Memoization:** useCallback, useMemo for expensive operations

### For Large Datasets (10k+ products)

If your catalog exceeds 10k products, consider:

1. **Server-side Filtering:** Move filtering to backend API
2. **Pagination:** Replace/complement client-side filtering with pagination
3. **Search Optimization:** Debounce search input and call backend
4. **Lazy Loading:** Implement intersection observer for infinite scroll

---

## TypeScript Support

All components are fully typed with strict TypeScript. Key interfaces:

```typescript
interface B2BProduct {
  id: string
  sku: string
  name: string
  slug: string
  price: number
  originalPrice?: number
  discountPercent?: number
  isTradeOnly: boolean
  category?: {
    id: string
    slug: string
    name: string
  }
  shortDescription?: string
  technicalSpecs?: Array<{ label: string; value: string }>
  warranty?: string
  leadTimeDays?: number
  images: Array<{
    url: string
    altText?: string
    isPrimary?: boolean
  }>
  inventory: {
    status: 'IN_STOCK' | 'LIMITED' | 'BACKORDER' | 'OUT_OF_STOCK' | 'DISCONTINUED'
    quantity?: number
  }
  volumePricing?: Array<{
    minQuantity: number
    maxQuantity?: number
    pricePerUnit: number
    discountPercent?: number
  }>
  createdAt?: string
}

interface B2BCategoryTree {
  id: string
  slug: string
  name: string
  parentId?: string | null
  depth: number
  productCount?: number
  icon?: string
  children?: B2BCategoryTree[]
}
```

---

## Testing Checklist

- [ ] Categories load and display correctly
- [ ] Products display in all grid densities
- [ ] Category filtering works on desktop sidebar
- [ ] Mobile drawer opens/closes smoothly
- [ ] Search filters products in real-time
- [ ] Sort options reorder correctly
- [ ] Stock status badges display for all statuses
- [ ] WhatsApp links include SKU and product name
- [ ] Responsive breakpoints transition smoothly
- [ ] Empty state displays when no products match filters
- [ ] Price display shows discounts correctly
- [ ] Image fallback renders when image fails to load
- [ ] Keyboard navigation works (Escape closes drawer)
- [ ] Volume pricing displays on detail pages

---

## Troubleshooting

### Issue: "Cannot find module 'b2b-catalog-types'"
**Solution:** Ensure `apps/web/src/lib/api/b2b-catalog-types.ts` exists with all exported types.

### Issue: WhatsApp links open but message is empty
**Solution:** Verify URL encoding in QuickActionMenu. Check that `product.sku` and `product.name` are not undefined.

### Issue: Sidebar not showing on desktop
**Solution:** Ensure `lg:` breakpoint styles are not being overridden. Check that Tailwind lg breakpoint is configured as 1024px.

### Issue: Products not filtering correctly
**Solution:** Verify product data matches B2BProduct interface, especially `inventory.status` and `category.slug` fields.

### Issue: Mobile drawer scrolls with body
**Solution:** Ensure `useEffect` in B2BFilterDrawer sets `document.body.style.overflow = 'hidden'` when open.

---

## Files Created

```
apps/web/src/
├── lib/api/
│   └── b2b-catalog-types.ts              [Type definitions]
├── components/catalog/
│   ├── b2b-product-card.tsx              [Product card]
│   ├── b2b-price-display.tsx             [Pricing component]
│   ├── quick-action-menu.tsx             [CTA & WhatsApp]
│   ├── b2b-category-sidebar.tsx          [Desktop navigation]
│   ├── b2b-filter-drawer.tsx             [Mobile navigation]
│   ├── b2b-responsive-grid.tsx           [Grid wrapper]
│   ├── b2b-shop-layout.tsx               [Main layout]
│   ├── status-badge.tsx                  [Inventory badge]
│   └── B2B_IMPLEMENTATION_GUIDE.md       [This file]
├── hooks/
│   └── useB2BFilters.ts                  [Filter state hook]
└── app/shop/
    ├── page.tsx                          [Update this]
    └── b2b-page-example.tsx              [Reference implementation]
```

---

## Next Steps

1. **Immediate:** Update WhatsApp phone number in `quick-action-menu.tsx`
2. **Short-term:** Integrate shop page with B2BShopLayout component
3. **Medium-term:** Configure API endpoints and data mapping
4. **Long-term:** Add advanced features (infinite scroll, saved filters, compare products)

---

## Support & Customization

This implementation is production-ready but designed to be extended. Common customizations:

- **Add more filter options:** Update FilterState in useB2BFilters.ts
- **Change color scheme:** Update Tailwind classes in components
- **Adjust grid layout:** Modify breakpoints in B2BResponsiveGrid
- **Add product comparison:** Create new component extending QuickActionMenu
- **Implement favorites:** Add localStorage in product cards

---

**Created:** May 2026  
**Framework:** Next.js 15 + React 18 + Tailwind CSS 3  
**Architecture:** Type-safe, fully responsive, production-grade  
**Status:** Ready for integration
