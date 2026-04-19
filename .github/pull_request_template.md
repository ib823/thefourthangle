<!--
  Every PR that touches UI / state / CSS / build output must pass the
  Parity Checklist (docs/cross-browser-parity/parity-checklist.md) before
  merge. Copy the relevant sections into your description.
-->

## Summary

<!-- 1-3 sentences: what changed and why. -->

## Linked ADRs

<!-- Link to any /docs/adr/NNNN-*.md files that cover this PR's decisions, or "n/a". -->

## How to verify

<!--
  Manual + automated steps. Include copy-pasteable one-liners. Example:
    curl -s http://localhost:4321/issue/0146 | grep -c '<article'    # → 1
    npm run check-bundle
  ...and at least one visual/manual check for the change.
-->

## Screenshots / GIFs

<!-- Mobile 390×844, tablet 820×1180, desktop 1440×900, if the change is visible. -->

## Preference passes (tick each that applies)

- [ ] `prefers-reduced-motion: reduce` — no unwanted animation.
- [ ] `forced-colors: active` — borders + text visible; system colors applied.
- [ ] `prefers-color-scheme: dark` — dark tokens applied correctly.
- [ ] Keyboard-only — Tab reaches every interactive element; focus visible; no trap.
- [ ] JS-disabled (if the change touches `/issue/[id]`) — article still readable.

## Bundle-size delta

```
<!-- paste output of `npm run check-bundle` -->
```

## CI gates (tick when green)

- [ ] `npm run check`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run check-fonts`
- [ ] `npm run check-bundle`
- [ ] `npm run e2e` (or CI-equivalent)

## Parity rules touched

<!--
  Briefly list which phase(s) this PR touches so a reviewer knows which
  doc to re-read. Example: "Phase 1 (reading-state API), Phase 9 (new
  smoke test added)."
-->
