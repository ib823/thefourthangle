<script lang="ts">
  import CardShell from './CardShell.svelte';

  interface Props {
    text?: string;
    sub?: string;
  }
  let { text = '', sub = '' }: Props = $props();
</script>

<CardShell variant="dark">
  <div style="background:linear-gradient(180deg, var(--card-dark) 0%, var(--card-dark-end) 100%);padding:32px;min-height:200px;display:flex;flex-direction:column;justify-content:center;">
    {#if text}
      <p style="font-family:var(--font-display);font-size:32px;font-weight:700;color:var(--text-on-dark);line-height:1.22;margin:0;">{text}</p>
    {/if}
    {#if sub}
      <div style="border-top:1px solid rgba(245,240,232,0.12);margin:18px 0;"></div>
      <p style="font-family:var(--font-body);font-size:17px;color:rgba(248,245,239,0.9);line-height:1.85;margin:0;">{sub}</p>
    {/if}
  </div>
</CardShell>
