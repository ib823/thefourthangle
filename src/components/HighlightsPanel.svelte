<script lang="ts">
  import { CARD_TYPES } from '../data/issue-types';
  import { loadFullIssue } from '../lib/issues-loader';
  import SaveButton from './SaveButton.svelte';

  import type { Issue } from '../data/issue-types';
  import type { IssueSummary } from '../lib/issues-loader';

  interface Props {
    issues: IssueSummary[];
    reactionMap: Record<string, number[]>;
    onOpenHighlight: (issue: IssueSummary, cardIndex: number) => void;
  }

  let { issues, reactionMap, onOpenHighlight }: Props = $props();

  let fullIssues = $state<Record<string, Issue>>({});
  let loadToken = 0;

  type HighlightGroup = {
    issue: IssueSummary;
    cardIndexes: number[];
    fullIssue: Issue | null;
  };

  let groups = $derived.by<HighlightGroup[]>(() => {
    return issues
      .map((issue) => ({
        issue,
        cardIndexes: [...new Set(reactionMap[issue.id] ?? [])].sort((a, b) => a - b),
        fullIssue: fullIssues[issue.id] ?? null,
      }))
      .filter((group) => group.cardIndexes.length > 0);
  });

  let savedCardCount = $derived(groups.reduce((total, group) => total + group.cardIndexes.length, 0));

  function stageLabel(issue: IssueSummary, cardIndex: number, fullIssue: Issue | null): string {
    const card = fullIssue?.cards[cardIndex] ?? issue.cards[cardIndex];
    if (!card) return `Angle ${cardIndex + 1}`;
    const meta = CARD_TYPES[card.t] ?? CARD_TYPES.hook;
    return card.t === 'fact' && card.lens ? `${meta.label} · ${card.lens}` : meta.label;
  }

  $effect(() => {
    const token = ++loadToken;
    const ids = groups
      .map((group) => group.issue.id)
      .filter((id) => !fullIssues[id]);

    if (ids.length === 0) return;

    void Promise.all(
      ids.map(async (id) => {
        const fullIssue = await loadFullIssue(id);
        if (!fullIssue || token !== loadToken) return;
        fullIssues = { ...fullIssues, [id]: fullIssue };
      })
    );
  });
</script>

<section class="highlights-panel" aria-label="Saved angles">
  <header class="highlights-head">
    <p class="highlights-kicker">Library · Highlights</p>
    <h1 class="highlights-title">Saved angles</h1>
    <p class="highlights-copy">
      {savedCardCount} highlighted {savedCardCount === 1 ? 'angle' : 'angles'} across {groups.length}
      {groups.length === 1 ? ' issue' : ' issues'}. Open any saved card and jump straight back to that point in the reader.
    </p>
  </header>

  <div class="highlights-groups">
    {#each groups as group (group.issue.id)}
      <article class="highlight-group">
        <div class="issue-row">
          <div class="issue-copy">
            <p class="issue-title balance-title">{group.issue.headline}</p>
            <p class="issue-context">{group.issue.context}</p>
          </div>
          <span class="issue-count">
            {group.cardIndexes.length} saved {group.cardIndexes.length === 1 ? 'angle' : 'angles'}
          </span>
        </div>

        <div class="saved-angle-list">
          {#each group.cardIndexes as cardIndex (cardIndex)}
            {@const fullCard = group.fullIssue?.cards[cardIndex] ?? null}
            {@const meta = CARD_TYPES[(fullCard?.t ?? group.issue.cards[cardIndex]?.t ?? 'hook')] ?? CARD_TYPES.hook}
            <article class="saved-angle-card">
              <div class="saved-angle-top">
                <div class="saved-angle-label" style="background:{meta.bg};color:{meta.color};">
                  <span class="saved-angle-index">{cardIndex + 1}</span>
                  <span>{stageLabel(group.issue, cardIndex, group.fullIssue)}</span>
                </div>
                <SaveButton issueId={group.issue.id} cardIndex={cardIndex} />
              </div>

              <button
                type="button"
                class="saved-angle-open"
                onclick={() => onOpenHighlight(group.issue, cardIndex)}
                aria-label={`Open ${group.issue.headline} at ${stageLabel(group.issue, cardIndex, group.fullIssue)}`}
              >
                <p class="saved-angle-claim balance-title">
                  {fullCard?.big ?? 'Loading this saved angle...'}
                </p>
                {#if fullCard?.sub}
                  <p class="saved-angle-sub">{fullCard.sub}</p>
                {:else if !fullCard}
                  <p class="saved-angle-sub">Resolving the exact card text from the issue archive.</p>
                {/if}
                <span class="saved-angle-jump">Open angle {cardIndex + 1}</span>
              </button>
            </article>
          {/each}
        </div>
      </article>
    {/each}
  </div>
</section>

<style>
  .highlights-panel {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding: 36px 32px 56px;
    background:
      linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg) 24%);
  }

  .highlights-head {
    max-width: 760px;
    margin: 0 auto 28px;
  }

  .highlights-kicker,
  .issue-count,
  .saved-angle-jump {
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .highlights-kicker {
    color: var(--text-tertiary);
    margin: 0;
  }

  .highlights-title {
    margin: 10px 0 0;
    font-family: var(--font-display);
    font-size: var(--text-highlights-title-fluid);
    line-height: 0.98;
    letter-spacing: -0.05em;
    font-weight: 700;
    color: var(--text-primary);
  }

  .highlights-copy {
    max-width: 58ch;
    margin: 14px 0 0;
    font-size: var(--text-body);
    line-height: 1.65;
    color: var(--text-secondary);
  }

  .highlights-groups {
    max-width: 760px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .highlight-group {
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-xl);
    background: var(--card);
    padding: 24px;
    box-shadow: 0 16px 36px rgba(24, 24, 24, 0.05);
  }

  .issue-row {
    display: flex;
    align-items: flex-start;
    gap: 16px;
  }

  .issue-copy {
    min-width: 0;
    flex: 1;
  }

  .issue-title {
    margin: 0;
    font-size: var(--text-title);
    line-height: 1.2;
    letter-spacing: -0.04em;
    font-weight: 700;
    color: var(--text-primary);
  }

  .issue-context {
    margin: 10px 0 0;
    font-size: var(--text-body);
    line-height: 1.6;
    color: var(--text-secondary);
  }

  .issue-count {
    flex-shrink: 0;
    color: var(--score-warning);
    padding-top: 4px;
  }

  .saved-angle-list {
    margin-top: 20px;
    display: grid;
    gap: 12px;
  }

  .saved-angle-card {
    border-radius: var(--radius-lg);
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    padding: 16px;
  }

  .saved-angle-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .saved-angle-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: var(--radius-pill);
    font-size: var(--text-sm);
    font-weight: 700;
  }

  .saved-angle-index {
    width: 18px;
    height: 18px;
    border-radius: var(--radius-round);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.66);
    font-size: var(--text-xs);
    font-weight: 700;
  }

  .saved-angle-open {
    width: 100%;
    appearance: none;
    border: 0;
    background: transparent;
    text-align: left;
    cursor: pointer;
    padding: 0;
    border-radius: var(--radius-lg);
  }

  .saved-angle-open:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 4px;
  }

  .saved-angle-claim {
    margin: 0;
    font-size: var(--text-title);
    line-height: 1.35;
    letter-spacing: -0.03em;
    font-weight: 700;
    color: var(--text-primary);
    text-wrap: balance;
  }

  .saved-angle-sub {
    margin: 10px 0 0;
    font-size: var(--text-body);
    line-height: 1.6;
    color: var(--text-secondary);
  }

  .saved-angle-jump {
    display: inline-flex;
    margin-top: 14px;
    color: var(--score-warning);
  }

  @media (max-width: 1023px) {
    .highlights-panel {
      padding: 28px 0 40px;
    }

    .highlights-head,
    .highlights-groups {
      max-width: none;
    }
  }

  @media (max-width: 767px) {
    .highlights-panel {
      padding: 24px 16px calc(112px + env(safe-area-inset-bottom, 0px));
    }

    .highlights-copy {
      font-size: var(--text-body);
    }

    .highlight-group {
      border-radius: var(--radius-xl);
      padding: 18px;
    }

    .issue-row {
      display: block;
    }

    .issue-count {
      display: block;
      margin-top: 12px;
    }

    .issue-title {
      font-size: var(--text-title);
    }

    .saved-angle-card {
      border-radius: var(--radius-lg);
      padding: 14px;
    }

    .saved-angle-claim {
      font-size: var(--text-subtitle);
    }

    .saved-angle-sub {
      font-size: var(--text-body);
    }
  }

  @media (prefers-color-scheme: dark) {
    .highlight-group,
    .saved-angle-card {
      box-shadow: 0 16px 34px rgba(0, 0, 0, 0.22);
    }

    .saved-angle-index {
      background: rgba(26, 26, 26, 0.48);
    }
  }
</style>
