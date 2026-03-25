<script lang="ts">
  import CardShell from './CardShell.svelte';
  import { LENS_META } from '../lib/constants';

  interface Props {
    lens?: string;
    h?: string;
    s?: string;
    d?: string;
  }
  let { lens = '', h = '', s = '', d = '' }: Props = $props();

  let expanded = $state(false);
  let detailEl = $state<HTMLDivElement | null>(null);
  let innerEl = $state<HTMLDivElement | null>(null);

  let meta = $derived(lens ? LENS_META[lens] : null);
  const lensColorBg: Record<string, string> = {
    legal: 'rgba(82,82,91,0.08)',
    social: 'rgba(107,76,122,0.08)',
    economic: 'rgba(122,99,50,0.08)',
    historical: 'rgba(139,101,8,0.08)',
    theological: 'rgba(107,91,62,0.08)',
    critical: 'rgba(85,85,85,0.08)',
  };
  let tagBg = $derived(lens ? (lensColorBg[lens] || 'rgba(44,34,21,0.05)') : 'transparent');

  function toggle() {
    expanded = !expanded;
    if (detailEl) {
      const targetHeight = expanded ? innerEl?.offsetHeight || 0 : 0;
      detailEl.style.height = detailEl.offsetHeight + 'px';
      requestAnimationFrame(() => {
        if (!detailEl) return;
        detailEl.style.transition = 'height 0.3s ease';
        detailEl.style.height = targetHeight + 'px';
        if (expanded) {
          detailEl.addEventListener('transitionend', () => {
            if (detailEl) detailEl.style.height = 'auto';
          }, { once: true });
        }
      });
    }
  }
</script>

<CardShell variant="light">
  <div style="background:var(--card);padding:30px;border:1px solid var(--border);">
    {#if meta}
      <span style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:{meta.color};font-weight:600;background:{tagBg};padding:3px 8px;border-radius:6px;display:inline-block;">{meta.symbol} {meta.label}</span>
    {/if}
    {#if h}
      <h3 style="font-family:var(--font-display);font-size:30px;font-weight:700;color:var(--text-primary);margin:8px 0 10px 0;line-height:1.18;">{h}</h3>
    {/if}
    {#if s}
      <p style="font-family:var(--font-body);font-size:17px;color:var(--text-primary);line-height:1.8;margin:0;">{s}</p>
    {/if}
    {#if d}
      <button onclick={toggle} style="display:inline-flex;align-items:center;gap:4px;background:none;border:none;cursor:pointer;padding:8px 0;margin-top:10px;font-size:14px;font-weight:700;color:var(--amber);min-height:44px;">
        {expanded ? 'Show less' : 'Read more'}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="transform:rotate({expanded ? 180 : 0}deg);transition:transform 0.2s ease;"><polyline points="2 4 6 8 10 4"/></svg>
      </button>
      <div bind:this={detailEl} style="overflow:hidden;height:{expanded ? 'auto' : '0px'};">
        <div bind:this={innerEl}>
          <div style="border-top:1px solid var(--border);padding-top:14px;margin-top:4px;">
            <p style="font-size:15px;color:var(--text-secondary);line-height:1.85;margin:0;">{d}</p>
          </div>
        </div>
      </div>
    {/if}
  </div>
</CardShell>
