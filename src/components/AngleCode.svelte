<script lang="ts">
  import {
    getAngleCode, isLinked, createAngleCode, linkAngleCode,
    clearAngleCode, getLastSyncTime, onSyncChange
  } from '../lib/sync';
  import { onMount, onDestroy } from 'svelte';

  interface Props {
    onClose?: () => void;
  }

  let { onClose }: Props = $props();

  let code = $state(getAngleCode() || '');
  let linked = $state(isLinked());
  let lastSync = $state(getLastSyncTime());
  let inputCode = $state('');
  let status = $state<'idle' | 'creating' | 'linking' | 'error' | 'linked'>('idle');
  let errorMsg = $state('');
  let copied = $state(false);
  let showInput = $state(false);
  let confirmUnlink = $state(false);

  let cleanup: (() => void) | undefined;

  onMount(() => {
    cleanup = onSyncChange(() => {
      code = getAngleCode() || '';
      linked = isLinked();
      lastSync = getLastSyncTime();
    });
  });

  onDestroy(() => cleanup?.());

  async function handleCreate() {
    status = 'creating';
    errorMsg = '';
    try {
      const token = await createAngleCode();
      code = token;
      linked = true;
      status = 'idle';
    } catch {
      status = 'error';
      errorMsg = 'Could not generate code. Try again.';
    }
  }

  async function handleLink() {
    const cleaned = inputCode.toUpperCase().trim().replace(/[^A-Z2-9]/g, '');
    if (cleaned.length !== 6) {
      status = 'error';
      errorMsg = 'Enter a 6-character code.';
      return;
    }

    status = 'linking';
    errorMsg = '';
    try {
      const success = await linkAngleCode(cleaned);
      if (success) {
        code = cleaned;
        linked = true;
        lastSync = Date.now();
        status = 'linked';
        setTimeout(() => { status = 'idle'; }, 2000);
      } else {
        status = 'error';
        errorMsg = 'Code not found. Check and try again.';
      }
    } catch {
      status = 'error';
      errorMsg = 'Connection failed. Try again.';
    }
  }

  // Auto-submit when 6 characters entered
  function handleInputChange() {
    const cleaned = inputCode.toUpperCase().trim().replace(/[^A-Z2-9]/g, '');
    if (cleaned.length === 6 && status !== 'linking') {
      inputCode = cleaned;
      handleLink();
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      copied = true;
      setTimeout(() => { copied = false; }, 2000);
    });
  }

  async function handleShare() {
    const url = `${window.location.origin}/?sync=${code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My Angle Code', url });
      } catch { /* cancelled */ }
    } else {
      navigator.clipboard.writeText(url).then(() => {
        copied = true;
        setTimeout(() => { copied = false; }, 2000);
      });
    }
  }

  function handleUnlink() {
    if (!confirmUnlink) {
      confirmUnlink = true;
      setTimeout(() => { confirmUnlink = false; }, 4000);
      return;
    }
    clearAngleCode();
    code = '';
    linked = false;
    lastSync = 0;
    status = 'idle';
    showInput = false;
    inputCode = '';
    confirmUnlink = false;
  }

  function syncStatus(): { dot: string; text: string } {
    if (!lastSync) return { dot: 'var(--text-muted)', text: 'Not yet synced' };
    const diff = Date.now() - lastSync;
    if (diff < 5 * 60_000) return { dot: 'var(--status-green)', text: 'Synced' };
    if (diff < 60 * 60_000) return { dot: 'var(--score-warning)', text: `${Math.floor(diff / 60_000)}m ago` };
    return { dot: 'var(--text-muted)', text: `${Math.floor(diff / 3_600_000)}h ago` };
  }

  function handleInputKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLink();
    }
  }
</script>

<div class="angle-panel">
  {#if linked}
    <!-- Linked: show code + status -->
    <div class="panel-header">
      <div class="panel-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
      </div>
      <div>
        <div class="panel-title">Angle Code</div>
        <div class="panel-sub">Synced across devices</div>
      </div>
    </div>

    <div class="code-display">
      <span class="code-text">{code}</span>
      <div class="code-actions">
        <button class="code-icon-btn" onclick={handleCopy} aria-label={copied ? 'Copied' : 'Copy code'}>
          {#if copied}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--status-green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          {:else}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          {/if}
        </button>
        <button class="code-icon-btn" onclick={handleShare} aria-label="Share link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        </button>
      </div>
    </div>

    {@const sync = syncStatus()}
    <div class="status-row">
      <div class="status-dot" style="background:{sync.dot};"></div>
      <span class="status-text">{sync.text}</span>
      <button
        class="unlink-btn"
        class:unlink-confirm={confirmUnlink}
        onclick={handleUnlink}
      >
        {confirmUnlink ? 'Confirm unlink?' : 'Unlink'}
      </button>
    </div>

    <div class="privacy-note">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
      No account. No personal data. 90-day auto-delete.
    </div>
  {:else}
    <!-- Unlinked: create or enter code -->
    <div class="panel-header">
      <div class="panel-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
      </div>
      <div>
        <div class="panel-title">Read across devices</div>
        <div class="panel-sub">Pick up where you left off, anywhere</div>
      </div>
    </div>

    {#if !showInput}
      <button class="primary-btn" onclick={handleCreate} disabled={status === 'creating'}>
        {status === 'creating' ? 'Generating...' : 'Get my Angle Code'}
      </button>
      <button class="secondary-btn" onclick={() => { showInput = true; }}>
        I have a code
      </button>
    {:else}
      <div class="input-group">
        <input
          type="text"
          bind:value={inputCode}
          oninput={handleInputChange}
          onkeydown={handleInputKeydown}
          maxlength={6}
          placeholder="Enter code"
          class="code-input"
          autocomplete="off"
          autocapitalize="characters"
          inputmode="text"
          spellcheck="false"
        />
        <button class="primary-btn input-btn" onclick={handleLink} disabled={status === 'linking'}>
          {status === 'linking' ? '...' : 'Link'}
        </button>
      </div>
      <button class="secondary-btn" onclick={() => { showInput = false; errorMsg = ''; inputCode = ''; }}>
        Back
      </button>
    {/if}

    {#if status === 'error' && errorMsg}
      <div class="error-msg">{errorMsg}</div>
    {/if}

    {#if status === 'linked'}
      <div class="success-msg">Linked! Your reading state is synced.</div>
    {/if}

    <div class="privacy-note">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
      No account needed. No personal data collected.
    </div>
  {/if}
</div>

<style>
  .angle-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px;
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 4px;
  }

  .panel-icon {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    background: var(--bg-sunken);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--text-muted);
  }

  .panel-title {
    font-family: var(--font-display);
    font-size: var(--text-body);
    font-weight: 700;
    color: var(--text-primary);
  }

  .panel-sub {
    font-size: var(--text-sm);
    color: var(--text-muted);
    margin-top: 1px;
  }

  .code-display {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    background: var(--bg-sunken);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-subtle);
  }

  .code-text {
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 800;
    letter-spacing: 0.18em;
    color: var(--text-primary);
  }

  .code-actions {
    display: flex;
    gap: 4px;
  }

  .code-icon-btn {
    width: 36px;
    height: 36px;
    border: none;
    background: var(--bg-elevated);
    border-radius: var(--radius-sm);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    transition: color 0.15s, background 0.15s;
  }

  .code-icon-btn:hover {
    color: var(--text-primary);
    background: var(--border-subtle);
  }

  .status-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .status-text {
    font-size: var(--text-xs);
    color: var(--text-muted);
    flex: 1;
  }

  .unlink-btn {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--text-muted);
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    transition: color 0.15s;
  }

  .unlink-btn:hover { color: var(--text-secondary); }
  .unlink-btn.unlink-confirm { color: var(--score-critical); }

  .primary-btn {
    width: 100%;
    min-height: 46px;
    padding: 12px 20px;
    border: none;
    border-radius: var(--radius-pill);
    background: var(--text-primary);
    color: var(--bg);
    font-family: var(--font-display);
    font-size: var(--text-ui);
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .primary-btn:hover { opacity: 0.85; }
  .primary-btn:disabled { opacity: 0.5; cursor: default; }

  .secondary-btn {
    width: 100%;
    min-height: 42px;
    padding: 10px 20px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--text-secondary);
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }

  .secondary-btn:hover { background: var(--bg-elevated); }

  .input-group {
    display: flex;
    gap: 8px;
  }

  .code-input {
    flex: 1;
    min-height: 46px;
    padding: 0 16px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    background: var(--bg-sunken);
    color: var(--text-primary);
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-align: center;
    text-transform: uppercase;
  }

  .code-input:focus {
    outline: none;
    border-color: var(--score-warning);
  }

  .code-input::placeholder {
    font-size: var(--text-ui);
    font-weight: 400;
    letter-spacing: 0;
    text-transform: none;
    color: var(--text-muted);
  }

  .input-btn {
    width: auto;
    flex-shrink: 0;
    padding: 0 24px;
  }

  .error-msg {
    font-size: var(--text-sm);
    color: var(--score-critical);
    text-align: center;
  }

  .success-msg {
    font-size: var(--text-sm);
    color: var(--status-green);
    text-align: center;
    font-weight: 600;
  }

  .privacy-note {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: var(--text-xs);
    color: var(--text-muted);
    margin-top: 4px;
  }
</style>
