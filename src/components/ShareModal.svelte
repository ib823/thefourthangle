<script lang="ts">
  import type { Issue } from '../data/issues';
  import { onMount } from 'svelte';

  interface Props {
    issue: Issue;
    cardIndex: number | null;
    onClose: () => void;
  }
  let { issue, cardIndex, onClose }: Props = $props();

  let copiedId: string | null = $state(null);
  let visible = $state(false);

  onMount(() => { requestAnimationFrame(() => { visible = true; }); });

  let card = $derived(cardIndex !== null ? issue.cards[cardIndex] : null);
  let shareText = $derived(card ? card.big : issue.headline);
  let previewText = $derived(shareText.length > 120 ? shareText.slice(0, 117) + '...' : shareText);
  let fullUrl = $derived(`https://thefourthangle.pages.dev/issue/${issue.id}`);

  let os = $derived(issue.opinionShift);
  let ns = $derived(Math.round(issue.finalScore ?? 0));

  let tweetText = $derived(`${issue.headline}\n\n${os}% Opinion Shift · Neutrality: ${ns}/100\nScored by 6 independent review stages.`);
  let waText = $derived(`*${issue.headline}* — ${os}% Opinion Shift · Neutrality: ${ns}/100\nRead the 6-stage analysis: ${fullUrl}`);
  let tgText = $derived(`${issue.headline} — ${os}% Opinion Shift · Neutrality: ${ns}/100\nRead the 6-stage analysis:`);
  let threadsText = $derived(`${issue.headline} — ${os}% shift · ${ns}/100 neutrality\n${fullUrl}`);
  let linkedinText = $derived(`Worth reading: ${issue.headline}\n\n${os}% of readers may shift their position on this issue.\nScored ${ns}/100 for neutrality across 6 independent review stages.\n\n${fullUrl}`);

  let canNativeShare = $state(false);
  onMount(() => { canNativeShare = !!navigator.share; });

  const openPlatforms = [
    { id: 'whatsapp', label: 'WhatsApp', url: () => `https://api.whatsapp.com/send?text=${encodeURIComponent(waText)}` },
    { id: 'telegram', label: 'Telegram', url: () => `https://t.me/share/url?url=${encodeURIComponent(fullUrl)}&text=${encodeURIComponent(tgText)}` },
    { id: 'x', label: 'X / Twitter', url: () => `https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(fullUrl)}` },
    { id: 'facebook', label: 'Facebook', url: () => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}` },
    { id: 'linkedin', label: 'LinkedIn', url: () => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(fullUrl)}` },
    { id: 'threads', label: 'Threads', url: () => `https://www.threads.com/intent/post?text=${encodeURIComponent(threadsText)}` },
  ];

  let barColor = $derived(
    os >= 80 ? '#EF4444' : os >= 60 ? '#F59E0B' : os >= 40 ? '#3B82F6' : '#64748B'
  );
  let nsColor = $derived(
    ns >= 75 ? '#3B82F6' : ns >= 50 ? '#EAB308' : '#EF4444'
  );

  function openPlatform(p: typeof openPlatforms[0]) {
    window.open(p.url(), '_blank', 'noopener');
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      copiedId = 'link';
      setTimeout(() => { copiedId = null; }, 1500);
    } catch {}
  }

  async function nativeShare() {
    try {
      await navigator.share({
        title: issue.headline,
        text: `${os}% Opinion Shift · Neutrality: ${ns}/100 — 6 independent review stages.`,
        url: fullUrl,
      });
    } catch {}
  }

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  onclick={handleBackdrop}
  style="position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,{visible ? 0.4 : 0});backdrop-filter:blur({visible ? 12 : 0}px);-webkit-backdrop-filter:blur({visible ? 12 : 0}px);display:flex;align-items:center;justify-content:center;padding:20px;transition:background 0.2s ease, backdrop-filter 0.2s ease;"
>
  <div style="background:#FFFFFF;border-radius:20px;padding:24px;max-width:380px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.15);transform:scale({visible ? 1 : 0.95});opacity:{visible ? 1 : 0};transition:transform 0.3s cubic-bezier(.175,.885,.32,1.275), opacity 0.3s ease;position:relative;max-height:90vh;overflow-y:auto;">

    <!-- Close -->
    <button onclick={onClose} style="position:absolute;top:14px;right:14px;width:32px;height:32px;border-radius:8px;background:#F8F9FA;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;color:#6C757D;">x</button>

    <!-- Preview -->
    <div style="background:#F8F9FA;border-radius:14px;padding:18px;border:1px solid #E9ECEF;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
        <img src="/logo.png?v=2" alt="" width="18" height="20" style="display:block;" />
        <span style="font-size:9px;font-weight:700;color:#6C757D;letter-spacing:1.5px;text-transform:uppercase;">THE FOURTH ANGLE</span>
      </div>
      <div style="font-size:14px;font-weight:600;color:#212529;margin-bottom:6px;line-height:1.35;">{issue.headline}</div>
      <div style="font-size:12px;color:#6C757D;line-height:1.5;margin-bottom:10px;">{previewText}</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:44px;height:3px;background:#F1F3F5;border-radius:2px;overflow:hidden;">
          <div style="width:{os}%;height:100%;background:{barColor};border-radius:2px;"></div>
        </div>
        <span style="font-size:10px;font-weight:700;color:{barColor};">{os}%</span>
        <span style="font-size:9px;color:#868E96;">Opinion Shift</span>
        <span style="font-size:9px;color:#CED4DA;">·</span>
        <span style="font-size:10px;font-weight:700;color:{nsColor};">{ns}</span>
        <span style="font-size:9px;color:#868E96;">Neutrality</span>
      </div>
    </div>

    <!-- Native share (mobile primary action) -->
    {#if canNativeShare}
      <button
        onclick={nativeShare}
        style="width:100%;padding:14px 20px;background:#212529;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:16px;transition:background 0.15s ease;display:flex;align-items:center;justify-content:center;gap:8px;"
        onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = '#343A40'; }}
        onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = '#212529'; }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        Share
      </button>
    {/if}

    <!-- Platform grid -->
    <div style="font-size:11px;font-weight:600;color:#6C757D;letter-spacing:0.5px;margin-bottom:8px;">SHARE ON</div>
    <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;margin-bottom:16px;">
      {#each openPlatforms as p}
        <button
          onclick={() => openPlatform(p)}
          style="display:flex;align-items:center;justify-content:center;gap:6px;padding:12px 8px;border-radius:12px;background:#F8F9FA;border:1px solid #F1F3F5;cursor:pointer;transition:background 0.15s ease,border-color 0.15s ease;min-height:44px;"
          onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = '#E9ECEF'; (e.currentTarget as HTMLElement).style.borderColor = '#DEE2E6'; }}
          onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = '#F8F9FA'; (e.currentTarget as HTMLElement).style.borderColor = '#F1F3F5'; }}
        >
          <span style="font-size:11px;font-weight:600;color:#495057;">{p.label}</span>
        </button>
      {/each}
    </div>

    <div style="height:1px;background:#F1F3F5;margin-bottom:14px;"></div>

    <!-- Copy link -->
    <button
      onclick={copyLink}
      style="display:flex;align-items:center;justify-content:space-between;width:100%;padding:12px 16px;border-radius:12px;background:{copiedId === 'link' ? '#EBFBEE' : '#F8F9FA'};border:1px solid {copiedId === 'link' ? '#B2F2BB' : '#F1F3F5'};cursor:pointer;transition:background 0.15s ease;"
    >
      <span style="font-size:13px;font-weight:500;color:#212529;">Copy link</span>
      <span style="font-size:12px;font-weight:600;color:{copiedId === 'link' ? '#37B24D' : '#6C757D'};">{copiedId === 'link' ? 'Copied' : 'Copy'}</span>
    </button>
  </div>
</div>
