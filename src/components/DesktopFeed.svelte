<script lang="ts">
  import FeedRow from './FeedRow.svelte';
  import { getReadCount } from '../stores/reader';

  interface Props {
    issues: any[];
    activeId: string | null;
    readMap: Record<string, string>;
    onSelectIssue: (issue: any) => void;
  }
  let { issues, activeId, readMap, onSelectIssue }: Props = $props();

  function issueReadState(id: string): { state: string; progress: number } | null {
    const raw = readMap[id];
    if (!raw) return null;
    if (raw === 'true') return { state: 'completed', progress: 6 };
    try { return JSON.parse(raw); } catch { return null; }
  }

  let counts = $derived(getReadCount(readMap));
  let readCount = $derived(counts.completed);
</script>

<aside aria-label="Issue list" style="width:360px;height:100vh;overflow-y:auto;border-right:1px solid #F1F3F5;flex-shrink:0;background:#FFFFFF;display:flex;flex-direction:column;">
  <div style="padding:16px 20px 8px;flex-shrink:0;">
    <h2 style="font-size:11px;font-weight:600;color:#6C757D;letter-spacing:0.5px;text-transform:uppercase;margin:0;">{issues.length} Issues</h2>
  </div>
  <div style="flex:1;overflow-y:auto;">
    {#each issues as issue}
      <FeedRow {issue} readState={issueReadState(issue.id)} isActive={activeId === issue.id} onClick={() => onSelectIssue(issue)} />
    {/each}
  </div>
  <div style="padding:12px 20px;border-top:1px solid #F1F3F5;flex-shrink:0;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
      <span style="font-size:11px;color:#6C757D;">{issues.length} issues</span>
    </div>
    <div style="height:3px;background:#F1F3F5;border-radius:2px;overflow:hidden;">
      <div style="height:100%;width:{(readCount / issues.length) * 100}%;background:#2B8A3E;border-radius:2px;transition:width 0.4s ease;"></div>
    </div>
    <div style="font-size:10px;color:#6C757D;margin-top:6px;text-align:center;">
      Press ↑↓ to navigate · Enter to read
    </div>
    <div style="font-size:11px;color:#6C757D;margin-top:8px;text-align:center;">
      <a href="/about" style="color:#6C757D;text-decoration:none;">About</a>
    </div>
  </div>
</aside>
