<script lang="ts">
  import { onMount } from 'svelte';
  import MobileCard from './MobileCard.svelte';
  import MobileSectionDivider from './MobileSectionDivider.svelte';
  import { readIssues, savePosition, reactions, savedIssues } from '../stores/reader';
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
  }
  let { issues, sections = [], onOpenIssue, onPrefetch, issueHasConnections, initialFeedIndex = 0, searchQuery = '', sortMode = 'latest', onSortChange }: Props = $props();

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

  // DOM refs
  let containerEl: HTMLDivElement | undefined = $state();

  // Intersection observer for tracking current card
  let observer: IntersectionObserver | undefined;
  let lastSnappedIndex = current;
  let swipeSuppressUntil = 0;
  let touchStartY = 0;
  let touchStartX = 0;
  let touchTracking = false;

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

  function scrollToDisplayIndex(index: number, behavior: ScrollBehavior = 'smooth') {
    if (!containerEl) return;
    const normalized = normalizeIssueDisplayIndex(index);
    const el = containerEl.querySelector(`[data-idx="${normalized}"]`) as HTMLElement | null;
    if (!el) return;
    current = normalized;
    lastSnappedIndex = normalized;
    el.scrollIntoView({ behavior, block: 'start' });
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

  function onTouchStart(event: TouchEvent) {
    if (!containerEl || sections.length === 0 || event.touches.length !== 1) return;
    const touch = event.touches[0];
    touchTracking = true;
    touchStartY = touch.clientY;
    touchStartX = touch.clientX;
  }

  function onTouchEnd(event: TouchEvent) {
    if (!touchTracking || !containerEl || sections.length === 0 || event.changedTouches.length === 0) {
      touchTracking = false;
      return;
    }

    touchTracking = false;
    const touch = event.changedTouches[0];
    const deltaY = touch.clientY - touchStartY;
    const deltaX = touch.clientX - touchStartX;

    if (Math.abs(deltaY) < 48) return;
    if (Math.abs(deltaY) < Math.abs(deltaX) * 1.2) return;

    swipeSuppressUntil = performance.now() + 350;
    if (deltaY < 0) scrollToAdjacentIssue(1);
    else scrollToAdjacentIssue(-1);
  }

  function onTouchCancel() {
    touchTracking = false;
  }

  onMount(() => {
    requestAnimationFrame(() => { mounted = true; });

    // Scroll to initial position
    if (containerEl) {
      const initialDisplayIndex = normalizeIssueDisplayIndex(getDisplayIndexForIssueIndex(initialFeedIndex));
      current = initialDisplayIndex;
      lastSnappedIndex = initialDisplayIndex;
      const slot = containerEl.querySelector(`[data-idx="${initialDisplayIndex}"]`) as HTMLElement | null;
      slot?.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'start' });
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

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      observer?.disconnect();
    };
  });

  // Re-setup observer when display list changes
  $effect(() => {
    void displayList.length;
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
  ontouchend={onTouchEnd}
  ontouchcancel={onTouchCancel}
>
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
          isSaved={isSaved(item.issue.id)}
          hasConnections={issueHasConnections?.(item.issue.id) ?? false}
          eager={i === 0 || i === 1}
        />
      </div>
    {/if}
  {/each}
</div>

<style>
  .feed-scroll {
    overflow-y: auto;
    scroll-snap-type: y proximity;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: auto;
    scroll-behavior: smooth;
    touch-action: pan-y;
    padding-bottom: env(safe-area-inset-bottom, 0);
  }

  .feed-card-slot {
    min-height: 100%;
    height: 100%;
    scroll-snap-align: start;
    scroll-snap-stop: normal;
    padding: 0 12px max(12px, env(safe-area-inset-bottom, 12px));
    display: flex;
    flex-direction: column;
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
