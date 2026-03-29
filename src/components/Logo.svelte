<script lang="ts">
  interface Props { size?: number; }
  let { size = 32 }: Props = $props();
</script>
<img src="/logo.png?v=5" alt="The Fourth Angle" height={size} width={Math.round(size * 2.48)} class="logo" />

<style>
  .logo {
    display: block;
  }
  @media (prefers-color-scheme: dark) {
    .logo {
      filter: invert(1);
    }
  }
</style>
