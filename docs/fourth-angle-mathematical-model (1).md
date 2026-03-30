# The Fourth Angle — Mathematical Bias Neutralisation Model

## Document Purpose

This document defines a rigorous mathematical framework for producing **measurably balanced news analysis**. It is designed for **hostile peer review** — every claim should be attacked, stress-tested, and either validated or destroyed.

**Reviewers: Please be hostile. Flag every weakness, every hidden assumption, every place where the math breaks down. We want the truth, not encouragement.**

**Classification:** CONFIDENTIAL — INTERNAL METHODOLOGY
This document describes the proprietary analytical framework of The Fourth Angle. It is not for public distribution. The technology, systems, and processes described herein are proprietary.

---

## 1. THE CORE PROBLEM

### 1.1 Problem Statement

Given `n` source analyses of the same real-world issue (from independent analytical stages, news outlets, or human analysts), each containing some unknown mixture of **signal** (factual reality) and **bias** (systematic distortion), produce an output that:

1. **Minimises total bias** — the output is as close as possible to the unknown factual reality
2. **Maximises information retention** — no important facts are lost
3. **Quantifies its own confidence** — the output carries a measurable uncertainty bound
4. **Is reproducible** — identical inputs always produce identical outputs

### 1.2 Why This Is Hard (The Fundamental Asymmetry)

In signal processing (Shazam, GPS, MRI), there exists either:
- A **known reference signal** (Shazam's song database), or
- A **known physical model** (GPS's speed-of-light equations, MRI's spin dynamics)

In news bias neutralisation, **neither exists**. We don't have the "true unbiased article" stored anywhere, and we don't have physics equations governing how reality maps to text.

**However**, we DO have something powerful: **multiple independent noisy measurements of the same underlying reality**. This places our problem in the domain of:

- **Sensor fusion** (combining multiple imperfect sensors)
- **Robust statistics** (estimating truth from contaminated data)
- **Social choice theory** (aggregating conflicting preferences/judgments)

These are mature mathematical fields with proven convergence theorems.

### 1.3 The Shazam Analogy — Precisely Stated

| Property | Shazam | Fourth Angle |
|----------|--------|--------------|
| Input | Audio waveform (continuous signal) | Text documents (discrete, high-dimensional) |
| Reference | Known song database | **None** (must be constructed) |
| Noise type | Background audio, compression artifacts | Political lean, framing, omission, emotion |
| Transform | Fourier Transform → frequency peaks | NLP vectorisation → bias-space coordinates |
| Matching | Constellation matching against database | Geometric median across source vectors |
| Determinism | Deterministic (same audio → same song) | Deterministic given fixed sources and parameters |
| Failure mode | "No match found" | Divergence detected (sources irreconcilably conflict) |

**Key insight**: Shazam's Fourier Transform converts audio from time-domain to frequency-domain to reveal invariant structure. We convert text from narrative-domain to bias-dimension-domain to reveal invariant factual content.

---

## 2. MATHEMATICAL FOUNDATIONS

### 2.1 Bias Space — The Coordinate System

We define a **Bias Space** B as an m-dimensional real vector space where each dimension represents a measurable axis of potential bias.

**Definition.** For a given analysis document `d`, its bias-space representation is:

```
β(d) = (s, p, e, r, f, o, t, c, sd, g, ec, ga) ∈ ℝ^m
```

Where the current model uses **m = 12 dimensions**:

| # | Dimension | Symbol | Range | Measurement Method |
|---|-----------|--------|-------|--------------------|
| 1 | Sentiment valence | s | [-1, +1] | Aggregate calibrated sentiment score across all claims |
| 2 | Political lean | p | [-1, +1] | Differential portrayal of political actors (see §2.1.1) |
| 3 | Ethnic framing | e | [0, 1] | Agency/passivity distribution across ethnic groups (see §2.1.2) |
| 4 | Religious sensitivity | r | [-1, +1] | Presence/absence of religious framing where factually irrelevant (see §2.1.3) |
| 5 | Narrative framing | f | [-1, +1] | Causal attribution direction, active vs. passive voice (see §2.1.4) |
| 6 | Omission index | o | [0, 1] | Proportion of consensus facts missing from source |
| 7 | Temporal bias | t | [-1, +1] | Over-weighting recent vs. historical context |
| 8 | Confidence inflation | c | [-1, +1] | Overclaiming certainty vs. appropriate hedging |
| 9 | Source diversity | sd | [0, 1] | Range and spectrum of sources consulted (see §2.1.5) |
| 10 | Geographic bias | g | [-1, +1] | KL/urban-centric vs. national perspective (see §2.1.6) |
| 11 | Economic framing | ec | [-1, +1] | Class/wealth angle in portrayal (see §2.1.7) |
| 12 | Gender agency | ga | [0, 1] | Agency/voice distribution across genders (see §2.1.8) |

#### 2.1.1 Political Lean Measurement

For each political actor `a` mentioned in document `d`, compute:

```
portrayal(a, d) = (1/N_a) × Σ sentiment(sentence_j)
```

where the sum is over all `N_a` sentences mentioning actor `a`.

Then political lean of document `d`:

```
p(d) = mean(portrayal over government actors) - mean(portrayal over opposition actors)
```

- `p > 0` → document favours government/ruling coalition
- `p < 0` → document favours opposition
- `p ≈ 0` → balanced portrayal

#### 2.1.2 Ethnic Framing Measurement

For each ethnic group `g` mentioned in document `d`, compute:

```
agency(g, d) = (count of sentences where g is grammatical subject performing action) / (total sentences mentioning g)
```

Ethnic bias:

```
e(d) = max_g(agency(g,d)) - min_g(agency(g,d))
```

- `e ≈ 0` → all groups portrayed with equal agency
- `e → 1` → one group consistently portrayed as active/powerful, another as passive/affected

#### 2.1.3 Religious Sensitivity Measurement

For each sentence `j` in document `d`, compute:

```
religious_frame(j) = 1 if sentence introduces religious framing where the factual content is non-religious; 0 otherwise
```

Aggregate:

```
r(d) = (Σ religious_frame(j) × sentiment(j)) / N
```

Weighted by sentiment direction to capture whether religious framing is used positively (amplifying = +1) or dismissively (-1).

- `r > 0` → uncritically amplifying religious framing
- `r < 0` → dismissive of religious dimensions
- `r ≈ 0` → religion referenced only where factually relevant

#### 2.1.4 Narrative Framing Measurement

For each political actor `a` in document `d`, compute:

```
active_ratio(a, d) = (sentences where a is active-voice subject) / (total sentences mentioning a)
```

Narrative framing score:

```
f(d) = mean(active_ratio over government actors) - mean(active_ratio over opposition actors)
```

- `f > 0` → government portrayed as acting, opposition as acted-upon
- `f < 0` → opposition portrayed as acting, government as acted-upon
- `f ≈ 0` → balanced voice distribution

#### 2.1.5 Source Diversity Measurement

For document `d` citing sources `S = {s₁, s₂, ..., sₖ}`, assign each source a position on a political spectrum scale [-1, +1] and compute:

```
sd(d) = 1 - (1 / (k × max_spread)) × Σᵢ Σⱼ |position(sᵢ) - position(sⱼ)| / C(k,2)
```

Simplified as normalised standard deviation of source positions:

```
sd(d) = σ(source_positions) / σ_max
```

Where `σ_max` is the theoretical maximum spread.

- `sd ≈ 1` → sources span the full political spectrum
- `sd ≈ 0` → all sources from the same political cluster (echo chamber)

Additionally, count unique institutional types (government, opposition, academic, NGO, international, legal):

```
type_diversity(d) = unique_types_cited / total_possible_types
```

Final source diversity:

```
sd(d) = 0.5 × spectral_diversity + 0.5 × type_diversity
```

#### 2.1.6 Geographic Bias Measurement

For document `d`, identify all geographic references and categorise:

```
Category A: Kuala Lumpur / Putrajaya / Selangor (federal core)
Category B: Other Peninsular states
Category C: Sabah and Sarawak
Category D: Rural / non-urban areas within any state
```

Geographic bias:

```
g(d) = (references_A / total_references) - (population_share_A)
```

Where `population_share_A` is the proportion of Malaysia's population in Category A (~25%).

- `g > 0` → disproportionately KL/urban-centric
- `g < 0` → disproportionately peripheral (unlikely but measurable)
- `g ≈ 0` → geographically proportionate

Extended measure incorporating Sabah/Sarawak:

```
east_malaysia_deficit(d) = max(0, population_share_C - references_C / total_references)
```

Where `population_share_C` ≈ 0.20 (Sabah + Sarawak ≈ 20% of population).

```
g_composite(d) = 0.6 × g(d) + 0.4 × east_malaysia_deficit(d)
```

#### 2.1.7 Economic Framing Measurement

For each economic actor or class reference in document `d`:

```
Category: B40 (bottom 40% income), M40 (middle 40%), T20 (top 20%)
          Corporate / Government-linked companies (GLCs) / SMEs / Informal sector
```

Economic framing score:

```
ec(d) = (positive_portrayal_T20 + positive_portrayal_corporate) - (positive_portrayal_B40 + positive_portrayal_SME)
```

Normalised to [-1, +1].

- `ec > 0` → frames issues from wealthy/corporate perspective
- `ec < 0` → frames issues from lower-income perspective
- `ec ≈ 0` → balanced economic perspective

Additionally measure whether economic causation is explored or masked by racial framing:

```
economic_masking(d) = (racial_explanations_for_economic_phenomena) / (total_economic_explanations)
```

High `economic_masking` indicates the document substitutes racial narratives for economic analysis.

#### 2.1.8 Gender Agency Measurement

For each gender `g` (male, female, non-binary where identified) in document `d`:

```
agency(g, d) = (sentences where g-identified person is grammatical subject performing action) / (total sentences mentioning g-identified persons)
```

Gender agency score:

```
ga(d) = agency(male, d) - agency(female, d)
```

Normalised to [0, 1]:

```
ga_normalised(d) = |agency(male, d) - agency(female, d)|
```

- `ga ≈ 0` → equal agency for all genders
- `ga → 1` → one gender consistently active, another passive or absent

Additionally measure voice representation:

```
voice_ratio(d) = (direct quotes from female sources) / (total direct quotes)
```

```
ga_composite(d) = 0.6 × ga_normalised(d) + 0.4 × |0.5 - voice_ratio(d)|
```

### 2.2 Dimension Expansion Protocol

The initial 12 dimensions are the starting set. They are editorially chosen. This is acknowledged.

**Quarterly adversarial audit:** Submit the current dimension set for independent critical review:

```
Here are our [N] bias dimensions: [list with descriptions]
Identify forms of bias this framework CANNOT detect.
For the Malaysian context, what systematic distortions would
produce zero scores on all dimensions but still constitute bias?
Return ranked proposals with: name, definition, measurement method,
example of bias it catches, estimated prevalence in Malaysian media.
```

**Validation criteria for new dimensions:**
1. Distinct from existing (correlation r < 0.8 with all existing dimensions across 100 articles)
2. Measurable (inter-rater kappa >= 0.6 among 3 independent raters on 20 articles)
3. Malaysia-relevant (variance on Malaysian articles significantly higher than international articles)

**Candidate dimensions for future expansion:**

| Proposed | What it catches | Priority |
|----------|----------------|----------|
| Monarchy deference | Uncritical treatment of royalty | MEDIUM |
| Generational framing | Youth perspectives patronised | MEDIUM |
| Disability representation | Ableist framing or absence | LOW |
| Environmental weighting | Environmental impacts minimised | LOW |

**Publication requirement:** Every Fourth Angle output states:

```
"Measured against [N] bias dimensions (last reviewed [date]).
Full dimension set with definitions published at [URL].
Believe we're missing a form of bias? Submit at [feedback URL]."
```

### 2.3 The Geometric Median — Finding the Mathematical Centre

Given source vectors `β₁, β₂, ..., βₙ` with credibility weights `w₁, w₂, ..., wₙ`:

**Definition.** The geometric median is:

```
β* = argmin_x Σᵢ wᵢ ‖x - βᵢ‖₂
```

This is the point in bias-space that minimises the total weighted distance to all sources.

**Why geometric median and not arithmetic mean?**

| Property | Arithmetic Mean | Geometric Median |
|----------|----------------|------------------|
| Outlier resistance | None — one extreme source shifts the mean | Robust — bounded influence function |
| Breakdown point | 0% (one bad source ruins it) | 50% (up to half the sources can be adversarial) |
| Equivariance | Affine equivariant | Affine equivariant |
| Computation | Closed-form | Iterative (Weiszfeld's algorithm) |

The **breakdown point** is critical: if two of five analytical stages produce extremely biased output, the geometric median barely moves. The arithmetic mean would be dragged toward the extreme.

**Weiszfeld's Algorithm** (to compute the geometric median):

```
Initialise: x⁰ = arithmetic mean of all βᵢ
Repeat until convergence:
    x^(k+1) = (Σᵢ wᵢβᵢ / ‖x^k - βᵢ‖) / (Σᵢ wᵢ / ‖x^k - βᵢ‖)
```

Convergence is guaranteed when the median does not coincide with any input point (which is almost surely the case in practice).

### 2.4 Credibility Weighting

Not all sources are equally reliable. Weights `wᵢ` should reflect source quality.

**Static weights** (prior credibility):

```
w_static(i) = accuracy_history(i) × independence(i) × specificity(i)
```

- `accuracy_history`: Track record of factual accuracy over past issues
- `independence`: How different is source i from the other sources? (measured by average distance to other sources — a source that always agrees with another is partially redundant)
- `specificity`: Does the source provide specific claims or vague generalities?

**Dynamic weights** (per-issue adjustment):

```
w_dynamic(i) = w_static(i) × consistency(i)
```

where `consistency(i) = 1 / (1 + distance from source i to the current geometric median)`.

Sources that are extreme outliers on a specific issue get down-weighted, but not silenced. This is a **soft penalty**, not a filter.

**Correlation-adjusted weights** (from independence architecture):

```
w_adjusted(i) = w_dynamic(i) × [1 / avg_correlation_with_others(i)]
```

Sources that are more analytically independent from the consensus get higher weight — they contribute more independent information. This naturally upweights sources with different analytical origins and human-sourced inputs.

**Circularity note (flag for reviewers):** The geometric median depends on the weights, and the dynamic weights depend on the geometric median. In practice, we compute this iteratively: compute median with static weights → compute dynamic weights → recompute median → repeat until stable. This converges in 2-3 iterations. The theoretical convergence guarantee requires the static weights to dominate the dynamic adjustment.

---

## 3. SPECTRAL ANALYSIS OF NARRATIVE (THE FOURIER COMPONENT)

### 3.1 Sentiment Trajectory

For a document with `N` sentences, define the **sentiment trajectory** as:

```
S = [s₁, s₂, s₃, ..., s_N]
```

where `sⱼ ∈ [-1, +1]` is the calibrated net sentiment of sentence `j`.

This is a discrete signal, directly analogous to a sampled audio waveform.

**Resolution:** Sentence-level analysis (N ≈ 100 for a typical article), not paragraph-level (N ≈ 15). At N=100, the DFT produces 100 frequency bins — sufficient for meaningful decomposition.

### 3.2 Discrete Fourier Transform of Narrative

Apply the DFT to the sentiment trajectory:

```
F_k = Σⱼ₌₀^(N-1) sⱼ × e^(-2πi·j·k/N)    for k = 0, 1, ..., N-1
```

The resulting frequency components reveal:

| Frequency band | Bins (N=100) | What it measures | Bias implication |
|----------------|-------------|------------------|------------------|
| k = 0 (DC component) | 1 | Overall average sentiment | Net positive/negative tilt of entire article |
| k = 1-3 (very low freq) | 3 | Whole-article narrative arc | Article slowly builds sympathy toward one side |
| k = 4-10 (low freq) | 7 | Section-level patterns | Structured section-level mood shifts |
| k = 11-25 (mid freq) | 15 | Paragraph-level alternation | Structured alternation between perspectives |
| k > 25 (high freq) | 75 | Sentence-level emotional spikes | Inflammatory language, emotional manipulation |

### 3.3 Bias Scores from Spectral Analysis

**Narrative Drift Score** (low-frequency bias):

```
NDS = (|F₁|² + |F₂|²) / Σₖ |Fₖ|²
```

- NDS close to 0 → no systematic drift → good
- NDS close to 1 → article is essentially a ramp from one sentiment to another → problematic

**Emotional Manipulation Score** (high-frequency energy):

```
EMS = Σ_{k > N/4} |Fₖ|² / Σₖ |Fₖ|²
```

- EMS close to 0 → smooth, even-tempered writing → good
- EMS high → frequent emotional spikes → manipulative framing likely

**Spectral Flatness** (overall evenness):

```
SF = (geometric mean of |Fₖ|²) / (arithmetic mean of |Fₖ|²)
```

- SF = 1 → perfectly flat spectrum → narrative has no systematic structure → maximally neutral narrative flow
- SF → 0 → energy concentrated in few frequencies → strong narrative structure imposed

### 3.4 What Spectral Analysis CAN and CANNOT Do

**CAN detect:**
- Gradual emotional escalation toward a predetermined conclusion
- "Emotional rollercoaster" patterns designed to manipulate
- Asymmetric treatment (spending 80% of paragraphs sympathetic to one side)
- Narrative arc manipulation (burying the counterargument at the end)

**CANNOT detect:**
- Factual omission (the frequency spectrum of what IS written tells you nothing about what ISN'T)
- Subtle word-choice bias at constant sentiment ("freedom fighter" vs "militant" both register as neutral sentiment)
- Structural bias (whose quote comes first, whose is longer)
- Sarcasm, irony, code-switching nuance

These limitations are why spectral analysis is **one component**, not the whole system.

### 3.5 Reference Spectrum

An "ideal neutral" article on a contested issue should exhibit:

```
Target spectrum:
- |F₀|²/total ≈ 0 (near-zero net sentiment)
- |F₁|², |F₂|² ≈ 0 (no narrative drift)
- Most energy in mid-frequencies (structured alternation between perspectives)
- Low high-frequency energy (no emotional spikes)
```

This gives us a **reference profile** — not a specific song like Shazam, but a **spectral shape** that neutral articles should approximate:

```
Spectral Bias Distance = ‖F_actual - F_target‖₂
```

### 3.6 Validation Requirement (non-negotiable)

Before shipping spectral scoring: test on 50 historical articles with known editorial lean. Compute scores. If correlation with human-assessed bias < 0.5, downweight or remove spectral components from composite.

### 3.7 Malaysian NLP Calibration

Build a 500-sentence calibration dataset from Malaysian political coverage. Have 5 diverse Malaysian raters score sentiment [-1,+1]. Test generic NLP against ground truth. Expected: r = 0.5-0.7. Apply correction:

```
s_calibrated = a × s_generic + b  (fitted from calibration set)
```

Alternatively, use multi-stage median sentiment (all analytical stages rate each paragraph with Malaysia-specific instructions) as the score. Measure residual error σ_s. Propagate through all downstream scores via Monte Carlo.

---

## 4. EVIDENCE FUSION (DEMPSTER-SHAFER THEORY)

### 4.1 Why Not Just Vote?

With multiple independent analytical stages reviewing each issue, the naive approach is majority voting: if 3+ stages say Claim X is true, publish it.

Problems with voting:
- It ignores **confidence levels** (a stage that is 51% sure and one that is 99% sure both count as one vote)
- It can't represent **"I don't know"** (every stage must pick a side)
- It can't quantify **inter-stage conflict** (3-2 splits look the same whether the disagreement is trivial or fundamental)

Dempster-Shafer (DS) theory solves all three problems.

### 4.2 The Framework

For each claim `C` that could appear in the final analysis, each analytical stage `i` provides:

```
m_i(C)     = belief mass that C is true        (range: [0, 1])
m_i(¬C)    = belief mass that C is false       (range: [0, 1])
m_i(Θ)     = belief mass assigned to "uncertain" (range: [0, 1])

Constraint: m_i(C) + m_i(¬C) + m_i(Θ) = 1
```

This is strictly more expressive than probability — a stage can say "I have 0.6 evidence for C, 0.1 evidence against C, and 0.3 I genuinely cannot determine."

### 4.3 Combination Rule

To combine evidence from stages 1 and 2:

**Step 1: Compute all pairwise intersections**

| | m₂(C) | m₂(¬C) | m₂(Θ) |
|---|---|---|---|
| **m₁(C)** | C: m₁(C)·m₂(C) | ∅: m₁(C)·m₂(¬C) | C: m₁(C)·m₂(Θ) |
| **m₁(¬C)** | ∅: m₁(¬C)·m₂(C) | ¬C: m₁(¬C)·m₂(¬C) | ¬C: m₁(¬C)·m₂(Θ) |
| **m₁(Θ)** | C: m₁(Θ)·m₂(C) | ¬C: m₁(Θ)·m₂(¬C) | Θ: m₁(Θ)·m₂(Θ) |

**Step 2: Compute conflict**

```
K = Σ (all cells marked ∅) = m₁(C)·m₂(¬C) + m₁(¬C)·m₂(C)
```

K measures how much the two stages fundamentally disagree. K ∈ [0, 1].

- K < 0.3 → low conflict, combination is reliable
- 0.3 ≤ K < 0.7 → moderate conflict, flag for editorial review
- K ≥ 0.7 → high conflict, the stages are seeing fundamentally different realities — DO NOT AUTO-PUBLISH

**Step 3: Normalise and combine**

```
m₁₂(C)  = [m₁(C)·m₂(C) + m₁(C)·m₂(Θ) + m₁(Θ)·m₂(C)] / (1 - K)
m₁₂(¬C) = [m₁(¬C)·m₂(¬C) + m₁(¬C)·m₂(Θ) + m₁(Θ)·m₂(¬C)] / (1 - K)
m₁₂(Θ)  = [m₁(Θ)·m₂(Θ)] / (1 - K)
```

**Step 4: Iterate**

Combine m₁₂ with m₃ to get m₁₂₃. Then with m₄ to get m₁₂₃₄. Then with m₅. The final combined mass function represents the fused evidence of all 5 independent analytical stages.

Order does not matter (commutative and associative).

### 4.4 Decision Thresholds

After combining all stages, for each claim:

| Combined belief in C | Combined belief in ¬C | Conflict K | Decision |
|---|---|---|---|
| ≥ 0.7 | < 0.2 | < 0.3 | **Include as established fact** |
| ≥ 0.5 | < 0.3 | < 0.5 | **Include with hedging language** ("evidence suggests...") |
| < 0.5 | < 0.5 | any | **Present as disputed/unclear** |
| < 0.2 | ≥ 0.7 | < 0.3 | **Exclude or refute** |
| any | any | ≥ 0.7 | **FLAG: Fundamental disagreement — editorial review required** |

### 4.5 Worked Example

**Claim: "The temple was demolished without proper notice to the community."**

| Stage | m(C) | m(¬C) | m(Θ) |
|---|---|---|---|
| Primary Analysis | 0.7 | 0.1 | 0.2 |
| Bias Audit | 0.6 | 0.2 | 0.2 |
| Fact Verification | 0.8 | 0.05 | 0.15 |
| Alternative Framing | 0.5 | 0.3 | 0.2 |
| Contrarian Test | 0.65 | 0.15 | 0.2 |

**Combining Primary Analysis + Bias Audit:**

```
K = (0.7)(0.2) + (0.1)(0.6) = 0.14 + 0.06 = 0.20  (low conflict ✓)

m₁₂(C)  = [(0.7)(0.6) + (0.7)(0.2) + (0.2)(0.6)] / (1 - 0.20)
         = [0.42 + 0.14 + 0.12] / 0.80
         = 0.68 / 0.80 = 0.85

m₁₂(¬C) = [(0.1)(0.2) + (0.1)(0.2) + (0.2)(0.2)] / 0.80
         = [0.02 + 0.02 + 0.04] / 0.80
         = 0.08 / 0.80 = 0.10

m₁₂(Θ)  = [(0.2)(0.2)] / 0.80
         = 0.04 / 0.80 = 0.05
```

After combining all 5 stages iteratively, the final combined belief would be approximately:

```
m_final(C) ≈ 0.97, m_final(¬C) ≈ 0.02, m_final(Θ) ≈ 0.01, K_total ≈ 0.18
```

**Decision:** Include as established fact (belief ≥ 0.7, conflict < 0.3).

### 4.6 Belief Mass Extraction

All 5 independent analytical stages rate confidence per claim using structured calibration guidelines:

```
- Verified by 2+ primary sources: m(C) >= 0.8
- Verified by 1 source only: m(C) = 0.5-0.7, m(Θ) = 0.2-0.4
- Unverifiable: m(Θ) >= 0.7
- Contradicted by evidence: m(¬C) >= 0.7
```

Calibration validation: 50 claims with known truth values. Measure calibration per stage. Apply correction factors. Residual extraction noise ~10-15%, propagated as widened confidence intervals.

### 4.7 Known Limitations of Dempster-Shafer

**Zadeh's Paradox:** When two highly confident stages completely disagree (m₁(C) = 0.99, m₂(¬C) = 0.99), the combination rule produces extreme results because K → 1 and the normalisation amplifies any tiny residual agreement.

**Our mitigation:** The conflict threshold at K ≥ 0.7 prevents auto-publishing in these cases. The system routes to editorial review instead of producing a mathematically valid but practically meaningless result.

**Assumption of independence (flag for reviewers):** DS combination assumes the evidence sources are independent. Analytical stages sharing underlying reference data are NOT fully independent — they may have correlated analytical blind spots. This means the combination overestimates confidence. Mitigation: we include human-sourced articles, use the independence weight factor from §2.4, and widen confidence intervals per the effective sample size calculation in §7.

---

## 5. OMISSION DETECTION (SET-THEORETIC)

### 5.1 The Problem Spectral Analysis Can't Solve

An article can have perfect spectral flatness, zero narrative drift, and zero emotional manipulation — and still be deeply biased because it **left out key facts**. The most sophisticated bias is the bias of omission.

### 5.2 Method: Universal Fact Set

**Step 1:** From all `n` sources, extract all discrete factual claims:

```
F_total = F₁ ∪ F₂ ∪ F₃ ∪ ... ∪ Fₙ
```

where `Fᵢ` is the set of factual claims in source `i`.

**Step 2:** For each claim `f ∈ F_total`, count how many sources include it:

```
coverage(f) = |{i : f ∈ Fᵢ}| / n
```

**Step 3:** A claim is considered **consensus-relevant** if:

```
coverage(f) ≥ τ    (threshold, default τ = 0.6, i.e., 3 out of 5 independent stages)
```

**Step 4:** The omission score for source `i` is:

```
omission(i) = |{f : f is consensus-relevant AND f ∉ Fᵢ}| / |{f : f is consensus-relevant}|
```

A source that omits 40% of consensus-relevant facts is measurably suspicious, regardless of how well-written the remaining content is.

### 5.3 For the Final Output

The synthesised output should include ALL consensus-relevant facts. Any fact that is included by fewer than τ sources but flagged as important by any single source should be included with explicit attribution and uncertainty markers.

```
Completeness score of final output = |F_output ∩ F_consensus| / |F_consensus|
```

Target: completeness ≥ 0.95 (include at least 95% of all consensus facts).

### 5.4 Critical Limitation

If ALL sources omit the same fact, the system cannot detect the omission. This is analogous to a systematic error in all sensors simultaneously — no fusion algorithm can correct it.

---

## 6. THE COMPOSITE PIPELINE

### 6.1 Full Processing Flow

```
INPUT: n source documents (from independent analytical stages and/or news sources)
  │
  ├─── STAGE 1: VECTORISE
  │     Each source → β(d) ∈ ℝ^12
  │     Output: n vectors in bias-space
  │
  ├─── STAGE 2: SPECTRAL ANALYSIS
  │     Each source → DFT of sentiment trajectory (sentence-level, N≈100)
  │     Output: NDS, EMS, SF scores per source
  │     Flag sources with NDS > 0.4 or EMS > 0.3
  │
  ├─── STAGE 3: FACT EXTRACTION & OMISSION DETECTION
  │     All sources → universal fact set F_total
  │     Compute coverage(f) for all facts
  │     Compute omission(i) for all sources
  │     Flag sources with omission > 0.3
  │
  ├─── STAGE 4: EVIDENCE FUSION (Dempster-Shafer)
  │     For each factual claim: combine belief masses across stages
  │     Compute per-claim conflict K
  │     Classify claims: established / hedged / disputed / excluded / needs-review
  │
  ├─── STAGE 5: GEOMETRIC MEDIAN
  │     Compute credibility weights (§2.4)
  │     Find geometric median β* of all source vectors
  │     This defines the target bias-space position for the output
  │
  ├─── STAGE 6: SYNTHESIS
  │     Generate output text that:
  │     - Includes all claims classified "established" or "hedged" from Stage 4
  │     - Has bias vector β(output) closest to β* from Stage 5
  │     - Has spectral profile matching the neutral target from §3.5
  │     - Achieves completeness ≥ 0.95 from Stage 3
  │
  └─── STAGE 7: AUDIT SCORE
        Compute final composite score (see §6.2)
        Attach all intermediate metrics as metadata

OUTPUT: Synthesised analysis + Audit Report
```

### 6.2 The Composite Score

The final publishability score combines all components:

```
Score = 100 × (1 - α₁·‖β*‖ - α₂·NDS - α₃·EMS - α₄·(1-SF) - α₅·K_avg - α₆·(1-completeness))
```

Where:
- `‖β*‖` = magnitude of the geometric median (distance from true centre in ℝ^12)
- `NDS` = narrative drift score of the final output
- `EMS` = emotional manipulation score of the final output
- `SF` = spectral flatness (inverted: lower flatness = higher penalty)
- `K_avg` = average conflict across all claims
- `completeness` = proportion of consensus facts included

**Default weights** (tunable):

```
α₁ = 0.25  (bias position — most important)
α₂ = 0.15  (narrative drift)
α₃ = 0.15  (emotional manipulation)
α₄ = 0.10  (spectral flatness)
α₅ = 0.20  (inter-stage conflict — second most important)
α₆ = 0.15  (factual completeness)
```

**Score interpretation:**

| Score range | Meaning | Action |
|-------------|---------|--------|
| 85-100 | Verified balanced | Auto-publish with confidence |
| 70-84 | Good with minor concerns | Review flagged items, then publish |
| 50-69 | Significant issues detected | Major revision needed |
| Below 50 | Failed neutrality check | Rewrite from scratch or flag as "contested analysis" |

**Boundary sensitivity rule:** For scores within 5 points of the 85 or 70 thresholds (i.e., scores 80-89 or 65-74), weight sensitivity analysis is mandatory. Run the composite with α weights varied ±0.05. If different reasonable weights produce different tier classifications, bump down one tier.

### 6.3 Confidence Interval

The score should be reported with uncertainty:

```
Score = 78 ± 7 (95% CI, adjusted for source correlation)
```

The uncertainty comes from:
- Measurement noise in NLP sentiment scoring (±0.05 per sentence)
- Propagated through the full pipeline via Monte Carlo simulation
- Run the entire pipeline 100 times with small random perturbations to NLP scores
- Report the 2.5th and 97.5th percentile as the confidence interval
- **Widened by √(n/n_eff) to account for inter-stage correlation** (see §7.3)

Note: The unadjusted CI before correlation correction is approximately ±4. The widened interval reflects measured inter-stage correlation, consistent with T4A's own anti-overclaiming standards (dimension 8: Confidence inflation).

---

## 7. INDEPENDENCE ARCHITECTURE

### 7.1 Why Pure Independence Is Impossible

Two variables X, Y are independent iff P(X and Y) = P(X) × P(Y). For analytical stages sharing reference data, knowing one stage's output gives information about another stage's output. This is dependence by definition. No framework changes this.

### 7.2 Maximum Decorrelation Strategy

| Strategy | Effect | Status |
|----------|--------|--------|
| Different analytical origins and methodologies | Reduces shared methodological bias | Done |
| Diverse reference data sources | Reduces shared knowledge bias | Partial |
| Non-automated sources (journalists, academics, civil society) | Near-zero correlation with automated stages | Recommended |
| Different adversarial roles per stage | Reduces shared analytical bias | Done |
| Multi-language source inputs (Malay, Chinese, Tamil) | Reduces English framing bias | Phase 2 |
| Malaysia-calibrated analytical stage | Reduces Western-perspective bias | Phase 2 |

### 7.3 Effective Sample Size

```
n_eff = n / (1 + (n-1) × ρ_avg)
```

| Configuration | n | ρ_avg | n_eff |
|--------------|---|---------|-------|
| 5 automated stages only | 5 | ~0.6 | ~1.5 |
| 5 automated + 3 human sources | 8 | ~0.35 | ~3.8 |
| 5 automated + 3 human + Malaysia-calibrated stage | 9 | ~0.28 | ~5.1 |

Confidence intervals widened by √(n / n_eff).

**How to measure ρ_avg:** For each bias dimension, compute each stage's estimate on 30+ issues. Compute pairwise Pearson correlation. Average across all pairs and dimensions.

### 7.4 Independence Index

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

## 8. THEORETICAL GUARANTEES AND HONEST LIMITATIONS

### 8.1 What This Model CAN Guarantee (Provable)

1. **The geometric median IS the point of minimum total distance** — this is a theorem (Weiszfeld 1937), not an opinion. Given the input vectors, no other point has a smaller weighted sum of distances.

2. **50% breakdown point** — up to 2 out of 5 sources can be arbitrarily biased (even adversarially) without corrupting the geometric median beyond a bounded amount. This is proven in robust statistics literature (Lopuhaä & Rousseeuw, 1991).

3. **Spectral decomposition is exact** — the DFT is a lossless, invertible transformation. The frequency components contain exactly the same information as the original signal, just in a different representation.

4. **Dempster-Shafer satisfies commutativity and associativity** — the order in which you combine stages doesn't matter. Combining stages (1,2,3,4,5) and (5,4,3,2,1) gives the same result.

5. **Reproducibility** — for fixed inputs and fixed parameters, the output is deterministic. Any third party can verify the computation.

### 8.2 What This Model CANNOT Guarantee (Honest Limitations)

1. **The bias-space dimensions are editorially chosen.** The 12 dimensions in §2.1 reflect the design team's judgment of what constitutes bias. A different team might choose different dimensions. The model is neutral WITHIN its defined bias space but may be blind to bias types not modelled. **This is the deepest vulnerability in the system.**

2. **NLP sentiment scoring is imperfect.** The vectorisation function β depends on NLP analysis that is itself imperfect. Sarcasm, irony, cultural context, and Malay/English code-switching all challenge sentiment analysis. Error in β propagates through the entire pipeline.

3. **Analytical stage correlation.** The independent stages may share reference data and potentially share systematic blind spots. If all stages have the same bias (e.g., all reference primarily English-language Western media), the geometric median of correlated biased points is still biased. **Mitigation: include at least one non-Western source and human-sourced articles from Malaysian journalists.**

4. **Omission detection requires at least one source to mention the fact.** If ALL sources omit the same fact, the system cannot detect the omission. This is analogous to a systematic error in all sensors simultaneously — no fusion algorithm can correct it.

5. **The model does not determine truth.** It determines the mathematically central position among its sources. If all sources are wrong about a fact, the central position is also wrong. The model optimises for balance, not for truth. These often correlate but are not the same thing.

6. **Language and cultural nuance.** Malaysian political discourse involves code-switching (Malay/English/Chinese/Tamil), cultural references, and sensitivity hierarchies (Malay rulers, religious institutions) that generic NLP analysis may not capture accurately.

7. **Neutrality is undefined.** There is no objective, universal definition of "neutral." T4A claims "measurably balanced against a published standard" — not "neutral." This distinction is fundamental.

8. **Legal immunity is not conferred by mathematics.** The math demonstrates editorial care, which supports but does not replace legal compliance. Content involving 3R (race, religion, royalty) requires human legal review regardless of composite score.

---

## 9. COMPARISON TO ALTERNATIVE APPROACHES

### 9.1 Why Not Just Use One Analytical System?

No single analytical system is neutral. Each has systematic biases from its reference data, calibration process, and methodological assumptions. A single system's "neutral" output is actually that system's specific bias profile — which the user cannot detect without comparison.

The multi-stage approach makes each stage's bias visible by contrast with the others.

### 9.2 Why Not Simple Averaging of Outputs?

Simple averaging (arithmetic mean) has zero outlier resistance. One extremely biased source shifts the average substantially. The geometric median has 50% breakdown — it requires a majority of sources to be corrupted before the output is affected.

### 9.3 Why Not Human Editors Instead?

Human editors have the same problem as single analytical systems — each has their own bias profile. The advantage of this mathematical approach is:

1. **Measurability** — human bias is invisible to the reader; mathematical bias is published as metadata
2. **Reproducibility** — two different editors may produce different results; the algorithm produces the same result every time
3. **Auditability** — anyone can check the math; no one can check a human editor's internal reasoning

The ideal system combines both: mathematical pipeline for the core analysis, human editors for cultural nuance review.

---

## 10. QUESTIONS FOR HOSTILE REVIEWERS

Please specifically attack the following:

1. **Is the 12-dimensional bias-space formulation well-posed?** Can you construct a scenario where two articles with identical β vectors have obviously different bias profiles?

2. **Does the geometric median actually converge to something meaningful when sources are correlated?** What is the effective sample size when independent analytical stages share 60%+ of reference data?

3. **Is the DFT of sentiment trajectory actually informative at N=100 sentences?** What is the signal-to-noise ratio?

4. **How do you extract calibrated belief masses from free-text analytical output?** What is the uncertainty in this extraction step?

5. **The α weights in the composite score (§6.2) are arbitrary. How sensitive is the final score to these weights?** Would different reasonable weight choices change publish/reject decisions?

6. **Can the system be gamed?** If an adversary controls one source, can they systematically bias the output while keeping the composite score high?

7. **Is the omission detection threshold (τ = 0.6) well-calibrated?** Too low and you include noise; too high and you miss real omissions.

8. **The model claims to be "non-partisan" but the choice of dimensions, weights, and thresholds ARE editorial decisions. Is this a contradiction?**

9. **Are the four new dimensions (9-12) truly independent of the original eight?** Could Source diversity be a proxy for Political lean? Could Gender agency correlate with Ethnic framing?

10. **Does the 12-axis radar chart become visually unreadable?** At what dimensionality does the visualisation lose communicative value for a general audience?

---

## 11. NOTATION SUMMARY

| Symbol | Meaning |
|--------|---------|
| β(d) | Bias-space vector of document d (∈ ℝ^12) |
| β* | Geometric median (the mathematical centre) |
| m | Number of bias dimensions (currently 12) |
| n | Number of source documents / independent analytical stages |
| wᵢ | Credibility weight of source i |
| Fₖ | k-th Fourier coefficient of sentiment trajectory |
| NDS | Narrative Drift Score |
| EMS | Emotional Manipulation Score |
| SF | Spectral Flatness |
| mᵢ(C) | Dempster-Shafer belief mass from stage i for claim C |
| K | Conflict measure between sources |
| τ | Omission detection threshold (default 0.6) |
| αⱼ | Composite score weight for component j |
| F_total | Universal fact set (union of all source claims) |
| ρ_avg | Average pairwise correlation between analytical stages |
| n_eff | Effective sample size (adjusted for correlation) |
| I | Independence Index (1 - ρ_avg) |
| s, p, e, r, f, o, t, c | Original 8 bias dimensions |
| sd, g, ec, ga | Extended 4 bias dimensions (source diversity, geographic, economic, gender) |

---

## DOCUMENT VERSION

- **Version:** 2.0
- **Date:** March 2026
- **Status:** SUBMITTED FOR HOSTILE PEER REVIEW
- **Classification:** CONFIDENTIAL — INTERNAL METHODOLOGY
- **Supersedes:** Version 1.0-DRAFT-FOR-REVIEW
- **License:** Open for internal review and critique. Mathematical content is reproducible; implementation details are proprietary.

---

*This document should be submitted independently for hostile peer review. Instruction to reviewers: "Review this mathematical framework for bias neutralisation in news analysis. Be maximally critical. Identify every flaw, hidden assumption, and failure mode. Do not be polite — be correct."*
