/**
 * The "site not built" guard (bean `folio-assistant-w1gy` F18, option A):
 * it skips ONLY when the run stands alone AND a built file is absent, and
 * in the composed checkout it never skips.
 */
import { afterAll, describe, expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { siteNotBuilt, siteNotBuiltWhen, STANDALONE } from "./support/checkout.ts";

const dir = mkdtempSync(join(tmpdir(), "site-not-built-"));
const built = join(dir, "index.json");
writeFileSync(built, "{}\n");
const absent = join(dir, "count.json");
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** The guard's answer, with what it printed. */
function ask(standalone: boolean, paths: string[]): { skip: boolean; said: string[] } {
  const warn = spyOn(console, "warn").mockImplementation(() => {});
  try {
    const skip = siteNotBuiltWhen(standalone, "the fixture projection", paths);
    return { skip, said: warn.mock.calls.map((c) => String(c[0])) };
  } finally {
    warn.mockRestore();
  }
}

describe("siteNotBuilt", () => {
  test("standing alone with the file absent, it skips and names the file", () => {
    const r = ask(true, [absent]);
    expect(r.skip).toBe(true);
    expect(r.said).toHaveLength(1);
    expect(r.said[0]).toContain("site not built");
    expect(r.said[0]).toContain("the fixture projection");
    expect(r.said[0]).toContain("count.json");
  });

  test("standing alone with the file PRESENT, it does not skip, and says nothing", () => {
    expect(ask(true, [built])).toEqual({ skip: false, said: [] });
  });

  test("one absent file of several is enough, and only that one is named", () => {
    const r = ask(true, [built, absent]);
    expect(r.skip).toBe(true);
    expect(r.said[0]).toContain("count.json");
    expect(r.said[0]).not.toContain("index.json");
  });

  test("in the composed checkout it never skips, absent or not — the test runs and fails there", () => {
    expect(ask(false, [absent])).toEqual({ skip: false, said: [] });
    expect(ask(false, [built])).toEqual({ skip: false, said: [] });
  });

  test("a guard over no path is refused rather than answering", () => {
    expect(() => siteNotBuiltWhen(true, "nothing", [])).toThrow(/no path/);
  });

  test("the exported guard is the one above, at this checkout's own layout", () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(siteNotBuilt("the fixture projection", absent)).toBe(STANDALONE);
      expect(siteNotBuilt("the fixture projection", built)).toBe(false);
    } finally {
      warn.mockRestore();
    }
  });
});
