<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getNotifications, getUnreadCount, markAsRead, markAllAsRead, removeNotification, clearAll, type NotificationItem } from '../stores/notifications';

  const VAPID_PUBLIC_KEY = 'BM2IpaheS2aS1-Fs6_EBmsWuSUZ09aYkndax5C9XKTd0qJzKUKRz1cYFb78yjtM8d_sEf0koC2wrUbOTSaY7GK4';
  const NOTIFY_API = 'https://tfa-notify.4thangle.workers.dev';

  let open = $state(false);
  let items = $state<NotificationItem[]>([]);
  let unread = $state(0);
  let triggerEl: HTMLButtonElement | undefined = $state(undefined);
  let panelEl: HTMLDivElement | undefined = $state(undefined);

  // Push subscription state
  let pushSupported = $state(false);
  let pushSubscribed = $state(false);
  let pushDenied = $state(false);
  let pushLoading = $state(false);
  const panelId = 'notifications-panel';

  // Cleanup references
  let swListener: ((e: MessageEvent) => void) | null = null;
  let visListener: (() => void) | null = null;

  onMount(() => {
    refresh();
    checkPushStatus();

    // Listen for new notifications from Service Worker
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      swListener = (e: MessageEvent) => {
        if (e.data?.type === 'NOTIFICATION_RECEIVED') refresh();
      };
      navigator.serviceWorker.addEventListener('message', swListener);
    }

    // Refresh on focus
    visListener = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', visListener);
  });

  onDestroy(() => {
    if (swListener && 'serviceWorker' in navigator) {
      navigator.serviceWorker.removeEventListener('message', swListener);
    }
    if (visListener) {
      document.removeEventListener('visibilitychange', visListener);
    }
  });

  function checkPushStatus() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      pushSupported = false;
      return;
    }
    // iOS Safari (non-PWA) doesn't support Web Push
    // iOS PWA (standalone mode) supports Web Push since Safari 16.4+
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isIOS && !isStandalone) { pushSupported = false; return; }

    pushSupported = true;
    if (Notification.permission === 'denied') { pushDenied = true; return; }
    if (Notification.permission === 'granted' || localStorage.getItem('tfa-push-subscribed') === 'true') {
      pushSubscribed = true;
    }
  }

  function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const arr = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
    return arr;
  }

  async function subscribePush() {
    if (pushLoading) return;
    pushLoading = true;
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'denied') { pushDenied = true; pushLoading = false; return; }
      if (permission !== 'granted') { pushLoading = false; return; }

      const reg = await navigator.serviceWorker.ready;
      if (!reg.pushManager) { pushSupported = false; pushLoading = false; return; }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const resp = await fetch(NOTIFY_API + '/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!resp.ok) throw new Error('Subscribe failed');

      pushSubscribed = true;
      try {
        localStorage.setItem('tfa-push-subscribed', 'true');
        localStorage.setItem('tfa-push-endpoint', subscription.endpoint);
      } catch {}
    } catch {
      // Silent failure — user can retry
    }
    pushLoading = false;
  }

  async function unsubscribePush() {
    if (pushLoading) return;
    pushLoading = true;
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        // Notify server
        await fetch(NOTIFY_API + '/api/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        }).catch(() => {});
      }

      pushSubscribed = false;
      try {
        localStorage.removeItem('tfa-push-subscribed');
        localStorage.removeItem('tfa-push-endpoint');
      } catch {}
    } catch {
      // Silent failure
    }
    pushLoading = false;
  }

  function refresh() {
    items = getNotifications();
    unread = getUnreadCount();
  }

  function toggle() {
    open = !open;
    if (open) {
      requestAnimationFrame(() => {
        const firstAction = panelEl?.querySelector<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])');
        (firstAction ?? panelEl)?.focus();
      });
    }
  }

  function close() {
    open = false;
    requestAnimationFrame(() => triggerEl?.focus());
  }

  function handleItemClick(item: NotificationItem) {
    markAsRead(item.id);
    open = false;
    refresh();
    if (item.url) {
      // Extract issue ID from URL and use SPA navigation
      const issueMatch = item.url.match(/\/issue\/(\w+)/);
      if (issueMatch) {
        // Dispatch custom event so App.svelte can open the issue in-app
        window.dispatchEvent(new CustomEvent('t4a-open-issue', { detail: { issueId: issueMatch[1] } }));
      } else {
        window.location.href = item.url;
      }
    }
  }

  function handleRemoveItem(e: MouseEvent, item: NotificationItem) {
    e.stopPropagation();
    removeNotification(item.id);
    refresh();
  }

  function handleMarkAllRead() {
    markAllAsRead();
    refresh();
  }

  function handleClearAll() {
    clearAll();
    refresh();
  }

  function timeAgo(ts: number): string {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }
</script>

<svelte:window onkeydown={open ? onKeyDown : undefined} />

<div style="position:relative;">
  <button
    bind:this={triggerEl}
    onclick={toggle}
    style="background:{open ? 'var(--bg-sunken, #F1F3F5)' : 'none'};border:none;cursor:pointer;padding:8px;min-height:44px;min-width:44px;display:flex;align-items:center;justify-content:center;position:relative;border-radius: var(--radius-md);transition:background 0.2s ease-out;"
    aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
    aria-controls={panelId}
    aria-haspopup="dialog"
    aria-expanded={open}
  >
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill={open ? 'var(--text-primary, #212529)' : 'none'} stroke={open ? 'var(--text-primary, #212529)' : 'var(--text-tertiary, #6C757D)'} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition:fill 0.2s ease-out,stroke 0.2s ease-out;">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
    {#if unread > 0}
      <span style="position:absolute;top:4px;right:4px;width:16px;height:16px;background:var(--score-critical, #E03131);color:#fff;font-family:var(--font-display, sans-serif);font-size: var(--text-micro);font-weight:700;border-radius: var(--radius-round);display:flex;align-items:center;justify-content:center;line-height:1;">{unread > 9 ? '9+' : unread}</span>
    {/if}
  </button>

  {#if open}
    <button
      type="button"
      class="notifications-backdrop"
      onclick={close}
      aria-label="Close notifications panel"
    ></button>
    <div bind:this={panelEl} id={panelId} role="dialog" aria-modal="false" aria-label="Notifications" tabindex="-1" style="position:absolute;top:100%;right:0;width:min(320px, calc(100vw - 16px));max-height:min(400px, 50vh);overflow-y:auto;background:var(--bg, #fff);border:1px solid var(--border-subtle, #E9ECEF);border-radius: var(--radius-lg);box-shadow:var(--shadow-lg, 0 8px 30px rgba(0,0,0,0.08));z-index:2000;margin-top:4px;">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border-subtle, #E9ECEF);">
        <span style="font-family:var(--font-display, sans-serif);font-size: var(--text-body);font-weight:700;color:var(--text-primary, #212529);">Notifications</span>
        <div style="display:flex;align-items:center;gap:4px;">
          {#if unread > 0}
            <button onclick={handleMarkAllRead} style="background:none;border:none;cursor:pointer;font-family:var(--font-body, sans-serif);font-size: var(--text-sm);color:var(--focus, #1971C2);padding:8px;min-height:44px;display:flex;align-items:center;">Mark all read</button>
          {/if}
          {#if items.length > 0}
            <button onclick={handleClearAll} style="background:none;border:none;cursor:pointer;font-family:var(--font-body, sans-serif);font-size: var(--text-sm);color:var(--text-muted, #868E96);padding:8px;min-height:44px;display:flex;align-items:center;">Clear all</button>
          {/if}
        </div>
      </div>

      {#if items.length === 0}
        <div style="padding:24px 16px;text-align:center;">
          {#if pushSupported && !pushSubscribed && !pushDenied}
            <!-- Empty state with subscribe prompt -->
            <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint, #ADB5BD)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:8px;">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <p style="font-family:var(--font-display, sans-serif);font-size: var(--text-ui);font-weight:600;color:var(--text-primary, #212529);margin:0 0 4px 0;">Get notified</p>
            <p style="font-family:var(--font-body, sans-serif);font-size: var(--text-sm);color:var(--text-tertiary, #5C636A);margin:0 0 12px 0;line-height:1.4;">New issues delivered to your device. Max 3/week.</p>
            <button
              onclick={subscribePush}
              disabled={pushLoading}
              style="padding:8px 20px;background:var(--text-primary, #212529);color:var(--bg, #fff);border:none;border-radius: var(--radius-md);font-family:var(--font-display, sans-serif);font-size: var(--text-sm);font-weight:600;cursor:pointer;min-height:44px;opacity:{pushLoading ? 0.6 : 1};transition:opacity 0.2s ease-out;"
            >{pushLoading ? 'Enabling...' : 'Enable notifications'}</button>
          {:else if pushDenied}
            <p style="font-family:var(--font-body, sans-serif);font-size: var(--text-sm);color:var(--text-muted, #868E96);margin:0;line-height:1.4;">Notifications blocked. Enable in browser settings.</p>
          {:else}
            <p style="font-family:var(--font-body, sans-serif);font-size: var(--text-ui);color:var(--text-tertiary, #5C636A);margin:0;">No notifications yet</p>
          {/if}
        </div>
      {:else}
        {#each items.slice(0, 20) as item}
          <div
            class="notification-row"
            style="background:{item.read ? 'var(--bg, #fff)' : 'var(--bg-elevated, #F8F9FA)'};border-bottom:1px solid var(--border-light, rgba(0,0,0,0.05));"
          >
            <button
              type="button"
              onclick={() => handleItemClick(item)}
              style="flex:1;min-width:0;text-align:left;background:none;border:none;padding:12px 0 12px 16px;cursor:pointer;display:flex;flex-direction:column;gap:4px;transition:background 0.2s ease-out;min-height:44px;"
            >
              <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                {#if !item.read}
                  <div style="width:6px;height:6px;border-radius: var(--radius-round);background:var(--score-info, #1971C2);flex-shrink:0;"></div>
                {/if}
                <span style="font-family:var(--font-display, sans-serif);font-size: var(--text-ui);font-weight:{item.read ? '600' : '700'};color:var(--text-primary, #212529);line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;">{item.title}</span>
                <span style="font-family:var(--font-body, sans-serif);font-size: var(--text-xs);color:var(--text-muted, #868E96);flex-shrink:0;">{timeAgo(item.timestamp)}</span>
              </div>
              <p style="font-family:var(--font-body, sans-serif);font-size: var(--text-sm);color:var(--text-tertiary, #5C636A);margin:0;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;{!item.read ? 'padding-left:14px;' : ''}">{item.body}</p>
            </button>
            <button
              type="button"
              onclick={(e) => handleRemoveItem(e, item)}
              style="flex-shrink:0;padding:0;width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;background:none;border:none;cursor:pointer;color:var(--text-muted, #868E96);font-size: var(--text-body);line-height:1;"
              aria-label="Remove notification"
            >&times;</button>
          </div>
        {/each}
      {/if}

      <!-- Footer: subscription status -->
      {#if pushSupported}
        <div style="padding:10px 16px;border-top:1px solid var(--border-subtle, #E9ECEF);display:flex;align-items:center;justify-content:space-between;">
          {#if pushSubscribed}
            <span style="font-family:var(--font-body, sans-serif);font-size: var(--text-xs);color:var(--status-green, #2B8A3E);display:flex;align-items:center;gap:4px;">
              <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Notifications on
            </span>
            <button
              onclick={unsubscribePush}
              disabled={pushLoading}
              style="background:none;border:none;cursor:pointer;font-family:var(--font-body, sans-serif);font-size: var(--text-xs);color:var(--text-muted, #868E96);padding:6px 8px;min-height:44px;transition:color 0.2s ease-out;"
            >Turn off</button>
          {:else if !pushDenied}
            <span style="font-family:var(--font-body, sans-serif);font-size: var(--text-xs);color:var(--text-muted, #868E96);">Notifications off</span>
            <button
              onclick={subscribePush}
              disabled={pushLoading}
              style="background:none;border:none;cursor:pointer;font-family:var(--font-body, sans-serif);font-size: var(--text-xs);color:var(--focus, #1971C2);padding:6px 8px;min-height:44px;font-weight:600;"
            >{pushLoading ? 'Enabling...' : 'Turn on'}</button>
          {:else}
            <span style="font-family:var(--font-body, sans-serif);font-size: var(--text-xs);color:var(--text-muted, #868E96);">Blocked in browser settings</span>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .notifications-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1999;
    border: 0;
    background: transparent;
    padding: 0;
    cursor: default;
  }

  .notification-row {
    display: flex;
    align-items: stretch;
    width: 100%;
  }
</style>
