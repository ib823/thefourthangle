<script lang="ts">
  import Logo from './Logo.svelte';
  import NotificationBell from './NotificationBell.svelte';
  import InstallPrompt from './InstallPrompt.svelte';
  import { readIssues } from '../stores/reader';
  import { loadSearchIndex, search as doSearch } from '../lib/search';

  interface Props {
    issueIds?: string[];
    onSearchToggle?: () => void;
    searchMode?: boolean;
    searchQuery?: string;
    onSearchInput?: (q: string) => void;
    onSearchClear?: () => void;
  }
  let { issueIds = [], onSearchToggle, searchMode = false, searchQuery = '', onSearchInput, onSearchClear }: Props = $props();

  let readCount = $state(0);
  let readMap: Record<string, string> = $state({});
  let searchInputEl: HTMLInputElement | undefined = $state(undefined);

  $effect(() => {
    if (searchMode && searchInputEl) {
      loadSearchIndex();
      searchInputEl.focus();
    }
  });

  function segmentColor(id: string): string {
    const raw = readMap[id];
    if (!raw) return 'var(--border-subtle)';
    if (raw === 'true') return 'var(--status-green)';
    try {
      const s = JSON.parse(raw);
      return s.state === 'completed' ? 'var(--status-green)' : 'var(--score-warning)';
    } catch { return 'var(--status-green)'; }
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

<header style="height:48px;padding:0 16px;padding-top:env(safe-area-inset-top, 0);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;position:sticky;top:0;z-index:10;background:var(--header-bg);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);">
  {#if searchMode}
    <div style="flex:1;display:flex;align-items:center;gap:8px;">
      <input
        bind:this={searchInputEl}
        type="text"
        placeholder="Search issues..."
        value={searchQuery}
        oninput={(e) => onSearchInput?.((e.currentTarget as HTMLInputElement).value)}
        style="flex:1;padding:8px 12px;font-size:14px;border:1px solid var(--border-subtle);border-radius:8px;background:var(--bg-sunken);color:var(--text-primary);outline:none;"
      />
      <button onclick={() => onSearchClear?.()} style="background:none;border:none;cursor:pointer;font-size:13px;font-weight:600;color:var(--text-tertiary);padding:8px;min-height:44px;">Cancel</button>
    </div>
  {:else}
    <div class="brand-container" style="display:flex;align-items:center;gap:10px;">
      <Logo size={28} />
      <span class="brand-text" style="font-size:14px;font-weight:700;color:var(--text-primary);letter-spacing:-0.01em;">The Fourth Angle</span>
      <span class="tagline-divider" style="width:1px;height:16px;background:var(--border-divider);margin:0 10px;"></span>
      <span class="tagline-text" style="font-family:var(--font-body);font-size:13px;font-weight:400;color:var(--text-tertiary);letter-spacing:-0.005em;">Bite-size clarity for smarter thinking and better questions.</span>
    </div>
    <div style="display:flex;align-items:center;gap:0;">
      {#if onSearchToggle}
        <button class="search-icon" onclick={onSearchToggle} style="background:none;border:none;cursor:pointer;padding:10px;display:flex;align-items:center;justify-content:center;min-height:44px;min-width:44px;border-radius:8px;transition:background 0.15s ease;" aria-label="Search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </button>
      {/if}
      <NotificationBell />
      <InstallPrompt />
      <a href="/about" aria-label="About" style="text-decoration:none;padding:8px;border-radius:8px;min-height:44px;min-width:44px;display:flex;align-items:center;justify-content:center;transition:background 0.15s ease;" onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-sunken)'; }} onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary, #6C757D)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></a>
    </div>
  {/if}
  <div style="position:absolute;bottom:0;left:0;right:0;display:flex;gap:1px;height:1.5px;">
    {#each issueIds as id}
      <div style="flex:1;background:{segmentColor(id)};"></div>
    {/each}
  </div>
</header>

<style>
  @media (max-width: 768px) {
    .tagline-divider, .tagline-text { display: none; }
  }
  @media (min-width: 769px) {
    .search-icon { display: none !important; }
  }
  @media (min-width: 1024px) {
    .brand-text { font-size: 15px !important; }
    .brand-container { gap: 12px !important; }
  }
</style>
