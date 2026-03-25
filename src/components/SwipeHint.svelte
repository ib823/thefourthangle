<script lang="ts">
  import { onMount } from 'svelte';

  let dismissed = $state(false);
  let mounted = $state(false);

  onMount(() => {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('fa-swipe-hint-seen')) {
      dismissed = true;
    } else {
      mounted = true;
    }
  });

  function dismiss() {
    dismissed = true;
    try { localStorage.setItem('fa-swipe-hint-seen', '1'); } catch {}
  }
</script>

{#if mounted && !dismissed}
  <div
    onclick={dismiss}
    onpointerdown={dismiss}
    role="presentation"
    style="position:fixed;inset:0;background:rgba(27,22,16,0.65);z-index:200;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;cursor:pointer;transition:opacity 0.3s ease;padding:0 40px;"
  >
    <div style="animation:swipeAnim 1.5s ease-in-out infinite;">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="20" stroke="white" stroke-width="1.5" opacity="0.3"/>
        <path d="M28 18l-8 6 8 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <span style="font-size:15px;color:white;font-weight:600;">Swipe or tap to navigate</span>
    <p style="font-size:12px;color:rgba(255,255,255,0.7);text-align:center;line-height:1.6;margin:0;max-width:280px;">Each issue in 6 cards: the framing, three evidence angles, the perspective nobody's giving you, and the considered view.</p>
  </div>
{/if}

<style>
  @keyframes swipeAnim {
    0%, 100% { transform: translateX(0); opacity: 0.7; }
    50% { transform: translateX(-20px); opacity: 1; }
  }
</style>
