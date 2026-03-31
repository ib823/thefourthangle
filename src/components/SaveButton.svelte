<script lang="ts">
  import { hasReacted, addReaction } from '../stores/reader';

  interface Props {
    issueId: string;
    cardIndex: number;
  }
  let { issueId, cardIndex }: Props = $props();

  let sessionReactions = $state(new Set<string>());

  let reacted = $derived(
    hasReacted(issueId, cardIndex) || sessionReactions.has(`${issueId}:${cardIndex}`)
  );

  let animPhase = $state<'idle' | 'burst' | 'settle'>('idle');

  function handleClick() {
    if (reacted) return;
    addReaction(issueId, cardIndex);
    sessionReactions = new Set([...sessionReactions, `${issueId}:${cardIndex}`]);

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
  aria-label={reacted ? 'You reacted to this insight' : 'React to this insight'}
>
  <!-- Burst ring (visible only during animation) -->
  {#if animPhase === 'burst' || animPhase === 'settle'}
    <div class="burst-ring"></div>
  {/if}

  <svg class="heart-icon" width="16" height="16" viewBox="0 0 24 24" fill={reacted ? 'var(--score-critical)' : 'none'} stroke={reacted ? 'var(--score-critical)' : 'var(--text-faint)'} stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
</button>

<style>
  .save-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border-radius: 50%;
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
    background: var(--score-critical-bg, rgba(224,49,49,0.06));
    border-color: var(--score-critical);
  }

  .save-btn--reacted:hover {
    background: var(--score-critical-bg, rgba(224,49,49,0.1));
  }

  /* Heart icon animation */
  .heart-icon {
    transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), fill 0.15s ease;
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
    border-radius: 50%;
    border: 2px solid var(--score-critical);
    animation: burstExpand 0.5s ease-out forwards;
    pointer-events: none;
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
