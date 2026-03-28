# The Fourth Angle — Claude Code Instructions

## What This Is
Non-partisan Malaysian issues analysis platform. Every issue goes through a 6-stage editorial pipeline, scored for neutrality and opinion shift. Static site on Cloudflare Pages.

## Publishing Workflow

### To create a new issue:
1. Research the topic thoroughly from multiple sources
2. Create the issue object in `src/data/issues.ts` following the exact format below
3. Set `published: true` to make it visible in the feed
4. Commit and push to `main` — GitHub Actions auto-builds and deploys

### Issue format (add to the ISSUES array in `src/data/issues.ts`):
```typescript
{
  id: "XXXX",              // 4-digit string, unique, sequential
  opinionShift: 73,        // 0-100: how much reader would miss from headline alone
  status: "new",           // "new" | "updated" | null
  edition: 1,              // increment on updates
  headline: "...",         // max 80 chars, topic-first, no clickbait
  context: "...",          // 1-2 sentences of factual background
  published: true,         // true = visible in feed, false = hidden
  stageScores: { pa: 85, ba: 72, fc: 88, af: 65, ct: 52, sr: 78 },
  finalScore: 73.2,        // 0-100 neutrality score
  related: ["0142"],       // IDs of connected issues (optional)
  sourceDate: "2026-03-28", // when source info was retrieved
  cards: [
    { t: "hook", big: "What they said — the surface claim", sub: "Context that sets up the gap between claim and reality" },
    { t: "fact", big: "What we found — first factual finding", sub: "Supporting evidence with specific numbers", lens: "Legal" },
    { t: "fact", big: "Second finding from different angle", sub: "Contrasting data point", lens: "Economic" },
    { t: "fact", big: "Third finding — the missing voice", sub: "Perspective that mainstream coverage omits", lens: "Social" },
    { t: "reframe", big: "The real question nobody is asking", sub: "" },
    { t: "view", big: "The considered view — balanced synthesis", sub: "" },
  ]
}
```

### Card types:
- `hook` — "What they said" — the mainstream narrative / surface claim
- `fact` (×3) — "What we found" — each with a different `lens`
- `reframe` — "The real question" — reframes the entire issue
- `view` — "The considered view" — balanced editorial synthesis

### Lens values (pick the most relevant for each fact card):
Legal, Rights, Economic, Governance, Technology, Social, Political, Health, Environmental, Regional, Historical, Critical, Theological, Security

### Score guidelines:
- `opinionShift` 80-100: Fundamental (most people would completely change their view)
- `opinionShift` 60-79: Significant (important missing context)
- `opinionShift` 40-59: Partial (some gaps in mainstream coverage)
- `opinionShift` 0-39: Surface (mostly well-covered, minor additions)
- `finalScore`: average quality across 6 stages (higher = more balanced)
- `stageScores`: each 0-100, independently assessed

### To publish/unpublish:
- Set `published: true` on issues you want visible
- Set `published: false` (or omit) to hide from feed
- Unpublished issues still accessible via direct URL

### To update an existing issue:
1. Find the issue by ID in `src/data/issues.ts`
2. Update the content
3. Change `status: "updated"`, increment `edition`
4. Commit and push

## Content Rules
- NO references to AI, models, Claude, GPT, or any AI provider
- Use "6 independent review stages" not "AI models"
- All analysis framed as editorial methodology
- Respect 3R: Race, Religion, Royalty — critique policy, not communities/beliefs
- Only use publicly available information
- Cite specific numbers, dates, sources in context

## Architecture
- `src/data/issues.ts` — all issue content
- `src/components/` — Svelte 5 UI components
- `scripts/` — build pipeline (OG images, search index, verification)
- `workers/notify/` — Cloudflare Worker for push notifications
- `public/og/` — generated OG preview images (auto-generated during build)
- `.github/workflows/deploy.yml` — auto-deploy on push to main

## Deploy Pipeline
Push to `main` → GitHub Actions → npm run build → wrangler pages deploy
No manual steps needed. OG images, search index, and signatures all generated automatically.

## Notifications
- CRON Worker runs Tue/Thu 8am MYT + Sat 9am MYT
- Detects new published issues in feed
- Sends push to all subscribers automatically
- No manual notification triggering needed

---

## COMPLETE PUBLISHING PIPELINE

### Schedule
- **Monday evening** → process for Tuesday 8am notification
- **Wednesday evening** → process for Thursday 8am notification
- **Friday evening** → process for Saturday 9am notification

### Path A — Manual Publishing (Primary)

When the user says "Find issues" or "Find issues for this week":

#### STEP 1: DISCOVER
1. Research Malaysian news from the last 2 days
2. Use web search to find the top 5-10 most significant issues
3. Focus on: government policy, legislation, court decisions, budgets, social policy, economic data releases, institutional failures, rights concerns
4. Present each candidate with: headline (draft), 1-line context, estimated opinion shift
5. Wait for user to approve which issues to proceed with

#### STEP 2: PROCESS (per approved issue)

**a) 6-STAGE EDITORIAL REVIEW**

Run each stage independently and score 0-100:

- **PA (Primary Analysis)**: Write 6 cards from primary sources. Score: how thoroughly were primary sources used?
- **BA (Bias Audit)**: Check across 12 dimensions:
  1. Tone (neutral vs loaded language)
  2. Political lean (favoring government or opposition)
  3. Ethnic framing (stereotyping or centering one community)
  4. Religious sensitivity (respectful of all faiths)
  5. Narrative framing (cherry-picking vs full picture)
  6. Completeness (all relevant facts included)
  7. Timing (using recent vs outdated data)
  8. Certainty (appropriate hedging of uncertain claims)
  9. Source diversity (multiple independent sources)
  10. Geographic balance (not KL-centric)
  11. Economic framing (class-aware, not elitist)
  12. Gender agency (women as agents, not objects)
  Score: weighted average across all 12.
- **FC (Fact Verification)**: Verify every factual claim. Score: % of claims that are verified.
- **AF (Alternative Framing)**: Identify missing voices (B40, East Malaysia, women, youth). Score: how many counter-perspectives included.
- **CT (Contrarian Stress-Test)**: Attack the analysis. Where is it cowardly? Where does it hedge? Score: how well it withstands challenge.
- **SR (Synthesis Review)**: Integrate all critiques. Score: overall synthesis quality.

→ Output: `stageScores: { pa, ba, fc, af, ct, sr }` and `finalScore` (weighted average)

**b) OPINION SHIFT SCORING**

Assess: if a reader only saw the headline, what % of the full picture would they miss?
- 80-100: Fundamental — most people would completely change their view
- 60-79: Significant — important missing context
- 40-59: Partial — some gaps in mainstream coverage
- 0-39: Surface — mostly well-covered

→ Output: `opinionShift: XX`

**c) CARD CONTENT**

Write exactly 6 cards:
1. `hook` — What they said (the mainstream claim)
2. `fact` with `lens` — First finding (different angle)
3. `fact` with `lens` — Second finding (contrasting data)
4. `fact` with `lens` — Third finding (the missing voice)
5. `reframe` — The real question nobody is asking
6. `view` — The considered view (balanced synthesis)

Rules for card text:
- `big`: Bold, confident statement. Max 2 sentences. No hedging.
- `sub`: Supporting evidence with specific numbers, dates, sources.
- Each fact card must have a different `lens` value.

**d) LEGAL & DISCLAIMER CHECK**

Verify the issue content against Malaysian law:
- [ ] No 3R violations (Race, Religion, Royalty — critique policy, not communities)
- [ ] No defamation risk (fair comment on public interest, no personal attacks)
- [ ] No Official Secrets Act breach (only publicly available sources)
- [ ] No Sedition Act risk (no advocacy for unlawful regime change)
- [ ] No CMA Section 233 risk (not offensive, threatening, or harassing)
- [ ] Content framed as analysis/opinion, not statements of fact
- [ ] Consistent with `/disclaimer` page claims
- [ ] No banned terms: AI, model, Claude, GPT, DeepSeek, Gemini, Grok, LLM, language model

If any check fails, flag to user before proceeding.

**e) CONTENT SIGNATURE**

The build pipeline automatically generates SHA-256 fingerprints and Ed25519 signatures for all issue content when `npm run build` runs. No manual step needed — just ensure the issue is in `issues.ts` before building.

**f) IMAGE PROMPT**

Generate a one-line art prompt for the issue. Format:

```
=== ISSUE {ID}: {HEADLINE} ===

Single continuous line art drawing on deep dark navy background (#0f0f23).
One unbroken white line (#FFFFFF, stroke weight 3px) depicting:
[METAPHORICAL DESCRIPTION — one symbolic visual that captures the issue's tension]
Style: minimalist single-line illustration, Pablo Picasso continuous line drawing.
No fill, no shading, no color other than white line on navy.
Elegant, contemplative, editorial. Ample negative space.
No text, no logos, no watermarks.
Aspect ratio exactly 1.91:1 wide landscape format. 1200x630 pixels.

Save as: public/og/backgrounds/issue-{ID}-bg.png
```

Present prompt to user. WAIT for user to generate image externally and upload it before proceeding to publish.

#### STEP 3: SHERLOCK (Connection Scan)

For each new issue, scan ALL issues in `src/data/issues.ts`:
- Match by: shared keywords in headlines/context, same policy area, same institution mentioned, follow-up/predecessor topics
- If connected issues found:
  - Add their IDs to the new issue's `related` field
  - Add the new issue's ID to the connected issue's `related` field (bidirectional)
  - If the connected issue is unpublished, mark it for publishing too
  - Connected issues that become published also need an image prompt (Step 2f)
  - Present all connections to user for approval

#### STEP 4: REVIEW

Present the complete package to user:
- All new issues with full content
- All connected issues being published
- Scores and legal clearance for each
- Image prompts (or confirmation images are uploaded)
- Wait for explicit approval: "Publish" or specific changes

#### STEP 5: PUBLISH

After user says "Publish":
1. Set `published: true` on all approved issues in `src/data/issues.ts`
2. Verify all image backgrounds exist in `public/og/backgrounds/` for every issue being published
3. Commit all changes with message: "Publish: [count] issues — [brief description]"
4. Push to `main`
5. GitHub Actions auto-builds and auto-deploys
6. CRON Worker will detect and send notifications on next scheduled run

### Path B — Fallback Auto-Publishing

If no new issues are published within 48 hours before a scheduled notification:

1. Read `src/data/fallback-rotation.ts`
2. Determine current week (1-4 based on day of month)
3. Get the 10 issue IDs for that week
4. Set `published: true` on those 10 issues
5. Commit and push
6. Same deploy pipeline fires

Fallback issues have pre-prepared images and signatures.
File: `src/data/fallback-rotation.ts`

### Image Requirements
- **Every published issue MUST have a one-line art background image**
- File location: `public/og/backgrounds/issue-{ID}-bg.png`
- Format: 1200×630 PNG, white line art on dark navy (#0f0f23)
- The build script composites this with the headline + scores overlay automatically
- If no background image exists, the issue gets a solid dark OG (not acceptable for published issues)
