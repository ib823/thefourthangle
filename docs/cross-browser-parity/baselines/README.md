# Baselines

Performance and accessibility snapshots the subsequent parity work is measured against. See brief-v3 § Phase 9.

## What lives here

- `lighthouse-home-YYYY-MM-DD.json` — Lighthouse report for `/` (mobile + desktop).
- `lighthouse-issue-YYYY-MM-DD.json` — Lighthouse for `/issue/0146`.
- `axe-home-YYYY-MM-DD.json` — axe-core results for `/`.
- `axe-issue-YYYY-MM-DD.json` — axe-core results for `/issue/0146`.

These are generated and checked in by the GitHub Actions run on the merge of PR #15 (first Phase 9 run).

## Thresholds (brief-v3 § Phase 9.5)

| Metric | Mobile | Desktop |
|---|---|---|
| Performance | ≥ 90 | ≥ 95 |
| Accessibility | ≥ 95 | ≥ 95 |
| Best Practices | ≥ 95 | ≥ 95 |
| SEO | ≥ 95 | ≥ 95 |
| LCP | < 2.5 s | < 1.5 s |

## Why "pending" today

The Phase 9 CI (PR #15) wires up the generation — the first CI run after merge populates these files. No Chrome binary in Codespaces, so local generation is not possible from this dev environment.
