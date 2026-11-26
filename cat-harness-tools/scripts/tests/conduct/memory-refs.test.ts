/**
 * A memory entry's `roles:` and its `references` to agents name things that
 * exist (#1168 B8; `agents:` became `references` with `kind: agent` in B10a).
 *
 * `memoryForRoles` hands an entry to every lane whose role it names, and
 * `memoryForAgent` to every agent it names. A typo in either does not fail:
 * the entry simply reaches nobody, which from the outside looks exactly like
 * an entry nobody needed. This resolves both.
 *
 * "every agent reference is a declared subagent" lives in
 * `test/memory-refs-checkout.test.ts` (bean `ho66`): the subagents are
 * declared under the aggregate root's `.claude/agents/`, which a standalone
 * cat-harness does not hold.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Glob } from "bun";

import { list, mappingList, parseFrontMatter } from "../../../schemas/kg/front-matter.ts";
import { MEMORY_DIRS } from "../../agent-memory.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { dirname } from "node:path";

const REPO = resolve(dirname(HARNESS_ROOT));

const roleIds = (): Set<string> => {
  const doc = JSON.parse(readFileSync(join(REPO, "cat-harness", "scenarios", "roles.json"), "utf-8")) as {
    roles?: { id: string }[] | Record<string, unknown>;
  };
  const r = doc.roles ?? {};
  return new Set(Array.isArray(r) ? r.map((x) => x.id) : Object.keys(r));
};

describe("memory entries name roles and agents that exist", () => {
  const roles = roleIds();
  // Every declared memory directory (bean `ar1s`: memory is split by the
  // harness each lesson belongs to), not one path at the repository root.
  const entries = MEMORY_DIRS()
    .flatMap((dir) => [...new Glob("**/*.md").scanSync({ cwd: dir })].map((rel) => ({ dir, rel })))
    .filter(({ rel }) => rel !== "README.md")
    .map(({ dir, rel }) => {
      const text = readFileSync(join(dir, rel), "utf-8");
      return { rel, fm: parseFrontMatter(text).fm, refs: mappingList(text, "references") };
    })
    .filter((e) => e.fm["$schema"] === "folio-memory/v1")
    // An ARCHIVED entry reaches nobody on purpose — the third state between
    // "reaches everybody" and "deleted" (agent-memory skill). Its names are
    // history, and may name an agent that no longer exists.
    .filter((e) => e.fm["archived"] !== "true");

  test("the corpus is non-empty, so the assertions below are not vacuous", () => {
    expect(roles.size).toBeGreaterThan(0);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((e) => list(e.fm, "roles").length > 0)).toBe(true);
  });

  test("every `roles:` value is a declared role", () => {
    const dangling = entries.flatMap((e) =>
      list(e.fm, "roles").filter((r) => !roles.has(r)).map((r) => `${e.rel} → ${r}`),
    );
    expect(dangling).toEqual([]);
  });

  test("no entry carries the retired `agents:` shorthand", () => {
    expect(entries.filter((e) => e.fm["agents"] !== undefined).map((e) => e.rel)).toEqual([]);
  });
});
