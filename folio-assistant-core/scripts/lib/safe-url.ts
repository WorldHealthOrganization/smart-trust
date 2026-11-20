/**
 * Outbound URL destination checks for fetch scripts (bean `folio-core-xpsq`,
 * rule `scz-guard-outbound-requests`).
 *
 * Ensures every request — initial and after any HTTP 3xx redirect — uses
 * `https:` with no credentials or custom port and targets an expected host in
 * the caller's allow-list.
 *
 * @module folio-assistant-core/scripts/lib/safe-url
 * @covers none — URL validation helper for CLI/CI fetch scripts
 */

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * Parse `rawUrl` (optionally relative to `base`) and verify that:
 *   1. scheme is `https:`;
 *   2. no username/password credentials or non-default port are present;
 *   3. hostname is in `allowedHosts` (case-insensitive exact match).
 */
export function assertHttpsHost(
  rawUrl: string,
  allowedHosts: ReadonlySet<string>,
  base?: string,
): URL {
  let parsed: URL;
  try {
    parsed = base !== undefined ? new URL(rawUrl, base) : new URL(rawUrl);
  } catch {
    throw new Error(`Refused URL: invalid URL '${rawUrl}'`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`Refused URL '${parsed.href}': scheme must be https: (got ${parsed.protocol})`);
  }
  if (parsed.username !== "" || parsed.password !== "") {
    throw new Error(`Refused URL '${parsed.href}': credentials in URL are not allowed`);
  }
  if (parsed.port !== "") {
    throw new Error(`Refused URL '${parsed.href}': non-default port '${parsed.port}' is not allowed`);
  }
  const host = parsed.hostname.toLowerCase();
  if (!allowedHosts.has(host)) {
    throw new Error(
      `Refused URL '${parsed.href}': unexpected host '${host}' (allowed: ${[...allowedHosts].join(", ")})`,
    );
  }
  return parsed;
}

/**
 * Fetch `rawUrl` with `redirect: "manual"`, validating the initial URL and
 * every redirect `Location` target against `allowedHosts` (`https:` only).
 */
export async function fetchChecked(
  rawUrl: string,
  allowedHosts: ReadonlySet<string>,
  init: RequestInit = {},
  fetcher: typeof fetch = fetch,
  maxRedirects = 5,
): Promise<{ response: Response; finalUrl: string }> {
  let current = assertHttpsHost(rawUrl, allowedHosts).href;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const response = await fetcher(current, { ...init, redirect: "manual" });
    if (!REDIRECT_STATUSES.has(response.status)) {
      return { response, finalUrl: current };
    }
    const location = response.headers.get("location");
    if (!location) {
      throw new Error(`${current}: HTTP ${response.status} redirect without Location header`);
    }
    if (hop === maxRedirects) {
      throw new Error(`${rawUrl}: exceeded maximum redirects (${maxRedirects})`);
    }
    current = assertHttpsHost(location, allowedHosts, current).href;
  }
  throw new Error(`${rawUrl}: exceeded maximum redirects (${maxRedirects})`);
}
