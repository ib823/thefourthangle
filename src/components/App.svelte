<script lang="ts">
  import { onMount } from 'svelte';
  import { ISSUES as issues } from '../data/issues';
  import Header from './Header.svelte';
  import DesktopCard from './DesktopCard.svelte';
  import DesktopFeed from './DesktopFeed.svelte';
  import DesktopReader from './DesktopReader.svelte';
  import DesktopEmptyState from './DesktopEmptyState.svelte';
  import MobileBrowser from './MobileBrowser.svelte';
  import InsightReader from './InsightReader.svelte';
  import { readIssues } from '../stores/reader';
  import { loadSearchIndex, search as doSearch, isLoaded as searchReady } from '../lib/search';
  import { getAnimationTier } from '../lib/animation';

  interface Props {
    initialIssueId?: string;
  }
  let { initialIssueId }: Props = $props();

  let viewMode = $state<'mobile' | 'tablet' | 'desktop'>('desktop');
  let searchQuery = $state('');
  let searchActive = $state(false);

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
  let activeIssue: (typeof issues)[0] | null = $state(
    initialIssueId ? issues.find(i => i.id === initialIssueId) ?? null : null
  );
  let readMap: Record<string, string> = $state({});

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

  function checkViewport() {
    const w = window.innerWidth;
    if (w <= 768) viewMode = 'mobile';
    else if (w < 1024) viewMode = 'tablet';
    else viewMode = 'desktop';
  }

  onMount(() => {
    checkViewport();
    window.addEventListener('resize', checkViewport);

    // Set animation tier class on <html> for CSS perf rules
    const tier = getAnimationTier();
    document.documentElement.classList.add('anim-tier-' + tier);

    return () => window.removeEventListener('resize', checkViewport);
  });

  function openIssue(issue: (typeof issues)[0]) {
    activeIssue = issue;
  }

  function closeReader() {
    activeIssue = null;
  }

  function openNextIssue() {
    if (!activeIssue) return;
    const idx = issues.findIndex(i => i.id === activeIssue!.id);
    if (idx >= 0 && idx < issues.length - 1) {
      activeIssue = issues[idx + 1];
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
      // Ctrl+K or / to focus search (desktop/tablet only)
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
      if (e.key === 'Escape' && activeIssue) { activeIssue = null; return; }
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (!activeIssue) { activeIssue = issues[0]; return; }
        const idx = issues.findIndex(i => i.id === activeIssue!.id);
        if (idx < issues.length - 1) activeIssue = issues[idx + 1];
      }
      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!activeIssue) return;
        const idx = issues.findIndex(i => i.id === activeIssue!.id);
        if (idx > 0) activeIssue = issues[idx - 1];
      }
      if (e.key === 'Enter') {
        if (!activeIssue) { activeIssue = issues[0]; return; }
        openIssue(activeIssue);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });
</script>

{#if viewMode === 'mobile'}
  <!-- Mobile: Tinder-style vertical browse -->
  <main style="height:100dvh;display:flex;flex-direction:column;overflow:hidden;">
    <Header
      onSearchToggle={() => { searchActive = true; loadSearchIndex(); }}
      searchMode={searchActive}
      {searchQuery}
      onSearchInput={(q) => { searchQuery = q; }}
      onSearchClear={onSearchClear}
    />
    <MobileBrowser issues={filteredIssues} onOpenIssue={openIssue} />
  </main>

  {#if activeIssue}
    <InsightReader issue={activeIssue} onClose={closeReader} onNext={isLastIssue ? undefined : openNextIssue} />
  {/if}

{:else if viewMode === 'tablet'}
  <!-- Tablet: grid + overlay reader -->
  <main style="min-height:100vh;">
    <Header />
    <div style="max-width:960px;margin:0 auto;padding:0 18px 40px;">
      <div style="margin-bottom:16px;">
        <input
          data-search-input
          type="text"
          placeholder="Search issues..."
          value={searchQuery}
          oninput={(e) => { searchQuery = (e.currentTarget as HTMLInputElement).value; }}
          onfocus={onSearchFocus}
          style="width:100%;padding:10px 16px;font-size:14px;border:1px solid #E9ECEF;border-radius:12px;background:#F1F3F5;color:#212529;outline:none;"
        />
      </div>
      <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:16px;">
        {#each filteredIssues as issue, i}
          <DesktopCard {issue} index={i} readState={getState(issue.id)} onOpen={() => openIssue(issue)} />
        {/each}
      </div>
    </div>
  </main>

  {#if activeIssue}
    <InsightReader issue={activeIssue} onClose={closeReader} onNext={isLastIssue ? undefined : openNextIssue} />
  {/if}

{:else}
  <!-- Desktop: split-pane -->
  <main style="height:100vh;display:flex;flex-direction:column;overflow:hidden;">
    <!-- Full-width header -->
    <div style="flex-shrink:0;border-bottom:1px solid #F1F3F5;">
      <Header />
    </div>

    <!-- Split pane -->
    <div style="flex:1;display:flex;overflow:hidden;">
      <DesktopFeed
        issues={filteredIssues}
        activeId={activeIssue?.id ?? null}
        {readMap}
        onSelectIssue={openIssue}
        {searchQuery}
        onSearchInput={(q) => { searchQuery = q; }}
        {onSearchFocus}
        {onSearchClear}
      />

      {#if activeIssue}
        <DesktopReader
          issue={activeIssue}
          onNext={isLastIssue ? undefined : openNextIssue}
          {nextHeadline}
        />
      {:else}
        <DesktopEmptyState />
      {/if}
    </div>
  </main>
{/if}
