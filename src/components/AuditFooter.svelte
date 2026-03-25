<script lang="ts">
  import type { AuditData } from '../lib/types';

  interface Props {
    audit: AuditData;
    sources?: string;
    confidence?: string;
    lenses?: string[];
  }
  let { audit, sources = '', confidence = '', lenses = [] }: Props = $props();

  let showBias = $state(false);
  let showSources = $state(false);

  const biasLabels: Record<string, string> = {
    s: 'Tone', p: 'Political', e: 'Ethnic', r: 'Religious',
    f: 'Narrative', o: 'Completeness', t: 'Timing', c: 'Certainty',
    sd: 'Sources', g: 'Geographic', ec: 'Economic', ga: 'Gender'
  };

  function scoreColor(score: number) {
    if (score >= 80) return '#5B8A3C';
    if (score >= 65) return 'var(--amber)';
    return '#B54A32';
  }
</script>

<div style="background:rgba(44,34,21,0.025);border-radius:16px;padding:20px;margin:16px 0;">
  <span style="font-size:10px;text-transform:uppercase;letter-spacing:0.14em;color:var(--amber);font-weight:600;display:block;margin-bottom:14px;">AUDIT TRANSPARENCY</span>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
    {#each [
      { label: 'Final Score', value: audit.finalScore, color: scoreColor(audit.finalScore) },
      { label: 'Conflict K', value: audit.conflictK, color: 'var(--text-primary)' },
      { label: 'Factual', value: audit.factual, color: scoreColor(audit.factual) },
      { label: 'Balance', value: audit.balance, color: scoreColor(audit.balance) },
      { label: 'Completeness', value: audit.completeness, color: scoreColor(audit.completeness) },
      { label: 'Courage', value: audit.courage, color: scoreColor(audit.courage) },
    ] as item}
      <div style="background:var(--card);border-radius:10px;padding:12px;text-align:center;">
        <div style="font-family:var(--font-display);font-size:24px;font-weight:700;color:{item.color};">
          {typeof item.value === 'number' && item.value < 1 && item.label === 'Conflict K' ? item.value.toFixed(2) : item.value}
        </div>
        <div style="font-size:10px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.06em;margin-top:2px;">{item.label}</div>
        <div style="height:3px;background:var(--border);border-radius:2px;margin-top:6px;overflow:hidden;">
          <div style="height:100%;width:{Math.min((typeof item.value === 'number' && item.value <= 1 ? item.value * 100 : item.value), 100)}%;background:{item.color};border-radius:2px;"></div>
        </div>
      </div>
    {/each}
  </div>

  <button onclick={() => showBias = !showBias} style="display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;font-size:13px;font-weight:600;color:var(--amber);padding:8px 0;min-height:44px;width:100%;text-align:left;">
    {showBias ? 'Hide' : 'Show'} bias vector
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" style="transform:rotate({showBias ? 180 : 0}deg);transition:transform 0.2s;"><polyline points="2 3 5 7 8 3"/></svg>
  </button>

  {#if showBias}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px;">
      {#each Object.entries(audit.biasVector) as [key, val]}
        <div style="display:flex;justify-content:space-between;align-items:center;background:var(--card);border-radius:6px;padding:8px 10px;font-size:12px;">
          <span style="color:var(--text-secondary);">{biasLabels[key] || key}</span>
          <span style="font-family:var(--font-display);font-weight:600;color:{Math.abs(val as number) > 0.3 ? '#ef4444' : 'var(--text-primary)'};">{(val as number).toFixed(2)}</span>
        </div>
      {/each}
    </div>
  {/if}

  <button onclick={() => showSources = !showSources} style="display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;font-size:13px;font-weight:600;color:var(--amber);padding:8px 0;min-height:44px;width:100%;text-align:left;">
    {showSources ? 'Hide' : 'View'} sources
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" style="transform:rotate({showSources ? 180 : 0}deg);transition:transform 0.2s;"><polyline points="2 3 5 7 8 3"/></svg>
  </button>

  {#if showSources}
    <div style="background:var(--card);border-radius:8px;padding:12px;margin-bottom:12px;">
      <p style="font-size:13px;color:var(--text-secondary);line-height:1.6;margin:0;">{sources}</p>
    </div>
  {/if}

  <div style="display:flex;flex-direction:column;gap:6px;margin:12px 0;font-size:12px;color:var(--text-secondary);">
    <div style="display:flex;justify-content:space-between;"><span>Confidence</span><span style="font-weight:600;">{confidence}</span></div>
    <div style="display:flex;justify-content:space-between;"><span>Lenses</span><span style="font-weight:600;">{lenses.join(', ')}</span></div>
    <div style="display:flex;justify-content:space-between;"><span>Review stages</span><span style="font-weight:600;">6 (adversarial editorial pipeline)</span></div>
    <div style="display:flex;justify-content:space-between;"><span>Independence index</span><span style="font-weight:600;">{audit.independence.toFixed(2)}</span></div>
    <div style="display:flex;justify-content:space-between;"><span>Claims established</span><span style="font-weight:600;">{audit.claimsEstablished}</span></div>
    <div style="display:flex;justify-content:space-between;"><span>Claims hedged</span><span style="font-weight:600;">{audit.claimsHedged}</span></div>
    <div style="display:flex;justify-content:space-between;"><span>Claims disputed</span><span style="font-weight:600;">{audit.claimsDisputed}</span></div>
  </div>

  <div style="background:var(--amber-bg);border:1px solid rgba(139,101,8,0.12);border-radius:10px;padding:14px;margin-top:14px;">
    <p style="font-size:12px;line-height:1.6;color:var(--text-primary);margin:0;font-style:italic;">We do not claim neutrality. We claim measurable balance across 12 published dimensions, verified factual accuracy, quantified inter-stage conflict, and radical transparency about our methodology and its limits.</p>
  </div>
</div>
