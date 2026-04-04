# THE FOURTH ANGLE — UIUX AUDIT: DESKTOP (Standard & Ultrawide)

## WHO YOU ARE

You are a senior product designer who trained under Steve Jobs and Jony Ive at Apple. Zero compromise on every pixel. Refer to the Mobile audit prompt for the full persona and cultural context brief.

## THE PRODUCT

**The Fourth Angle** — non-partisan Malaysian issues analysis platform. 6-card insight format, 6 editorial review stages, measurable bias scores.

**Desktop usage context:**

1. **Office worker alt-tab reader** — Government servant, journalist, or corporate worker. Windows laptop (1366x768 — still the most common resolution in MY/SG). Reads during breaks between tasks. Wants to scan quickly, read one issue, close tab. Chrome or Edge browser.

2. **Researcher / deep analyst** — Journalist, academic, policy wonk. MacBook Pro (1440x900) or external monitor (1920x1080). Wants to cross-reference issues, check methodology, verify sources. Will use the Fact Graph. Might keep the tab open all day.

3. **Social sharer at desk** — Discovered via WhatsApp Web or Twitter/X link. Opens in browser, reads one issue, shares. First-time visitor. Needs to understand the product within 10 seconds or leaves.

4. **Large monitor enthusiast** — 2560x1440 or ultrawide. The design must not break at these sizes. Content should NOT stretch to fill — max-width containers are essential.

## SETUP INSTRUCTIONS

### Phase 1: Common Laptop (1366x768 — most common in Malaysia)
```
1. resize_page to 1366x768
2. navigate to https://thefourthangle.pages.dev/
3. take_screenshot
```

### Phase 2: MacBook (1440x900)
```
1. resize_page to 1440x900
2. navigate to https://thefourthangle.pages.dev/
3. take_screenshot
```

### Phase 3: Full HD (1920x1080)
```
1. resize_page to 1920x1080
2. navigate to https://thefourthangle.pages.dev/
3. take_screenshot
```

### Phase 4: QHD (2560x1440)
```
1. resize_page to 2560x1440
2. navigate to https://thefourthangle.pages.dev/
3. take_screenshot
```

## PAGES TO AUDIT (for EACH viewport)

### Page 1: Today View (/)
- Desktop layout: sidebar + feed? Full-width grid? Columns?
- How does the brand header adapt to desktop width?
- Is there a persistent sidebar or top navigation?
- Card grid — column count, card sizing, density
- Above-the-fold content — what does the user see without scrolling?
- Lead issue treatment — hero card or same as others?

### Page 2: Issue Reader
- Does it use a sidebar/panel reader (desktop standard) or full-screen overlay?
- If sidebar: is the feed still visible alongside?
- If overlay: does it feel appropriate for desktop or like a mobile modal?
- Card content — typography, reading width, whitespace
- Score display — more detailed than mobile?
- Related issues — visible within reader?
- Keyboard navigation (arrow keys, Escape to close)

### Page 3: Share Modal
- Center modal with backdrop? Size proportional to viewport?
- Platform buttons layout
- Preview card quality

### Page 4: Library Views
- Grid vs list layout
- Filter/sort controls placement
- Multi-column cards

### Page 5: Search
- Search results with keyboard navigation
- Result density and preview quality

### Page 6: About & Disclaimer
- Reading column width (must be 60-75ch max — NOT full width)
- Navigation consistency

### Page 7: 404 Page

### Page 8: Hover States & Micro-interactions
- Hover over every card, button, link — document all hover states
- Are hover states consistent? (Color change? Scale? Shadow lift? Underline?)
- Do hover states communicate "clickable" clearly?
- Cursor changes (pointer on clickable elements)

## PIXEL-LEVEL INSPECTION (run at EACH viewport)

Use `evaluate_script` to measure every element. Do NOT rely on visual estimation.

### Inspect All Hover States
```javascript
// Inventory of all elements with transition properties (indicating hover states exist)
const els = document.querySelectorAll('*');
const hoverable = [];
for (const el of els) {
  const s = getComputedStyle(el);
  if (s.transition && s.transition !== 'all 0s ease 0s' && s.transition !== 'none' && s.cursor === 'pointer') {
    hoverable.push({
      tag: el.tagName, class: (el.className||'').toString().slice(0,40),
      transition: s.transition.slice(0,80),
      cursor: s.cursor
    });
  }
}
JSON.stringify({ count: hoverable.length, elements: hoverable.slice(0, 20) });
```

### Inspect Content Width & Grid
```javascript
const containers = document.querySelectorAll('main, [class*="shell"], [class*="feed"], [class*="grid"], [class*="sidebar"], [class*="reader"]');
const report = [];
for (const c of containers) {
  const s = getComputedStyle(c);
  const r = c.getBoundingClientRect();
  report.push({
    tag: c.tagName, class: (c.className||'').toString().slice(0,40),
    width: Math.round(r.width), display: s.display,
    gridTemplateColumns: s.gridTemplateColumns || '',
    maxWidth: s.maxWidth, padding: s.padding, gap: s.gap
  });
}
JSON.stringify(report.slice(0, 15));
```
**Check:** Content max-width should be 1200-1400px. Full-width content on a 2560px monitor is unreadable.

### Inspect Reading Column Width
```javascript
const textBlocks = document.querySelectorAll('p, .context, .headline, h1, h2');
const report = [];
for (const el of [...textBlocks].slice(0, 8)) {
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  const charsPerLine = Math.round(r.width / (parseFloat(s.fontSize) * 0.55));
  report.push({
    tag: el.tagName, width: Math.round(r.width), fontSize: s.fontSize,
    charsPerLine, maxWidth: s.maxWidth
  });
}
JSON.stringify(report);
```

### Inspect All Buttons, Links & Interactive Elements
```javascript
const els = document.querySelectorAll('button, a, [role="button"], [tabindex="0"]');
const report = [];
for (const el of els) {
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  if (r.width > 0) report.push({
    text: (el.textContent||'').trim().slice(0,25),
    aria: el.getAttribute('aria-label')||'',
    w: Math.round(r.width), h: Math.round(r.height),
    padding: s.padding, borderRadius: s.borderRadius,
    fontSize: s.fontSize, color: s.color, bg: s.backgroundColor,
    cursor: s.cursor, boxShadow: s.boxShadow.slice(0,50)
  });
}
JSON.stringify(report.slice(0, 25));
```

### Inspect Shadow & Elevation System
```javascript
const allEls = document.querySelectorAll('*');
const shadows = new Map();
for (const el of allEls) {
  const s = getComputedStyle(el).boxShadow;
  if (s && s !== 'none') {
    const key = s.slice(0, 80);
    shadows.set(key, (shadows.get(key) || 0) + 1);
  }
}
JSON.stringify([...shadows.entries()].sort((a,b) => b[1]-a[1]).slice(0, 10));
```
**Check:** Should have 3-4 distinct shadow levels used consistently. Random shadows = visual noise.

For EVERY finding, report **exact values** and specific recommendations.

## DESKTOP-SPECIFIC EVALUATION CRITERIA

### A. LAYOUT & GRID SYSTEM
- Is there a visible grid system? (12-column, content-width constrained?)
- Max content width — does the design have a sensible maximum? (1200-1400px typical)
- Sidebar navigation vs top navigation choice
- Content density appropriate for mouse-driven interaction
- Does the layout use desktop space for *more information* or just *more whitespace*?

### B. TYPOGRAPHY AT DESKTOP SCALE
- Reading column width (50-75 characters per line — CRITICAL for readability)
- Headline sizing — impactful without shouting
- Body text at comfortable reading distance (arm's length from monitor)
- Code/data display — monospace for scores and statistics?

### C. MOUSE & KEYBOARD INTERACTION
- Every clickable element has a cursor:pointer
- Hover states on ALL interactive elements
- Focus-visible outlines for keyboard navigation (Tab through the page)
- Keyboard shortcuts (if any — should have Escape to close modals, arrow keys in reader)
- Right-click behavior (standard, no interference)
- Text selection works naturally

### D. VISUAL REFINEMENT AT HIGH RESOLUTION
- Do shadows look refined or blobby at high DPI?
- Are images sharp at 2x pixel density?
- Do thin borders (1px) render crisply?
- Gradient quality — no banding?
- Icon sharpness (SVG preferred)

### E. PERFORMANCE AT DESKTOP SCALE
- Run `lighthouse_audit`
- Check `list_network_requests` — any unnecessary mobile-only assets loaded?
- JavaScript bundle size appropriate?
- Initial render speed
- Scroll performance (smooth 60fps?)

### F. PROFESSIONAL APPEARANCE
- Does this look like a product a journalist or civil servant would trust?
- Is it visually on par with The Economist, Reuters, or CNA? (Not copying — matching quality tier)
- Would a policy researcher bookmark this?
- Does it look credible in a work context? (Not too playful, not too sterile)

## OUTPUT FORMAT

```
# DESKTOP AUDIT REPORT — The Fourth Angle

## Executive Summary
[3-5 sentences]

## Viewport: [size]

### Page: [name]
**Screenshot observations:**
[Specific pixel-level observations]

**Scores:**
| Criterion | Score (1-10) | Observation |
|-----------|-------------|-------------|
| Layout & Grid | X | ... |
| Typography | X | ... |
| Mouse & Keyboard | X | ... |
| Visual Refinement | X | ... |
| Performance | X | ... |
| Professional Appearance | X | ... |

**Critical Issues:** [...]
**Improvements:** [...]
**Desktop-Specific Opportunities:** [...]

## Hover State Inventory
[Document every hover state found — consistent/inconsistent, present/missing]

## Keyboard Navigation Map
[Tab order, focus management, shortcuts]

## Lighthouse Report
[Key metrics]

## Competitive Positioning
[How does this compare visually to: The Economist, CNA, Malaysiakini, SCMP?]

## The One Thing
[Single most impactful desktop improvement]
```

## FINAL INSTRUCTION

Desktop is where credibility is established. A Malaysian professional opening this on their office laptop needs to feel that this is a serious, trustworthy product within 3 seconds. The design must communicate: "This was made by people who care deeply about quality." Evaluate every element against that standard.
