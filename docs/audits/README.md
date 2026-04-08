# Audit Snapshots

Historical snapshots of published-issue audits run via `scripts/audit-published.mjs`, `scripts/triage-unauditable.mjs`, and `scripts/confirm-tier2.mjs`. Each snapshot is dated and immutable — re-running the audit creates a new dated file rather than overwriting the previous one.

## Index

| Date | Files | Notes |
|---|---|---|
| 2026-04-08 | [audit-published](./audit-published-2026-04-08.md), [tier2-confirmation](./tier2-confirmation-2026-04-08.md), [triage-unauditable](./triage-unauditable-2026-04-08.md), [action-sheet](./2026-04-08-action-sheet.md) | First full audit pass after the new Accuracy Standard landed in CLAUDE.md. Major editorial cleanup of orphaned legacy issues. The action sheet is the prioritised manual Stage 2-5 re-review queue. |

## How to read these reports

### `audit-published-{date}.md`

The main audit. Four phases:

1. **Structural** — length budget, concreteness floor, reframe.sub > 80, missing background images. Hard checks.
2. **Pipeline traceability** — which engine artifacts exist per issue. Identifies un-auditable orphans.
3. **Source quality** — parses every Stage 3 output and flags issues with low FAS or low avg `m_true`.
4. **Anti-pattern text scan** — greps for hook hedges and underclaim phrases.

Output ends with a prioritised review queue (Tier 1 / Tier 2 / Tier 3).

### `tier2-confirmation-{date}.md`

Cross-references each Tier 2 issue's Stage 3 critique against the currently-published cards. Marks each issue as RESOLVED, PARTIAL, UNRESOLVED, or STUB. Note: the token-matching algorithm is conservative — manual `view-stage3.mjs` is the authoritative check.

### `triage-unauditable-{date}.md`

Categorises issues with zero engine artifacts into FALLBACK / LEGACY / ORPHAN. Action recommendation per category. Does NOT auto-act.

## How the audit pass on 2026-04-08 affected published content

This was the first full audit pass after the new Accuracy Standard was added to CLAUDE.md. Highlights:

- **4 issues unpublished** (0170, 1071, 1077, 1115) — load-bearing claims unverifiable or actively contradicted
- **20 issues edition-2/3 rewritten** with verified figures (0146, 1043, 1102, 1128, 1190, 1201, 1229, 1241, 1247, 1265, 1267, 1292, 1298, 1325, 1445, 1618, 1751, 1805, 1867, 1958, 1967, 1970)
- **All 20 above** were then run through `scripts/backfill-orphan-pipeline.mjs` to generate research brief stubs, Stage 1 JSON, and ready-to-paste Stage 2-5 browser prompts using the strengthened Phase C preamble templates
- **Phase 1 length / concreteness / reframe.sub flags**: all clean on published content
- **Tier 1**: 0
- **Total published**: 86 (from 90)

Methodological notes captured during the pass:

- **Stage 3 critique decay.** Several Stage 3 critiques on Tier 2 issues evaluated *pre-correction drafts*; the corrected published editions had already incorporated the fixes. The audit's low FAS scores reflected pre-correction state. The Phase C preamble update added a "STALE-CRITIQUE CHECK" instruction to prevent this misreading in future runs.
- **Real-world events can stale critiques.** The 2026 Strait of Hormuz crisis (28 Feb 2026) made the "$126/barrel" figure that Stage 3 had flagged on issue 1965 as wrong actually correct. Future audits should re-verify any critique created before late February 2026 against current world conditions.
- **Token-matching false positives.** `confirm-tier2.mjs` is conservative — manual `view-stage3.mjs` is the authoritative confirmation of whether a Tier 2 issue's corrections are reflected in the current cards.
- **Backfill gives a baseline, not a replacement.** The Phase D backfill artifacts are STUBS designed to be expanded with primary sources before being used for substantive review.

## Re-running the audit

```bash
node scripts/audit-published.mjs        # main audit
node scripts/triage-unauditable.mjs     # categorise unauditable issues
node scripts/confirm-tier2.mjs          # verify Tier 2 corrections applied
node scripts/view-stage3.mjs <id>       # inspect any single issue
```

Each run produces a dated file in `engine/output/`. Copy the relevant outputs to `docs/audits/` to add a new snapshot to the index above.
