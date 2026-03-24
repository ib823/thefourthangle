# TFA Radar — GitHub Actions Setup

Runs the radar automatically every 2 hours using GitHub Actions free tier. No server needed.

## 1. Enable Actions

- Go to repo **Settings → Actions → General**
- Select **"Allow all actions and reusable workflows"**

## 2. Add secrets (optional, for future API keys)

- Go to repo **Settings → Secrets and variables → Actions**
- Add any keys you get later:
  - `TWITTER_BEARER_TOKEN` — if you ever get Twitter/X API access
  - `REDDIT_CLIENT_ID` — if you get Reddit API approval
  - `REDDIT_CLIENT_SECRET`
- The radar works without any secrets — RSS, Reddit public RSS, and GDELT are all free/keyless.

## 3. Verify first run

- Go to **Actions** tab → **"TFA Radar Scan"** workflow
- Click **"Run workflow"** button (manual trigger)
- Watch the run complete (~3-5 minutes)
- Check that `radar/output/issue-queue.json` was updated in the repo

## 4. How it works

```
Every 2 hours:
  1. GitHub Actions spins up Ubuntu runner
  2. Checks out repo (including last state.json)
  3. Installs Python + dependencies (~30s with cache)
  4. Runs: python radar/run-radar.py --once
  5. Commits updated state.json + issue-queue.json + health.json
  6. Pushes back to repo
  7. Runner shuts down
```

State persists across runs via git commits. Each run picks up where the last one left off — Bayesian posteriors accumulate over time, making scores more meaningful.

## 5. Files committed each cycle

| File | Contents |
|------|----------|
| `radar/output/state.json` | Bayesian posteriors, CUSUM accumulators, Hawkes params |
| `radar/output/issue-queue.json` | Ranked issues with scores (rolling 7-day window) |
| `radar/output/health.json` | Source and stream health status |
| `radar/output/logs/last-cycle.log` | Full log of the most recent scan |

## 6. Monitoring

- **Actions tab** shows run history with pass/fail
- Each run commits results — check git log for scan history
- GitHub sends email on workflow failure
- `health.json` shows per-source status (healthy/degraded/failed)

## 7. Cost

| Tier | Minutes/month | Radar usage | Fits? |
|------|--------------|-------------|-------|
| Free (public repo) | Unlimited | ~1,800 min/month | Yes |
| Free (private repo) | 2,000 min/month | ~1,800 min/month | Tight |
| Pro ($4/mo) | 3,000 min/month | ~1,800 min/month | Comfortable |

Calculation: ~5 min/run × 12 runs/day × 30 days = ~1,800 min/month.

## 8. Local development

The GitHub Actions deployment doesn't remove local functionality:

```bash
cd radar
python run-radar.py --once      # Single scan
python run-radar.py --status    # View current queue
python run-radar.py --topic X   # Detail for topic X
```

If running locally AND via Actions, pull latest first to avoid state conflicts:

```bash
git pull origin main
```

## 9. Troubleshooting

**Run fails with "rate limited"**: GDELT throttles to 1 request per 5 seconds. The connector handles this gracefully — it skips GDELT and continues with other sources.

**RSS feed returns 0 articles**: Some Malaysian news sites block non-browser User-Agents or have intermittent RSS feeds. The radar continues with available sources.

**Push fails**: If two runs overlap (unlikely with 2h interval), the second push may fail. It will succeed on the next cycle.
