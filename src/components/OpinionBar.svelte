<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    score: number;
    height?: number;
    showLabel?: boolean;
  }
  let { score, height = 4, showLabel = false }: Props = $props();

  let fillWidth = $state(0);
  let displayScore = $state(0);
  let barEl: HTMLDivElement | undefined = $state(undefined);
  let animated = false;

  const reducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  let color = $derived(
    score >= 80 ? 'var(--score-critical)' : score >= 60 ? 'var(--score-warning)' : score >= 40 ? 'var(--score-info)' : 'var(--score-neutral)'
  );

  onMount(() => {
    if (reducedMotion) {
      fillWidth = score;
      displayScore = score;
      return;
    }

    // Animate when entering viewport
    if (!barEl) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !animated) {
        animated = true;
        animateFill();
        obs.disconnect();
      }
    }, { threshold: 0.3 });
    obs.observe(barEl);
    return () => obs.disconnect();
  });

  function animateFill() {
    const duration = 400;
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      // ease-out-expo: 1 - 2^(-10t)
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      fillWidth = score * eased;
      displayScore = Math.round(score * eased);
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        fillWidth = score;
        displayScore = score;
      }
    }
    requestAnimationFrame(tick);
  }
</script>

<div bind:this={barEl} style="display:flex;align-items:center;gap:8px;">
  <div style="flex:1;height:{height}px;background:var(--bg-sunken);border-radius:{height/2}px;overflow:hidden;">
    <div style="height:100%;width:{fillWidth}%;background:{color};border-radius:{height/2}px;"></div>
  </div>
  {#if showLabel}
    <span style="font-family:var(--font-display, 'Manrope', system-ui, sans-serif);font-size:12px;font-weight:700;color:{color};min-width:28px;text-align:right;">{displayScore}</span>
  {/if}
</div>
