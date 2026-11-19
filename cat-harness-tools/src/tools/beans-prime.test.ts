/**
 * The no-CLI fallback of the work-plan primer reads the DECLARED bean store
 * (bean `gz47`). It read `beans/*.md`, where the only Markdown is the
 * directory README, so an agent without the `beans` CLI was primed with one
 * "bean": the README.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { beanDefsDir } from "../../scripts/beans.js";
import { repoRootFor } from "../../schemas/kg/cat-harness.js";
import { primeFromDir } from "./beans-prime.js";

const REPO = repoRootFor(resolve(import.meta.dir, "../.."));
const listed = (text: string) => text.split("\n").filter((l) => l.startsWith("- "));

describe("beans-prime's fallback reads the declared store", () => {
  test("the declared bean-defs directory primes the real beans", () => {
    const dir = beanDefsDir(REPO);
    expect(dir, "this checkout declares a bean-defs node").not.toBeNull();
    // Every Markdown file in the declared store is listed, and there is more
    // than the README. Not a size floor: the active store is open work, which
    // a drain empties on purpose (cat-harness-tools#1248).
    const files = readdirSync(dir!).filter((f) => f.endsWith(".md"));
    expect(files.length).toBeGreaterThan(1);
    expect(listed(primeFromDir(dir!)).length).toBe(files.length);
  });

  test("the old spelling primed the README alone — the defect this replaced", () => {
    expect(listed(primeFromDir(join(REPO, "beans"))).length).toBe(1);
  });
});
