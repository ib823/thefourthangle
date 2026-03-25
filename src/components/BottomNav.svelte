<script lang="ts">
  interface Props {
    currentTab?: 'feed' | 'saved' | 'about';
  }
  let { currentTab = 'feed' }: Props = $props();

  function navigate(tab: string) {
    const paths: Record<string, string> = { feed: '/', saved: '/saved', about: '/about' };
    window.location.href = paths[tab] || '/';
  }
</script>

<nav style="position:fixed;bottom:0;left:0;right:0;background:rgba(255,255,255,0.96);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-top:1px solid var(--border);padding-bottom:env(safe-area-inset-bottom, 0);z-index:100;" aria-label="Main navigation">
  <div style="display:flex;justify-content:space-around;align-items:center;height:62px;max-width:480px;margin:0 auto;">
    <button onclick={() => navigate('feed')} style="display:flex;flex-direction:column;align-items:center;gap:4px;background:none;border:none;cursor:pointer;padding:8px 20px;min-width:44px;min-height:44px;position:relative;" aria-label="Feed" aria-current={currentTab === 'feed' ? 'page' : undefined}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill={currentTab === 'feed' ? 'var(--amber)' : 'none'} stroke={currentTab === 'feed' ? 'var(--amber)' : 'var(--text-tertiary)'} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      <span style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;font-weight:{currentTab === 'feed' ? '700' : '500'};color:{currentTab === 'feed' ? 'var(--amber)' : 'var(--text-tertiary)'};">Feed</span>
    </button>
    <button onclick={() => navigate('saved')} style="display:flex;flex-direction:column;align-items:center;gap:4px;background:none;border:none;cursor:pointer;padding:8px 20px;min-width:44px;min-height:44px;position:relative;" aria-label="Saved insights" aria-current={currentTab === 'saved' ? 'page' : undefined}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill={currentTab === 'saved' ? 'var(--amber)' : 'none'} stroke={currentTab === 'saved' ? 'var(--amber)' : 'var(--text-tertiary)'} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
      <span style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;font-weight:{currentTab === 'saved' ? '700' : '500'};color:{currentTab === 'saved' ? 'var(--amber)' : 'var(--text-tertiary)'};">Saved</span>
    </button>
    <button onclick={() => navigate('about')} style="display:flex;flex-direction:column;align-items:center;gap:4px;background:none;border:none;cursor:pointer;padding:8px 20px;min-width:44px;min-height:44px;position:relative;" aria-label="About" aria-current={currentTab === 'about' ? 'page' : undefined}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill={currentTab === 'about' ? 'var(--amber)' : 'none'} stroke={currentTab === 'about' ? 'var(--amber)' : 'var(--text-tertiary)'} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      <span style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;font-weight:{currentTab === 'about' ? '700' : '500'};color:{currentTab === 'about' ? 'var(--amber)' : 'var(--text-tertiary)'};">About</span>
    </button>
  </div>
</nav>
