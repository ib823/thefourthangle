<script lang="ts">
  import { readIssues } from '../stores/reader';
  import { ISSUES } from '../data/issues';

  let readCount = $state(0);
  $effect(() => {
    const unsub = readIssues.subscribe(val => {
      readCount = Object.values(val).filter(v => {
        if (!v) return false;
        if (v === 'true') return true;
        try { return JSON.parse(v).state === 'completed'; } catch { return false; }
      }).length;
    });
    return unsub;
  });

  let remaining = $derived((ISSUES.length - readCount) * 2);
</script>

<div style="flex:1;display:flex;flex-direction:column;position:relative;">
  <div style="flex:1;display:flex;align-items:center;padding-left:40px;">
    <div style="max-width:480px;">
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:var(--text-tertiary);letter-spacing:1px;">Edition — March 2026</div>
      <div style="height:12px;"></div>
      <div style="font-size:20px;font-weight:400;color:var(--text-primary);font-style:italic;line-height:1.5;">The real minority is anyone still reading past the headline.</div>
      <div style="height:24px;"></div>
      <div style="font-size:13px;color:var(--text-tertiary);">~{remaining} min of reading remaining</div>
      <div style="height:24px;"></div>
      <div style="font-size:13px;color:var(--text-muted);">Select an issue from the feed</div>
      <div style="height:20px;"></div>
      <a href="/about" style="font-size:12px;color:var(--text-tertiary);text-decoration:none;">About</a>
    </div>
  </div>
</div>
