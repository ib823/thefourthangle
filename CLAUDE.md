# The Fourth Angle — Claude Code Instructions

## What This Is
Non-partisan Malaysian issues analysis platform. Every issue goes through a 6-stage editorial pipeline, scored for neutrality and opinion shift. Static site on Cloudflare Pages.

## Publishing Workflow

### To create a new issue:
1. Research the topic thoroughly from multiple sources
2. Create a new file `src/data/issues/{id}.json` following the exact format below (id is the 4-digit string)
3. Set `"published": true` to make it visible in the feed
4. Commit and push to `main` — GitHub Actions auto-builds and deploys

Issues are stored one-per-file in `src/data/issues/`. The loader in `src/data/issues.ts` aggregates them at build time (alphanumeric by filename). Do NOT put issue content back into `src/data/issues.ts` — that file is now a thin loader. Types and helpers (`Issue`, `Card`, `CARD_TYPES`, `opinionLabel`, `opinionColor`, `issueCategory`) live in `src/data/issue-types.ts`.

### Issue format (new file `src/data/issues/{id}.json`):
```json
{
  "id": "XXXX",
  "opinionShift": 73,
  "status": "new",
  "edition": 1,
  "headline": "...",
  "context": "...",
  "published": true,
  "stageScores": { "pa": 85, "ba": 72, "fc": 88, "af": 65, "ct": 52, "sr": 78 },
  "finalScore": 73.2,
  "related": ["0142"],
  "sourceDate": "2026-03-28",
  "cards": [
    { "t": "hook", "big": "What they said — the surface claim", "sub": "Context that sets up the gap between claim and reality" },
    { "t": "fact", "big": "What we found — first factual finding", "sub": "Supporting evidence with specific numbers", "lens": "Legal" },
    { "t": "fact", "big": "Second finding from different angle", "sub": "Contrasting data point", "lens": "Economic" },
    { "t": "fact", "big": "Third finding — the missing voice", "sub": "Perspective that mainstream coverage omits", "lens": "Social" },
    { "t": "reframe", "big": "The real question nobody is asking", "sub": "" },
    { "t": "analogy", "big": "Think of it like a building inspector who only checks the lobby", "sub": "Accessible comparison that reframes the issue for everyday understanding" },
    { "t": "view", "big": "The considered view — balanced synthesis", "sub": "" }
  ]
}
```

Field notes:
- `id`: 4-digit string, unique, sequential. Must match the filename (`{id}.json`).
- `headline`: max 80 chars, topic-first, no clickbait.
- `context`: 1-2 sentences of factual background.
- `published`: `true` = visible in feed; `false` or absent = hidden.
- `opinionShift`: 0–100, how much reader would miss from headline alone.
- `status`: `"new"`, `"updated"`, or `null`.
- `finalScore`: 0–100 editorial quality score.
- `related`: array of connected issue IDs (optional).
- `sourceDate`: ISO date when source info was retrieved.

### Card types:
- `hook` — "What they said" — the mainstream narrative / surface claim
- `fact` (×3) — "What we found" — each with a different `lens`
- `reframe` — "The real question" — reframes the entire issue
- `analogy` — "Think of it this way" — accessible comparison that makes the issue intuitive (optional, 0 or 1 per issue)
- `view` — "The considered view" — balanced editorial synthesis

### Lens values (pick the most relevant for each fact card):
Legal, Rights, Economic, Governance, Technology, Social, Political, Health, Environmental, Regional, Historical, Critical, Theological, Security

**Lens choice affects topic browsing.** The Today page groups issues by their primary lens (most common lens across fact cards). Choose diverse lenses to spread issues across topics. Avoid using the same lens on all 3 fact cards unless the issue genuinely warrants it.

### Score guidelines:
- `opinionShift` 80-100: Fundamental (most people would completely change their view)
- `opinionShift` 60-79: Significant (important missing context)
- `opinionShift` 40-59: Partial (some gaps in mainstream coverage)
- `opinionShift` 0-39: Surface (mostly well-covered, minor additions)
- `finalScore`: editorial quality score across 6 stages (higher = more balanced). Visible to readers in the desktop reader and share card as "Editorial Quality Score"
- `stageScores`: each 0-100, independently assessed

### To publish/unpublish:
- Set `published: true` on issues you want visible
- Set `published: false` (or omit) to hide from feed
- Unpublished issues still accessible via direct URL

### To update an existing issue:
1. Open `src/data/issues/{id}.json`
2. Update the content
3. Change `"status": "updated"`, increment `edition`
4. Commit and push

## Length Budget — Bite-Size Standard

Issues must be **scannable in 60–90 seconds on a phone**. That window is when a new visitor decides whether to subscribe. Drift toward longer copy is the single most common quality regression — every published issue must fit the budget below.

### Per-field budget (characters, not words)
| Field         | Min | **Target** | Hard max | Notes |
|---------------|----:|-----------:|---------:|-------|
| `headline`    |  10 |     **75** |      100 | One line on mobile. Topic-first. No clickbait. (~10–14 words) |
| `context`     |  20 |    **200** |      280 | 1–2 sentences. Sets up the gap between claim and reality. |
| `card.big`    |   5 |    **120** |      180 | One claim per card. One sentence preferred. |
| `card.sub`    |   — |    **160** |      220 | One supporting sentence with the specific number/source. |
| `card.big+sub`|   — |    **240** |      300 | Combined cap — must fit a mobile card at readable font size. |
| Total content |   — | **~1300**  |   ~1700  | context + all cards combined. Outliers ≥2000 are wordy. |

The validator enforces these as **warnings** (not build errors) so editorial drift surfaces immediately. Aim for the target column; treat the hard max as a wall, not a goal.

### Why this budget — the research
- **Axios Smart Brevity**: most updates are ~40% shorter than typical writing while preserving every essential fact. Target headline length ≤6 words; one bold claim per chunk.
- **News headline CTR**: optimum click-through sits at **60–100 characters**; AP mobile guideline is even tighter at ≤55. We split the difference at 75.
- **Working memory limit (Cowan 2001)**: ~4 chunks of novel content survive a session. Across 7 cards, only 3–4 distinct ideas land — bias editorial effort toward making sure those are the *right* ones (hook + reframe + one fact + view).
- **Microcontent principle**: visuals process 60,000× faster than text. The card layout is the visual; text is the caption — keep it caption-length.
- **Subscription conversion**: 80% of visitors only read the hook. Spend the editorial effort on the headline + hook card big text. If those two don't earn the next swipe, nothing else matters.

### Hook engineering rules (the conversion-critical surface)
The `hook` card and the `headline` it amplifies must do four things in under ~280 combined characters:
1. **Name the surface claim** — what mainstream coverage said.
2. **Plant the gap** — hint that something important is missing, without giving the answer away.
3. **Use one specific number, name, or date** — concreteness beats abstraction every time.
4. **Promise a payoff in one swipe** — the reader should feel "I'll lose something if I don't read the next card."

Avoid in hook copy: "explores", "examines", "looks at", "raises questions about", "sparks debate". These are abstraction words — they signal a thinkpiece, not a discovery. Use verbs of action and finding: *found, charged, voted, paid, hid, exempted, killed*.

### Card sub fields are optional
Better to leave `sub: ""` than to pad. The `reframe` and `view` cards typically need no `sub` at all — the big claim is the whole point. The validator now warns when `reframe.sub` is non-empty (it dilutes the aha spike).

### High-leverage editorial rules (research-grounded)

These rules come from a deep research synthesis (full citations and rationale in [`docs/research/bite-size-reading.md`](docs/research/bite-size-reading.md)). They are *not* validator-enforced because they are subjective — they are the editorial brain T4A should aim for.

**Per-card structural rules**

1. **First-clause concreteness rule.** The most concrete element of `card.big` (a number, a named actor, a date, OR an action verb of finding) must appear in the **first clause** — typically the first 6–8 words before the first comma or period. NN/G F-pattern + Reber-Schwarz processing fluency: the brain decides whether to keep reading in the first half-second, anchored on the first fixation. The element doesn't need to be a noun — *"Putrajaya called…"* and *"Bestinet pocketed…"* are concrete because the verb names a specific action by a specific actor.
2. **Cliffhanger button** on cards 1–6. The last ~6 words of every card except the view should preview the next card honestly — never bait. Borrowed from screenwriting "buttons" and YouTube retention editing.
3. **Concreteness floor on fact cards.** Every fact card must contain at least one named entity OR one number with a denominator. Raw percentages without bases ("up 40%") are inert; raw statistics without identifiable cases trigger psychic numbing (Slovic).
4. **Identifiable case leads fact card 1.** Lead with the named individual / specific instance, then bracket with the statistic — never the other way. Identifiable victim effect (Small, Loewenstein & Slovic 2007).
5. **Reframe restructures, never adds.** A real reframe rotates the reader's mental model. Three forms all qualify:
   - **Causal restructuring:** *"The leak isn't the scandal. The audit's six-month delay is."*
   - **Value restructuring** — moves the issue from one moral category to another: *"Floods are not natural disasters when the causes are policy choices."*
   - **Question restructuring** — reframes what the issue is *about*: *"The question is not whether to regulate. It is who writes the rules."*
   What does NOT count: *"There are also concerns about…"* (additive). *"Perhaps the real issue is…"* (hedged). *"So what now?"* (rhetorical without restructuring). Adding evidence belongs on fact cards.
6. **View card must pass the WhatsApp-quote test.** Read only `view.big` with no context — does it stand as a sentence a thoughtful reader would paste into a WhatsApp group with no commentary? If not, it's a hedge, not a view.

**Per-issue rules**

7. **Repeat key terms across cards within an issue.** Don't elegant-vary "the contract" → "the deal" → "the agreement." Pick one phrase per entity per issue. Re-encountering a phrase boosts processing fluency, and processing fluency is misattributed to truth (Reber-Schwarz-Winkielman 2004).
8. **Middle fact card carries the most shocking number.** Pacing — Berger-Milkman (2012) showed physiological arousal drives sharing more than valence. The arousal peak should land on fact 2, earning the swipe through to the reframe.
9. **Vary the rhetorical shape of the reframe across issues.** Track the last 10 reframes. If they're all "X is not the story, Y is," prediction-error dopamine flatlines. Force variation: question, paradox, hard sentence, re-anchored number.
10. **Anger/anxiety check on every hook.** Berger-Milkman: sad issues are shared ~50% less even when they're the most important. If the hook's dominant emotion is sadness or generalized concern, reframe to anger-at-process or anxiety-of-precedent before publishing. The same facts, different emotion.

**Editorial-effort allocation (since 80% only read the hook)**
- Headline + hook card: ~50% of editing time
- Reframe card: ~20%
- View card: ~15%
- Three fact cards combined: ~15%

**Ethical lines that distinguish T4A from engagement-farms**
- The cliffhanger button must tease a real finding in the next card, not bait an emotional payoff that doesn't arrive.
- No algorithmic personalization of the feed. Every reader sees the same issues.
- No notification frequency above 3/week (Tue/Thu/Sat). Push fatigue is real.
- Anger at *processes* (no tender, missing audit, ignored petition) is non-partisan. Anger at *people* or *groups* is not. The reframe card is the highest-risk slot for crossing this line.

## Accuracy Standard

T4A's editorial brand is non-partisan trust. A single wrong number, misattributed quote, or overstated claim costs more credibility than ten accurate findings earn. Every published issue must clear this bar.

### The core rule
Every number, date, named actor, law citation, court case, and quote in a published issue MUST be **independently verified against a primary source** by at least one stage of the pipeline. Memory and training data do not count as verification.

**Primary source = one of:**
- Official government document, gazette, or regulator publication
- Court ruling or judgment text
- Peer-reviewed paper
- Named authoritative news outlet *citing* such a source (the citation must be checkable)

**NOT primary:** Wikipedia, Reddit, anonymous blogs, unsourced social media, your own training data, AI-generated summaries, "I remember reading this somewhere," or a previous T4A issue (that would be circular).

### The four cardinal sins (zero tolerance — block publication if any are present)
1. **Overclaim** — stating a number, scope, or causal certainty stronger than the source supports. *"RM2.4B vanished"* when the source says *"up to RM2.4B unaccounted for."* *"All MPs voted yes"* when the source says *"most."* *"The minister lied"* when the source says *"the minister's statement is contradicted by document Z."*
2. **Underclaim** — softening a finding the source actually supports. *"Some have alleged"* when there is a court ruling. *"There are concerns"* when the auditor general published *"systemic failure."*
3. **Misleading framing** — every individual fact technically true, but the selection or sequencing creates a false impression a reasonable reader would form. Selective dates, missing denominators, omitted caveats, cherry-picked comparisons.
4. **Unverified detail** — any specific number, date, named actor, law section, or quote that cannot be traced to a primary source listed in the research brief or a Stage 2/3/4/5 verification.

### Verification responsibility is shared across all 6 stages
Verification is NOT concentrated in Stage 3. Stage 3 has finite token budget — anything Stage 3 doesn't happen to check passes through unverified unless another stage caught it.

| Stage | Role | Accuracy duty |
|---|---|---|
| Phase 1 — Research brief | Claude | Use ≥8 primary sources of 15-25 total; flag every contradiction explicitly |
| Phase 2 — Stage 1 Primary Analysis | Claude | Read `engine/templates/stage1-preamble.txt`. Verify every claim before writing it. |
| Stages 2-5 — Cross-LLM review | External LLMs | Each has its own preamble in `engine/templates/`. Do not relax these. |
| Phase 5 — Stage 6 Synthesis | Claude | Read `engine/templates/stage6-preamble.txt`. Re-verify any wording you introduce — do not assume Stage 3 covered it. |
| Phase 6 — Legal + Accuracy Check | Claude | Walk every specific in the final text, trace each to a primary source. Block if any cannot be traced. |

### When in doubt
"I could not verify this within reasonable effort" is always better than a confident wrong claim. **Drop the claim, soften the framing, or hold the issue.** Reputational damage from a single wrong number is greater than the loss from one delayed publication.

### When sources contradict
Report all of them in the research brief, identify which is most authoritative (closest to primary, most recent, best methodology), use the authoritative one in the cards, and note the discrepancy in the brief's CONTRADICTIONS section. **Never silently choose the most favorable number.**

### 3R + accuracy interaction
The most dangerous overclaims are ones that implicate race, religion, or royalty. The verification bar is **higher** for these claims, not lower, because the harm from a wrong one is greater. If a claim about a 3R-adjacent topic cannot be verified to two independent primary sources, drop it.

### Audit history and tooling
Past audit snapshots live in [`docs/audits/`](docs/audits/) — each is dated and immutable. Before making editorial decisions on any published issue, check whether it appears in a recent audit report. The audit toolchain:

- `node scripts/audit-published.mjs` — main audit (structural, traceability, source quality, anti-pattern scan)
- `node scripts/triage-unauditable.mjs` — categorise zero-artifact issues into FALLBACK / LEGACY / ORPHAN
- `node scripts/confirm-tier2.mjs` — confirm whether Tier 2 corrections are reflected in current cards
- `node scripts/view-stage3.mjs <id>` — pretty-print any Stage 3 critique cross-referenced with current cards
- `node scripts/backfill-orphan-pipeline.mjs <id>` — generate research brief stub + Stage 1 JSON + Stage 2-5 browser prompts for any edited issue

The pipeline preambles in `engine/templates/stage{1-6}-preamble.txt` enforce this Accuracy Standard at every stage of generation and review. Future Claude sessions running the publishing pipeline must read the relevant preamble before generating that stage.

## Content Rules
- NO references to AI, models, Claude, GPT, or any AI provider
- Use "6 independent review stages" not "AI models"
- All analysis framed as editorial methodology
- Respect 3R: Race, Religion, Royalty — critique policy, not communities/beliefs
- Only use publicly available information
- Cite specific numbers, dates, sources in context
- **Every published claim must trace to a primary source** — see the Accuracy Standard section above. Memory and training data are not sources.
- **No overclaim, no underclaim, no misleading framing** — when the evidence is softer than the claim, soften the claim. When the framing is technically true but creates a false impression, rewrite or drop it.

## UI Features That Depend on Issue Data
- **Welcome card**: One-time inline card for first visitors explaining T4A and Opinion Shift. Dismissed permanently via localStorage.
- **Browse by Topic**: Today page groups issues by primary lens. Each issue's primary topic = most common lens across its fact cards. 6-8 topic chips expand inline to show top 5 issues.
- **Hero card score badge**: Inline Opinion Shift score visible without scrolling on all viewports.
- **Opinion Shift tooltips**: All score numbers show "{score} — {tier}: Reading only the headline would hide about {score}% of the story" on hover.
- **Editorial Quality Score**: `finalScore` displayed in desktop reader below Opinion Shift box with explanation.
- **Tracked in X issues**: Clickable label on fact cards linking to connected issues (desktop scrolls to completion section, mobile opens pattern sheet).
- **Read next**: Desktop completion shows "Read next issue" button when a next issue exists.
- **Reading path navigation**: Desktop progress segments are clickable with hover labels showing card type and lens.
- **Audit legend**: "?" button in VerdictBar explains circle/triangle/diamond shapes inline.
- **Homepage footer**: Trust links (About, Disclaimer, Verify) below editorial quote.
- **Section label**: "Earlier Issues" (not "Explore") for older issues in sidebar/feed.

## Architecture
- `src/data/issues/{id}.json` — one file per issue (canonical content source)
- `src/data/issues.ts` — thin loader that aggregates the per-issue JSONs via `import.meta.glob`
- `src/data/issue-types.ts` — shared types and helpers (`Issue`, `Card`, `CARD_TYPES`, `opinionLabel`, `opinionColor`, `issueCategory`)
- `scripts/lib/load-issues.mjs` — shared loader used by all Node build scripts
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

### Path A — Automated Publishing (Primary)

When the user provides a topic (e.g., "Add new issue: [topic]"), execute this 10-phase pipeline. The user's only manual actions are: 4 copy-paste rounds to external review stages, 1 image upload, and 1 final approval.

#### PHASE 0: INIT
1. `git pull --rebase origin main` — sync with remote
2. Scan `src/data/issues/` filenames for the highest issue ID → next ID = max + 1
3. Derive slug from topic (kebab-case, e.g., `temple-demolition-hate-crime`)
4. Ensure `engine/briefs/`, `engine/output/`, `engine/prompts-generated/` directories exist

#### PHASE 1: RESEARCH
1. Web search: exhaustive scan of all news on the topic + related historical cases
2. Write structured research brief following existing format in `engine/briefs/*.md`:
   - ISSUE, PERIOD, CONTEXT (timeline with dates and sources)
   - ACTORS (all people/institutions with roles)
   - RELEVANT LAW (legislation, constitutional articles)
   - KEY STATISTICS (quantified data with sources — every number must have a primary-source citation, including URL, document title, and page/section number)
   - 12-DIMENSION RISK ASSESSMENT: sentiment, political, ethnic, religious, narrative, completeness, temporal, confidence, sources, geographic, economic, gender — each with risk level (LOW/MEDIUM/HIGH/CRITICAL) and justification
   - RECOMMENDED LENSES
   - SOURCES (numbered bibliography, 15-25 citations) — must satisfy ALL of:
     - **At least 8 are PRIMARY sources** (official government documents, gazettes, court rulings, regulator publications, peer-reviewed papers). News articles count as secondary unless they directly cite and link a primary source you have separately opened.
     - **Sources span the political spectrum** (government-aligned, opposition-aligned, independent, international body, community voice, business). Single-spectrum coverage is an automatic CRITICAL on the "sources" risk dimension.
     - For every quantitative claim: exact source URL, document title, page or section number, and publication date. *"BNM 2024"* is not a citation; *"BNM Annual Report 2024, Table 3.2, p. 47, https://..."* is.
   - **CONTRADICTIONS** — any time two reputable sources gave different numbers, dates, or characterizations of the same fact, list both with citations and identify which you judged authoritative and why. Never silently choose the most favorable number.
   - **SOURCE SPECTRUM CHECK** — note explicitly which side of the political spectrum each major source comes from; flag if all sources are from one side.
3. Save to `engine/briefs/{slug}.md`
4. Present brief summary to user. **WAIT** for approval before proceeding.

#### PHASE 2: STAGE 1 — PRIMARY ANALYSIS (Claude runs this)
1. **Read `engine/templates/stage1-preamble.txt` first** and follow its accuracy contract throughout this phase. This is non-negotiable — Stage 1 is the factual foundation everything else rests on.
2. Using the research brief, generate 6-7 card analysis (7 if analogy card is warranted)
3. Output JSON matching `engine/output/*-stage1.json` schema:
   ```json
   {
     "cards": [
       { "t": "hook", "text": "...", "sub": "..." },
       { "t": "fact", "lens": "Economic", "h": "...", "s": "...", "d": "..." },
       { "t": "fact", "lens": "Political", "h": "...", "s": "...", "d": "..." },
       { "t": "fact", "lens": "Social", "h": "...", "s": "...", "d": "..." },
       { "t": "reframe", "h": "...", "text": "..." },
       { "t": "analogy", "h": "...", "text": "..." },
       { "t": "mature", "h": "The considered view", "text": "..." }
     ],
     "sources": "comma-separated source list",
     "confidence": "High/Medium/Low — justification",
     "lenses_used": ["Economic", "Political", "Social"],
     "lenses_applicable_but_unused": ["Legal", "Regional"]
   }
   ```
4. Save to `engine/output/{slug}-stage1.json`
5. Score PA (0-100): how thoroughly were primary sources used?

#### PHASE 3: GENERATE BROWSER PROMPTS
1. Run: `node scripts/generate-stage-prompts.mjs {slug}`
2. This reads `engine/output/{slug}-stage1.json` + `engine/templates/stage{2-5}-preamble.txt`
3. Produces 4 ready-to-paste prompt files in `engine/prompts-generated/`:
   - `{slug}-stage2-browser.txt` — for **Gemini** (Bias Audit)
   - `{slug}-stage3-browser.txt` — for **ChatGPT** (Fact Verification)
   - `{slug}-stage4-browser.txt` — for **DeepSeek/ChatGPT** (Alternative Framing)
   - `{slug}-stage5-browser.txt` — for **Grok** (Contrarian Stress-Test)
4. Present each prompt to user with clear label:
   ```
   === STAGE 2: BIAS AUDIT ===
   Paste the following into Gemini:
   [full prompt from file]
   ```

#### PHASE 4: COLLECT CROSS-LLM OUTPUTS
User pastes each prompt into the respective browser-based review tool, copies the JSON response back.

For each stage response:
1. Validate it is valid JSON (if not, ask user to re-paste)
2. Save to `engine/output/{slug}-stage{N}.json`
3. Extract key score:
   - Stage 2: `bias_score` → BA
   - Stage 3: `factual_accuracy_score` → FC
   - Stage 4: `completeness_score` → AF
   - Stage 5: `courage_score` → CT
4. After all 4 are collected, proceed to Phase 5.

#### PHASE 5: STAGE 6 — SYNTHESIS (Claude runs this)
1. **Read `engine/templates/stage6-preamble.txt` first** and follow its accuracy contract throughout this phase. Synthesis is exactly when overclaim, underclaim, and unverified-detail sneak in — the preamble exists to prevent that.
2. Read all 5 stage outputs (stage1 through stage5)
3. Integrate all critiques:
   - Apply fact corrections from Stage 3 (e.g., wrong numbers, dates, ages)
   - Address bias flags from Stage 2 (rephrase flagged quotes, balance perspectives)
   - Incorporate missing perspectives from Stage 4 (add missing community voices, international parallels)
   - Strengthen courage per Stage 5 flags (remove hedging, add hard truths)
4. **Re-verify any wording you introduce** during synthesis (rephrases, tightened headlines, sharper claims). Tag every change with one of: `CORRECTED (Stage 3)`, `REPHRASED (Stage 2)`, `ADDED (Stage 4)`, `STRENGTHENED (Stage 5)`, or `INTRODUCED (Stage 6 self-verified)`. If you cannot tag a change with one of these five categories, you have introduced something you should not have.
5. Track every revision in the synthesis output's notes
6. Save synthesis to `engine/output/{slug}-stage6-synthesis.json`
7. Score SR (0-100): quality of integrated synthesis

#### PHASE 6: READER OUTPUT + LEGAL CHECK
1. Transform synthesis into reader format:
   - Condense `h`/`text`/`d` fields → `big`/`sub` format
   - Enforce: big 5-200 chars, sub max 250 chars, big+sub max 350 chars
   - Map card type `mature` → `view`, keep `analogy` as-is
   - Capitalize lens names (e.g., `economic` → `Economic`)
   - Generate headline (10-120 chars, topic-first, no clickbait)
   - Generate context (20-350 chars, factual background)
   - Compute opinionShift (0-100): what % of full picture does the headline miss?
   - Assemble stageScores: `{ pa, ba, fc, af, ct, sr }`
   - Compute finalScore (weighted average of 6 stage scores)
2. Save to `engine/output/{slug}-reader.json`
3. Run **LEGAL + ACCURACY CHECK** on all final text (headline, context, card big/sub):
   - [ ] No 3R violations (Race, Religion, Royalty — critique policy, not communities)
   - [ ] No defamation risk (fair comment on public interest, no personal attacks)
   - [ ] No Official Secrets Act breach (only publicly available sources)
   - [ ] No Sedition Act risk (no advocacy for unlawful regime change)
   - [ ] No CMA Section 233 risk (not offensive, threatening, or harassing)
   - [ ] Content framed as analysis/opinion, not statements of fact
   - [ ] Consistent with `/disclaimer` page claims
   - [ ] **STEALTH CHECK**: No banned terms — AI, model, Claude, GPT, DeepSeek, Gemini, Grok, LLM, language model, Anthropic, OpenAI, ChatGPT
   - [ ] **FACT TRACE**: every number, date, named actor, law citation, and direct quote in the final text traces to either (a) a primary source listed in `engine/briefs/{slug}.md`, or (b) a VERIFIED claim in `engine/output/{slug}-stage{2,3,4,5}.json`, or (c) a Stage 6 self-verified entry tagged `INTRODUCED`. Walk each specific and confirm. Any specific that cannot be traced must be removed before publication.
   - [ ] **FOUR CARDINAL SINS CHECK** on final headline, context, and every card big/sub:
     - No OVERCLAIM (stronger than source supports)
     - No UNDERCLAIM (softer than source supports)
     - No MISLEADING FRAMING (selection or sequencing distorts the picture a reasonable reader would form)
     - No UNVERIFIED DETAIL (any specific not traced above)
   - [ ] **NO DRIFT FROM STAGE 6**: every wording change introduced during synthesis (Phase 5) was either applied from a stage critique with explicit traceability, or independently re-verified per stage6-preamble. No silent rephrasings that change meaning.
4. Present legal + accuracy clearance report to user
5. Present complete issue object (ready to write to `src/data/issues/{id}.json`)

#### PHASE 7: SHERLOCK + IMAGE
**Sherlock Connection Scan:**
1. Extract entities from new issue text (headline + context + all card big/sub):
   - Institutions: match against the list in `scripts/build-fact-graph.mjs` (MACC, PAC, AGC, BNM, EPF, PETRONAS, Khazanah, MCMC, JAKIM, MITI, Parliament, High Court, Federal Court, PAS, DAP, UMNO, PKR, Bersatu, Sabah, Sarawak, Penang, etc.)
   - Legislation: SOSMA, POCA, Sedition Act, OSA, Federal Constitution, Article 10/8/121/153, CMA, etc.
   - Money: `RM[\d,.]+\s?[BMbm]` regex pattern
2. Read `public/fact-graph.json` entities index
3. Find matching issues: weight ≥ 2 shared entities AND at least 1 non-money entity
4. Present top connections with issue IDs, headlines, and shared entities
5. Propose `related[]` for new issue + bidirectional updates on connected issues
6. If any connected issue is unpublished, flag it for user decision

**Image Prompt:**
Generate and present to user:
```
=== ISSUE {ID}: {HEADLINE} ===

Single continuous line art drawing on deep dark navy background (#0f0f23).
One unbroken white line (#FFFFFF, stroke weight 3px) depicting:
[METAPHORICAL DESCRIPTION — one symbolic visual that captures the issue's tension]
Style: minimalist single-line illustration, Pablo Picasso continuous line drawing.
No fill, no shading, no color other than white line on navy.
Elegant, contemplative, editorial. Ample negative space.
No text, no logos, no watermarks.
Aspect ratio exactly 1.91:1 wide landscape format. 2400x1260 pixels.

Save as: public/og/backgrounds/issue-{ID}-bg.png
```

**WAIT** for user to:
1. Approve/adjust Sherlock connections
2. Generate image externally and upload it

#### PHASE 8: VALIDATE + REVIEW
1. Process uploaded image → move to `public/og/backgrounds/issue-{ID}-bg.png`
2. Write issue to `src/data/issues/{ID}.json`
3. Update `related[]` on connected issues (bidirectional — edit each connected issue's JSON file)
4. Set `"published": true` and `"sourceDate"` to today's date
5. Run `node scripts/validate-issues.mjs` — **must exit 0**
6. Verify background image exists at expected path
7. Grep all issue text for stealth banned terms (must find zero)
8. Present validation report:
   ```
   VALIDATION: PASS
   IMAGE: EXISTS (public/og/backgrounds/issue-{ID}-bg.png)
   STEALTH: CLEAN (no banned terms)
   LEGAL: PASS (all 8 checks clear)
   CONNECTIONS: N bidirectional updates
   ```
9. **WAIT** for user to say "Publish" or request changes.

#### PHASE 9: DEPLOY
After user says "Publish":
1. `git pull --rebase origin main` — handle parallel worker changes
2. If rebase conflict in a related issue's JSON (because multiple workers added connections): resolve by merging the `related` arrays, re-run validation. New issue JSONs rarely conflict because each is its own file.
3. If conflict in other files: alert user
4. Stage all files:
   - `src/data/issues/{ID}.json` (new)
   - `src/data/issues/{related-ID}.json` for each bidirectional connection update
   - `public/og/backgrounds/issue-{ID}-bg.png` (new)
   - `engine/briefs/{slug}.md` (new)
   - `engine/output/{slug}-stage*.json` (7 files)
   - `engine/output/{slug}-reader.json` (new)
   - `engine/prompts-generated/{slug}-stage*-browser.txt` (4 files)
5. Commit: `"Publish: issue {ID} — {headline truncated to 50 chars}"`
6. `git push origin main`
7. Report to user:
   - "Pushed to main. GitHub Actions will build and deploy."
   - "Live URL: https://thefourthangle.pages.dev/issue/{ID}"
   - "Notifications fire on next CRON schedule (Tue/Thu 8am, Sat 9am MYT)"

### Engine File Conventions
- **Slug**: kebab-case derived from topic (e.g., `temple-demolition-hate-crime`)
- **Brief**: `engine/briefs/{slug}.md`
- **Stage outputs**: `engine/output/{slug}-stage{1-5}.json`, `{slug}-stage6-synthesis.json`, `{slug}-reader.json`
- **Browser prompts**: `engine/prompts-generated/{slug}-stage{2-5}-browser.txt`
- **Preamble templates**: `engine/templates/stage{2-5}-preamble.txt` (fixed instructions, do not modify per-issue)
- **Prompt generator**: `node scripts/generate-stage-prompts.mjs {slug}`

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
