<script lang="ts">
  import { onMount } from 'svelte';
  import type { Issue } from '../data/issues';
  import { issueCategory, CARD_TYPES } from '../data/issues';
  import { loadFeedIssues, loadFullIssue } from '../lib/issues-loader';
  import Header from './Header.svelte';
  import DesktopCard from './DesktopCard.svelte';
  import DesktopFeed from './DesktopFeed.svelte';
  import DesktopReader from './DesktopReader.svelte';
  import DesktopEmptyState from './DesktopEmptyState.svelte';
  import MobileBrowser from './MobileBrowser.svelte';
  import InsightReader from './InsightReader.svelte';
  import { readIssues, getSavedPosition, savePosition, clearPosition, getReactions, computeAffinity, scoreIssue } from '../stores/reader';
  import { loadSearchIndex, search as doSearch, isLoaded as searchReady } from '../lib/search';
  import { getAnimationTier } from '../lib/animation';

  interface FeedIssue {
    id: string;
    opinionShift: number;
    status: "new" | "updated" | null;
    edition: number;
    headline: string;
    context: string;
    stageScores?: { pa: number; ba: number; fc: number; af: number; ct: number; sr: number };
    finalScore?: number;
    cards: Array<{ t: string; lens?: string }>;
  }

  interface Props {
    initialIssueId?: string;
    feedData?: FeedIssue[];
  }
  let { initialIssueId, feedData = [] }: Props = $props();

  let viewMode = $state<'mobile' | 'tablet' | 'desktop'>('desktop');
  let searchQuery = $state('');
  let searchActive = $state(false);

  // Feed data comes from Astro props (SSR-available) or from async fetch
  let issues = $state<FeedIssue[]>(feedData);

  // Full issue for the reader (has card text)
  let activeFullIssue = $state<Issue | null>(null);

  let filteredIssues = $derived.by(() => {
    if (!searchQuery.trim()) return issues;
    const ids = doSearch(searchQuery);
    if (ids.length === 0) return [];
    const idSet = new Set(ids);
    return issues.filter(i => idSet.has(i.id));
  });

  function onSearchFocus() {
    loadSearchIndex();
    searchActive = true;
  }

  function onSearchClear() {
    searchQuery = '';
    searchActive = false;
  }

  // Restore position: initialIssueId (from URL) takes priority, then saved position
  let restoredPosition = getSavedPosition();
  let restoredCardIndex = $state(restoredPosition?.cardIndex ?? 0);
  let showContextWhisper = $state(!!restoredPosition && restoredPosition.cardIndex > 0);

  // Active issue in feed context (summary)
  let activeIssue: FeedIssue | null = $state(
    initialIssueId
      ? issues.find(i => i.id === initialIssueId) ?? null
      : restoredPosition
        ? issues.find(i => i.id === restoredPosition!.feedIssueId) ?? null
        : null
  );
  let readMap: Record<string, string> = $state({});

  // Compute initial feed index for mobile browser
  let initialFeedIndex = $state(
    restoredPosition
      ? Math.max(0, issues.findIndex(i => i.id === restoredPosition!.feedIssueId))
      : 0
  );

  function getState(id: string) {
    const raw = readMap[id];
    if (!raw) return null;
    if (raw === 'true') return { state: 'completed', progress: 6 };
    try { return JSON.parse(raw); } catch { return null; }
  }

  $effect(() => {
    const unsub = readIssues.subscribe(v => { readMap = { ...v }; });
    return unsub;
  });

  // Save position whenever active issue changes
  $effect(() => {
    if (activeIssue) {
      savePosition(activeIssue.id, 0);
    }
  });

  // Interest-based feed sorting — computed ONCE on load, stable during session.
  // Prevents jarring list reorder when the user clicks/reads an issue.
  let stableSortOrder: string[] | null = null;

  function computeStableSort(issueList: FeedIssue[], rMap: Record<string, string>): FeedIssue[] {
    const completedCount = Object.values(rMap).filter(v => {
      if (!v) return false;
      if (v === 'true') return true;
      try { return JSON.parse(v).state === 'completed'; } catch { return false; }
    }).length;
    if (completedCount < 10) return issueList;

    const reactionMap = getReactions();
    const affinity = computeAffinity(rMap, reactionMap, issueList);

    const read = issueList.filter(i => rMap[i.id]);
    const unread = issueList.filter(i => !rMap[i.id]);

    const scored = unread.map(i => ({ issue: i, score: scoreIssue(i, affinity) }));
    scored.sort((a, b) => b.score - a.score);

    return [...scored.map(s => s.issue), ...read];
  }

  // Compute sort order once when issues first load, then freeze it
  $effect(() => {
    if (issues.length > 0 && !stableSortOrder) {
      const sorted = computeStableSort(issues, readMap);
      stableSortOrder = sorted.map(i => i.id);
    }
  });

  // Apply stable sort to filtered results — order stays fixed during session
  let sortedIssues = $derived.by(() => {
    const base = filteredIssues;
    if (!stableSortOrder) return base;
    const orderMap = new Map(stableSortOrder.map((id, idx) => [id, idx]));
    return [...base].sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));
  });

  function checkViewport() {
    const w = window.innerWidth;
    if (w < 768) viewMode = 'mobile';
    else if (w < 1024) viewMode = 'tablet';
    else viewMode = 'desktop';
  }

  onMount(() => {
    checkViewport();
    window.addEventListener('resize', checkViewport);

    const tier = getAnimationTier();
    document.documentElement.classList.add('anim-tier-' + tier);

    // If feedData was not passed as SSR prop (issue pages), fetch lazily
    if (issues.length === 0) {
      loadFeedIssues().then(data => {
        issues = data;
        // Restore position/selection from feed data
        if (initialIssueId) {
          const found = data.find(i => i.id === initialIssueId);
          if (found) activeIssue = found;
        }
      });
    }

    // If deep link, fetch full issue data for reader
    if (initialIssueId && activeIssue) {
      loadAndOpenIssue(activeIssue.id);
    }

    // If position restore (returning user within 24h), auto-open the reader
    if (!initialIssueId && restoredPosition && restoredPosition.cardIndex > 0 && activeIssue) {
      loadAndOpenIssue(activeIssue.id);
    }

    // Back-button support: close reader on popstate
    function onPopState(e: PopStateEvent) {
      if (activeIssue && !e.state?.reader) {
        readerHistoryPushed = false;
        activeIssue = null;
        activeFullIssue = null;
      }
    }
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('resize', checkViewport);
      window.removeEventListener('popstate', onPopState);
    };
  });

  // --- History state for reader back-button support ---
  let readerHistoryPushed = false;

  async function loadAndOpenIssue(id: string) {
    const full = await loadFullIssue(id);
    if (full) {
      activeFullIssue = full;
    }
    if (!readerHistoryPushed) {
      history.pushState({ reader: true }, '');
      readerHistoryPushed = true;
    }
  }

  // Origin rect for shared-element transition
  let readerOriginRect: DOMRect | null = $state(null);

  // Preload issue data on pointerdown — starts fetch before tap fires
  function prefetchIssue(issue: FeedIssue) {
    loadFullIssue(issue.id); // fire-and-forget, result is cached
  }

  function openIssue(issue: FeedIssue, originRect?: DOMRect) {
    activeIssue = issue;
    readerOriginRect = originRect ?? null;
    restoredCardIndex = 0; // Clear resume position — only used once on return
    loadAndOpenIssue(issue.id);
  }

  function closeReader() {
    if (readerHistoryPushed) {
      readerHistoryPushed = false;
      history.back();
    } else {
      activeIssue = null;
      activeFullIssue = null;
    }
  }

  function openNextIssue() {
    if (!activeIssue) return;
    const idx = issues.findIndex(i => i.id === activeIssue!.id);
    if (idx >= 0 && idx < issues.length - 1) {
      const next = issues[idx + 1];
      activeIssue = next;
      loadAndOpenIssue(next.id);
    }
  }

  let isLastIssue = $derived.by(() => {
    if (!activeIssue) return true;
    const idx = issues.findIndex(i => i.id === activeIssue!.id);
    return idx >= issues.length - 1;
  });

  let nextHeadline = $derived.by(() => {
    if (!activeIssue) return '';
    const idx = issues.findIndex(i => i.id === activeIssue!.id);
    return idx >= 0 && idx < issues.length - 1 ? issues[idx + 1].headline : '';
  });

  // Keyboard nav for desktop feed
  onMount(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !searchActive)) {
        if (viewMode !== 'mobile') {
          e.preventDefault();
          onSearchFocus();
          const input = document.querySelector('[data-search-input]') as HTMLInputElement;
          input?.focus();
          return;
        }
      }
      if (viewMode !== 'desktop') return;
      if (e.key === 'Escape' && searchActive) { onSearchClear(); return; }
      if (e.key === 'Escape' && activeIssue) { closeReader(); return; }
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (!activeIssue && issues.length) { openIssue(issues[0]); return; }
        const idx = issues.findIndex(i => i.id === activeIssue!.id);
        if (idx < issues.length - 1) openIssue(issues[idx + 1]);
      }
      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!activeIssue) return;
        const idx = issues.findIndex(i => i.id === activeIssue!.id);
        if (idx > 0) openIssue(issues[idx - 1]);
      }
      if (e.key === 'Enter') {
        if (!activeIssue && issues.length) { openIssue(issues[0]); return; }
        if (activeIssue) openIssue(activeIssue);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });
</script>

{#if viewMode === 'mobile'}
  <main style="height:100dvh;display:flex;flex-direction:column;overflow:hidden;">
    <Header
      issueIds={issues.map(i => i.id)}
      onSearchToggle={() => { searchActive = true; loadSearchIndex(); }}
      searchMode={searchActive}
      {searchQuery}
      onSearchInput={(q) => { searchQuery = q; }}
      onSearchClear={onSearchClear}
    />
    <MobileBrowser issues={sortedIssues} onOpenIssue={openIssue} onPrefetch={prefetchIssue} {initialFeedIndex} />
  </main>

  {#if activeFullIssue}
    <InsightReader issue={activeFullIssue} onClose={closeReader} onNext={isLastIssue ? undefined : openNextIssue} initialCardIndex={restoredCardIndex} originRect={readerOriginRect ?? undefined} />
  {/if}

{:else if viewMode === 'tablet'}
  <main style="min-height:100vh;">
    <Header issueIds={issues.map(i => i.id)} />
    <div style="max-width:960px;margin:0 auto;padding:0 18px 40px;">
      <div style="margin-bottom:16px;">
        <input
          data-search-input
          type="text"
          placeholder="Search issues..."
          value={searchQuery}
          oninput={(e) => { searchQuery = (e.currentTarget as HTMLInputElement).value; }}
          onfocus={onSearchFocus}
          style="width:100%;padding:10px 16px;font-size:14px;border:1px solid var(--border-subtle);border-radius:12px;background:var(--bg-sunken);color:var(--text-primary);outline:none;"
        />
      </div>
      <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:16px;">
        {#each sortedIssues as issue, i}
          <DesktopCard {issue} index={i} readState={getState(issue.id)} onOpen={() => openIssue(issue)} onPrefetch={() => prefetchIssue(issue)} />
        {/each}
      </div>
    </div>
  </main>

  {#if activeFullIssue}
    <InsightReader issue={activeFullIssue} onClose={closeReader} onNext={isLastIssue ? undefined : openNextIssue} initialCardIndex={restoredCardIndex} originRect={readerOriginRect ?? undefined} />
  {/if}

{:else}
  <main style="height:100vh;display:flex;flex-direction:column;overflow:hidden;">
    <div style="flex-shrink:0;border-bottom:1px solid var(--bg-sunken);">
      <Header issueIds={issues.map(i => i.id)} />
    </div>

    <div style="flex:1;display:flex;overflow:hidden;">
      <DesktopFeed
        issues={sortedIssues}
        activeId={activeIssue?.id ?? null}
        {readMap}
        onSelectIssue={openIssue}
        {searchQuery}
        onSearchInput={(q) => { searchQuery = q; }}
        {onSearchFocus}
        {onSearchClear}
      />

      {#if activeFullIssue}
        <DesktopReader
          issue={activeFullIssue}
          onNext={isLastIssue ? undefined : openNextIssue}
          {nextHeadline}
        />
      {:else}
        <DesktopEmptyState issueCount={issues.length} />
      {/if}
    </div>
  </main>
{/if}
