/**
 * Issue Template — Copy this block to add a new issue to src/data/issues.ts
 *
 * Add inside the ISSUES array (typically at the top for newest-first ordering).
 * Then run: node scripts/validate-issues.mjs
 * Then run: npm run build
 *
 * REQUIRED FIELDS:
 *   id            4-digit string, unique across all issues
 *   opinionShift  0-100, how much does this shift perspective
 *   status        "new" | "updated" | null
 *   edition       integer starting at 1, increment on updates
 *   headline      10-120 chars, the hook
 *   context       20-350 chars, situational summary
 *   cards         Array of 5-7 cards (typically 6: 1 hook, 3 fact, 1 reframe, 1 view)
 *   stageScores   { pa, ba, fc, af, ct, sr } — each 0-100
 *   finalScore    0-100, overall neutrality metric
 *
 * CARD STRUCTURE:
 *   t     "hook" | "fact" | "reframe" | "view"
 *   big   Bold headline text (5-300 chars)
 *   sub   Supporting text (can be "" for empty)
 *   lens  Required on "fact" cards only. One of:
 *         Legal, Rights, Economic, Governance, Technology,
 *         Social, Political, Health, Environmental, Regional,
 *         Historical, Critical, Theological, Security
 *
 * CARD SEQUENCE:
 *   [0] hook     — What's being claimed or reported
 *   [1] fact     — First evidence/data point (with lens)
 *   [2] fact     — Second evidence/data point (with lens)
 *   [3] fact     — Third evidence/data point (with lens)
 *   [4] reframe  — The real question nobody is asking
 *   [5] view     — The considered, balanced conclusion
 */

// ─── COPY BELOW THIS LINE ───

  {
    id: "XXXX", opinionShift: 0, status: "new", edition: 1,
    headline: "",
    context: "",
    stageScores: { pa: 0, ba: 0, fc: 0, af: 0, ct: 0, sr: 0 },
    finalScore: 0,
    cards: [
      { t: "hook", big: "", sub: "" },
      { t: "fact", big: "", sub: "", lens: "Legal" },
      { t: "fact", big: "", sub: "", lens: "Economic" },
      { t: "fact", big: "", sub: "", lens: "Social" },
      { t: "reframe", big: "", sub: "" },
      { t: "view", big: "", sub: "" },
    ]
  },

// ─── COPY ABOVE THIS LINE ───
