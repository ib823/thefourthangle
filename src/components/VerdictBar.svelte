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
    af: number;
    ct: number;
    sr: number;
  }

  interface Props {
    scores?: StageScores;
    finalScore?: number;
    compact?: boolean;
  }

  let { scores, finalScore, compact = false }: Props = $props();

  // #69: Tap-to-expand tooltip state
  let expandedStage: string | null = $state(null);

  const stages = [
    { key: 'pa', label: 'PA', full: 'Primary Analysis' },
    { key: 'ba', label: 'BA', full: 'Bias Audit' },
    { key: 'fc', label: 'FC', full: 'Fact Check' },
    { key: 'af', label: 'AF', full: 'Alt. Framing' },
    { key: 'ct', label: 'CT', full: 'Stress Test' },
    { key: 'sr', label: 'SR', full: 'Synthesis' },
  ] as const;

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
      aria-label="Neutrality: {finalScore} out of 100 — 6-stage editorial review"
    >
      {#each stages as stage}
        {@const val = scores[stage.key as keyof StageScores]}
        {@const shape = dotShape(val)}
        {#if shape === 'circle'}
          <div style="width:7px;height:7px;border-radius:50%;background:{dotColor(val)};opacity:0.85;" role="img" aria-label="{stage.full}: {val !== undefined ? val + '/100' : 'N/A'}{val !== undefined ? ' — ' + scoreLabel(val) : ''}"></div>
        {:else if shape === 'triangle'}
          <div style="width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-bottom:7px solid {dotColor(val)};opacity:0.85;" role="img" aria-label="{stage.full}: {val}/100 — {scoreLabel(val)}"></div>
        {:else}
          <div style="width:6px;height:6px;background:{dotColor(val)};transform:rotate(45deg);opacity:0.85;" role="img" aria-label="{stage.full}: {val}/100 — {scoreLabel(val)}"></div>
        {/if}
      {/each}
      <span style="font-family:var(--font-display, 'Manrope', system-ui, sans-serif);font-size:11px;font-weight:700;color:var(--text-tertiary);margin-left:4px;">{finalScore}</span>
    </div>
  {:else}
    <!-- Full: shaped dots + labels + tap-to-expand tooltips -->
    <div
      style="display:flex;flex-direction:column;gap:0;padding:10px 14px;background:var(--amber-bg);border:1px solid var(--border-light);border-radius:12px;"
      role="group"
      aria-label="6-stage editorial review — Neutrality: {finalScore} out of 100"
    >
      <div style="display:flex;align-items:center;gap:0;">
        <div style="display:flex;align-items:center;gap:8px;flex:1;">
          {#each stages as stage}
            {@const val = scores[stage.key as keyof StageScores]}
            {@const shape = dotShape(val)}
            <!-- #69: Tap-to-expand tooltip -->
            <button
              onclick={() => toggleExpand(stage.key)}
              style="display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:none;cursor:pointer;padding:4px 2px;min-width:28px;min-height:44px;justify-content:center;"
              aria-label="{stage.full}: {val}/100 — {scoreLabel(val)}"
              aria-expanded={expandedStage === stage.key}
            >
              {#if shape === 'circle'}
                <div style="width:10px;height:10px;border-radius:50%;background:{dotColor(val)};box-shadow:0 0 0 2px {dotBg(val)};"></div>
              {:else if shape === 'triangle'}
                <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:10px solid {dotColor(val)};filter:drop-shadow(0 0 2px {dotBg(val)});"></div>
              {:else}
                <div style="width:8px;height:8px;background:{dotColor(val)};transform:rotate(45deg);box-shadow:0 0 0 2px {dotBg(val)};"></div>
              {/if}
              <span style="font-family:var(--font-display);font-size:8px;font-weight:600;color:var(--text-tertiary);letter-spacing:0.04em;text-transform:uppercase;">{stage.label}</span>
            </button>
          {/each}
        </div>
        <div style="display:flex;align-items:baseline;gap:4px;margin-left:12px;">
          <span style="font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--text-primary);">{finalScore}</span>
          <span style="font-family:var(--font-display);font-size:10px;font-weight:500;color:var(--text-tertiary);">/100</span>
        </div>
      </div>

      <!-- #69: Expanded tooltip -->
      {#if expandedStage}
        {@const val = scores[expandedStage as keyof StageScores]}
        {@const stage = stages.find(s => s.key === expandedStage)}
        {#if stage && val !== undefined}
          <div style="margin-top:6px;padding:6px 0 2px;border-top:1px solid var(--border-light);font-size:11px;color:var(--text-secondary);display:flex;align-items:center;gap:6px;">
            <span style="font-weight:600;color:var(--text-primary);">{stage.full}</span>
            <span style="color:{dotColor(val)};font-weight:700;">{val}/100</span>
            <span style="color:var(--text-muted);">— {scoreLabel(val)}</span>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
{/if}
