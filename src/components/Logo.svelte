<script lang="ts">
  interface Props { size?: number; }
  let { size = 32 }: Props = $props();
</script>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 669 669" height={size} width={Math.round(size * 1)} class="logo" aria-label="T4A">
  <path d="M45 191 L45 247 L138 248 L138 491 L200 491 L200 247 L295 246 L329 191 Z" fill="currentColor"/>
  <path d="M227 393 L227 437 L305 438 L277 491 L350 491 L380 437 L539 437 L567 491 L629 491 L635 479 L493 191 L443 191 L348 360 L413 360 L460 275 L511 378 L317 377 L426 192 L359 191 Z" fill="currentColor"/>
</svg>

<style>
  .logo {
    display: block;
    color: var(--text-primary);
  }
</style>
