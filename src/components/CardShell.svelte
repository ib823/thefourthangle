<script lang="ts">
  import { onMount } from 'svelte';

  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'light' | 'dark' | 'accent';
    children: Snippet;
  }
  let { variant = 'light', children }: Props = $props();

  let el = $state<HTMLDivElement | null>(null);
  let visible = $state(false);

  onMount(() => {
    requestAnimationFrame(() => { visible = true; });
  });

  const shadows: Record<string, string> = {
    light: '0 8px 24px rgba(31,26,20,0.05)',
    dark: '0 12px 32px rgba(31,26,20,0.12)',
    accent: 'none',
  };
</script>

<div
  bind:this={el}
  style="border-radius:22px;box-shadow:{shadows[variant]};overflow:hidden;transition:opacity 0.35s ease, transform 0.35s ease;opacity:{visible ? 1 : 0};transform:{visible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.98)'};"
>
  {@render children()}
</div>
