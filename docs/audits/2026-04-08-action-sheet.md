# 2026-04-08 Audit — Manual Stage 2-5 Action Sheet

> Prioritised TL;DR for the user's manual cross-LLM review pass on the 20 backfilled orphan/Tier 2 issues. Each row tells you which LLM to paste each prompt into, what the issue's known weak points are, and where the unverified specifics still live.

## How to use this sheet

For each issue:

1. Open `engine/briefs/{slug}.md` and **expand the research sections** with primary-source URLs for every numerical claim, named actor and law citation. The brief is a STUB — it does not yet replace real research.
2. Paste the four browser prompts into the right LLM:
   - `engine/prompts-generated/{slug}-stage2-browser.txt` → **Gemini** (Bias Audit)
   - `engine/prompts-generated/{slug}-stage3-browser.txt` → **ChatGPT** (Fact Verification)
   - `engine/prompts-generated/{slug}-stage4-browser.txt` → **DeepSeek** or ChatGPT (Alternative Framing)
   - `engine/prompts-generated/{slug}-stage5-browser.txt` → **Grok** (Contrarian Stress-Test)
3. Save each response to `engine/output/{slug}-stage{N}.json`.
4. Synthesize via Stage 6 (Claude internal) following `engine/templates/stage6-preamble.txt`.
5. Re-publish as edition N+1 in `src/data/issues.ts` if any corrections result.

## Priority order

The list below is ordered by **highest editorial risk first**. Issues at the top either had multiple cardinal-sin-grade errors corrected, or carry the highest reader impact.

---

### Tier P1 — Highest priority (start here)

These had load-bearing claims that were materially wrong before the audit. Review them first because the corrections changed the story, not just the numbers.

| ID | Slug | Why P1 |
|---|---|---|
| **1751** | `mrt3-circle-line-capped-at-rm45-billion-down-from` | Direction was REVERSED in old version (claimed cost increase; reality is cost reduction from RM68B to RM45B). km/station counts also wrong. |
| **1867** | `1mdb-asset-recovery-has-reached-over-rm207-billion` | Underclaimed recovery by ~70% (RM12B vs verified RM20.73B per MOF Oct 2025). Total scandal-loss baseline still disputed; verify against latest DOJ figures. |
| **1190** | `epf-flexible-account-3-withdrawals-reach-rm1479b-i` | Wrong launch date (Apr 2025 vs verified May 2024), wrong member count (6.2M vs 4.63M), wrong total (RM12B vs RM14.79B). Account 3 figures change quarterly — verify against latest MOF parliamentary disclosure. |
| **1267** | `malaysia-has-25-million-documented-migrant-workers` | TIP classification was wrong (card said "Tier 2 Watch List", verified Tier 2). Also corrected 2.1M → 2.5M per ILO. |
| **1247** | `suhakam-estimates-half-a-million-to-one-million-st` | Card understated by ~50× (12,000 vs SUHAKAM 500,000–1,000,000 stateless children in Sabah). Range needs further narrowing if any 2026 census subset has been published. |
| **1325** | `maternal-citizenship-amendment-passed-in-2024-marc` | Card said "facing government appeal"; reality is the case was resolved by Oct/Dec 2024 amendment + March 2025 settlement. Status entirely outdated. |

**Stage 5 (Grok) priority for P1:** these are the issues where a contrarian stress-test would catch the most remaining errors. Run Stage 5 first on this tier even before Stages 2/3/4.

---

### Tier P2 — Recent policy developments (verify once, then re-verify in 2 months)

These reflect rapidly-changing 2025-2026 policy reality. Their figures will go stale fast.

| ID | Slug | Why P2 |
|---|---|---|
| **1102** | `subsidy-rationalisation-targets-rm8-billion-annual` | RM8B annual savings target verified, but the breakdown by component (electricity ~RM4B + diesel ~RM4B + RON95 pending) is fluid. PADU usage status changes with each ministerial statement. |
| **1128** | `gig-workers-bill-2025-brings-12-million-into-socso` | Gig Workers Bill 2025 just took force; SOCSO contribution mechanics (1.25% per ride) verified. EPF retirement coverage NOT included — Phase 2 of the framework is the next news event. |
| **0146** | `gig-workers-got-socso-in-2025-retirement-floor-sti` | Same Gig Workers Bill update; same Phase 2 watch. Two issues now address overlapping topics from different angles — consider consolidation. |
| **1201** | `malaysias-2024-deficit-came-in-at-41-2025-forecast` | 2024 actual 4.1% verified; 2025 target 3.8%; analyst forecast 4.0%. Numbers will update once full 2025 outturn lands. |
| **1445** | `medical-tourism-hit-rm272b-in-2024-targeting-rm3b` | RM2.72B 2024 / RM3B 2025 / RM12B 2030 verified. The "specialist concentration in private hospitals" claim is plausible but specifics not verified — Stage 4 should propose international comparisons (India Charitable Hospital model). |
| **1805** | `lcs-cost-now-rm112-billion-first-ship-in-sea-trial` | First ship in sea trials Jan 2026, delivery Dec 2026 — story is mid-flight. Re-verify in 2 months when first hull is commissioned. |
| **1751** | (also above) | MRT3 land acquisition target end-2026, construction from 2027 — re-verify quarterly. |

**Stage 3 (ChatGPT) priority for P2:** ChatGPT's fact verification with the new STALE-CRITIQUE CHECK is the most important stage here, because the underlying numbers are time-sensitive.

---

### Tier P3 — Detention/rights cluster (Suaram/SUHAKAM-anchored)

The frameworks are correct; the corrections in this audit replaced unverified specifics with hedged framework language. Stage 4 (DeepSeek) should be the lead because the gap is *missing detail*, not *wrong detail*.

| ID | Slug | What Stage 4 should add |
|---|---|---|
| **1241** | `suaram-up-to-28-of-sosma-detainees-released-withou` | International parallels: UK pre-charge detention regimes, US material-witness statutes, Australia's preventive detention provisions. |
| **1247** | (also P1) | Comparison with Bangladesh, Indonesia, Philippines on Bajau/sea-nomad statelessness frameworks. |
| **1265** | `article-15a-citizenship-applications-are-decided-w` | Comparison with Singapore's discretionary citizenship pathway (Article 122 of the Singapore Constitution). |
| **1292** | `poca-allows-2-year-renewable-detention-with-no-jud` | International parallels: UK Terrorism Act 2006 control orders (now TPIMs), India's NSA preventive detention. |
| **1298** | `sosma-renewal-cycles-operate-with-minimal-public-d` | Comparison with how the UK Terrorism Acts go through their annual review process. |

**Stage 5 (Grok) for P3:** also valuable because civil-society reports often hide the strongest critiques in the appendices. Grok's contrarian framing should pull those out.

---

### Tier P4 — Heritage / depopulation / regional claims

Frameworks defensible after this audit's hedging; remaining work is sourcing concrete numbers where possible.

| ID | Slug | What Stage 3/4 should pin down |
|---|---|---|
| **1229** | `kampung-baru-master-redevelopment-still-stalled-af` | Specific landowner count for the 121-hectare master area (NOT Kg Sungai Baru sub-project's 328); current PKB cost estimate vs the verified RM43B. |
| **1618** | `islamic-state-debate-returns-as-pas-anchors-pn-sta` | Specific 2026 state-assembly bill names that are tabled in Kelantan/Terengganu/Kedah. The "62% support some form of Islamic governance" survey citation needs a year + sample size. |
| **1970** | `penang-tourism-china-india-asean` | George Town UNESCO core population time-series — find a primary census source for the depopulation arc. Penang Q1 2026 hotel occupancy by hotel category. |
| **1967** | `vernacular-school-choices` | The ISEAS survey for the 928-respondent figure needs a citation. SJKT 2026 RM50M restoration needs the official Budget 2026 line item. |

---

## Issues NOT in this list (already verified-defensible)

These were reviewed and confirmed during the audit without needing corrections — no Stage 2-5 rerun required unless new evidence surfaces:

- **1294** — "6 states unamended after Indira Gandhi 2018" matches verified 6 states (Perlis/Kedah/Melaka/N. Sembilan/Perak/Johor)
- **1319** — "7 preventive detention laws" defensible (SOSMA/POCA/POTA/DDA/NSC Act/Immigration/EO)
- **1181** — RM82B subsidies matches verified RM81B (FY24 budget speech)
- **1208** — RM47B corruption / 3% GDP within verified TI 3-4% range
- **1625** — Bumiputera property discount cross-subsidy mechanism verified
- **1952-1956** — All Hormuz-cluster recent orphans verified against multiple primary sources

## Issues unpublished pending rebuild (do these LAST, after a full pipeline run)

- **0170** — Wealth/income conflation; needs full rebuild with verified WID income data, not unverified wealth claims
- **1071** — Putrajaya smart city; "zero outcomes" framing contradicted; needs new angle
- **1077** — Government RM680M advertising; figure not traceable to any primary source; needs new source
- **1115** — Cabinet committee bypass count; specific numbers not verifiable; needs new source

For each unpublished issue, the cleanest path is: write a new research brief from scratch, generate Stage 1 with the new accuracy preamble, run the full Stage 2-5 review, synthesise via Stage 6, then re-publish.

## Suggested batching

A practical pace for this work:

- **Week 1:** Tier P1 (6 issues) — these have the largest reader-impact corrections to lock in
- **Week 2:** Tier P2 (7 issues) — these go stale fastest; do them while the data is still fresh
- **Week 3:** Tier P3 (5 issues) — civil-society research is more time-flexible
- **Week 4:** Tier P4 + the 4 unpublished rebuilds

Each issue takes ~30 minutes of manual paste-and-save plus ~20 minutes of synthesis = ~50 minutes per issue. 22 issues × 50 min ≈ 18 hours of manual work, comfortably split across 4 weeks.

## Quality gates per issue

Before re-publishing any issue, confirm:

- [ ] All four browser-prompt outputs saved to `engine/output/{slug}-stage{2,3,4,5}.json`
- [ ] Stage 6 synthesis written, with each change tagged `CORRECTED`/`REPHRASED`/`ADDED`/`STRENGTHENED`/`INTRODUCED`
- [ ] Phase 6 LEGAL + ACCURACY CHECK in CLAUDE.md run on the final text
- [ ] FACT TRACE: every specific in the final text traces to a primary source listed in the brief or one of the stage outputs
- [ ] FOUR CARDINAL SINS check: no overclaim, underclaim, misleading framing, unverified detail
- [ ] Validator passes (`node scripts/validate-issues.mjs`)
- [ ] Audit re-run shows the issue moved out of any flagged state (`node scripts/audit-published.mjs`)

---

*Generated 2026-04-08 by the audit process. See [README.md](./README.md) for the full audit toolchain reference.*
