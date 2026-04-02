import MiniSearch from 'minisearch';
import { freshFetch } from './build';

let miniSearch: MiniSearch | null = null;
let loading = false;
let loaded = false;

const SEARCH_CONFIG = {
  fields: ['headline', 'context', 'cardBigs', 'cardSubs', 'lenses'],
  storeFields: ['id'],
  searchOptions: {
    boost: { headline: 3, context: 2, cardBigs: 1.5, cardSubs: 1, lenses: 1 },
    fuzzy: 0.2,
    prefix: true,
  },
};

/** Minimum characters before search fires (avoids noisy single-char results) */
const MIN_QUERY_LENGTH = 2;

export async function loadSearchIndex(): Promise<void> {
  if (loaded || loading) return;
  loading = true;
  try {
    const res = await freshFetch('/search-index.json');
    const json = await res.json();
    miniSearch = MiniSearch.loadJSON(JSON.stringify(json), SEARCH_CONFIG);
    loaded = true;
  } catch {
    // Silently fail — search won't work but app continues
  }
  loading = false;
}

export function search(query: string): string[] {
  const q = query.trim();
  if (!miniSearch || q.length < MIN_QUERY_LENGTH) return [];
  const results = miniSearch.search(q, SEARCH_CONFIG.searchOptions);
  return results.map(r => r.id as string);
}

export function isLoaded(): boolean {
  return loaded;
}

export function isLoading(): boolean {
  return loading;
}
