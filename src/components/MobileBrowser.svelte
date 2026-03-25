<script lang="ts">
  import { onMount } from 'svelte';
  import MobileCard from './MobileCard.svelte';
  import { readIssues } from '../stores/reader';

  interface Props {
    issues: any[];
    onOpenIssue: (issue: any) => void;
  }
  let { issues, onOpenIssue }: Props = $props();

  let mounted = $state(false);
  onMount(() => {
    requestAnimationFrame(() => { mounted = true; });
    function onKeyDown(e: KeyboardEvent) {
      if (animating) return;
      if (e.key === 'ArrowDown' && current < issues.length - 1) { e.preventDefault(); commit('up'); }
      else if (e.key === 'ArrowUp' && current > 0) { e.preventDefault(); commit('down'); }
      else if (e.key === 'Enter') { e.preventDefault(); onOpenIssue(issues[current]); }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  let current = $state(0);
  let dragY = $state(0);
  let isDragging = $state(false);
  let readMap: Record<string, string> = $state({});

  function getState(id: string) {
    const raw = readMap[id];
    if (!raw) return null;
    if (raw === 'true') return { state: 'completed', progress: 6 };
    try { return JSON.parse(raw); } catch { return null; }
  }
  let animating = $state(false);

  let startY = 0;
  let startTime = 0;

  $effect(() => {
    const unsub = readIssues.subscribe(v => { readMap = { ...v }; });
    return unsub;
  });

  function onPointerDown(e: PointerEvent) {
    if ((e.target as HTMLElement)?.closest('button')) return;
    if (animating) return;
    isDragging = true;
    startY = e.clientY;
    startTime = Date.now();
    dragY = 0;
  }

  function onPointerMove(e: PointerEvent) {
    if (!isDragging) return;
    const dy = e.clientY - startY;
    const atStart = current === 0 && dy > 0;
    const atEnd = current === issues.length - 1 && dy < 0;
    dragY = dy * ((atStart || atEnd) ? 0.25 : 1);
  }

  function onPointerUp(e: PointerEvent) {
    if (!isDragging) return;
    isDragging = false;
    const dy = e.clientY - startY;
    const dt = (Date.now() - startTime) / 1000;
    const velocity = Math.abs(dy / dt);

    if (Math.abs(dragY) > 60 || velocity > 400) {
      if (dragY < 0 && current < issues.length - 1) {
        commit('up');
        return;
      } else if (dragY > 0 && current > 0) {
        commit('down');
        return;
      }
    }
    // Snap back
    dragY = 0;
  }

  function commit(dir: 'up' | 'down') {
    try { navigator.vibrate?.(10); } catch {}
    animating = true;
    // Exit phase
    dragY = dir === 'up' ? -window.innerHeight : window.innerHeight;

    setTimeout(() => {
      current = dir === 'up' ? current + 1 : current - 1;
      // Enter from opposite side
      dragY = dir === 'up' ? 80 : -80;

      requestAnimationFrame(() => {
        dragY = 0;
        setTimeout(() => { animating = false; }, 350);
      });
    }, 280);
  }

  let rotation = $derived(isDragging ? dragY * 0.008 : 0);
  let scale = $derived(isDragging ? Math.max(0.95, 1 - Math.abs(dragY) * 0.0003) : 1);

  let cardStyle = $derived.by(() => {
    if (isDragging) {
      return `transform:translateY(${dragY}px) rotate(${rotation}deg) scale(${scale});transition:none;`;
    }
    if (animating) {
      return `transform:translateY(${dragY}px) scale(1);transition:transform 0.35s cubic-bezier(.25,.1,.25,1);`;
    }
    return `transform:translateY(0) scale(1);transition:transform 0.35s cubic-bezier(.25,.1,.25,1);`;
  });
</script>

<div
  style="flex:1;display:flex;flex-direction:column;overflow:hidden;position:relative;"
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerUp}
>
  <!-- Card area — fixed height container so all cards are identical size -->
  <div style="flex:1;position:relative;touch-action:pan-y;padding:0 12px 12px;opacity:{mounted ? 1 : 0};transition:opacity 0.4s ease;">
    <!-- Third peek card behind -->
    {#if current < issues.length - 2}
      <div style="position:absolute;inset:0 12px 12px 12px;transform:scale(0.90) translateY(24px);opacity:0.3;pointer-events:none;border-radius:20px;overflow:hidden;backface-visibility:hidden;-webkit-backface-visibility:hidden;will-change:transform;transition:transform 0.35s cubic-bezier(.25,.1,.25,1),opacity 0.35s ease;">
        <MobileCard issue={issues[current + 2]} readState={getState(issues[current + 2].id)} onOpen={() => {}} />
      </div>
    {/if}

    <!-- Peek card behind -->
    {#if current < issues.length - 1}
      <div style="position:absolute;inset:0 12px 12px 12px;transform:scale(0.95) translateY(12px);opacity:0.6;pointer-events:none;border-radius:20px;overflow:hidden;backface-visibility:hidden;-webkit-backface-visibility:hidden;will-change:transform;transition:transform 0.35s cubic-bezier(.25,.1,.25,1),opacity 0.35s ease;">
        <MobileCard issue={issues[current + 1]} readState={getState(issues[current + 1].id)} onOpen={() => {}} />
      </div>
    {/if}

    <!-- Active card — fills the fixed container exactly -->
    {#key current}
      <div style="position:absolute;inset:0 12px 12px 12px;{cardStyle}will-change:transform;backface-visibility:hidden;-webkit-backface-visibility:hidden;">
        <MobileCard issue={issues[current]} readState={getState(issues[current].id)} onOpen={() => onOpenIssue(issues[current])} />
      </div>
    {/key}
  </div>
</div>
