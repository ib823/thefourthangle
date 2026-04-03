<script lang="ts">
  import { onMount } from 'svelte';

  let deferredPrompt: any = null;
  let showButton = $state(false);
  let isInstalled = $state(false);
  let isIOS = $state(false);
  let showIOSGuide = $state(false);

  onMount(() => {
    // Detect if already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      isInstalled = true;
      return;
    }

    // Detect iOS (no beforeinstallprompt support)
    const ua = navigator.userAgent;
    isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isIOS) {
      // Only show iOS guide if not already dismissed recently
      const dismissed = localStorage.getItem('tfa-install-dismissed');
      if (!dismissed || Date.now() - parseInt(dismissed) > 30 * 24 * 60 * 60 * 1000) {
        showButton = true;
      }
      return;
    }

    // Chromium browsers: capture the install prompt
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;
      showButton = true;
    });

    window.addEventListener('appinstalled', () => {
      isInstalled = true;
      showButton = false;
      deferredPrompt = null;
    });
  });

  async function install() {
    if (isIOS) {
      showIOSGuide = !showIOSGuide;
      return;
    }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      showButton = false;
    }
    deferredPrompt = null;
  }

  function dismiss() {
    showButton = false;
    localStorage.setItem('tfa-install-dismissed', String(Date.now()));
  }
</script>

{#if showButton && !isInstalled}
  <button
    onclick={install}
    style="background:none;border:none;cursor:pointer;padding:8px;min-height:44px;min-width:44px;display:flex;align-items:center;justify-content:center;border-radius: var(--radius-md);transition:background 0.15s ease;position:relative;"
    aria-label="Install app"
    title="Install The Fourth Angle"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  </button>

  {#if showIOSGuide}
    <div style="position:absolute;top:100%;right:0;width:280px;background:var(--bg);border:1px solid var(--border-subtle);border-radius: var(--radius-lg);box-shadow:var(--shadow-lg);z-index:2000;margin-top:4px;padding:16px;">
      <p style="font-family:var(--font-display);font-size: var(--text-body);font-weight:700;color:var(--text-primary);margin:0 0 8px 0;">Install The Fourth Angle</p>
      <p style="font-family:var(--font-body);font-size: var(--text-ui);color:var(--text-secondary);margin:0 0 12px 0;line-height:1.5;">
        Tap the share button <span style="font-size: var(--text-body-lg);">&#x2191;</span> in Safari, then tap <strong>"Add to Home Screen"</strong>.
      </p>
      <button onclick={dismiss} style="font-family:var(--font-body);font-size: var(--text-sm);color:var(--text-tertiary);background:none;border:none;cursor:pointer;padding:4px 0;">Dismiss</button>
    </div>
  {/if}
{/if}
