<script lang="ts">
  import { onMount } from 'svelte';
  import OpinionBar from './OpinionBar.svelte';
  import VerdictBar from './VerdictBar.svelte';

  interface Props {
    issue: any;
    index: number;
    readState: any;
    onOpen: () => void;
  }
  let { issue, index, readState, onOpen }: Props = $props();

  let isCompleted = $derived(readState?.state === 'completed');
  let isStarted = $derived(readState?.state === 'started');

  let visible = $state(false);
  let hovered = $state(false);
  let cardEl: HTMLDivElement | undefined = $state(undefined);

  const dotColors = ['#868E96', '#1971C2', '#1971C2', '#1971C2', '#E03131', '#7048E8'];

  const reducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  onMount(() => {
    if (reducedMotion) {
      visible = true;
      return;
    }

    // Stagger by grid position: row * 80 + col * 40
    const col = index % 2;
    const row = Math.floor(index / 2);
    const delay = Math.min(row * 80 + col * 40, 400);

    if (!cardEl) { visible = true; return; }

    // Only animate if in viewport
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setTimeout(() => { visible = true; }, delay);
        obs.disconnect();
      }
    }, { threshold: 0.1 });
    obs.observe(cardEl);
    return () => obs.disconnect();
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={cardEl}
  onclick={onOpen}
  onmouseenter={() => hovered = true}
  onmouseleave={() => hovered = false}
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
  role="article"
  tabindex="0"
  aria-label="{issue.headline}. Opinion Shift {issue.opinionShift}."
  style="
    background:{isCompleted ? '#FCFCFC' : '#FFFFFF'};border-radius:16px;padding:18px;cursor:pointer;
    box-shadow:{hovered ? '0 8px 30px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)'};
    transform:{visible ? (hovered ? 'translateY(-3px) scale(1.006)' : 'translateY(0) scale(1)') : 'translateY(24px)'};
    opacity:{visible ? 1 : 0};
    transition:transform var(--duration-medium, 350ms) var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)), opacity var(--duration-medium, 350ms) var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)), box-shadow var(--duration-fast, 150ms) var(--ease-out-cubic, ease-out);
    content-visibility:auto;
    contain-intrinsic-size:0 200px;
  "
>
  <div style="display:flex;align-items:center;gap:6px;">
    {#if issue.status === 'new'}
      <span style="font-size:10px;font-weight:700;color:#2B8A3E;background:#EBFBEE;padding:2px 7px;border-radius:6px;text-transform:uppercase;letter-spacing:0.04em;">New</span>
    {:else if issue.status === 'updated'}
      <span style="font-size:10px;font-weight:700;color:#1864AB;background:#E7F5FF;padding:2px 7px;border-radius:6px;text-transform:uppercase;letter-spacing:0.04em;">Updated</span>
    {/if}
    {#if issue.edition > 1}
      <span style="font-size:10px;color:#6C757D;">Ed.{issue.edition}</span>
    {/if}
    <div style="flex:1;"></div>
    {#if isStarted}
      <div style="display:flex;align-items:center;gap:4px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;"><circle cx="12" cy="12" r="9" stroke="#B85C00" stroke-width="2" fill="none"/><path d="M12 3a9 9 0 0 1 0 18" fill="#B85C00"/></svg>
        <span style="font-size:9px;font-weight:600;color:#B85C00;">Exploring</span>
      </div>
    {:else if isCompleted}
      <div style="display:flex;align-items:center;gap:4px;">
        <div style="width:16px;height:16px;border-radius:50%;background:#EBFBEE;display:flex;align-items:center;justify-content:center;">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#2B8A3E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <span style="font-size:9px;font-weight:600;color:#2B8A3E;">Covered</span>
      </div>
    {/if}
  </div>
  <h3 style="font-size:15px;font-weight:600;color:#212529;margin:10px 0 0;line-height:1.35;">{issue.headline}</h3>
  <p style="font-size:12px;color:#5A5F64;line-height:1.55;margin:6px 0 0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">{issue.context}</p>
  <div style="display:flex;align-items:center;gap:8px;margin-top:12px;">
    <div style="flex:1;">
      <OpinionBar score={issue.opinionShift} showLabel={true} />
      <div style="font-size:9px;color:#6C757D;margin-top:2px;">Opinion Shift</div>
    </div>
    {#if issue.stageScores && issue.finalScore}
      <VerdictBar scores={issue.stageScores} finalScore={issue.finalScore} compact={true} />
    {:else}
      <div style="display:flex;align-items:center;gap:3px;">
        {#each dotColors as c}
          <div style="width:4px;height:4px;border-radius:50%;background:{c};opacity:{hovered ? 1 : 0.4};transition:opacity var(--duration-fast, 150ms) var(--ease-out-cubic, ease-out);"></div>
        {/each}
        <span style="font-size:10px;color:#6C757D;margin-left:4px;opacity:{hovered ? 1 : 0};transition:opacity var(--duration-fast, 150ms) var(--ease-out-cubic, ease-out);">6 ideas</span>
      </div>
    {/if}
  </div>
</div>
