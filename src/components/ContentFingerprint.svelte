<script lang="ts">
  interface Props {
    issueSlug: string;
  }
  let { issueSlug }: Props = $props();

  let fingerprint = $state('');
  let copied = $state(false);
  let loaded = $state(false);

  $effect(() => {
    fetch('/signatures.json')
      .then(r => r.json())
      .then(data => {
        const issue = data.issues?.[issueSlug];
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
    });
  }
</script>

{#if loaded}
  <div style="margin-top:12px;padding:12px 14px;background:rgba(44,34,21,0.02);border-radius:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-tertiary);flex-shrink:0;">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
    </svg>
    <span style="font-family:monospace;font-size:11px;color:var(--text-tertiary);letter-spacing:0.02em;">
      {fingerprint.slice(0, 16)}...
    </span>
    <button
      onclick={copyFingerprint}
      style="background:none;border:1px solid var(--border);border-radius:6px;padding:8px 12px;font-size:11px;color:var(--text-tertiary);cursor:pointer;white-space:nowrap;min-height:44px;display:flex;align-items:center;"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
    <a
      href="/verify.html"
      style="font-size:11px;color:var(--amber);text-decoration:none;white-space:nowrap;"
    >
      How to verify
    </a>
  </div>
{/if}
