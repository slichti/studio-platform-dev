# Clerk: Enabling Social / IdP Login (Google, Facebook, Microsoft)

This doc covers **Clerk Dashboard configuration** so you can test user flows with Gmail, Facebook, and Microsoft accounts. Your app already uses Clerk; social providers are controlled in the **Clerk Dashboard**, not in repo code.

---

## 1. Where to configure

- **Clerk Dashboard** → [User & Authentication](https://dashboard.clerk.com) → **SSO & Social Connections** (or **Social connections** / **User & Authentication → Social**).
- URL pattern: `https://dashboard.clerk.com/<your-instance>/user-authentication/sso-connections` (exact label may vary by Dashboard version).

---

## 2. Enabling each provider

### Development instance

Clerk often provides **shared OAuth credentials** for development:

1. Open **SSO & Social Connections** (or equivalent).
2. For each provider (Google, Facebook, Microsoft):
   - Click **Add connection** (or **Enable**).
   - Choose **“For all users”** (or default).
   - Leave **“Use custom credentials”** off unless you need your own app.
3. No Client ID/Secret needed for dev; Clerk’s shared credentials are used.
4. **Allowed redirect URIs** are usually pre-set for `*.clerk.accounts.com` and your Clerk frontend API; for localhost you may need to add your dev URL in **Domains** / **Allowed origins** (see below).

### Production (custom credentials)

For production you must create your own OAuth apps and plug credentials into Clerk.

#### Google

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → **Credentials** → **Create credentials** → **OAuth 2.0 Client ID**.
2. Application type: **Web application**.
3. **Authorized JavaScript origins**:  
   - `https://your-production-domain.com`  
   - `https://<your-clerk-frontend-api>.clerk.accounts.dev` (or your custom Clerk domain).
4. **Authorized redirect URIs**:  
   - `https://<your-clerk-frontend-api>.clerk.accounts.dev/v1/oauth_callback` (Clerk shows the exact URL in the Dashboard when you add Google).
5. Copy **Client ID** and **Client Secret** into Clerk Dashboard for Google → **Use custom credentials** → paste both.

#### Facebook

1. [Meta for Developers](https://developers.facebook.com/) → create or select app → **Facebook Login** → **Settings**.
2. **Valid OAuth Redirect URIs**: add the redirect URI Clerk shows in the Dashboard (e.g. `https://<clerk-frontend>.clerk.accounts.dev/v1/oauth_callback`).
3. In Clerk Dashboard → Facebook → **Use custom credentials** → paste **App ID** (Client ID) and **App Secret** (Client Secret).

#### Microsoft (Azure AD / Entra)

1. [Azure Portal](https://portal.azure.com/) → **Microsoft Entra ID** (or Azure AD) → **App registrations** → **New registration**.
2. Supported account types: e.g. **Accounts in any organizational directory and personal Microsoft accounts**.
3. **Redirect URI**: Web → add the callback URL Clerk gives (e.g. `https://<clerk-frontend>.clerk.accounts.dev/v1/oauth_callback`).
4. **Certificates & secrets** → New client secret → copy value.
5. In Clerk Dashboard → Microsoft → **Use custom credentials** → paste **Application (client) ID** and **Client secret**.

---

## 3. Domains / allowed origins (important for testing)

- In Clerk Dashboard go to **Domains** (or **Paths** / **Allowed redirect URLs**).
- Add every origin where your app runs, so OAuth redirects work:
  - **Development**: `http://localhost:5173` (or your Vite port), `http://127.0.0.1:5173`.
  - **Staging/production**: `https://your-app-domain.com`.
- If you use a custom sign-in/sign-up domain, add it here as well.

---

## 4. How this matches your app

| Flow        | Your implementation                    | Social login behavior |
|------------|----------------------------------------|------------------------|
| **Sign-in** | `apps/web/app/routes/sign-in.$.tsx` uses Clerk’s prebuilt `<SignIn />` | As soon as Google/Facebook/Microsoft are **enabled in the Clerk Dashboard**, their buttons appear on `/sign-in` automatically. No code change. |
| **Sign-up** | `CustomSignUp` (email + password only) | Social providers are **not** shown on `/sign-up` until you either use Clerk’s prebuilt `<SignUp />` or add OAuth (e.g. `signUp.authenticateWithRedirect({ strategy: "oauth_google" })`) to the custom form. |

So for **sign-in testing** with Gmail/Facebook/Microsoft: configure the Dashboard as above and use `/sign-in`.  
For **sign-up testing** with those providers: either add a sign-up route that uses `<SignUp />`, or extend `CustomSignUp` with OAuth buttons and the same strategies you enabled in the Dashboard.

---

## 5. Checklist for user-account testing

- [ ] In Clerk Dashboard → SSO & Social Connections, **add Google** (dev shared creds or prod custom).
- [ ] Add **Facebook** (same).
- [ ] Add **Microsoft** (same).
- [ ] Under **Domains** / allowed origins, add `http://localhost:<port>` and any staging/production URLs.
- [ ] Open `/sign-in` and confirm Google, Facebook, and Microsoft buttons appear and complete a sign-in.
- [ ] If you need social **sign-up**: add prebuilt `<SignUp />` or OAuth to `CustomSignUp`, then test sign-up with each provider.

---

## 6. Optional: restrict to email/password + chosen IdPs

In Clerk Dashboard you can:

- **Enable/disable** “Email address” and “Password” under **Email, Phone, Username** (or equivalent).
- **Enable/disable** each social connection independently.

So you can offer only Google + Microsoft, or email/password + Google, etc., without changing code—only Dashboard toggles.

---

## References

- [Clerk: Social connections (OAuth) overview](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/overview)
- [Clerk: Add Google](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/google)
- [Clerk Dashboard](https://dashboard.clerk.com) → your instance → User & Authentication → SSO & Social Connections
