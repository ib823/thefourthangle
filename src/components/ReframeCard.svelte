<script lang="ts">
  import CardShell from './CardShell.svelte';

  interface Props {
    h?: string;
    s?: string;
  }
  let { h = '', s = '' }: Props = $props();
</script>

<CardShell variant="accent">
  <div style="background:linear-gradient(180deg, #FCF7EC 0%, #F6EFE1 100%);border:1px solid var(--amber-light);padding:30px;">
    <span style="font-size:10px;text-transform:uppercase;letter-spacing:0.16em;color:var(--amber);font-weight:600;display:block;margin-bottom:12px;">&#x2B25; THE FOURTH ANGLE</span>
    {#if h}
      <h3 style="font-family:var(--font-display);font-size:30px;font-weight:700;color:var(--text-primary);margin:0 0 12px 0;line-height:1.18;">{h}</h3>
    {/if}
    {#if s}
      <p style="font-size:17px;color:var(--text-primary);line-height:1.85;margin:0;">{s}</p>
    {/if}
  </div>
</CardShell>
