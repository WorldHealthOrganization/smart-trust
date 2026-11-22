/**
 * Folio Assistant — what the HTTP server believes about who is asking.
 *
 * Identity comes from the auth-gateway (`src/auth/gateway.ts`) as `X-User-*`
 * headers. A header is only worth something if the gateway set it, so the
 * gateway also sends `X-Folio-Gateway: <FOLIO_GATEWAY_SECRET>`, a secret it
 * shares with this server. Here:
 *
 * - `/mcp` is refused unless the request carries that secret. With no secret
 *   configured, `/mcp` is served only on a loopback bind (local use).
 * - On every other path, a request without the secret has its `X-User-*`
 *   headers removed, so it is treated as nobody rather than as whoever it
 *   claims to be.
 *
 * And the server listens on 127.0.0.1 unless `FOLIO_BIND_HOST` says otherwise
 * (the Docker deployment sets 0.0.0.0, behind the gateway).
 *
 * @module folio-assistant/core/gateway-trust
 */

import { timingSafeEqual } from "node:crypto";

export const GATEWAY_HEADER = "x-folio-gateway";

/** The interface Bun.serve binds to. Loopback unless the operator says otherwise. */
export function bindHostname(env: Record<string, string | undefined> = process.env): string {
  return env.FOLIO_BIND_HOST || "127.0.0.1";
}

function isLoopback(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "::1" || hostname === "localhost";
}

/** Does this request carry the gateway's shared secret? False when none is configured. */
export function fromGateway(req: Request, secret: string | undefined = process.env.FOLIO_GATEWAY_SECRET): boolean {
  if (!secret) return false;
  const got = req.headers.get(GATEWAY_HEADER);
  if (!got) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The refusal for an `/mcp` request the gateway did not vouch for, or `null`
 * when it may be served.
 */
export function refuseMcp(
  req: Request,
  hostname: string,
  secret: string | undefined = process.env.FOLIO_GATEWAY_SECRET,
): Response | null {
  if (secret) {
    return fromGateway(req, secret) ? null : new Response("Unauthorized", { status: 401 });
  }
  if (isLoopback(hostname)) return null;
  return new Response("Unauthorized: /mcp on a non-loopback bind needs FOLIO_GATEWAY_SECRET", { status: 401 });
}

/**
 * The request with its `X-User-*` headers removed unless the gateway sent it.
 * With no secret configured the headers are kept only on a loopback bind,
 * where no one but the local user can reach the server.
 */
export function trustedRequest(
  req: Request,
  hostname: string,
  secret: string | undefined = process.env.FOLIO_GATEWAY_SECRET,
): Request {
  if (secret ? fromGateway(req, secret) : isLoopback(hostname)) return req;
  let any = false;
  const headers = new Headers();
  for (const [k, v] of req.headers) {
    if (k.toLowerCase().startsWith("x-user-")) { any = true; continue; }
    headers.append(k, v);
  }
  if (!any) return req;
  // Built from parts: Bun's `new Request(req, { headers })` keeps the original
  // headers when the replacement set is empty.
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(req.url, {
    method: req.method,
    headers,
    body: hasBody ? req.body : undefined,
    signal: req.signal,
    redirect: req.redirect,
    ...(hasBody ? { duplex: "half" } : {}),
  } as RequestInit);
}
