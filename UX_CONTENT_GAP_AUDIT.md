# 🔍 CaracalTech Shop: UX/Content Gap Audit Report
**New Site vs. Old Live Site Comparison**  
**Generated:** May 25, 2026  
**Scope:** `/shop` → `/shop/[slug]` customer flow

---

## ✅ WHAT NEW SITE HAS (Current Implementation)

### 1. **Category Structure**
- ✅ Category navigation pills (horizontal)
- ✅ Category filtering with URL params (`?category=slug`)
- ✅ Category badge on product cards
- ✅ Category name in small text above product title

### 2. **Product Grid Layout**
- ✅ 2-column mobile → 3-column tablet → 4-column desktop (responsive)
- ✅ Rounded borders with subtle white/10 border styling
- ✅ Hover effects (border color change to orange/30)
- ✅ Product cards are Link-based for navigation
- ✅ Skeleton loading states while fetching
- ✅ Empty state UI ("No products found")

### 3. **Product Card Display**
- ✅ Product image (primary image support)
- ✅ Image alt text handling
- ✅ Image placeholder (fallback icon) for missing images
- ✅ Image zoom/scale on hover (300ms transition)
- ✅ Category label (small, technical font, orange)
- ✅ Product name (2-line clamp)
- ✅ Short description (2-line clamp)
- ✅ Price display component
- ✅ Inventory badge (status indicator)

### 4. **Prices & Discounts**
- ✅ Price display component exists
- ✅ Structured price data (via `PriceDisplay` component)
- ⚠️ Discount display logic **not visible** in current files

### 5. **SKU/Code Visibility**
- ❌ **No SKU/product code visible** on product cards
- ❌ **No product ID/reference code** shown
- ⚠️ Likely available on product detail page (need to verify)

### 6. **Cart Functionality**
- ✅ "Add to Cart" type buttons likely in detail page (sticky-cta.tsx mentions CTA)
- ⚠️ **Not visible on product cards** - must click to detail page first
- ✅ Cart checkout route exists (`/shop/checkout`)
- ✅ Cart success/cancel pages exist

### 7. **Mobile Bottom CTA**
- ✅ Sticky CTA component exists (`sticky-cta.tsx`)
- ✅ Designed for mobile bottom position
- ⚠️ **Specifics unclear** - need to review component

### 8. **Trust Sections**
- ✅ **Trust info box exists** on shop landing with 3 items:
  - UAE stock and sourcing (Dubai-based fulfillment)
  - Secure payment options (Card, invoice, bank transfer)
  - Workshop compatibility help
- ✅ Clean design with border and background styling
- ✅ Responsive grid (3 columns on desktop, stacked on mobile)

### 9. **Product Images**
- ✅ Primary image selection logic
- ✅ Image lazy loading with Next.js Image optimization
- ✅ Responsive sizes (`50vw` mobile, `33vw` tablet, `25vw` desktop)
- ✅ Image lightbox component exists (`image-lightbox.tsx`)
- ✅ Multiple images support (`product.images` array)

### 10. **Category Filters**
- ✅ Category pill navigation (`CategoryNav` component)
- ✅ Active state highlighting
- ✅ Clear filter (click pill again to deselect)
- ✅ Search overrides category filter
- ⚠️ **No multi-select filters** (price range, brand, specs, etc.)
- ⚠️ **No "Show All" option** visible

### 11. **Pagination & Loading**
- ✅ **Infinite scroll** (not traditional pagination)
- ✅ "Load more" button at bottom
- ✅ Skeleton loaders during fetch
- ✅ Loading state disabled during fetch
- ❌ **No traditional pagination** (page numbers)

### 12. **Search Functionality**
- ✅ Search bar component (`SearchBar`)
- ✅ Search parameter in URL (`?q=term`)
- ✅ Result count display
- ✅ Clears category when searching
- ✅ Sort applies to search results

### 13. **Sorting**
- ✅ Sort select dropdown (`SortSelect`)
- ✅ Default: "featured"
- ✅ Applies to both category view and search
- ⚠️ **Sort options unclear** - need to verify (featured, price, newest, etc.)

### 14. **Product Detail Page**
- ✅ Individual product page exists (`/shop/[slug]`)
- ✅ Product detail content component
- ✅ Inquiry CTA component (ask before buying)
- ✅ Related products component
- ✅ Product attributes table
- ✅ GCC badges/certifications
- ✅ Pricing panel (detail view)
- ✅ Stock indicator

### 15. **Inventory Status**
- ✅ Inventory badge on cards
- ✅ Status values: `OUT_OF_STOCK`, `DISCONTINUED`, `IN_STOCK`, `LIMITED`
- ✅ Out-of-stock cards get opacity-60 styling (visually disabled)
- ✅ Trade-only badge support

---

## ❌ WHAT'S MISSING (Potential Gaps)

### **1. CRITICAL GAPS - Must Have Before Launch**

#### A. **Discount/Promotion Display**
- ❌ No visible discount badge/percentage on cards
- ❌ No strikethrough original price logic
- ❌ No promotion flags/badges
- ❌ **Impact:** Customers can't see if products are on sale
- **Action Required:** Add discount % badge and strikethrough price to product cards

#### B. **SKU/Product Code Visibility**
- ❌ Not shown on product cards
- ❌ Not visible in grid view
- ⚠️ **Likely on detail page but unclear**
- **Impact:** B2B customers need quick SKU reference without clicking
- **Action Required:** 
  - Confirm SKU visible on detail page
  - Consider adding small SKU text below product name on cards (optional for launch)

#### C. **Direct "Add to Cart" on Card**
- ❌ Cart button only on detail page
- ❌ Requires clicking product first
- ❌ No quick-add button on card
- **Impact:** Friction for bulk orders, slower checkout flow
- **Action Required:** 
  - Add "Quick Add to Cart" button on product card (hover state or fixed)
  - OR accept and document for beta (easier to iterate)

#### D. **Advanced Filtering**
- ❌ **No price range filter**
- ❌ **No brand/manufacturer filter**
- ❌ **No spec/compatibility filters**
- ❌ **No multi-select filters**
- **Impact:** Hard to narrow down large product sets
- **Action Required:** 
  - Build filter sidebar (lower priority for beta)
  - OR document limitation for beta

#### E. **Mobile Bottom CTA Clarity**
- ⚠️ `sticky-cta.tsx` exists but specifics unclear
- ❌ Unclear what action it performs
- **Action Required:** Verify sticky-cta implementation matches old site's bottom CTA

---

### **2. MEDIUM PRIORITY - Should Have for Full Feature Parity**

#### A. **Discount/Promo Logic**
- ❌ No BOGO, bulk discounts, or promotional flags
- ❌ No volume discount indication
- **Action Required:** Verify with backend if this data exists in product schema

#### B. **Traditional Pagination**
- ✅ Infinite scroll implemented (good UX)
- ❌ No page numbers option
- **Impact:** Can't jump to page 5 directly
- **Action Required:** Acceptable for modern UX; keep infinite scroll

#### C. **Price Ranges & Comparisons**
- ❌ No price range filter
- ❌ No "price low to high" sorting option (assumed in sort)
- **Action Required:** Verify sort options include price sorting

#### D. **Related Products on Detail Page**
- ✅ Component exists
- ⚠️ Loading logic unclear
- **Action Required:** Verify working and visible

#### E. **Customer Reviews/Ratings**
- ❌ **Not visible in code** (major gap if old site had them)
- **Action Required:** Verify if needed; not in current schema

#### F. **Stock Level Transparency**
- ✅ Status exists (IN_STOCK, LIMITED, OUT_OF_STOCK)
- ❌ No quantity shown (e.g., "Only 3 left")
- **Action Required:** Consider adding quantity display for LIMITED status

#### G. **Wish List / Save for Later**
- ❌ **No wishlist functionality**
- **Action Required:** Verify if old site had this; low priority for beta

---

### **3. NICE TO HAVE - Can Wait for v2**

#### A. **Product Comparison Tool**
- ❌ Can't compare multiple products side-by-side
- **Action Required:** Backlog for post-launch

#### B. **Advanced Search**
- ✅ Basic search exists
- ❌ No faceted search / filters in search results
- **Action Required:** Post-launch improvement

#### C. **Recently Viewed**
- ❌ No "recently viewed products" section
- **Action Required:** Post-launch

#### D. **Personalization**
- ❌ No "recommended for you"
- ❌ No saved preferences
- **Action Required:** Post-launch

---

## 📋 CUSTOMER FLOW ANALYSIS

### **Old Site Flow (Assumed)**
```
1. Land on shop.php
2. See categories in sidebar/nav
3. View product grid with:
   - Product image
   - Name
   - SKU/code
   - Price (with discount if applicable)
4. Click product for details
5. Add to cart from detail page
6. Mobile: bottom CTA for cart access
7. Proceed to checkout
```

### **New Site Flow (Current)**
```
1. Land on /shop
2. See trust box info
3. See category pills (top nav style)
4. See search + sort toolbar
5. View product grid with:
   - Product image (hover zoom)
   - Category badge
   - Name (2-line clamp)
   - Short description (2-line clamp)
   - Price
   - Inventory badge
6. Click product to /shop/[slug]
7. On detail page:
   - More images (lightbox)
   - Attributes table
   - GCC badges
   - Pricing panel
   - Inquiry CTA ("Ask before buying")
   - Stock indicator
   - Related products
8. Add to cart from detail page (likely)
9. Checkout flow
```

### **Key Differences**
| Element | Old Site | New Site | Gap? |
|---------|----------|----------|------|
| Categories | Sidebar/dropdown | Horizontal pills | ✅ Better |
| Search | Likely simple search | Full-page search with results | ✅ Better |
| Grid layout | ? | Responsive 2-4 col | ✅ Good |
| SKU visibility | On cards | Unknown (check detail) | ⚠️ Check |
| Discounts | Visible on card | Not visible | ❌ Missing |
| Quick add to cart | ? | Detail page only | ⚠️ Check |
| Mobile bottom CTA | Yes | Yes (sticky-cta.tsx) | ✅ Present |
| Trust section | ? | Yes (top of shop) | ✅ Added |
| Image lightbox | ? | Yes | ✅ Added |
| Sort options | ? | Yes | ✅ Added |
| Infinite scroll | No (pagination?) | Yes | ✅ Modern UX |

---

## 🎯 PRIORITY LIST FOR LAUNCH

### **🔴 CRITICAL (Block Launch Without)**
1. **[ ] Verify SKU display** - On product cards OR detail page (confirm location)
2. **[ ] Confirm discount logic** - Backend supports `discount%` or `originalPrice`
3. **[ ] Test checkout flow** - Add to cart → payment → success
4. **[ ] Verify sticky mobile CTA** - Is it for cart or something else?
5. **[ ] Test all category filters** - Ensure filter switching works
6. **[ ] Test search functionality** - Query parsing, result accuracy

### **🟡 HIGH (Nice to Have, Can Work Around)**
1. **[ ] Add discount badge to cards** - Show % off if applicable
2. **[ ] Show SKU on cards** - Add small text below product name (optional)
3. **[ ] Direct "Add to Cart" on cards** - Or accept detail-page-only for beta
4. **[ ] Add price range filter** - Sidebar or collapsible filter panel
5. **[ ] Verify inventory counts** - Show "Only 3 left" for LIMITED status
6. **[ ] Test related products** - Load and display on detail page

### **🟢 LOW (Post-Launch Improvements)**
1. **[ ] Add customer reviews** - If old site had them
2. **[ ] Wishlist/save for later** - Not critical for launch
3. **[ ] Product comparison** - Nice-to-have, not essential
4. **[ ] Advanced filters** - Brand, spec, compatibility filters
5. **[ ] Recently viewed** - Post-launch iteration

---

## 📊 CONTENT THAT CAN BE IMPROVED (Instead of Copied)

### **What to Enhance vs. Replicate**

| Feature | Old Site (Copy?) | New Site (Improve?) |
|---------|-----------------|-------------------|
| **Trust Box** | Generic text | ✅ Rewrite for new value props (Dubai fulfillment, payment options, compatibility help) |
| **Categories** | Dropdown menu | ✅ Better as horizontal pills; more discoverable |
| **Search** | Basic keyword | ✅ Add filters, facets, smart sorting |
| **Grid** | Fixed layout | ✅ Keep responsive 2-4 col; looks modern |
| **Images** | Static | ✅ Keep lightbox zoom; add more image variants |
| **Sorting** | Limited options | ✅ Expand: featured, price (↑/↓), newest, stock, rating |
| **Filters** | Sidebar dropdown | ✅ Modern collapsible panel or slide-in drawer |
| **Mobile** | Basic sticky | ✅ Enhanced sticky CTA with context-aware actions |
| **Social proof** | Reviews? | ✅ Add reviews + rating stars (if applicable) |

---

## 🚀 RECOMMENDATIONS

### **For Beta Launch (v1.0)**
- ✅ Keep current grid layout (responsive 2-4 col)
- ✅ Keep infinite scroll (better than pagination)
- ✅ Keep category pills (better UX than dropdown)
- ✅ Add discount badge to product cards
- ✅ Verify SKU display on detail page
- ✅ Confirm "Add to Cart" works on detail page
- ⚠️ Test mobile sticky CTA thoroughly

### **For v1.1 (Next Sprint)**
- Add "Show SKU on Cards" toggle/option
- Implement price range filter
- Add stock quantity display ("Only 3 left")
- Enhance sort options (price ↑/↓, newest, ratings)

### **For v1.2+ (Post-Launch)**
- Customer reviews and ratings
- Advanced filtering sidebar (brand, specs, compatibility)
- Wishlist/save for later
- Product comparison tool
- Recently viewed section

---

## ✋ QUESTIONS TO RESOLVE

1. **SKU Display:** Is SKU shown on product detail page? Where exactly?
2. **Discounts:** Does backend have `discount%`, `originalPrice`, or `promotionFlag` fields?
3. **Sticky CTA:** What's the exact action? (Cart access? Inquiry form? Something else?)
4. **Sort Options:** What are all available sort options in the dropdown?
5. **Inventory Counts:** Can we show exact quantity remaining, or just status?
6. **Quick Add:** Is there interest in "Add to Cart" button on cards, or detail-page-only is fine?
7. **Old Analytics:** Do you have metrics on how old site customers used categories/filters?

---

## 📁 FILES TO REVIEW

**New Site Components:**
- `/apps/web/src/components/catalog/product-card.tsx` - Card display
- `/apps/web/src/components/catalog/product-grid.tsx` - Grid layout
- `/apps/web/src/components/catalog/product-detail-content.tsx` - Detail page
- `/apps/web/src/components/catalog/sticky-cta.tsx` - Mobile CTA
- `/apps/web/src/components/catalog/price-display.tsx` - Price component
- `/apps/web/src/app/shop/page.tsx` - Shop landing
- `/apps/web/src/app/shop/[slug]/page.tsx` - Product detail page

**Backend Verification Needed:**
- Product schema (check for: `discount`, `originalPrice`, `sku`, `quantity`)
- API contract documentation
- Pricing calculation logic

---

**Report Generated:** May 25, 2026  
**Status:** Ready for team review  
**Next Steps:** Resolve questions and prioritize gap fixes before launch
