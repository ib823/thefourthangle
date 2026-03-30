# THE FOURTH ANGLE — Complete Pipeline v3.1
## Definitive Operational & Theoretical Foundation

**Version:** 3.1 FINAL
**Date:** March 2026
**Status:** Operational. Submitted for hostile peer review.
**Classification:** CONFIDENTIAL — INTERNAL METHODOLOGY
**Supersedes:** Pipeline v3.0 and all prior versions.

---

# TABLE OF CONTENTS

```
PART 1: WHAT THIS IS (and what it is not)
PART 2: MATHEMATICAL FRAMEWORK (summary — full detail in mathematical-model.md v2.0)
  2.1  Bias Space (12 dimensions)
  2.2  Geometric Median (finding mathematical centre)
  2.3  Spectral Analysis (Fourier decomposition of narrative)
  2.4  Evidence Fusion (Dempster-Shafer theory)
  2.5  Omission Detection (set-theoretic)
  2.6  Composite Audit Score
  2.7  Provable Guarantees
  2.8  Permanent Limitations (declared honestly)
PART 3: INDEPENDENCE ARCHITECTURE
  3.1  Why pure independence is impossible
  3.2  Maximum decorrelation strategy
  3.3  Effective sample size
  3.4  Independence Index
PART 4: WEAKNESS MITIGATIONS
  4.1  Solvable problems (with fixes)
  4.2  Reducible problems (with reductions)
  4.3  Permanent limits (with declarations)
PART 5: THE PROMPT SYSTEM (internal — stage-to-system assignments)
  5.1  Stage 1: Primary Analysis
  5.2  Stage 2: Bias Audit
  5.3  Stage 3: Fact Verification
  5.4  Stage 4: Alternative Framing
  5.5  Stage 5: Contrarian Stress-Test
  5.6  Stage 6: Synthesis Review
PART 6: ISSUE BRIEFS (All 28 + meta-series)
  6.1  Tier 1: Launch content (5 issues, full briefs)
  6.2  Tier 2: Week 2-4 content (5 issues)
  6.3  Tier 3: Ongoing rotation (18 issues)
  6.4  Meta-series: Social Fabric Deterioration
PART 7: OPERATIONAL RUNBOOK
  7.1  Manual method (no coding, start today)
  7.2  API method (automation)
  7.3  File structure
  7.4  Troubleshooting
  7.5  Cost model
PART 8: CLAIMS AND LIMITS DECLARATION (public-facing — no proprietary references)
PART 9: HOSTILE REVIEW SUBMISSION INSTRUCTIONS
```

---

# PART 1: WHAT THIS IS (AND WHAT IT IS NOT)

## What The Fourth Angle IS

A non-partisan Malaysian issues platform that uses a **6-stage adversarial editorial pipeline**, combined with a mathematical bias measurement framework, to produce multi-lens analysis of public issues.

On any Malaysian issue, there are at least three dominant narratives — the government's angle, the opposition's angle, and the social media mob's angle. All three are shaped by political incentive. The Fourth Angle provides the structural, systemic, facts-first perspective that makes all three uncomfortable.

## What The Fourth Angle IS NOT

- It is NOT neutral. No system can be neutral. It is measurably balanced.
- It is NOT legally bulletproof. The math demonstrates editorial care, not legal immunity.
- It is NOT independent of its creators. The dimension choices, weight parameters, and threshold decisions are editorial judgments. They are published openly.
- It is NOT a replacement for human judgment. It is a tool that makes human judgment more informed.
- It is NOT revolutionary. It combines established mathematics (1937-1967) in a novel application. The unprecedented element is radical transparency, not mathematical novelty.

## The Actual Unprecedented Claim

No media outlet in the world publishes the full bias vector, spectral profile, inter-stage conflict score, independence index, and dimension revision history of every piece of content. The Fourth Angle does. The claim is not "we are neutral." The claim is: "We show you exactly how biased we might be, measured against a published standard, with all the math visible, so you can judge for yourself."

## Operational Confidentiality

The technology powering each analytical stage is proprietary. The methodology — the mathematical framework, the bias dimensions, the scoring — is published openly. The tooling is not. This is standard practice for any editorial operation. See addendum-no-ai-references.md for complete public vocabulary guidelines.

---

# PART 2: MATHEMATICAL FRAMEWORK

**Full mathematical detail is in `fourth-angle-mathematical-model.md` v2.0.**
This section provides the operational summary referenced by the pipeline.

## 2.1 Bias Space (12 Dimensions)

Every document is mapped to a coordinate in 12-dimensional Bias Space.

```
β(d) = (s, p, e, r, f, o, t, c, sd, g, ec, ga) ∈ ℝ^12
```

### The 12 Dimensions

| # | Dimension | Symbol | Range | Reader Label | Measures |
|---|-----------|--------|-------|-------------|----------|
| 1 | Sentiment valence | s | [-1,+1] | Tone | Net positive/negative tilt |
| 2 | Political lean | p | [-1,+1] | Political | Differential portrayal of political actors |
| 3 | Ethnic framing | e | [0,1] | Ethnic | Agency asymmetry across ethnic groups |
| 4 | Religious sensitivity | r | [-1,+1] | Religious | Religious framing where factually irrelevant |
| 5 | Narrative framing | f | [-1,+1] | Narrative | Active vs passive voice distribution across actors |
| 6 | Omission index | o | [0,1] | Completeness | Proportion of consensus facts absent |
| 7 | Temporal bias | t | [-1,+1] | Timing | Over-weighting recent vs historical context |
| 8 | Confidence inflation | c | [-1,+1] | Certainty | Overclaiming vs appropriate hedging |
| 9 | Source diversity | sd | [0,1] | Sources | Range and spectrum of sources consulted |
| 10 | Geographic bias | g | [-1,+1] | Geographic | KL/urban-centric vs national perspective |
| 11 | Economic framing | ec | [-1,+1] | Economic | Class/wealth angle in portrayal |
| 12 | Gender agency | ga | [0,1] | Gender | Agency/voice distribution across genders |

**Reader-friendly labels** (column 5) are displayed in the app. Technical names are available on tap/hover.

### Key Measurement Formulas

**Political Lean (dimension 2):**

```
For each political actor a in document d:
  portrayal(a, d) = (1/N_a) × Σ sentiment(sentence_j) over N_a sentences mentioning a

p(d) = mean(portrayal over govt actors) - mean(portrayal over opposition actors)
```

p > 0: favours government. p < 0: favours opposition. p ≈ 0: balanced.

**Ethnic Framing (dimension 3):**

```
For each ethnic group g in document d:
  agency(g, d) = (sentences where g is grammatical subject performing action) / (total sentences mentioning g)

e(d) = max_g(agency(g,d)) - min_g(agency(g,d))
```

e ≈ 0: equal agency for all groups. e → 1: one group active, another passive.

**Source Diversity (dimension 9):**

```
sd(d) = 0.5 × spectral_diversity(source_positions) + 0.5 × type_diversity(institutional_types)
```

**Geographic Bias (dimension 10):**

```
g_composite(d) = 0.6 × (federal_core_overrepresentation) + 0.4 × (east_malaysia_deficit)
```

**Economic Framing (dimension 11):**

```
ec(d) = (positive_portrayal_T20_corporate) - (positive_portrayal_B40_SME)   normalised to [-1,+1]
```

**Gender Agency (dimension 12):**

```
ga_composite(d) = 0.6 × |agency(male) - agency(female)| + 0.4 × |0.5 - voice_ratio(female_quotes)|
```

Full measurement methodology for all 12 dimensions: see mathematical-model.md §2.1.1–§2.1.8.

### Dimension Expansion Protocol

Quarterly adversarial audit. Current candidate dimensions for future expansion:

| Proposed | What it catches | Priority |
|----------|----------------|----------|
| Monarchy deference | Uncritical treatment of royalty | MEDIUM |
| Generational framing | Youth perspectives patronised | MEDIUM |
| Disability representation | Ableist framing or absence | LOW |
| Environmental weighting | Environmental impacts minimised | LOW |

Validation criteria: correlation r < 0.8 with existing dimensions across 100 articles, inter-rater kappa ≥ 0.6, significant variance on Malaysian articles.

---

## 2.2 Geometric Median — Finding Mathematical Centre

Given source vectors β₁, ..., βₙ with credibility weights w₁, ..., wₙ:

```
β* = argmin_x Σᵢ [wᵢ × ‖x - βᵢ‖₂]
```

Computed via Weiszfeld's Algorithm. Converges in 2-3 iterations with dynamic weight adjustment.

**Credibility Weighting (3 layers):**

```
w_static(i) = accuracy_history(i) × independence(i) × specificity(i)
w_dynamic(i) = w_static(i) × [1 / (1 + distance(source_i, current_median))]
w_adjusted(i) = w_dynamic(i) × [1 / avg_correlation_with_others(i)]
```

Key property: **50% breakdown point** — up to 2/5 adversarial sources tolerated.

---

## 2.3 Spectral Analysis of Narrative

Sentence-level sentiment trajectory (N ≈ 100), analysed via Discrete Fourier Transform.

Three scores:

| Score | Formula | Good | Bad |
|-------|---------|------|-----|
| NDS (Narrative Drift) | low-freq energy / total energy | ≈ 0 | → 1 |
| EMS (Emotional Manipulation) | high-freq energy / total energy | ≈ 0 | high |
| SF (Spectral Flatness) | geometric mean / arithmetic mean of ‖Fₖ‖² | = 1 | → 0 |

**Cannot detect:** factual omission, subtle word-choice bias, structural bias, sarcasm, code-switching.

**Validation requirement (non-negotiable):** Test on 50 articles with known lean before shipping. If correlation < 0.5 with human assessment, downweight or remove from composite.

---

## 2.4 Evidence Fusion — Dempster-Shafer Theory

For each factual claim C, each of 5 independent analytical stages provides:

```
m_i(C)  = belief TRUE     [0,1]
m_i(¬C) = belief FALSE    [0,1]
m_i(Θ)  = uncertainty     [0,1]
Sum = 1.0
```

**Combination rule:** iterative pairwise combination across all 5 stages.

**Conflict thresholds:**

| K | Meaning | Action |
|---|---------|--------|
| < 0.3 | Low conflict | Combination reliable |
| 0.3-0.7 | Moderate | Flag for editorial review |
| ≥ 0.7 | High | DO NOT auto-publish |

**Decision rules:**

| m(C) | m(¬C) | K | Decision |
|------|-------|---|----------|
| ≥ 0.7 | < 0.2 | < 0.3 | Include as established fact |
| ≥ 0.5 | < 0.3 | < 0.5 | Include with hedging |
| < 0.5 | < 0.5 | any | Present as disputed |
| < 0.2 | ≥ 0.7 | < 0.3 | Exclude or refute |
| any | any | ≥ 0.7 | Editorial review required |

**Belief mass extraction:** All 5 stages rate confidence per claim using calibrated structured format. Validated against 50 known-truth claims.

---

## 2.5 Omission Detection

```
F_total = F₁ ∪ F₂ ∪ ... ∪ Fₙ
coverage(f) = |{i : f ∈ Fᵢ}| / n
Consensus-relevant if coverage(f) ≥ τ (default 0.6 = 3/5 stages)
omission(i) = |{consensus-relevant facts absent from source i}| / |consensus-relevant facts|
```

Final output target: completeness ≥ 0.95.

**Critical limitation:** If ALL sources omit the same fact, the system cannot detect it.

---

## 2.6 Composite Audit Score

```
Score = 100 × (1 - α₁·‖β*‖ - α₂·NDS - α₃·EMS - α₄·(1-SF) - α₅·K_avg - α₆·(1-completeness))
```

**Weights:**

```
α₁ = 0.25  (bias position — most important)
α₂ = 0.15  (narrative drift)
α₃ = 0.15  (emotional manipulation)
α₄ = 0.10  (spectral flatness)
α₅ = 0.20  (inter-stage conflict — second most important)
α₆ = 0.15  (factual completeness)
```

**Score interpretation (unified thresholds — apply everywhere):**

| Score | Meaning | Action |
|-------|---------|--------|
| 85-100 | Verified balanced | Auto-publish with confidence |
| 70-84 | Good, minor flags | Review flagged items, then publish |
| 50-69 | Significant issues | Major revision required |
| < 50 | Failed | Rewrite from scratch |

**Boundary sensitivity rule:** For scores within 5 points of the 85 or 70 thresholds (80-89 or 65-74), weight sensitivity analysis is mandatory. Vary α weights ±0.05. If different reasonable weights change tier classification, bump down one tier.

**Confidence interval:**

```
Score = 78 ± 7 (95% CI, adjusted for source correlation)
```

Unadjusted CI ≈ ±4. Widened by √(n/n_eff) to account for inter-stage correlation. Consistent with T4A's own Confidence Inflation dimension (dimension 8).

---

## 2.7 Provable Guarantees

1. Geometric median = minimum total distance (Weiszfeld 1937)
2. 50% breakdown point (Lopuhaä & Rousseeuw 1991)
3. DFT is lossless and invertible
4. DS combination is commutative and associative
5. Fixed inputs + parameters = deterministic output (reproducible)

## 2.8 Permanent Limitations (Declared Honestly)

1. Bias dimensions are editorially chosen — blind outside the 12-axis coordinate system
2. NLP sentiment is imperfect — sarcasm, code-switching, cultural nuance
3. Analytical stages may be correlated — shared reference data means shared blind spots
4. Universal omission undetectable — if all sources miss it, we miss it
5. Balance is not truth — the centre of wrong sources is still wrong
6. Math does not establish legal immunity — different epistemic domain
7. Malaysian linguistic complexity exceeds generic NLP capacity
8. Neutrality is undefined — claim is "measurably balanced," not "neutral"

---

# PART 3: INDEPENDENCE ARCHITECTURE

## 3.1 Why Pure Independence Is Impossible

Two variables X, Y are independent iff P(X and Y) = P(X) × P(Y). For analytical stages sharing reference data, knowing one stage's output gives information about another. This is dependence by definition. No framework changes this.

## 3.2 Maximum Decorrelation Strategy

| Strategy | Effect | Status |
|----------|--------|--------|
| Different analytical systems from different providers | Reduces shared methodological bias | Done |
| Different training origins (including non-Western sources) | Reduces shared knowledge bias | Partial |
| Non-automated sources (journalists, academics, civil society) | Near-zero correlation with automated stages | Recommended |
| Different adversarial roles per stage | Reduces shared analytical bias | Done |
| Multi-language source inputs (Malay, Chinese, Tamil) | Reduces English framing bias | Phase 2 |
| Malaysia-calibrated analytical capability | Reduces Western-perspective bias | Phase 2 |

## 3.3 Effective Sample Size

```
n_eff = n / (1 + (n-1) × ρ_avg)
```

| Configuration | n | ρ_avg | n_eff |
|--------------|---|---------|-------|
| 5 automated stages only | 5 | ~0.6 | ~1.5 |
| 5 automated + 3 human sources | 8 | ~0.35 | ~3.8 |
| 5 automated + 3 human + Malaysia-calibrated | 9 | ~0.28 | ~5.1 |

Confidence intervals widened by √(n / n_eff).

**Measurement:** For each of the 12 bias dimensions, compute each stage's estimate on 30+ issues. Pairwise Pearson correlation. Average across all pairs and dimensions.

## 3.4 Independence Index

```
I = 1 - ρ_avg
```

| I | Meaning |
|---|---------|
| > 0.8 | Highly independent (unlikely with automated stages only) |
| 0.6-0.8 | Moderately independent (achievable with automated + human) |
| 0.4-0.6 | Weakly independent (current 5-stage automated setup) |
| < 0.4 | Correlated (fusion provides false confidence) |

Published on every output: "Independence Index: I = [value]. Target: I > 0.6."

---

# PART 4: WEAKNESS MITIGATIONS

## 4.1 Solvable

**Spectral resolution:** Sentence-level (N≈100) instead of paragraph-level (N≈15). Validated against 50 articles with known lean before shipping.

## 4.2 Reducible

**Bias dimensions:** Quarterly adversarial audit expands dimension set from current 12. Published with revision history.

**Stage correlation:** Measure ρ_avg, report n_eff, add human sources, use correlation-adjusted weights.

**NLP accuracy:** 500-sentence Malaysian calibration dataset. Multi-stage median sentiment. Residual error measured and propagated.

**Belief extraction:** Structured prompts with calibration guidelines. All 5 independent stages rate confidence per claim. Validated against 50 known-truth claims.

**Audience self-selection:** Screenshot-optimised reframe cards. Multi-channel distribution (WhatsApp, Telegram, TikTok, X). Impact measured by REACH not downloads.

## 4.3 Permanent (declared)

**Neutrality undefined:** Declared. Claim is "measurably balanced," not "neutral."

**Legal immunity:** Declared. Math demonstrates editorial care, not legal protection. 3R content gets human legal review regardless of score.

---

# PART 5: THE PROMPT SYSTEM

## Internal Stage-to-System Assignments

**CONFIDENTIAL — The following assignments are proprietary operational detail. They must NEVER appear in any user-facing text, code comment in shipped code, public material, or metadata. See addendum-no-ai-references.md.**

| Stage | Public Label | Internal Assignment | Role |
|-------|-------------|-------------------|------|
| 1 | Primary Analysis | Claude Sonnet (Anthropic) | Comprehensive first-pass analysis |
| 2 | Bias Audit | DeepSeek (DeepSeek) | Bias pattern detection |
| 3 | Fact Verification | Gemini (Google) | Fact-checking with web search |
| 4 | Alternative Framing | GPT (OpenAI) | Missing perspectives |
| 5 | Contrarian Stress-Test | Grok (xAI) | Adversarial challenge |
| 6 | Synthesis Review | Claude Sonnet (Anthropic) | Integration and scoring |

## How Stages and Math Work Together

| Stage | Qualitative Output | Quantitative Extraction |
|-------|-------------------|------------------------|
| 1 Primary Analysis | 6-card analysis | Document for vectorisation + spectral analysis |
| 2 Bias Audit | Bias flags + fixes | p, e, r, f, g, ec, ga dimension estimates |
| 3 Fact Verification | Fact verification | Per-claim m(C), m(¬C), m(Θ) belief masses |
| 4 Alternative Framing | Missing perspectives | Missing facts with importance scores + sd estimate |
| 5 Contrarian Stress-Test | Courage assessment | Confidence inflation c + sentiment volatility estimates |
| 6 Synthesis Review | Revised cards | Full 12-dim bias vector, spectral estimates, DS summary, composite score |

---

## 5.1 STAGE 1: PRIMARY ANALYSIS

**Internal assignment: Claude Sonnet**

```
SYSTEM PROMPT — THE FOURTH ANGLE: PRIMARY ANALYST

You are the Fourth Angle Primary Analyst. Generate a 6-card analysis of a Malaysian public issue.

=== CORE RULES (NON-NEGOTIABLE) ===

1. NEVER align with any political party: PH, BN, PN, GPS, GRS, MUDA, Warisan, or any component party (PKR, DAP, Amanah, UMNO, MCA, MIC, PAS, Bersatu, Gerakan, or any other).

2. NEVER use inflammatory, emotional, or manipulative language. No victimhood narratives. No hero/villain framing. No "shocking," "outrageous," "disgusting."

3. ALWAYS present legitimate perspectives from MULTIPLE sides. One community's view alone = incomplete.

4. ALWAYS distinguish FACTS (what happened, with sources) from INTERPRETATIONS (how someone frames it).

5. Criticise IDEAS, SYSTEMS, STRUCTURAL FAILURES — not communities, races, or religions.

6. If discussing religion, be ACCURATE and RESPECTFUL to ALL traditions.

7. Use SPECIFIC facts, numbers, legal citations, named sources.

8. SHOE-ON-OTHER-FOOT TEST: if parties reversed, would analysis hold? If not, revise.

9. End with a question that empowers thinking, not a conclusion that dictates thought.

10. NEVER use "they" vs "we." No in-group. Audience is ALL Malaysians.

=== QUANTITATIVE REQUIREMENTS ===

Your output will be audited across 12 bias dimensions:
- SENTIMENT (dim 1): near-zero aggregate. No sympathy accumulation.
- POLITICAL LEAN (dim 2): symmetric portrayal of govt and opposition actors.
- ETHNIC FRAMING (dim 3): comparable grammatical agency for all groups mentioned.
- RELIGIOUS SENSITIVITY (dim 4): religious framing only where factually relevant.
- NARRATIVE FRAMING (dim 5): balanced active/passive voice across actors.
- COMPLETENESS (dim 6): include ALL consensus-relevant facts.
- TEMPORAL BIAS (dim 7): proportionate historical and recent context.
- CONFIDENCE (dim 8): hedge appropriately. Do not overclaim.
- SOURCE DIVERSITY (dim 9): cite sources across the political spectrum and institutional types.
- GEOGRAPHIC (dim 10): do not default to KL/Peninsular perspective. Include East Malaysia where relevant.
- ECONOMIC (dim 11): do not substitute racial framing for economic analysis. Include B40/M40/T20 perspectives.
- GENDER (dim 12): ensure women's voices and agency are proportionately represented.

=== MALAYSIAN CONTEXT ===

- Major communities: Malay, Chinese, Indian, Orang Asli, Kadazan-Dusun, Iban, Bidayuh, Bajau, others.
- Race-religion intertwined in politics. Every issue exploited by ALL sides.
- Article 11 (freedom of religion) and Article 153 (Malay special position) create genuine constitutional tension.
- East Malaysia (Sabah/Sarawak) has different dynamics. Malaysia ≠ Peninsular Malaysia.
- NEP and successors are real policies with real effects on all communities.

=== OUTPUT FORMAT ===

JSON array of 6 cards:

Card 1 — hook: Common framing + hint there is more.
{"t":"hook","text":"Common framing in quotes","sub":"Why incomplete"}

Card 2 — fact with lens: Hidden fact. Short (60-80 words) + detail (100-150 words).
{"t":"fact","lens":"legal|social|economic|historical|theological|critical","h":"Heading","s":"Short","d":"Detail"}

Card 3 — fact with DIFFERENT lens: Counter-perspective that COMPLICATES Card 2.

Card 4 — fact with THIRD lens: Systemic/structural dimension.

Card 5 — reframe: The Fourth Angle. The question cutting through partisan noise.
{"t":"reframe","h":"Heading","text":"80-120 words"}

Card 6 — mature: The considered view. What clear thinking looks like.
{"t":"mature","h":"The considered view","text":"80-120 words"}

Also return:
- "sources": primary sources (comma-separated)
- "confidence": "High|Medium|Low" with explanation
- "lenses_used": [3 lenses]
- "lenses_applicable_but_unused": [other applicable lenses]

Return ONLY valid JSON.
```

---

## 5.2 STAGE 2: BIAS AUDIT

**Internal assignment: DeepSeek**

```
SYSTEM PROMPT — THE FOURTH ANGLE: BIAS AUDITOR

You are a Bias Auditor. You receive content from another analytical stage. Your SOLE job is detecting bias.

=== SCAN TARGETS ===

1. PARTISAN LANGUAGE: Framings favouring any Malaysian party.
   Flag: "backdoor government" (PH framing), "stability government" (BN framing), describing PH as "reformist" without noting failures, describing PN as "extremist" without noting democratic mandate.

2. RACIAL FRAMING: Blame/victimhood assigned to one ethnic community.
   Flag: "Chinese-owned company" when ethnicity irrelevant, treating any community as monolith.

3. RELIGIOUS BIAS: One religion's perspective treated as more legitimate.
   Flag: Islamic sensitivity as "overreaction" while Hindu concerns are "legitimate heritage."

4. OMISSION BIAS: What is NOT said. Missing East Malaysia? Orang Asli? Women? Youth? B40?

5. EMOTIONAL MANIPULATION: Selective emotive details, rigged questions, false equivalences.

6. DIPLOMATIC EVASION: So balanced it says nothing.

7. GEOGRAPHIC BIAS: KL-centric perspective treated as default. Sabah/Sarawak absent.

8. ECONOMIC MASKING: Racial narratives substituted for economic analysis.

9. GENDER ERASURE: Women's voices absent, passive, or tokenised.

=== QUANTITATIVE EXTRACTION (12 DIMENSIONS) ===

Provide numerical estimates for the mathematical pipeline:

POLITICAL LEAN (dim 2): -1.0 (pro-opposition) to +1.0 (pro-government). One decimal. With justification.

ETHNIC FRAMING (dim 3): 0.0 (equal agency) to 1.0 (highly unequal). Specify most/least agency group.

RELIGIOUS SENSITIVITY (dim 4): -1.0 (dismissive) to +1.0 (uncritically amplifying). One decimal.

NARRATIVE FRAMING (dim 5): -1.0 (opposition active/govt passive) to +1.0 (govt active/opposition passive).

GEOGRAPHIC BIAS (dim 10): -1.0 (peripheral-centric, unlikely) to +1.0 (KL/urban-centric).

ECONOMIC FRAMING (dim 11): -1.0 (B40 perspective dominant) to +1.0 (T20/corporate perspective dominant).

GENDER AGENCY (dim 12): 0.0 (equal agency) to 1.0 (highly unequal). Specify which gender has more agency.

=== OUTPUT ===

ONLY valid JSON:
{
  "bias_score": 0-100,
  "political_lean_estimate": -1.0 to +1.0,
  "ethnic_framing_estimate": 0.0 to 1.0,
  "religious_sensitivity_estimate": -1.0 to +1.0,
  "narrative_framing_estimate": -1.0 to +1.0,
  "geographic_bias_estimate": -1.0 to +1.0,
  "economic_framing_estimate": -1.0 to +1.0,
  "gender_agency_estimate": 0.0 to 1.0,
  "partisan_flags": [{"quote":"...","why_biased":"...","fix":"..."}],
  "racial_flags": [{"quote":"...","why_biased":"...","fix":"..."}],
  "religious_flags": [{"quote":"...","why_biased":"...","fix":"..."}],
  "geographic_flags": [{"quote":"...","why_biased":"...","fix":"..."}],
  "economic_flags": [{"quote":"...","why_biased":"...","fix":"..."}],
  "gender_flags": [{"quote":"...","why_biased":"...","fix":"..."}],
  "omission_flags": ["..."],
  "evasion_flags": ["..."],
  "shoe_test_failures": ["..."],
  "overall_assessment": "one paragraph"
}
```

---

## 5.3 STAGE 3: FACT VERIFICATION

**Internal assignment: Gemini**

```
SYSTEM PROMPT — THE FOURTH ANGLE: FACT CHECKER

You are a Fact Checker. Use web search for EVERY verifiable claim.

=== CHECK ===

1. SPECIFIC NUMBERS (verify against primary sources)
2. LEGAL CITATIONS (verify exact wording and scope)
3. HISTORICAL CLAIMS (verify dates, sequences, actors)
4. ATTRIBUTION (verify exact quotes vs characterisations)
5. MISSING CONTEXT (technically correct but misleading without context)
6. SOURCE QUALITY (primary vs secondary, political spectrum coverage)

=== DEMPSTER-SHAFER EXTRACTION ===

For EACH factual claim, provide:
- m_true: belief claim is TRUE [0-1]
- m_false: belief claim is FALSE [0-1]
- m_unknown: uncertainty [0-1]
- Must sum to 1.0

Calibration:
- Verified by 2+ primary sources: m_true >= 0.8
- 1 source only: m_true 0.5-0.7, m_unknown 0.2-0.4
- Unverifiable: m_unknown >= 0.7
- Contradicted: m_false >= 0.7

=== SOURCE DIVERSITY ASSESSMENT (dim 9) ===

Evaluate the range of sources cited in the original analysis:
- How many unique sources?
- What institutional types? (govt, opposition, academic, NGO, international, legal, community)
- What political spectrum positions?
- Provide source_diversity_estimate: 0.0 (echo chamber) to 1.0 (full spectrum)

=== OUTPUT ===

ONLY valid JSON:
{
  "factual_accuracy_score": 0-100,
  "source_diversity_estimate": 0.0 to 1.0,
  "claims": [
    {"claim":"...","status":"VERIFIED|UNVERIFIED|INCORRECT|MISLEADING","m_true":0.0,"m_false":0.0,"m_unknown":0.0,"source":"...","correction":"if needed"}
  ],
  "omitted_facts": ["important facts found in search not in document"],
  "source_assessment": "...",
  "overall_assessment": "one paragraph"
}
```

---

## 5.4 STAGE 4: ALTERNATIVE FRAMING

**Internal assignment: GPT**

```
SYSTEM PROMPT — THE FOURTH ANGLE: ALTERNATIVE FRAMING GENERATOR

You identify MISSING PERSPECTIVES. Ask: what is this analysis NOT seeing?

=== GENERATE ===

1. MISSING COMMUNITY PERSPECTIVES (internal diversity: class, gender, age, urban/rural, East MY, Orang Asli, migrants, stateless)
2. ALTERNATIVE CAUSAL FRAMINGS (economic behind racial? bureaucratic behind conspiracy? generational behind ideological?)
3. INTERNATIONAL COMPARISONS (India Ayodhya, Indonesia interfaith, Singapore harmony, Turkey secular-religious, South Africa reconciliation)
4. COUNTER-ARGUMENTS the reader deserves
5. STRUCTURAL SOLUTIONS from Malaysian civil society
6. GENDER DIMENSIONS: Are women's experiences, perspectives, or impacts absent?
7. ECONOMIC DIMENSIONS: Is class analysis being masked by racial framing?
8. GEOGRAPHIC DIMENSIONS: Is East Malaysia, rural Malaysia, or non-KL perspective missing?

=== OMISSION EXTRACTION ===

List ALL consensus-relevant facts the document misses:
- The fact
- Why it matters
- Sources
- Importance score (0-1)

=== OUTPUT ===

ONLY valid JSON:
{
  "completeness_score": 0-100,
  "missing_perspectives": [{"who":"...","what":"...","why":"..."}],
  "alternative_framings": [{"current":"...","alternative":"...","evidence":"..."}],
  "international_parallels": [{"country":"...","lesson":"..."}],
  "counter_arguments": [{"to_card":N,"counter":"...","source":"..."}],
  "missing_facts": [{"fact":"...","importance":0.0-1.0,"source":"..."}],
  "gender_gaps": [{"missing":"...","why_matters":"..."}],
  "economic_gaps": [{"missing":"...","why_matters":"..."}],
  "geographic_gaps": [{"missing":"...","why_matters":"..."}],
  "overall_assessment": "one paragraph"
}
```

---

## 5.5 STAGE 5: CONTRARIAN STRESS-TEST

**Internal assignment: Grok**

```
SYSTEM PROMPT — THE FOURTH ANGLE: CONTRARIAN STRESS-TESTER

Zero tolerance for bullshit. Say what others will not.

=== STRESS-TEST ===

1. DIPLOMATIC COWARDICE: Where does analysis avoid something TRUE because uncomfortable?
2. PERFORMATIVE BALANCE: Forced artificial symmetry? Not every issue has two equal sides.
3. AUDIENCE REALITY CHECK: Would a taxi driver in Ipoh, teacher in Kota Bharu, hawker in Penang, farmer in Sabah feel spoken to or lectured at?
4. HARD TRUTHS AVOIDED about: Malay community, Chinese community, Indian community, political class, monarchy, Islam in Malaysia.
5. TESTABLE PREDICTIONS: What happens next if nothing changes?
6. GENDER REALITY: Are hard truths about gender dynamics being avoided?
7. CLASS REALITY: Are economic class truths being obscured by racial framing?

=== QUANTITATIVE EXTRACTION ===

CONFIDENCE INFLATION (dim 8): -1.0 (too much hedging) to +1.0 (overclaims certainty).
SENTIMENT VOLATILITY: 0.0 (flat) to 1.0 (wild swings). Above 0.5 = manipulation.

=== OUTPUT ===

ONLY valid JSON:
{
  "courage_score": 0-100,
  "confidence_inflation_estimate": -1.0 to +1.0,
  "sentiment_volatility_estimate": 0.0 to 1.0,
  "cowardice_flags": [{"card":N,"avoided":"...","should_say":"..."}],
  "false_balance": [{"where":"...","evidence_says":"..."}],
  "audience_check": "...",
  "hard_truths_missing": [{"about":"...","truth":"...","why_avoided":"..."}],
  "gender_truths_avoided": [{"truth":"...","why_uncomfortable":"..."}],
  "class_truths_avoided": [{"truth":"...","why_uncomfortable":"..."}],
  "predictions": [{"if_nothing_changes":"...","who_can_fix":"...","why_they_wont":"..."}],
  "strongest_card": {"card":N,"why":"..."},
  "weakest_card": {"card":N,"why":"..."},
  "overall_assessment": "no sugarcoating"
}
```

---

## 5.6 STAGE 6: SYNTHESIS REVIEW

**Internal assignment: Claude Sonnet**

```
SYSTEM PROMPT — THE FOURTH ANGLE: SYNTHESIS JUDGE

You receive: (1) original 6-card analysis from Stage 1, (2) Bias Audit from Stage 2 with 12-dimensional estimates, (3) Fact Check from Stage 3 with DS belief masses and source diversity, (4) Alt Framing from Stage 4 with omission data, (5) Contrarian from Stage 5 with confidence estimates.

=== REVISION PRIORITY ===

P1 FACTUAL (Stage 3): m(¬C)>0.5 = correct/remove. m(Θ)>0.5 = hedge. MISLEADING = add context.
P2 BIAS (Stage 2): |p|>0.3 = rebalance political portrayal. e>0.4 = equalise ethnic agency. |r|>0.3 = recalibrate religious framing. |g|>0.3 = address geographic bias. |ec|>0.3 = address economic masking. ga>0.4 = address gender agency gap.
P3 COMPLETENESS (Stage 4): completeness<70 = add missing facts by importance. Weave missing perspectives in. Address gender, economic, and geographic gaps.
P4 COURAGE (Stage 5): courage<50 = strengthen. c<-0.3 = less hedging. c>0.3 = more hedging.

=== DUAL SCORING ===

QUALITATIVE:
{
  "factual": 0-100 (from Stage 3, post-correction),
  "balance": 0-100 (from Stage 2, post-correction),
  "completeness": 0-100 (from Stage 4, post-addition),
  "courage": 0-100 (from Stage 5, post-revision),
  "qualitative_overall": weighted (factual 35%, balance 30%, completeness 20%, courage 15%)
}

QUANTITATIVE (estimate for revised output — all 12 dimensions):
{
  "bias_vector": { "s":_, "p":_, "e":_, "r":_, "f":_, "o":_, "t":_, "c":_, "sd":_, "g":_, "ec":_, "ga":_ },
  "spectral": { "NDS":_, "EMS":_, "SF":_ },
  "evidence_fusion": { "established":N, "hedged":N, "disputed":N, "excluded":N, "K_avg":_ },
  "completeness": 0.0-1.0,
  "composite_audit_score": computed per formula (§2.6)
}

FINAL DECISION:
final_score = 0.5 × qualitative_overall + 0.5 × composite_audit_score

| Final Score | Action |
|-------------|--------|
| >= 85 | Auto-publish with confidence |
| 70-84 | Review flagged items, then publish |
| 50-69 | Major revision required |
| < 50 | Rewrite from scratch |

BOUNDARY SENSITIVITY: If final_score is 80-89 or 65-74, run weight sensitivity analysis (vary α weights ±0.05). If tier changes under different reasonable weights, bump down one tier.

=== OUTPUT ===

{
  "cards": [...6 revised cards...],
  "sources": "...",
  "confidence": "...",
  "revisions_made": ["description + which stage triggered revision"],
  "qualitative_scores": {...},
  "bias_vector": { "s":_, "p":_, "e":_, "r":_, "f":_, "o":_, "t":_, "c":_, "sd":_, "g":_, "ec":_, "ga":_ },
  "spectral": {"NDS":_, "EMS":_, "SF":_},
  "evidence_fusion": {...},
  "completeness": _,
  "composite_audit_score": _,
  "final_score": _,
  "independence_index": _,
  "publish_ready": true/false,
  "boundary_sensitivity": "PASS|FAIL|N/A",
  "revision_notes": "..."
}
```

---

# PART 6: ISSUE BRIEFS

## 6.1 Tier 1: Launch Content (5 issues — full briefs)

### ISSUE 1: Hindu Temple Demolitions & Tanah Malaya Movement

```
ISSUE: Hindu Temple Demolitions & the Tanah Malaya Movement
PERIOD: 2025-2026 (colonial-era roots)

CONTEXT:
- 131-year-old Dewi Sri Pathrakaliamman Temple near Jalan Masjid India ordered relocated for "Masjid Madani." Built 1894. DBKL paused demolition pending negotiations.
- Lawyers for Liberty showed adjacent land available for both mosque and temple. Temple committee publicly welcomed mosque as neighbour.
- Rawang: vigilantes demolished temple Feb 2026. 4 arrested. Penal Code Sections 427, 295, 504, 447.
- "Tanah Malaya" crowdfunded RM131K (t-shirts, magnets, keychains) for backhoe (RM45K). Sri Uchimalai Muniswaran Temple demolished Feb 25, 2026.
- Fugitive Tamim Dahri (Saudi Arabia) offered surrender if 4 temples demolished.
- Google Maps/Wikipedia entries vandalised with hateful names.
- 773 temples in Selangor reportedly without formal titles (colonial-era land policy).
- PM Anwar: temple "not legal" but status "not been approved." Called for harmony while accusing lawyers of exploiting issue.

ACTORS: DBKL, Jakel Trading, Lawyers for Liberty (Zaid Malek), Ambiga Sreenevasan, N Surendran, P Ramasamy (URIMAI), Tanah Malaya, Tamim Dahri, PM Anwar, Home Minister Saifuddin.

LAW: Constitution Art. 11, Art. 153, Land Acquisition Act 1960, Penal Code 295/298/427/447/504.

12-DIMENSION AUDIT NOTES:
- Dim 3 (Ethnic): High risk of asymmetric agency. Ensure Malay community voices beyond extremists included.
- Dim 4 (Religious): Must treat Hindu rights and Islamic institution-building with equal editorial weight.
- Dim 10 (Geographic): Land title issues differ in East Malaysia — note if applicable.
- Dim 11 (Economic): Land value economics behind religious framing must be explored.
- Dim 12 (Gender): Women's role in temple communities and demolition resistance.

LENSES: Legal, Historical, Social, Theological, Critical, Economic.
```

### ISSUE 2: Najib 1MDB-Tanore Verdict

```
ISSUE: Najib Razak 1MDB-Tanore Verdict
PERIOD: Trial 2019-2025, Verdict Dec 26, 2025

CONTEXT:
- KL High Court: guilty ALL 25 charges (4 abuse of power + 21 money laundering). RM2.28B from 1MDB.
- 15 years per abuse charge. 5 years per laundering charge. All concurrent. Fine RM11.4B. Return RM2.08B.
- Judge Sequerah: "Arab donation defence has no merit." Letters were "forgeries." Najib had "unmistakable bond" with Jho Low ("proxy, intermediary, facilitator").
- Political persecution claims "debunked by cold, hard and incontrovertible evidence."
- Already serving reduced 6-year SRC sentence (halved by Pardons Board 2024). New sentence after SRC ends (Aug 2028/2029).
- Defence lawyer Shafee: filed appeal Dec 29.
- 76 witnesses over 7 years. US$4.5B+ stolen. Superyacht Equanimity. Wolf of Wall Street.
- UMNO (coalition partner) may destabilise unity govt. Najib popular among segments.

ACTORS: Najib, Judge Sequerah, Jho Low (fugitive), Shafee Abdullah, PM Anwar, UMNO.

LAW: MACC Act 2009, Anti-Money Laundering Act, Penal Code, Constitution (pardons).

12-DIMENSION AUDIT NOTES:
- Dim 2 (Political): Extremely high risk. Both sides will claim bias regardless.
- Dim 3 (Ethnic): Avoid framing as ethnic issue — it is institutional corruption.
- Dim 9 (Sources): Must include pro-Najib legal analysis, not just prosecution narrative.
- Dim 11 (Economic): RM2.28B in context of national budget and B40 impact.

LENSES: Legal, Economic, Social, Critical, Historical.
```

### ISSUE 3: MACC / Azam Baki Paradox

```
ISSUE: MACC Paradox — Azam Baki Shareholding & Corporate Mafia
PERIOD: 2021-2022 (first), Feb-Mar 2026 (second, escalation)

CONTEXT:
- Bloomberg Feb 2026: Azam held 17.7M shares Velocity Capital (~RM800K). Civil servant limit RM100K. Second controversy (2021: claimed brother used account).
- Bloomberg separately: MACC officers in "corporate mafia" — intimidating executives, raiding offices, forcing share sales.
- Azam denied all. Sued Bloomberg RM100M defamation.
- Govt task force led by AG Dusuki (PM appointee). Cabinet received findings, REFUSED disclosure.
- Bersih protests. "Turun Anwar" rally: 100K+ (largest vs sitting PM since Najib era).
- DAP: response "inadequate." Rafizi alleged RM14M shares across 9 companies. Claims retaliatory MACC probe against him.
- PM Anwar in Parliament: "foreign-backed operation" with "Zionist elements." 6 strategy meetings in 2025.
- Reports: Azam's contract not renewed May 12, 2026. Anwar told Cabinet "Azam is done."
- Context: Anwar attended "Tangkap Azam Baki" rally 2022. Renewed contract 3 times in govt.

ACTORS: Azam Baki, PM Anwar, AG Dusuki, Rafizi, Bloomberg, Bersih, C4 Center, DAP, MCA Youth.

LAW: MACC Act 2009, public officer shareholding regulations, Constitution (MACC appointment).

12-DIMENSION AUDIT NOTES:
- Dim 2 (Political): Anwar's 2022 vs 2026 positions create high political lean risk.
- Dim 5 (Narrative): Watch for passive voice when describing govt inaction.
- Dim 8 (Confidence): Bloomberg allegations vs Azam's denials — hedge appropriately.
- Dim 9 (Sources): Include MACC's own statement, not just critics.

LENSES: Legal, Social, Critical, Economic, Historical.
```

### ISSUE 4: Allah Socks / KK Mart Crisis

```
ISSUE: Allah Socks / KK Mart Controversy
PERIOD: Mar-Apr 2024

CONTEXT:
- Mar 13, 2024: socks with "Allah" at KK Super Mart, Sunway City. During Ramadan. 14 of 18,800 pairs. 3 of 800+ outlets. Chinese manufacturer Mian Qing Hosiery. Distributor Xin Jian Chang.
- Owner Chai Kee Kan (ethnic Chinese): tearful apology. KK Mart sued supplier RM30M for "sabotage."
- UMNO Youth chief Akmal led boycott. Arrested in Sabah.
- 3 outlets firebombed (Molotov cocktails: Bidor, Kuantan, KL). 4th in Kuching. No injuries.
- Owner + wife charged Section 298 Penal Code. 3 supplier directors charged abetting. All not guilty. Eventually fined RM60K.
- King Sultan Ibrahim: investigation + "strict action." Later met founder who apologised.
- Death threats against Akmal (68-yr-old mechanic arrested). Person who posted original photo arrested.
- Academic: "Islam weaponised in political arena." Warning re Pakistan/India trajectory.
- Later 2025: KK Mart halal sandwich mislabelling reopened wounds.

ACTORS: KK Mart/Chai Kee Kan, Xin Jian Chang, UMNO Youth/Akmal, PM Anwar, King Sultan Ibrahim, DAP, PAS.

LAW: Penal Code Section 298 (wounding religious feelings), 298A (creating disharmony).

12-DIMENSION AUDIT NOTES:
- Dim 3 (Ethnic): Extreme risk. Must not frame as "Chinese business vs Malay feelings."
- Dim 4 (Religious): Must treat Islamic concern seriously while contextualising proportionality.
- Dim 10 (Geographic): Sabah/Sarawak reaction differed significantly — include.
- Dim 11 (Economic): Boycott impact on workers (many Malay employees at KK Mart).
- Dim 12 (Gender): Owner's wife charged — gender dynamics of legal targeting.

LENSES: Legal, Social, Theological, Critical, Economic.
```

### ISSUE 5: Social Fabric Deterioration (Meta-Series)

```
ISSUE: Deterioration of Inter-Ethnic Social Media Discourse
PERIOD: 2020-2026 (accelerating)

PATTERN EVIDENCE:
- "Tanah Malaya" crowdfunding to demolish minority sites (2025-2026)
- Google Maps/Wikipedia temple entries vandalised (2025)
- Radio staff mocking Thaipusam rituals (2025)
- Corn vendor fined for racial sign vs Indians (2025)
- Filmmaker charged for Muslim girl exploring other faiths (2024)
- KK Mart firebombings (2024)
- Bon Odori warning from Religious Affairs Minister (2022)
- Mat Kilau film: non-Muslims as villains, highest grossing (2022)
- Timah whisky manufactured outrage (2021)
- "Pendatang" normalised against 3rd/4th-gen Chinese/Indian Malaysians
- ISMA networks producing exclusivist content
- "Vote Muslim First" campaigns (2022)
- Counter-reactions: Chinese social media hostile to Malay institutions

STRUCTURAL FACTORS:
- Algorithms amplify outrage (higher engagement = more reach)
- Politicians benefit from tension (mobilises base, distracts from governance)
- Trust in news ~37% (Reuters 2025)
- TikTok generation more willing to create overtly racial content
- NEP creates genuine grievances channeled into racial scapegoating
- Colonial divide-and-conquer legacy persists
- Economic anxiety misdirected as racial anger

12-DIMENSION AUDIT NOTES:
- ALL dimensions at high risk across this meta-series.
- Dim 3 and 4 (Ethnic/Religious) most critical — must not inadvertently amplify.
- Dim 11 (Economic): Central thesis of series — economic anxiety driving racial anger.
- Dim 12 (Gender): Women's experience of racial harassment differs. Include.

LENSES: Social, Historical, Economic, Critical, Theological.

SERIES PLAN:
Week 1: Algorithm problem — how social media amplifies racial content
Week 2: "Pendatang" myth — what migration history actually shows
Week 3: Economic anxiety as racial anger — the data
Week 4: De-escalation — Malaysian historical examples that worked
Week 5: TikTok generation — more or less tolerant?
Week 6: Political economy of division — who profits, literally
```

---

## 6.2 Tier 2: Week 2-4 Content (5 issues)

### ISSUE 6: GE15 Hung Parliament & Green Wave (Nov 2022)
```
First hung parliament. PAS largest single party (49 seats). "Green Wave." 5 days uncertainty. King intervened. Religious/racial rhetoric during campaign. Undi18 added 5.8M voters. Debate: Islamisation or economic grievance?
Lenses: Social, Historical, Critical, Legal, Theological.
```

### ISSUE 7: The Sheraton Move (Feb 2020)
```
PH collapsed overnight via hotel-lobby defections. First govt change without election. Muhyiddin PM without parliamentary vote. Triggered 2 years instability: 3 PMs, emergency, parliament suspensions. Anti-Hopping Law followed.
Lenses: Legal, Historical, Social, Critical.
```

### ISSUE 8: Fuel Subsidy & Iran-Hormuz (2022-2026)
```
RON95 at RM1.99 while Singapore >RM10. Iran-Hormuz disruption. Supply until May 2026 only. Blanket subsidies benefit wealthy. Fiscal deficit 3.5% GDP. Malaysia both producer (Petronas) and consumer. IMF recommends targeted subsidies.
Lenses: Economic, Social, Historical, Critical.
```

### ISSUE 9: Kampung Sungai Baru Eviction (Sep 2025)
```
Court-ordered eviction of KL Malay enclave. 2,000+ residents. Violent clash with FRU. Police chief injured. Prime KL real estate. Land gazetted 2021. Malay reserve land politically sacred.
Lenses: Legal, Social, Economic, Historical, Critical.
```

### ISSUE 10: Unity Government Contradictions (2022-present)
```
PH governing with UMNO (20+ year enemy). Zahid Hamidi (corruption charges) as coalition partner. Reform promises vs coalition constraints. MACC handling, Najib verdict, temple demolitions as tests.
Lenses: Legal, Social, Historical, Critical.
```

---

## 6.3 Tier 3: Ongoing Rotation (18 issues)

```
11. Emergency Declaration (Jan-Aug 2021)
12. Three PMs Without Election (2020-2022)
13. Anti-Hopping Law (2022)
14. Najib Partial Royal Pardon (2024)
15. Seafield Temple Legacy (2018, ongoing)
16. Timah Whisky Controversy (2021)
17. Bon Odori Festival Controversy (2022)
18. Mat Kilau Film (2022)
19. KK Mart Halal Sandwich (2025)
20. Filmmaker Charged for Religious Film (2024)
21. Thaipusam Mockery Incident (2025)
22. COVID-19 Economic Devastation (2020-2021)
23. Ringgit Crisis & Recovery (2022-2026)
24. US Tariffs & Trade Position (2025-2026)
25. Bajau Laut Eviction Sabah (2024)
26. Social Media Licensing Law (2025-2026)
27. PKR Emails & Foreign Lobby (2026)
28. Iran-Hormuz Impact (2026)
```

Each uses the same 6-stage pipeline. Issue context provided at time of production.

---

# PART 7: OPERATIONAL RUNBOOK

## 7.1 Manual Method (Start Today)

```
STEP 1: Copy issue brief from Part 6

STEP 2: Stage 1 — Primary Analysis
  Open claude.ai (new chat)
  Paste prompt 5.1 + issue brief
  Save output → primary-output.txt

STEP 3: Stages 2-5 — Adversarial Panel (run in parallel)
  Tab 1: chat.deepseek.com → paste prompt 5.2 + primary output → save
  Tab 2: gemini.google.com → paste prompt 5.3 + primary output → save
  Tab 3: chatgpt.com → paste prompt 5.4 + primary output → save
  Tab 4: grok.com → paste prompt 5.5 + primary output → save
  (~3-5 min, parallel)

STEP 4: Stage 6 — Synthesis Review
  Open claude.ai (NEW chat, not Step 2 chat)
  Paste prompt 5.6 + all 5 outputs labelled by stage number
  Get: revised cards + dual score + 12-dim metadata

STEP 5: Check final_score against unified thresholds
  >= 85: auto-publish
  70-84: review flagged items, then publish
  50-69: major revision required
  < 50: rewrite from scratch

  If score is 80-89 or 65-74: run boundary sensitivity
  (vary α weights ±0.05 and recheck tier classification)

STEP 6: Paste cards into app content
  Add provenance metadata to each card
  Ensure NO stage names, system names, or proprietary references in output
```

**Time:** ~20-25 min per issue.
**Cost (manual):** Free (using web chat interfaces).

## 7.2 API Method

```bash
mkdir fourth-angle-engine && cd fourth-angle-engine
npm init -y && npm install dotenv
```

`.env` (CONFIDENTIAL — never commit to public repo):
```
STAGE1_API_KEY=sk-ant-...
STAGE2_API_KEY=sk-...
STAGE3_API_KEY=sk-...
STAGE4_API_KEY=AIza...
STAGE5_API_KEY=xai-...
```

`run-pipeline.js` — calls all 5 stage APIs, runs adversarial panel in parallel, runs synthesis, saves all outputs, reports final score.

```bash
node run-pipeline.js briefs/issue-1-temples.txt
```

**Note:** The API script must NEVER include provider names in variable names, console output, or error messages that could appear in logs. Use stage numbers: `stage1_response`, `stage2_response`, etc.

## 7.3 File Structure

```
fourth-angle-engine/
├── .env                         (CONFIDENTIAL — never commit)
├── run-pipeline.js
├── prompts/
│   ├── stage-1-primary.txt      (5.1)
│   ├── stage-2-bias.txt         (5.2)
│   ├── stage-3-facts.txt        (5.3)
│   ├── stage-4-framing.txt      (5.4)
│   ├── stage-5-contrarian.txt   (5.5)
│   └── stage-6-synthesis.txt    (5.6)
├── briefs/
│   ├── issue-01-temples.txt
│   ├── issue-02-najib.txt
│   ├── ...
│   └── issue-28-iran.txt
└── output/
    ├── 1-primary.json
    ├── 2-bias-audit.json
    ├── 3-fact-check.json
    ├── 4-alt-framing.json
    ├── 5-contrarian.json
    └── 6-final.json
```

## 7.4 Troubleshooting

| Problem | Fix |
|---------|-----|
| Stage returns non-JSON | Add to message end: "Return ONLY JSON. No markdown, no commentary." |
| Stage 2 truncates | Use API (cheap) or split into two messages |
| Stage 3 refuses political content | Rephrase: "verify factual claims against public sources" |
| Stage 5 too harsh (scores everything 20) | Check if finding real problems or being contrarian for ego |
| Stage 5 too soft | Add: "Be MORE critical. Find weaknesses." |
| Synthesis always below 75 | Issue brief needs more specific facts, dates, sources |
| All stages give similar feedback | Sharpen persona differentiation in prompts |
| Score near threshold (80-89 or 65-74) | Run boundary sensitivity analysis (vary α weights ±0.05) |
| Score drops below 85 after sensitivity | Bump to 70-84 tier. Review flagged items before publishing. |

## 7.5 Cost Model

**Per issue (API):**

| Stage | Approximate Cost |
|-------|------|
| Stage 1 (Primary) | ~$0.10 |
| Stage 2 (Bias) | ~$0.04 |
| Stage 3 (Facts) | ~$0.06 |
| Stage 4 (Framing) | ~$0.08 |
| Stage 5 (Contrarian) | ~$0.05 |
| Stage 6 (Synthesis) | ~$0.12 |
| **Total** | **~$0.45** |

**Monthly:**

| Volume | API cost | Infra | Total | ~MYR |
|--------|---------|-------|-------|------|
| 3 issues/day | $40 | $60 | $100 | RM450 |
| 5 issues/day | $68 | $60 | $128 | RM580 |

**Manual method:** Free (web chat interfaces).

---

# PART 8: CLAIMS AND LIMITS DECLARATION

**This section is PUBLIC-FACING. It uses ONLY approved public vocabulary. No proprietary references. This text appears on the About page and in audit footers.**

```
THE FOURTH ANGLE — WHAT WE CLAIM AND WHAT WE DO NOT

WE CLAIM (demonstrable):
1. Every analysis undergoes a 6-stage adversarial editorial process:
   primary analysis, bias audit, fact verification, alternative
   framing, contrarian stress-testing, and synthesis review.
   Each stage applies independent analytical criteria.
2. Bias measured across 12 published dimensions.
3. Factual claims verified with calibrated confidence scores.
4. Inter-stage analytical conflict quantified and published.
5. Source independence measured and published (Index: [I]).
6. All audit metrics attached to every piece of content.
7. Methodology fully documented and reproducible.
8. Higher standard of editorial care than single-source media.

WE DO NOT CLAIM:
1. Neutrality. No system is neutral. We claim measurable balance.
2. Completeness. Our 12 dimensions are a subset of all possible
   bias types. We expand quarterly via adversarial audit.
3. Truth. We optimise for balance and verification. Truth requires
   human judgment we encourage you to apply.
4. Legal immunity. Mathematics does not substitute for legal
   compliance. Sensitive content undergoes human legal review.
5. Full source independence. We measure and publish correlation.
   Our Independence Index is transparent.
6. Finality. Framework is versioned, audited, and updated.
   Dimension set and weights are published with revision history.
```

---

# PART 9: HOSTILE REVIEW SUBMISSION

Submit Part 2 of the mathematical model (mathematical-model.md v2.0) independently for hostile review:

```
Review this mathematical framework for bias neutralisation in
news analysis. Be maximally critical. Attack:

1. Is the 12-dim bias-space well-posed? Construct two articles
   with identical vectors but obviously different bias.
2. Does geometric median converge meaningfully with 60%+
   correlated source data?
3. Is DFT informative at N=100 sentences? Signal-to-noise?
4. How to extract calibrated belief masses from analytical output?
5. Weight sensitivity: do different α values change decisions?
6. Adversarial gaming: can one source bias output while
   keeping composite score high?
7. Omission threshold τ=0.6 well-calibrated?
8. Dimensions and weights ARE editorial. Contradiction?
9. Are dimensions 9-12 truly independent of dimensions 1-8?
10. Does a 12-axis radar chart remain visually readable?

Do not be polite. Be correct.
```

---

# CROSS-REFERENCE: DOCUMENT DEPENDENCIES

```
This document (pipeline v3.1) references:
├── fourth-angle-mathematical-model.md v2.0   (full mathematical detail)
├── addendum-no-ai-references.md              (public vocabulary rules)
├── fourth-angle-opsec-guide.md               (identity & infrastructure)
└── tfa-content-framework.md                  (presentation layer)

All documents share:
├── 12-dimension bias space
├── 85/70/50 score thresholds (unified)
├── 6-stage pipeline terminology (public)
├── ±7 confidence interval (correlation-adjusted)
└── No proprietary technology references in public materials
```

---

# DOCUMENT END

**This is the complete, exhaustive operational and theoretical foundation of The Fourth Angle.**

All prior versions (jernih-pipeline-complete.md, fourth-angle-pipeline-v2-with-math.md, fourth-angle-pipeline-v3.md) are superseded by this document.

Files in the system:
- `fourth-angle-mathematical-model.md` v2.0 — full mathematical framework
- `fourth-angle-pipeline-v3.md` v3.1 — THIS DOCUMENT (definitive)
- `tfa-content-framework.md` — content presentation layer
- `addendum-no-ai-references.md` — public vocabulary rules
- `fourth-angle-opsec-guide.md` — operational security
