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
  let current = $state(Math.min(initialFeedIndex, Math.max(0, issues.length - 1)));
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

  onMount(() => {
    requestAnimationFrame(() => { mounted = true; });

    // Scroll to initial position
    if (containerEl && initialFeedIndex > 0) {
      const slot = containerEl.querySelector(`[data-idx="${initialFeedIndex}"]`) as HTMLElement;
      if (slot) {
        slot.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
      }
    }

    // Set up IntersectionObserver after initial scroll
    requestAnimationFrame(setupObserver);

    // Keyboard navigation
    function onKeyDown(e: KeyboardEvent) {
      if (!containerEl) return;
      if (e.key === 'ArrowDown' && current < displayList.length - 1) {
        e.preventDefault();
        // Skip dividers
        let next = current + 1;
        while (next < displayList.length && displayList[next].type === 'divider') next++;
        if (next < displayList.length) {
          const el = containerEl.querySelector(`[data-idx="${next}"]`) as HTMLElement;
          el?.scrollIntoView({ behavior: 'smooth' });
        }
      } else if (e.key === 'ArrowUp' && current > 0) {
        e.preventDefault();
        let prev = current - 1;
        while (prev >= 0 && displayList[prev].type === 'divider') prev--;
        if (prev >= 0) {
          const el = containerEl.querySelector(`[data-idx="${prev}"]`) as HTMLElement;
          el?.scrollIntoView({ behavior: 'smooth' });
        }
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
    requestAnimationFrame(setupObserver);
  });
</script>

<div
  bind:this={containerEl}
  class="feed-scroll"
  style="flex:1;opacity:{mounted ? 1 : 0};transition:opacity 0.15s ease;"
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
          onOpen={() => handleOpenIssue(item.issue)}
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
