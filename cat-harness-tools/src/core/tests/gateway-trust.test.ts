/**
 * The HTTP server serves `/mcp`, and believes `X-User-*`, only for the
 * auth-gateway (security review 2026-10-31, H1, H3).
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { bindHostname, fromGateway, refuseMcp, trustedRequest, GATEWAY_HEADER } from "../gateway-trust";

const SECRET = "s".repeat(40);
const mcp = (headers: Record<string, string> = {}) =>
  new Request("http://folio-assistant:8080/mcp", { method: "POST", headers });

describe("refuseMcp", () => {
  it("refuses any bearer header when a secret is configured and not presented", () => {
    expect(refuseMcp(mcp({ authorization: "Bearer x" }), "0.0.0.0", SECRET)!.status).toBe(401);
    expect(refuseMcp(mcp({ [GATEWAY_HEADER]: "wrong" }), "0.0.0.0", SECRET)!.status).toBe(401);
  });

  it("serves the gateway's request", () => {
    expect(refuseMcp(mcp({ [GATEWAY_HEADER]: SECRET }), "0.0.0.0", SECRET)).toBeNull();
  });

  it("with no secret, serves only a loopback bind", () => {
    expect(refuseMcp(mcp(), "0.0.0.0", "")!.status).toBe(401);
    expect(refuseMcp(mcp(), "127.0.0.1", "")).toBeNull();
  });
});

describe("trustedRequest", () => {
  const withIdentity = (extra: Record<string, string> = {}) =>
    new Request("http://x/api/git/checkout", { headers: { "x-user-role": "owner", "x-user-actor": "owner", ...extra } });

  it("drops X-User-* from a request the gateway did not send", () => {
    const r = trustedRequest(withIdentity(), "0.0.0.0", SECRET);
    expect(r.headers.get("x-user-role")).toBeNull();
    expect(r.headers.get("x-user-actor")).toBeNull();
  });

  it("keeps them on the gateway's request", () => {
    const r = trustedRequest(withIdentity({ [GATEWAY_HEADER]: SECRET }), "0.0.0.0", SECRET);
    expect(fromGateway(r, SECRET)).toBe(true);
    expect(r.headers.get("x-user-role")).toBe("owner");
  });

  it("with no secret, keeps them only on loopback", () => {
    expect(trustedRequest(withIdentity(), "0.0.0.0", "").headers.get("x-user-role")).toBeNull();
    expect(trustedRequest(withIdentity(), "127.0.0.1", "").headers.get("x-user-role")).toBe("owner");
  });
});

describe("bind address", () => {
  it("is loopback unless FOLIO_BIND_HOST says otherwise", () => {
    expect(bindHostname({})).toBe("127.0.0.1");
    expect(bindHostname({ FOLIO_BIND_HOST: "0.0.0.0" })).toBe("0.0.0.0");
  });

  // Both servers' Bun.serve calls pass it, and /mcp goes through refuseMcp.
  // A source check: a route test would need a live port per case.
  it.each(["src/server.ts", "adapters/mcp-server/server.ts"])("%s binds bindHostname() and guards /mcp", (file) => {
    const src = readFileSync(join(import.meta.dir, "../../..", file), "utf-8");
    const serves = src.match(/Bun\.serve\(\{/g) ?? [];
    expect(serves.length).toBe(2);
    expect(src.match(/^\s+hostname,$/gm)?.length).toBe(2);
    expect(src).toContain("refuseMcp(");
    expect(src).not.toMatch(/return httpTransport\.handleRequest\(req\);/);
  });
});
