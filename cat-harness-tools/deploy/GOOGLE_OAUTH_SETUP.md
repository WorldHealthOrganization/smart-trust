# OAuth Setup for Folio

The folio deployment uses **dual OAuth** (Google + GitHub) with role-based
access control. The **only manual secrets** required are OAuth client
credentials for both providers. Everything else is auto-generated or read
from `lean-mcp.config.json`.

## Roles

| Provider | Role | Capabilities |
|----------|------|--------------|
| Google | `viewer` | Read papers, submit feedback (with username attached) |
| GitHub | `collaborator` | All viewer perms + WYSIWYG editing, delete todos, manage branches |
| GitHub (owner) | `owner` | All collaborator perms + commit to main |

## Recommended: GitHub Secrets (no SSH required)

### 1. Create Google OAuth credentials (~3 min)

1. Go to https://console.cloud.google.com/projectcreate — name it "Folio"
   (no billing required)
2. **APIs & Services > OAuth consent screen** → External → fill in app name +
   emails → **Publish App**
3. **APIs & Services > Credentials** → **+ Create Credentials > OAuth client ID**
   - Type: **Web application**
   - Redirect URI: `https://folio.OWNER.org/auth/google/callback`
4. Copy the **Client ID** and **Client Secret**

### 2. Create GitHub OAuth App (~2 min)

1. Go to https://github.com/settings/developers → **New OAuth App**
2. Fill in:
   - Application name: `Folio`
   - Homepage URL: `https://folio.OWNER.org`
   - Authorization callback URL: `https://folio.OWNER.org/auth/github/callback`
3. Copy the **Client ID** and generate a **Client Secret**

### 3. Add GitHub repo secrets (~1 min)

Go to **Settings > Secrets and variables > Actions** in your GitHub repo.
Add these five repository secrets:

| Secret name | Value | Where to get it |
|-------------|-------|-----------------|
| `HETZNER_API_TOKEN` | Hetzner Cloud API token | https://console.hetzner.cloud/ |
| `GOOGLE_CLIENT_ID` | `123...apps.googleusercontent.com` | Step 1 |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-...` | Step 1 |
| `GITHUB_OAUTH_CLIENT_ID` | `Iv1.abc123...` | Step 2 |
| `GITHUB_OAUTH_CLIENT_SECRET` | `abc123...` | Step 2 |

### 4. Run the deploy workflow (~5 min)

1. Go to **Actions > Deploy Folio** in your GitHub repo
2. Click **Run workflow** → action: **provision**
3. Wait for it to complete — it prints the server IP
4. Point DNS: `folio.OWNER.org` → A record → that IP

Done. Caddy auto-provisions TLS. Self-updater handles all future updates.

### Destroying

Run **Actions > Deploy Folio** → action: **destroy**. Remove the DNS record.

---

## Managing user whitelists

Two whitelist files control who can access the folio:

| File | Controls | Format |
|------|----------|--------|
| `deploy/google-viewers.txt` | Google viewers | One Gmail per line |
| `deploy/github-collaborators.txt` | GitHub collaborators | One username per line |

**IMPORTANT**: Only the repo owner can edit these files manually.
Coding agents (Claude, Copilot, etc.) must NEVER modify them.

To add/remove a user:
1. Edit the whitelist file
2. Push to `main`
3. The self-updater (cron, every minute) pulls and restarts

**No SSH needed** to manage the whitelist.

---

## How the auth flow works

```
User visits folio.OWNER.org
  → Caddy (TLS termination)
  → auth-gateway checks for session cookie
    → No cookie: redirect to /login (chooser page)
    → User picks Google or GitHub
    → OAuth flow with chosen provider
    → auth-gateway checks respective whitelist
      → Match: issue signed session cookie with role, redirect to /
      → No match: show "not authorized" on login page
  → Subsequent requests: cookie verified, role injected as X-User-Role header
  → API server reads role header, enforces permissions
```

## Security model

### What's where

| Secret | Stored in | Accessible to |
|--------|-----------|---------------|
| `GOOGLE_CLIENT_ID` | GitHub Secrets + server `.env` | Repo admins, server root |
| `GOOGLE_CLIENT_SECRET` | GitHub Secrets + server `.env` | Repo admins, server root |
| `GITHUB_OAUTH_CLIENT_ID` | GitHub Secrets + server `.env` | Repo admins, server root |
| `GITHUB_OAUTH_CLIENT_SECRET` | GitHub Secrets + server `.env` | Repo admins, server root |
| `COOKIE_SECRET` | Server `.env` only | Server root (HMAC signing key) |
| `FOLIO_API_TOKEN` | Server `.env` only | Server root |
| `FOLIO_GATEWAY_SECRET` | Server `.env` only | Server root (gateway → folio-assistant; 32+ chars, e.g. `openssl rand -hex 32`) |
| `HETZNER_API_TOKEN` | GitHub Secrets only | Repo admins |

### Threat model

- Session cookies are HMAC-signed (SHA-256) with `COOKIE_SECRET` — cannot be forged.
- Cookies are `HttpOnly; Secure; SameSite=Lax` — no XSS or CSRF exposure.
- CSRF state tokens are checked on OAuth callbacks (in-memory, 10-min TTL) and must match an HttpOnly state cookie set on the browser that started the login.
- Google logins must have a verified email.
- Whitelist files are checked at login. A session keeps its role until it expires (`SESSION_MAX_AGE`); removing someone from a whitelist does not end a session they already hold.
- Bearer token bypass only works for `/mcp` endpoint, and the gateway checks the token. Caddy sends every `/mcp` request to the gateway.
- folio-assistant serves `/mcp`, and trusts `X-User-*` headers, only on requests carrying `FOLIO_GATEWAY_SECRET`. The gateway drops any `X-User-*` header a client sends.
- GitHub Secrets are encrypted at rest, masked in logs.
- Cloud-init secrets are not persisted after execution.
- `.env` on server is root-only, never committed.

### Rotating credentials

**OAuth credentials** (via GitHub Actions — no SSH):
1. Rotate in Google Console / GitHub Developer Settings
2. Update secrets in GitHub repo
3. Run Deploy Folio → action: update

**Session cookies** (logs out all users):
Run Deploy Folio → action: update (generates a new cookie secret)
