/**
 * Folio Assistant — Auth Gateway (Dual OAuth: Google + GitHub).
 *
 * A lightweight Bun service that:
 *   1. Serves a login chooser page at /login
 *   2. Handles Google OAuth → viewer role (whitelist-gated or open)
 *   3. Handles GitHub OAuth → collaborator/owner role (whitelist-gated)
 *   4. Issues HMAC-signed session cookies with {email, provider, role, name}
 *   5. Proxies authenticated requests to folio-assistant and static viewer files
 *   6. Bearer token bypass for CLI/API access
 *
 * Roles:
 *   viewer       — Google OAuth, can read + submit feedback
 *   collaborator — GitHub OAuth, can edit + manage branches + delete todos
 *   owner        — GitHub OAuth + matches owner username, can commit to main
 *
 * Environment:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 *   GH_CLIENT_ID, GH_CLIENT_SECRET
 *   COOKIE_SECRET         — HMAC signing key (32+ chars)
 *   FOLIO_API_TOKEN    — Bearer token for direct API access
 *   FOLIO_UPSTREAM     — folio-assistant URL (default: http://folio-assistant:8080)
 *   FOLIO_GATEWAY_SECRET — shared with folio-assistant; sent on every proxied
 *                         request so the server can tell the gateway's requests
 *                         from anyone else's (required, 32+ chars)
 *   VIEWER_ROOT           — static viewer dir (default: /var/www/viewer)
 *   OWNER_USERNAME        — GitHub username of repo owner (default from config)
 *   SESSION_MAX_AGE       — session duration in seconds (default: 86400)
 *   AUTH_GATEWAY_PORT     — listen port (default: 4180)
 *   FOLIO_DOMAIN          — domain for OAuth callbacks (required)
 */

import { readFileSync, existsSync, statSync } from "fs";
import { join, extname } from "path";
import { createHmac, timingSafeEqual } from "crypto";

// ── Config from environment ──────────────────────────────────────

const PORT = parseInt(process.env.AUTH_GATEWAY_PORT || "4180", 10);
const DOMAIN = process.env.FOLIO_DOMAIN || "localhost";
const COOKIE_SECRET: string = process.env.COOKIE_SECRET ?? "";
const GATEWAY_SECRET: string = process.env.FOLIO_GATEWAY_SECRET ?? "";
const FOLIO_API_TOKEN = process.env.FOLIO_API_TOKEN || "";
const MCP_UPSTREAM = process.env.FOLIO_UPSTREAM || "http://folio-assistant:8080";
const VIEWER_ROOT = process.env.VIEWER_ROOT || "/var/www/viewer";
const OWNER_USERNAME = process.env.OWNER_USERNAME || "";
const SESSION_MAX_AGE = parseInt(process.env.SESSION_MAX_AGE || "86400", 10);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GITHUB_CLIENT_ID = process.env.GH_CLIENT_ID || "";
const GITHUB_CLIENT_SECRET = process.env.GH_CLIENT_SECRET || "";

const GOOGLE_VIEWERS_FILE = process.env.GOOGLE_VIEWERS_FILE || "/etc/auth-gateway/google-viewers.txt";
const GITHUB_COLLABS_FILE = process.env.GITHUB_COLLABS_FILE || "/etc/auth-gateway/github-collaborators.txt";

// ── Whitelist loading ────────────────────────────────────────────

function loadWhitelist(path: string): Set<string> {
  if (!existsSync(path)) return new Set();
  return new Set(
    readFileSync(path, "utf-8")
      .split("\n")
      .map(l => l.trim().toLowerCase())
      .filter(l => l && !l.startsWith("#"))
  );
}

// Reload whitelists on each check (files may be updated by self-updater)
function getGoogleViewers(): Set<string> { return loadWhitelist(GOOGLE_VIEWERS_FILE); }
function getGithubCollabs(): Set<string> { return loadWhitelist(GITHUB_COLLABS_FILE); }

// ── Session cookie (HMAC-signed JSON) ────────────────────────────

interface Session {
  email: string;
  name: string;
  provider: "google" | "github";
  role: "viewer" | "collaborator" | "owner";
  exp: number; // unix timestamp
}

const COOKIE_NAME = "folio_session";
/** Binds an OAuth `state` to the browser that started the login (login CSRF). */
const STATE_COOKIE_NAME = "folio_oauth_state";
const STATE_MAX_AGE = 600;

/**
 * The header that tells folio-assistant a request came through this gateway.
 * Its value is FOLIO_GATEWAY_SECRET. The server refuses `/mcp` without it and
 * ignores `X-User-*` identity headers on any request that lacks it.
 */
export const GATEWAY_HEADER = "X-Folio-Gateway";

export function signSession(session: Session): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const sig = createHmac("sha256", COOKIE_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifySession(cookie: string): Session | null {
  const dot = cookie.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);
  const expected = createHmac("sha256", COOKIE_SECRET).update(payload).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch { return null; }
  try {
    const session: Session = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (session.exp < Date.now() / 1000) return null;
    return session;
  } catch { return null; }
}

function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    cookies[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return cookies;
}

function sessionCookieHeader(token: string, maxAge: number): string {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function stateCookieHeader(state: string, maxAge: number): string {
  return `${STATE_COOKIE_NAME}=${state}; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function sameString(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * The headers to send upstream: the client's, minus every `X-User-*` and
 * `X-Folio-Gateway` header it sent, plus the gateway's own. Identity headers
 * are only ever the gateway's; a client-sent `X-User-Actor` or `X-User-Role`
 * is dropped, never passed through.
 */
export function upstreamHeaders(incoming: Headers, identity: Record<string, string>): Headers {
  const headers = new Headers();
  for (const [k, v] of incoming) {
    const lk = k.toLowerCase();
    if (lk.startsWith("x-user-") || lk === GATEWAY_HEADER.toLowerCase()) continue;
    headers.append(k, v);
  }
  for (const [k, v] of Object.entries(identity)) headers.set(k, v);
  headers.set(GATEWAY_HEADER, GATEWAY_SECRET);
  return headers;
}

// ── OAuth flows ──────────────────────────────────────────────────

function callbackUrl(provider: string): string {
  return `https://${DOMAIN}/auth/${provider}/callback`;
}

function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl("google"),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

function githubAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: callbackUrl("github"),
    scope: "read:user user:email",
    state,
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export async function exchangeGoogleCode(code: string): Promise<{ email: string; name: string } | null> {
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: callbackUrl("google"),
      grant_type: "authorization_code",
    }),
  });
  if (!resp.ok) return null;
  const { access_token } = await resp.json() as { access_token: string };

  const userResp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!userResp.ok) return null;
  const user = await userResp.json() as { email?: string; name?: string; verified_email?: boolean };
  // An unverified address proves nothing about who holds it, so it never
  // matches the allowlist.
  if (!user.email || user.verified_email !== true) return null;
  return { email: user.email, name: user.name || user.email };
}

async function exchangeGithubCode(code: string): Promise<{ username: string; email: string; name: string } | null> {
  const resp = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: callbackUrl("github"),
    }),
  });
  if (!resp.ok) return null;
  const { access_token } = await resp.json() as { access_token: string };
  if (!access_token) return null;

  const userResp = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${access_token}`, Accept: "application/json" },
  });
  if (!userResp.ok) return null;
  const user = await userResp.json() as { login: string; email?: string; name?: string };

  // GitHub may not return email in profile — fetch from emails endpoint
  let email = user.email || "";
  if (!email) {
    const emailResp = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${access_token}`, Accept: "application/json" },
    });
    if (emailResp.ok) {
      const emails = await emailResp.json() as Array<{ email: string; primary: boolean }>;
      email = emails.find(e => e.primary)?.email || emails[0]?.email || "";
    }
  }

  return { username: user.login, email, name: user.name || user.login };
}

// ── Static file serving ──────────────────────────────────────────

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

function serveStatic(filePath: string): Response | null {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) return null;
  return new Response(Bun.file(filePath), {
    headers: {
      "Content-Type": MIME[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    },
  });
}

// ── Login page ───────────────────────────────────────────────────

function loginPage(error?: string): Response {
  const errorHtml = error ? `<div class="error">${error}</div>` : "";
  const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Folio — Sign In</title>
  <style>
    :root { --bg: #0d1117; --fg: #e6edf3; --card: #161b22; --border: #30363d; --ac: #58a6ff; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
           background: var(--bg); color: var(--fg); min-height: 100vh;
           display: flex; align-items: center; justify-content: center; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px;
            padding: 2.5rem; max-width: 380px; width: 90%; text-align: center; }
    h1 { font-size: 1.5rem; margin-bottom: .5rem; }
    .subtitle { color: #8b949e; font-size: .85rem; margin-bottom: 1.5rem; }
    .btn { display: block; width: 100%; padding: .75rem; margin: .5rem 0;
           border: 1px solid var(--border); border-radius: 8px;
           background: var(--bg); color: var(--fg); font-size: .95rem;
           cursor: pointer; text-decoration: none; transition: border-color .2s; }
    .btn:hover { border-color: var(--ac); }
    .btn-google { }
    .btn-github { }
    .btn svg { vertical-align: middle; margin-right: .5rem; }
    .role-info { margin-top: 1.5rem; font-size: .75rem; color: #8b949e; text-align: left; }
    .role-info dt { font-weight: 600; color: var(--fg); }
    .role-info dd { margin-bottom: .5rem; margin-left: 0; }
    .error { background: #3d1f1f; border: 1px solid #da3633; border-radius: 6px;
             padding: .5rem .75rem; margin-bottom: 1rem; font-size: .85rem; color: #f85149; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Folio</h1>
    <p class="subtitle">Sign in to access the content assistant</p>
    ${errorHtml}
    <a href="/auth/google/start" class="btn btn-google">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
      Sign in with Google
    </a>
    <a href="/auth/github/start" class="btn btn-github">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/></svg>
      Sign in with GitHub
    </a>
    <dl class="role-info">
      <dt>Viewer (Google)</dt>
      <dd>Read papers, submit feedback</dd>
      <dt>Collaborator (GitHub)</dt>
      <dd>Edit content, manage branches, delete todos</dd>
    </dl>
  </div>
</body>
</html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// ── Request handler ──────────────────────────────────────────────

function log(msg: string) {
  console.error(`[${new Date().toISOString().slice(11, 23)}] [auth] ${msg}`);
}

// CSRF state tokens (in-memory, short-lived)
const stateTokens = new Map<string, number>();
function makeState(): string {
  const s = crypto.randomUUID();
  stateTokens.set(s, Date.now());
  // Purge old tokens
  for (const [k, v] of stateTokens) {
    if (Date.now() - v > 600_000) stateTokens.delete(k);
  }
  return s;
}
function checkState(s: string): boolean {
  if (!stateTokens.has(s)) return false;
  stateTokens.delete(s);
  return true;
}

/**
 * A callback's `state` is good only if this server issued it AND it is the
 * one the requesting browser was given at /auth/<provider>/start (the
 * HttpOnly state cookie). Without the cookie check a login started by
 * someone else could be completed in this browser.
 */
function callbackStateOk(req: Request, state: string | null): boolean {
  if (!state) return false;
  const cookieState = parseCookies(req.headers.get("cookie"))[STATE_COOKIE_NAME];
  if (!cookieState || !sameString(cookieState, state)) return false;
  return checkState(state);
}

function startLogin(authUrl: (state: string) => string): Response {
  const state = makeState();
  return new Response(null, {
    status: 302,
    headers: { Location: authUrl(state), "Set-Cookie": stateCookieHeader(state, STATE_MAX_AGE) },
  });
}

function loggedIn(token: string): Response {
  const headers = new Headers({ Location: "/" });
  headers.append("Set-Cookie", sessionCookieHeader(token, SESSION_MAX_AGE));
  headers.append("Set-Cookie", stateCookieHeader("", 0));
  return new Response(null, { status: 302, headers });
}

export async function handleGatewayRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // ── Health check (no auth) ──────────────────────────────
  if (path === "/health") {
    return Response.json({ status: "ok", service: "auth-gateway" });
  }

  // ── Bearer token bypass for /mcp ────────────────────────
  if (path === "/mcp") {
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader.startsWith("Bearer ") && FOLIO_API_TOKEN) {
      const token = authHeader.slice(7);
      const tokenBuf = Buffer.from(token);
      const expectedBuf = Buffer.from(FOLIO_API_TOKEN);
      if (tokenBuf.length === expectedBuf.length && timingSafeEqual(tokenBuf, expectedBuf)) {
        return proxyToMcp(new Request(req, { headers: upstreamHeaders(req.headers, {}) }), url);
      }
      return new Response("Unauthorized", { status: 401 });
    }
  }

  // ── Login page ──────────────────────────────────────────
  if (path === "/login") {
    return loginPage();
  }

  // ── OAuth start ─────────────────────────────────────────
  if (path === "/auth/google/start") {
    return startLogin(googleAuthUrl);
  }
  if (path === "/auth/github/start") {
    return startLogin(githubAuthUrl);
  }

  // ── Google OAuth callback ───────────────────────────────
  if (path === "/auth/google/callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !callbackStateOk(req, state)) {
      return loginPage("Invalid or expired login attempt. Please try again.");
    }

    const user = await exchangeGoogleCode(code);
    if (!user) {
      return loginPage("Failed to authenticate with Google.");
    }

    const viewers = getGoogleViewers();
    if (!viewers.has(user.email.toLowerCase())) {
      log(`Rejected Google user: ${user.email}`);
      return loginPage("Your Google account is not authorized. Contact the repo owner.");
    }

    const session: Session = {
      email: user.email,
      name: user.name,
      provider: "google",
      role: "viewer",
      exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
    };
    const token = signSession(session);
    log(`Google login: ${user.email} → viewer`);
    return loggedIn(token);
  }

  // ── GitHub OAuth callback ───────────────────────────────
  if (path === "/auth/github/callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !callbackStateOk(req, state)) {
      return loginPage("Invalid or expired login attempt. Please try again.");
    }

    const user = await exchangeGithubCode(code);
    if (!user) {
      return loginPage("Failed to authenticate with GitHub.");
    }

    const collabs = getGithubCollabs();
    if (!collabs.has(user.username.toLowerCase())) {
      log(`Rejected GitHub user: ${user.username}`);
      return loginPage("Your GitHub account is not authorized. Contact the repo owner.");
    }

    const isOwner = user.username.toLowerCase() === OWNER_USERNAME.toLowerCase();
    const session: Session = {
      email: user.email || `${user.username}@github`,
      name: user.name,
      provider: "github",
      role: isOwner ? "owner" : "collaborator",
      exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
    };
    const token = signSession(session);
    log(`GitHub login: ${user.username} → ${session.role}`);
    return loggedIn(token);
  }

  // ── Logout ──────────────────────────────────────────────
  if (path === "/auth/logout") {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/login",
        "Set-Cookie": sessionCookieHeader("", 0),
      },
    });
  }

  // ── Session check (all other routes require auth) ───────
  const cookies = parseCookies(req.headers.get("cookie"));
  const sessionToken = cookies[COOKIE_NAME];
  const session = sessionToken ? verifySession(sessionToken) : null;

  if (!session) {
    // API requests get 401, browser requests get redirect
    if (path.startsWith("/api/") || path === "/mcp") {
      return new Response("Unauthorized", { status: 401 });
    }
    return Response.redirect("/login", 302);
  }

  // ── User info endpoint ──────────────────────────────────
  if (path === "/auth/me") {
    return Response.json({
      email: session.email,
      name: session.name,
      provider: session.provider,
      role: session.role,
    });
  }

  // ── Proxy to folio-assistant with role headers ─────────────────
  if (path === "/mcp" || path.startsWith("/api/")) {
    // Inject auth headers for downstream (the client's own X-User-* are dropped)
    const headers = upstreamHeaders(req.headers, {
      "X-User-Email": session.email,
      "X-User-Role": session.role,
      "X-User-Name": session.name,
      "X-User-Provider": session.provider,
    });

    return proxyToMcp(new Request(req, { headers }), url);
  }

  // ── Serve static viewer files ───────────────────────────
  if (path === "/" || path === "/index.html") {
    return serveStatic(join(VIEWER_ROOT, "index.html"))
      || new Response("Not found", { status: 404 });
  }

  // Folio SPA
  const ASSISTANT_ROOT = VIEWER_ROOT.replace(/viewer\/?$/, "ui");
  if (path === "/folio" || path === "/folio/" || path === "/folio/index.html") {
    return serveStatic(join(ASSISTANT_ROOT, "index.html"))
      || new Response("Not found", { status: 404 });
  }
  if (path.startsWith("/folio/")) {
    return serveStatic(join(ASSISTANT_ROOT, path.slice("/folio/".length)))
      || new Response("Not found", { status: 404 });
  }

  // All other static files
  const staticRes = serveStatic(join(VIEWER_ROOT, path.slice(1)));
  if (staticRes) return staticRes;

  return new Response("Not found", { status: 404 });
}

// ── Proxy helper ─────────────────────────────────────────────────

async function proxyToMcp(req: Request, url: URL): Promise<Response> {
  const target = new URL(url.pathname + url.search, MCP_UPSTREAM);
  try {
    const proxyReq = new Request(target.toString(), {
      method: req.method,
      headers: req.headers,
      body: req.body,
    });
    return await fetch(proxyReq);
  } catch (e) {
    log(`Proxy error: ${e}`);
    return new Response("Bad Gateway", { status: 502 });
  }
}

if (import.meta.main) {
  if (COOKIE_SECRET.length < 32) {
    console.error("FATAL: COOKIE_SECRET not set or too short (32+ chars required).");
    process.exit(1);
  }
  if (GATEWAY_SECRET.length < 32) {
    console.error("FATAL: FOLIO_GATEWAY_SECRET not set or too short (32+ chars required).");
    process.exit(1);
  }
  Bun.serve({ port: PORT, fetch: handleGatewayRequest });
  log(`Auth gateway started on :${PORT} (domain: ${DOMAIN}, owner: ${OWNER_USERNAME})`);
}
