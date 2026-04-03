<script lang="ts">
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

  function handleClick(event: MouseEvent) {
    event.stopPropagation();
    const nextReacted = toggleReaction(issueId, cardIndex);
    if (!nextReacted) {
      animPhase = 'idle';
      return;
    }

    // Burst animation
    animPhase = 'burst';
    setTimeout(() => { animPhase = 'settle'; }, 400);
    setTimeout(() => { animPhase = 'idle'; }, 800);

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

  <svg class="heart-icon" width="16" height="16" viewBox="0 0 24 24" fill={reacted ? 'var(--highlight-accent, var(--score-warning))' : 'none'} stroke={reacted ? 'var(--highlight-accent, var(--score-warning))' : 'var(--text-faint)'} stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
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
    border-radius: 999px;
    background: transparent;
    border: 1px solid var(--border-subtle);
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
    overflow: visible;
  }

  .save-btn:hover {
    background: var(--bg-sunken);
  }

  .save-btn--reacted {
    background: var(--highlight-bg, rgba(184, 92, 0, 0.08));
    border-color: var(--highlight-accent, var(--score-warning));
  }

  .save-btn--reacted:hover {
    background: var(--highlight-bg-strong, rgba(184, 92, 0, 0.12));
  }

  /* Heart icon animation */
  .heart-icon {
    transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), fill 0.15s ease;
    flex-shrink: 0;
  }

  .save-btn--burst .heart-icon {
    transform: scale(1.4);
  }

  .save-btn--settle .heart-icon {
    transform: scale(1);
  }

  /* Burst ring — expands outward and fades */
  .burst-ring {
    position: absolute;
    inset: -4px;
    border-radius: 999px;
    border: 2px solid var(--highlight-accent, var(--score-warning));
    animation: burstExpand 0.5s ease-out forwards;
    pointer-events: none;
  }

  .save-label {
    font-size: 12px;
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
    .heart-icon {
      transition: none;
    }
    .burst-ring {
      animation: none;
      display: none;
    }
  }
</style>
