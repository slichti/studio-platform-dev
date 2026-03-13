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

## `deploy-api` fails on "Apply DB Migrations" (D1)

**Symptom:** `wrangler d1 migrations apply DB --remote` fails with:

```text
A request to the Cloudflare API (.../d1/database/.../query) failed.
The given account is not valid or is not authorized to access this service [code: 7403]
```

**Cause:** The API token cannot access **D1** on the account, or **`CLOUDFLARE_ACCOUNT_ID`** in GitHub does not match the account the token is scoped to.

**Fix:**

1. **Token permissions** — Include **Account** → **D1** → **Edit** (or equivalent) for the account that owns the D1 database in `wrangler.toml`.
2. **Account ID** — In GitHub repo secrets, **`CLOUDFLARE_ACCOUNT_ID`** must be the **Account ID** from the Cloudflare dashboard for that same account (not a zone id).
3. Re-run the workflow after updating the token and/or secret.

## `deploy-web` / Pages

Pages deploy uses the same token; ensure **Account** → **Cloudflare Pages** → **Edit** if Pages deploy fails with auth errors.

## Token checklist for CI (`deploy-api`)

Use one token (or split only if you know the implications) with access to:

| Step | Permission / scope |
|------|---------------------|
| D1 migrations | **Account** → **D1** → **Edit** |
| Worker upload + bindings | **Account** → **Workers Scripts** → **Edit** |
| Routes in `wrangler.toml` | **Zone** → **Workers Routes** → **Edit** (zone `slichti.org`) or account-scoped Workers |
| Pages (deploy-web) | **Account** → **Cloudflare Pages** → **Edit** |

Optional: **User** → **User Details** → **Read** to silence Wrangler email warnings.

## References

- [API token permissions](https://developers.cloudflare.com/fundamentals/api/reference/permissions)
- [Wrangler deploy](https://developers.cloudflare.com/workers/wrangler/commands/#deploy)
