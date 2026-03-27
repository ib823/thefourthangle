# Final Regression Audit

## Regressions Checked

| Area | Checked | Method |
|------|---------|--------|
| Spring card swipe (InsightReader) | Yes | Code path analysis — velocity, commit, rubber band, spring entry/exit |
| Vertical dismiss | Yes | Code + velocity-based commit added |
| Gesture disambiguation | Yes | Ambiguous-twice → cancel (was: dismiss) — fixed |
| MobileBrowser feed swipe | Yes | Code path analysis — no changes, no regression |
| ShareModal focus trap | Yes | Code path analysis — WS-2 logic intact |
| ShareModal drag dismiss | Yes | Velocity-based commit added, previous behavior preserved |
| ShareModal copy animation | Yes | Flat sequence replaces nested setTimeout — same timing |
| DesktopReader native scroll | Yes | No changes — native scroll preserved |
| DesktopCard hover | Yes | box-shadow transition removed — transform still animated |
| OpinionBar fill | Yes | No changes |
| VerdictBar semantics | Yes | No changes — R7 aria-labels intact |
| Keyboard navigation | Yes | No changes to keyboard handlers |
| Focus restoration | Yes | No changes — R4/R7 focusOrigin logic intact |
| aria-live announcements | Yes | No changes — WS-2 logic intact |
| Reduced motion | Yes | No changes — global CSS + JS flag paths intact |
| Scroll lock | Yes | No changes |
| History pushState/popstate | Yes | No changes — R2 logic intact |
| Motion token usage | Yes | Hardcoded values replaced with tokens in InsightReader CSS |
| Touch-action on card content | Yes | pan-y added — allows native vertical scroll in card content |

## Regressions Found

| Issue | Severity | Status |
|-------|----------|--------|
| Ambiguous gesture → accidental dismiss | HIGH | **FIXED** — now cancels gesture instead of defaulting to dismiss |
| Vertical dismiss ignores velocity | HIGH | **FIXED** — now commits on vy > 500px/s |
| Hardcoded CSS durations in InsightReader | MEDIUM | **FIXED** — replaced with token vars |

## Residual Risks

| Risk | Severity | Assessment |
|------|----------|------------|
| InsightReader is still 1,299 lines | LOW | Working correctly. Decomposition deferred — not a production risk, only maintenance cost. |
| Ghost card interpolation: 6 properties per frame | LOW | All are transform-only (compositor-safe). No jank observed in code path analysis. |
| `will-change` left permanently on ghost cards | LOW | Only 2 elements. Acceptable memory cost. |
| Overlay entry uses CSS keyframe (not WAAPI) | LOW | Not interruptible, but entry is 300ms and rarely interrupted. Acceptable. |
