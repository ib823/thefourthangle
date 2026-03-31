<script lang="ts">
  import { onMount } from 'svelte';
  import type { Issue } from '../data/issues';
  import { issueCategory, CARD_TYPES } from '../data/issues';
  import { addNotification } from '../stores/notifications';
  import { loadFeedIssues, loadFullIssue, loadFactGraph, getConnections, getConnectionCount, isFactGraphLoaded } from '../lib/issues-loader';
  import Header from './Header.svelte';
  import DesktopCard from './DesktopCard.svelte';
  import DesktopFeed from './DesktopFeed.svelte';
  import DesktopReader from './DesktopReader.svelte';
  import DesktopEmptyState from './DesktopEmptyState.svelte';
  import MobileBrowser from './MobileBrowser.svelte';
  import InsightReader from './InsightReader.svelte';
  import { readIssues, getSavedPosition, savePosition, clearPosition, getReactions, reactions, computeAffinity, scoreIssue } from '../stores/reader';
  import { loadSearchIndex, search as doSearch, isLoaded as searchReady, isLoading as searchLoading } from '../lib/search';
  import { getAnimationTier } from '../lib/animation';
  import { buildFeedSections, type FeedSection } from '../lib/feed-sections';

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
  let issueLoadError = $state(false);
  let issueLoading = $state(false);
  let isOffline = $state(typeof navigator !== 'undefined' ? !navigator.onLine : false);

  let isSearching = $derived(searchQuery.trim().length >= 2);
  let filteredIssues = $derived.by(() => {
    if (!searchQuery.trim() || !isSearching) return issues;
    const ids = doSearch(searchQuery);
    if (ids.length === 0) return [];
    const idSet = new Set(ids);
    return issues.filter(i => idSet.has(i.id));
  });
  let searchResultCount = $derived(isSearching ? filteredIssues.length : -1);

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

  // Reactions subscription for real-time heart indicators
  let reactionRaw = $state('{}');
  $effect(() => {
    const unsub = reactions.subscribe(v => { reactionRaw = v; });
    return unsub;
  });
  let appReactionMap: Record<string, number[]> = $derived.by(() => {
    try { return JSON.parse(reactionRaw); } catch { return {}; }
  });
  function hasReaction(issueId: string): boolean {
    return (appReactionMap[issueId]?.length ?? 0) > 0;
  }

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

  // Feed sections: computed from sorted issues + read state
  let feedSections = $derived.by(() => {
    if (isSearching) return []; // search bypasses sections
    return buildFeedSections(sortedIssues, readMap);
  });

  // #63: Highest-impact unread issue for empty state hero card
  let topUnreadIssue = $derived.by(() => {
    const unread = sortedIssues.filter(i => !readMap[i.id]);
    if (unread.length === 0) return null;
    return unread.reduce((a, b) => a.opinionShift > b.opinionShift ? a : b);
  });

  // Thread props for active issue
  let activeThreadNextId = $derived.by(() => {
    if (!activeIssue) return null;
    const feed = sortedIssues.find(i => i.id === activeIssue!.id);
    return (feed as any)?.threadNextId ?? null;
  });
  let activeThreadNextHeadline = $derived.by(() => {
    if (!activeThreadNextId) return '';
    return sortedIssues.find(i => i.id === activeThreadNextId)?.headline ?? '';
  });
  let activeThreadName = $derived.by(() => {
    if (!activeIssue) return '';
    const feed = sortedIssues.find(i => i.id === activeIssue!.id);
    return (feed as any)?.threadName ?? '';
  });
  let activeThreadPosition = $derived.by(() => {
    if (!activeIssue) return null;
    const feed = sortedIssues.find(i => i.id === activeIssue!.id);
    return (feed as any)?.threadPosition ?? null;
  });
  let activeThreadTotal = $derived.by(() => {
    if (!activeIssue) return null;
    const feed = sortedIssues.find(i => i.id === activeIssue!.id);
    return (feed as any)?.threadTotal ?? null;
  });

  function checkViewport() {
    const w = window.innerWidth;
    if (w < 768) viewMode = 'mobile';
    else if (w < 1024) viewMode = 'tablet';
    else viewMode = 'desktop';
  }

  // G1: Debounced resize handler
  let resizeTimer: ReturnType<typeof setTimeout>;
  function debouncedResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(checkViewport, 150);
  }

  onMount(() => {
    checkViewport();
    window.addEventListener('resize', debouncedResize);

    // K2: Offline detection
    const goOffline = () => { isOffline = true; };
    const goOnline = () => { isOffline = false; };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    const tier = getAnimationTier();
    document.documentElement.classList.add('anim-tier-' + tier);

    // If feedData was not passed as SSR prop (issue pages), fetch lazily
    if (issues.length === 0) {
      loadFeedIssues().then(data => {
        issues = data;
        // Deep link: find issue in feed and open reader immediately
        if (initialIssueId) {
          const found = data.find(i => i.id === initialIssueId);
          if (found) {
            activeIssue = found;
            loadAndOpenIssue(found.id);
          }
        }
      });
    }

    // Load fact graph lazily (non-blocking, low priority)
    loadFactGraph().then(() => { graphLoaded = true; });

    // If feedData was SSR-provided (homepage), deep link is already resolved
    if (initialIssueId && activeIssue) {
      loadAndOpenIssue(activeIssue.id);
    }

    // If position restore (returning user within 24h), auto-open the reader
    if (!initialIssueId && restoredPosition && restoredPosition.cardIndex > 0 && activeIssue) {
      loadAndOpenIssue(activeIssue.id);
    }

    // Push notification: inbox sync + heartbeat + clear on focus
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      // Listen for incoming notifications to add to inbox
      navigator.serviceWorker.addEventListener('message', (e: MessageEvent) => {
        if (e.data?.type === 'NOTIFICATION_RECEIVED') {
          addNotification({
            title: e.data.title || '',
            body: e.data.body || '',
            issueId: e.data.issueId || '',
            url: e.data.url || '/',
            timestamp: e.data.timestamp || Date.now(),
          });
        }
      });

      // Wait for SW to be ready before sending messages
      navigator.serviceWorker.ready.then((reg) => {
        const sw = reg.active;
        if (!sw) return;

        // Heartbeat
        try {
          const endpoint = localStorage.getItem('tfa-push-endpoint');
          if (endpoint) sw.postMessage({ type: 'HEARTBEAT', endpoint });
        } catch {}

        // Clear notifications on app open
        sw.postMessage({ type: 'APP_VISIBLE' });
      });

      // Clear on tab refocus (with cleanup reference)
      const visHandler = () => {
        if (document.visibilityState === 'visible') {
          navigator.serviceWorker.ready.then((reg) => {
            reg.active?.postMessage({ type: 'APP_VISIBLE' });
          });
        }
      };
      document.addEventListener('visibilitychange', visHandler);
    }

    // Back-button support: close reader on popstate
    function onPopState(e: PopStateEvent) {
      if (activeIssue && !e.state?.reader) {
        readerHistoryPushed = false;
        activeIssue = null;
        activeFullIssue = null;
        // Restore base URL when reader closes via back button
        history.replaceState(null, '', '/');
      }
    }
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('resize', debouncedResize);
      window.removeEventListener('popstate', onPopState);
    };
  });

  // --- History state for reader back-button support ---
  let readerHistoryPushed = false;

  async function loadAndOpenIssue(id: string) {
    issueLoading = true;
    issueLoadError = false;
    try {
      const full = await loadFullIssue(id);
      if (full) {
        activeFullIssue = full;
        issueLoadError = false;
      } else {
        issueLoadError = true;
      }
    } catch {
      issueLoadError = true;
    }
    issueLoading = false;
    // Sync URL to reflect the active issue
    const issuePath = `/issue/${id}`;
    if (!readerHistoryPushed) {
      history.pushState({ reader: true, issueId: id }, '', issuePath);
      readerHistoryPushed = true;
    } else {
      history.replaceState({ reader: true, issueId: id }, '', issuePath);
    }
  }

  // Origin rect for shared-element transition
  let readerOriginRect: DOMRect | null = $state(null);

  // Fact graph loaded flag — triggers re-render of connection dots on feed cards
  let graphLoaded = $state(false);

  function issueHasConnections(id: string): boolean {
    if (!graphLoaded) return false;
    return getConnectionCount(id) >= 2;
  }

  // Connections for the active issue — derived from fact graph
  let activeConnections = $derived.by(() => {
    if (!activeIssue) return [];
    return getConnections(activeIssue.id);
  });

  // Resolve connection data: enrich with headlines, read state, reactions from feed
  let resolvedConnections = $derived.by(() => {
    return activeConnections.map(c => {
      const feedIssue = issues.find(i => i.id === c.id);
      const readRaw = readMap[c.id];
      let readState: string | null = null;
      if (readRaw === 'true') readState = 'completed';
      else if (readRaw) {
        try { readState = JSON.parse(readRaw).state ?? null; } catch {}
      }
      return {
        ...c,
        headline: feedIssue?.headline ?? '',
        opinionShift: feedIssue?.opinionShift ?? 0,
        readState,
        hasReaction: hasReaction(c.id),
      };
    }).filter(c => c.headline);
  });

  // Navigate to a connected issue from within a reader
  function navigateToIssue(issueId: string) {
    const target = issues.find(i => i.id === issueId);
    if (target) {
      activeIssue = null;
      activeFullIssue = null;
      readerOriginRect = null;
      // Small delay for reader to close, then open new issue
      requestAnimationFrame(() => openIssue(target));
    }
  }

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

    // Listen for notification clicks to open specific issues
    function onNotifOpen(e: Event) {
      const id = (e as CustomEvent).detail?.issueId;
      if (id) loadAndOpenIssue(id);
    }
    window.addEventListener('t4a-open-issue', onNotifOpen);

    // Listen for SW navigate messages (notification click when app already open)
    function onSwMessage(e: MessageEvent) {
      if (e.data?.type === 'NAVIGATE_TO' && e.data.url) {
        const match = e.data.url.match(/\/issue\/(\w+)/);
        if (match) loadAndOpenIssue(match[1]);
      }
    }
    navigator.serviceWorker?.addEventListener('message', onSwMessage);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('t4a-open-issue', onNotifOpen);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      navigator.serviceWorker?.removeEventListener('message', onSwMessage);
    };
  });
</script>

{#if isOffline}
  <div style="background:var(--score-warning);color:#fff;text-align:center;padding:6px;font-family:var(--font-body);font-size:12px;font-weight:600;position:fixed;top:0;left:0;right:0;z-index:9999;">You're offline — reading cached content</div>
{/if}

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
    <MobileBrowser issues={sortedIssues} sections={feedSections} onOpenIssue={openIssue} onPrefetch={prefetchIssue} {initialFeedIndex} {issueHasConnections} searchQuery={isSearching ? searchQuery : ''} />
  </main>

  {#if activeFullIssue}
    <InsightReader issue={activeFullIssue} onClose={closeReader} onNext={isLastIssue ? undefined : openNextIssue} onNavigateToIssue={navigateToIssue} initialCardIndex={restoredCardIndex} originRect={readerOriginRect ?? undefined} connections={resolvedConnections} threadNextId={activeThreadNextId} threadNextHeadline={activeThreadNextHeadline} threadName={activeThreadName} threadPosition={activeThreadPosition} threadTotal={activeThreadTotal} nextIssueHeadline={nextHeadline} />
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
      {#if isSearching}
        <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:12px;">
          {searchResultCount} result{searchResultCount !== 1 ? 's' : ''}{searchQuery.trim() ? ` for "${searchQuery.trim()}"` : ''}
        </div>
      {/if}
      <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:16px;">
        {#each sortedIssues as issue, i}
          <DesktopCard {issue} index={i} readState={getState(issue.id)} onOpen={() => openIssue(issue)} onPrefetch={() => prefetchIssue(issue)} hasReaction={hasReaction(issue.id)} hasConnections={issueHasConnections(issue.id)} />
        {/each}
      </div>
      {#if isSearching && searchResultCount === 0}
        <div style="text-align:center;padding:40px 20px;color:var(--text-muted);font-size:14px;">No issues match "{searchQuery.trim()}"</div>
      {/if}
    </div>
  </main>

  {#if activeFullIssue}
    <InsightReader issue={activeFullIssue} onClose={closeReader} onNext={isLastIssue ? undefined : openNextIssue} onNavigateToIssue={navigateToIssue} initialCardIndex={restoredCardIndex} originRect={readerOriginRect ?? undefined} connections={resolvedConnections} threadNextId={activeThreadNextId} threadNextHeadline={activeThreadNextHeadline} threadName={activeThreadName} threadPosition={activeThreadPosition} threadTotal={activeThreadTotal} nextIssueHeadline={nextHeadline} />
  {/if}

{:else}
  <main style="height:100vh;display:flex;flex-direction:column;overflow:hidden;">
    <div style="flex-shrink:0;border-bottom:1px solid var(--bg-sunken);">
      <Header issueIds={issues.map(i => i.id)} />
    </div>

    <div style="flex:1;display:flex;overflow:hidden;">
      <DesktopFeed
        issues={sortedIssues}
        sections={feedSections}
        activeId={activeIssue?.id ?? null}
        {readMap}
        onSelectIssue={openIssue}
        {searchQuery}
        onSearchInput={(q) => { searchQuery = q; }}
        {onSearchFocus}
        {onSearchClear}
        {issueHasConnections}
      />

      {#if issueLoadError}
        <!-- I1: Error state -->
        <div style="flex:1;display:flex;align-items:center;justify-content:center;">
          <div style="text-align:center;max-width:300px;">
            <p style="font-family:var(--font-display);font-size:15px;font-weight:600;color:var(--text-primary);margin:0 0 8px;">Couldn't load this issue</p>
            <p style="font-family:var(--font-body);font-size:13px;color:var(--text-muted);margin:0 0 16px;">Check your connection and try again.</p>
            <button onclick={() => { if (activeIssue) loadAndOpenIssue(activeIssue.id); }} style="padding:8px 20px;background:var(--text-primary);color:var(--bg);border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;min-height:44px;">Retry</button>
          </div>
        </div>
      {:else if issueLoading}
        <!-- I2: Skeleton loader -->
        <div style="flex:1;padding:40px 24px;max-width:640px;margin:0 auto;">
          <div style="height:28px;width:70%;background:var(--bg-sunken);border-radius:6px;margin-bottom:16px;animation:shimmer 1.5s infinite;"></div>
          <div style="height:16px;width:100%;background:var(--bg-sunken);border-radius:4px;margin-bottom:8px;animation:shimmer 1.5s infinite;"></div>
          <div style="height:16px;width:85%;background:var(--bg-sunken);border-radius:4px;margin-bottom:24px;animation:shimmer 1.5s infinite;"></div>
          <div style="height:6px;width:100%;background:var(--bg-sunken);border-radius:3px;margin-bottom:32px;animation:shimmer 1.5s infinite;"></div>
          <div style="height:20px;width:50%;background:var(--bg-sunken);border-radius:4px;margin-bottom:12px;animation:shimmer 1.5s infinite;"></div>
          <div style="height:14px;width:90%;background:var(--bg-sunken);border-radius:4px;margin-bottom:8px;animation:shimmer 1.5s infinite;"></div>
          <div style="height:14px;width:75%;background:var(--bg-sunken);border-radius:4px;animation:shimmer 1.5s infinite;"></div>
        </div>
      {:else if activeFullIssue}
        <DesktopReader
          issue={activeFullIssue}
          onNext={isLastIssue ? undefined : openNextIssue}
          {nextHeadline}
          connections={resolvedConnections}
          onNavigateToIssue={navigateToIssue}
          threadNextId={activeThreadNextId}
          threadNextHeadline={activeThreadNextHeadline}
          threadName={activeThreadName}
          threadPosition={activeThreadPosition}
          threadTotal={activeThreadTotal}
        />
      {:else}
        <DesktopEmptyState issueCount={issues.length} topIssue={topUnreadIssue} onOpenIssue={openIssue} />
      {/if}
    </div>
  </main>
{/if}
