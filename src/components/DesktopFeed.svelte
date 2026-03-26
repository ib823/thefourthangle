<script lang="ts">
  import FeedRow from './FeedRow.svelte';
  import { getReadCount } from '../stores/reader';
  import { issueCategory } from '../data/issues';

  interface Props {
    issues: any[];
    activeId: string | null;
    readMap: Record<string, string>;
    onSelectIssue: (issue: any) => void;
    searchQuery?: string;
    onSearchInput?: (query: string) => void;
    onSearchFocus?: () => void;
    onSearchClear?: () => void;
  }
  let { issues, activeId, readMap, onSelectIssue, searchQuery = '', onSearchInput, onSearchFocus, onSearchClear }: Props = $props();

  function issueReadState(id: string): { state: string; progress: number } | null {
    const raw = readMap[id];
    if (!raw) return null;
    if (raw === 'true') return { state: 'completed', progress: 6 };
    try { return JSON.parse(raw); } catch { return null; }
  }

  let counts = $derived(getReadCount(readMap));
  let readCount = $derived(counts.completed);
  let isSearching = $derived(searchQuery.trim().length > 0);

  let sortMode = $state<'editorial' | 'topic'>('editorial');

  let displayIssues = $derived.by(() => {
    if (sortMode === 'editorial') return issues;
    // Group by category, maintain editorial order within groups
    const grouped = new Map<string, any[]>();
    for (const issue of issues) {
      const cat = issueCategory(issue);
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(issue);
    }
    return { grouped };
  });

  let isGrouped = $derived(sortMode === 'topic' && typeof displayIssues === 'object' && 'grouped' in displayIssues);
</script>

<aside aria-label="Issue list" style="width:360px;height:100vh;overflow-y:auto;border-right:1px solid var(--bg-sunken);flex-shrink:0;background:var(--bg);display:flex;flex-direction:column;">
  <div style="padding:12px 20px;flex-shrink:0;">
    <div style="position:relative;">
      <input
        data-search-input
        type="text"
        placeholder="Search issues..."
        value={searchQuery}
        oninput={(e) => onSearchInput?.((e.currentTarget as HTMLInputElement).value)}
        onfocus={() => onSearchFocus?.()}
        style="width:100%;padding:8px 32px 8px 12px;font-size:13px;border:1px solid var(--border-subtle);border-radius:8px;background:var(--bg-sunken);color:var(--text-primary);outline:none;transition:border-color 0.15s ease;"
        onfocusin={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--score-info)'; }}
        onfocusout={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
      />
      {#if isSearching}
        <button
          onclick={() => onSearchClear?.()}
          style="position:absolute;right:4px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:14px;color:var(--text-tertiary);padding:8px;min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;"
          aria-label="Clear search"
        >x</button>
      {/if}
    </div>
    <div style="margin-top:6px;display:flex;align-items:center;justify-content:space-between;">
      <span style="font-size:11px;color:var(--text-tertiary);">
        {#if isSearching}
          {issues.length} result{issues.length !== 1 ? 's' : ''}
        {:else}
          {issues.length} issues
        {/if}
      </span>
      {#if !isSearching}
        <div style="display:flex;gap:4px;font-size:11px;" role="radiogroup" aria-label="Feed sort order">
          <button onclick={() => sortMode = 'editorial'} role="radio" aria-checked={sortMode === 'editorial'} style="background:none;border:none;cursor:pointer;padding:8px 12px;border-radius:4px;min-height:44px;color:{sortMode === 'editorial' ? 'var(--text-primary)' : 'var(--text-faint)'};font-weight:{sortMode === 'editorial' ? '600' : '400'};transition:color 0.15s ease;">Editorial</button>
          <button onclick={() => sortMode = 'topic'} role="radio" aria-checked={sortMode === 'topic'} style="background:none;border:none;cursor:pointer;padding:8px 12px;border-radius:4px;min-height:44px;color:{sortMode === 'topic' ? 'var(--text-primary)' : 'var(--text-faint)'};font-weight:{sortMode === 'topic' ? '600' : '400'};transition:color 0.15s ease;">By topic</button>
        </div>
      {/if}
    </div>
  </div>
  <div style="flex:1;overflow-y:auto;">
    {#if issues.length === 0 && isSearching}
      <div style="padding:40px 20px;text-align:center;">
        <p style="font-size:13px;color:var(--text-muted);">No issues match "{searchQuery}"</p>
      </div>
    {:else if sortMode === 'topic' && !isSearching}
      {#each [...(displayIssues as any).grouped.entries()] as [category, groupIssues]}
        <div style="padding:12px 20px 4px;border-top:1px solid var(--bg-sunken);">
          <span style="font-size:10px;font-weight:600;text-transform:uppercase;color:var(--text-muted);letter-spacing:0.5px;">{category}</span>
        </div>
        {#each groupIssues as issue}
          <FeedRow {issue} readState={issueReadState(issue.id)} isActive={activeId === issue.id} onClick={() => onSelectIssue(issue)} />
        {/each}
      {/each}
    {:else}
      {#each issues as issue}
        <FeedRow {issue} readState={issueReadState(issue.id)} isActive={activeId === issue.id} onClick={() => onSelectIssue(issue)} />
      {/each}
    {/if}
  </div>
  <div style="padding:12px 20px;border-top:1px solid var(--bg-sunken);flex-shrink:0;">
    <div style="font-size:10px;color:var(--text-tertiary);text-align:center;">
      Press ↑↓ to navigate · Enter to read · / to search
    </div>
    <div style="font-size:11px;color:var(--text-tertiary);margin-top:6px;text-align:center;">
      <a href="/about" style="color:var(--text-tertiary);text-decoration:none;">About</a>
    </div>
  </div>
</aside>
