<script lang="ts">
  import { onMount } from 'svelte';
  import MobileCard from './MobileCard.svelte';
  import { readIssues, savePosition, getReactions } from '../stores/reader';
  import { haptic } from '../lib/animation';

  import type { IssueSummary } from '../lib/issues-loader';

  interface Props {
    issues: IssueSummary[];
    onOpenIssue: (issue: IssueSummary, originRect?: DOMRect) => void;
    onPrefetch?: (issue: IssueSummary) => void;
    initialFeedIndex?: number;
  }
  let { issues, onOpenIssue, onPrefetch, initialFeedIndex = 0 }: Props = $props();

  let mounted = $state(false);
  let current = $state(Math.min(initialFeedIndex, Math.max(0, issues.length - 1)));
  let readMap: Record<string, string> = $state({});
  let reactionMap = $derived(getReactions());

  function hasReaction(issueId: string): boolean {
    return (reactionMap[issueId]?.length ?? 0) > 0;
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
        if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
          const slot = entry.target as HTMLElement;
          const idx = Number(slot.dataset.idx);
          if (!isNaN(idx) && idx !== lastSnappedIndex) {
            lastSnappedIndex = idx;
            current = idx;
            haptic(5);
            if (issues[idx]) {
              savePosition(issues[idx].id, 0);
            }
          }
        }
      }
    }, { threshold: 0.5, root: containerEl });

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
      if (e.key === 'ArrowDown' && current < issues.length - 1) {
        e.preventDefault();
        const next = containerEl.querySelector(`[data-idx="${current + 1}"]`) as HTMLElement;
        next?.scrollIntoView({ behavior: 'smooth' });
      } else if (e.key === 'ArrowUp' && current > 0) {
        e.preventDefault();
        const prev = containerEl.querySelector(`[data-idx="${current - 1}"]`) as HTMLElement;
        prev?.scrollIntoView({ behavior: 'smooth' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleOpenIssue(issues[current]);
      }
    }
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      observer?.disconnect();
    };
  });

  // Re-setup observer when issues change
  $effect(() => {
    void issues.length;
    requestAnimationFrame(setupObserver);
  });
</script>

<div
  bind:this={containerEl}
  class="feed-scroll"
  style="flex:1;opacity:{mounted ? 1 : 0};transition:opacity 0.15s ease;"
>
  {#each issues as issue, i (issue.id)}
    <div
      class="feed-card-slot"
      data-idx={i}
    >
      <MobileCard
        issue={issue}
        readState={getState(issue.id)}
        onOpen={() => handleOpenIssue(issue)}
        onPrefetch={() => onPrefetch?.(issue)}
        hasReaction={hasReaction(issue.id)}
      />
    </div>
  {/each}
</div>

<style>
  .feed-scroll {
    overflow-y: auto;
    scroll-snap-type: y mandatory;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain;
    scroll-behavior: smooth;
  }

  .feed-card-slot {
    height: calc(100dvh - 52px);
    scroll-snap-align: start;
    scroll-snap-stop: always;
    padding: 0 12px max(12px, env(safe-area-inset-bottom, 12px));
    display: flex;
    flex-direction: column;
  }
</style>
