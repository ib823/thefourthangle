<script lang="ts">
  import { onMount } from 'svelte';
  import FeedRow from './FeedRow.svelte';
  import SectionHeader from './SectionHeader.svelte';
  import SortToggle from './SortToggle.svelte';
  import SurfaceNav from './SurfaceNav.svelte';
  import { getReadCount, reactions, savedIssues } from '../stores/reader';
  import { issueCategory } from '../data/issues';
  import { releaseLabel } from '../lib/build';

  import type { IssueSummary } from '../lib/issues-loader';
  import type { FeedSection, SectionKind, SortMode } from '../lib/feed-sections';

  interface Props {
    issues: IssueSummary[];
    sections?: FeedSection[];
    activeId: string | null;
    readMap: Record<string, string>;
    surfaceMode?: 'today' | 'browse' | 'saved' | 'marked';
    savedCount?: number;
    markedCount?: number;
    onGoToday?: () => void;
    onOpenBrowse?: () => void;
    onOpenSaved?: () => void;
    onOpenMarked?: () => void;
    onSelectIssue: (issue: IssueSummary) => void;
    searchQuery?: string;
    onSearchInput?: (query: string) => void;
    onSearchFocus?: () => void;
    onSearchClear?: () => void;
    issueHasConnections?: (id: string) => boolean;
    sortMode?: SortMode;
    onSortChange?: (mode: SortMode) => void;
  }
  let { issues, sections = [], activeId, readMap, surfaceMode = 'today', savedCount = 0, markedCount = 0, onGoToday, onOpenBrowse, onOpenSaved, onOpenMarked, onSelectIssue, searchQuery = '', onSearchInput, onSearchFocus, onSearchClear, issueHasConnections, sortMode = 'latest', onSortChange }: Props = $props();
  const releaseStamp = releaseLabel();

  let collapsedSections = $state<Record<string, boolean>>({});

  function defaultCollapsed(kind: SectionKind): boolean {
    return kind === 'completed' || kind === 'explore';
  }

  function issueReadState(id: string): { state: string; progress: number } | null {
    const raw = readMap[id];
    if (!raw) return null;
    if (raw === 'true') return { state: 'completed', progress: 6 };
    try { return JSON.parse(raw); } catch { return null; }
  }

  let isSearching = $derived(searchQuery.trim().length >= 2);

  // Filter state
  type FilterMode = 'all' | 'new' | 'reading' | 'done';
  const filterTabs: Array<{ key: FilterMode; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'new', label: 'New' },
    { key: 'reading', label: 'Reading' },
    { key: 'done', label: 'Done' },
  ];
  let filterMode = $state<FilterMode>('all');

  // Reactions — subscribe to the atom for real-time updates
  let reactionRaw = $state('{}');
  $effect(() => {
    const unsub = reactions.subscribe(v => { reactionRaw = v; });
    return unsub;
  });
  let reactionMap: Record<string, number[]> = $derived.by(() => {
    try { return JSON.parse(reactionRaw); } catch { return {}; }
  });

  function hasReaction(issueId: string): boolean {
    return (reactionMap[issueId]?.length ?? 0) > 0;
  }

  let savedRaw = $state('{}');
  $effect(() => {
    const unsub = savedIssues.subscribe(v => { savedRaw = v; });
    return unsub;
  });
  let savedMap: Record<string, number> = $derived.by(() => {
    try { return JSON.parse(savedRaw); } catch { return {}; }
  });

  function isSaved(issueId: string): boolean {
    return !!savedMap[issueId];
  }

  // Compute counts
  let counts = $derived.by(() => {
    let newCount = 0;
    let readingCount = 0;
    let doneCount = 0;
    for (const issue of issues) {
      const state = issueReadState(issue.id);
      if (!state) { newCount++; }
      else if (state.state === 'started') { readingCount++; }
      else if (state.state === 'completed') { doneCount++; }
    }
    return { all: issues.length, new: newCount, reading: readingCount, done: doneCount };
  });

  // Apply filter
  let filteredByState = $derived.by(() => {
    if (filterMode === 'all') return issues;
    return issues.filter(issue => {
      const state = issueReadState(issue.id);
      if (filterMode === 'new') return !state;
      if (filterMode === 'reading') return state?.state === 'started';
      if (filterMode === 'done') return state?.state === 'completed';
      return true;
    });
  });

  // Apply topic grouping (skip when searching — display flat results)
  let displayIssues = $derived.by(() => {
    if (isSearching) return filteredByState;
    if (sortMode === 'editorial') return filteredByState;
    const grouped = new Map<string, IssueSummary[]>();
    for (const issue of filteredByState) {
      const cat = issueCategory(issue);
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(issue);
    }
    return { grouped };
  });

  let isGrouped = $derived(sortMode === 'topic' && typeof displayIssues === 'object' && 'grouped' in displayIssues);

  // Virtual feed
  let scrollContainerEl: HTMLDivElement | undefined = $state(undefined);
  let scrollTop = $state(0);
  let containerHeight = $state(800);
  const ITEM_HEIGHT = 132;
  const BUFFER = 8;

  function onFeedScroll() {
    if (scrollContainerEl) {
      scrollTop = scrollContainerEl.scrollTop;
    }
  }

  onMount(() => {
    if (scrollContainerEl) {
      containerHeight = scrollContainerEl.clientHeight;
      const ro = new ResizeObserver((entries) => {
        containerHeight = entries[0].contentRect.height;
      });
      ro.observe(scrollContainerEl);
      return () => ro.disconnect();
    }
  });

  let flatIssues = $derived(Array.isArray(displayIssues) ? displayIssues : []);
  let visibleStart = $derived(Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER));
  let visibleEnd = $derived(Math.min(flatIssues.length, Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + BUFFER));
  let totalHeight = $derived(flatIssues.length * ITEM_HEIGHT);

  // Roving tabindex
  let focusedIndex = $state(-1);

  function onFeedKeyDown(e: KeyboardEvent) {
    if (sortMode === 'topic') return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusedIndex = Math.min(focusedIndex + 1, flatIssues.length - 1);
      scrollToFocused();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusedIndex = Math.max(focusedIndex - 1, 0);
      scrollToFocused();
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault();
      onSelectIssue(flatIssues[focusedIndex]);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusedIndex = 0;
      scrollToFocused();
    } else if (e.key === 'End') {
      e.preventDefault();
      focusedIndex = flatIssues.length - 1;
      scrollToFocused();
    }
  }

  function activateFilter(mode: FilterMode) {
    filterMode = mode;
  }

  function onFilterKeyDown(event: KeyboardEvent, mode: FilterMode) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const currentIndex = filterTabs.findIndex((tab) => tab.key === mode);
    if (event.key === 'Home') {
      activateFilter(filterTabs[0].key);
      return;
    }
    if (event.key === 'End') {
      activateFilter(filterTabs[filterTabs.length - 1].key);
      return;
    }
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (currentIndex + delta + filterTabs.length) % filterTabs.length;
    activateFilter(filterTabs[nextIndex].key);
  }

  function scrollToFocused() {
    if (!scrollContainerEl || focusedIndex < 0) return;
    const itemTop = focusedIndex * ITEM_HEIGHT;
    const itemBottom = itemTop + ITEM_HEIGHT;
    const viewTop = scrollContainerEl.scrollTop;
    const viewBottom = viewTop + containerHeight;
    if (itemTop < viewTop) {
      scrollContainerEl.scrollTop = itemTop;
    } else if (itemBottom > viewBottom) {
      scrollContainerEl.scrollTop = itemBottom - containerHeight;
    }
    requestAnimationFrame(() => {
      const el = scrollContainerEl?.querySelector(`[data-index="${focusedIndex}"]`) as HTMLElement;
      el?.focus();
    });
  }

  // Reset scroll when filter changes
  $effect(() => {
    void filterMode;
    if (scrollContainerEl) {
      scrollContainerEl.scrollTop = 0;
      scrollTop = 0;
    }
  });
</script>

<aside aria-label="Issue list" style="width:320px;height:100%;min-height:0;overflow-y:auto;overscroll-behavior:contain;border-right:1px solid var(--bg-sunken);flex-shrink:0;background:linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg) 18%);display:flex;flex-direction:column;">
  <h1 class="sr-only">{surfaceMode === 'today' ? 'Today' : surfaceMode === 'browse' ? 'Browse' : surfaceMode === 'saved' ? 'Saved issues' : 'Marked issues'}</h1>
  <div style="padding:14px 18px 0;flex-shrink:0;">
    <div style="padding:0 2px 12px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-tertiary);">Smart Queue</div>
      <div style="font-size:13px;line-height:1.45;color:var(--text-secondary);margin-top:6px;">Move between ritual, archive, and memory without losing your place.</div>
    </div>

    <div style="padding:0 0 12px;">
      <SurfaceNav variant="sidebar" {surfaceMode} {savedCount} {markedCount} onGoToday={onGoToday} onOpenBrowse={onOpenBrowse} onOpenSaved={onOpenSaved} onOpenMarked={onOpenMarked} />
    </div>

    <!-- Search -->
    <form role="search" aria-label="Search issues" onsubmit={(event) => event.preventDefault()} style="position:relative;">
      <label class="sr-only" for="desktop-search">Search issues</label>
      <input
        id="desktop-search"
        data-search-input
        type="text"
        placeholder="Search issues..."
        aria-label="Search issues"
        value={searchQuery}
        oninput={(e) => onSearchInput?.((e.currentTarget as HTMLInputElement).value)}
        onfocus={() => onSearchFocus?.()}
        style="width:100%;padding:8px 32px 8px 12px;font-size:13px;border:1px solid var(--border-subtle);border-radius:8px;background:var(--bg-sunken);color:var(--text-primary);outline:none;transition:border-color 0.15s ease;"
        onfocusin={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--score-info)'; }}
        onfocusout={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
      />
      {#if isSearching}
        <button
          type="button"
          onclick={() => onSearchClear?.()}
          style="position:absolute;right:4px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:14px;color:var(--text-tertiary);padding:8px;min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;"
          aria-label="Clear search"
        >x</button>
      {/if}
    </form>

    <!-- Sort toggle -->
    {#if !isSearching && onSortChange && surfaceMode === 'browse'}
      <div style="padding:10px 0 4px;">
        <SortToggle variant="sidebar" {sortMode} onChange={onSortChange} panelId="desktop-browse-panel" idPrefix="desktop-sort" />
      </div>
    {/if}

    <!-- Section headers or filter bar -->
    {#if isSearching}
      <div style="padding:6px 0;">
        <span class="sr-only" role="status" aria-live="polite">
          {#if issues.length === 0 && searchQuery.trim().length >= 2}
            No results for "{searchQuery.trim()}"
          {:else}
            {issues.length} result{issues.length !== 1 ? 's' : ''} for "{searchQuery.trim()}"
          {/if}
        </span>
        <span style="font-size:11px;color:var(--text-tertiary);">
          {#if issues.length === 0 && searchQuery.trim().length >= 2}
            No results for "{searchQuery.trim()}"
          {:else}
            {issues.length} result{issues.length !== 1 ? 's' : ''} for "{searchQuery.trim()}"
          {/if}
        </span>
      </div>
    {:else if sections.length === 0}
      <!-- Fallback: filter tabs when no sections computed -->
      <div style="display:flex;gap:0;margin-top:8px;border-bottom:1px solid var(--bg-sunken);" role="tablist" aria-label="Filter issues">
        {#each filterTabs as tab}
          <button
            id={`desktop-filter-${tab.key}`}
            onclick={() => { activateFilter(tab.key); }}
            onkeydown={(event) => onFilterKeyDown(event, tab.key)}
            role="tab"
            aria-selected={filterMode === tab.key}
            aria-controls="desktop-feed-list"
            tabindex={filterMode === tab.key ? 0 : -1}
            style="
              flex:1;padding:8px 4px 10px;background:none;border:none;cursor:pointer;
              font-size:11px;font-weight:{filterMode === tab.key ? '700' : '500'};
              color:{filterMode === tab.key ? 'var(--text-primary)' : 'var(--text-muted)'};
              border-bottom:2px solid {filterMode === tab.key ? 'var(--text-primary)' : 'transparent'};
              transition:color var(--duration-fast, 150ms) ease, border-color var(--duration-fast, 150ms) ease;
              display:flex;flex-direction:column;align-items:center;gap:1px;
              min-height:44px;justify-content:center;
            "
          >
            <span>{tab.label}</span>
            <span style="font-size:10px;font-weight:500;color:{filterMode === tab.key ? 'var(--text-tertiary)' : 'var(--text-faint)'};">
              {tab.key === 'all' ? counts.all : tab.key === 'new' ? counts.new : tab.key === 'reading' ? counts.reading : counts.done}
            </span>
          </button>
        {/each}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;">
        <span style="font-size:10px;color:var(--text-muted);">{issues.length} issues</span>
      </div>
    {/if}
  </div>

  <!-- Feed list -->
  <div id="desktop-browse-panel" role={surfaceMode === 'browse' && !isSearching ? 'tabpanel' : undefined} aria-labelledby={surfaceMode === 'browse' && !isSearching ? `desktop-sort-${sortMode}` : undefined} style="flex:1;display:flex;flex-direction:column;min-height:0;">
  <div
    id="desktop-feed-list"
    bind:this={scrollContainerEl}
    onscroll={onFeedScroll}
    onkeydown={onFeedKeyDown}
    role="listbox"
    aria-label="Issues"
    style="flex:1;overflow-y:auto;"
  >
    {#if sections.length > 0 && !isSearching}
      <!-- Section-based feed -->
      {#each sections as section}
        <SectionHeader
          label={section.label}
          count={section.count}
          kind={section.kind}
          collapsed={collapsedSections[section.kind] ?? defaultCollapsed(section.kind)}
          onToggle={() => { collapsedSections[section.kind] = !(collapsedSections[section.kind] ?? defaultCollapsed(section.kind)); }}
        />
        {#if !(collapsedSections[section.kind] ?? defaultCollapsed(section.kind))}
          {#each section.issues as issue}
            <FeedRow {issue} readState={issueReadState(issue.id)} isActive={activeId === issue.id} onClick={() => onSelectIssue(issue)} hasReaction={hasReaction(issue.id)} isSaved={isSaved(issue.id)} hasConnections={issueHasConnections?.(issue.id) ?? false} searchTerms={isSearching ? searchQuery.trim() : ''} />
          {/each}
        {/if}
      {/each}
    {:else if flatIssues.length === 0 && (isSearching || filterMode !== 'all')}
      <div style="padding:40px 20px;text-align:center;">
        <p style="font-size:13px;color:var(--text-muted);">
          {#if isSearching}
            No issues match "{searchQuery}"
          {:else}
            No issues found
          {/if}
        </p>
      </div>
    {:else}
      <!-- Virtual windowed list (fallback / search results) -->
      <div style="height:{totalHeight}px;position:relative;">
        {#each flatIssues.slice(visibleStart, visibleEnd) as issue, i}
          {@const idx = visibleStart + i}
          <div
            style="position:absolute;top:{idx * ITEM_HEIGHT}px;left:0;right:0;height:{ITEM_HEIGHT}px;"
            data-index={idx}
            role="option"
            aria-selected={activeId === issue.id}
            tabindex={focusedIndex === idx ? 0 : -1}
          >
            <FeedRow {issue} readState={issueReadState(issue.id)} isActive={activeId === issue.id} onClick={() => { focusedIndex = idx; onSelectIssue(issue); }} hasReaction={hasReaction(issue.id)} isSaved={isSaved(issue.id)} hasConnections={issueHasConnections?.(issue.id) ?? false} searchTerms={isSearching ? searchQuery.trim() : ''} />
          </div>
        {/each}
      </div>
    {/if}
  </div>
  </div>

  <div style="padding:10px 20px;border-top:1px solid var(--bg-sunken);flex-shrink:0;">
    <div style="font-size:10px;color:var(--text-tertiary);text-align:center;">
      Press ↑↓ to navigate · Enter to read · / to search
    </div>
    <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;text-align:center;">
      <a href="/about" style="color:var(--text-tertiary);text-decoration:none;">About</a>
    </div>
    <div style="font-size:10px;color:var(--text-faint);margin-top:6px;text-align:center;font-variant-numeric:tabular-nums;" title={releaseStamp}>
      Build {releaseStamp}
    </div>
  </div>
</aside>
