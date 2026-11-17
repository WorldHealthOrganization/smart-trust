---
name: deployment-auth
---

# Deployment & Auth Skill

## Role

Handles questions and tasks related to the folio deployment infrastructure,
OAuth authentication, role-based access control, and server management.

## Architecture Overview

```
Internet → Caddy (:443, auto TLS)
         → auth-gateway (:4180, Bun) — dual OAuth + role sessions
         → folio-mcp (:8080) — content API + MCP
         → static viewer/assistant files
```

## Dual OAuth + Role System

### Providers

| Provider | Role | Whitelist file | Capabilities |
|----------|------|----------------|--------------|
| Google | `viewer` | `deploy/google-viewers.txt` | Read papers, submit feedback (with username) |
| GitHub | `collaborator` | `deploy/github-collaborators.txt` | Edit/WYSIWYG, delete todos, manage branches |
| GitHub (owner match) | `owner` | Same file, auto-detected | All above + commit to main |

### Auth flow

1. User visits folio → redirected to `/login` chooser page
2. User picks Google or GitHub → OAuth flow with respective provider
3. Auth-gateway checks whitelist → rejects if not listed
4. Auth-gateway issues HMAC-signed session cookie with `{email, name, provider, role}`
5. All subsequent requests carry cookie → auth-gateway injects `X-User-Role` headers
6. API server reads headers and enforces permissions

### Bearer token bypass

CLI/API clients can skip OAuth entirely:
```
curl -H 'Authorization: Bearer <FOLIO_API_TOKEN>' https://<folio-domain>/mcp
```

## The API decides with ODRL

`src/core/rbac.ts` treats the gateway's tier as a declared actor (`viewer`,
`collaborator`, `owner` in `scenarios/actors/`), each route names the ODRL
**action** it performs, and `policies/http-gateway.jsonld` says which tier
holds which action. An explicit `X-User-Actor` header, once the
gateway sends one, takes precedence over the tier. What is still to build is
steps 1 and 4 below: the gateway mapping a login to a finer-grained actor, and
a relationship engine. The same policies govern BPMN task execution
([`task-authorization`](../../process/process-core/task-authorization.md)).

The target:

1. **The data store authenticates** (the auth-gateway here) and maps the login
   to an **actor id**. That mapping lives in the data store only; no actor file
   and no policy carries a login.
2. **It authorizes with the layer's ODRL policies** in `policies/`, by
   calling `permits()` (`schemas/content/odrl.ts`) with the actor, the action and the
   scope. `unknown` is a refusal, never a pass.
3. **An unauthenticated request is `cat-harness:anyone`**, which the policies allow to
   `visualize` and `render`, and nothing else.
4. **A relationship engine (OpenFGA) is later**, and the policies do not change
   when it arrives: the data store would compile them.

Until then the whitelists stay authoritative, and the providers table above
describes the running gateway.

## Asking GitHub directly: `auth_whoami`

Without the gateway, the `auth_whoami` MCP tool (Tool node `user-auth`) asks
GitHub for the caller's login and repository role, and maps the role onto the
same three gateway actors: `admin` → `owner`; `maintain` and `write` →
`collaborator`; `triage` and `read` → `viewer`. A GitHub role covers the whole
repository, never a sub-graph, node or query path. The trade-off is argued in
[`task-authorization`](../../process/process-core/task-authorization.md) §"GitHub as the auth layer".

## CRITICAL: Whitelist Protection

**NEVER modify these files:**
- `deploy/google-viewers.txt`
- `deploy/github-collaborators.txt`

Only the repo owner can edit them manually. If asked to add/remove users,
instruct the owner to edit the files directly and push to main. The
self-updater will pick up changes within 60 seconds.

## API Permission Matrix

| Endpoint | Method | ODRL action (held by) | Notes |
|----------|--------|-----------|-------|
| `/api/paper`, `/api/folio` | GET | — (anyone) | Read-only |
| `/api/feedback` | GET | — (anyone) | Read feedback |
| `/api/feedback` | POST | — (anyone) | Create feedback (author attached) |
| `/api/feedback` | DELETE | `review-comments` (collaborator, owner) | Delete feedback items |
| `/api/block/save`, revert, upload, glossary curation | POST | `content-authoring` (collaborator, owner) | Edit content |
| relevance adjudication | POST | `adjudication` (collaborator, owner) | Adjudicate a verdict |
| `/mcp` | POST | viewer (OAuth) or bearer token | MCP protocol |

Who holds what is `policies/http-gateway.jsonld`; change it there, not in a
route.

## Unified Docker Image

The folio deployment uses the **same Docker image** as all CI/CD
workflows: the **paper-assistant** image.

Built by `.github/workflows/build-folio-mcp.yml` from
`adapters/mcp-server/Dockerfile`, it includes everything needed to
run the MCP server, build outputs, run the content pipeline, and
execute CI scripts — all offline once pulled.

### Image build triggers

| Trigger | Frequency |
|---------|-----------|
| Push to main (content, MCP, CI scripts) | On change |
| Weekly schedule | Sunday 06:00 UTC |
| Manual dispatch | `build-folio-mcp.yml` |

### Auto-deployment

The `deploy/self-update-folio.sh` cron script (runs every 60s on the
server) polls the registry for new image digests and auto-deploys.
Typical latency from merge to live: ~2-3 minutes.

### LLM provider config

The `llm` section in `folio-mcp.config.json` configures which LLM
backend the MCP server uses:

```json
"llm": {
  "provider": "<provider>",
  "providers": {
    "<provider-a>": { "model": "<model>", "api_base": "https://..." },
    "<provider-b>": { "model": "<model>", "api_base": "https://..." },
    "local":        { "model": "<model>", "api_base": "http://localhost:11434/v1" }
  }
}
```

Switch provider by changing `"provider"`. For local LLMs, start the
local server before the MCP server.

## Key Files

| File | Purpose |
|------|---------|
| `folio-mcp.config.json` | Central config (auth, LLM, image, domain) |
| `adapters/mcp-server/Dockerfile` | **Unified Docker image** (MCP + CI + build) |
| `.github/workflows/build-folio-mcp.yml` | Image build workflow |
| `deploy/auth-gateway/server.ts` | Auth gateway service (Bun) |
| `deploy/docker-compose.folio.yml` | Service orchestration (Caddy + auth-gateway + folio-mcp) |
| `deploy/Caddyfile.folio.template` | Reverse proxy config template |
| `deploy/generate-config.sh` | Generate .env + Caddyfile from config |
| `deploy/self-update-folio.sh` | Auto-update cron script |
| `.github/workflows/deploy-folio.yml` | CI: provision/update/destroy server |
| `deploy/google-viewers.txt` | Google viewer whitelist (PROTECTED) |
| `deploy/github-collaborators.txt` | GitHub collaborator whitelist (PROTECTED) |

## CI/CD Secrets Required

| Secret | Purpose |
|--------|---------|
| `CLOUD_API_TOKEN` | Cloud infrastructure provisioning |
| `GOOGLE_CLIENT_ID` | Google OAuth (viewers) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth (viewers) |
| `GITHUB_OAUTH_CLIENT_ID` | GitHub OAuth (collaborators) |
| `GITHUB_OAUTH_CLIENT_SECRET` | GitHub OAuth (collaborators) |

## Common Tasks

### Add a new viewer
Instruct the repo owner to add their Google email to `deploy/google-viewers.txt` and push.

### Add a new collaborator
Instruct the repo owner to add their GitHub username to `deploy/github-collaborators.txt` and push.

### Rotate OAuth credentials
Run the "update" action in the Deploy Folio workflow after updating CI/CD secrets.

### Debug auth issues
1. Check `/health` endpoint (no auth)
2. Check auth-gateway logs: `docker logs auth-gateway`
3. Verify whitelist files are mounted: `docker exec auth-gateway cat /etc/auth-gateway/google-viewers.txt`
4. Check cookie in browser DevTools → Application → Cookies
