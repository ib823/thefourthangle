<script lang="ts">
  import { onMount } from 'svelte';

  const VAPID_PUBLIC_KEY = 'BM2IpaheS2aS1-Fs6_EBmsWuSUZ09aYkndax5C9XKTd0qJzKUKRz1cYFb78yjtM8d_sEf0koC2wrUbOTSaY7GK4';
  const NOTIFY_API = 'https://tfa-notify.4thangle.workers.dev';

  let showPrompt = $state(false);
  let subscribed = $state(false);
  let denied = $state(false);
  let unsupported = $state(false);

  onMount(() => {
    // Feature detection — skip entirely on unsupported platforms
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      unsupported = true;
      return;
    }

    // iOS Safari (non-PWA) does not support Web Push — skip
    // iOS PWA (standalone mode) supports Web Push since Safari 16.4+
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isIOS && !isStandalone) {
      unsupported = true;
      return;
    }

    // Check current browser permission (not localStorage — allows recovery)
    if (Notification.permission === 'denied') { denied = true; return; }
    if (Notification.permission === 'granted' || localStorage.getItem('tfa-push-subscribed') === 'true') {
      subscribed = true;
      return;
    }

    // Cooldown after dismiss
    const dismissed = localStorage.getItem('tfa-push-dismissed');
    if (dismissed && Date.now() - parseInt(dismissed, 10) < 7 * 24 * 60 * 60 * 1000) return;

    // Only show after user has completed at least 1 issue
    try {
      const readKeys = Object.keys(localStorage).filter(k => k.startsWith('tfa-read:'));
      const completedCount = readKeys.filter(k => {
        try { return JSON.parse(localStorage.getItem(k) || '').state === 'completed'; } catch { return false; }
      }).length;
      if (completedCount >= 1) showPrompt = true;
    } catch {
      // localStorage unavailable (private browsing) — skip
    }
  });

  function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const arr = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
    return arr;
  }

  async function subscribe() {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'denied') {
        denied = true;
        showPrompt = false;
        return;
      }
      if (permission !== 'granted') {
        // User clicked "Ask Later" / default — don't mark as denied
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      if (!reg.pushManager) {
        unsupported = true;
        showPrompt = false;
        return;
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });

      const resp = await fetch(NOTIFY_API + '/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!resp.ok) throw new Error(`Subscribe failed: ${resp.status}`);

      subscribed = true;
      try {
        localStorage.setItem('tfa-push-subscribed', 'true');
        localStorage.setItem('tfa-push-endpoint', subscription.endpoint);
      } catch {}
      showPrompt = false;
    } catch (e) {
      console.error('Push subscription failed:', e);
    }
  }

  function dismiss() {
    showPrompt = false;
    try { localStorage.setItem('tfa-push-dismissed', String(Date.now())); } catch {}
  }
</script>

{#if showPrompt && !subscribed && !denied && !unsupported}
  <div style="background:var(--card, #FFFDF9);border:1px solid var(--border-light, rgba(0,0,0,0.05));border-radius: var(--radius-lg);padding:16px;margin-top:16px;display:flex;flex-direction:column;gap:12px;">
    <div style="display:flex;align-items:center;gap:8px;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--amber, #7A5A12)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      <span style="font-family:var(--font-display, sans-serif);font-size: var(--text-body);font-weight:700;color:var(--text-primary, #212529);">Stay updated</span>
    </div>
    <p style="font-family:var(--font-body, sans-serif);font-size: var(--text-ui);line-height:1.5;color:var(--text-secondary, #495057);margin:0;">Get notified when new issues drop. Max 3/week. Unsubscribe anytime.</p>
    <div style="display:flex;gap:8px;">
      <button
        onclick={subscribe}
        style="flex:1;padding:10px 16px;background:var(--text-primary, #212529);color:var(--bg, #fff);border:none;border-radius: var(--radius-md);font-family:var(--font-display, sans-serif);font-size: var(--text-ui);font-weight:600;cursor:pointer;min-height:44px;"
        aria-label="Enable push notifications"
      >Notify me</button>
      <button
        onclick={dismiss}
        style="padding:10px 16px;background:var(--bg-elevated, #F8F9FA);color:var(--text-tertiary, #6C757D);border:1px solid var(--border-subtle, #E9ECEF);border-radius: var(--radius-md);font-family:var(--font-body, sans-serif);font-size: var(--text-ui);cursor:pointer;min-height:44px;"
        aria-label="Dismiss notification prompt"
      >Not now</button>
    </div>
  </div>
{/if}
