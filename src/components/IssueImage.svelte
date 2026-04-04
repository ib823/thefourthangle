<script lang="ts">
  import { BUILD_ID } from '../lib/build';

  interface Props {
    issueId: string;
    size: 'thumb' | 'card' | 'hero';
    aspectRatio?: string;
    borderRadius?: string;
    eager?: boolean;
    alt?: string;
  }
  let { issueId, size, aspectRatio = '1/1', borderRadius = '8px', eager = false, alt = '' }: Props = $props();

  const imagePath = $derived(`/og/issue-${issueId}.png?v=${encodeURIComponent(BUILD_ID)}`);

  const sizes = $derived(
    size === 'hero' ? '(min-width: 1024px) 700px, (min-width: 768px) 50vw, 100vw'
    : size === 'card' ? '(min-width: 768px) 400px, 100vw'
    : '120px'
  );
</script>

<div class="issue-image-wrap" style="aspect-ratio:{aspectRatio};border-radius:{borderRadius};overflow:hidden;background:var(--bg-sunken);">
  <img
    src="{imagePath}"
    alt={alt}
    loading={eager ? 'eager' : 'lazy'}
    decoding={eager ? 'sync' : 'async'}
    fetchpriority={eager ? 'high' : undefined}
    sizes={sizes}
    style="width:100%;height:100%;object-fit:cover;display:block;"
  />
</div>
