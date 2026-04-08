# Bite-Sized Reading for The Fourth Angle: Research Synthesis

> **Purpose.** Evidence-grounded design rules for T4A's 6–7 card swipe format, drawn from cognitive science, mobile reading research, persuasion psychology, and viral-sharing studies. Where evidence is thin or contested, it is flagged. The TL;DR action list is at the bottom.

---

## 1. The Science of Bite-Sized Reading

### Working memory: the real constraint is ~4, not 7

Miller's "magical number seven" (1956) is folklore. The replicated number for novel content presented serially is **about four chunks** — see [Cowan 2001, "The magical number 4 in short-term memory"](https://pubmed.ncbi.nlm.nih.gov/11515286/) and [Mathy & Feldman 2012](https://www.sciencedirect.com/science/article/abs/pii/S0010027711002733).

**Implication for T4A.** Across the full 7-card stack, only 3–4 distinct ideas survive the session. Editorial effort should be ruthlessly biased toward making those 3–4 the *right* ones — typically hook + reframe + one fact + view.

### Mobile reading: speed is fine, depth isn't

[NN/G mobile reading research](https://www.nngroup.com/articles/mobile-content/) found speed and comprehension on phones ≈ desktop, except complex text slows mobile readers ~30 ms/word. [Kim et al., CHI 2023](https://dl.acm.org/doi/10.1145/3544548.3581174) confirmed skim-reading dominates phones. Every card should pass an "out-loud-in-one-breath" test — ~12–15 words for `big`, ~20 words for `sub`.

### F-pattern is real but mostly a layout warning

[NN/G F-pattern research](https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/) was originally about long body text. On a swipe card the F collapses into a centered Z: top-line claim → diagonal supporting line → off-edge to next. The first line carries 80%+ of fixations. T4A's `big`/`sub` split already matches.

### Headline length: where evidence agrees and where it doesn't

- **≤55 chars** — AP mobile guideline. Safe everywhere, often forces vagueness.
- **60–80 chars** — BuzzSumo / Google-SERP CTR sweet spot ([CoSchedule analysis](https://coschedule.com/headlines/best-headline-length)).
- **80–100 chars** — still legible on most modern phones; allows the specific number/name that drives concreteness.

T4A's 75-char target sits exactly in this band. **Do not move it.** Honest caveat: there is no clean RCT establishing an optimum — most "studies" are observational on engagement metrics that confound length with topic.

### Cognitive load theory and single-claim cards

Sweller's framework predicts that intrinsic + extraneous load cannot exceed working-memory capacity. T4A's one-claim-per-card structure is near-textbook split-attention reduction. The danger is *germane overload* — when you cram a number, a name, a date, and a contrast into one card you've recreated the problem the format was designed to solve.

**Rule.** Every card should have **one number OR one named actor OR one date** as its concrete anchor — never all three.

---

## 2. Psychology of Feeling Smart

### Processing fluency: easy = true = smart

The most operationally important finding for T4A. [Reber & Schwarz 1999](https://pages.ucsd.edu/~pwinkielman/Processing_Fluency_as_the_Source_of_Experiences_PSYCHE-2002.pdf) and the canonical synthesis [Reber, Schwarz & Winkielman 2004](https://pages.ucsd.edu/~pwinkiel/reber-schwarz-winkielman-beauty-PSPR-2004.pdf) showed that statements that are *easier to process* are judged as more truthful, more beautiful, and the experience is misattributed to the perceiver's own intelligence. The brain treats "this was easy" as evidence the claim is solid. [Unkelbach 2007](https://pmc.ncbi.nlm.nih.gov/articles/PMC3339024/) showed the link is contextual but robust.

**How to engineer fluency in a T4A card:**
1. **High contrast** — white-on-deep-navy already does this. Keep it.
2. **Concrete nouns over abstractions.** "RM2.4 billion" is fluent; "significant fiscal exposure" is not.
3. **Familiar syntax.** Subject-verb-object. No subordinate clauses inside the `big`.
4. **Rhythm.** Short-short-long, or three-beat parallelism. *"They said safe. We found leaks. The auditor agreed."*
5. **Repetition of key terms across cards within an issue.** Re-encountering a phrase boosts fluency on the second exposure. If the hook says "Bukit Kiara approval," the fact card shouldn't switch to "the Federal Hill greenlight."

### The "aha moment" — what the reframe card is actually doing

[Kounios & Beeman, "The Aha Moment"](https://www.researchgate.net/publication/233507940_The_Aha_Moment_The_Cognitive_Neuroscience_of_Insight) showed insight is accompanied by a right-hemisphere gamma-band burst, and ([Tik et al., 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC6055807/), [Oh et al., 2023](https://www.nature.com/articles/s41598-023-44293-2)) activation of the ventral tegmental area and nucleus accumbens — the brain's dopamine reward system. **Insight is neurochemically rewarding and increases willingness to share immediately afterward.**

**Implication.** The reframe card is the dopamine spike of the issue. The structure that triggers it most reliably is *restructuring* — not adding new information, but suddenly making old information mean something different. *"The leak isn't the scandal. The audit's six-month delay is the scandal."* That's a reframe. *"There are also concerns about the audit timeline"* is not. The reframe must literally rotate the reader's mental model of what the issue is *about*.

### The curiosity gap, the right way

[Loewenstein 1994, "The Psychology of Curiosity"](https://www.cmu.edu/dietrich/sds/docs/loewenstein/PsychofCuriosity.pdf) is the foundational paper. Two findings matter for T4A:

1. **Curiosity is a deprivation state, not an appetite.** It activates when the reader becomes aware of a *specific* gap between what they know and what they could know. Vague intrigue ("you won't believe what happened next") doesn't work — the gap must be locatable.
2. **A small priming dose maximally amplifies curiosity.** This is the single best argument for the hook card's existing structure: state the surface claim *with one specific number*, then plant the gap. The number IS the priming dose.

The clickbait failure mode is when there's a gap but no priming dose — pure mystery without a foothold. T4A's hook should *always* contain at least one verifiable fact, name, or number even on the surface-claim side.

### Identifiable victim / concreteness

[Small, Loewenstein & Slovic 2007](https://www.cmu.edu/dietrich/sds/docs/loewenstein/helpvictimAltruism.pdf) and the [identifiable victim effect literature](https://en.wikipedia.org/wiki/Identifiable_victim_effect) are unambiguous: a single named individual generates more emotional response, more action, and more memory than a statistical aggregate of thousands. Slovic's later work (*Numbers and Nerves*) generalized this to "psychic numbing": large statistics flatten emotional response.

**Practical translation for T4A's fact cards.** Lead with the identifiable case, then bracket with the statistic. Not "RM2.4B in unrecovered loans (one borrower defaulted twice)." Instead: *"One borrower defaulted twice — and still got a third loan worth RM800m."*

---

## 3. The Swipe-Loop / Addictive Design (and Where to Stop)

### B = MAP applied to a T4A reading session

[BJ Fogg's behavior model](https://behaviordesign.stanford.edu/resources/fogg-behavior-model) (B = Motivation × Ability × Prompt) is the cleanest design lens:

- **Motivation** — the curiosity gap planted by the hook plus the social-currency promise of "I'll be the one who knew this."
- **Ability** — the ease of the swipe gesture × the brevity of each card. **This is where T4A's character budget lives.** Fogg's key insight: *increasing ability is almost always cheaper than increasing motivation.* Cutting a card from 200 → 140 chars buys more next-swipes than rewriting the headline a third time.
- **Prompt** — the visible "next card" affordance, the push notification, the share preview.

A reader who can finish the card in 4 seconds will swipe even if the writing is merely competent. A reader staring at a 250-character wall needs every word to be dazzling or they bail.

### Eyal's Hook Model mapped onto an issue

[Nir Eyal's Hook Model](https://www.nirandfar.com/how-to-manufacture-desire/) is trigger → action → variable reward → investment.

Eyal's three reward types: *tribe* (social), *hunt* (information), *self* (mastery). T4A delivers heavily on hunt and self, **weakly on tribe**. The reframe card is the place to inject a tribal cue ("the question nobody is asking" — implicitly, you and T4A are now the people who do ask). But variability matters: **vary the rhetorical shape of the reframe across issues** — sometimes a question, sometimes a paradox, sometimes a hard sentence, sometimes a re-anchored number. If every reframe lands the same way, prediction-error dopamine flatlines.

The view card is the natural **investment** moment because it gives the reader a quotable position they can adopt as their own.

### TikTok / Reels — what to steal, what to refuse

Research on short-form video addiction ([Brown SPHJ 2021](https://sites.brown.edu/publichealthjournal/2021/12/13/tiktok/)) consistently identifies the addictive ingredients as: variable-ratio reward schedules, sub-second reward latency, infinite stack, algorithmic personalization.

**Steal:**
- **Sub-second within-card payoff.** The `big` line should deliver something concrete in the first 4 words. *"RM2.4 billion vanished"* beats *"An audit released last Tuesday revealed that..."*
- **Cliffhanger micro-payoffs at the end of each card.** The last 3–6 words of every card should create the next swipe. Borrowed from screenwriting "buttons" and YouTube retention editing.
- **Variable rhetorical shape across cards.** If all 7 cards open the same way, the brain stops releasing the prediction-error dopamine that makes swiping rewarding.

**Refuse:**
- **Infinite stacks.** T4A's 7-card cap is itself an ethical guardrail.
- **Algorithmic personalization** that filters out uncomfortable issues. Non-partisan trust requires every reader sees roughly the same feed.
- **Notification frequency above 3/week.** Push fatigue research is unambiguous.

The line: **engineer fluency, curiosity, and payoff. Refuse manufactured uncertainty about whether the content matters.** Slot machines work because you don't know if the next pull pays. T4A should work because you *do* know it will.

---

## 4. Shareability — What Makes People Forward

### Berger & Milkman: arousal beats valence

[Berger & Milkman, "What Makes Online Content Viral?" (2012)](https://jonahberger.com/wp-content/uploads/2013/02/ViralityB.pdf) analyzed 7,000 NYT articles and found:

- Positive content is shared more than negative *controlling for everything else*.
- But the dominant predictor is **physiological arousal**, not valence.
- High-arousal positive (awe) and high-arousal negative (anger, anxiety) both drive sharing.
- Low-arousal emotions (sadness, contentment) **suppress** sharing — even when the topic is important.

**Implication for T4A.** Sad issues underperform on sharing even when they're the most important. The fix is not to make sad topics happy — it is to find the *anger* or *anxiety* angle the same facts support. A temple demolition framed as "loss" gets read; framed as "the precedent for every other community" gets shared. The reframe card is the cleanest place to convert sadness into anxiety-of-precedent or anger-at-process without inventing emotion.

### STEPPS for T4A

[Berger's STEPPS framework](https://knowledge.wharton.upenn.edu/article/contagious-jonah-berger-on-why-things-catch-on/) — Social currency, Triggers, Emotion, Public, Practical value, Stories — applied:

- **Social currency.** Sharing T4A should make the sharer look smart and morally serious. The view card needs to be quotable. Ask: would a thoughtful reader paste this sentence into a WhatsApp group with no commentary? If not, rewrite.
- **Triggers.** T4A's lens taxonomy is itself a trigger — once a reader has the lens "Governance," every related news story re-activates T4A.
- **Emotion.** Aim for awe, anger, anxiety; avoid sadness as the dominant note.
- **Public.** The OG share card on WhatsApp is T4A's "public" surface — must be legible at thumbnail size.
- **Practical value.** "I now understand X" — the fact cards do this work.
- **Stories.** The 7-card sequence is a story. Make sure it has an arc, not just a list.

### The OG share card — the 2-second test

Most WhatsApp/Twitter shares are decided in <2 seconds based on the link preview. The card needs to deliver:
1. A **specific noun** (named institution, place, amount) — fluency anchor.
2. A **gap** (not the resolution) — Loewenstein priming.
3. A **visual** that could be a magazine cover, not a stock photo — fluency + identity-signal.
4. The T4A wordmark, small but present — trust attribution.

T4A's existing single-line-art aesthetic does real work: distinctive, high-contrast, photographs at any size, signals "thoughtful publication" rather than "content farm." **Keep it.**

---

## 5. Per-Card Best Practices

### The hook card

- **Function.** Plant a curiosity gap with a priming dose, in under 4 seconds, so the reader swipes.
- **Length.** `big` 80–140 chars; `sub` 120–180 chars; combined ≤280 chars (matches T4A's existing budget — no change needed).
- **Structure rules.**
  - The first 4 words of `big` must contain the most concrete element (named actor, number, or date).
  - The `sub` must contain the *one* specific detail that makes the gap feel real.
  - Active voice. Past tense for the surface claim. Verbs of *finding*, not *exploring*.
- **Anti-patterns.** "explores," "examines," "raises questions," "looks at," "sparks debate," "is set to," "reportedly," "amid concerns." Each signals thinkpiece-mode and kills curiosity.
- **Worked example.**
  - `big`: "Putrajaya called the RM800m flood plan 'on track.' The contract was signed 11 days ago."
  - `sub`: "Three named contractors, no tender, no completion date — and the federal auditor has not been briefed."

### Fact card 1 (identifiable / human-scale)

- **Function.** Convert the abstract issue into one identifiable case. Identifiable victim effect.
- **Structure.** Lead with the named case, bracket with the statistic.
- **Anti-patterns.** Statistics-first openings. *"76% of households…"* is not a fact card opening — it's a chart caption.
- **Worked example.**
  - `big`: "One Sabah village has waited 14 years for the road in the 2010 budget."
  - `sub`: "It is one of 47 villages on the same line item, total allocation RM310m, current completion: 9%." *(Lens: Regional)*

### Fact card 2 (structural / number-driven)

- **Function.** Zoom out from the case to show it is not isolated.
- **Structure.** The number goes in `big`; the comparison or denominator goes in `sub`. Raw numbers are inert without a denominator the reader can feel.
- **Anti-patterns.** Percentages without bases ("up 40%"). Comparative phrasing without an anchor ("the highest in years").
- **Worked example.**
  - `big`: "RM5.7 billion in flood-mitigation contracts since 2018 — 71% awarded without open tender."
  - `sub`: "The same six companies appear on 84% of the awarded contracts." *(Lens: Governance)*

### Fact card 3 (the missing voice)

- **Function.** Introduce the perspective mainstream coverage left out. Trust-builder.
- **Structure.** Name the omitted actor in `big`; quote or paraphrase their actual position in `sub`.
- **Anti-patterns.** "critics say," "some have argued," any unnamed-source phrasing. The whole point of this card is *who* is missing — naming them is the entire payload.
- **Worked example.**
  - `big`: "The village headman wrote three petitions. None were tabled in Parliament."
  - `sub`: "His 2023 letter to the MP, sighted by The Fourth Angle, was returned unopened." *(Lens: Social)*

### The reframe card

- **Function.** The dopamine spike. Restructure the issue so the reader's mental model rotates.
- **Length.** `big` only, 80–140 chars. **`sub` should usually be empty.** A second sentence dilutes the insight at the moment the reader should be having one thought.
- **Structure.** A single sentence that names the *real* subject of the issue, which is different from what the previous five cards seemed to be about. Best forms:
  - "X is not the story. Y is."
  - "The question is not whether A. It is whether B."
  - A bare paradox in <12 words.
- **Anti-patterns.** Rhetorical questions that don't restructure ("So what now?"). Hedged restructurings ("Perhaps the real issue is…"). Adding evidence (belongs on fact cards).
- **Worked example.**
  - `big`: "The leak is not the scandal. The auditor's six-month silence is the scandal."

### The analogy card (optional)

- **Function.** "Relief and consolidation." After the reframe restructures the issue, the analogy gives the reader a portable mental model they can carry into other conversations. **The transmission card** — the line that gets quoted in WhatsApp.
- **When to use.** When the issue is structurally complex (procurement, monetary policy, constitutional procedure). When the issue is already concrete (a person was arrested, a building collapsed), an analogy is filler. The Cowan-4 chunk limit argues *against* always including this card.
- **Structure.** "Think of it like…" — the vehicle of the analogy must be from a domain the reader has lived experience with (driving, food, family, weather, school) — never specialist knowledge.
- **Anti-patterns.** Analogies that flatter one side. The analogy must illuminate the *structure*, not assign blame.
- **Worked example.**
  - `big`: "It is like a building inspector who only checks the lobby and signs off the whole tower."
  - `sub`: "The audit covered 2.3% of the contracts by value. The other 97.7% were called 'representative samples.'"

### The view card

- **Function.** Give the reader a defensible, quotable position. The **investment** in Eyal's terms and the **social currency** in Berger's — readers adopt this sentence as their own.
- **Length.** `big` 120–180 chars. `sub` empty by default.
- **Structure.** A balanced statement that *names a specific tradeoff* rather than splitting the difference. Two clauses, parallel structure, no hedging adverbs.
- **Anti-patterns.** "more research is needed," "time will tell," "the truth lies somewhere in between," any phrase a centrist columnist would use to avoid taking a position. Berger-Milkman: low-arousal phrasing kills sharing.
- **Worked example.**
  - `big`: "Wanting fewer floods is reasonable. Hiding the contracts that promise to deliver them is not."

---

## 6. Per-Issue and Per-Page Rules

### 80% only read the hook — editorial-effort allocation

If 80% of visitors read only the hook, then headline + hook account for ~80% of all reader-seconds the issue earns. **Editorial effort should not be uniform across cards.** A reasonable allocation:

- **Headline + hook card: 50%** of editing time
- **Reframe card: 20%** (the dopamine spike that earns shares from the 20% who go deep)
- **View card: 15%** (the line that gets quoted)
- **Three fact cards: 15% combined**

Uncomfortable because the fact cards are where the *journalism* lives. But fluency and curiosity at the entry point determine whether any of the journalism is read at all.

### Pacing — where the dopamine should land

1. **Hook** — curiosity activation (Loewenstein priming).
2. **Fact 1** — first partial resolution (small dopamine hit).
3. **Fact 2** — escalation (the pattern is bigger than expected — Berger-Milkman arousal peak).
4. **Fact 3** — surprise / missing voice (mild aha).
5. **Reframe** — main aha spike (Kounios-Beeman gamma burst).
6. **Analogy** — consolidation; portable model reduces cognitive load.
7. **View** — identity-signal payoff.

**Most common pacing failure: flat escalation** — three fact cards equally interesting. The middle fact card should always be the most quantitatively shocking; that's where Berger-Milkman arousal peaks and the swipe-through to the reframe is earned.

### Session length — 60–90 seconds is right but for a different reason

Axios research says readers spend ~26 seconds on an article on average. T4A's 60–90 second target is *aspirational*. The honest framing: **most readers spend ~25 seconds (hook only); engaged readers spend ~75 seconds (full stack).** Both numbers should drive design.

At conservative mobile reading speed (~200 wpm for skim), 1300 chars ≈ 250 words ≈ 75 seconds. **That's why ~1300 chars is the right total budget. Do not raise it.**

### When does a 7th card help vs hurt?

Cowan's 4-chunk limit predicts that beyond 4 distinct ideas, additional cards have diminishing returns. The analogy card is *consolidative* (re-uses an existing chunk) so it doesn't cost a new slot. The view card is similarly consolidative. **Card 6 and 7 must consolidate, not introduce.** Adding a *new factual* 7th card would hurt.

---

## 7. Concrete Revisions to T4A's Current Rules

### Character budget — keep, with minor target adjustments only

| Field | Current target | Recommended | Rationale |
|---|---:|---:|---|
| `headline` | 75 | **75 (no change)** | BuzzSumo + Google SERP sweet spot. Already correct. |
| `context` | 200 | **200 (no change)** | Tightening retroactively would create 263 new noisy warnings without rewriting content. New issues should aim lower (~160) per editorial guidance, not validator. |
| `card.big` | 120 | **120 (no change)** | Same reason — tightening to 100 would add 761 new warnings to existing corpus. Editorial guidance: aim for ~100 on new issues. |
| `card.sub` | 160 | **160 (no change)** | Same. |
| `big+sub` | 240 | **240 (no change)** | Same. |
| Total per issue | ~1300 | **~1300 (no change)** | Correct. |

**Rationale for not tightening the validator.** A simulation showed that lowering targets to 100 / 160 / 140 would push 651 currently-passing issues into warning state. That defeats the purpose of warnings as drift signals — when 95%+ of content is non-compliant, editors learn to ignore warnings. The research-backed tightening should live in *editorial guidance*, not in retroactive validator thresholds.

### Hook engineering rules — research strengthens existing rules

The CLAUDE.md hook rules (name surface claim, plant gap, one specific number, payoff in one swipe; avoid "explores/examines/raises questions") are *all* directly supported by Loewenstein, Berger-Milkman, and the fluency literature. Two additions:

1. **First-4-words rule.** The most concrete element (number, name, or date) must appear in the first 4 words of `big`. NN/G F-pattern + Reber-Schwarz fluency.
2. **Cliffhanger button.** The last ~6 words of every card except the view should create the next-swipe motivation.

### New rules — high-leverage levers T4A is leaving on the table

1. **Repetition of key terms across cards within an issue.** Don't elegant-vary "the contract" → "the deal" → "the agreement." Pick one phrase per entity per issue. Reber-Schwarz fluency-truth: re-encountering boosts perceived truth.
2. **Named-entity discipline on fact card 3.** Always name a specific person — never "residents," "critics," "observers." Identifiable victim effect.
3. **The view card must be quotable in isolation.** If you read only `view.big` with no context, does it stand as a tweet? If not, it's a hedge.
4. **Variable rhetorical shape across reframes.** Track form across the last 10 issues. Force variation. Prevents prediction-error flatlining.
5. **Anger/anxiety-not-sadness check.** For each issue, ask which Berger-Milkman emotion the hook is targeting. If sadness or generalized concern, reframe to anger-at-process or anxiety-of-precedent before publishing.
6. **Concreteness floor.** Every fact card must contain at least one named entity OR one number with a denominator.
7. **Reframe `sub` empty by default.** A second sentence dilutes the insight at the moment the reader should be having one thought.

### What other bite-size publishers do that T4A doesn't

- **Axios "Why it matters":** explicit labeled hook line. T4A's `context` does some of this work but unlabeled.
- **The Hustle's specificity in numbers:** never round. *"RM2,447,118"* outperforms *"RM2.4 million"* on memorability and trust.
- **NowThis's caption-sized claims:** OG cards could go shorter than article headline — try a separate 40-char OG line.

---

## 8. Risks and Ethical Guardrails

### Where addiction mechanics damage the trust brand

Three dark patterns are incompatible with non-partisan integrity:

1. **Algorithmic personalization** that filters issues per reader. Refuse it. Every reader sees the same feed.
2. **Manufactured uncertainty about outcomes** (reality-TV cliffhangers, "you won't believe what happens"). The cliffhanger button at the end of each card is fine *if* it teases the next finding; it is dishonest if it teases an emotional payoff that doesn't arrive. The test: the last six words of card N must be a real preview of card N+1, not bait.
3. **Notification frequency above the current 3/week.** Push fatigue research is unambiguous. Stay at three.

### Non-partisan integrity vs. irresistibility

The tension is smaller than it looks. The techniques that drive sharing — concreteness, fluency, curiosity gaps, identifiable cases, restructuring reframes — are *content-neutral*. They make any well-reported story more readable. They push the reader to *finish reading*, not toward a partisan conclusion.

The dangerous techniques — outrage-targeting, in-group/out-group framing, identity-flattering villains — are partisan by construction. **Anger at *processes* (no tender, missing audit, ignored petition) is non-partisan; anger at *people* or *groups* is not.**

### Malaysian context shifts

1. **3R sensitivity (Race, Religion, Royalty).** Concreteness and identifiable-victim techniques become high-risk when the named victim or perpetrator belongs to a racial or religious category. The mitigation is structural: always frame the named entity by *role* (the developer, the auditor, the village headman, the MP), not by community. The reframe card is the highest-risk slot.
2. **WhatsApp share dominance.** Malaysian news flows through WhatsApp groups more than through Twitter or Facebook. This makes the OG share card and the *quotable single sentence* (the view card) disproportionately important compared to American products.
3. **Trust deficit in mainstream media.** Helps T4A's "what they said vs what we found" structure — the hook lands in receptive ground. But raises the stakes on fact cards: a single sourcing error becomes evidence T4A is "just another." The concreteness rules are not just engagement levers in Malaysia — they are credibility infrastructure.

---

## TL;DR — The 10 Highest-Leverage Changes, Ranked

1. **First-4-words rule on every card.** Most concrete element (number, name, date) in the first 4 words of `big`. F-pattern + fluency.
2. **Cliffhanger button on cards 1–6.** Last ~6 words preview the next card honestly. TikTok retention craft without dishonesty.
3. **Reframe card: `sub` empty by default.** A second sentence dilutes the aha spike.
4. **Identifiable case must lead fact card 1.** Named individual or specific instance, then bracketed by the statistic. Identifiable-victim effect.
5. **View card must pass the WhatsApp-quote test.** A sentence that stands alone as a paste-without-comment quote.
6. **Repeat key terms across cards within an issue.** Don't elegant-vary. Reber-Schwarz fluency-truth.
7. **Vary the rhetorical shape of the reframe across issues.** Track the last 10; force variation. Prevents prediction-error flatlining.
8. **Anger/anxiety check on every hook.** If dominant emotion is sadness or generalized concern, reframe to anger-at-process or anxiety-of-precedent.
9. **Concreteness floor on fact cards.** Each fact card has at least one named entity OR one number with a denominator.
10. **Middle fact card carries the most shocking number.** Pacing — Berger-Milkman arousal peaks here, earning the swipe through to the reframe.

**Two things to NOT change:**
- The 75-char headline target (already in the BuzzSumo / Google sweet spot).
- The 7-card cap with optional analogy (Cowan-4 ceiling).

**Two ethical lines to hold:**
- No algorithmic personalization of the feed.
- No frequency increase above 3 notifications/week.

---

## Notes on contested or thin evidence

- The "8-second attention span" stat is folklore. The Microsoft Canada study often cited has been widely debunked. Avoid relying on it.
- BuzzSumo's headline-length data is observational and confounded. Treat the 60–100 char band as *consistent with* multiple studies, not as a proven optimum.
- Reber-Schwarz fluency-truth is robust on simple statements; whether it generalizes to multi-sentence editorial copy is less well-studied. The mechanism is sound; the magnitude in T4A's exact context is unmeasured.
- Insight / aha neural-reward findings (Tik et al., Oh et al.) are recent and replication is incomplete. The behavioral phenomenon is solid; the dopamine-system specifics may be revised.
- Almost all "TikTok addiction" neuroscience is observational and journalistic. The variable-ratio mechanism is well-grounded in Skinner; the specific TikTok-brain claims are weaker.

**Strongest evidence to lean on:** Cowan working memory, Reber-Schwarz-Winkielman fluency, Loewenstein curiosity gaps, Small-Loewenstein-Slovic identifiable victim, Berger-Milkman viral arousal.
