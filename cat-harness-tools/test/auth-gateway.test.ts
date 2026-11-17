/**
 * The auth-gateway's identity and login checks (security review 2026-10-31,
 * H1, H2, H6), and the deployment files that route through it.
 *
 * The gateway reads its config from the environment at import, so the env is
 * set first and the module imported after. `fetch` is replaced to stand in for
 * folio-assistant and Google.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SECRET = "g".repeat(40);
const TOKEN = "t".repeat(40);
const dir = mkdtempSync(join(tmpdir(), "gateway-test-"));
writeFileSync(join(dir, "viewers.txt"), "viewer@example.org\nunverified@example.org\n");
Object.assign(process.env, {
  COOKIE_SECRET: "c".repeat(40),
  FOLIO_GATEWAY_SECRET: SECRET,
  FOLIO_API_TOKEN: TOKEN,
  FOLIO_UPSTREAM: "http://upstream.test",
  FOLIO_DOMAIN: "folio.test",
  GOOGLE_VIEWERS_FILE: join(dir, "viewers.txt"),
  GITHUB_COLLABS_FILE: join(dir, "none.txt"),
});
const gw = await import("../src/auth/gateway.ts");

const realFetch = globalThis.fetch;
let upstream: Request[] = [];
let googleUser: Record<string, unknown> = {};
beforeAll(() => {
  globalThis.fetch = (async (input: Request | string | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(String(input), init);
    const url = new URL(req.url);
    if (url.host === "upstream.test") { upstream.push(req); return new Response("ok"); }
    if (url.host === "oauth2.googleapis.com") return Response.json({ access_token: "a" });
    if (url.host === "www.googleapis.com") return Response.json(googleUser);
    throw new Error(`unexpected fetch ${req.url}`);
  }) as typeof fetch;
});
afterAll(() => { globalThis.fetch = realFetch; rmSync(dir, { recursive: true, force: true }); });
beforeEach(() => { upstream = []; });

const at = (path: string, headers: Record<string, string> = {}) =>
  new Request(`https://folio.test${path}`, { headers });
const sessionCookie = (role: "viewer" | "collaborator" | "owner") => "folio_session=" + gw.signSession({
  email: "viewer@example.org", name: "V", provider: "google", role,
  exp: Math.floor(Date.now() / 1000) + 600,
});

describe("identity headers are the gateway's alone (H2)", () => {
  it("drops a client X-User-Actor and X-User-Role on the session path", async () => {
    await gw.handleGatewayRequest(at("/api/git/status", {
      cookie: sessionCookie("viewer"), "x-user-actor": "owner", "x-user-role": "owner", "X-User-Extra": "x",
    }));
    const h = upstream[0]!.headers;
    expect(h.get("x-user-actor")).toBeNull();
    expect(h.get("x-user-extra")).toBeNull();
    expect(h.get("x-user-role")).toBe("viewer");
    expect(h.get("x-folio-gateway")).toBe(SECRET);
  });

  it("drops client X-User-* on the bearer path and vouches for the request", async () => {
    await gw.handleGatewayRequest(at("/mcp", {
      authorization: `Bearer ${TOKEN}`, "x-user-role": "owner", "x-folio-gateway": "forged",
    }));
    const h = upstream[0]!.headers;
    expect(h.get("x-user-role")).toBeNull();
    expect(h.get("x-folio-gateway")).toBe(SECRET);
  });

  it("refuses a wrong bearer token and a missing session without calling upstream (H1)", async () => {
    expect((await gw.handleGatewayRequest(at("/mcp", { authorization: "Bearer x" }))).status).toBe(401);
    expect((await gw.handleGatewayRequest(at("/mcp"))).status).toBe(401);
    expect(upstream.length).toBe(0);
  });
});

describe("OAuth login (H6)", () => {
  async function start(): Promise<{ state: string; cookie: string }> {
    const res = await gw.handleGatewayRequest(at("/auth/google/start"));
    expect(res.status).toBe(302);
    const state = new URL(res.headers.get("location")!).searchParams.get("state")!;
    const setCookie = res.headers.get("set-cookie")!;
    expect(setCookie).toContain(`folio_oauth_state=${state}`);
    expect(setCookie).toContain("HttpOnly");
    return { state, cookie: `folio_oauth_state=${state}` };
  }
  const callback = (state: string, cookie?: string) =>
    gw.handleGatewayRequest(at(`/auth/google/callback?code=c&state=${state}`, cookie ? { cookie } : {}));

  it("refuses a callback whose state was not issued to this browser", async () => {
    const { state } = await start();
    const res = await callback(state);
    expect(res.headers.get("set-cookie") ?? "").not.toContain("folio_session=");
    expect(await res.text()).toContain("Invalid or expired login attempt");

    const other = await start();
    const mismatch = await callback(other.state, "folio_oauth_state=someone-else");
    expect(await mismatch.text()).toContain("Invalid or expired login attempt");
  });

  it("refuses a Google account whose email is not verified", async () => {
    googleUser = { email: "unverified@example.org", verified_email: false };
    const { state, cookie } = await start();
    const res = await callback(state, cookie);
    expect(res.headers.get("set-cookie") ?? "").not.toContain("folio_session=");
    expect(await res.text()).toContain("Failed to authenticate with Google");
  });

  it("signs in a verified, allowlisted account from the browser that started", async () => {
    googleUser = { email: "viewer@example.org", verified_email: true, name: "V" };
    const { state, cookie } = await start();
    const res = await callback(state, cookie);
    expect(res.status).toBe(302);
    const cookies = res.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith("folio_session=") && !c.includes("Max-Age=0"))).toBe(true);
    expect(cookies.some((c) => c.startsWith("folio_oauth_state=;") && c.includes("Max-Age=0"))).toBe(true);
  });
});

describe("deployment routes /mcp through the gateway (H1, H3, H6)", () => {
  const deploy = join(import.meta.dir, "..", "deploy");
  const caddy = readFileSync(join(deploy, "Caddyfile.template"), "utf-8");
  const compose = readFileSync(join(deploy, "docker-compose.yml"), "utf-8");

  it("Caddy sends nothing but /health straight to folio-assistant", () => {
    const direct = caddy.split("\n").filter((l) => /^\s*reverse_proxy\b.*folio-assistant/.test(l));
    expect(direct.length).toBe(1);
    expect(caddy).toMatch(/route \/health \{\s*reverse_proxy folio-assistant/);
    expect(caddy).not.toContain("@has_token");
  });

  it("compose gives both services the gateway secret, the right upstream name, and a container bind", () => {
    expect(compose).not.toContain("PAPER_ASSISTANT_UPSTREAM");
    expect(compose).toContain("FOLIO_UPSTREAM=http://folio-assistant:");
    expect(compose.match(/FOLIO_GATEWAY_SECRET=\$\{FOLIO_GATEWAY_SECRET:\?/g)?.length).toBe(2);
    expect(compose).toContain("FOLIO_BIND_HOST=0.0.0.0");
  });
});
