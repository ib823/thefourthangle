<script lang="ts">
  interface Props {
    issueId: string;
  }
  let { issueId }: Props = $props();

  let fingerprint = $state('');
  let copied = $state(false);
  let loaded = $state(false);

  $effect(() => {
    // Reset on issue change
    fingerprint = '';
    loaded = false;
    copied = false;

    fetch('/signatures.json')
      .then(r => r.json())
      .then(data => {
        const issue = data.issues?.[issueId];
        if (issue) {
          fingerprint = issue.fingerprint;
          loaded = true;
        }
      })
      .catch(() => {});
  });

  function copyFingerprint() {
    navigator.clipboard.writeText(fingerprint).then(() => {
      copied = true;
      setTimeout(() => { copied = false; }, 2000);
    }).catch(() => {});
  }
</script>

{#if loaded}
  <div style="margin-top:12px;padding:12px 14px;background:var(--amber-bg);border:1px solid var(--border-light);border-radius:10px;">
    <div style="font-size:10px;color:var(--text-muted);margin-bottom:6px;">Content integrity — verify this issue hasn't been altered</div>
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--amber);flex-shrink:0;">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
    <span style="font-family:monospace;font-size:11px;color:var(--text-tertiary);letter-spacing:0.02em;">
      SHA-256: {fingerprint.slice(0, 16)}...
    </span>
    <button
      onclick={copyFingerprint}
      style="background:none;border:1px solid var(--border-subtle);border-radius:6px;padding:8px 12px;font-size:11px;color:var(--text-tertiary);cursor:pointer;white-space:nowrap;min-height:44px;display:flex;align-items:center;"
    >
      {copied ? 'Copied' : 'Copy hash'}
    </button>
    <a
      href="/verify.html"
      style="font-size:11px;color:var(--amber);text-decoration:none;white-space:nowrap;"
    >
      Verify
    </a>
    </div>
  </div>
{/if}
