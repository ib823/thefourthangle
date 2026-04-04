# THE FOURTH ANGLE — UIUX AUDIT: SYNTHESIS & PIXEL-LEVEL INSPECTION

## PURPOSE

This is the final audit pass. You have access to the Chrome DevTools MCP. Your job is to go DEEP — not broad. This prompt covers:

1. **Pixel-level visual inspection** using DevTools
2. **Computed style verification** on every key element
3. **Cross-channel synthesis** (combining mobile + tablet + desktop findings)
4. **Prioritized action plan** for implementation

## WHO YOU ARE

Same Apple design persona. Steve Jobs holding the final prototype before launch. Every detail matters. You are looking for the things that separate "good" from "ships on day one at Apple."

## PHASE 1: PIXEL-LEVEL INSPECTION

Navigate to https://thefourthangle.pages.dev/ at 1440x900 (default working viewport).

For EACH of the following elements, use `evaluate_script` to extract computed styles and report exact values. Compare against Apple HIG and best practices.

### 1.1 Header Bar
```javascript
// Run via evaluate_script:
const header = document.querySelector('header, .site-header');
if (header) {
  const s = getComputedStyle(header);
  JSON.stringify({
    height: s.height,
    padding: s.padding,
    background: s.background,
    backdropFilter: s.backdropFilter,
    borderBottom: s.borderBottom,
    position: s.position,
    zIndex: s.zIndex,
    gap: s.gap
  });
}
```
**Evaluate:**
- Height: Is it 44-64px? (Apple standard: 44-52 for mobile, 52-64 for desktop)
- Background: Is the blur/transparency appropriate?
- Border: Too heavy? Too subtle? Apple uses ultra-thin hairlines or none.
- Padding: Consistent with the grid?

### 1.2 Card Components
```javascript
// Run for each card type:
const cards = document.querySelectorAll('[role="article"], .card, [class*="card"]');
const results = [];
for (const card of [...cards].slice(0, 3)) {
  const s = getComputedStyle(card);
  results.push({
    tag: card.tagName,
    className: card.className.slice(0, 50),
    padding: s.padding,
    borderRadius: s.borderRadius,
    boxShadow: s.boxShadow,
    background: s.background,
    border: s.border,
    marginBottom: s.marginBottom,
    width: s.width,
    cursor: s.cursor,
    transition: s.transition
  });
}
JSON.stringify(results);
```
**Evaluate for each card:**
- Border radius: Consistent across all card types? Apple uses 12-16px for cards.
- Shadow: Is it the right depth? Apple shadows are subtle (0 1-2px blur, 5-10% opacity).
- Padding: Is internal spacing generous but not wasteful? (16-20px for mobile, 20-24px for desktop)
- Hover state: Does `cursor: pointer` change? Is there a transform/shadow transition?
- Transition timing: 200-300ms ease-out is Apple's standard. Anything faster feels nervous, slower feels sluggish.

### 1.3 Typography Scale Verification
```javascript
const elements = [
  { label: 'h1/headline', el: document.querySelector('h1, .headline, [class*="headline"]') },
  { label: 'h2/section', el: document.querySelector('h2, .section-header, [class*="section"]') },
  { label: 'body text', el: document.querySelector('p, .context, [class*="context"]') },
  { label: 'small/caption', el: document.querySelector('.pill-label, [class*="micro"], [class*="xs"]') },
  { label: 'button', el: document.querySelector('button:not([aria-label="Close"])') },
  { label: 'score', el: document.querySelector('[class*="score"], [class*="metric"]') },
];
const results = [];
for (const { label, el } of elements) {
  if (!el) continue;
  const s = getComputedStyle(el);
  results.push({
    label,
    fontSize: s.fontSize,
    fontWeight: s.fontWeight,
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing,
    fontFamily: s.fontFamily.slice(0, 40),
    color: s.color
  });
}
JSON.stringify(results);
```
**Evaluate:**
- Is there a clear modular scale? (1.2x, 1.25x, or 1.333x ratio between sizes)
- Are weights used with discipline? (Regular body, Semibold UI, Bold headlines — max 3 weights)
- Line heights: 1.4-1.6 for body, 1.1-1.3 for headlines
- Letter spacing: Headlines slightly tighter (-0.01 to -0.02em), body neutral, small caps looser (+0.05em)
- Font loading: Check if fonts render immediately or flash

### 1.4 Color Palette Extraction
```javascript
const root = getComputedStyle(document.documentElement);
const tokens = [
  '--bg', '--bg-elevated', '--bg-sunken',
  '--text-primary', '--text-secondary', '--text-tertiary', '--text-muted',
  '--amber', '--amber-light',
  '--score-strong', '--score-medium', '--score-partial', '--score-critical',
  '--border', '--border-subtle', '--border-divider',
  '--card-hook-color', '--card-fact-color', '--card-reframe-color', '--card-view-color',
];
const result = {};
for (const t of tokens) result[t] = root.getPropertyValue(t).trim();
JSON.stringify(result);
```
**Evaluate:**
- Are ALL score colors distinguishable for color-blind users? (Check with deuteranopia simulation)
- Is the contrast ratio ≥ 4.5:1 for body text? ≥ 3:1 for large text? (WCAG AA)
- Does the amber brand color work against both light and dark backgrounds?
- Is there visual harmony? (Run the 60-30-10 rule: 60% dominant, 30% secondary, 10% accent)
- Are card type colors immediately distinguishable? Hook (grey) vs Fact (blue) vs Reframe (amber) vs View (purple)

### 1.5 Spacing & Alignment Audit
```javascript
// Check consistent spacing values used across the page
const allElements = document.querySelectorAll('*');
const paddings = new Set();
const margins = new Set();
const gaps = new Set();
for (const el of allElements) {
  const s = getComputedStyle(el);
  if (s.padding && s.padding !== '0px') paddings.add(s.padding);
  if (s.gap && s.gap !== 'normal') gaps.add(s.gap);
}
JSON.stringify({
  uniquePaddings: [...paddings].slice(0, 20),
  uniqueGaps: [...gaps].slice(0, 20),
});
```
**Evaluate:**
- Do spacing values follow a consistent scale? (4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- Are there rogue values? (13px, 17px, 22px — signs of ad-hoc tweaking)
- Is vertical rhythm maintained? (Consistent spacing between sections)
- Are elements aligned to an invisible grid?

### 1.6 Touch Target Measurement
```javascript
const buttons = document.querySelectorAll('button, a, [role="button"], [tabindex="0"]');
const undersized = [];
for (const btn of buttons) {
  const rect = btn.getBoundingClientRect();
  if (rect.width < 44 || rect.height < 44) {
    undersized.push({
      tag: btn.tagName,
      text: (btn.textContent || '').trim().slice(0, 30),
      ariaLabel: btn.getAttribute('aria-label') || '',
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      class: (btn.className || '').toString().slice(0, 40)
    });
  }
}
JSON.stringify({ total: buttons.length, undersized: undersized.length, details: undersized.slice(0, 15) });
```
**Evaluate:**
- ANY element under 44x44px is a failure (except inline text links)
- Check spacing between adjacent targets (minimum 8px)
- Report exact elements that fail

### 1.7 Animation & Transition Audit
```javascript
const allEls = document.querySelectorAll('*');
const transitions = [];
const animations = [];
for (const el of allEls) {
  const s = getComputedStyle(el);
  if (s.transition && s.transition !== 'all 0s ease 0s' && s.transition !== 'none') {
    transitions.push({
      class: (el.className || '').toString().slice(0, 40),
      transition: s.transition.slice(0, 100)
    });
  }
  if (s.animationName && s.animationName !== 'none') {
    animations.push({
      class: (el.className || '').toString().slice(0, 40),
      animation: s.animationName,
      duration: s.animationDuration
    });
  }
}
JSON.stringify({ transitionCount: transitions.length, transitions: transitions.slice(0, 15), animations: animations.slice(0, 10) });
```
**Evaluate:**
- Are all transitions between 150-350ms? (Apple standard range)
- Is the easing function consistent? (ease-out for exits, ease-in-out for continuous, spring for interactive)
- Are there too many simultaneous animations? (More than 3 on screen = visual noise)
- Do animations respect reduced-motion preference?

## PHASE 2: DARK MODE INSPECTION

```
1. evaluate_script: window.matchMedia('(prefers-color-scheme: dark)').matches
2. If false, use evaluate_script to force dark mode:
   document.documentElement.style.colorScheme = 'dark';
   // OR toggle the media query via Chrome DevTools emulation
3. take_screenshot
4. Repeat key inspections from Phase 1 (colors, contrast, shadows)
```

**Dark mode specific checks:**
- Are ALL text colors readable against dark backgrounds? (Common failure: grey-on-dark-grey)
- Do images have dark mode treatment? (White line art on dark bg should be fine, but check)
- Are shadows adjusted for dark mode? (Should be darker/more diffuse, not the same as light mode)
- Card borders — visible enough in dark mode?
- Score colors — still distinguishable in dark mode?

## PHASE 3: PERFORMANCE DEEP DIVE

### 3.1 Lighthouse Audit
```
Run lighthouse_audit with categories: performance, accessibility, best-practices, seo
```
Record ALL scores and specific failures.

### 3.2 Network Analysis
```
1. navigate to the homepage (fresh load)
2. list_network_requests
```
**Evaluate:**
- Total page weight (target: < 500KB initial load for mobile)
- Number of requests (target: < 30 for initial load)
- Largest assets — are images optimized? WebP/AVIF used?
- Font loading — how many font files? Total font weight?
- JavaScript bundle — one chunk or multiple? Total size?
- CSS — inlined or external? Critical CSS?

### 3.3 Console Errors
```
list_console_messages
```
- ANY error is unacceptable for a production app
- Warnings should be reviewed
- Deprecation notices flagged

### 3.4 Core Web Vitals (via evaluate_script)
```javascript
// Check CWV
new Promise(resolve => {
  const results = {};
  new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'largest-contentful-paint') results.LCP = entry.startTime;
    }
  }).observe({ type: 'largest-contentful-paint', buffered: true });

  new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      results.CLS = (results.CLS || 0) + entry.value;
    }
  }).observe({ type: 'layout-shift', buffered: true });

  setTimeout(() => resolve(JSON.stringify(results)), 3000);
});
```
**Targets:**
- LCP: < 2.5s (Good), < 4s (Needs Improvement)
- CLS: < 0.1 (Good), < 0.25 (Needs Improvement)
- INP: < 200ms (Good) — test by clicking elements

## PHASE 4: ACCESSIBILITY DEEP DIVE

### 4.1 ARIA & Semantic HTML
```javascript
// Check all ARIA usage
const ariaEls = document.querySelectorAll('[role], [aria-label], [aria-expanded], [aria-hidden]');
const issues = [];
for (const el of ariaEls) {
  // Check for common ARIA mistakes
  if (el.getAttribute('role') === 'button' && el.tagName !== 'DIV' && el.tagName !== 'SPAN') {
    // button role on a button tag is redundant
    if (el.tagName === 'BUTTON') issues.push({ issue: 'redundant role=button on <button>', el: el.outerHTML.slice(0, 80) });
  }
  if (el.getAttribute('aria-hidden') === 'true' && el.tabIndex >= 0) {
    issues.push({ issue: 'aria-hidden but focusable', el: el.outerHTML.slice(0, 80) });
  }
}
JSON.stringify({ totalAria: ariaEls.length, issues: issues.slice(0, 10) });
```

### 4.2 Heading Hierarchy
```javascript
const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
const hierarchy = [...headings].map(h => ({
  level: h.tagName,
  text: h.textContent.trim().slice(0, 50),
  visible: getComputedStyle(h).display !== 'none'
}));
JSON.stringify(hierarchy);
```
**Check:** Is the heading order sequential? (h1 → h2 → h3, no skips)

### 4.3 Focus Order Test
Tab through the entire page using `press_key` with Tab. Document the focus order. Are there focus traps? Skipped elements? Invisible focused elements?

## PHASE 5: CROSS-CHANNEL SYNTHESIS

Based on your inspection and any previous mobile/tablet/desktop audit findings, synthesize:

## OUTPUT FORMAT

```
# SYNTHESIS & PIXEL-LEVEL AUDIT — The Fourth Angle

## Pixel-Level Findings

### Typography Scale
| Element | Current | Recommended | Ratio Issue |
|---------|---------|-------------|-------------|
| Headline | Xpx / weight | Xpx / weight | ... |
| ... | ... | ... | ... |

### Color Audit
| Token | Value | Contrast Ratio | WCAG | Issue |
|-------|-------|---------------|------|-------|
| text-primary on bg | #212529 on #FFFFFF | X:1 | Pass/Fail | ... |
| ... | ... | ... | ... | ... |

### Spacing Consistency
| Pattern Found | Occurrences | On-Grid? | Issue |
|--------------|-------------|----------|-------|
| padding: 18px | 5 | No (use 16 or 20) | Off-grid |
| ... | ... | ... | ... |

### Touch Target Failures
| Element | Size | Required | Fix |
|---------|------|----------|-----|
| ... | WxH | 44x44 | ... |

### Animation Inventory
| Element | Duration | Easing | Apple Standard? |
|---------|----------|--------|----------------|
| ... | ... | ... | ... |

## Dark Mode Assessment
[Screenshot + specific issues found]

## Performance Report
| Metric | Score | Target | Status |
|--------|-------|--------|--------|
| Lighthouse Performance | X | 90+ | ... |
| LCP | Xs | <2.5s | ... |
| CLS | X | <0.1 | ... |
| Total Page Weight | XKB | <500KB | ... |
| ... | ... | ... | ... |

## Accessibility Report
| Category | Score | Issues |
|----------|-------|--------|
| ARIA correctness | X/10 | ... |
| Heading hierarchy | X/10 | ... |
| Focus management | X/10 | ... |
| Color contrast | X/10 | ... |
| Screen reader | X/10 | ... |

## PRIORITIZED ACTION PLAN

### P0 — Ship Blockers (fix before any release)
1. [Issue] — [File/component] — [Exact fix] — [Impact]

### P1 — Critical UX (fix this sprint)
1. [Issue] — [File/component] — [Exact fix] — [Impact]

### P2 — Quality Polish (fix this month)
1. [Issue] — [File/component] — [Exact fix] — [Impact]

### P3 — Delighters (roadmap)
1. [Feature/enhancement] — [Why it matters] — [Effort estimate]

## REVOLUTIONARY RECOMMENDATION
[One bold, potentially controversial recommendation that could fundamentally improve the product. Think "the iPhone moment" — what would make people say "I've never seen a news app do THIS"?]

## DESIGN SYSTEM GAPS
[What's missing from the current token/component system that a mature Apple-quality product would have?]
```

## FINAL INSTRUCTION

This is the synthesis. Be precise. Every recommendation must include: what to change, where in the code, what value to use, and why. Vague feedback is worthless. A developer should be able to take this report and implement every fix without asking a single clarifying question. That is the standard.
