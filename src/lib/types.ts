export type CardType = 'hook' | 'fact' | 'reframe' | 'mature';
export type Lens = 'legal' | 'social' | 'economic' | 'historical' | 'theological' | 'critical';

export interface Card {
  t: CardType;
  text?: string;
  sub?: string;
  lens?: Lens;
  h?: string;
  s?: string;
  d?: string;
}

export interface AuditData {
  finalScore: number;
  factual: number;
  balance: number;
  completeness: number;
  courage: number;
  biasVector: Record<string, number>;
  conflictK: number;
  independence: number;
  completenessRatio: number;
  claimsEstablished: number;
  claimsHedged: number;
  claimsDisputed: number;
}

export interface Issue {
  id: string;
  slug: string;
  title: string;
  period: string;
  publishedAt: string;
  sources: string;
  confidence: string;
  confidenceDetail: string;
  lenses: Lens[];
  audit: AuditData;
  cards: Card[];
}
