<script lang="ts">
  import { onMount } from 'svelte';

  let dismissed = $state(false);
  let mounted = $state(false);
  let fading = $state(false);

  onMount(() => {
    // Only show on first issue opened in this session
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('fa-swiped')) {
      dismissed = true;
    } else {
      mounted = true;
      // Auto-dismiss after 3 animation cycles (1.5s × 3 = 4.5s)
      setTimeout(() => {
        dismiss();
      }, 4500);
    }
  });

  function dismiss() {
    if (dismissed) return;
    fading = true;
    try { sessionStorage.setItem('fa-swiped', '1'); } catch {}
    setTimeout(() => { dismissed = true; }, 300);
  }
</script>

{#if mounted && !dismissed}
  <div
    onclick={dismiss}
    onpointerdown={dismiss}
    role="presentation"
    style="position:fixed;inset:0;background:rgba(27,22,16,0.65);z-index:200;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;cursor:pointer;opacity:{fading ? 0 : 1};transition:opacity 0.3s var(--ease-out-cubic, ease-out);padding:0 40px;"
  >
    <div style="animation:swipeAnim 1.5s var(--ease-in-out-sine, ease-in-out) 3;">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="20" stroke="white" stroke-width="1.5" opacity="0.3"/>
        <path d="M28 18l-8 6 8 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <span style="font-size:15px;color:white;font-weight:600;">Swipe or tap to navigate</span>
    <p style="font-size:13px;color:rgba(255,255,255,0.7);text-align:center;line-height:1.6;margin:0;max-width:280px;">Each issue in 6 cards: the framing, three evidence angles, the perspective nobody's giving you, and the considered view.</p>
  </div>
{/if}

<style>
  @keyframes swipeAnim {
    0%, 100% { transform: translateX(0); opacity: 0.7; }
    50% { transform: translateX(-20px); opacity: 1; }
  }
</style>
