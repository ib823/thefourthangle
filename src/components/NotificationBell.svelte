<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getNotifications, getUnreadCount, markAsRead, markAllAsRead, type NotificationItem } from '../stores/notifications';

  let open = $state(false);
  let items = $state<NotificationItem[]>([]);
  let unread = $state(0);

  // Cleanup references
  let swListener: ((e: MessageEvent) => void) | null = null;
  let visListener: (() => void) | null = null;

  onMount(() => {
    refresh();

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

  function refresh() {
    items = getNotifications();
    unread = getUnreadCount();
  }

  function toggle() {
    open = !open;
  }

  function close() {
    open = false;
  }

  function handleItemClick(item: NotificationItem) {
    markAsRead(item.id);
    open = false;
    refresh();
    if (item.url) {
      window.location.href = item.url;
    }
  }

  function handleMarkAllRead() {
    markAllAsRead();
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
    onclick={toggle}
    style="background:none;border:none;cursor:pointer;padding:8px;min-height:44px;min-width:44px;display:flex;align-items:center;justify-content:center;position:relative;border-radius:8px;transition:background 0.15s ease;"
    aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary, #6C757D)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
    {#if unread > 0}
      <span style="position:absolute;top:4px;right:4px;width:16px;height:16px;background:var(--score-critical, #E03131);color:#fff;font-family:var(--font-display, sans-serif);font-size:10px;font-weight:700;border-radius:50%;display:flex;align-items:center;justify-content:center;line-height:1;">{unread > 9 ? '9+' : unread}</span>
    {/if}
  </button>

  {#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div onclick={close} role="presentation" style="position:fixed;inset:0;z-index:1999;" />
    <div style="position:absolute;top:100%;right:0;width:min(320px, calc(100vw - 16px));max-height:min(400px, 50vh);overflow-y:auto;background:var(--bg, #fff);border:1px solid var(--border-subtle, #E9ECEF);border-radius:12px;box-shadow:var(--shadow-lg, 0 8px 30px rgba(0,0,0,0.08));z-index:2000;margin-top:4px;">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border-subtle, #E9ECEF);">
        <span style="font-family:var(--font-display, sans-serif);font-size:14px;font-weight:700;color:var(--text-primary, #212529);">Notifications</span>
        {#if unread > 0}
          <button onclick={handleMarkAllRead} style="background:none;border:none;cursor:pointer;font-family:var(--font-body, sans-serif);font-size:12px;color:var(--focus, #1971C2);padding:8px;min-height:44px;display:flex;align-items:center;">Mark all read</button>
        {/if}
      </div>

      {#if items.length === 0}
        <div style="padding:32px 16px;text-align:center;">
          <p style="font-family:var(--font-body, sans-serif);font-size:13px;color:var(--text-tertiary, #6C757D);margin:0;">No notifications yet</p>
        </div>
      {:else}
        {#each items.slice(0, 20) as item}
          <button
            onclick={() => handleItemClick(item)}
            style="width:100%;text-align:left;background:{item.read ? 'var(--bg, #fff)' : 'var(--bg-elevated, #F8F9FA)'};border:none;border-bottom:1px solid var(--border-light, rgba(0,0,0,0.05));padding:12px 16px;cursor:pointer;display:flex;flex-direction:column;gap:4px;transition:background 0.15s ease;min-height:44px;"
          >
            <div style="display:flex;align-items:center;gap:8px;">
              {#if !item.read}
                <div style="width:6px;height:6px;border-radius:50%;background:var(--score-info, #1971C2);flex-shrink:0;"></div>
              {/if}
              <span style="font-family:var(--font-display, sans-serif);font-size:13px;font-weight:{item.read ? '500' : '700'};color:var(--text-primary, #212529);line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">{item.title}</span>
              <span style="font-family:var(--font-body, sans-serif);font-size:11px;color:var(--text-muted, #868E96);flex-shrink:0;">{timeAgo(item.timestamp)}</span>
            </div>
            <p style="font-family:var(--font-body, sans-serif);font-size:12px;color:var(--text-tertiary, #6C757D);margin:0;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;{!item.read ? 'padding-left:14px;' : ''}">{item.body}</p>
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>
