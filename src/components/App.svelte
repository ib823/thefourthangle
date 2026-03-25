<script lang="ts">
  import { onMount } from 'svelte';
  import { ISSUES as issues } from '../data/issues';
  import Header from './Header.svelte';
  import DesktopCard from './DesktopCard.svelte';
  import DesktopFeed from './DesktopFeed.svelte';
  import DesktopReader from './DesktopReader.svelte';
  import DesktopEmptyState from './DesktopEmptyState.svelte';
  import MobileBrowser from './MobileBrowser.svelte';
  import InsightReader from './InsightReader.svelte';
  import { readIssues } from '../stores/reader';

  interface Props {
    initialIssueId?: string;
  }
  let { initialIssueId }: Props = $props();

  let viewMode = $state<'mobile' | 'tablet' | 'desktop'>('desktop');
  let activeIssue: (typeof issues)[0] | null = $state(
    initialIssueId ? issues.find(i => i.id === initialIssueId) ?? null : null
  );
  let readMap: Record<string, string> = $state({});

  function getState(id: string) {
    const raw = readMap[id];
    if (!raw) return null;
    if (raw === 'true') return { state: 'completed', progress: 6 };
    try { return JSON.parse(raw); } catch { return null; }
  }

  $effect(() => {
    const unsub = readIssues.subscribe(v => { readMap = { ...v }; });
    return unsub;
  });

  function checkViewport() {
    const w = window.innerWidth;
    if (w <= 768) viewMode = 'mobile';
    else if (w < 1024) viewMode = 'tablet';
    else viewMode = 'desktop';
  }

  onMount(() => {
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  });

  function openIssue(issue: (typeof issues)[0]) {
    activeIssue = issue;
  }

  function closeReader() {
    activeIssue = null;
  }

  function openNextIssue() {
    if (!activeIssue) return;
    const idx = issues.findIndex(i => i.id === activeIssue!.id);
    if (idx >= 0 && idx < issues.length - 1) {
      activeIssue = issues[idx + 1];
    }
  }

  let isLastIssue = $derived.by(() => {
    if (!activeIssue) return true;
    const idx = issues.findIndex(i => i.id === activeIssue!.id);
    return idx >= issues.length - 1;
  });

  let nextHeadline = $derived.by(() => {
    if (!activeIssue) return '';
    const idx = issues.findIndex(i => i.id === activeIssue!.id);
    return idx >= 0 && idx < issues.length - 1 ? issues[idx + 1].headline : '';
  });

  // Keyboard nav for desktop feed
  onMount(() => {
    if (viewMode !== 'desktop') return;
    function onKeyDown(e: KeyboardEvent) {
      if (viewMode !== 'desktop') return;
      if (e.key === 'Escape' && activeIssue) { activeIssue = null; return; }
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (!activeIssue) { activeIssue = issues[0]; return; }
        const idx = issues.findIndex(i => i.id === activeIssue!.id);
        if (idx < issues.length - 1) activeIssue = issues[idx + 1];
      }
      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!activeIssue) return;
        const idx = issues.findIndex(i => i.id === activeIssue!.id);
        if (idx > 0) activeIssue = issues[idx - 1];
      }
      if (e.key === 'Enter') {
        if (!activeIssue) { activeIssue = issues[0]; return; }
        openIssue(activeIssue);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });
</script>

{#if viewMode === 'mobile'}
  <!-- Mobile: Tinder-style vertical browse -->
  <main style="height:100dvh;display:flex;flex-direction:column;overflow:hidden;">
    <Header />
    <MobileBrowser {issues} onOpenIssue={openIssue} />
  </main>

  {#if activeIssue}
    <InsightReader issue={activeIssue} onClose={closeReader} onNext={isLastIssue ? undefined : openNextIssue} />
  {/if}

{:else if viewMode === 'tablet'}
  <!-- Tablet: grid + overlay reader -->
  <main style="min-height:100vh;">
    <Header />
    <div style="max-width:960px;margin:0 auto;padding:0 18px 40px;">
      <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:16px;">
        {#each issues as issue, i}
          <DesktopCard {issue} index={i} readState={getState(issue.id)} onOpen={() => openIssue(issue)} />
        {/each}
      </div>
    </div>
  </main>

  {#if activeIssue}
    <InsightReader issue={activeIssue} onClose={closeReader} onNext={isLastIssue ? undefined : openNextIssue} />
  {/if}

{:else}
  <!-- Desktop: split-pane -->
  <main style="height:100vh;display:flex;flex-direction:column;overflow:hidden;">
    <!-- Full-width header -->
    <div style="flex-shrink:0;border-bottom:1px solid #F1F3F5;">
      <Header />
    </div>

    <!-- Split pane -->
    <div style="flex:1;display:flex;overflow:hidden;">
      <DesktopFeed
        {issues}
        activeId={activeIssue?.id ?? null}
        {readMap}
        onSelectIssue={openIssue}
      />

      {#if activeIssue}
        <DesktopReader
          issue={activeIssue}
          onNext={isLastIssue ? undefined : openNextIssue}
          {nextHeadline}
        />
      {:else}
        <DesktopEmptyState />
      {/if}
    </div>
  </main>
{/if}
