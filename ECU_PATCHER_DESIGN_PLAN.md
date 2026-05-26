# ECU Patcher 2.0 — UX/Frontend Implementation Plan

**Status:** Design & Frontend Components  
**Scope:** UX, layout, flow, mobile, trust messaging — frontend only  
**Backend:** No changes to Prisma, workers, Docker, parser logic

---

## 1. DESIGN PHILOSOPHY

### Core Principles
- **Clarity:** Workshop/dealer can understand in 10 seconds
- **Trust:** Visible privacy, no upload language, verified source references
- **Confidence:** File requirements, warnings, checksum guidance — no AI fluff
- **Mobile-native:** Desktop-first, but flawless on tablet/phone
- **Professional:** Dark automotive engineering tone, monospace logs, precise UI language

### Visual System
- **Primary palette:**
  - Dark base: `#0F1419` (navy black)
  - Cards/secondary: `#151B24` (slightly lighter)
  - Accent: `#FF8A34` (warm orange — energetic but not aggressive)
  - Success: `#20C65E` (vehicle-green)
  - Warning: `#FFB842` (diagnostic amber)
  - Danger: `#FF5757` (error red)
  
- **Typography:**
  - Display: Inter 700-900 (headings, buttons)
  - Body: Inter 400-600 (copy, labels)
  - Mono: JetBrains Mono 400 (logs, file info, hex offsets)
  
- **Spacing:** 8px grid system (16, 24, 32, 40px)
- **Border radius:** 8px standard, 12px large containers
- **Shadows:** Subtle elevation (0 1px 3px rgba(0,0,0,0.2))

---

## 2. PAGE STRUCTURE & FLOW

### 2.1 Entry Points
1. **Hero Section** (unauthenticated)
   - Why ECU Patcher (privacy, local, trusted)
   - Supported vehicles (Boxer, Jumper, Relay, Ducato)
   - Trust badges (no server upload, offline processing)
   - CTA: "Start Patching" → login/tool

2. **Access Gate** (authenticated, not approved)
   - Price & features (clear, no marketing speak)
   - Request flow (4 steps: request → pay → WhatsApp proof → approve)
   - WhatsApp prominence (payment workflow)
   - Status states: pending, rejected, new request

3. **Patcher Interface** (approved)
   - Module selector (sidebar or horizontal tabs on mobile)
   - Upload panel (drag/drop first, then browse fallback)
   - Options & warnings
   - Status indicators
   - Result download

4. **Account/History** (if implemented)
   - Past jobs
   - File hashes (for re-verification)
   - WhatsApp contact quick-link

---

## 3. COMPONENT ARCHITECTURE

### 3.1 Main Layout
```
┌─────────────────────────────────────────────────┐
│ Header (sticky on desktop, normal on mobile)     │
├──────────────┬──────────────────────────────────┤
│ Module Tabs  │                                  │
│ (Sidebar on  │  Upload Panel                    │
│  desktop,    │  ├─ File input (drag/drop)      │
│  horizontal  │  ├─ Options                      │
│  on mobile)  │  ├─ Requirements                │
│              │  └─ Controls                    │
├──────────────┼──────────────────────────────────┤
│              │  Status/Progress                 │
│              │  ├─ Progress bar                │
│              │  ├─ Live log                    │
│              │  └─ Download button             │
│              │                                  │
└──────────────┴──────────────────────────────────┘
```

**Breakpoints:**
- Desktop: 1024px+ (sidebar + main, full logs)
- Tablet: 768-1023px (stacked but readable)
- Mobile: <768px (vertical stack, collapsible logs)

---

## 4. DETAILED SCREENS

### 4.1 UPLOAD PANEL

**Elements:**
1. **File Input (Drag & Drop)**
   - Large drop zone (160px height on desktop, 120px mobile)
   - Background: `#1A2332` with dashed border
   - Hover: accent border, slight background lift
   - Text: "Drop .bin/.ori/.hex here — or click to browse"
   - Icon: upload arrow (Feather or similar)

2. **File Requirements Card**
   - Visible before upload (always visible on desktop)
   - Collapsible on mobile
   - Contents:
     ```
     Module: PSA DCM7.1b DPF-Off
     Expected Size: 6,291,456 bytes
     File Format: .bin, .ori, .hex
     Processing: 100% local (no upload)
     ✓ Your file never leaves your browser
     ```
   - Subtle info icon with hover tooltip for technical details

3. **Selected File Display**
   - After selection: filename + size + verified/unverified badge
   - Show checksum (CRC32) for re-identification
   - "Change file" button (link style)

4. **Options Section**
   - Checkbox group:
     - DPF module: "Fix checksum after patching (Viezu verified)" [checked]
     - EGR module: Info banner (no checksum available)
     - SID208: Info banner + expected size
   - Hint text: small gray, technical clarity
   - Warnings: yellow banner if risky option selected

5. **Action Buttons**
   - Primary: "Verify File" (blue, initiates verification)
   - Secondary: "Apply [Module Name]" (orange, applies patches)
   - After result: "Download Patched File" (green, prominent)
   - Disabled state: 50% opacity, cursor-not-allowed

---

### 4.2 MODULE SELECTOR

**Desktop Sidebar** (220px width, fixed or sticky)
- Header: CaracalTech logo + "ECU Suite" title
- Module list:
  ```
  DCM7.1b
  ├─ DPF-Off (276 patches)
  ├─ EGR-Off (75 patches)
  
  SID208
  ├─ DPF+EGR Off (79 patches)
  
  Universal
  ├─ DTC Remover
  
  Coming Soon (grayed)
  ├─ Stage 1 Power
  └─ EDC17 Support
  ```
- Active indicator: left border + accent background
- Icons: dot or small icon per module type
- Footer: WhatsApp link ("Need help?")

**Mobile Horizontal Tabs** (full-width, scrollable)
- Compact: "DPF-Off | EGR-Off | SID208 | DTC Remover"
- Underline indicator
- Scroll on overflow

---

### 4.3 STATUS & PROGRESS

**Live Log Display**
- Monospace font (JetBrains Mono 12px)
- Dark background (`#0A0F18`)
- Syntax: timestamps (gray), headers (bold), success (green), warnings (amber), errors (red)
- Example:
  ```
  [14:32:45] Loading: boxer_dcm7_stock.bin
    Size: 6,291,456 bytes ✓
    Patches: 276 total
      Ready to apply: 276
  Processing…
  [14:32:46] Applying DPF-Off patch set…
  [14:32:47] ✓ Applied 276/276 patches
  [14:32:48] ✓ Checksum: 0xFACF5B2A (Viezu verified)
  Done. Ready to download.
  ```
- Height: 200px minimum, expand to fill on desktop
- Scroll: auto, auto-scroll to bottom on new lines

**Progress Bar**
- Thin (3-4px) bar above log
- Colored: orange (processing) → green (done) → red (error)
- Shows percentage (0-100%)
- Optional: estimated time remaining

**Status Dot**
- Indicator in header/footer:
  - Gray: idle
  - Orange (pulsing): processing
  - Green: complete
  - Red: error

---

### 4.4 DTC MODULE (Special)

**Two-Stage Interface:**

**Stage 1: Scan**
- Single "Scan File" button
- Status: "Load a file and click Scan…"
- Process: heuristic stride-2 scan
- Output: number of regions found, total entries, active entries

**Stage 2: Interactive Table**
- Collapsible table per region (region header clickable)
- Columns: Offset | Label | Severity | Toggle
- Severity badge colors (disabled=gray, info=blue, warning=amber, error=red)
- Toggle button (OFF ↔ ACTIVE)
- Bulk controls: "All Off" | "All On" | "Apply Changes"
- After Apply: Download button appears
- Log updates with change count

**Trust Message:**
- Small text: "DTC entries are detected heuristically. Always verify changes before flashing to vehicle."

---

### 4.5 ACCESS GATE (Redesigned)

**When User Not Approved:**

**Left Column: Value**
- Price: "1,200 AED" (large, bold, orange)
- Subtext: "One-time account lifetime access"
- Features list:
  ```
  ✓ DPF Delete (DCM7.1b, 276 patches)
  ✓ EGR Delete (DCM7.1b, 75 patches)
  ✓ DPF + EGR Delete (SID208, 79 patches)
  ✓ DTC Fault Code Remover (universal)
  ✓ All future modules included
  ✓ 100% private — no upload, offline processing
  ```

**Right Column: Action**

*If not logged in:*
- "Sign In to Request Access" button (large, orange)
- "No account? Register here" link

*If pending:*
- Status box (amber border, border-left: orange)
  ```
  ⏱ Awaiting Confirmation
  Your request is queued. Transfer 1,200 AED and send
  proof via WhatsApp. Usually approved within a few hours.
  ```
- "Send Payment on WhatsApp" button (prominent, green WhatsApp color)

*If rejected:*
- Status box (red border)
  ```
  ✗ Request Not Approved
  Contact us via WhatsApp for details or to retry.
  ```
- "Contact Support" button

*If logged in, no request:*
- 4-step process flow (numbered, small)
- Request form (optional notes textarea)
- "Request Access — 1,200 AED" button

---

### 4.6 ACCOUNT HISTORY (Future/Optional)

*If implemented (not in MVP):*
- Quick access dropdown in header
- Shows last 5 jobs: filename | date | module | status
- Click to re-download or view details
- "View all jobs" → dedicated page

---

## 5. TRUST & SAFETY MESSAGING

### Placement Strategy
1. **Hero section** (before login)
   - "Your file never leaves your browser"
   - "100% local processing"
   - Three trust cards: privacy, offline, no logging

2. **Upload panel**
   - File requirement card always visible
   - Processing note: "100% local processing in your browser"
   - No server upload language

3. **Warnings**
   - Before applying: info banner
   - For EGR/SID208: "No verified checksum — fix in WinOLS after"
   - For DTC: "Verify changes before flashing"

4. **Footer**
   - Single line: "CaracalTech ECU Suite v1.0 | Open source patcher"
   - No fake guarantees or AI language

---

## 6. MOBILE USABILITY

### Key Changes for <768px
1. **Layout:** Stack vertically (module selector → upload → log)
2. **Module selector:** Horizontal scrollable tabs instead of sidebar
3. **File input:** Touch-friendly (larger drop zone: 100px)
4. **Buttons:** Full-width at mobile size, stacked below input
5. **Log:** Collapsible initially (tap to expand), fixed height when expanded
6. **DTC table:** Single-column on mobile (offset + label on first row, severity + toggle on second)
7. **File size:** Show in readable format (2.5 MB not 2,600,000 bytes)

---

## 7. COMPONENT CHECKLIST

### Pages
- [ ] Hero section (public)
- [ ] Access gate (private, various states)
- [ ] Patcher interface (approved users)
- [ ] Account history page (optional)

### Modular Components
- [ ] Upload panel (drag/drop + browse)
- [ ] File requirements card
- [ ] Module selector (sidebar desktop, tabs mobile)
- [ ] Options section (checkboxes + info)
- [ ] Status bar (dot + text)
- [ ] Progress bar
- [ ] Live log viewer (monospace, syntax)
- [ ] DTC interactive table
- [ ] Action buttons (verify, apply, download)
- [ ] Access gate form
- [ ] Trust message boxes
- [ ] Error fallback panel

### Utilities
- [ ] File drag-drop handler
- [ ] Size formatter (bytes → MB/GB)
- [ ] Timestamp formatter
- [ ] Log coloring system
- [ ] Module metadata (sizes, patch counts, checksums)
- [ ] Responsive breakpoint system

---

## 8. MIGRATION PATH FROM LEGACY

### What Stays
- All JavaScript patch logic (DCM71B_DPF, DCM71B_EGR, SID208_ALL arrays)
- All function signatures (ptVerify, ptApply, ptDownload, ptDtcScan, etc.)
- Backend: access gate DB logic, WhatsApp integration
- File processing: 100% local, no server changes

### What Changes
- HTML/CSS: New responsive layout system
- Component structure: Modular React components (or vanilla JS)
- Mobile: Proper viewport handling
- Trust messaging: New blocks, repositioned
- Styling: New design tokens, consistent spacing

### Integration Points
1. Existing PHP access gate logic → wraps React component
2. Patch data arrays → imported as modules
3. Event handlers → adapt to new DOM structure
4. CSRF tokens → preserved from legacy system
5. WhatsApp links → update URLs if needed

---

## 9. FRONTEND STACK RECOMMENDATION

### Option A: React (Recommended for scalability)
- Component library: React 18+
- Styling: CSS Modules or TailwindCSS (with custom dark config)
- State: React hooks (useState, useEffect)
- Build: Vite or Next.js
- Bundle size: ~50-70KB gzipped (reasonable)

### Option B: Vanilla JS + Web Components
- No build step needed
- ~5-10KB extra code
- Simpler to integrate with existing PHP
- Maintenance: harder for team growth

### Option C: Preact (lightweight React)
- 3KB alternative to React
- Drop-in compatible with React hooks
- Better for bandwidth-constrained users
- Good middle ground

**Recommendation:** React with Vite for optimal DX + UX

---

## 10. RESPONSIVE GRID BREAKPOINTS

```css
/* Base: mobile-first */
body { font-size: 14px; }
.patcher-layout { flex-direction: column; }

/* Tablet 768px+ */
@media (min-width: 768px) {
  body { font-size: 15px; }
  .patcher-layout { flex-direction: row; }
  .module-selector { width: 240px; }
}

/* Desktop 1024px+ */
@media (min-width: 1024px) {
  body { font-size: 16px; }
  .module-selector { width: 280px; sticky top: 80px; }
  .log { min-height: 300px; }
}

/* Large 1400px+ */
@media (min-width: 1400px) {
  .container { max-width: 1280px; margin: 0 auto; }
}
```

---

## 11. ACCESSIBILITY

- WCAG 2.1 AA minimum
- Color contrast: 4.5:1 for text (orange/white OK, warn amber/white needs 5:1+)
- Focus indicators: 2px solid accent on all interactive elements
- Keyboard navigation: Tab through modules → upload → buttons
- Screen reader: Semantic HTML (form, fieldset, legend, button, input)
- Labels: Explicit for all inputs
- Errors: Color + text (not color-only)
- Prefers reduced motion: Pulse animation disabled

---

## 12. PERFORMANCE TARGET

- First paint: <1s on 4G
- Interactive: <2s
- Page load: <3s (no large images, pure CSS for patterns)
- Patch apply: <5s for 6MB file (depends on JS engine, local)
- Download: browser-native (instant)

---

## 13. NEXT STEPS

1. **Frontend prototype** (React components, mobile-first CSS)
2. **Integration layer** (PHP + React or vanilla JS)
3. **QA**: patch apply on real binaries, cross-browser testing
4. **Mobile testing** (iOS Safari, Android Chrome, landscape)
5. **Accessibility audit** (axe-core, screen reader)
6. **Performance audit** (Lighthouse)
7. **Launch with feature parity** to legacy, then iterate

---

**Created:** 2026-05-25  
**Designer Lead:** CaracalTech UX  
**Owner:** Engineering  
**Status:** Ready for component development
