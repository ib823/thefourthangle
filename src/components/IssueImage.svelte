<script lang="ts">
  interface Props {
    issueId: string;
    size: 'thumb' | 'card' | 'hero';
    aspectRatio?: string;
    borderRadius?: string;
  }
  let { issueId, size, aspectRatio = '1/1', borderRadius = '8px' }: Props = $props();

  let basePath = $derived(`/og/backgrounds/issue-${issueId}-${size}`);
</script>

<div class="issue-image-wrap" style="aspect-ratio:{aspectRatio};border-radius:{borderRadius};overflow:hidden;background:var(--bg-sunken);">
  <picture>
    <source srcset="{basePath}.avif" type="image/avif" />
    <img
      src="{basePath}.jpg"
      alt=""
      loading="lazy"
      decoding="async"
      style="width:100%;height:100%;object-fit:cover;display:block;"
    />
  </picture>
</div>
