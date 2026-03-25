<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    score: number;
    height?: number;
    showLabel?: boolean;
  }
  let { score, height = 4, showLabel = false }: Props = $props();

  let mounted = $state(false);
  onMount(() => { requestAnimationFrame(() => { mounted = true; }); });

  let color = $derived(
    score >= 80 ? '#E03131' : score >= 60 ? '#B85C00' : score >= 40 ? '#1971C2' : '#6C757D'
  );
</script>

<div style="display:flex;align-items:center;gap:8px;">
  <div style="flex:1;height:{height}px;background:#F1F3F5;border-radius:{height/2}px;overflow:hidden;">
    <div style="height:100%;width:{mounted ? score : 0}%;background:{color};border-radius:{height/2}px;transition:width 0.6s cubic-bezier(.4,0,.2,1);"></div>
  </div>
  {#if showLabel}
    <span style="font-size:12px;font-weight:700;color:{color};min-width:28px;text-align:right;">{score}</span>
  {/if}
</div>
