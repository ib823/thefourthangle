export interface Card {
  t: "hook" | "fact" | "reframe" | "analogy" | "view";
  big: string;
  sub: string;
  lens?: string;
}

export interface StageScores {
  pa: number;
  ba: number;
  fc: number;
  af?: number;   // Stage 4 (Alternative Framing) — optional; legacy 6-stage issues
  ct?: number;   // Stage 5 (Contrarian Stress-Test) — optional; legacy 6-stage issues
  sr: number;
}

export interface Issue {
  id: string;
  opinionShift: number;
  status: "new" | "updated" | null;
  edition: number;
  headline: string;
  context: string;
  cards: Card[];
  stageScores?: StageScores;
  finalScore?: number;
  related?: string[];
  sourceDate?: string;
  published?: boolean;
}

export const CARD_TYPES: Record<string, { label: string; color: string; bg: string }> = {
  hook:    { label: "What they said",      color: "var(--card-hook-color)", bg: "var(--card-hook-bg)" },
  fact:    { label: "What we found",       color: "var(--card-fact-color)", bg: "var(--card-fact-bg)" },
  reframe: { label: "The real question",   color: "var(--card-reframe-color)", bg: "var(--card-reframe-bg)" },
  analogy: { label: "Think of it this way", color: "var(--card-analogy-color)", bg: "var(--card-analogy-bg)" },
  view:    { label: "The considered view",  color: "var(--card-view-color)", bg: "var(--card-view-bg)" },
};

export function opinionColor(s: number): string {
  if (s >= 80) return "var(--score-strong)";
  if (s >= 60) return "var(--score-medium)";
  if (s >= 40) return "var(--score-partial)";
  return "var(--score-neutral)";
}

export function opinionLabel(s: number): string {
  if (s >= 80) return "Fundamental";
  if (s >= 60) return "Significant";
  if (s >= 40) return "Partial";
  return "Surface";
}

const LENS_TO_CATEGORY: Record<string, string> = {
  'Legal': 'Law & Rights',
  'Rights': 'Law & Rights',
  'Economic': 'Money & Economy',
  'Governance': 'Money & Economy',
  'Technology': 'Money & Economy',
  'Social': 'People & Society',
  'Political': 'People & Society',
  'Health': 'People & Society',
  'Environmental': 'Land & Environment',
  'Regional': 'Land & Environment',
  'Historical': 'Land & Environment',
  'Critical': 'People & Society',
  'Theological': 'People & Society',
  'Security': 'People & Society',
};

export function issueCategory(issue: Issue): string {
  const firstFact = issue.cards.find(c => c.t === 'fact' && c.lens);
  if (firstFact?.lens && LENS_TO_CATEGORY[firstFact.lens]) {
    return LENS_TO_CATEGORY[firstFact.lens];
  }
  return 'People & Society';
}
