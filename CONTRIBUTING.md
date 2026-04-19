# Contributing to The Fourth Angle

Welcome. This guide covers the two contribution surfaces: **editorial** (new issues, corrections) and **engineering** (UI / build / infra changes). Both have their own rhythms.

## Editorial

New issues + corrections follow the 10-phase pipeline in [`CLAUDE.md`](./CLAUDE.md). If you're researching a new issue for publication, that's your entry point — it covers research briefs, Stage 1-6 preambles, legal/accuracy check, image prompts, and deployment.

Content lives at `src/data/issues/{id}.json`. Never edit published issues without also:
1. Setting `"status": "updated"` and incrementing `edition`.
2. Re-running `node scripts/sign-content.mjs` (or letting CI do it).
3. Documenting the change in the commit message.

See [`CLAUDE.md`](./CLAUDE.md) → "Accuracy Standard" for the four cardinal sins (overclaim, underclaim, misleading framing, unverified detail) — every editorial PR is gated on these.

## Engineering

### Setup

```bash
npm install
npm run dev
```

Node 22+. Biome for lint, Astro check for types, Vitest for unit tests, Playwright for e2e.

### Parity rules for every PR

If the PR touches UI, state, CSS, or build output, it must pass every item in the [Parity Checklist](./docs/cross-browser-parity/parity-checklist.md) before merge. The checklist is grouped by phase so you can see which rule traces to which design decision.

Every PR description must include:

1. **Summary** — what changed and why.
2. **How to verify** — manual + automated steps. Include `curl` / `grep` one-liners that a reviewer can paste.
3. **Screenshots** — mobile (390×844), tablet (820×1180), and desktop (1440×900) viewports if the change is visual.
4. **Accessibility confirmations:**
   - Keyboard-only flow passes.
   - Focus visible on new interactive elements.
   - Reduced-motion + forced-colors + dark-mode spot-checks if applicable.
5. **Bundle-size delta** — output of `npm run check-bundle` (showing the baseline comparison).
6. **CI green** — `npm run check`, `npm run lint`, `npm test`, `npm run build`, `npm run e2e`.

See [`.github/pull_request_template.md`](./.github/pull_request_template.md) — the template is auto-populated on new PRs.

### Test-hook rules

Playwright selectors **must** use:

- ARIA roles: `page.getByRole('button', { name: 'Share' })`
- Accessible names: `page.getByLabel(...)`
- Text content: `page.getByText(...)`
- Repo-owned `data-*` attributes: `page.locator('[data-section="continue"]')`

Playwright selectors **must not** use:

- Class names (stealth renames `svelte-*` post-build).
- `data-astro-*` attributes (stealth renames to `data-c-*` / `data-x`).
- Framework tag names (`astro-island` renames to `d-island`).

The stealth script (`scripts/stealth.mjs`) is the post-build fingerprint stripper. Tests must adapt to its output, not the other way round.

### Inline-script rule

New `<script is:inline>` blocks must **not** contain framework names (`astro`, `svelte`, `astro-island`) in comments or strings — the stealth verification scanner fails the build. Keep inline-script comments terse and free of framework references.

### ADR workflow

Non-obvious architectural decisions get recorded as MADR (Markdown Any Decision Record) files under [`docs/adr/`](./docs/adr/).

File a new ADR when the PR:

- Introduces or removes a runtime component / third-party service.
- Changes the state model, signing model, or deploy pipeline.
- Adopts or retires a specific library / tool / pattern with multi-component impact.
- Deliberately chooses one option when alternatives exist (document rejected options).

Numbering is sequential: next free `NNNN-<slug>.md`.

### Commit style

- Conventional commits: `feat(scope): …`, `fix(scope): …`, `docs(scope): …`, etc.
- One concern per commit. Parity follow-ups get their own PRs rather than piling into an existing one.
- Co-authored trailer for AI-assisted work: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

### Phase-gated priority

Parity phases 0-10 are complete. Future work should map to one of:

- Content — follows `CLAUDE.md`.
- Parity polish — follow up on any TODO in `docs/cross-browser-parity/*.md`.
- New feature — opens with an ADR first, implementation second.
- Accessibility session results — update `docs/cross-browser-parity/55-at-matrix.md` as the real screen-reader runs happen.

## Questions

Open a discussion on the repo. Trust links:

- Disclaimer: https://thefourthangle.pages.dev/disclaimer
- Verify: https://thefourthangle.pages.dev/verify
- About: https://thefourthangle.pages.dev/about
