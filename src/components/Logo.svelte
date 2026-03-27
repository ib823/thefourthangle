<script lang="ts">
  interface Props { size?: number; }
  let { size = 32 }: Props = $props();
</script>
<img src="/logo.png?v=2" alt="The Fourth Angle" width={size} height={Math.round(size * 1.11)} class="logo" />

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
