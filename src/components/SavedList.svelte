<script lang="ts">
  import { $savedCards as savedCardsStore } from '../lib/store';

  let cards: Array<{issueSlug: string, cardIndex: number}> = $state([]);

  $effect(() => {
    const unsub = savedCardsStore.subscribe(val => {
      cards = val;
    });
    return unsub;
  });

  function getGrouped(items: Array<{issueSlug: string, cardIndex: number}>) {
    const map = new Map<string, number[]>();
    for (const c of items) {
      if (!map.has(c.issueSlug)) map.set(c.issueSlug, []);
      map.get(c.issueSlug)!.push(c.cardIndex);
    }
    return map;
  }

  let grouped = $derived(getGrouped(cards));

  function formatSlug(slug: string) {
    return slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
</script>

{#if cards.length === 0}
  <div style="text-align:center;padding:48px 24px;">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--amber-light)" stroke-width="1.5" style="margin:0 auto 20px;display:block;">
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
    </svg>
    <h3 style="font-family:var(--font-display);font-size:18px;font-weight:700;color:var(--text-primary);margin:0 0 8px 0;">Your reading shelf</h3>
    <p style="font-size:14px;color:var(--text-secondary);line-height:1.6;margin:0 0 24px 0;">Tap the bookmark icon on any card to save insights here. Build your personal collection of the angles that matter most.</p>

    <div style="text-align:left;">
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-tertiary);font-weight:600;margin:0 0 12px 0;">Start with these</p>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <a href="/issue/temple-demolitions" style="display:flex;align-items:center;gap:12px;background:var(--card);border-radius:14px;padding:14px 16px;text-decoration:none;color:inherit;border:1px solid var(--border);">
          <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg, var(--card-dark), var(--card-dark-end));display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <span style="color:var(--text-on-dark);font-size:14px;">§</span>
          </div>
          <div>
            <p style="font-family:var(--font-display);font-size:14px;font-weight:700;color:var(--text-primary);margin:0;">Temple Demolitions & Land Rights</p>
            <p style="font-size:12px;color:var(--text-tertiary);margin:2px 0 0 0;">6 angles · Historical, Legal, Critical</p>
          </div>
        </a>
        <a href="/issue/financial-verdict" style="display:flex;align-items:center;gap:12px;background:var(--card);border-radius:14px;padding:14px 16px;text-decoration:none;color:inherit;border:1px solid var(--border);">
          <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg, var(--card-dark), var(--card-dark-end));display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <span style="color:var(--text-on-dark);font-size:14px;">∑</span>
          </div>
          <div>
            <p style="font-family:var(--font-display);font-size:14px;font-weight:700;color:var(--text-primary);margin:0;">Major Financial Verdict</p>
            <p style="font-size:12px;color:var(--text-tertiary);margin:2px 0 0 0;">6 angles · Legal, Economic, Critical</p>
          </div>
        </a>
        <a href="/issue/anti-corruption-paradox" style="display:flex;align-items:center;gap:12px;background:var(--card);border-radius:14px;padding:14px 16px;text-decoration:none;color:inherit;border:1px solid var(--border);">
          <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg, var(--card-dark), var(--card-dark-end));display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <span style="color:var(--text-on-dark);font-size:14px;">∿</span>
          </div>
          <div>
            <p style="font-family:var(--font-display);font-size:14px;font-weight:700;color:var(--text-primary);margin:0;">Anti-Corruption Agency Paradox</p>
            <p style="font-size:12px;color:var(--text-tertiary);margin:2px 0 0 0;">6 angles · Legal, Social, Critical</p>
          </div>
        </a>
      </div>
    </div>
  </div>
{:else}
  <div style="display:flex;flex-direction:column;gap:12px;">
    {#each [...grouped.entries()] as [slug, indices]}
      <a href={`/issue/${slug}`} style="display:flex;align-items:center;gap:12px;background:var(--card);border-radius:14px;padding:16px;text-decoration:none;color:inherit;border:1px solid var(--border);">
        <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg, var(--card-dark), var(--card-dark-end));display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <span style="color:var(--text-on-dark);font-family:var(--font-display);font-size:14px;font-weight:700;">{indices.length}</span>
        </div>
        <div>
          <h3 style="font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--text-primary);margin:0;">{formatSlug(slug)}</h3>
          <p style="font-size:12px;color:var(--text-tertiary);margin:2px 0 0 0;">{indices.length} card{indices.length > 1 ? 's' : ''} saved</p>
        </div>
      </a>
    {/each}
  </div>
{/if}
