<script lang="ts">
  interface Props { size?: number; }
  let { size = 36 }: Props = $props();
  // Locked vector glyph bounds: x 186-773 (w587), y 363-595 (h232)
  // Aspect ratio ~2.53:1 — width prop controls the height proportionally
  const aspect = 587 / 232;
</script>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="176 350 607 258" width={size} height={Math.round(size / aspect)} class="logo" aria-label="T4A" role="img">
  <path d="M 773 363 L 691 363 L 680 366 L 666 378 L 590 542 L 567 595 L 616 595 L 624 574 L 637 547 L 728 547 L 729 595 L 773 595 Z M 727 399 L 729 401 L 729 506 L 656 507 L 655 506 L 698 411 L 703 405 L 709 401 Z M 482 363 L 378 509 L 378 547 L 499 547 L 500 595 L 545 595 L 545 549 L 576 507 L 545 506 L 545 364 Z M 499 412 L 500 506 L 432 507 L 431 506 Z M 186 363 L 186 408 L 273 409 L 273 595 L 318 595 L 318 409 L 391 408 L 422 363 Z" fill="currentColor" fill-rule="evenodd"/>
</svg>

<style>
  .logo {
    display: block;
    color: var(--text-primary);
    flex-shrink: 0;
  }
</style>
