<script lang="ts">
  import { onDestroy } from 'svelte';
  import { reactions, toggleReaction } from '../stores/reader';

  interface Props {
    issueId: string;
    cardIndex: number;
  }
  let { issueId, cardIndex }: Props = $props();

  let reactionRaw = $state('{}');
  $effect(() => {
    const unsub = reactions.subscribe((value) => {
      reactionRaw = value;
    });
    return unsub;
  });

  let reactionMap = $derived.by(() => {
    try {
      return JSON.parse(reactionRaw) as Record<string, number[]>;
    } catch {
      return {};
    }
  });

  let reacted = $derived((reactionMap[issueId]?.includes(cardIndex) ?? false));

  let animPhase = $state<'idle' | 'burst' | 'settle'>('idle');
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  function clearAnimTimers() {
    if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  }

  onDestroy(clearAnimTimers);

  function handleClick(event: MouseEvent) {
    event.stopPropagation();
    const nextReacted = toggleReaction(issueId, cardIndex);
    if (!nextReacted) {
      animPhase = 'idle';
      return;
    }

    // Burst animation
    clearAnimTimers();
    animPhase = 'burst';
    settleTimer = setTimeout(() => { animPhase = 'settle'; }, 400);
    idleTimer = setTimeout(() => { animPhase = 'idle'; }, 800);

    try { navigator.vibrate?.(8); } catch {}
  }
</script>

<button
  class="save-btn"
  class:save-btn--reacted={reacted}
  class:save-btn--burst={animPhase === 'burst'}
  class:save-btn--settle={animPhase === 'settle'}
  onclick={handleClick}
  aria-pressed={reacted}
  aria-label={reacted ? 'Remove highlight from this insight' : 'Highlight this insight'}
>
  <!-- Burst ring (visible only during animation) -->
  {#if animPhase === 'burst' || animPhase === 'settle'}
    <div class="burst-ring"></div>
  {/if}

  <svg aria-hidden="true" class="save-icon" width="16" height="16" viewBox="0 0 24 24" fill={reacted ? 'var(--highlight-accent, var(--score-warning))' : 'none'} stroke={reacted ? 'var(--highlight-accent, var(--score-warning))' : 'var(--text-faint)'} stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
  </svg>
  <span class="save-label">{reacted ? 'Highlighted' : 'Highlight'}</span>
</button>

<style>
  .save-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 44px;
    min-height: 44px;
    padding: 0 12px;
    border-radius: var(--radius-pill);
    background: transparent;
    border: 1px solid var(--border-subtle);
    cursor: pointer;
    transition: background 0.2s ease-out, border-color 0.2s ease-out;
    overflow: visible;
  }

  @media (hover: hover) {
    .save-btn:hover {
      background: var(--bg-sunken);
    }

    .save-btn--reacted:hover {
      background: var(--highlight-bg-strong, rgba(184, 92, 0, 0.12));
    }
  }

  .save-btn--reacted {
    background: var(--highlight-bg, rgba(184, 92, 0, 0.08));
    border-color: var(--highlight-accent, var(--score-warning));
  }

  /* Heart icon animation */
  .save-icon {
    transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), fill 0.2s ease-out;
    flex-shrink: 0;
  }

  .save-btn--burst .save-icon {
    transform: scale(1.4);
  }

  .save-btn--settle .save-icon {
    transform: scale(1);
  }

  /* Burst ring — expands outward and fades */
  .burst-ring {
    position: absolute;
    inset: -4px;
    border-radius: var(--radius-pill);
    border: 2px solid var(--highlight-accent, var(--score-warning));
    animation: burstExpand 0.5s ease-out forwards;
    pointer-events: none;
  }

  .save-label {
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--text-secondary);
    white-space: nowrap;
  }

  @keyframes burstExpand {
    0% {
      inset: 2px;
      opacity: 0.8;
    }
    100% {
      inset: -14px;
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .save-icon {
      transition: none;
    }
    .burst-ring {
      animation: none;
      display: none;
    }
  }
</style>
