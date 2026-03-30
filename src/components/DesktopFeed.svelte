<script lang="ts">
  import { onMount } from 'svelte';
  import FeedRow from './FeedRow.svelte';
  import SectionHeader from './SectionHeader.svelte';
  import { getReadCount, reactions } from '../stores/reader';
  import { issueCategory } from '../data/issues';

  import type { IssueSummary } from '../lib/issues-loader';
  import type { FeedSection, SectionKind } from '../lib/feed-sections';

  interface Props {
    issues: IssueSummary[];
    sections?: FeedSection[];
    activeId: string | null;
    readMap: Record<string, string>;
    onSelectIssue: (issue: IssueSummary) => void;
    searchQuery?: string;
    onSearchInput?: (query: string) => void;
    onSearchFocus?: () => void;
    onSearchClear?: () => void;
    issueHasConnections?: (id: string) => boolean;
  }
  let { issues, sections = [], activeId, readMap, onSelectIssue, searchQuery = '', onSearchInput, onSearchFocus, onSearchClear, issueHasConnections }: Props = $props();

  let collapsedSections = $state<Record<string, boolean>>({});

  function issueReadState(id: string): { state: string; progress: number } | null {
    const raw = readMap[id];
    if (!raw) return null;
    if (raw === 'true') return { state: 'completed', progress: 6 };
    try { return JSON.parse(raw); } catch { return null; }
  }

  let isSearching = $derived(searchQuery.trim().length >= 2);

  // Filter state
  let filterMode = $state<'all' | 'new' | 'reading' | 'done'>('all');
  let sortMode = $state<'editorial' | 'topic'>('editorial');

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

  // Apply topic grouping
  let displayIssues = $derived.by(() => {
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

<aside aria-label="Issue list" style="width:360px;height:100vh;overflow-y:auto;overscroll-behavior:contain;border-right:1px solid var(--bg-sunken);flex-shrink:0;background:var(--bg);display:flex;flex-direction:column;">
  <div style="padding:12px 20px 0;flex-shrink:0;">
    <!-- Search -->
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

    <!-- Section headers or filter bar -->
    {#if isSearching}
      <div style="padding:6px 0;">
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
        {#each [
          { key: 'all', label: 'All', count: counts.all },
          { key: 'new', label: 'New', count: counts.new },
          { key: 'reading', label: 'Reading', count: counts.reading },
          { key: 'done', label: 'Done', count: counts.done },
        ] as tab}
          <button
            onclick={() => { filterMode = tab.key as typeof filterMode; }}
            role="tab"
            aria-selected={filterMode === tab.key}
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
            <span style="font-size:10px;font-weight:500;color:{filterMode === tab.key ? 'var(--text-tertiary)' : 'var(--text-faint)'};">{tab.count}</span>
          </button>
        {/each}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;">
        <span style="font-size:10px;color:var(--text-muted);">{issues.length} issues</span>
      </div>
    {/if}
  </div>

  <!-- Feed list -->
  <div
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
          collapsed={collapsedSections[section.kind] ?? (section.kind === 'completed')}
          onToggle={() => { collapsedSections[section.kind] = !(collapsedSections[section.kind] ?? (section.kind === 'completed')); }}
        />
        {#if !(collapsedSections[section.kind] ?? (section.kind === 'completed'))}
          {#each section.issues as issue}
            <FeedRow {issue} readState={issueReadState(issue.id)} isActive={activeId === issue.id} onClick={() => onSelectIssue(issue)} hasReaction={hasReaction(issue.id)} hasConnections={issueHasConnections?.(issue.id) ?? false} searchTerms={isSearching ? searchQuery.trim() : ''} />
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
            <FeedRow {issue} readState={issueReadState(issue.id)} isActive={activeId === issue.id} onClick={() => { focusedIndex = idx; onSelectIssue(issue); }} hasReaction={hasReaction(issue.id)} hasConnections={issueHasConnections?.(issue.id) ?? false} searchTerms={isSearching ? searchQuery.trim() : ''} />
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div style="padding:10px 20px;border-top:1px solid var(--bg-sunken);flex-shrink:0;">
    <div style="font-size:10px;color:var(--text-tertiary);text-align:center;">
      Press ↑↓ to navigate · Enter to read · / to search
    </div>
    <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;text-align:center;">
      <a href="/about" style="color:var(--text-tertiary);text-decoration:none;">About</a>
    </div>
  </div>
</aside>
