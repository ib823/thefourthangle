<script lang="ts">
  /**
   * Stage 1: Primary Analysis (PA)
   * Stage 2: Bias Audit (BA)
   * Stage 3: Fact Verification (FC)
   * Stage 4: Alternative Framing (AF)
   * Stage 5: Contrarian Stress-Test (CT)
   * Stage 6: Synthesis Review (SR)
   */

  interface StageScores {
    pa: number;
    ba: number;
    fc: number;
    af?: number;   // optional: legacy 6-stage issues
    ct?: number;   // optional: legacy 6-stage issues
    sr: number;
  }

  interface Props {
    scores?: StageScores;
    finalScore?: number;
    compact?: boolean;
  }

  let { scores, finalScore, compact = false }: Props = $props();
  const auditPanelId = 'editorial-audit-details';

  // #69: Tap-to-expand tooltip state
  let expandedStage: string | null = $state(null);
  let legendOpen = $state(false);

  const stages = [
    { key: 'pa', label: 'PA', full: 'Primary Analysis', description: 'Checks whether the core claim is framed clearly before interpretation starts.' },
    { key: 'ba', label: 'BA', full: 'Bias Audit', description: 'Looks for slant, omission, or loaded framing that could tilt the reader early.' },
    { key: 'fc', label: 'FC', full: 'Fact Check', description: 'Verifies whether the article’s central factual claims hold up against source material.' },
    { key: 'af', label: 'AF', full: 'Alternative Framing', description: 'Tests whether a credible competing frame changes the meaning of the story.' },
    { key: 'ct', label: 'CT', full: 'Stress Test', description: 'Pushes the argument against the strongest counter-case available.' },
    { key: 'sr', label: 'SR', full: 'Synthesis Review', description: 'Assesses whether the final view stays fair after the earlier checks.' },
  ] as const;

  // Show only stages that actually have a score. Legacy issues carry all 6;
  // new issues carry 4 (pa/ba/fc/sr) after the af/ct stages were retired.
  const visibleStages = $derived(
    stages.filter((s) => scores?.[s.key as keyof StageScores] !== undefined)
  );
  const stageCount = $derived(visibleStages.length);

  function dotColor(score: number | undefined): string {
    if (score === undefined) return 'var(--border-divider)';
    if (score >= 75) return 'var(--status-green)';
    if (score >= 50) return 'var(--score-warning)';
    return 'var(--score-critical)';
  }

  function dotBg(score: number | undefined): string {
    if (score === undefined) return 'var(--bg-sunken)';
    if (score >= 75) return 'var(--status-green-bg)';
    if (score >= 50) return 'var(--verdict-amber-bg)';
    return 'var(--verdict-red-bg)';
  }

  function scoreLabel(score: number): string {
    if (score >= 85) return 'Verified';
    if (score >= 70) return 'Reviewed';
    if (score >= 50) return 'Flagged';
    return 'Disputed';
  }

  // #74: Shape based on score tier (circle/triangle/diamond) for color-blind accessibility
  function dotShape(score: number | undefined): 'circle' | 'triangle' | 'diamond' {
    if (score === undefined) return 'circle';
    if (score >= 75) return 'circle';
    if (score >= 50) return 'triangle';
    return 'diamond';
  }

  function toggleExpand(key: string) {
    expandedStage = expandedStage === key ? null : key;
  }
</script>

{#if scores && finalScore !== undefined}
  {#if compact}
    <!-- Compact: shaped dots + score, for feed cards -->
    <div
      style="display:flex;align-items:center;gap:4px;"
      role="group"
      aria-label="Neutrality: {finalScore} out of 100 — {stageCount}-stage editorial review"
    >
      {#each visibleStages as stage}
        {@const val = scores[stage.key as keyof StageScores]}
        {@const shape = dotShape(val)}
        {#if shape === 'circle'}
          <div style="width:7px;height:7px;border-radius: var(--radius-round);background:{dotColor(val)};opacity:0.85;" role="img" aria-label="{stage.full}: {val !== undefined ? val + '/100' : 'N/A'}{val !== undefined ? ' — ' + scoreLabel(val) : ''}"></div>
        {:else if shape === 'triangle'}
          <div style="width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-bottom:7px solid {dotColor(val)};opacity:0.85;" role="img" aria-label="{stage.full}: {val}/100 — {scoreLabel(val)}"></div>
        {:else}
          <div style="width:6px;height:6px;background:{dotColor(val)};transform:rotate(45deg);opacity:0.85;" role="img" aria-label="{stage.full}: {val}/100 — {scoreLabel(val)}"></div>
        {/if}
      {/each}
      <span style="font-family:var(--font-display, 'Manrope', system-ui, sans-serif);font-size: var(--text-xs);font-weight:700;color:var(--text-tertiary);margin-left:4px;">{finalScore}</span>
    </div>
  {:else}
    <!-- Full: shaped dots + labels + tap-to-expand tooltips -->
    <div
      style="display:flex;flex-direction:column;gap:0;padding:8px 10px;background:var(--amber-bg);border:1px solid var(--border-light);border-radius: var(--radius-lg);"
      role="group"
      aria-label="{stageCount}-stage editorial review — Neutrality: {finalScore} out of 100"
    >
      <div style="display:flex;align-items:center;gap:0;">
        <div style="display:flex;align-items:center;gap:4px;flex:1;">
          {#each visibleStages as stage}
            {@const val = scores[stage.key as keyof StageScores]}
            {@const shape = dotShape(val)}
            <!-- #69: Tap-to-expand tooltip -->
            <button
              onclick={() => toggleExpand(stage.key)}
              style="display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:none;cursor:pointer;padding:4px 2px;min-width:36px;min-height:44px;justify-content:center;"
              aria-label="{stage.full}: {val}/100 — {scoreLabel(val)}"
              aria-expanded={expandedStage === stage.key}
              aria-controls={auditPanelId}
            >
              {#if shape === 'circle'}
                <div style="width:10px;height:10px;border-radius: var(--radius-round);background:{dotColor(val)};box-shadow:0 0 0 2px {dotBg(val)};"></div>
              {:else if shape === 'triangle'}
                <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:10px solid {dotColor(val)};filter:drop-shadow(0 0 2px {dotBg(val)});"></div>
              {:else}
                <div style="width:8px;height:8px;background:{dotColor(val)};transform:rotate(45deg);box-shadow:0 0 0 2px {dotBg(val)};"></div>
              {/if}
              <span style="font-family:var(--font-display);font-size: var(--text-micro);font-weight:600;color:var(--text-tertiary);letter-spacing:0.04em;text-transform:uppercase;">{stage.label}</span>
            </button>
          {/each}
        </div>
        <div style="display:flex;align-items:baseline;gap:4px;margin-left:12px;">
          <span style="font-family:var(--font-display);font-size: var(--text-body-lg);font-weight:700;color:var(--text-primary);">{finalScore}</span>
          <span style="font-family:var(--font-display);font-size: var(--text-micro);font-weight: 600;color:var(--text-tertiary);">/100</span>
        </div>
        <button onclick={() => { legendOpen = !legendOpen; }} aria-label="How to read the audit" aria-expanded={legendOpen} style="width:24px;height:24px;border-radius:var(--radius-round);border:1px solid var(--border-subtle);background:var(--bg-elevated);color:var(--text-muted);font-size:var(--text-xs);font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-left:4px;">?</button>
      </div>

      {#if legendOpen}
        <div style="margin-top:8px;padding:8px 0 2px;border-top:1px solid var(--border-light);display:flex;flex-direction:column;gap:6px;">
          <div style="font-size:var(--text-xs);font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;">How to read this</div>
          <div style="display:flex;align-items:center;gap:8px;font-size:var(--text-xs);color:var(--text-secondary);">
            <div style="width:10px;height:10px;border-radius:var(--radius-round);background:var(--status-green);flex-shrink:0;"></div>
            <span><strong>Circle</strong> — Balanced (75+)</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;font-size:var(--text-xs);color:var(--text-secondary);">
            <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:10px solid var(--score-warning);flex-shrink:0;"></div>
            <span><strong>Triangle</strong> — Flagged (50–74)</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;font-size:var(--text-xs);color:var(--text-secondary);">
            <div style="width:8px;height:8px;background:var(--score-strong);transform:rotate(45deg);flex-shrink:0;"></div>
            <span><strong>Diamond</strong> — Alert (&lt;50)</span>
          </div>
          <div style="font-size:var(--text-xs);color:var(--text-muted);line-height:1.5;margin-top:2px;">Tap any stage label above to see its score and what it tested.</div>
        </div>
      {/if}

      <!-- #69: Expanded tooltip -->
      <div
        id={auditPanelId}
        hidden={!expandedStage}
        style="margin-top:8px;padding:8px 0 2px;border-top:1px solid var(--border-light);display:flex;flex-direction:column;gap:4px;"
      >
        {#if expandedStage}
          {@const val = scores[expandedStage as keyof StageScores]}
          {@const stage = stages.find(s => s.key === expandedStage)}
          {#if stage && val !== undefined}
            <div style="font-size: var(--text-xs);color:var(--text-secondary);display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span style="font-weight:600;color:var(--text-primary);">{stage.full}</span>
              <span style="color:{dotColor(val)};font-weight:700;">{val}/100</span>
              <span style="color:var(--text-muted);">— {scoreLabel(val)}</span>
            </div>
            <div style="font-size: var(--text-xs);line-height:1.5;color:var(--text-secondary);">{stage.description}</div>
        {/if}
        {/if}
      </div>
    </div>
  {/if}
{/if}
