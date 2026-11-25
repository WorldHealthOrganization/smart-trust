/**
 * `agent-memory` tests that read the aggregate repository's own root — the
 * root-declared `memory/` graph and the generated `.claude/agent-memory/`
 * files — moved here from `cat-harness/scripts/tests/agent-memory.test.ts`
 * (bean `ho66`), as `merge-guard-workflows.test.ts` was: a standalone
 * cat-harness layer has no such root, and `check:cat-harness-standalone`
 * collects every test in that layer. Every test there that read the real
 * corpus moved, including the ones that passed standalone only because they
 * iterated over nothing. The rest of that file's tests stay there.
 *
 * Moved again, from `cat-harness-tools/scripts/tests/` to the checkout's own
 * test home `test/` (bean `7zz1`, owner ruling 2026-10-06 "Top-level
 * instance"): what it reads belongs to the whole checkout, which the root
 * layer declares, not to any one layer — so cat-harness-tools stays green
 * standing alone too.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  MemoryNodeSchema,
  memoryForAgent,
  memoryForRoles,
} from "../../schemas/conduct/memory.js";
import {
  AGENT_MEMORY_DIR,
  AGENTS_MD_BYTE_BUDGET,
  AGENTS_MD_FILE,
  ANTIGRAVITY_RULE_BYTE_BUDGET,
  ANTIGRAVITY_RULE_FILE,
  ANTIGRAVITY_SKILL_BYTE_BUDGET,
  agentNames,
  parseMemoryFile,
  readMemoryNodes,
  renderEntries,
  syncAgentsMd,
  syncAll,
  syncAntigravity,
  syncAntigravityRule,
} from "../../scripts/agent-memory.js";

describe("the corpus", () => {
  test("there are memory nodes to check — otherwise this proves nothing", () => {
    expect(readMemoryNodes().length).toBeGreaterThan(20);
  });

  test("every node validates, and none is a baseline without provenance", () => {
    // `readMemoryNodes` throws on an invalid node, so reaching here is the
    // assertion; parsing again makes the failure name the schema rather than
    // the loader.
    const nodes = readMemoryNodes();
    for (const n of nodes) {
      expect(MemoryNodeSchema.safeParse(n).success).toBe(true);
    }
    // No `baseline` entry lacks its `measured` provenance…
    expect(nodes.filter((n) => n.label === "baseline" && n.measured === undefined).map((n) => n.id)).toEqual([]);
    // …and that is the schema's doing: a real node relabelled `baseline` with
    // no `measured` does not parse.
    const { measured: _measured, ...bare } = nodes[0];
    expect(MemoryNodeSchema.safeParse({ ...bare, label: "baseline" }).success).toBe(false);
  });

  test("ids are unique — overlay resolves by id, so a collision hides an entry", () => {
    const ids = readMemoryNodes().map((n) => n.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  test("a shared SUMMARY is allowed, and the corpus really has one", () => {
    // `content-pipeline-navigator` and `platform-boundary-guard` both carry
    // "re-measure, do not quote" over DISJOINT bodies. Deriving ids from
    // summaries would have collided them and dropped one; this pins that the
    // corpus still exercises the case.
    const summaries = readMemoryNodes().map((n) => n.summary);
    expect(summaries.length).toBeGreaterThan(new Set(summaries).size);
  });

  test("every agent's file is assembled and current", () => {
    for (const r of syncAll(false)) {
      expect({ agent: r.agent, state: r.state }).toEqual({ agent: r.agent, state: "unchanged" });
    }
  });

  test("no memory ENTRY falls past the harness's 200-line injection budget", () => {
    // Deliberately not `lines > 200`, which is what this asserted first and is
    // the wrong question. The harness injects the FIRST 200 lines, so a long
    // file loses its TAIL — the hand-written `## Session log`, which costs
    // nothing. An ENTRY past the line is memory the agent will never see.
    //
    // Measured 2026-09-19: a sibling's 37-line TRAP took
    // `content-pipeline-navigator` 13 lines over, losing only session-log
    // lines. A total-lines gate would have failed the build over that and
    // taught the next agent to write less down.
    for (const r of syncAll(false)) {
      expect({ agent: r.agent, lost: r.overflowEntries }).toEqual({ agent: r.agent, lost: [] });
    }
  });
});

describe("the role axis discriminates — memoryForRoles is not dead code", () => {
  test("every live entry carries a lane, so untagged has no instances", () => {
    // Both subagents are declared actors now, and every non-archived entry is
    // tagged with the lane that reads it. That makes the "untagged reaches
    // everybody" clause a rule with nothing under it — worth pinning, because
    // an untagged entry added later would silently go to EVERY agent in a
    // corpus where nothing else does.
    const live = readMemoryNodes().filter((n) => !n.archived);
    const untagged = live.filter((n) => n.tags.roles.length === 0);
    expect(untagged.map((n) => n.id)).toEqual([]);
  });

  test("a CI lane sees the CI entries; another lane does not", () => {
    // The owner, 2026-09-19: "ci watchers are agents/mechanical roles that are
    // part of the CI process." `roles.json` already carried `build-pipeline`
    // and `validation-pipeline`, both `actorKind: "system"`, and the
    // `ci-pipeline` actor already took both — so the lane was declared before
    // the watcher was written, and an earlier comment of mine claiming no role
    // fit was simply wrong. Bean `29ij`.
    const nodes = readMemoryNodes();
    const ci = memoryForRoles(nodes, ["build-pipeline"]);
    const other = memoryForRoles(nodes, ["reviewer"]);
    expect(ci.length).toBeGreaterThan(other.length);
    // An untagged entry reaches everybody, so the difference is exactly the
    // tagged ones -- not an assertion that other lanes see nothing.
    expect(ci.length - other.length).toBe(
      nodes.filter((n) => n.tags.roles.includes("build-pipeline")).length,
    );
  });

  test("role tags do not change what an AGENT is handed", () => {
    // Generation goes through `memoryForAgent`, so tagging a lane is additive
    // and must not churn the generated files. If this breaks, the two axes
    // have been wired together -- which is the composition mistake the role
    // model already paid for once.
    const nodes = readMemoryNodes();
    expect(nodes.some((n) => n.tags.roles.length > 0)).toBe(true);
    const withRoles = (roles: string[]) => nodes.map((n) => ({ ...n, tags: { ...n.tags, roles } }));
    for (const agent of agentNames()) {
      const handed = memoryForAgent(nodes, agent).map((n) => n.id);
      expect({ agent, handed: memoryForAgent(withRoles([]), agent).map((n) => n.id) }).toEqual({ agent, handed });
      expect({ agent, handed: memoryForAgent(withRoles(["reviewer"]), agent).map((n) => n.id) }).toEqual({ agent, handed });
    }
  });
});

describe("round trip — no entry is lost", () => {
  test("every entry in every generated file parses back to a node", () => {
    const byId = new Map(readMemoryNodes().map((n) => [n.summary, n]));
    for (const agent of agentNames()) {
      const text = readFileSync(join(AGENT_MEMORY_DIR, agent, "MEMORY.md"), "utf8");
      const parsed = parseMemoryFile(text);
      expect(parsed.length).toBeGreaterThan(0);
      for (const e of parsed) {
        expect(`${agent}: ${e.summary}`).toBe(`${agent}: ${byId.get(e.summary)?.summary}`);
      }
    }
  });
});

describe("rendering", () => {
  test("entries come out STABLE, then TRAP, then BASELINE", () => {
    const nodes = readMemoryNodes();
    const out = renderEntries(nodes);
    const order = [...out.matchAll(/^## (STABLE|TRAP|BASELINE) —/gm)].map((m) => m[1]);
    const rank = { STABLE: 0, TRAP: 1, BASELINE: 2 } as Record<string, number>;
    expect(order.map((o) => rank[o!])).toEqual([...order.map((o) => rank[o!])].sort());
  });
});

describe("archived entries are retained but injected nowhere", () => {
  test("the corpus has archived entries, and they reach no agent", () => {
    // The third state between "reaches everybody" and "deleted". Retiring
    // `content-pipeline-navigator` created seven of these: its sole readers,
    // with no remaining agent that had budget for them.
    const nodes = readMemoryNodes();
    const archived = nodes.filter((n) => n.archived);
    expect(archived.length).toBeGreaterThan(0);
    for (const agent of agentNames()) {
      const got = memoryForAgent(nodes, agent).filter((n) => n.archived);
      expect({ agent, archived: got.map((n) => n.id) }).toEqual({ agent, archived: [] });
    }
  });
});

describe("the budget check sees a TRUNCATED entry, not just a late heading", () => {

  test("this repo's own generated files are whole", () => {
    // The live assertion, not a fixture: every agent's region must END inside
    // the budget, which is what the entries-past-heading check never asked.
    for (const r of syncAll(false)) {
      if (r.state === "missing" || r.state === "no-markers") continue;
      expect(r.overflowEntries).toEqual([]);
    }
  });
});

describe("Antigravity workspace rule target (bean fkqa)", () => {
  test("the Antigravity agent-memory rule file exists and is current", () => {
    const res = syncAntigravityRule(false);
    expect(res.state).toBe("unchanged");
    expect(res.dropped).toEqual([]);
    expect(res.entries).toBeGreaterThan(20);
    expect(res.bytes).toBeLessThanOrEqual(ANTIGRAVITY_RULE_BYTE_BUDGET);
  });

  test("the Antigravity rule file has both agent sections populated", () => {
    const text = readFileSync(ANTIGRAVITY_RULE_FILE, "utf8");
    expect(text).toContain("## ci-health-watcher");
    expect(text).toContain("## platform-boundary-guard");
    expect(text).toContain("### STABLE —");
    expect(text).toContain("### TRAP —");
  });

  test("every Antigravity workspace skill is current and within its byte budget", () => {
    for (const r of syncAntigravity(false)) {
      expect({ agent: r.agent, state: r.state, dropped: r.dropped }).toEqual({
        agent: r.agent,
        state: "unchanged",
        dropped: [],
      });
      expect(r.bytes).toBeLessThanOrEqual(ANTIGRAVITY_SKILL_BYTE_BUDGET);
    }
  });

  test("the repo-wide AGENTS.md target is gated and drops no entries", () => {
    const res = syncAgentsMd(false);
    // A layer checked out alone (the standalone probe) has no aggregate root,
    // so there is no repo-wide AGENTS.md to assemble: `missing` is the honest
    // state there. Where the file exists it must be current or unmarked.
    const expected = existsSync(AGENTS_MD_FILE) ? ["unchanged", "no-markers"] : ["missing"];
    expect(expected).toContain(res.state);
    expect(res.dropped).toEqual([]);
    if (res.state === "unchanged") {
      expect(res.bytes).toBeLessThanOrEqual(AGENTS_MD_BYTE_BUDGET);
    }
  });
});
