# Tier 2 Resolution Confirmation — 2026-04-08

For each Tier 2 issue (low Stage 3 confidence), checks whether the currently-published cards substantially incorporate the Stage 3 critique. Issues with all corrections applied are marked RESOLVED — they remain in the audit Tier 2 list only because the Stage 3 file evaluates the pre-correction draft.

| ID | Resolution | Notes |
|---|---|---|
| 1043 | RESOLVED | All 8 flagged claims absent from current cards |
| 1146 | PARTIAL | 2 of 9 flagged claims may still be present |
| 1871 | UNRESOLVED | 4 of 11 flagged claims likely still in cards |
| 1887 | UNRESOLVED | 5 of 11 flagged claims likely still in cards |
| 1958 | PARTIAL | 1 of 2 flagged claims may still be present |
| 1960 | PARTIAL | 2 of 8 flagged claims may still be present |
| 1961 | RESOLVED | All 2 flagged claims absent from current cards |
| 1962 | STUB | Stage 3 has FAS=72 but no actionable claims/corrections — no audit signal |
| 1963 | STUB | Stage 3 has FAS=74 but no actionable claims/corrections — no audit signal |
| 1964 | RESOLVED | All 1 flagged claims absent from current cards |
| 1965 | PARTIAL | 2 of 5 flagged claims may still be present |
| 1966 | RESOLVED | All 3 flagged claims absent from current cards |
| 1967 | UNRESOLVED | 4 of 5 flagged claims likely still in cards |
| 1970 | UNRESOLVED | 3 of 8 flagged claims likely still in cards |
| 1971 | RESOLVED | All 6 flagged claims absent from current cards |
| 1972 | PARTIAL | 1 of 6 flagged claims may still be present |
| 1973 | STUB | Stage 3 has FAS=66 but no actionable claims/corrections — no audit signal |
| 1974 | STUB | Stage 3 has FAS=61 but no actionable claims/corrections — no audit signal |
| 1975 | PARTIAL | 3 of 9 flagged claims may still be present |

## Summary

| Status | Count |
|---|---:|
| RESOLVED | 5 |
| PARTIAL | 6 |
| UNRESOLVED | 4 |
| STUB (no actionable Stage 3) | 4 |

## Interpretation

Issues marked RESOLVED appear in the Tier 2 audit list only because the Stage 3 file on disk evaluates the *pre-correction draft*, not the currently-published edition. The audit script does not (yet) re-score Stage 3 against the live cards. PARTIAL and UNRESOLVED issues are the genuine remaining editorial debt.

Use `node scripts/view-stage3.mjs <id>` to inspect the cross-reference between Stage 3 critique and current cards on any specific issue.