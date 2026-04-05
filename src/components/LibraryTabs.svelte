<script lang="ts">
  interface Props {
    libraryMode: 'reading' | 'highlights' | 'archive';
    readingCount?: number;
    highlightCount?: number;
    archiveCount?: number;
    panelId?: string;
    idPrefix?: string;
    onOpenReading?: () => void;
    onOpenHighlights?: () => void;
    onOpenArchive?: () => void;
  }

  const tabs = [
    { key: 'reading', label: 'Reading' },
    { key: 'highlights', label: 'Highlights' },
    { key: 'archive', label: 'Archive' },
  ] as const;

  let {
    libraryMode,
    readingCount = 0,
    highlightCount = 0,
    archiveCount = 0,
    panelId = 'library-panel',
    idPrefix = 'library-tab',
    onOpenReading,
    onOpenHighlights,
    onOpenArchive,
  }: Props = $props();

  function activate(tab: typeof tabs[number]['key']) {
    if (tab === 'reading') onOpenReading?.();
    else if (tab === 'highlights') onOpenHighlights?.();
    else onOpenArchive?.();
  }

  function countFor(tab: typeof tabs[number]['key']) {
    if (tab === 'reading') return readingCount;
    if (tab === 'highlights') return highlightCount;
    return archiveCount;
  }

  function onKeyDown(event: KeyboardEvent, tab: typeof tabs[number]['key']) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = tabs.findIndex((item) => item.key === tab);
    if (event.key === 'Home') {
      activate(tabs[0].key);
      return;
    }
    if (event.key === 'End') {
      activate(tabs[tabs.length - 1].key);
      return;
    }
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (currentIndex + delta + tabs.length) % tabs.length;
    activate(tabs[nextIndex].key);
  }
</script>

<div
  class="library-tabs"
  role="tablist"
  aria-label="Library views"
>
  {#each tabs as tab}
    <button
      id={`${idPrefix}-${tab.key}`}
      class="library-tab"
      class:library-tab--active={libraryMode === tab.key}
      role="tab"
      aria-selected={libraryMode === tab.key}
      aria-controls={panelId}
      tabindex={libraryMode === tab.key ? 0 : -1}
      onclick={() => activate(tab.key)}
      onkeydown={(event) => onKeyDown(event, tab.key)}
    >
      <span>{tab.label}</span>
      <span class="library-count">{countFor(tab.key)}</span>
    </button>
  {/each}
</div>

<style>
  .library-tabs {
    display: inline-grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: stretch;
    border-bottom: 1px solid var(--border-subtle);
  }

  .library-tab {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-width: 0;
    min-height: 36px;
    padding: 0 12px;
    border: none;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    font: inherit;
    font-size: var(--text-xs);
    font-weight: 700;
    transition: color 180ms ease, border-color 180ms ease;
  }

  .library-tab--active {
    color: var(--text-primary);
    border-bottom-color: var(--text-primary);
  }

  .library-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 6px;
    border-radius: var(--radius-pill);
    background: rgba(210, 140, 40, 0.12);
    color: inherit;
    font-size: var(--text-micro);
    font-weight: 700;
    line-height: 1;
  }

  @media (prefers-color-scheme: dark) {
    .library-tabs {
      border-bottom-color: var(--border-divider);
    }

    .library-tab {
      color: var(--text-secondary);
    }

    .library-tab--active {
      color: var(--text-primary);
      border-bottom-color: var(--text-primary);
    }

    .library-count {
      background: rgba(200, 150, 58, 0.16);
    }
  }
</style>
