# ADR-0001: Font payload budget is 60 KB brotli on-the-wire

**Status:** Accepted (2026-04-18)
**Supersedes:** Phase 4 v2 brief "≤ 20 KB brotli" budget.
**Related:** `docs/cross-browser-parity/00-audit.md` § F (font inventory + measurements); `docs/cross-browser-parity/brief-v3.md` Phase 4.

## Context

The v2 brief set Phase 4's total font-payload budget at 20 KB brotli, "4× current headroom." Phase 0 audit measured the actual payload:

```
manrope-latin.woff2:  24,836 bytes raw / 24,833 bytes brotli-9
nunito-latin.woff2:   31,076 bytes raw / 31,075 bytes brotli-9
total:                55,912 bytes raw / 55,908 bytes brotli-9
```

Brotli-recompressing a `.woff2` file gains effectively nothing: woff2 is a Brotli-compressed container for the underlying sfnt tables. The 20 KB target was based on a measurement error — one that assumed brotli-over-HTTP would further compress woff2 the way it compresses CSS or HTML.

## Decision

**Total delivered font payload ≤ 60 KB brotli, measured on-the-wire.**

"On-the-wire" means: if the origin server and client negotiate `Content-Encoding: br`, CI measures the brotli-encoded response body. If the server serves the `.woff2` file verbatim (no HTTP-layer re-encoding — the common case), CI measures the raw `.woff2` file size. Both should be close; the rule is "what the client actually downloads."

## Consequences

### Positive
- Keeps both families (Manrope display, Nunito Sans body), which preserves the site's design identity.
- Honest measurement — future contributors won't try to "restore" the 20 KB target by misreading the number.
- Realistic headroom for one more weight or a second critical weight preload per family if needed.

### Negative
- Larger initial font transfer than the v2 brief implied. Mitigated by:
  - `font-display: swap` (already in place).
  - Only preloading **one critical weight per family** (e.g. Manrope 700 for headlines, Nunito Sans 400 for body). Other weights lazy-load on first use.
  - Aggressive Cloudflare cache headers (year-long `Cache-Control: public, max-age=31536000, immutable` for hashed font assets).
  - `prefers-reduced-data` path skips font preload (Phase 5).

### Neutral
- CI must measure the shipped artefacts, not the source files. If Cloudflare ever adds HTTP-layer compression, CI must follow. Ideally Phase 9 measures via an actual `fetch()` in the CI browser, reading the `Transfer-Encoding` / `Content-Encoding` headers and the response body length.

## Alternatives considered

- **A. Keep the 20 KB target; drop one family.** Rejected — single-family typography flattens the display vs body distinction that carries editorial voice.
- **B. Keep the 20 KB target; drop weight range (single weight per family).** Rejected — current range (400-700 Nunito, 600-800 Manrope) is tuned for the design; narrowing would force visible compromises on "Opinion Shift" score prominence, card-type labels, and reading-flow emphasis.
- **C. System fonts only (`system-ui` stack); 0 KB font payload.** Rejected — best pure-parity answer but a design regression. Platform fonts vary too much in x-height, weight mapping, and ligature behaviour to carry the "editorial weight" the design intends. Kept as a fallback option if future parity requirements force it.
- **D. Further unicode-range subsetting within Latin.** Rejected — the files are already latin-core subsets per their filenames (`*-latin.woff2`). Further narrowing would drop diacritics needed for Malay.
- **E. Variable fonts with a narrow weight axis.** Rejected as out of scope for this refactor — the current files are not variable, and switching format is a design-side project, not a parity-refactor task.

## Enforcement

Phase 9 adds a CI check: `scripts/check-font-budget.mjs` (or equivalent) runs after build, measures each served font file, sums, and fails if total > 60 KB. The script must account for any future server-side compression.

## Revisit conditions

This ADR should be revisited if any of the following change:

- Cloudflare Pages begins applying HTTP-layer compression to `.woff2` (unlikely; `.woff2` is marked non-compressible by sensible servers because it already is compressed).
- A third font family is added (budget would need to scale or a family dropped).
- Variable fonts replace the current files (budget moves down; variable woff2 typically smaller than multiple static weights).
- LCP metrics on Mobile 3G prove that font-render delay is material to perceived performance (would argue for preloading more weights, still within budget).
