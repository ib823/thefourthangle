<script lang="ts">
  interface Props {
    issueId: string;
    size: 'thumb' | 'card' | 'hero';
    aspectRatio?: string;
    borderRadius?: string;
    eager?: boolean;
  }
  let { issueId, size, aspectRatio = '1/1', borderRadius = '8px', eager = false }: Props = $props();

  let basePath = $derived(`/og/backgrounds/issue-${issueId}-${size}`);
</script>

<div class="issue-image-wrap" style="aspect-ratio:{aspectRatio};border-radius:{borderRadius};overflow:hidden;background:var(--bg-sunken);">
  <picture>
    <source srcset="{basePath}.avif" type="image/avif" />
    <img
      src="{basePath}.jpg"
      alt=""
      loading={eager ? 'eager' : 'lazy'}
      decoding={eager ? 'sync' : 'async'}
      fetchpriority={eager ? 'high' : undefined}
      style="width:100%;height:100%;object-fit:cover;display:block;"
    />
  </picture>
</div>
