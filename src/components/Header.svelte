<script lang="ts">
  import Logo from './Logo.svelte';
  import { readIssues } from '../stores/reader';
  import { ISSUES } from '../data/issues';

  let readCount = $state(0);
  let readMap: Record<string, string> = $state({});

  function segmentColor(id: string): string {
    const raw = readMap[id];
    if (!raw) return '#E9ECEF';
    if (raw === 'true') return '#2B8A3E';
    try {
      const s = JSON.parse(raw);
      return s.state === 'completed' ? '#2B8A3E' : '#B85C00';
    } catch { return '#2B8A3E'; }
  }

  $effect(() => {
    const unsub = readIssues.subscribe(val => {
      readMap = { ...val };
      readCount = Object.entries(val).filter(([_, v]) => {
        if (!v) return false;
        if (v === 'true') return true;
        try { return JSON.parse(v).state === 'completed'; } catch { return false; }
      }).length;
    });
    return unsub;
  });
</script>

<header style="height:48px;padding:0 16px;padding-top:env(safe-area-inset-top, 0);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;position:sticky;top:0;z-index:10;background:rgba(248,249,250,0.85);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);">
  <div class="brand-container" style="display:flex;align-items:center;gap:10px;">
    <Logo size={28} />
    <span class="brand-text" style="font-size:14px;font-weight:700;color:#212529;letter-spacing:-0.01em;">The Fourth Angle</span>
    <span class="tagline-divider" style="width:1px;height:16px;background:#DEE2E6;margin:0 12px;"></span>
    <span class="tagline-text" style="font-size:11px;font-weight:400;color:#6C757D;">Daily bite-size clarity for smarter thinking and better questions.</span>
  </div>
  <div style="display:flex;align-items:center;gap:8px;">
    <a href="/about" style="font-size:11px;font-weight:600;color:#6C757D;text-decoration:none;padding:3px 8px;border-radius:8px;min-height:28px;display:flex;align-items:center;transition:background 0.15s ease;" onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = '#F1F3F5'; }} onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>About</a>
  </div>
  <div style="position:absolute;bottom:0;left:0;right:0;display:flex;gap:1px;height:1.5px;">
    {#each ISSUES as issue, i}
      <div style="flex:1;background:{segmentColor(issue.id)};"></div>
    {/each}
  </div>
</header>

<style>
  @media (max-width: 768px) {
    .tagline-divider, .tagline-text { display: none; }
  }
  @media (min-width: 1024px) {
    .brand-text { font-size: 15px !important; }
    .brand-container { gap: 12px !important; }
  }
</style>
