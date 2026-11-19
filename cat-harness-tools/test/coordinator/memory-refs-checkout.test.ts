/**
 * A memory entry's agent `references` name a declared subagent — held against
 * the WHOLE CHECKOUT, moved here from `cat-harness-tools/scripts/tests/conduct/memory-refs.test.ts`
 * (bean `ho66`, owner ruling 2026-10-06 "Top-level instance"). The subagents
 * are declared under the aggregate root's `.claude/agents/`, which a
 * standalone cat-harness does not hold, so there every reference read as
 * dangling. The roles half and the corpus checks stay there; the paths below
 * are composed from ORIGIN_DIR, the directory this was written in, so nothing
 * it reads changed.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Glob } from "bun";

import { mappingList, parseFrontMatter } from "../../schemas/kg/front-matter.ts";
import { MEMORY_DIRS } from "../../scripts/agent-memory.ts";

/** The directory this test was written in (`cat-harness/scripts/tests/`). */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const REPO = resolve(ORIGIN_DIR, "..", "..", "..");

describe("memory entries name roles and agents that exist", () => {
  // The same entry set as `memory-refs.test.ts` builds: every declared memory
  // directory, `folio-memory/v1` nodes only, archived entries excluded.
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

  test("every agent reference is a declared subagent", () => {
    const agents = entries.flatMap((e) => e.refs.filter((r) => r.kind === "agent").map((r) => ({ e, id: r.id! })));
    expect(agents.length).toBeGreaterThan(0);
    const dangling = agents
      .filter(({ id }) => !existsSync(join(REPO, ".claude", "agents", `${id}.md`)))
      .map(({ e, id }) => `${e.rel} → ${id}`);
    expect(dangling).toEqual([]);
  });
});
