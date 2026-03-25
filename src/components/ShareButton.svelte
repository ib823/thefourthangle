<script lang="ts">
  let showToast = $state(false);

  async function share() {
    const url = window.location.href;
    const title = document.title;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      showToast = true;
      setTimeout(() => { showToast = false; }, 1500);
    }
  }
</script>

<div style="position:relative;">
  <button onclick={share} style="background:none;border:none;cursor:pointer;padding:8px;min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;" aria-label="Share this insight">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
    </svg>
  </button>
  {#if showToast}
    <div style="position:absolute;bottom:48px;left:50%;transform:translateX(-50%);background:var(--card-dark);color:var(--text-on-dark);font-size:12px;padding:6px 12px;border-radius:6px;white-space:nowrap;animation:fadeInOut 1.5s ease forwards;">
      Copied!
    </div>
  {/if}
</div>

<style>
  @keyframes fadeInOut {
    0% { opacity: 0; transform: translateX(-50%) translateY(4px); }
    15% { opacity: 1; transform: translateX(-50%) translateY(0); }
    75% { opacity: 1; }
    100% { opacity: 0; }
  }
</style>
