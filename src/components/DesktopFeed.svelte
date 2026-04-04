<script lang="ts">
  import { onMount } from 'svelte';
  import FeedRow from './FeedRow.svelte';
  import SectionHeader from './SectionHeader.svelte';
  import LibraryTabs from './LibraryTabs.svelte';
  import SortToggle from './SortToggle.svelte';
  import SurfaceNav from './SurfaceNav.svelte';
  import { reactions } from '../stores/reader';

  import type { IssueSummary } from '../lib/issues-loader';
  import type { FeedSection, SectionKind, SortMode } from '../lib/feed-sections';

  interface Props {
    issues: IssueSummary[];
    sections?: FeedSection[];
    activeId: string | null;
    readMap: Record<string, string>;
    surfaceMode?: 'today' | 'library';
    libraryMode?: 'reading' | 'highlights' | 'archive';
    readingCount?: number;
    highlightCount?: number;
    archiveCount?: number;
    libraryCount?: number;
    onGoToday?: () => void;
    onOpenLibrary?: () => void;
    onOpenReading?: () => void;
    onOpenHighlights?: () => void;
    onOpenArchive?: () => void;
    onSelectIssue: (issue: IssueSummary) => void;
    searchQuery?: string;
    onSearchInput?: (query: string) => void;
    onSearchFocus?: () => void;
    onSearchClear?: () => void;
    issueHasConnections?: (id: string) => boolean;
    sortMode?: SortMode;
    onSortChange?: (mode: SortMode) => void;
  }
  let { issues, sections = [], activeId, readMap, surfaceMode = 'today', libraryMode = 'reading', readingCount = 0, highlightCount = 0, archiveCount = 0, libraryCount = 0, onGoToday, onOpenLibrary, onOpenReading, onOpenHighlights, onOpenArchive, onSelectIssue, searchQuery = '', onSearchInput, onSearchFocus, onSearchClear, issueHasConnections, sortMode = 'latest', onSortChange }: Props = $props();
  function libraryHeading(mode: 'reading' | 'highlights' | 'archive') {
    if (mode === 'highlights') return 'Highlights library';
    if (mode === 'archive') return 'Archive library';
    return 'Reading library';
  }

  function feedAriaLabel(mode: 'today' | 'library', activeLibraryMode: 'reading' | 'highlights' | 'archive') {
    if (mode === 'library') return libraryHeading(activeLibraryMode);
    return 'Issue list';
  }

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

  // Search and library views use a flat issue list in the sidebar.
  let displayIssues = $derived(filteredByState);

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

  let flatIssues = $derived(displayIssues);
  let issueIndexMap = $derived.by(() => new Map(flatIssues.map((issue, index) => [issue.id, index])));
  let visibleStart = $derived(Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER));
  let visibleEnd = $derived(Math.min(flatIssues.length, Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + BUFFER));
  let totalHeight = $derived(flatIssues.length * ITEM_HEIGHT);

  // Roving tabindex
  let focusedIndex = $state(-1);

  function onFeedKeyDown(e: KeyboardEvent) {
    if (sortMode === 'topic') return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      focusedIndex = Math.min(focusedIndex + 1, flatIssues.length - 1);
      scrollToFocused();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      focusedIndex = Math.max(focusedIndex - 1, 0);
      scrollToFocused();
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault();
      e.stopPropagation();
      onSelectIssue(flatIssues[focusedIndex]);
    } else if (e.key === 'Home') {
      e.preventDefault();
      e.stopPropagation();
      focusedIndex = 0;
      scrollToFocused();
    } else if (e.key === 'End') {
      e.preventDefault();
      e.stopPropagation();
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

  function rowTabIndex(issueId: string, index: number): number {
    if (focusedIndex === index) return 0;
    if (focusedIndex >= 0) return -1;
    if (!activeId) return index === 0 ? 0 : -1;
    return activeId === issueId ? 0 : -1;
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

<aside aria-label={feedAriaLabel(surfaceMode, libraryMode)} style="width:320px;height:100%;min-height:0;overflow-y:auto;overscroll-behavior:contain;border-right:1px solid var(--bg-sunken);flex-shrink:0;background:linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg) 18%);display:flex;flex-direction:column;">
  <h2 class="sr-only">{surfaceMode === 'today' ? 'Issue list' : libraryHeading(libraryMode)}</h2>
  <div style="padding:14px 18px 12px;flex-shrink:0;">
    <div style="padding:0 0 12px;">
      <SurfaceNav variant="sidebar" {surfaceMode} {libraryCount} onGoToday={onGoToday} onOpenLibrary={onOpenLibrary} />
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
        style="width:100%;padding:8px 32px 8px 12px;font-size: var(--text-ui);border:1px solid var(--border-subtle);border-radius: var(--radius-md);background:var(--bg-sunken);color:var(--text-primary);outline:none;transition:border-color 0.15s ease;"
        onfocusin={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--score-info)'; }}
        onfocusout={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
      />
      {#if isSearching}
        <button
          type="button"
          onclick={() => onSearchClear?.()}
          style="position:absolute;right:4px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size: var(--text-body);color:var(--text-tertiary);padding:8px;min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;"
          aria-label="Clear search"
        >x</button>
      {/if}
    </form>

    {#if !isSearching && surfaceMode === 'library'}
      <div style="padding:10px 0 4px;">
        <LibraryTabs
          variant="sidebar"
          {libraryMode}
          {readingCount}
          {highlightCount}
          {archiveCount}
          panelId="desktop-library-panel"
          idPrefix="desktop-library"
          onOpenReading={onOpenReading}
          onOpenHighlights={onOpenHighlights}
          onOpenArchive={onOpenArchive}
        />
      </div>
    {/if}

    {#if !isSearching && onSortChange && !(surfaceMode === 'library' && libraryMode === 'highlights')}
      <div style="padding:10px 0 4px;">
        <SortToggle
          variant="sidebar"
          {sortMode}
          onChange={onSortChange}
          panelId={surfaceMode === 'today' ? 'desktop-today-panel' : 'desktop-library-panel'}
          idPrefix={surfaceMode === 'today' ? 'desktop-today-sort' : 'desktop-library-sort'}
        />
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
        <span style="font-size: var(--text-xs);color:var(--text-tertiary);">
          {#if issues.length === 0 && searchQuery.trim().length >= 2}
            No results for "{searchQuery.trim()}"
          {:else}
            {issues.length} result{issues.length !== 1 ? 's' : ''} for "{searchQuery.trim()}"
          {/if}
        </span>
      </div>
    {:else if sections.length === 0 && surfaceMode !== 'library'}
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
              font-size: var(--text-xs);font-weight:{filterMode === tab.key ? '700' : '600'};
              color:{filterMode === tab.key ? 'var(--text-primary)' : 'var(--text-muted)'};
              border-bottom:2px solid {filterMode === tab.key ? 'var(--text-primary)' : 'transparent'};
              transition:color var(--duration-fast, 150ms) ease, border-color var(--duration-fast, 150ms) ease;
              display:flex;flex-direction:column;align-items:center;gap:1px;
              min-height:44px;justify-content:center;
            "
          >
            <span>{tab.label}</span>
            <span style="font-size: var(--text-micro);font-weight: 600;color:{filterMode === tab.key ? 'var(--text-tertiary)' : 'var(--text-faint)'};">
              {tab.key === 'all' ? counts.all : tab.key === 'new' ? counts.new : tab.key === 'reading' ? counts.reading : counts.done}
            </span>
          </button>
        {/each}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;">
        <span style="font-size: var(--text-micro);color:var(--text-muted);">{issues.length} issues</span>
      </div>
    {/if}
  </div>

  <!-- Feed list -->
  <div
    id={surfaceMode === 'library' ? 'desktop-library-panel' : 'desktop-today-panel'}
    role={!isSearching ? 'tabpanel' : undefined}
    aria-labelledby={!isSearching && surfaceMode === 'library' ? `desktop-library-${libraryMode}` : !isSearching ? `desktop-today-sort-${sortMode}` : undefined}
    tabindex={!isSearching ? 0 : undefined}
    style="flex:1;display:flex;flex-direction:column;min-height:0;"
  >
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
        {@const sectionHeadingId = `desktop-feed-section-${section.kind}-heading`}
        {@const sectionPanelId = `desktop-feed-section-${section.kind}-panel`}
        {@const sectionCollapsed = collapsedSections[section.kind] ?? defaultCollapsed(section.kind)}
        <div role="group" aria-labelledby={sectionHeadingId}>
          <SectionHeader
            id={sectionHeadingId}
            controlsId={sectionPanelId}
            label={section.label}
            count={section.count}
            kind={section.kind}
            collapsed={sectionCollapsed}
            onToggle={() => { collapsedSections[section.kind] = !sectionCollapsed; }}
          />
          <div id={sectionPanelId} hidden={sectionCollapsed}>
            {#if !sectionCollapsed}
              {#each section.issues as issue}
                {@const idx = issueIndexMap.get(issue.id) ?? 0}
                <FeedRow {issue} readState={issueReadState(issue.id)} isActive={activeId === issue.id} tabIndex={rowTabIndex(issue.id, idx)} itemIndex={idx} onClick={() => { focusedIndex = idx; onSelectIssue(issue); }} hasReaction={hasReaction(issue.id)} reactionCount={reactionMap[issue.id]?.length ?? 0} hasConnections={issueHasConnections?.(issue.id) ?? false} searchTerms={isSearching ? searchQuery.trim() : ''} />
              {/each}
            {/if}
          </div>
        </div>
      {/each}
    {:else if flatIssues.length === 0 && (isSearching || filterMode !== 'all')}
      <div style="padding:40px 20px;text-align:center;">
        <p style="font-size: var(--text-ui);color:var(--text-muted);">
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
          >
            <FeedRow {issue} readState={issueReadState(issue.id)} isActive={activeId === issue.id} tabIndex={rowTabIndex(issue.id, idx)} itemIndex={idx} onClick={() => { focusedIndex = idx; onSelectIssue(issue); }} hasReaction={hasReaction(issue.id)} reactionCount={reactionMap[issue.id]?.length ?? 0} hasConnections={issueHasConnections?.(issue.id) ?? false} searchTerms={isSearching ? searchQuery.trim() : ''} />
          </div>
        {/each}
      </div>
    {/if}
  </div>
  </div>
</aside>
