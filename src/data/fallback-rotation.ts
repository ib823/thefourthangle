/**
 * Fallback rotation pool — when no manual publishing happens
 * before a scheduled notification, the system publishes one of
 * these pre-selected sets (rotating weekly).
 *
 * All 40 issues must have:
 * - One-line art image in public/og/backgrounds/issue-{id}-bg.png
 * - Content signatures in signatures.json
 * - Legal clearance confirmed
 *
 * Week selection: Math.ceil(dayOfMonth / 7) gives week 1-4
 */

export const FALLBACK_WEEKS: string[][] = [
  // Week 1 (1st-7th of month)
  ["1074", "1239", "1288", "1389", "1606", "1120", "1315", "1511", "1581", "1653"],

  // Week 2 (8th-14th)
  ["0154", "1067", "1170", "1262", "1471", "1604", "1675", "0179", "1049", "1227"],

  // Week 3 (15th-21st)
  ["1283", "1401", "1520", "1564", "1641", "1950", "0142", "0150", "0165", "1018"],

  // Week 4 (22nd-31st)
  ["1100", "1165", "1248", "1327", "1364", "1435", "1549", "1603", "1662", "1879"],
];

export function getFallbackIssueIds(): string[] {
  const day = new Date().getDate();
  const weekIndex = Math.min(Math.floor((day - 1) / 7), 3);
  return FALLBACK_WEEKS[weekIndex];
}
