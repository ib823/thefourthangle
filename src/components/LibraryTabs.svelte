<script lang="ts">
  interface Props {
    libraryMode: 'reading' | 'highlights';
    readingCount?: number;
    highlightCount?: number;
    variant?: 'inline' | 'sidebar';
    panelId?: string;
    idPrefix?: string;
    onOpenReading?: () => void;
    onOpenHighlights?: () => void;
  }

  const tabs = [
    { key: 'reading', label: 'Reading' },
    { key: 'highlights', label: 'Highlights' },
  ] as const;

  let {
    libraryMode,
    readingCount = 0,
    highlightCount = 0,
    variant = 'inline',
    panelId = 'library-panel',
    idPrefix = 'library-tab',
    onOpenReading,
    onOpenHighlights,
  }: Props = $props();

  function activate(tab: typeof tabs[number]['key']) {
    if (tab === 'reading') onOpenReading?.();
    else onOpenHighlights?.();
  }

  function countFor(tab: typeof tabs[number]['key']) {
    if (tab === 'reading') return readingCount;
    return highlightCount;
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

<div class="library-tabs" class:library-tabs--sidebar={variant === 'sidebar'} role="tablist" aria-label="Library views">
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
    display: inline-flex;
    align-items: stretch;
    gap: 8px;
    flex-wrap: wrap;
  }

  .library-tab {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 0 14px;
    border-radius: 999px;
    border: 1px solid var(--border-subtle);
    background: rgba(255, 255, 255, 0.72);
    color: var(--text-secondary);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
    box-shadow: 0 8px 18px rgba(17, 24, 39, 0.04);
  }

  .library-tab--active {
    background: var(--bg-sunken);
    border-color: var(--border-divider);
    color: var(--text-primary);
    box-shadow: 0 10px 22px rgba(17, 24, 39, 0.08);
  }

  .library-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 6px;
    border-radius: 999px;
    background: rgba(210, 140, 40, 0.12);
    color: inherit;
    font-size: 10px;
    font-weight: 800;
    line-height: 1;
  }

  .library-tabs--sidebar .library-tab {
    min-height: 36px;
    padding-inline: 12px;
    font-size: 11px;
    box-shadow: none;
  }

  @media (max-width: 767px) {
    .library-tabs {
      gap: 6px;
    }

    .library-tab {
      min-height: 36px;
      padding-inline: 12px;
      font-size: 11px;
    }
  }

  @media (prefers-color-scheme: dark) {
    .library-tab {
      background: rgba(34, 31, 27, 0.9);
      border-color: var(--border-divider);
      color: var(--text-secondary);
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.24);
    }

    .library-tab--active {
      background: rgba(200, 150, 58, 0.14);
      border-color: rgba(200, 150, 58, 0.3);
      color: var(--text-primary);
    }

    .library-count {
      background: rgba(200, 150, 58, 0.16);
    }
  }
</style>
