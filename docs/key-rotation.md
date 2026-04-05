# Key Rotation Procedures

Rotate annually or immediately on suspected compromise.

## VAPID Keys (Push Notifications)

Used for Web Push authentication between the notify worker and browser push services.

**Rotation steps:**
1. Generate new ECDSA P-256 keypair (e.g., via `web-push generate-vapid-keys`)
2. Update `VAPID_PUBLIC_KEY` in `workers/notify/wrangler.toml`
3. Set new private key: `cd workers/notify && npx wrangler secret put VAPID_PRIVATE_KEY`
4. Update `VAPID_PUBLIC_KEY` in `src/components/PushPrompt.svelte` (client-side subscription)
5. Deploy notify worker: `cd workers/notify && npx wrangler deploy`
6. Deploy main site: push to `main`

**Impact:** All existing push subscriptions become invalid. Users must re-subscribe. Browser will prompt again on next visit.

## Content Signing Key (Ed25519)

Used to sign issue content during build. Verified client-side on `/verify` page.

**Rotation steps:**
1. Generate new Ed25519 keypair
2. Base64-encode private key, update `TFA_PRIVATE_KEY_B64` in GitHub Actions secrets
3. Replace `public/pubkey.pem` with new public key
4. Push to `main` — all signatures regenerate automatically during build

**Impact:** Old `signatures.json` becomes invalid. Users who cached the old pubkey see verification failures until they reload. No functional impact on reading.

## Cloudflare API Token

Used by GitHub Actions for `wrangler pages deploy`.

**Rotation steps:**
1. Go to Cloudflare Dashboard > My Profile > API Tokens
2. Create new token with same permissions (Cloudflare Pages edit)
3. Update `CLOUDFLARE_API_TOKEN` in GitHub repo Settings > Secrets and variables > Actions
4. Revoke old token

**Impact:** None if done atomically. Next deploy uses new token.

## Cloudflare Account ID

`CLOUDFLARE_ACCOUNT_ID` in GitHub Actions secrets. Not a secret per se, but if exposed alongside an API token it increases risk. Rotate the API token if account ID leaks.
