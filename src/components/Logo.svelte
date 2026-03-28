<script lang="ts">
  interface Props { size?: number; }
  let { size = 32 }: Props = $props();
</script>
<img src="/logo.png?v=4" alt="The Fourth Angle" width={size} height={size} class="logo" />

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
