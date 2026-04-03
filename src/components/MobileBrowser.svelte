<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import MobileCard from './MobileCard.svelte';
  import MobileSectionDivider from './MobileSectionDivider.svelte';
  import { readIssues, savePosition, reactions } from '../stores/reader';
  import { haptic } from '../lib/animation';

  import type { IssueSummary } from '../lib/issues-loader';
  import type { FeedSection, SortMode } from '../lib/feed-sections';

  type DisplayItem =
    | { type: 'issue'; issue: IssueSummary }
    | { type: 'divider'; label: string; count: number; kind: FeedSection['kind'] }
    | { type: 'sort-toggle' };

  interface Props {
    issues: IssueSummary[];
    sections?: FeedSection[];
    onOpenIssue: (issue: IssueSummary, originRect?: DOMRect) => void;
    onPrefetch?: (issue: IssueSummary) => void;
    issueHasConnections?: (id: string) => boolean;
    initialFeedIndex?: number;
    searchQuery?: string;
    sortMode?: SortMode;
    onSortChange?: (mode: SortMode) => void;
    allowPullRefresh?: boolean;
    onPullRefresh?: () => void;
  }
  let {
    issues,
    sections = [],
    onOpenIssue,
    onPrefetch,
    issueHasConnections,
    initialFeedIndex = 0,
    searchQuery = '',
    sortMode = 'latest',
    onSortChange,
    allowPullRefresh = false,
    onPullRefresh,
  }: Props = $props();

  let mounted = $state(false);
  let current = $state(0);
  let readMap: Record<string, string> = $state({});

  // Build display list: interleave section dividers with issues
  // When searching (sections empty), use flat issue list
  let displayList = $derived.by((): DisplayItem[] => {
    if (sections.length === 0) {
      return issues.map(issue => ({ type: 'issue' as const, issue }));
    }
    const items: DisplayItem[] = [];
    // Sort toggle removed from inline feed — rendered in App.svelte above MobileBrowser
    for (const section of sections) {
      items.push({ type: 'divider', label: section.label, count: section.count, kind: section.kind });
      for (const issue of section.issues) {
        items.push({ type: 'issue', issue });
      }
    }
    return items;
  });

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

  // DOM refs
  let containerEl: HTMLDivElement | undefined = $state();

  // Intersection observer for tracking current card
  let observer: IntersectionObserver | undefined;
  let lastSnappedIndex = current;
  let swipeSuppressUntil = 0;
  let touchStartY = 0;
  let touchStartX = 0;
  let touchStartScrollTop = 0;
  let touchTracking = false;
  let slotOffsets = new Map<number, number>();
  let pendingScrollFrame = 0;
  let pendingOffsetFrame = 0;
  let pullDistance = $state(0);
  let pullRefreshState = $state<'idle' | 'pulling' | 'ready' | 'refreshing'>('idle');
  const pullThreshold = 72;
  const pullMax = 104;

  function getState(id: string) {
    const raw = readMap[id];
    if (!raw) return null;
    if (raw === 'true') return { state: 'completed', progress: 6 };
    try { return JSON.parse(raw); } catch { return null; }
  }

  function getIssueDisplayIndex(issueId: string): number {
    const idx = displayList.findIndex((item) => item.type === 'issue' && item.issue.id === issueId);
    return idx >= 0 ? idx : 0;
  }

  function getDisplayIndexForIssueIndex(issueIndex: number): number {
    if (issues.length === 0) return 0;
    const clamped = Math.max(0, Math.min(issueIndex, issues.length - 1));
    const issue = issues[clamped];
    return issue ? getIssueDisplayIndex(issue.id) : 0;
  }

  function normalizeIssueDisplayIndex(index: number): number {
    if (displayList.length === 0) return 0;
    const clamped = Math.max(0, Math.min(index, displayList.length - 1));
    if (displayList[clamped]?.type === 'issue') return clamped;

    for (let next = clamped + 1; next < displayList.length; next += 1) {
      if (displayList[next]?.type === 'issue') return next;
    }

    for (let prev = clamped - 1; prev >= 0; prev -= 1) {
      if (displayList[prev]?.type === 'issue') return prev;
    }

    return 0;
  }

  function findAdjacentIssueIndex(from: number, direction: 1 | -1): number {
    let idx = from + direction;
    while (idx >= 0 && idx < displayList.length) {
      if (displayList[idx]?.type === 'issue') return idx;
      idx += direction;
    }
    return from;
  }

  function refreshSlotOffsets() {
    if (!containerEl) return;

    const nextOffsets = new Map<number, number>();
    const slots = containerEl.querySelectorAll<HTMLElement>('.feed-card-slot');
    slots.forEach((slot) => {
      const idx = Number(slot.dataset.idx);
      if (!Number.isNaN(idx)) {
        nextOffsets.set(idx, slot.offsetTop);
      }
    });
    slotOffsets = nextOffsets;
  }

  function queueSlotOffsetRefresh() {
    if (pendingOffsetFrame) cancelAnimationFrame(pendingOffsetFrame);
    pendingOffsetFrame = requestAnimationFrame(() => {
      pendingOffsetFrame = 0;
      refreshSlotOffsets();
    });
  }

  function scrollToDisplayIndex(index: number, behavior: ScrollBehavior = 'smooth') {
    if (!containerEl) return;
    const normalized = normalizeIssueDisplayIndex(index);
    current = normalized;
    lastSnappedIndex = normalized;

    if (pendingScrollFrame) cancelAnimationFrame(pendingScrollFrame);
    pendingScrollFrame = requestAnimationFrame(() => {
      pendingScrollFrame = 0;
      if (!containerEl) return;

      let top = slotOffsets.get(normalized);
      if (top === undefined) {
        refreshSlotOffsets();
        top = slotOffsets.get(normalized);
      }
      if (top === undefined) return;

      containerEl.scrollTo({
        top,
        behavior: behavior === ('instant' as ScrollBehavior) ? 'auto' : behavior
      });
    });
  }

  function scrollToAdjacentIssue(direction: 1 | -1) {
    const next = findAdjacentIssueIndex(current, direction);
    if (next === current) return;
    haptic(5);
    scrollToDisplayIndex(next, 'smooth');
  }

  $effect(() => {
    const unsub = readIssues.subscribe(v => { readMap = { ...v }; });
    return unsub;
  });

  function setupObserver() {
    if (!containerEl) return;
    observer?.disconnect();

    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio > 0.4) {
          const slot = entry.target as HTMLElement;
          if (slot.dataset.divider) continue; // skip section dividers
          const idx = Number(slot.dataset.idx);
          if (!isNaN(idx) && idx !== lastSnappedIndex) {
            lastSnappedIndex = idx;
            current = idx;
            haptic(5);
            const item = displayList[idx];
            if (item?.type === 'issue') {
              savePosition(item.issue.id, 0);
            }
          }
        }
      }
    }, { threshold: 0.4, root: containerEl });

    const slots = containerEl.querySelectorAll('.feed-card-slot');
    slots.forEach(s => observer!.observe(s));
    refreshSlotOffsets();
  }

  function handleOpenIssue(issue: IssueSummary) {
    // Capture origin rect for shared-element transition
    if (containerEl) {
      const slot = containerEl.querySelector(`[data-idx="${current}"]`) as HTMLElement;
      const rect = slot?.getBoundingClientRect();
      onOpenIssue(issue, rect);
    } else {
      onOpenIssue(issue);
    }
  }

  function handleCardOpen(issue: IssueSummary) {
    if (performance.now() < swipeSuppressUntil) return;
    handleOpenIssue(issue);
  }

  function resetPullRefresh() {
    if (pullRefreshState === 'refreshing') return;
    pullDistance = 0;
    pullRefreshState = 'idle';
  }

  function onTouchStart(event: TouchEvent) {
    if (!containerEl || event.touches.length !== 1) return;
    const touch = event.touches[0];
    touchTracking = true;
    touchStartY = touch.clientY;
    touchStartX = touch.clientX;
    touchStartScrollTop = containerEl.scrollTop;
    if (allowPullRefresh && pullRefreshState !== 'refreshing' && containerEl.scrollTop <= 0) {
      resetPullRefresh();
    }
  }

  function onTouchMove(event: TouchEvent) {
    if (!touchTracking || !containerEl || !allowPullRefresh || pullRefreshState === 'refreshing' || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const deltaY = touch.clientY - touchStartY;
    const deltaX = touch.clientX - touchStartX;
    const pullingFromTop = touchStartScrollTop <= 0 && containerEl.scrollTop <= 0 && deltaY > 0;
    const mostlyVertical = Math.abs(deltaY) >= Math.abs(deltaX) * 1.15;

    if (!pullingFromTop || !mostlyVertical) {
      if (pullRefreshState !== 'idle') resetPullRefresh();
      return;
    }

    if (event.cancelable) event.preventDefault();
    pullDistance = Math.min(pullMax, Math.max(0, deltaY * 0.5));
    pullRefreshState = pullDistance >= pullThreshold ? 'ready' : 'pulling';
  }

  function onTouchEnd(event: TouchEvent) {
    if (!touchTracking || !containerEl || event.changedTouches.length === 0) {
      touchTracking = false;
      resetPullRefresh();
      return;
    }

    touchTracking = false;

    if (pullRefreshState === 'pulling' || pullRefreshState === 'ready') {
      if (pullRefreshState === 'ready' && onPullRefresh) {
        pullRefreshState = 'refreshing';
        pullDistance = 58;
        haptic(8);
        onPullRefresh();
      } else {
        resetPullRefresh();
      }
      return;
    }

    if (sections.length === 0) {
      resetPullRefresh();
      return;
    }

    const touch = event.changedTouches[0];
    const deltaY = touch.clientY - touchStartY;
    const deltaX = touch.clientX - touchStartX;
    const scrollDelta = Math.abs(containerEl.scrollTop - touchStartScrollTop);

    // Native scroll already moved the feed. Avoid a second synthetic jump that can
    // flash one card and then snap to a different card as the observer catches up.
    if (scrollDelta > 8) return;

    if (Math.abs(deltaY) < 48) return;
    if (Math.abs(deltaY) < Math.abs(deltaX) * 1.2) return;

    swipeSuppressUntil = performance.now() + 350;
    if (deltaY < 0) scrollToAdjacentIssue(1);
    else scrollToAdjacentIssue(-1);
  }

  function onTouchCancel() {
    touchTracking = false;
    resetPullRefresh();
  }

  onMount(() => {
    requestAnimationFrame(() => { mounted = true; });

    // Scroll to initial position
    if (containerEl) {
      const initialDisplayIndex = normalizeIssueDisplayIndex(getDisplayIndexForIssueIndex(initialFeedIndex));
      current = initialDisplayIndex;
      lastSnappedIndex = initialDisplayIndex;
      refreshSlotOffsets();
      const top = slotOffsets.get(initialDisplayIndex);
      if (top !== undefined) containerEl.scrollTop = top;
    }

    // Set up IntersectionObserver after initial scroll
    requestAnimationFrame(setupObserver);

    // Keyboard navigation
    function onKeyDown(e: KeyboardEvent) {
      if (!containerEl) return;
      if (e.key === 'ArrowDown' && current < displayList.length - 1) {
        e.preventDefault();
        scrollToAdjacentIssue(1);
      } else if (e.key === 'ArrowUp' && current > 0) {
        e.preventDefault();
        scrollToAdjacentIssue(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = displayList[current];
        if (item?.type === 'issue') handleOpenIssue(item.issue);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', queueSlotOffsetRefresh);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', queueSlotOffsetRefresh);
      observer?.disconnect();
    };
  });

  onDestroy(() => {
    if (pendingScrollFrame) cancelAnimationFrame(pendingScrollFrame);
    if (pendingOffsetFrame) cancelAnimationFrame(pendingOffsetFrame);
  });

  // Re-setup observer when display list changes
  $effect(() => {
    void displayList.length;
    queueSlotOffsetRefresh();
    requestAnimationFrame(() => {
      current = normalizeIssueDisplayIndex(current);
      lastSnappedIndex = current;
      setupObserver();
    });
  });
</script>

<div
  bind:this={containerEl}
  class="feed-scroll"
  style="flex:1;opacity:{mounted ? 1 : 0};transition:opacity 0.15s ease;"
  ontouchstart={onTouchStart}
  ontouchmove={onTouchMove}
  ontouchend={onTouchEnd}
  ontouchcancel={onTouchCancel}
>
  {#if allowPullRefresh}
    <div
      class="pull-refresh"
      class:pull-refresh--visible={pullRefreshState !== 'idle'}
      class:pull-refresh--ready={pullRefreshState === 'ready' || pullRefreshState === 'refreshing'}
      style={`transform: translate3d(-50%, ${Math.round(Math.max(-24, pullDistance - 44))}px, 0); opacity: ${Math.min(1, pullDistance / 36)};`}
      aria-hidden="true"
    >
      {#if pullRefreshState === 'refreshing'}
        Refreshing…
      {:else if pullRefreshState === 'ready'}
        Release to refresh
      {:else}
        Pull to refresh
      {/if}
    </div>
  {/if}
  {#if displayList.length === 0 && searchQuery}
    <div style="text-align:center;padding:60px 20px;color:var(--text-muted);font-size:14px;">No issues match "{searchQuery}"</div>
  {/if}
  {#each displayList as item, i}
    {#if item.type === 'sort-toggle'}
      <div style="display:flex;align-items:center;gap:2px;padding:8px 20px 4px;font-size:12px;font-weight:600;">
        <button onclick={() => onSortChange?.('latest')} style="background:none;border:none;cursor:pointer;padding:4px 10px;border-radius:6px;color:{sortMode === 'latest' ? 'var(--text-primary)' : 'var(--text-faint)'};font-size:12px;font-weight:600;transition:color 0.15s ease;font-family:inherit;">Latest</button>
        <span style="color:var(--border-divider);">·</span>
        <button onclick={() => onSortChange?.('shift')} style="background:none;border:none;cursor:pointer;padding:4px 10px;border-radius:6px;color:{sortMode === 'shift' ? 'var(--text-primary)' : 'var(--text-faint)'};font-size:12px;font-weight:600;transition:color 0.15s ease;font-family:inherit;">Most Hidden</button>
      </div>
    {:else if item.type === 'divider'}
      <div class="feed-card-slot" data-idx={i} data-divider="true">
        <MobileSectionDivider label={item.label} count={item.count} kind={item.kind} />
      </div>
    {:else}
      <div class="feed-card-slot" data-idx={i}>
          <MobileCard
            issue={item.issue}
            readState={getState(item.issue.id)}
            onOpen={() => handleCardOpen(item.issue)}
            onPrefetch={() => onPrefetch?.(item.issue)}
            hasReaction={hasReaction(item.issue.id)}
            hasConnections={issueHasConnections?.(item.issue.id) ?? false}
            eager={i === 0 || i === 1}
          />
      </div>
    {/if}
  {/each}
</div>

<style>
  .feed-scroll {
    position: relative;
    overflow-y: auto;
    scroll-snap-type: y proximity;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: auto;
    overflow-anchor: none;
    scroll-behavior: smooth;
    touch-action: pan-y;
    padding-bottom: env(safe-area-inset-bottom, 0);
  }

  .pull-refresh {
    position: sticky;
    top: 10px;
    left: 50%;
    z-index: 5;
    width: fit-content;
    margin: 0 0 -32px;
    padding: 8px 14px;
    border-radius: 999px;
    border: 1px solid var(--border-subtle);
    background: rgba(255, 255, 255, 0.88);
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 700;
    box-shadow: 0 12px 28px rgba(17, 24, 39, 0.08);
    pointer-events: none;
    transition: opacity 0.18s ease, transform 0.18s ease, border-color 0.18s ease, color 0.18s ease;
    will-change: transform, opacity;
  }

  .pull-refresh--visible {
    opacity: 1;
  }

  .pull-refresh--ready {
    border-color: rgba(184, 92, 0, 0.22);
    color: var(--text-primary);
  }

  @media (prefers-color-scheme: dark) {
    .pull-refresh {
      background: rgba(34, 31, 27, 0.92);
      border-color: rgba(255, 255, 255, 0.08);
      box-shadow: 0 16px 28px rgba(0, 0, 0, 0.28);
    }

    .pull-refresh--ready {
      border-color: rgba(200, 150, 58, 0.24);
    }
  }

  .feed-card-slot {
    min-height: 100%;
    height: 100%;
    scroll-snap-align: start;
    scroll-snap-stop: normal;
    padding: 0 12px max(12px, env(safe-area-inset-bottom, 12px));
    display: flex;
    flex-direction: column;
    overflow-anchor: none;
  }

  .feed-card-slot[data-divider='true'] {
    min-height: auto;
    height: auto;
    scroll-snap-align: none;
    scroll-snap-stop: normal;
    padding-top: 20px;
  }

  @media (max-height: 640px) {
    .feed-card-slot {
      padding-inline: 10px;
      padding-bottom: max(10px, env(safe-area-inset-bottom, 10px));
    }

    .feed-card-slot[data-divider='true'] {
      padding-top: 16px;
    }
  }

  @media (orientation: landscape) and (max-height: 640px) {
    .feed-card-slot {
      padding-inline: 8px;
      padding-bottom: max(8px, env(safe-area-inset-bottom, 8px));
    }

    .feed-card-slot[data-divider='true'] {
      padding-top: 12px;
    }
  }
</style>
