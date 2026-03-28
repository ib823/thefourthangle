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
