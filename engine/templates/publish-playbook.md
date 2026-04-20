# Publishing Playbook — Per-Issue Walkthrough

Turn-by-turn playbook for Claude sessions driving one issue through the 4-stage
editorial pipeline. Cold-start safe: run `node scripts/publish-pipeline.mjs
status {slug}` at the start of any session to see which phase is next.

**Stages kept (4):** Stage 1 Primary Analysis (PA) · Stage 2 Bias Audit — Gemini (BA) · Stage 3 Fact Verification — ChatGPT (FC) · Stage 6 Synthesis Review (SR).
**Stages retired:** Stage 4 (DeepSeek) · Stage 5 (Grok).

Claude drives Phases 0, 1, 2, 3, 5, 6, 7a, 7b-prompt, 8, 9. The operator drives
Phase 4 (paste into Gemini + ChatGPT, paste JSON back) and Phase 7b-image
(render and upload the art).

---

## Phase 0 — Init
**Driver:** Claude.

```
node scripts/publish-pipeline.mjs init {slug}
```

Creates `engine/output/{slug}-pipeline-state.json` and reserves the next issue
ID. If state already exists, resume instead.

---

## Phase 1 — Research brief
**Driver:** Claude.

Write `engine/briefs/{slug}.md` per the format in `CLAUDE.md` §"PHASE 1:
RESEARCH":

- `ISSUE`, `PERIOD`, `CONTEXT` timeline with dates + sources
- `ACTORS`, `RELEVANT LAW`, `KEY STATISTICS` (primary-source citation per number)
- `12-DIMENSION RISK ASSESSMENT`, `RECOMMENDED LENSES`
- `SOURCES` — ≥15, at least 8 primary, multi-spectrum
- `CONTRADICTIONS` section, `SOURCE SPECTRUM CHECK`

**Gate:** present brief summary to user, wait for approval.

When done:
```
node scripts/publish-pipeline.mjs set-phase {slug} 1_research '{"brief":"engine/briefs/{slug}.md"}'
```

---

## Phase 2 — Stage 1 Primary Analysis
**Driver:** Claude.

Read `engine/templates/stage1-preamble.txt` first. Generate 6-7 cards following
the schema in `CLAUDE.md`, save to `engine/output/{slug}-stage1.json`.
Score **PA** (0-100).

When done:
```
node scripts/publish-pipeline.mjs set-phase {slug} 2_stage1 '{"pa": <score>, "stage1":"engine/output/{slug}-stage1.json"}'
```

---

## Phase 3 — Generate browser prompts
**Driver:** Claude.

```
node scripts/publish-pipeline.mjs stage-prompts {slug}
```

Writes all 4 prompts but only Stage 2 + Stage 3 are used. Present the two
prompts to the user labelled clearly:

```
=== STAGE 2: BIAS AUDIT ===
Paste into Gemini:
[full contents of engine/prompts-generated/{slug}-stage2-browser.txt]

=== STAGE 3: FACT VERIFICATION ===
Paste into ChatGPT:
[full contents of engine/prompts-generated/{slug}-stage3-browser.txt]
```

---

## Phase 4 — Collect external reviews
**Driver:** Operator pastes into browsers and saves JSON back.

For each response:

```
node scripts/publish-pipeline.mjs collect {slug} stage2 engine/output/{slug}-stage2.json
node scripts/publish-pipeline.mjs collect {slug} stage3 engine/output/{slug}-stage3.json
```

The script validates JSON, extracts `bias_score` (BA) / `factual_accuracy_score`
(FC), marks the phase complete. If the pasted response isn't valid JSON, it
errors out — ask the operator to re-paste.

---

## Phase 5 — Stage 6 Synthesis
**Driver:** Claude.

Read `engine/templates/stage6-preamble.txt` first. Integrate critiques:

- **Stage 3 FC →** apply fact corrections (wrong numbers, dates, ages)
- **Stage 2 BA →** rephrase flagged quotes, balance perspectives

Tag every change with `CORRECTED (Stage 3)`, `REPHRASED (Stage 2)`, or
`INTRODUCED (Stage 6 self-verified)`. If you cannot tag a change with one of
those three, you have introduced something you should not have.

Save synthesis to `engine/output/{slug}-stage6-synthesis.json`. Score **SR**.

```
node scripts/publish-pipeline.mjs set-phase {slug} 5_synthesis '{"sr": <score>, "stage6":"engine/output/{slug}-stage6-synthesis.json"}'
```

---

## Phase 6 — Legal + Accuracy Check + Reader output
**Driver:** Claude.

Transform synthesis to reader format (character budgets enforced by validator):
- `headline` ≤100 chars, target 75
- `card.big` ≤180 chars, target 120
- `card.sub` ≤220 chars, target 160
- `card.big + card.sub` ≤300 chars

Compute `opinionShift` and `finalScore`. **Under 4-stage scoring:**

```
finalScore = weighted_mean(pa, ba, fc, sr)
```

Default equal weights (0.25 each) unless editorial policy changes. Record only
the 4 stage scores on the issue; do NOT backfill af / ct.

Save reader JSON to `engine/output/{slug}-reader.json`.

Run the full 11-point check from `CLAUDE.md` §"PHASE 6":

**Legal (8):** 3R, defamation, OSA, sedition, CMA§233, analysis-framed,
disclaimer-consistent, stealth (banned terms).

**Accuracy (3):** fact trace, four cardinal sins, no-drift-from-Stage-6.

Present the legal + accuracy clearance report. Wait for user approval.

```
node scripts/publish-pipeline.mjs set-phase {slug} 6_legal_check '{"reader":"engine/output/{slug}-reader.json", "pa":<..>,"ba":<..>,"fc":<..>,"sr":<..>,"finalScore":<..>}'
```

---

## Phase 7a — Sherlock connection scan
**Driver:** Claude.

First, write the reader JSON to `src/data/issues/{ID}.json` with
`"published": false` so Sherlock can see it in the fact-graph build.

```
node scripts/publish-pipeline.mjs sherlock <ID>
```

Review the top proposed connections. Update the new issue's `related[]` and
add reverse links to each connected issue. When an accepted connection target
is unpublished, flag it to the user.

```
node scripts/publish-pipeline.mjs set-phase {slug} 7a_sherlock '{"related": ["0142","0087"]}'
```

---

## Phase 7b — Image prompt + rendering
**Driver:** Claude emits the prompt; operator renders the art.

```
node scripts/publish-pipeline.mjs image-prompt <ID>
```

This prints the per-issue prompt composed from the T4A master style
(`#0f0f23` navy background, single symbolic object, amber/steel-blue/earth
palette, 1.91:1 aspect).

Claude presents the prompt to the user. User renders it in their image tool
and drops the result at:

```
public/og/backgrounds/issue-{ID}-bg.png    (or .jpg)
```

When the file lands, mark:
```
node scripts/publish-pipeline.mjs set-phase {slug} 7b_image_uploaded
```

The build script (`scripts/generate-og-images.mjs`) then composites the
1200×630 canonical PNG + 9 responsive variants (AVIF/WebP/JPEG × 640/960/1200)
automatically on next `npm run build`.

---

## Phase 8 — Validate
**Driver:** Claude.

```
node scripts/publish-pipeline.mjs validate
```

Wraps `validate-issues.mjs` (structural + duplicate-ID + length-budget) and
runs a stealth grep across all issue files for banned terms. Exits non-zero
if anything fails — do NOT proceed to deploy.

The validator accepts 4-stage (pa/ba/fc/sr) issues as required and still
parses legacy 6-stage issues (af/ct remain optional).

---

## Phase 9 — Deploy
**Driver:** Claude.

Flip the new issue's `"published": true` + set `"sourceDate"` to today.

```
node scripts/publish-pipeline.mjs deploy <ID>
```

Runs `git pull --rebase origin main` first (Path A — handles parallel workers),
then stages the issue JSON + its bidirectional related updates + the background
image, commits with `"Publish: issue {ID} — {headline}"`, pushes.

GitHub Actions picks it up and runs `npm run build` (which calls
`generate-og-images.mjs`, `build-fact-graph.mjs`, `validate-issues.mjs`, and
post-build `stealth.mjs` PNG-metadata stripping) then `wrangler pages deploy`.

The CRON worker at `workers/notify/` picks up the new published issue on the
next scheduled push (Tue/Thu 8am MYT, Sat 9am MYT).

---

## Resuming mid-pipeline

Every Claude session that works on an issue must start with:

```
node scripts/publish-pipeline.mjs status {slug}
```

The status table shows which phases are done and what the next action is.
If the state file is missing, the issue hasn't been started.

If you need to manually flip a phase (e.g., you did the research brief in a
separate session that didn't record state), use `set-phase` with JSON metadata.

---

## Cold-start handoff from the Radar

The radar's auto-brief at `engine/briefs/auto-{issue_id}.txt` is a Phase 0
artefact — a head start on Phase 1, not a substitute. When promoting a
radar-flagged topic into the pipeline:

1. Pick a slug (kebab-case, 3-5 words, e.g. `bestinet-migrant-visa-monopoly`)
2. `init {slug}` — creates state + reserves next ID
3. In Phase 1, start from the auto-brief content and expand it into the full
   research brief. The auto-brief's actor list, dimension flags, and law
   suggestions feed directly into the full brief sections.
