<script lang="ts">
  import { hasReacted, addReaction } from '../stores/reader';

  interface Props {
    issueId: string;
    cardIndex: number;
  }
  let { issueId, cardIndex }: Props = $props();

  // Track which issue+card combos were reacted to in this session
  let sessionReactions = $state(new Set<string>());

  // Re-derive from store whenever issueId or cardIndex changes
  let reacted = $derived(
    hasReacted(issueId, cardIndex) || sessionReactions.has(`${issueId}:${cardIndex}`)
  );
  let scale = $state(1);

  function handleClick() {
    if (reacted) return;
    addReaction(issueId, cardIndex);
    sessionReactions = new Set([...sessionReactions, `${issueId}:${cardIndex}`]);
    scale = 1.15;
    setTimeout(() => { scale = 1; }, 250);
    try { navigator.vibrate?.(8); } catch {}
  }
</script>

<button
  onclick={handleClick}
  style="
    display:flex;align-items:center;gap:4px;
    padding:6px 10px;border-radius:16px;
    background:{reacted ? 'var(--score-critical-bg, rgba(224,49,49,0.08))' : 'transparent'};
    border:1px solid {reacted ? 'var(--score-critical)' : 'var(--border-subtle)'};
    cursor:pointer;
    transform:scale({scale});
    transition:transform 0.25s cubic-bezier(.175,.885,.32,1.275), background 0.15s ease, border-color 0.15s ease;
    min-height:44px;
  "
  aria-label={reacted ? 'You reacted to this insight' : 'React to this insight'}
>
  <svg width="14" height="14" viewBox="0 0 24 24" fill={reacted ? 'var(--score-critical)' : 'none'} stroke={reacted ? 'var(--score-critical)' : 'var(--text-faint)'} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition:fill 0.15s ease,transform 0.25s cubic-bezier(.175,.885,.32,1.275);transform:scale({reacted && scale > 1 ? 1.3 : 1});">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
</button>
