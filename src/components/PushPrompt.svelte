<script lang="ts">
  import { onMount } from 'svelte';

  const VAPID_PUBLIC_KEY = 'BC4OHktzXFQlu1GclVNzYvWJhPUSiBsUVivd2r0bG2CUf6clO1WZoIfHsl_ScIvtqH1tzb5YwuHeD66O1TofboM';
  const NOTIFY_API = 'https://tfa-notify.4thangle.workers.dev';

  let showPrompt = $state(false);
  let subscribed = $state(false);
  let denied = $state(false);

  onMount(() => {
    // Don't show if already subscribed, denied, or dismissed recently
    if (localStorage.getItem('tfa-push-subscribed') === 'true') { subscribed = true; return; }
    if (localStorage.getItem('tfa-push-denied') === 'true') { denied = true; return; }
    if (Notification.permission === 'denied') { denied = true; return; }
    if (Notification.permission === 'granted') { subscribed = true; return; }

    const dismissed = localStorage.getItem('tfa-push-dismissed');
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return; // 7 day cooldown

    // Only show after user has completed at least 1 issue
    const readKeys = Object.keys(localStorage).filter(k => k.startsWith('tfa-read:'));
    const completedCount = readKeys.filter(k => {
      try { return JSON.parse(localStorage.getItem(k) || '').state === 'completed'; } catch { return false; }
    }).length;

    if (completedCount >= 1) {
      showPrompt = true;
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
      if (permission !== 'granted') {
        denied = true;
        localStorage.setItem('tfa-push-denied', 'true');
        showPrompt = false;
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Send to backend
      await fetch(NOTIFY_API + '/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });

      // Send initial heartbeat
      if (reg.active) {
        reg.active.postMessage({ type: 'HEARTBEAT', endpoint: subscription.endpoint });
      }

      subscribed = true;
      localStorage.setItem('tfa-push-subscribed', 'true');
      localStorage.setItem('tfa-push-endpoint', subscription.endpoint);
      showPrompt = false;
    } catch (e) {
      console.error('Push subscription failed:', e);
      showPrompt = false;
    }
  }

  function dismiss() {
    showPrompt = false;
    localStorage.setItem('tfa-push-dismissed', String(Date.now()));
  }
</script>

{#if showPrompt && !subscribed && !denied}
  <div style="background:var(--card);border:1px solid var(--border-light);border-radius:12px;padding:16px;margin-top:16px;display:flex;flex-direction:column;gap:12px;">
    <div style="display:flex;align-items:center;gap:8px;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      <span style="font-family:var(--font-display);font-size:14px;font-weight:700;color:var(--text-primary);">Stay updated</span>
    </div>
    <p style="font-family:var(--font-body);font-size:13px;line-height:1.5;color:var(--text-secondary);margin:0;">Get notified when new issues drop. Max 3/week. Unsubscribe anytime.</p>
    <div style="display:flex;gap:8px;">
      <button
        onclick={subscribe}
        style="flex:1;padding:10px 16px;background:var(--text-primary);color:var(--bg);border:none;border-radius:10px;font-family:var(--font-display);font-size:13px;font-weight:600;cursor:pointer;min-height:44px;"
      >Notify me</button>
      <button
        onclick={dismiss}
        style="padding:10px 16px;background:var(--bg-elevated);color:var(--text-tertiary);border:1px solid var(--border-subtle);border-radius:10px;font-family:var(--font-body);font-size:13px;cursor:pointer;min-height:44px;"
      >Not now</button>
    </div>
  </div>
{/if}
