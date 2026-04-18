<script lang="ts">
  import { onMount } from 'svelte';
  import type { Issue } from '../data/issue-types';
  import { issueCategory, CARD_TYPES } from '../data/issue-types';
  import { addNotification } from '../stores/notifications';
  import { loadFeedIssues, loadFullIssue, loadFactGraph, getConnections, getConnectionCount, isFactGraphLoaded } from '../lib/issues-loader';
  import Header from './Header.svelte';
  import DesktopCard from './DesktopCard.svelte';
  import DesktopFeed from './DesktopFeed.svelte';
  import DesktopReader from './DesktopReader.svelte';
  import HighlightsPanel from './HighlightsPanel.svelte';
  import LibraryTabs from './LibraryTabs.svelte';
  import MobileDock from './MobileDock.svelte';
  import SurfaceNav from './SurfaceNav.svelte';
  import TodayView from './TodayView.svelte';
  import MobileBrowser from './MobileBrowser.svelte';
  import InsightReader from './InsightReader.svelte';
  import { countHighlights, readIssues, getSavedPosition, savePosition, clearPosition, getReactions, reactions, computeAffinity, scoreIssue } from '../stores/reader';
  import { loadSearchIndex, search as doSearch, isLoaded as searchReady, isLoading as searchLoading } from '../lib/search';
  import { getAnimationTier } from '../lib/animation';
  import { buildFeedSections, type FeedSection, type SortMode, type SectionKind } from '../lib/feed-sections';
  import { BUILD_ID, getSiteOrigin } from '../lib/build';
  import { startAutoSync, checkUrlSync, linkAngleCode, schedulePush, isLinked as isSyncLinked, onSyncChange } from '../lib/sync';
  import { initInstallState, canInstall as canInstallCheck, isIOS as isIOSCheck, triggerInstall, dismissInstall, onInstallChange } from '../lib/install-state';
  import AngleCode from './AngleCode.svelte';

  interface FeedIssue {
    id: string;
    opinionShift: number;
    sourceDate?: string;
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

  type SurfaceMode = 'today' | 'library';
  type LibraryMode = 'reading' | 'highlights' | 'archive';
  type HistoryMode = 'push' | 'replace' | 'none';

  function normalizeLibraryMode(mode: string | null | undefined): LibraryMode {
    if (mode === 'archive' || mode === 'explore') return 'archive';
    return mode === 'highlights' || mode === 'saved' ? 'highlights' : 'reading';
  }

  function locationAppState(): { surfaceMode: SurfaceMode; libraryMode: LibraryMode } {
    if (typeof window === 'undefined') return { surfaceMode: 'today', libraryMode: 'reading' };
    const params = new URL(window.location.href).searchParams;
    const view = params.get('view');
    const libraryMode = normalizeLibraryMode(params.get('tab'));
    if (view === 'library') return { surfaceMode: 'library', libraryMode };
    if (view === 'saved') return { surfaceMode: 'library', libraryMode: 'highlights' };
    if (view === 'marked') return { surfaceMode: 'library', libraryMode: 'highlights' };
    return { surfaceMode: 'today', libraryMode };
  }

  function initialSurfaceMode(): SurfaceMode {
    return locationAppState().surfaceMode;
  }

  function initialLibraryMode(): LibraryMode {
    return locationAppState().libraryMode;
  }

  function libraryLabel(mode: LibraryMode): string {
    if (mode === 'highlights') return 'Highlights';
    if (mode === 'archive') return 'Archive';
    return 'Reading';
  }

  function surfaceUrl(mode: SurfaceMode, nextLibraryMode: LibraryMode): string {
    if (mode === 'today') return '/';
    return `/?view=library&tab=${nextLibraryMode}`;
  }

  function libraryEmptyTitle(mode: LibraryMode): string {
    if (mode === 'highlights') return 'No highlights yet.';
    if (mode === 'archive') return 'No archive issues available yet.';
    return 'No unfinished issues yet.';
  }

  function libraryEmptyCopy(mode: LibraryMode): string {
    if (mode === 'highlights') return 'Tap Highlight on any card while reading, and every marked angle will stay here as your personal trail.';
    if (mode === 'archive') return 'Every published issue will appear here as the archive grows.';
    return 'Start an issue and it will remain here until you finish the reading path.';
  }

  function pageHeading(mode: SurfaceMode, activeLibraryMode: LibraryMode): string {
    if (mode === 'library') return libraryEmptyTitle(activeLibraryMode);
    return 'See what deserves your full attention.';
  }

  let viewMode = $state<'mobile' | 'tablet' | 'desktop'>('desktop');
  let viewportWidth = $state(typeof window !== 'undefined' ? window.innerWidth : 1440);
  let cinemaPeek = $state(false);
  // Cinema Mode dismissal persists for the entire tab session via sessionStorage:
  // first issue per session gets the wow moment, dismissing keeps the sidebar
  // visible for every subsequent issue until the tab closes.
  let cinemaDismissed = $state(
    typeof sessionStorage !== 'undefined' && sessionStorage.getItem('tfa-cinema-dismissed') === '1'
  );

  function dismissCinema() {
    cinemaDismissed = true;
    cinemaPeek = false;
    if (typeof sessionStorage !== 'undefined') {
      try { sessionStorage.setItem('tfa-cinema-dismissed', '1'); } catch {}
    }
  }
  let allowBrowserPullRefresh = $state(false);
  let searchQuery = $state('');
  let searchActive = $state(false);
  let surfaceMode = $state<SurfaceMode>(initialSurfaceMode());
  let libraryMode = $state<LibraryMode>(initialLibraryMode());

  // Feed data comes from Astro props (SSR-available) or from async fetch
  let issues = $state<FeedIssue[]>(feedData);

  // Full issue for the reader (has card text)
  let activeFullIssue = $state<Issue | null>(null);
  let issueLoadError = $state(false);
  let issueLoading = $state(false);
  let isOffline = $state(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  let feedSort: SortMode = $state('latest');
  let archiveFilter = $state<'all' | SectionKind>('all');
  let angleCodeOpen = $state(false);
  let syncLinked = $state(isSyncLinked());
  let showInstall = $state(false);
  let installIsIOS = $state(false);
  let syncBannerDismissed = $state(typeof localStorage !== 'undefined' && localStorage.getItem('tfa-sync-banner-dismissed') === '1');
  let showSyncBanner = $derived(!syncBannerDismissed && surfaceMode === 'library');
  function dismissSyncBanner() { localStorage.setItem('tfa-sync-banner-dismissed', '1'); syncBannerDismissed = true; }

  // Keep syncLinked and install state reactive
  $effect(() => {
    const unsubSync = onSyncChange(() => { syncLinked = isSyncLinked(); });
    const unsubInstall = onInstallChange(() => { showInstall = canInstallCheck(); installIsIOS = isIOSCheck(); });
    return () => { unsubSync(); unsubInstall(); };
  });

  let isSearching = $derived(searchQuery.trim().length >= 2);

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
    const unsub = readIssues.subscribe(v => {
      readMap = { ...v };
      schedulePush(); // Angle Code: sync on reading state change
    });
    return unsub;
  });

  // Reactions subscription for real-time heart indicators
  let reactionRaw = $state('{}');
  $effect(() => {
    const unsub = reactions.subscribe(v => {
      reactionRaw = v;
      schedulePush(); // Angle Code: sync on reaction change
    });
    return unsub;
  });
  let appReactionMap: Record<string, number[]> = $derived.by(() => {
    try { return JSON.parse(reactionRaw); } catch { return {}; }
  });
  function hasReaction(issueId: string): boolean {
    return (appReactionMap[issueId]?.length ?? 0) > 0;
  }

  let readingIssueIds = $derived.by(() => {
    return new Set(
      Object.entries(readMap)
        .filter(([, value]) => {
          if (!value || value === 'true') return false;
          try {
            return JSON.parse(value).state === 'started';
          } catch {
            return false;
          }
        })
        .map(([id]) => id)
    );
  });
  let highlightedIssueIds = $derived.by(() => {
    const ids = new Set<string>();
    for (const [id, cards] of Object.entries(appReactionMap)) {
      if ((cards?.length ?? 0) > 0) ids.add(id);
    }
    return ids;
  });
  let highlightCount = $derived(countHighlights(appReactionMap));
  let readingCount = $derived(readingIssueIds.size);
  let libraryCount = $derived.by(() => new Set([...readingIssueIds, ...highlightedIssueIds]).size);
  let scopedIssues = $derived.by(() => {
    if (surfaceMode === 'library') {
      if (libraryMode === 'highlights') return issues.filter(i => highlightedIssueIds.has(i.id));
      if (libraryMode === 'archive') return issues;
      return issues.filter(i => readingIssueIds.has(i.id));
    }
    return issues;
  });
  let filteredIssues = $derived.by(() => {
    const source = scopedIssues;
    if (!searchQuery.trim() || !isSearching) return source;
    const ids = doSearch(searchQuery);
    if (ids.length === 0) return [];
    const idSet = new Set(ids);
    return source.filter(i => idSet.has(i.id));
  });
  let searchResultCount = $derived(isSearching ? filteredIssues.length : -1);
  let searchStatusMessage = $derived.by(() => {
    if (!isSearching) return '';
    const term = searchQuery.trim();
    if (searchResultCount === 0) return `No results for "${term}".`;
    return `${searchResultCount} result${searchResultCount !== 1 ? 's' : ''} for "${term}".`;
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

  // Feed sections: computed from sorted issues + read state
  let feedSections = $derived.by(() => {
    if (isSearching) return []; // search bypasses sections
    return buildFeedSections(sortedIssues, readMap, new Date(), feedSort);
  });

  // Archive grid: filter by sidebar section
  let archiveIssues = $derived.by(() => {
    if (archiveFilter === 'all') return sortedIssues;
    const section = feedSections.find(s => s.kind === archiveFilter);
    if (!section) return sortedIssues;
    const ids = new Set(section.issues.map(i => i.id));
    return sortedIssues.filter(i => ids.has(i.id));
  });

  function archiveSectionLabel(filter: 'all' | SectionKind): string {
    if (filter === 'all') return 'Full archive';
    const section = feedSections.find(s => s.kind === filter);
    return section?.label ?? 'Full archive';
  }

  // #63: Highest-impact unread issue for empty state hero card
  let topUnreadIssue = $derived.by(() => {
    const unread = issues.filter(i => !readMap[i.id]);
    if (unread.length === 0) return null;
    return unread.reduce((winner, issue) => {
      const issueDate = issue.sourceDate ?? '';
      const winnerDate = winner.sourceDate ?? '';
      if (issueDate !== winnerDate) return issueDate > winnerDate ? issue : winner;
      return issue.opinionShift > winner.opinionShift ? issue : winner;
    });
  });

  function syncSurfaceUrl(mode: SurfaceMode, historyMode: Exclude<HistoryMode, 'none'> = 'replace', nextLibraryMode: LibraryMode = libraryMode) {
    if (typeof window === 'undefined') return;
    const target = surfaceUrl(mode, nextLibraryMode);
    const current = window.location.pathname + window.location.search;
    const state = { surface: mode, libraryMode: nextLibraryMode };
    if (historyMode === 'push' && current !== target) {
      history.pushState(state, '', target);
      return;
    }
    history.replaceState(state, '', target);
  }


  function checkViewport() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const compactLandscape = w < 960 && h < 640;

    viewportWidth = w;
    if (w < 768 || compactLandscape) viewMode = 'mobile';
    else viewMode = 'desktop';
  }

  // G1: Debounced resize handler
  let resizeTimer: ReturnType<typeof setTimeout>;
  function debouncedResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(checkViewport, 150);
  }

  function isStandaloneDisplay(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: fullscreen)').matches
      || ('standalone' in window.navigator && window.navigator.standalone === true);
  }

  function syncShellModeClass() {
    const standalone = isStandaloneDisplay();
    document.body.classList.toggle('app-shell-standalone', standalone);
    allowBrowserPullRefresh = !standalone;
  }

  function refreshApp() {
    window.location.reload();
  }

  const goOffline = () => { isOffline = true; };
  const goOnline = () => { isOffline = false; };

  onMount(() => {
    document.body.classList.add('app-shell-root');
    syncShellModeClass();
    initInstallState();
    showInstall = canInstallCheck();
    installIsIOS = isIOSCheck();
    document.body.dataset.buildId = BUILD_ID;
    checkViewport();
    const currentState = locationAppState();
    surfaceMode = currentState.surfaceMode;
    libraryMode = currentState.libraryMode;
    if (!window.location.pathname.startsWith('/issue/')) {
      syncSurfaceUrl(surfaceMode, 'replace', libraryMode);
    }
    window.addEventListener('resize', debouncedResize);

    // Angle Code: check URL param and start auto-sync
    const syncToken = checkUrlSync();
    if (syncToken) {
      linkAngleCode(syncToken);
    }
    startAutoSync();

    // K2: Offline detection
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
            loadAndOpenIssue(found.id, 'replace');
          }
        }
      });
    }

    // Load fact graph lazily (non-blocking, low priority)
    loadFactGraph().then(() => { graphLoaded = true; });

    // If feedData was SSR-provided (homepage), deep link is already resolved
    if (initialIssueId && activeIssue) {
      loadAndOpenIssue(activeIssue.id, 'replace');
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

    // Keep SPA state in sync with browser history
    function onPopState(e: PopStateEvent) {
      const nextState = locationAppState();
      const issueMatch = window.location.pathname.match(/^\/issue\/([^/]+)$/);

      searchActive = false;
      searchQuery = '';

      if (issueMatch) {
        const issueId = issueMatch[1];
        surfaceMode = e.state?.surface === 'library' ? 'library' : nextState.surfaceMode;
        libraryMode = normalizeLibraryMode(e.state?.libraryMode ?? nextState.libraryMode);
        if (issues.some((item) => item.id === issueId)) {
          readerHistoryPushed = true;
          void openIssueById(issueId, 'none');
        }
        return;
      }

      readerHistoryPushed = false;
      activeIssue = null;
      activeFullIssue = null;
      surfaceMode = nextState.surfaceMode;
      libraryMode = nextState.libraryMode;
    }
    window.addEventListener('popstate', onPopState);

    const standaloneMedia = window.matchMedia('(display-mode: standalone)');
    const fullscreenMedia = window.matchMedia('(display-mode: fullscreen)');
    standaloneMedia.addEventListener('change', syncShellModeClass);
    fullscreenMedia.addEventListener('change', syncShellModeClass);

    return () => {
      window.removeEventListener('resize', debouncedResize);
      window.removeEventListener('popstate', onPopState);
      standaloneMedia.removeEventListener('change', syncShellModeClass);
      fullscreenMedia.removeEventListener('change', syncShellModeClass);
    };
  });

  // --- Keep browser tab & meta tags in sync with active issue ---
  const defaultTitle = 'The Fourth Angle — Bite-Sized Malaysian Issues Analysis';
  const defaultDesc = 'Bite-size clarity for smarter thinking and better questions. The strongest check on power is a public that reads.';
  function setMeta(attr: string, value: string, content: string) {
    const el = document.querySelector(`meta[${attr}="${value}"]`);
    if (el) el.setAttribute('content', content);
  }
  function setCanonical(href: string) {
    const el = document.querySelector('link[rel="canonical"]');
    if (el) el.setAttribute('href', href);
  }

  $effect(() => {
    const siteUrl = getSiteOrigin();
    const homeUrl = `${siteUrl}/`;
    if (activeFullIssue) {
      const i = activeFullIssue;
      const title = `${i.headline} — The Fourth Angle`;
      const desc = i.context;
      const url = `${siteUrl}/issue/${i.id}`;
      const image = `${siteUrl}/og/issue-${i.id}.png?v=${encodeURIComponent(BUILD_ID)}`;
      document.title = title;
      setMeta('name', 'description', desc);
      setMeta('property', 'og:title', title);
      setMeta('property', 'og:description', desc);
      setMeta('property', 'og:url', url);
      setMeta('property', 'og:image', image);
      setMeta('property', 'og:image:alt', `${i.headline} — Independent Malaysian issues analysis`);
      setMeta('name', 'twitter:title', title);
      setMeta('name', 'twitter:description', desc);
      setMeta('name', 'twitter:image', image);
      setMeta('name', 'twitter:image:alt', `${i.headline} — Independent Malaysian issues analysis`);
      setCanonical(url);
    } else {
      document.title = defaultTitle;
      setMeta('name', 'description', defaultDesc);
      setMeta('property', 'og:title', defaultTitle);
      setMeta('property', 'og:description', defaultDesc);
      setMeta('property', 'og:url', homeUrl);
      setMeta('property', 'og:image', `${siteUrl}/og-image.png?v=${encodeURIComponent(BUILD_ID)}`);
      setMeta('property', 'og:image:alt', `${defaultTitle} — Independent Malaysian issues analysis`);
      setMeta('name', 'twitter:title', defaultTitle);
      setMeta('name', 'twitter:description', defaultDesc);
      setMeta('name', 'twitter:image', `${siteUrl}/og-image.png?v=${encodeURIComponent(BUILD_ID)}`);
      setMeta('name', 'twitter:image:alt', `${defaultTitle} — Independent Malaysian issues analysis`);
      setCanonical(homeUrl);
    }
  });

  // --- History state for reader back-button support ---
  let readerHistoryPushed = false;

  async function loadAndOpenIssue(id: string, historyMode: HistoryMode = 'push') {
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
    if (historyMode === 'none') {
      return;
    }
    if (historyMode === 'push') {
      history.pushState({ reader: true, issueId: id, surface: surfaceMode, libraryMode }, '', issuePath);
      readerHistoryPushed = true;
    } else {
      history.replaceState({ reader: true, issueId: id, surface: surfaceMode, libraryMode }, '', issuePath);
      readerHistoryPushed = true;
    }
  }

  async function openIssueById(id: string, historyMode: HistoryMode = 'push') {
    const target = issues.find((item) => item.id === id) ?? null;
    if (target) {
      activeIssue = target;
    }
    readerOriginRect = null;
    restoredCardIndex = 0;
    await loadAndOpenIssue(id, historyMode);
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
    cinemaPeek = false;
    loadAndOpenIssue(issue.id, 'push');
  }

  function openIssueAtCard(issue: FeedIssue, cardIndex: number) {
    activeIssue = issue;
    readerOriginRect = null;
    restoredCardIndex = Math.max(0, Math.min(cardIndex, Math.max(issue.cards.length - 1, 0)));
    savePosition(issue.id, restoredCardIndex);
    cinemaPeek = false;
    loadAndOpenIssue(issue.id, 'push');
  }

  function activateSurface(mode: SurfaceMode, historyMode: Exclude<HistoryMode, 'none'> = 'push', nextLibraryMode: LibraryMode = libraryMode) {
    searchQuery = '';
    searchActive = false;
    surfaceMode = mode;
    libraryMode = nextLibraryMode;
    if (activeIssue || activeFullIssue) {
      activeIssue = null;
      activeFullIssue = null;
      readerHistoryPushed = false;
    }
    syncSurfaceUrl(mode, historyMode, nextLibraryMode);
  }

  function goToday() {
    activateSurface('today', 'push');
  }

  function openLibrary(nextMode: LibraryMode = libraryMode, historyMode: Exclude<HistoryMode, 'none'> = 'push') {
    activateSurface('library', historyMode, nextMode);
  }

  function openReadingLibrary() {
    openLibrary('reading');
  }

  function openHighlightsLibrary() {
    openLibrary('highlights');
  }

  function openArchiveLibrary() {
    openLibrary('archive');
  }

  function closeReader(historyMode: Exclude<HistoryMode, 'none'> = 'replace') {
    activeIssue = null;
    activeFullIssue = null;
    readerHistoryPushed = false;
    cinemaPeek = false;
    syncSurfaceUrl(surfaceMode, historyMode, libraryMode);
  }

  function openNextIssue() {
    if (!activeIssue) return;
    const sequence = sortedIssues.length > 0 ? sortedIssues : issues;
    const idx = sequence.findIndex(i => i.id === activeIssue!.id);
    if (idx >= 0 && idx < sequence.length - 1) {
      const next = sequence[idx + 1];
      activeIssue = next;
      loadAndOpenIssue(next.id, 'replace');
    }
  }

  let isLastIssue = $derived.by(() => {
    if (!activeIssue) return true;
    const sequence = sortedIssues.length > 0 ? sortedIssues : issues;
    const idx = sequence.findIndex(i => i.id === activeIssue!.id);
    return idx >= sequence.length - 1;
  });

  let nextHeadline = $derived.by(() => {
    if (!activeIssue) return '';
    const sequence = sortedIssues.length > 0 ? sortedIssues : issues;
    const idx = sequence.findIndex(i => i.id === activeIssue!.id);
    return idx >= 0 && idx < sequence.length - 1 ? sequence[idx + 1].headline : '';
  });

  $effect(() => {
    if (typeof window === 'undefined' || activeIssue || activeFullIssue || window.location.pathname.startsWith('/issue/')) return;
    const target = surfaceUrl(surfaceMode, libraryMode);
    if (window.location.pathname + window.location.search !== target) {
      history.replaceState({ surface: surfaceMode, libraryMode }, '', target);
    } else if (history.state?.surface !== surfaceMode || history.state?.libraryMode !== libraryMode) {
      history.replaceState({ surface: surfaceMode, libraryMode }, '', target);
    }
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
      if (e.key === 'Escape' && searchActive) { onSearchClear(); return; }
      if (viewMode !== 'desktop') return;
      if (e.key === 'Escape' && activeIssue) {
        // First Escape in cinema mode: dismiss focus mode (sidebar returns
        // for the rest of this tab session)
        if (activeFullIssue && viewportWidth >= 1920 && !cinemaDismissed) {
          dismissCinema();
          return;
        }
        closeReader();
        return;
      }
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
      if (id) {
        void openIssueById(id, 'push');
      }
    }
    window.addEventListener('t4a-open-issue', onNotifOpen);

    // Listen for SW navigate messages (notification click when app already open)
    function onSwMessage(e: MessageEvent) {
      if (e.data?.type === 'NAVIGATE_TO' && e.data.url) {
        const match = e.data.url.match(/\/issue\/(\w+)/);
        if (match) {
          void openIssueById(match[1], 'push');
        }
      }
    }
    navigator.serviceWorker?.addEventListener('message', onSwMessage);

    return () => {
      document.body.classList.remove('app-shell-root');
      document.body.classList.remove('app-shell-standalone');
      delete document.body.dataset.buildId;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('t4a-open-issue', onNotifOpen);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      navigator.serviceWorker?.removeEventListener('message', onSwMessage);
    };
  });
</script>

{#if isOffline}
  <div role="status" aria-live="polite" style="background:var(--score-warning);color:#fff;text-align:center;padding:6px;font-family:var(--font-body);font-size: var(--text-sm);font-weight:600;position:sticky;top:0;left:0;right:0;z-index:9999;flex-shrink:0;">You're offline — reading cached content</div>
{/if}

  {#if viewMode === 'mobile'}
  <div class="app-shell app-shell--mobile">
    <Header
      issues={issues.map(i => ({id: i.id, headline: i.headline}))}
      onHome={goToday}
      homeActive={surfaceMode === 'today' && !activeIssue}
      onSearchToggle={() => { searchActive = true; loadSearchIndex(); }}
      searchMode={searchActive}
      {searchQuery}
      onSearchInput={(q) => { searchQuery = q; }}
      onSearchClear={onSearchClear}
    />
    <main class="app-main">
      {#if !searchActive}
        {#if surfaceMode !== 'today' && !(surfaceMode === 'library' && libraryMode === 'highlights' && sortedIssues.length > 0)}
          <h1 class="sr-only">{pageHeading(surfaceMode, libraryMode)}</h1>
        {/if}
        <div class="mobile-secondary-bar" class:mobile-secondary-bar--library={surfaceMode === 'library'}>
          {#if surfaceMode === 'library'}
            <LibraryTabs
              libraryMode={libraryMode}
              {readingCount}
              {highlightCount}
              archiveCount={issues.length}
              panelId="mobile-library-panel"
              idPrefix="mobile-library"
              onOpenReading={openReadingLibrary}
              onOpenHighlights={openHighlightsLibrary}
              onOpenArchive={openArchiveLibrary}
            />
          {/if}
        </div>
      {/if}
    {#if isSearching}
      <div class="sr-only" role="status" aria-live="polite">{searchStatusMessage}</div>
    {/if}
    {#if surfaceMode === 'today' && !isSearching}
      <div
        id="mobile-today-panel"
        class="mobile-today-panel"
        role="tabpanel"
        aria-labelledby={`mobile-today-sort-${feedSort}`}
        tabindex="0"
      >
        <TodayView issueCount={issues.length} topIssue={topUnreadIssue} issues={sortedIssues} sections={feedSections} {readMap} {readingCount} highlightCount={highlightCount} onOpenIssue={openIssue} onOpenLibraryReading={openReadingLibrary} onOpenLibraryHighlights={openHighlightsLibrary} onOpenLibraryArchive={openArchiveLibrary} allowPullRefresh={allowBrowserPullRefresh} onPullRefresh={refreshApp} />
      </div>
    {:else if !isSearching && surfaceMode === 'library' && libraryMode === 'highlights' && sortedIssues.length > 0}
      <div
        id="mobile-library-panel"
        role="tabpanel"
        aria-labelledby="mobile-library-highlights"
        tabindex="0"
        style="flex:1;min-height:0;display:flex;flex-direction:column;"
      >
        <HighlightsPanel
          issues={sortedIssues}
          reactionMap={appReactionMap}
          onOpenHighlight={openIssueAtCard}
        />
      </div>
    {:else if !isSearching && surfaceMode === 'library' && sortedIssues.length === 0}
      <section style="flex:1;display:flex;align-items:center;justify-content:center;padding:24px 18px 32px;background:linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg) 28%);">
        <div style="max-width:320px;text-align:center;">
          <div style="font-size: var(--text-xs);font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-tertiary);">Library · {libraryLabel(libraryMode)}</div>
	          <p style="margin:10px 0 0;font-family:var(--font-display);font-size: var(--text-title-lg);line-height:1.04;letter-spacing:-0.04em;color:var(--text-primary);">{libraryEmptyTitle(libraryMode)}</p>
          <p style="font-size: var(--text-body);line-height:1.6;color:var(--text-secondary);margin:16px 0 0;">{libraryEmptyCopy(libraryMode)}</p>
          <button onclick={goToday} style="margin-top:18px;padding:0 18px;min-height:44px;border-radius: var(--radius-pill);border:1px solid var(--border-divider);background:var(--bg-elevated);color:var(--text-primary);font:inherit;font-size: var(--text-ui);font-weight:700;cursor:pointer;">Return to Today</button>
        </div>
      </section>
    {:else if surfaceMode === 'library' && !isSearching}
      <div
        id="mobile-library-panel"
        role="tabpanel"
        aria-labelledby={`mobile-library-${libraryMode}`}
        tabindex="0"
        style="flex:1;min-height:0;display:flex;flex-direction:column;"
      >
        <MobileBrowser issues={sortedIssues} sections={feedSections} onOpenIssue={openIssue} onPrefetch={prefetchIssue} {initialFeedIndex} {issueHasConnections} searchQuery={isSearching ? searchQuery : ''} sortMode={feedSort} onSortChange={(mode) => { feedSort = mode; }} allowPullRefresh={allowBrowserPullRefresh} onPullRefresh={refreshApp} />
      </div>
    {:else}
      <MobileBrowser issues={sortedIssues} sections={feedSections} onOpenIssue={openIssue} onPrefetch={prefetchIssue} {initialFeedIndex} {issueHasConnections} searchQuery={isSearching ? searchQuery : ''} sortMode={feedSort} onSortChange={(mode) => { feedSort = mode; }} allowPullRefresh={allowBrowserPullRefresh} onPullRefresh={refreshApp} />
    {/if}
    </main>
    {#if !searchActive && !activeFullIssue}
      <MobileDock surfaceMode={surfaceMode} {libraryCount} onGoToday={goToday} onOpenLibrary={() => openLibrary()} {syncLinked} onSyncTap={() => { angleCodeOpen = true; }} {showInstall} {installIsIOS} onInstallTap={triggerInstall} onInstallDismiss={dismissInstall} />
    {/if}
  </div>

  {#if activeFullIssue}
    <InsightReader issue={activeFullIssue} onClose={closeReader} onReturnHome={goToday} onNext={isLastIssue ? undefined : openNextIssue} onNavigateToIssue={navigateToIssue} initialCardIndex={restoredCardIndex} originRect={readerOriginRect ?? undefined} connections={resolvedConnections} nextIssueHeadline={nextHeadline} />
  {/if}

{:else if viewMode === 'tablet'}
  <div class="app-shell app-shell--tablet">
    <Header issues={issues.map(i => ({id: i.id, headline: i.headline}))} onHome={goToday} homeActive={surfaceMode === 'today' && !activeIssue} />
    <main class="app-main app-main--tablet">
    <div class="tablet-shell">
      {#if surfaceMode !== 'today' && !(surfaceMode === 'library' && libraryMode === 'highlights' && sortedIssues.length > 0)}
        <h1 class="sr-only">{pageHeading(surfaceMode, libraryMode)}</h1>
      {/if}
      <div style="margin:12px 0 16px;">
        <form role="search" aria-label="Search issues" onsubmit={(event) => event.preventDefault()}>
          <label class="sr-only" for="tablet-search">Search issues</label>
          <input
            id="tablet-search"
            data-search-input
            type="text"
            placeholder="Search issues..."
            aria-label="Search issues"
            value={searchQuery}
            oninput={(e) => { searchQuery = (e.currentTarget as HTMLInputElement).value; }}
            onfocus={onSearchFocus}
            style="width:100%;min-height:44px;box-sizing:border-box;padding:10px 16px;font-size: var(--text-body);border:1px solid var(--border-subtle);border-radius: var(--radius-lg);background:var(--bg-sunken);color:var(--text-primary);outline:none;"
          />
        </form>
      </div>
      {#if !isSearching}
        <div style="margin-bottom:14px;">
          <SurfaceNav surfaceMode={surfaceMode} {libraryCount} onGoToday={goToday} onOpenLibrary={() => openLibrary()} />
        </div>
      {/if}
      {#if isSearching}
        <div role="status" aria-live="polite" style="font-size: var(--text-sm);color:var(--text-tertiary);margin-bottom:12px;">
          {searchResultCount} result{searchResultCount !== 1 ? 's' : ''}{searchQuery.trim() ? ` for "${searchQuery.trim()}"` : ''}
        </div>
      {:else if surfaceMode === 'library'}
        <div style="margin-bottom:12px;">
          <LibraryTabs
            libraryMode={libraryMode}
            {readingCount}
            {highlightCount}
            archiveCount={issues.length}
            panelId="tablet-library-panel"
            idPrefix="tablet-library"
            onOpenReading={() => openLibrary('reading', 'replace')}
            onOpenHighlights={() => openLibrary('highlights', 'replace')}
            onOpenArchive={() => openLibrary('archive', 'replace')}
          />
        </div>
      {/if}
      {#if surfaceMode === 'today' && !isSearching}
        <div id="tablet-today-panel" role="tabpanel" aria-labelledby={`tablet-today-sort-${feedSort}`} tabindex="0">
          <TodayView issueCount={issues.length} topIssue={topUnreadIssue} issues={sortedIssues} sections={feedSections} {readMap} {readingCount} highlightCount={highlightCount} onOpenIssue={openIssue} onOpenLibraryReading={openReadingLibrary} onOpenLibraryHighlights={openHighlightsLibrary} onOpenLibraryArchive={openArchiveLibrary} allowPullRefresh={allowBrowserPullRefresh} onPullRefresh={refreshApp} />
        </div>
      {:else if !isSearching && surfaceMode === 'library' && libraryMode === 'highlights' && sortedIssues.length > 0}
        <div id="tablet-library-panel" role="tabpanel" aria-labelledby="tablet-library-highlights" tabindex="0">
          <HighlightsPanel
            issues={sortedIssues}
            reactionMap={appReactionMap}
            onOpenHighlight={openIssueAtCard}
          />
        </div>
      {:else if !isSearching && surfaceMode === 'library' && sortedIssues.length === 0}
        <section style="display:flex;align-items:center;justify-content:center;min-height:360px;padding:28px 20px;background:linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg) 24%);border-radius: var(--radius-xl);">
          <div style="max-width:420px;text-align:center;">
            <div style="font-size: var(--text-xs);font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-tertiary);">Library · {libraryLabel(libraryMode)}</div>
            <p style="margin:12px 0 0;font-family:var(--font-display);font-size: var(--text-title-lg);line-height:1.04;letter-spacing:-0.04em;color:var(--text-primary);">{libraryEmptyTitle(libraryMode)}</p>
            <p style="font-size: var(--text-body);line-height:1.65;color:var(--text-secondary);margin:16px 0 0;">{libraryEmptyCopy(libraryMode)}</p>
            <button onclick={goToday} style="margin-top:18px;padding:0 18px;min-height:44px;border-radius: var(--radius-pill);border:1px solid var(--border-divider);background:var(--bg-elevated);color:var(--text-primary);font:inherit;font-size: var(--text-ui);font-weight:700;cursor:pointer;">Return to Today</button>
          </div>
        </section>
      {:else if isSearching}
        <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:16px;">
          {#each sortedIssues as issue, i}
            <DesktopCard {issue} index={i} readState={getState(issue.id)} onOpen={() => openIssue(issue)} onPrefetch={() => prefetchIssue(issue)} hasReaction={hasReaction(issue.id)} hasConnections={issueHasConnections(issue.id)} />
          {/each}
        </div>
      {:else if surfaceMode === 'library'}
        <div id="tablet-library-panel" role="tabpanel" aria-labelledby={`tablet-library-${libraryMode}`} tabindex="0">
          {#if libraryMode !== 'highlights'}
            <div style="display:flex;align-items:center;justify-content:flex-end;padding:0 0 12px;">
              <button onclick={() => { feedSort = feedSort === 'latest' ? 'shift' : 'latest'; }} style="display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border:1px solid var(--border-subtle);border-radius:var(--radius-pill);background:var(--bg-elevated);color:var(--text-secondary);font:inherit;font-size:var(--text-xs);font-weight:700;cursor:pointer;transition:color 180ms ease,border-color 180ms ease;" aria-label="Sort issues: currently {feedSort === 'latest' ? 'Latest' : 'Biggest Shift'}">
                {feedSort === 'latest' ? 'Latest' : 'Biggest Shift'}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            </div>
          {/if}
          {#each feedSections as section}
            <div style="margin-bottom:32px;" data-section={section.kind}>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
                <span style="font-size: var(--text-xs);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:{section.kind === 'continue' ? 'var(--score-warning)' : section.kind === 'new' ? 'var(--status-green)' : section.kind === 'completed' ? 'var(--text-muted)' : 'var(--text-tertiary)'};">{section.label}</span>
                <span style="font-size: var(--text-micro);color:var(--text-faint);" data-section-count>{section.count}</span>
              </div>
              {#if section.count === 0}
                <p style="font-size:var(--text-sm);color:var(--text-muted);margin:0;padding:12px 0;font-style:italic;">Nothing here yet.</p>
              {:else}
                <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:16px;">
                  {#each section.issues as issue, i}
                    <DesktopCard {issue} index={i} readState={getState(issue.id)} onOpen={() => openIssue(issue)} onPrefetch={() => prefetchIssue(issue)} hasReaction={hasReaction(issue.id)} hasConnections={issueHasConnections(issue.id)} />
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:16px;">
          {#each sortedIssues as issue, i}
            <DesktopCard {issue} index={i} readState={getState(issue.id)} onOpen={() => openIssue(issue)} onPrefetch={() => prefetchIssue(issue)} hasReaction={hasReaction(issue.id)} hasConnections={issueHasConnections(issue.id)} />
          {/each}
        </div>
      {/if}
      {#if isSearching && searchResultCount === 0}
        <div style="text-align:center;padding:40px 20px;color:var(--text-muted);font-size: var(--text-body);">No issues match "{searchQuery.trim()}"</div>
      {/if}
    </div>
    </main>
  </div>

  {#if activeFullIssue}
    <InsightReader issue={activeFullIssue} onClose={closeReader} onReturnHome={goToday} onNext={isLastIssue ? undefined : openNextIssue} onNavigateToIssue={navigateToIssue} initialCardIndex={restoredCardIndex} originRect={readerOriginRect ?? undefined} connections={resolvedConnections} nextIssueHeadline={nextHeadline} />
  {/if}

{:else}
  {@const cinemaActive = !!activeFullIssue && viewportWidth >= 1920 && !cinemaDismissed}
  {@const cinemaCollapsed = cinemaActive && !cinemaPeek}
  <div class="app-shell app-shell--desktop" class:cinema={cinemaActive} class:cinema-collapsed={cinemaCollapsed}>
    {#if cinemaActive && activeFullIssue}
      <div
        class="cinema-stage"
        aria-hidden="true"
        style="background-image:url(/og/backgrounds/issue-{activeFullIssue.id}-bg.png);"
      ></div>
      <div
        class="cinema-peek-zone"
        aria-hidden="true"
        onmouseenter={() => { cinemaPeek = true; }}
      ></div>
      <button
        type="button"
        class="cinema-exit"
        aria-label="Exit focus mode"
        title="Exit focus mode (Esc) — sidebar stays visible for the rest of this session"
        onclick={dismissCinema}
      >Exit focus</button>
    {/if}
    <div style="flex-shrink:0;border-bottom:1px solid var(--bg-sunken);position:relative;z-index:2;">
      <Header issues={issues.map(i => ({id: i.id, headline: i.headline}))} onHome={goToday} homeActive={surfaceMode === 'today' && !activeIssue} />
    </div>

    <div
      class="app-main app-main--desktop"
      onmouseleave={() => { if (cinemaActive) cinemaPeek = false; }}
    >
      <main class="desktop-main-panel">
        {#if issueLoadError}
          <!-- I1: Error state with offline differentiation -->
          <div style="flex:1;display:flex;align-items:center;justify-content:center;">
            <div style="text-align:center;max-width:300px;">
              <p style="font-family:var(--font-display);font-size: var(--text-body);font-weight:600;color:var(--text-primary);margin:0 0 8px;">{isOffline ? "You're offline" : "Couldn't load this issue"}</p>
              <p style="font-family:var(--font-body);font-size: var(--text-ui);color:var(--text-muted);margin:0 0 16px;">{isOffline ? "This issue hasn't been cached yet. Connect to the internet to read it." : "Something went wrong. Try again."}</p>
              <button onclick={() => { if (activeIssue) loadAndOpenIssue(activeIssue.id); }} style="padding:8px 20px;background:var(--text-primary);color:var(--bg);border:none;border-radius: var(--radius-md);font-size: var(--text-ui);font-weight:600;cursor:pointer;min-height:44px;">Retry</button>
            </div>
          </div>
        {:else if issueLoading}
          <!-- I2: Skeleton loader -->
          <div style="flex:1;padding:40px 24px;max-width:640px;margin:0 auto;">
            <div style="height:28px;width:70%;background:var(--bg-sunken);border-radius: var(--radius-sm);margin-bottom:16px;animation:shimmer 1.5s infinite;"></div>
            <div style="height:16px;width:100%;background:var(--bg-sunken);border-radius: var(--radius-sm);margin-bottom:8px;animation:shimmer 1.5s infinite;"></div>
            <div style="height:16px;width:85%;background:var(--bg-sunken);border-radius: var(--radius-sm);margin-bottom:24px;animation:shimmer 1.5s infinite;"></div>
            <div style="height:6px;width:100%;background:var(--bg-sunken);border-radius: var(--radius-pill);margin-bottom:32px;animation:shimmer 1.5s infinite;"></div>
            <div style="height:20px;width:50%;background:var(--bg-sunken);border-radius: var(--radius-sm);margin-bottom:12px;animation:shimmer 1.5s infinite;"></div>
            <div style="height:14px;width:90%;background:var(--bg-sunken);border-radius: var(--radius-sm);margin-bottom:8px;animation:shimmer 1.5s infinite;"></div>
            <div style="height:14px;width:75%;background:var(--bg-sunken);border-radius: var(--radius-sm);animation:shimmer 1.5s infinite;"></div>
          </div>
        {:else if activeFullIssue}
          <DesktopReader
            issue={activeFullIssue}
            onReturnHome={goToday}
            onNext={isLastIssue ? undefined : openNextIssue}
            {nextHeadline}
            connections={resolvedConnections}
            onNavigateToIssue={navigateToIssue}
            initialCardIndex={restoredCardIndex}
          />
        {:else if surfaceMode === 'library' && sortedIssues.length === 0}
          <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:32px;background:linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg) 24%);">
            <div style="max-width:420px;text-align:center;">
              <div style="font-size: var(--text-xs);font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-tertiary);">
                Library · {libraryLabel(libraryMode)}
              </div>
              <h1 style="margin:10px 0 0;font-family:var(--font-display);font-size: var(--text-title-lg);line-height:1.15;letter-spacing:-0.04em;color:var(--text-primary);">{libraryEmptyTitle(libraryMode)}</h1>
              <p style="font-size: var(--text-body);line-height:1.6;color:var(--text-secondary);margin:16px 0 0;">
                {libraryEmptyCopy(libraryMode)}
              </p>
            </div>
          </div>
        {:else if surfaceMode === 'library' && libraryMode === 'highlights'}
          <HighlightsPanel
            issues={sortedIssues}
            reactionMap={appReactionMap}
            onOpenHighlight={openIssueAtCard}
          />
        {:else if surfaceMode === 'library' && libraryMode === 'archive'}
          <!-- Archive grid: browsable card grid in main panel -->
          <div style="flex:1;overflow-y:auto;padding:32px 24px;">
            <div style="margin-bottom:24px;">
              <div style="font-size: var(--text-xs);font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-tertiary);">Library · Archive</div>
              <div style="display:flex;align-items:baseline;gap:12px;margin:8px 0 0;">
                <h1 style="margin:0;font-family:var(--font-display);font-size: var(--text-title-lg);line-height:1.15;letter-spacing:-0.02em;color:var(--text-primary);">{archiveSectionLabel(archiveFilter)}</h1>
                {#if archiveFilter !== 'all'}
                  <button onclick={() => { archiveFilter = 'all'; }} style="background:none;border:none;cursor:pointer;font-size:var(--text-sm);color:var(--score-info);font-weight:600;padding:0;">Show all</button>
                {/if}
              </div>
              <p style="font-size: var(--text-body);line-height:1.6;color:var(--text-secondary);margin:8px 0 0;">{archiveIssues.length}{archiveFilter !== 'all' ? ` of ${sortedIssues.length}` : ''} issues{archiveFilter === 'all' ? ' published' : ''}</p>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:20px;">
              {#each archiveIssues as issue, i}
                <DesktopCard {issue} index={i} readState={getState(issue.id)} onOpen={() => openIssue(issue)} onPrefetch={() => prefetchIssue(issue)} hasReaction={hasReaction(issue.id)} hasConnections={issueHasConnections(issue.id)} />
              {/each}
            </div>
          </div>
        {:else if surfaceMode === 'library'}
          <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:32px;background:linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg) 24%);">
            <div style="max-width:420px;text-align:center;">
              <div style="font-size: var(--text-xs);font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-tertiary);">Library · {libraryLabel(libraryMode)}</div>
              <h1 style="margin:12px 0 0;font-family:var(--font-display);font-size: var(--text-title-lg);line-height:1.15;letter-spacing:-0.04em;color:var(--text-primary);">
                {libraryMode === 'highlights'
                  ? 'Choose an issue with saved angles.'
                  : 'Choose the next issue from your library.'}
              </h1>
              <p style="font-size: var(--text-body);line-height:1.6;color:var(--text-secondary);margin:16px 0 0;">
                {libraryMode === 'highlights'
                  ? 'The left rail shows every issue with highlights. Open one to revisit the angles you kept.'
                  : 'The left rail already holds your current reading memory. Pick an issue there to continue.'}
              </p>
            </div>
          </div>
        {:else if isSearching && sortedIssues.length > 0}
          <!-- Search results in main panel -->
          <div style="flex:1;overflow-y:auto;padding:32px 24px;">
            <div style="margin-bottom:24px;">
              <div style="font-size: var(--text-xs);font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-tertiary);">Search results</div>
              <p style="font-size: var(--text-body);color:var(--text-secondary);margin:8px 0 0;">{searchResultCount} result{searchResultCount !== 1 ? 's' : ''} for "{searchQuery.trim()}"</p>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:20px;">
              {#each sortedIssues as issue, i}
                <DesktopCard {issue} index={i} readState={getState(issue.id)} onOpen={() => openIssue(issue)} onPrefetch={() => prefetchIssue(issue)} hasReaction={hasReaction(issue.id)} hasConnections={issueHasConnections(issue.id)} />
              {/each}
            </div>
          </div>
        {:else if isSearching}
          <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:32px;">
            <p style="font-size: var(--text-body);color:var(--text-muted);">No issues match "{searchQuery.trim()}"</p>
          </div>
        {:else}
          <TodayView issueCount={issues.length} topIssue={topUnreadIssue} issues={sortedIssues} sections={feedSections} {readMap} {readingCount} highlightCount={highlightCount} onOpenIssue={openIssue} onOpenLibraryReading={openReadingLibrary} onOpenLibraryHighlights={openHighlightsLibrary} onOpenLibraryArchive={openArchiveLibrary} />
        {/if}
      </main>

      <aside style="display:flex;flex-direction:column;flex-shrink:0;" aria-label="Sidebar">
      <DesktopFeed
        issues={sortedIssues}
        sections={feedSections}
        activeId={activeIssue?.id ?? null}
        {readMap}
        {surfaceMode}
        {libraryMode}
        {readingCount}
        {highlightCount}
        archiveCount={issues.length}
        {libraryCount}
        onGoToday={goToday}
        onOpenLibrary={() => openLibrary()}
        onOpenReading={() => openLibrary('reading', 'replace')}
        onOpenHighlights={openHighlightsLibrary}
        onOpenArchive={() => openLibrary('archive', 'replace')}
        onSelectIssue={(issue) => {
          if (surfaceMode === 'library' && libraryMode === 'highlights') {
            openIssueAtCard(issue, appReactionMap[issue.id]?.[0] ?? 0);
            return;
          }
          openIssue(issue);
        }}
        {searchQuery}
        onSearchInput={(q) => { searchQuery = q; }}
        {onSearchFocus}
        {onSearchClear}
        {issueHasConnections}
        sortMode={feedSort}
        onSortChange={(mode) => { feedSort = mode; }}
        {archiveFilter}
        onArchiveFilter={(kind) => { archiveFilter = kind; }}
        {showSyncBanner}
        onSyncBannerTap={() => { angleCodeOpen = true; }}
        onSyncBannerDismiss={dismissSyncBanner}
      />
      </aside>
    </div>
  </div>
{/if}

<!-- Angle Code panel (bottom sheet on mobile/tablet, overlay on desktop) -->
{#if angleCodeOpen}
  <div
    class="angle-overlay"
    onclick={(e) => { if (e.target === e.currentTarget) angleCodeOpen = false; }}
    role="dialog"
    aria-modal="true"
    aria-label="Angle Code — cross-device sync"
  >
    <div class="angle-sheet">
      <div class="angle-sheet-handle"></div>
      <AngleCode onClose={() => { angleCodeOpen = false; }} />
    </div>
  </div>
{/if}

<style>
  .app-shell {
    min-height: 100vh;
    min-height: 100dvh;
    background: var(--bg);
  }

  .app-shell--mobile,
  .app-shell--desktop {
    height: 100vh;
    height: -webkit-fill-available; /* Safari 15.0–15.3 fallback */
    height: 100dvh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ─────────────────────────────────────────────────────────────────
     Cinema Mode — focused reader at ≥1920px
     The sidebar retreats, the issue's background art tints the flanks
     at very low opacity, the prose stays at readable width.
     Hover the left edge to peek the sidebar; press Esc to exit.
     ───────────────────────────────────────────────────────────────── */
  .app-shell--desktop.cinema {
    position: relative;
  }

  .cinema-stage {
    position: fixed;
    inset: 0;
    z-index: 0;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    filter: blur(96px) saturate(1.45);
    opacity: 0.11;
    pointer-events: none;
    /* Vignette: keep the centre clean (where prose lives), let the
       blurred art tint only the flanks */
    -webkit-mask-image: radial-gradient(ellipse 880px 110% at center, transparent 0%, transparent 24%, rgba(0,0,0,0.85) 72%, black 100%);
    mask-image: radial-gradient(ellipse 880px 110% at center, transparent 0%, transparent 24%, rgba(0,0,0,0.85) 72%, black 100%);
    animation: cinema-stage-in 720ms cubic-bezier(0.32, 0.72, 0, 1) both;
  }

  @keyframes cinema-stage-in {
    from { opacity: 0; filter: blur(120px) saturate(1.45); }
    to   { opacity: 0.11; filter: blur(96px) saturate(1.45); }
  }

  /* Hover-edge sentinel: invisible 18px strip on the left.
     When the cursor enters it, peek the sidebar back. */
  .cinema-peek-zone {
    position: fixed;
    top: 0;
    left: 0;
    width: 18px;
    height: 100vh;
    z-index: 8;
    pointer-events: auto;
  }

  /* Subtle "Exit focus" affordance: small ghost pill, top-right.
     Visible only when not actively reading the centre column. */
  .cinema-exit {
    position: fixed;
    top: 78px;
    right: 24px;
    z-index: 11;
    padding: 7px 14px;
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--text-tertiary);
    background: rgba(255, 255, 255, 0.55);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-pill);
    cursor: pointer;
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    opacity: 0;
    transform: translateY(-4px);
    transition: opacity 320ms ease, transform 320ms cubic-bezier(0.32, 0.72, 0, 1), background 200ms ease;
    animation: cinema-exit-in 720ms 480ms cubic-bezier(0.32, 0.72, 0, 1) forwards;
  }

  @keyframes cinema-exit-in {
    to { opacity: 1; transform: translateY(0); }
  }

  @media (hover: hover) {
    .cinema-exit:hover {
      background: rgba(255, 255, 255, 0.85);
      color: var(--text-primary);
    }
  }

  /* Collapsed sidebar: width animates to 0, content fades */
  .app-shell--desktop.cinema-collapsed :global(aside[aria-label="Sidebar"]) {
    width: 0 !important;
    opacity: 0;
    pointer-events: none;
    overflow: hidden;
    transition:
      width 480ms cubic-bezier(0.32, 0.72, 0, 1),
      opacity 320ms ease;
  }

  /* Peek state: sidebar floats back over the content (does not reflow) */
  .app-shell--desktop.cinema:not(.cinema-collapsed) :global(aside[aria-label="Sidebar"]) {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 7;
    box-shadow: 0 24px 64px rgba(15, 15, 35, 0.22);
    transition:
      transform 420ms cubic-bezier(0.32, 0.72, 0, 1),
      box-shadow 320ms ease;
  }

  /* Sidebar transition baseline (so collapse/peek animate smoothly both ways) */
  .app-shell--desktop.cinema :global(aside[aria-label="Sidebar"]) {
    transition:
      width 480ms cubic-bezier(0.32, 0.72, 0, 1),
      opacity 320ms ease;
    will-change: width, opacity;
  }

  /* Header and main content sit above the cinema-stage */
  .app-shell--desktop.cinema .app-main--desktop {
    position: relative;
    z-index: 1;
  }

  /* Dark mode: the tint is naturally warmer/darker; bump opacity slightly */
  @media (prefers-color-scheme: dark) {
    .cinema-stage {
      opacity: 0.18;
      filter: blur(96px) saturate(1.6) brightness(1.15);
    }
    .cinema-exit {
      background: rgba(28, 28, 32, 0.55);
      color: var(--text-secondary);
    }
    .cinema-exit:hover {
      background: rgba(28, 28, 32, 0.85);
      color: var(--text-primary);
    }
  }

  /* Reduced motion: no animations, instant transitions */
  @media (prefers-reduced-motion: reduce) {
    .cinema-stage,
    .cinema-exit,
    .app-shell--desktop.cinema :global(aside[aria-label="Sidebar"]) {
      animation: none !important;
      transition: none !important;
    }
    .cinema-exit { opacity: 1; transform: none; }
  }

  .app-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .app-main--desktop {
    flex-direction: row;
    max-width: 1400px;
    margin: 0 auto;
    width: 100%;
  }

  @media (min-width: 1600px) {
    .app-main--desktop {
      max-width: 1720px;
    }
  }

  @media (min-width: 1920px) {
    .app-main--desktop {
      max-width: 1920px;
    }
  }

  @media (min-width: 2560px) {
    .app-main--desktop {
      max-width: 2400px;
    }
  }

  @media (min-width: 3440px) {
    .app-main--desktop {
      max-width: 3200px;
    }
  }

  @media (min-width: 3840px) {
    .app-main--desktop {
      max-width: 3600px;
    }
  }

  @media (min-width: 5120px) {
    .app-main--desktop {
      max-width: 4200px;
    }
  }

  @media (min-width: 7680px) {
    .app-main--desktop {
      max-width: 5400px;
    }
  }

  .desktop-main-panel {
    order: 2;
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .app-main--desktop :global(aside[aria-label]) {
    order: 1;
  }

  .app-shell--tablet {
    height: 100vh;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .app-main--tablet {
    display: block;
    overflow-y: auto;
  }


  .tablet-shell {
    max-width: 960px;
    margin: 0 auto;
    padding: 0 20px 40px;
  }

  /* Compact sidebar for 768-1023px (tablet portrait) */
  @media (min-width: 768px) and (max-width: 1023px) {
    .app-main--desktop :global(aside[aria-label]) {
      width: 240px !important;
    }

    /* Hide excerpts in compact sidebar */
    .app-main--desktop :global(.feed-row p) {
      display: none;
    }

    /* Tighten feed row padding in compact sidebar */
    .app-main--desktop :global(.feed-row) {
      padding: 8px 12px;
    }
  }

  /* Mid-range sidebar for 1024-1280px */
  @media (min-width: 1024px) and (max-width: 1280px) {
    .app-main--desktop :global(aside[aria-label]) {
      width: 280px !important;
    }
  }

  .mobile-secondary-bar {
    flex-shrink: 0;
    padding: 4px 16px 6px;
    border-bottom: 1px solid var(--border-subtle);
    background:
      linear-gradient(180deg, rgba(248, 249, 250, 0.82) 0%, rgba(248, 249, 250, 0.54) 100%);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .mobile-secondary-bar--library {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }

  .mobile-today-panel {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  @media (prefers-color-scheme: dark) {
    .mobile-secondary-bar {
      border-bottom-color: rgba(255, 255, 255, 0.08);
      background:
        linear-gradient(180deg, rgba(22, 20, 18, 0.94) 0%, rgba(22, 20, 18, 0.78) 100%);
    }
  }

  /* Angle Code overlay */
  .angle-overlay {
    position: fixed;
    inset: 0;
    z-index: 9000;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    animation: fadeIn 0.15s ease;
  }

  .angle-sheet {
    width: 100%;
    max-width: 420px;
    background: var(--bg-elevated);
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.16);
    animation: slideUp 0.25s cubic-bezier(0.33, 1, 0.68, 1);
    max-height: 85vh;
    overflow-y: auto;
  }

  .angle-sheet-handle {
    width: 36px;
    height: 4px;
    background: var(--border-divider);
    border-radius: 2px;
    margin: 10px auto 0;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  /* Desktop: center the sheet instead of bottom-anchoring */
  @media (min-width: 769px) {
    .angle-overlay {
      align-items: center;
    }

    .angle-sheet {
      border-radius: var(--radius-xl);
      max-height: 70vh;
    }

    .angle-sheet-handle {
      display: none;
    }
  }
</style>
