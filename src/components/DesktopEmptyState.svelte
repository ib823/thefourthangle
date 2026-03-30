<script lang="ts">
  import { readIssues } from '../stores/reader';
  import { QUOTES } from '../data/quotes';

  interface Props {
    issueCount?: number;
  }
  let { issueCount = 0 }: Props = $props();

  // Pick a random quote on each mount — different every page load
  const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];

  let readCount = $state(0);
  $effect(() => {
    const unsub = readIssues.subscribe(val => {
      readCount = Object.values(val).filter(v => {
        if (!v) return false;
        if (v === 'true') return true;
        try { return JSON.parse(v).state === 'completed'; } catch { return false; }
      }).length;
    });
    return unsub;
  });

  let unread = $derived(Math.max(0, issueCount - readCount));
  let remaining = $derived(unread * 2);
  let hasIssues = $derived(issueCount > 0);

  // Build date injected at build time via Vite define
  const buildDate = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '';

  function formatDate(iso: string): string {
    if (!iso) return '';
    try {
      const d = new Date(iso + 'T00:00:00Z');
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    } catch {
      return iso;
    }
  }
</script>

<div style="flex:1;display:flex;flex-direction:column;position:relative;">
  <div style="flex:1;display:flex;align-items:center;padding-left:40px;">
    <div style="max-width:480px;">
      {#if hasIssues}
        <div style="font-family:var(--font-display);font-size:11px;font-weight:600;text-transform:uppercase;color:var(--text-tertiary);letter-spacing:1px;">Last updated {formatDate(buildDate)}</div>
        <div style="height:12px;"></div>
        <div style="font-family:var(--font-body);font-size:20px;font-weight:400;color:var(--text-primary);font-style:italic;line-height:1.5;">{quote}</div>
        <div style="height:24px;"></div>
        <div style="font-family:var(--font-body);font-size:13px;color:var(--text-muted);">{#if unread > 0}{unread} unread · ~{remaining} min{:else}All caught up{/if}</div>
        <div style="height:24px;"></div>
        <div style="font-family:var(--font-body);font-size:13px;color:var(--text-muted);">Select an issue from the feed</div>
      {:else}
        <div style="font-family:var(--font-display);font-size:11px;font-weight:600;text-transform:uppercase;color:var(--text-tertiary);letter-spacing:1px;">Coming soon</div>
        <div style="height:12px;"></div>
        <div style="font-family:var(--font-body);font-size:20px;font-weight:400;color:var(--text-primary);font-style:italic;line-height:1.5;">{quote}</div>
        <div style="height:24px;"></div>
        <div style="font-family:var(--font-body);font-size:13px;color:var(--text-muted);">New issues published three times a week.</div>
      {/if}
    </div>
  </div>
</div>
