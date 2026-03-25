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

  const stages = [
    { key: 'pa', label: 'PA', full: 'Analysis' },
    { key: 'ba', label: 'BA', full: 'Bias' },
    { key: 'fc', label: 'FC', full: 'Facts' },
    { key: 'af', label: 'AF', full: 'Framing' },
    { key: 'ct', label: 'CT', full: 'Stress' },
    { key: 'sr', label: 'SR', full: 'Synthesis' },
  ] as const;

  function dotColor(score: number | undefined): string {
    if (score === undefined) return '#CED4DA';
    if (score >= 75) return '#2B8A3E';
    if (score >= 50) return '#B85C00';
    return '#E03131';
  }

  function dotBg(score: number | undefined): string {
    if (score === undefined) return '#F1F3F5';
    if (score >= 75) return '#EBFBEE';
    if (score >= 50) return '#FFF4E6';
    return '#FFF5F5';
  }

  function scoreLabel(score: number): string {
    if (score >= 85) return 'Verified';
    if (score >= 70) return 'Reviewed';
    if (score >= 50) return 'Flagged';
    return 'Disputed';
  }
</script>

{#if scores && finalScore !== undefined}
  {#if compact}
    <!-- Compact: dots + score only, for card previews -->
    <div
      style="display:flex;align-items:center;gap:4px;"
      title="Neutrality: {finalScore}/100 — 6-stage editorial review"
    >
      {#each stages as stage}
        {@const val = scores[stage.key as keyof StageScores]}
        <div
          style="
            width:7px;height:7px;border-radius:50%;
            background:{dotColor(val)};
            opacity:0.85;
          "
          title="{stage.full}: {val}/100"
        ></div>
      {/each}
      <span style="
        font-family:var(--font-display, 'Manrope', system-ui, sans-serif);
        font-size:11px;font-weight:700;
        color:var(--text-tertiary, #6B5F4F);
        margin-left:4px;
      ">{finalScore}</span>
    </div>
  {:else}
    <!-- Full: stage labels + dots + score badge -->
    <div style="
      display:flex;align-items:center;gap:0;
      padding:10px 14px;
      background:var(--amber-bg, rgba(122,90,18,0.04));
      border:1px solid var(--border-light, rgba(44,34,21,0.05));
      border-radius:12px;
    ">
      <div style="display:flex;align-items:center;gap:8px;flex:1;">
        {#each stages as stage}
          {@const val = scores[stage.key as keyof StageScores]}
          <div style="display:flex;flex-direction:column;align-items:center;gap:3px;" title="{stage.full}: {val}/100">
            <div style="
              width:10px;height:10px;border-radius:50%;
              background:{dotColor(val)};
              box-shadow:0 0 0 2px {dotBg(val)};
            "></div>
            <span style="
              font-family:var(--font-display, 'Manrope', system-ui, sans-serif);
              font-size:8px;font-weight:600;
              color:var(--text-tertiary, #6B5F4F);
              letter-spacing:0.04em;
              text-transform:uppercase;
            ">{stage.label}</span>
          </div>
        {/each}
      </div>
      <div style="display:flex;align-items:baseline;gap:4px;margin-left:12px;">
        <span style="
          font-family:var(--font-display, 'Manrope', system-ui, sans-serif);
          font-size:16px;font-weight:700;
          color:var(--text-primary, #1F1A14);
        ">{finalScore}</span>
        <span style="
          font-family:var(--font-display, 'Manrope', system-ui, sans-serif);
          font-size:10px;font-weight:500;
          color:var(--text-tertiary, #6B5F4F);
        ">/100</span>
      </div>
    </div>
  {/if}
{/if}
