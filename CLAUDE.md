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
    { t: "analogy", big: "Think of it like a building inspector who only checks the lobby", sub: "Accessible comparison that reframes the issue for everyday understanding" },
    { t: "view", big: "The considered view — balanced synthesis", sub: "" },
  ]
}
```

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
1. Find the issue by ID in `src/data/issues.ts`
2. Update the content
3. Change `status: "updated"`, increment `edition`
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
- **Mobile attention span**: drops sharply after ~8 seconds per chunk. One claim per card = one breath of attention.
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
Better to leave `sub: ""` than to pad. The `reframe` and `view` cards typically need no `sub` at all — the big claim is the whole point.

## Content Rules
- NO references to AI, models, Claude, GPT, or any AI provider
- Use "6 independent review stages" not "AI models"
- All analysis framed as editorial methodology
- Respect 3R: Race, Religion, Royalty — critique policy, not communities/beliefs
- Only use publicly available information
- Cite specific numbers, dates, sources in context

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

### Path A — Automated Publishing (Primary)

When the user provides a topic (e.g., "Add new issue: [topic]"), execute this 10-phase pipeline. The user's only manual actions are: 4 copy-paste rounds to external review stages, 1 image upload, and 1 final approval.

#### PHASE 0: INIT
1. `git pull --rebase origin main` — sync with remote
2. Scan `src/data/issues.ts` for the highest issue ID → next ID = max + 1
3. Derive slug from topic (kebab-case, e.g., `temple-demolition-hate-crime`)
4. Ensure `engine/briefs/`, `engine/output/`, `engine/prompts-generated/` directories exist

#### PHASE 1: RESEARCH
1. Web search: exhaustive scan of all news on the topic + related historical cases
2. Write structured research brief following existing format in `engine/briefs/*.md`:
   - ISSUE, PERIOD, CONTEXT (timeline with dates and sources)
   - ACTORS (all people/institutions with roles)
   - RELEVANT LAW (legislation, constitutional articles)
   - KEY STATISTICS (quantified data with sources)
   - 12-DIMENSION RISK ASSESSMENT: sentiment, political, ethnic, religious, narrative, completeness, temporal, confidence, sources, geographic, economic, gender — each with risk level (LOW/MEDIUM/HIGH/CRITICAL) and justification
   - RECOMMENDED LENSES
   - SOURCES (numbered bibliography, 15-25 citations)
3. Save to `engine/briefs/{slug}.md`
4. Present brief summary to user. **WAIT** for approval before proceeding.

#### PHASE 2: STAGE 1 — PRIMARY ANALYSIS (Claude runs this)
1. Using the research brief, generate 6-7 card analysis (7 if analogy card is warranted)
2. Output JSON matching `engine/output/*-stage1.json` schema:
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
3. Save to `engine/output/{slug}-stage1.json`
4. Score PA (0-100): how thoroughly were primary sources used?

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
1. Read all 5 stage outputs (stage1 through stage5)
2. Integrate all critiques:
   - Apply fact corrections from Stage 3 (e.g., wrong numbers, dates, ages)
   - Address bias flags from Stage 2 (rephrase flagged quotes, balance perspectives)
   - Incorporate missing perspectives from Stage 4 (add missing community voices, international parallels)
   - Strengthen courage per Stage 5 flags (remove hedging, add hard truths)
3. Track every revision: `"CORRECTED (Stage 3): ...", "ADDED (Stage 4): ..."`
4. Save synthesis to `engine/output/{slug}-stage6-synthesis.json`
5. Score SR (0-100): quality of integrated synthesis

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
3. Run **LEGAL CHECK** on all final text (headline, context, card big/sub):
   - [ ] No 3R violations (Race, Religion, Royalty — critique policy, not communities)
   - [ ] No defamation risk (fair comment on public interest, no personal attacks)
   - [ ] No Official Secrets Act breach (only publicly available sources)
   - [ ] No Sedition Act risk (no advocacy for unlawful regime change)
   - [ ] No CMA Section 233 risk (not offensive, threatening, or harassing)
   - [ ] Content framed as analysis/opinion, not statements of fact
   - [ ] Consistent with `/disclaimer` page claims
   - [ ] **STEALTH CHECK**: No banned terms — AI, model, Claude, GPT, DeepSeek, Gemini, Grok, LLM, language model, Anthropic, OpenAI, ChatGPT
4. Present legal clearance report to user
5. Present complete issue object (ready for `issues.ts`)

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
2. Insert issue into `src/data/issues.ts` (append before closing `];`)
3. Update `related[]` on connected issues (bidirectional)
4. Set `published: true`, `sourceDate` to today's date
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
2. If rebase conflict in `issues.ts`: resolve by keeping both entries (they're independent array items), re-run validation
3. If conflict in other files: alert user
4. Stage all files:
   - `src/data/issues.ts` (modified)
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
