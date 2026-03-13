# Cloudflare deploy troubleshooting

## `deploy-api` fails after "Uploaded studio-platform-api"

**Symptom:** `wrangler deploy` uploads the Worker, then fails with:

```text
✘ [ERROR] A request to the Cloudflare API (/zones/.../workers/routes) failed.
Authentication error [code: 10000]
```

**Cause:** `packages/api/wrangler.toml` defines **zone routes** (`routes = [{ pattern = "api.slichti.org/*", zone_name = "slichti.org" }, ...]`). After uploading the script, Wrangler updates **Workers Routes** on that zone. That requires a token with **zone-level** route permissions—not only Workers Scripts.

**Fix (recommended):** Update the GitHub Actions secret `CLOUDFLARE_API_TOKEN`:

1. **Cloudflare Dashboard** → **My Profile** → **API Tokens** → **Create Token**.
2. Use template **"Edit Cloudflare Workers"** *or* custom token with at least:
   - **Account** → **Workers Scripts** → **Edit**
   - **Zone** → **Workers Routes** → **Edit** (include zone **slichti.org**)
3. If the token is **zone-restricted only**, Workers Routes can still fail; prefer **account-scoped** Workers permissions or explicitly include **Zone** resources for `slichti.org`.
4. Optional: add **User** → **User Details** → **Read** to avoid Wrangler’s “Unable to retrieve email” warning.

Replace the repo secret and re-run the workflow.

**Fix (alternative):** Manage custom hostnames/routes only in the dashboard and remove `routes` from `wrangler.toml` so CI only uploads the Worker. **Risk:** next deploy from a machine with full token might re-apply routes from toml—only do this if you intentionally manage routes outside Wrangler.

## `deploy-web` / Pages

Pages deploy uses the same token; ensure **Account** → **Cloudflare Pages** → **Edit** if Pages deploy fails with auth errors.

## References

- [API token permissions](https://developers.cloudflare.com/fundamentals/api/reference/permissions)
- [Wrangler deploy](https://developers.cloudflare.com/workers/wrangler/commands/#deploy)
