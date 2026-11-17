/**
 * A standalone viewer page with the harness rail, BUILT by the same
 * `withViewerNav` → `injectRail` every viewer generator writes through,
 * rather than read from a committed page.
 *
 * `rail-tips.e2e.ts` and `harness-row-alignment.e2e.ts` used to read one
 * committed standalone viewer — `beans/`, then `qa/`, then
 * `translation-status/` — and each time that page moved onto the theme's
 * `default` layout (#1906, #2418, 2026-10-07), the specs lost their subject
 * and had to be pointed at the next one. A fixture that depends on some page
 * staying standalone breaks whenever a page gets the top band. What the specs
 * test is the RAIL, so the rail is what is built: a minimal standalone page,
 * railed exactly as a generator rails it, with this checkout's own row,
 * harnesses and graphs.
 *
 * Built in a `bun` child process (`railed-fixture.build.ts`), because the
 * rail's writer is generator code that runs under bun (`import.meta.dir`)
 * and Playwright loads specs under node.
 *
 * @module test/railed-fixture
 */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The fixture page, railed. Throws if the rail could not be built — an unrailed fixture tests nothing. */
export function railedViewer(): string {
  const html = execFileSync("bun", ["run", join(HERE, "railed-fixture.build.ts")], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (!html.includes('class="fa-nav"')) throw new Error("the railed fixture carries no rail");
  return html;
}
