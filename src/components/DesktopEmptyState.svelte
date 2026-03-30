<script lang="ts">
  import { readIssues } from '../stores/reader';
  import { QUOTES } from '../data/quotes';

  import type { IssueSummary } from '../lib/issues-loader';

  interface Props {
    issueCount?: number;
    topIssue?: IssueSummary | null;
    onOpenIssue?: (issue: IssueSummary) => void;
  }
  let { issueCount = 0, topIssue = null, onOpenIssue }: Props = $props();

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

  let scoreColor = $derived(
    topIssue ? (topIssue.opinionShift >= 80 ? 'var(--score-critical)' : topIssue.opinionShift >= 60 ? 'var(--score-warning)' : 'var(--score-info)') : ''
  );
</script>

<div style="flex:1;display:flex;flex-direction:column;position:relative;">
  <div style="flex:1;display:flex;align-items:center;padding-left:40px;">
    <div style="max-width:480px;">
      {#if hasIssues}
        <div style="font-family:var(--font-display);font-size:11px;font-weight:600;text-transform:uppercase;color:var(--text-tertiary);letter-spacing:1px;">Last updated {formatDate(buildDate)}</div>
        <div style="height:12px;"></div>

        <!-- #63: Hero card — highest-impact unread issue -->
        {#if topIssue && onOpenIssue}
          <button
            onclick={() => onOpenIssue?.(topIssue)}
            style="text-align:left;width:100%;padding:16px 20px;background:var(--bg);border:1px solid var(--border-subtle);border-radius:14px;cursor:pointer;transition:border-color 0.15s ease, box-shadow 0.15s ease;margin-bottom:20px;"
            onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-divider)'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)'; }}
            onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
          >
            <div style="font-family:var(--font-display);font-size:18px;font-weight:700;color:var(--text-primary);line-height:1.3;margin:0;">{topIssue.headline}</div>
            <div style="font-family:var(--font-body);font-size:13px;color:var(--text-secondary);line-height:1.5;margin:8px 0 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">{topIssue.context}</div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:10px;">
              <div style="flex:1;height:4px;background:var(--bg-sunken);border-radius:2px;overflow:hidden;">
                <div style="height:100%;width:{topIssue.opinionShift}%;background:{scoreColor};border-radius:2px;"></div>
              </div>
              <span style="font-family:var(--font-display);font-size:13px;font-weight:700;color:{scoreColor};font-variant-numeric:tabular-nums;">{topIssue.opinionShift}</span>
            </div>
          </button>
        {/if}

        <!-- C4: Quote with fade-in animation -->
        <div class="quote-fade" style="font-family:var(--font-body);font-size:20px;font-weight:400;color:var(--text-primary);font-style:italic;line-height:1.5;">{quote}</div>
        <div style="height:24px;"></div>
        <div style="font-family:var(--font-body);font-size:13px;color:var(--text-muted);">{#if unread > 0}{unread} unread · ~{remaining} min{:else}All caught up{/if}</div>
        <div style="height:16px;"></div>

        <!-- C3: Keyboard shortcut hints -->
        <div style="font-family:var(--font-body);font-size:12px;color:var(--text-faint);display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <kbd class="kbd">j</kbd><kbd class="kbd">k</kbd> navigate
          <span style="color:var(--border-divider);">·</span>
          <kbd class="kbd">Enter</kbd> read
          <span style="color:var(--border-divider);">·</span>
          <kbd class="kbd">/</kbd> search
        </div>
      {:else}
        <div style="font-family:var(--font-display);font-size:11px;font-weight:600;text-transform:uppercase;color:var(--text-tertiary);letter-spacing:1px;">Coming soon</div>
        <div style="height:12px;"></div>
        <div class="quote-fade" style="font-family:var(--font-body);font-size:20px;font-weight:400;color:var(--text-primary);font-style:italic;line-height:1.5;">{quote}</div>
        <div style="height:24px;"></div>
        <div style="font-family:var(--font-body);font-size:13px;color:var(--text-muted);">New issues published three times a week.</div>
      {/if}
    </div>
  </div>
</div>

<style>
  .quote-fade {
    animation: fadeIn 300ms ease 200ms both;
  }

  .kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px 6px;
    border: 1px solid var(--border-subtle);
    border-radius: 4px;
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    background: var(--bg-sunken);
    min-width: 20px;
    line-height: 1;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .quote-fade {
      animation: none;
    }
  }
</style>
