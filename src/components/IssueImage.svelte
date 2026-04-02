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
</script>

<div class="issue-image-wrap" style="aspect-ratio:{aspectRatio};border-radius:{borderRadius};overflow:hidden;background:var(--bg-sunken);">
  <img
    src="{imagePath}"
    alt={alt}
    loading={eager ? 'eager' : 'lazy'}
    decoding={eager ? 'sync' : 'async'}
    fetchpriority={eager ? 'high' : undefined}
    style="width:100%;height:100%;object-fit:cover;display:block;"
  />
</div>
