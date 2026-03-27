import MiniSearch from 'minisearch';

let miniSearch: MiniSearch | null = null;
let loading = false;
let loaded = false;

export async function loadSearchIndex(): Promise<void> {
  if (loaded || loading) return;
  loading = true;
  try {
    const res = await fetch('/search-index.json');
    const json = await res.json();
    miniSearch = MiniSearch.loadJSON(JSON.stringify(json), {
      fields: ['headline', 'context', 'cardBigs', 'lenses'],
      storeFields: ['id'],
      searchOptions: {
        boost: { headline: 3, context: 2, cardBigs: 1, lenses: 1 },
        fuzzy: 0.2,
        prefix: true,
      },
    });
    loaded = true;
  } catch {
    // Silently fail — search won't work but app continues
  }
  loading = false;
}

export function search(query: string): string[] {
  if (!miniSearch || !query.trim()) return [];
  const results = miniSearch.search(query, {
    boost: { headline: 3, context: 2, cardBigs: 1, lenses: 1 },
    fuzzy: 0.2,
    prefix: true,
  });
  return results.map(r => r.id as string);
}

export function isLoaded(): boolean {
  return loaded;
}
