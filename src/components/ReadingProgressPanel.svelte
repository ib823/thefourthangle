<script lang="ts">
  /**
   * Phase 1 follow-up 3b — Reading Progress UI panel.
   *
   * Surfaces the reading-state API's Export / Import / Clear controls plus a
   * device-identifier display and a storage-status indicator. Self-contained;
   * the caller decides where to mount it (info menu, settings drawer, etc.).
   *
   * No persistent UI state — close/dismiss is caller-controlled via the
   * `onClose` prop.
   *
   * Accessibility: proper heading, labeled controls, file-input behind a
   * styled button (keyboard-triggerable), confirm prompt for Clear. Uses the
   * global :focus-visible rule from Phase 2.
   */
  import { onMount } from 'svelte';
  import {
    ensureDeviceId,
    exportAll,
    importAll,
    clearAll,
    isStorageAvailable,
    subscribe as subscribeReadingState,
  } from '../lib/reading-state';

  interface Props {
    onClose?: () => void;
  }
  let { onClose }: Props = $props();

  let deviceId = $state('');
  let storageAvailable = $state(true);
  let statusMessage = $state<{ kind: 'success' | 'error' | 'info'; text: string } | null>(null);

  let fileInput: HTMLInputElement | undefined = $state();

  onMount(() => {
    try {
      deviceId = ensureDeviceId();
    } catch {
      deviceId = '—';
    }
    storageAvailable = isStorageAvailable();
    // Re-read on any reading-state notify so Clear / Import updates the view.
    const unsub = subscribeReadingState(() => {
      storageAvailable = isStorageAvailable();
    });
    return unsub;
  });

  function doExport() {
    try {
      const data = exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `tfa-reading-progress-${deviceId}-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      statusMessage = { kind: 'success', text: 'Progress exported.' };
    } catch (e) {
      statusMessage = { kind: 'error', text: `Export failed: ${e instanceof Error ? e.message : 'unknown error'}` };
    }
  }

  function triggerImport() {
    fileInput?.click();
  }

  async function handleFileChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = importAll(parsed);
      if (result.errors.length) {
        statusMessage = { kind: 'error', text: `Import finished with errors: ${result.errors.join('; ')}` };
      } else {
        statusMessage = {
          kind: 'success',
          text: `Imported ${result.imported} entries${result.skipped ? ` · skipped ${result.skipped}` : ''}.`,
        };
      }
    } catch (e) {
      statusMessage = { kind: 'error', text: `Import failed: ${e instanceof Error ? e.message : 'invalid JSON'}` };
    } finally {
      if (fileInput) fileInput.value = '';
    }
  }

  function doClear() {
    const confirmed = window.confirm(
      'Clear all reading progress on this device? This cannot be undone. Export first if you want a backup.',
    );
    if (!confirmed) return;
    try {
      clearAll();
      statusMessage = { kind: 'success', text: 'All reading progress cleared on this device.' };
    } catch (e) {
      statusMessage = { kind: 'error', text: `Clear failed: ${e instanceof Error ? e.message : 'unknown error'}` };
    }
  }
</script>

<section
  class="reading-progress"
  aria-labelledby="reading-progress-heading"
  data-testid="reading-progress-panel"
>
  <header class="rp-header">
    <h2 id="reading-progress-heading" class="rp-title">Reading progress</h2>
    {#if onClose}
      <button
        type="button"
        class="rp-close"
        onclick={() => onClose?.()}
        aria-label="Close reading progress panel"
      >&times;</button>
    {/if}
  </header>

  <dl class="rp-meta">
    <div class="rp-meta-row">
      <dt>Device identifier</dt>
      <dd translate="no" data-testid="reading-progress-device-id">{deviceId}</dd>
    </div>
    <div class="rp-meta-row">
      <dt>Storage status</dt>
      <dd data-testid="reading-progress-storage-status">
        {#if storageAvailable}
          <span class="rp-status rp-status--ok">Saving on this device</span>
        {:else}
          <span class="rp-status rp-status--blocked">Not saving on this device</span>
        {/if}
      </dd>
    </div>
  </dl>

  <div class="rp-actions">
    <button
      type="button"
      class="rp-btn rp-btn--primary"
      onclick={doExport}
      data-testid="reading-progress-export"
    >
      Export
    </button>

    <button
      type="button"
      class="rp-btn"
      onclick={triggerImport}
      data-testid="reading-progress-import"
    >
      Import…
    </button>
    <input
      bind:this={fileInput}
      type="file"
      accept="application/json,.json"
      onchange={handleFileChange}
      style="display:none;"
      aria-hidden="true"
      tabindex="-1"
    />

    <button
      type="button"
      class="rp-btn rp-btn--danger"
      onclick={doClear}
      data-testid="reading-progress-clear"
    >
      Clear on this device
    </button>
  </div>

  {#if statusMessage}
    <p
      class="rp-status-line"
      class:rp-status-line--success={statusMessage.kind === 'success'}
      class:rp-status-line--error={statusMessage.kind === 'error'}
      role="status"
      aria-live="polite"
    >{statusMessage.text}</p>
  {/if}

  <p class="rp-hint">
    Your reading progress lives on this device only. Export creates a JSON backup you can re-import on any other browser.
    {#if !storageAvailable}
      <br />Because this browser is not persisting data, anything you've read in this session will be lost on reload — export now if you want to keep it.
    {/if}
  </p>
</section>

<style>
  .reading-progress {
    max-inline-size: 480px;
    margin: 0 auto;
    padding: 20px;
    background: var(--card, #ffffff);
    border: 1px solid var(--border-subtle, #e9ecef);
    border-radius: var(--radius-lg, 16px);
    color: var(--text-primary, #212529);
    font-family: var(--font-body, 'Nunito Sans', system-ui, sans-serif);
    line-height: var(--leading-normal, 1.45);
  }
  .rp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-block-end: 12px;
  }
  .rp-title {
    margin: 0;
    font-family: var(--font-display, 'Manrope', system-ui, sans-serif);
    font-size: var(--text-title, 1.5rem);
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .rp-close {
    all: unset;
    min-inline-size: 32px;
    min-block-size: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    line-height: 1;
    color: var(--text-secondary, #495057);
    border-radius: 50%;
    cursor: pointer;
  }
  .rp-close:hover,
  .rp-close:focus-visible {
    background: var(--hover-tint, rgba(0, 0, 0, 0.04));
  }

  .rp-meta {
    margin: 0 0 16px;
    padding: 0;
    display: grid;
    gap: 8px;
  }
  .rp-meta-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    font-size: var(--text-sm, 0.875rem);
  }
  .rp-meta-row dt {
    color: var(--text-muted, #6c757d);
    font-weight: 600;
  }
  .rp-meta-row dd {
    margin: 0;
    color: var(--text-primary, #212529);
    font-variant-numeric: tabular-nums;
  }

  .rp-status {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
  }
  .rp-status--ok {
    background: var(--verdict-green-bg, #ebfbee);
    color: var(--status-green-text, #1b6d30);
  }
  .rp-status--blocked {
    background: var(--status-red-bg, #fff5f5);
    color: var(--status-red, #e03131);
  }

  .rp-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-block-end: 12px;
  }
  .rp-btn {
    min-inline-size: 80px;
    min-block-size: 44px;
    padding: 10px 14px;
    font: inherit;
    font-size: var(--text-sm, 0.875rem);
    font-weight: 600;
    border: 1px solid var(--border-subtle, #e9ecef);
    border-radius: var(--radius-md, 8px);
    background: var(--bg-elevated, #f8f9fa);
    color: var(--text-primary, #212529);
    cursor: pointer;
    transition: background var(--duration-fast, 150ms) ease, border-color var(--duration-fast, 150ms) ease;
  }
  .rp-btn:hover,
  .rp-btn:focus-visible {
    background: var(--bg-sunken, #f1f3f5);
  }
  .rp-btn--primary {
    background: var(--text-primary, #212529);
    color: var(--bg, #ffffff);
    border-color: var(--text-primary, #212529);
  }
  .rp-btn--primary:hover,
  .rp-btn--primary:focus-visible {
    opacity: 0.9;
    background: var(--text-primary, #212529);
  }
  .rp-btn--danger {
    color: var(--color-danger, #e03131);
    border-color: var(--status-red-border, #ffc9c9);
    margin-inline-start: auto;
  }
  .rp-btn--danger:hover,
  .rp-btn--danger:focus-visible {
    background: var(--status-red-bg, #fff5f5);
  }

  .rp-status-line {
    margin: 12px 0 0;
    padding: 10px 12px;
    border-radius: var(--radius-md, 8px);
    font-size: var(--text-sm, 0.875rem);
  }
  .rp-status-line--success {
    background: var(--verdict-green-bg, #ebfbee);
    color: var(--status-green-text, #1b6d30);
  }
  .rp-status-line--error {
    background: var(--status-red-bg, #fff5f5);
    color: var(--status-red, #e03131);
    border: 1px solid var(--status-red-border, #ffc9c9);
  }

  .rp-hint {
    margin: 12px 0 0;
    font-size: var(--text-sm, 0.875rem);
    color: var(--text-secondary, #495057);
  }
</style>
