/**
 * Agent memory survives the round trip, and the generator never eats a log.
 *
 * The two failures worth gating are both silent. A parse that drops an entry
 * leaves an agent quietly less informed than its file says it is; a splice
 * that overruns its markers deletes the `## Session log` the agent wrote
 * itself. Neither shows up as an error, and both are invisible in a diff that
 * nobody reads because "it's generated".
 *
 * The tests here that read the aggregate repository's own root (the
 * root-declared `memory/` graph and the generated `.claude/agent-memory/`
 * files) live in
 * `test/agent-memory-repo-root.test.ts` (bean
 * `ho66`): standing alone, cat-harness has no such root to read.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  MEMORY_SCHEMA_TAG,
  MemoryNodeSchema,
  memoryForAgent,
} from "../../schemas/conduct/memory.js";
import { EMPTY_NOTE_TAGS } from "../../schemas/kg/carried-note.js";
import {
  AGENT_MEMORY_TARGETS,
  AGENTS_MD_BEGIN,
  AGENTS_MD_BYTE_BUDGET,
  AGENTS_MD_END,
  ANTIGRAVITY_RULE_BYTE_BUDGET,
  ANTIGRAVITY_SKILL_BYTE_BUDGET,
  BEGIN,
  CLAUDE_MEMORY_LINE_BUDGET,
  END,
  DEFAULT_ANTIGRAVITY_RULE_TEMPLATE,
  droppedEntryReport,
  droppedTargetNodesReport,
  entriesPastBudget,
  isMountedInstance,
  ROOT,
  lowestPriorityFirst,
  memoryDirsFor,
  parseMemoryFile,
  readMemoryNodes,
  rebaseAgentsMdLinks,
  rebaseAgentFileLinks,
  rebaseRuleLinks,
  renderAgentsMdSection,
  renderAntigravityRule,
  renderAntigravitySkillWithBudget,
  repoWideMemory,
  runAgentMemory,
  slugify,
  spliceAgentsMdRegion,
  spliceRegion,
  syncAgentsMd,
  syncAntigravityRule,
} from "../agent-memory.js";

describe("the corpus", () => {

  test("the overflow check can actually fire", () => {
    // A gate that cannot fail is not a gate. `entriesPastBudget` is exported so
    // this can be shown against a file it controls, rather than waiting for the
    // corpus to grow into the failure.
    const file = ["x", ...Array(210).fill("y"), "## TRAP — dropped"].join("\n");
    expect(entriesPastBudget(file)).toEqual(["TRAP — dropped"]);
    expect(entriesPastBudget(file, 1000)).toEqual([]);
  });
});

describe("the parse keeps non-entries out", () => {
  const FILE = [
    "# a — memory",
    "preamble",
    "---",
    "## STABLE — one",
    "body one",
    "",
    "## TRAP — two",
    "body two",
    "---",
    "## Session log",
    "- did a thing",
  ].join("\n");

  test("only labelled headings are entries", () => {
    expect(parseMemoryFile(FILE).map((e) => e.summary)).toEqual(["one", "two"]);
  });

  test("the session log is NOT swallowed into the last entry's body", () => {
    // Without the non-entry-heading guard, "## Session log\n- did a thing"
    // lands in TRAP two's comment and is then written back INSIDE the markers
    // — the generator destroying the log it was supposed to leave alone.
    const two = parseMemoryFile(FILE).find((e) => e.summary === "two");
    expect(two?.comment).toBe("body two");
  });

  test("a label that is not one of the three is not an entry", () => {
    expect(parseMemoryFile("## NOTES — hello\nbody")).toEqual([]);
  });
});

describe("splice writes only between the markers", () => {
  const file = `head\n${BEGIN}\nold\n${END}\ntail\n## Session log\n- kept`;

  test("everything outside the region survives verbatim", () => {
    const out = spliceRegion(file, "new")!;
    expect(out.startsWith("head\n")).toBe(true);
    expect(out).toContain("## Session log\n- kept");
    expect(out).toContain("new");
    expect(out).not.toContain("old");
  });

  test("a file with NO markers is refused, not rewritten", () => {
    // Third state. Writing markers into a file that lacks them would mean this
    // tool deciding where an author's generated region starts.
    expect(spliceRegion("no markers here", "new")).toBeUndefined();
  });

  test("markers in the wrong order are refused too", () => {
    expect(spliceRegion(`${END}\nx\n${BEGIN}`, "new")).toBeUndefined();
  });
});

describe("rendering", () => {

  test("slugify is stable and url-safe", () => {
    expect(slugify("`uses[]` is EDITORIAL, and immediate-neighbours only")).toBe(
      "uses-is-editorial-and-immediate-neighbours-only",
    );
  });
});

describe("archived entries are retained but injected nowhere", () => {

  test("archived beats UNTAGGED, which is the ordering that matters", () => {
    // An archived entry carries no agent tag once its agent is gone, so the
    // "untagged reaches everybody" clause would hand it to every agent if it
    // were checked first. Measured: removing the retired agent's name from two
    // entries without archiving them made both untagged, which pushed
    // `platform-boundary-guard` 39 lines over its injection budget and dropped
    // one of its own TRAPs past the line.
    const base = {
      id: "a", summary: "s", comment: "c", createdAt: "2026-09-19",
      tags: EMPTY_NOTE_TAGS, label: "stable" as const, $schema: MEMORY_SCHEMA_TAG,
    };
    const untagged = MemoryNodeSchema.parse(base);
    const archived = MemoryNodeSchema.parse({ ...base, id: "b", archived: true });
    expect(memoryForAgent([untagged, archived], "anyone").map((n) => n.id)).toEqual(["a"]);
  });

  test("the ordering holds through the READER, for both front-matter spellings", () => {
    // The test above pins `memoryForAgent`, which is handed an already-parsed
    // node. The path an author actually takes is the front matter, and there
    // the flag is a STRING COMPARE -- `fm["archived"] === "true"` -- so the
    // two spellings the corpus uses (`archived: true` and `archived: "true"`)
    // must both survive the read. If one did not, the node would come back
    // live AND untagged, and the untagged clause would hand it to every agent:
    // the exact inversion archiving exists to prevent, arriving as a widened
    // blast radius rather than as a missing entry.
    const dir = mkdtempSync(join(tmpdir(), "memory-archived-"));
    try {
      const node = (id: string, archived: string): string =>
        `---\n$schema: ${MEMORY_SCHEMA_TAG}\nid: ${id}\nlabel: stable\n` +
        `summary: "${id}"\ncreatedAt: 2026-09-19\narchived: ${archived}\nreferences:\n---\nbody\n`;
      writeFileSync(join(dir, "bare.md"), node("bare", "true"));
      writeFileSync(join(dir, "quoted.md"), node("quoted", '"true"'));
      writeFileSync(
        join(dir, "live.md"),
        `---\n$schema: ${MEMORY_SCHEMA_TAG}\nid: live\nlabel: stable\n` +
          `summary: "live"\ncreatedAt: 2026-09-19\nreferences:\n---\nbody\n`,
      );

      const nodes = readMemoryNodes(dir);
      expect(nodes.filter((n) => n.archived).map((n) => n.id).sort()).toEqual(["bare", "quoted"]);
      // All three are untagged, so only archiving can keep two of them out.
      expect(nodes.every((n) => n.tags.references.length === 0)).toBe(true);
      expect(memoryForAgent(nodes, "anyone").map((n) => n.id)).toEqual(["live"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a spelling the reader does not understand is REFUSED, not silently dropped", () => {
    // The test above pins the two spellings that work. This pins what happens
    // to the ones that do not, and the answer has to be an error rather than
    // absence.
    //
    // `archived` is `z.boolean().optional()`, so the schema cannot catch this:
    // an unrecognised value was COERCED AWAY before `safeParse` ever saw the
    // node, leaving the field absent -- which is valid. The node then came
    // back live, and because an archived entry has typically lost its `agents`
    // tag, the untagged clause handed it to EVERY agent. Measured on `main` at
    // `e94288562`: of `true`, `TRUE`, `True` and `yes`, three leaked to an
    // agent they were never tagged for.
    //
    // The two directions are not symmetric, which is why this refuses rather
    // than guessing. Too loose and an entry an author meant to keep goes
    // missing -- visible, and the agent's own work shows it. Too strict, as it
    // was, and the entry goes to everybody: a widened blast radius that
    // nothing reports on and no budget check counts.
    const dir = mkdtempSync(join(tmpdir(), "memory-archived-bad-"));
    try {
      writeFileSync(
        join(dir, "typo.md"),
        `---\n$schema: ${MEMORY_SCHEMA_TAG}\nid: typo\nlabel: stable\n` +
          `summary: "typo"\ncreatedAt: 2026-09-19\narchived: probably\nreferences:\n---\nbody\n`,
      );
      expect(() => readMemoryNodes(dir)).toThrow(/archived/);
      // The message has to name the value and the file, or the author cannot
      // act on it.
      expect(() => readMemoryNodes(dir)).toThrow(/probably/);
      expect(() => readMemoryNodes(dir)).toThrow(/typo\.md/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("every YAML boolean spelling of archived is understood, in both cases", () => {
    // Accepting only `true` would fix the spellings somebody thought of. An
    // author writing YAML may reasonably write any of these, and each is
    // unambiguously the same boolean.
    const dir = mkdtempSync(join(tmpdir(), "memory-archived-yaml-"));
    try {
      const node = (id: string, archived: string): string =>
        `---\n$schema: ${MEMORY_SCHEMA_TAG}\nid: ${id}\nlabel: stable\n` +
        `summary: "${id}"\ncreatedAt: 2026-09-19\narchived: ${archived}\nreferences:\n---\nbody\n`;
      const truthy = ["true", "True", "TRUE", "yes", "Yes", "on", '"true"'];
      const falsy = ["false", "False", "FALSE", "no", "No", "off"];
      truthy.forEach((v, i) => writeFileSync(join(dir, `t${i}.md`), node(`t${i}`, v)));
      falsy.forEach((v, i) => writeFileSync(join(dir, `f${i}.md`), node(`f${i}`, v)));

      const nodes = readMemoryNodes(dir);
      expect(nodes.filter((n) => n.archived).map((n) => n.id).sort()).toEqual(
        truthy.map((_, i) => `t${i}`),
      );
      // A FALSE spelling is not archived, and must not leak either way: it is
      // a live node, so it reaches an untagged reader deliberately.
      const live = memoryForAgent(nodes, "anyone").map((n) => n.id).sort();
      expect(live).toEqual(falsy.map((_, i) => `f${i}`));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("the budget check sees a TRUNCATED entry, not just a late heading", () => {
  // Bean `g1ph`. Heading position alone let a real truncation through:
  // after evidence moved into detail files the region ended at line 209, so
  // the last entry's body ran nine lines past the cut while its heading sat
  // comfortably inside — and the check returned nothing. A truncated entry is
  // worse than a dropped one, because it still looks complete to the agent.
  const filler = (n: number): string => "x\n".repeat(n);

  test("a region ending past the budget names the last entry", () => {
    const f = `## TRAP — a thing\n${filler(250)}${END}\n`;
    const past = entriesPastBudget(f);
    expect(past).toHaveLength(1);
    expect(past[0]).toContain("a thing");
    expect(past[0]).toContain("truncated");
  });

  test("a region ending inside the budget is silent", () => {
    expect(entriesPastBudget(`## TRAP — a thing\n${filler(10)}${END}\n`)).toEqual([]);
  });

  test("a heading past the budget still wins — it is the more specific report", () => {
    const f = `${filler(210)}## TRAP — late one\n${END}\n`;
    expect(entriesPastBudget(f)[0]).toContain("late one");
    expect(entriesPastBudget(f)[0]).not.toContain("truncated");
  });
});

describe("the dropped-entry gate", () => {
  // `entriesPastBudget` measures; this decides whether the build stops. They
  // were one thing inside `import.meta.main` and so the DECISION was never
  // reachable from a test — only its input was.
  test("nothing dropped is not a failure", () => {
    expect(droppedEntryReport([])).toBeNull();
  });

  test("a long file whose overflow is only the session log is not a failure", () => {
    // The state of `platform-boundary-guard` on `main`: over 200 lines, but
    // every entry lands inside the cut. Gating on line count instead of on
    // dropped entries would make this red for a reason nobody should act on.
    expect(droppedEntryReport([{ agent: "platform-boundary-guard", entries: [] }])).toBeNull();
  });

  test("a dropped entry is named, counted, and given a way out", () => {
    const report = droppedEntryReport([
      { agent: "platform-boundary-guard", entries: ["TRAP — a", "TRAP — b"] },
    ]);
    expect(report).toContain("platform-boundary-guard: 2 dropped");
    expect(report).toContain("TRAP — a; TRAP — b");
    // The remedy matters as much as the finding: the tempting "fix" is to let
    // the last entry fall off the end, which is the defect, not the cure.
    expect(report).toContain("archived: true");
    expect(report).toContain("Do not fix this by letting the last entry fall off the end");
  });

  test("every affected agent gets its own row", () => {
    const report = droppedEntryReport([
      { agent: "one", entries: ["TRAP — x"] },
      { agent: "two", entries: ["TRAP — y"] },
    ]);
    expect(report).toContain("one: 1 dropped");
    expect(report).toContain("two: 1 dropped");
  });
});

describe("Antigravity workspace rule (bean fkqa)", () => {
  const makeNode = (
    id: string,
    label: "stable" | "trap" | "baseline",
    agent?: string,
    extra: Partial<Record<string, unknown>> = {},
  ) =>
    MemoryNodeSchema.parse({
      id,
      summary: `summary for ${id}`,
      comment: `comment for ${id}`,
      createdAt: "2026-10-06T12:00:00Z",
      label,
      tags: {
        ...EMPTY_NOTE_TAGS,
        references: agent ? [{ kind: "agent", id: agent }] : [],
      },
      $schema: MEMORY_SCHEMA_TAG,
      ...(label === "baseline"
        ? { measured: { command: "bun test", date: "2026-10-06", result: "0 failures" } }
        : {}),
      ...extra,
    });

  test("rebaseRuleLinks rebases ../skills/ links to ../../cat-harness/skills/", () => {
    const raw = "See [`skill.md`](../skills/conduct/skill.md) for details.";
    expect(rebaseRuleLinks(raw)).toBe("See [`skill.md`](../../cat-harness/skills/conduct/skill.md) for details.");
  });

  test("renderAntigravityRule groups live nodes by agent and skips archived nodes", () => {
    const nodes = [
      makeNode("node-a", "stable", "agent-one"),
      makeNode("node-b", "trap", "agent-two"),
      makeNode("node-c", "baseline", undefined), // repo-wide
      makeNode("node-archived", "stable", "agent-one", { archived: true }),
    ];
    const { body, dropped } = renderAntigravityRule(nodes, DEFAULT_ANTIGRAVITY_RULE_TEMPLATE, 50_000);
    expect(dropped).toEqual([]);
    expect(body).toContain("## agent-one");
    expect(body).toContain("### STABLE — summary for node-a");
    expect(body).toContain("## agent-two");
    expect(body).toContain("### TRAP — summary for node-b");
    expect(body).toContain("## repo-wide");
    expect(body).toContain("### BASELINE — summary for node-c");
    expect(body).not.toContain("node-archived");
  });

  test("renderAntigravityRule budget enforcement drops lowest-priority nodes (baseline first)", () => {
    const nodes = [
      makeNode("s1", "stable", "agent-one", { comment: "long stable comment ".repeat(10) }),
      makeNode("t1", "trap", "agent-one", { comment: "long trap comment ".repeat(10) }),
      makeNode("b1", "baseline", "agent-one", { comment: "long baseline comment ".repeat(10) }),
    ];

    // Give a budget that only fits about 1 or 2 nodes
    const { body, dropped } = renderAntigravityRule(nodes, DEFAULT_ANTIGRAVITY_RULE_TEMPLATE, 600);
    expect(dropped.length).toBeGreaterThan(0);
    // Baseline should be the first dropped
    expect(dropped[0].label).toBe("baseline");
    expect(dropped[0].id).toBe("b1");
    // What remains in body should still fit
    const full = spliceRegion(DEFAULT_ANTIGRAVITY_RULE_TEMPLATE, body)!;
    expect(Buffer.byteLength(full, "utf8")).toBeLessThanOrEqual(600);
  });

  test("syncAntigravityRule writes and reports state cleanly", () => {
    const dir = mkdtempSync(join(tmpdir(), "antigravity-rule-"));
    const rulePath = join(dir, "agent-memory.md");
    try {
      const nodes = [makeNode("s1", "stable", "agent-one")];
      // 1. Initial write
      const r1 = syncAntigravityRule(true, nodes, 24_000, rulePath);
      expect(r1.state).toBe("written");
      expect(r1.entries).toBe(1);
      expect(existsSync(rulePath)).toBe(true);

      // 2. Second run without changes -> unchanged
      const r2 = syncAntigravityRule(false, nodes, 24_000, rulePath);
      expect(r2.state).toBe("unchanged");

      // 3. File with no markers -> no-markers
      writeFileSync(rulePath, "no markers");
      const r3 = syncAntigravityRule(false, nodes, 24_000, rulePath);
      expect(r3.state).toBe("no-markers");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("Repo-wide AGENTS.md section and per-target budgets (bean 31ni)", () => {
  const makeNode = (
    id: string,
    label: "stable" | "trap" | "baseline",
    agent?: string,
    extra: Partial<Record<string, unknown>> = {},
  ) =>
    MemoryNodeSchema.parse({
      id,
      summary: `summary for ${id}`,
      comment: `comment for ${id}`,
      createdAt: "2026-10-06T12:00:00Z",
      label,
      tags: {
        ...EMPTY_NOTE_TAGS,
        references: agent ? [{ kind: "agent", id: agent }] : [],
      },
      $schema: MEMORY_SCHEMA_TAG,
      ...(label === "baseline"
        ? { measured: { command: "bun test", date: "2026-10-06", result: "0 failures" } }
        : {}),
      ...extra,
    });

  test("AGENT_MEMORY_TARGETS declares all active targets with explicit budgets", () => {
    expect(AGENT_MEMORY_TARGETS.map((t) => t.id)).toEqual([
      "claude-agent-memory",
      "antigravity-skill",
      "antigravity-rule",
      "agents-md",
      "gemini-agent",
      "codex-agent",
      "cursor-agent",
      "copilot-agent",
    ]);
    expect(AGENT_MEMORY_TARGETS.find((t) => t.id === "claude-agent-memory")?.budget).toEqual({
      unit: "lines",
      limit: CLAUDE_MEMORY_LINE_BUDGET,
    });
    expect(AGENT_MEMORY_TARGETS.find((t) => t.id === "antigravity-skill")?.budget).toEqual({
      unit: "bytes",
      limit: ANTIGRAVITY_SKILL_BYTE_BUDGET,
    });
    expect(AGENT_MEMORY_TARGETS.find((t) => t.id === "antigravity-rule")?.budget).toEqual({
      unit: "bytes",
      limit: ANTIGRAVITY_RULE_BYTE_BUDGET,
    });
    expect(AGENT_MEMORY_TARGETS.find((t) => t.id === "agents-md")?.budget).toEqual({
      unit: "bytes",
      limit: AGENTS_MD_BYTE_BUDGET,
    });
  });

  test("repoWideMemory selects only live nodes with no agent reference", () => {
    const withSkillRefOnly = MemoryNodeSchema.parse({
      id: "repo-skill-ref",
      summary: "repo-wide with skill reference",
      comment: "applies everywhere",
      createdAt: "2026-10-06T12:00:00Z",
      label: "stable",
      tags: {
        ...EMPTY_NOTE_TAGS,
        references: [{ kind: "skill", id: "agent-memory" }],
      },
      $schema: MEMORY_SCHEMA_TAG,
    });
    const nodes = [
      makeNode("repo-1", "stable", undefined),
      withSkillRefOnly,
      makeNode("agent-1", "trap", "ci-health-watcher"),
      makeNode("repo-archived", "stable", undefined, { archived: true }),
    ];
    expect(repoWideMemory(nodes).map((n) => n.id)).toEqual(["repo-1", "repo-skill-ref"]);
  });

  test("lowestPriorityFirst orders baseline -> trap -> stable, oldest createdAt first", () => {
    const nodes = [
      makeNode("s-old", "stable", undefined, { createdAt: "2026-01-01T00:00:00Z" }),
      makeNode("t-new", "trap", undefined, { createdAt: "2026-06-01T00:00:00Z" }),
      makeNode("t-old", "trap", undefined, { createdAt: "2026-02-01T00:00:00Z" }),
      makeNode("b-new", "baseline", undefined, { createdAt: "2026-09-01T00:00:00Z" }),
      makeNode("b-old", "baseline", undefined, { createdAt: "2026-03-01T00:00:00Z" }),
    ];
    expect(lowestPriorityFirst(nodes).map((n) => n.id)).toEqual([
      "b-old",
      "b-new",
      "t-old",
      "t-new",
      "s-old",
    ]);
  });

  test("renderAntigravitySkillWithBudget enforces byte budget and reports dropped nodes", () => {
    const nodes = [
      makeNode("s1", "stable", "agent-one", { comment: "stable lesson ".repeat(20) }),
      makeNode("t1", "trap", "agent-one", { comment: "trap lesson ".repeat(20) }),
      makeNode("b1", "baseline", "agent-one", { comment: "baseline lesson ".repeat(20) }),
    ];
    const res = renderAntigravitySkillWithBudget("agent-one", nodes, 900);
    expect(res.dropped.length).toBeGreaterThan(0);
    expect(res.dropped[0]!.id).toBe("b1");
    expect(res.bytes).toBeLessThanOrEqual(900);
  });

  test("droppedTargetNodesReport returns null when empty and names dropped nodes per target", () => {
    expect(droppedTargetNodesReport([])).toBeNull();
    expect(
      droppedTargetNodesReport([{ target: "AGENTS.md", budgetBytes: 32_768, dropped: [] }]),
    ).toBeNull();

    const b1 = makeNode("b1", "baseline", undefined);
    const report = droppedTargetNodesReport([
      { target: "AGENTS.md", budgetBytes: 32_768, dropped: [b1] },
    ]);
    expect(report).not.toBeNull();
    expect(report).toContain("AGENTS.md (budget 32768 bytes): 1 dropped");
    expect(report).toContain("[BASELINE] b1 (summary for b1)");
    expect(report).toContain("never silent truncation");
  });

  test("rebaseAgentsMdLinks rebases ../skills/ links to cat-harness/skills/", () => {
    const raw = "Read [`agent-memory.md`](../skills/conduct/conduct-core/agent-memory.md).";
    expect(rebaseAgentsMdLinks(raw)).toBe(
      "Read [`agent-memory.md`](cat-harness/skills/conduct/conduct-core/agent-memory.md).",
    );
  });

  test("spliceAgentsMdRegion supports both cat-harness:agent-memory and folio:memory markers", () => {
    const withCatMarkers = `# AGENTS.md\n\n${AGENTS_MD_BEGIN}\nold\n${AGENTS_MD_END}\n\nFooter\n`;
    const out1 = spliceAgentsMdRegion(withCatMarkers, "### STABLE — fact")!;
    expect(out1).toContain("### STABLE — fact");
    expect(out1).not.toContain("old");
    expect(out1).toContain("Footer");

    const emptyOut = spliceAgentsMdRegion(withCatMarkers, "")!;
    expect(emptyOut).toContain(`${AGENTS_MD_BEGIN}\n${AGENTS_MD_END}`);

    const withFolioMarkers = `# AGENTS.md\n\n${BEGIN}\nold\n${END}\n`;
    expect(spliceAgentsMdRegion(withFolioMarkers, "### TRAP — watch out")).toContain(
      "### TRAP — watch out",
    );

    expect(spliceAgentsMdRegion("# AGENTS.md without markers\n", "body")).toBeUndefined();
  });

  test("renderAgentsMdSection renders only repo-wide live nodes and drops lowest-priority over budget", () => {
    const template = `# AGENTS.md\n\n${AGENTS_MD_BEGIN}\n${AGENTS_MD_END}\n`;
    const nodes = [
      makeNode("rw-stable", "stable", undefined, {
        comment: "See [`skill`](../skills/conduct/skill.md). " + "stable ".repeat(15),
      }),
      makeNode("rw-trap", "trap", undefined, { comment: "trap ".repeat(15) }),
      makeNode("rw-baseline", "baseline", undefined, { comment: "baseline ".repeat(15) }),
      makeNode("scoped-only", "stable", "ci-health-watcher"),
      makeNode("rw-archived", "stable", undefined, { archived: true }),
    ];

    const full = renderAgentsMdSection(nodes, template, 32_768);
    expect(full.dropped).toEqual([]);
    expect(full.entries).toBe(3);
    expect(full.body).toContain("### STABLE — summary for rw-stable");
    expect(full.body).toContain("](cat-harness/skills/conduct/skill.md)");
    expect(full.body).toContain("### TRAP — summary for rw-trap");
    expect(full.body).toContain("### BASELINE — summary for rw-baseline");
    expect(full.body).not.toContain("scoped-only");
    expect(full.body).not.toContain("rw-archived");

    const tight = renderAgentsMdSection(nodes, template, 450);
    expect(tight.dropped.length).toBeGreaterThan(0);
    expect(tight.dropped[0]!.id).toBe("rw-baseline");
    expect(tight.bytes).toBeLessThanOrEqual(450);
  });

  test("syncAgentsMd handles missing, no-markers, written, and unchanged states", () => {
    const dir = mkdtempSync(join(tmpdir(), "agents-md-sync-"));
    const agentsPath = join(dir, "AGENTS.md");
    try {
      const nodes = [makeNode("rw-1", "stable", undefined)];

      // 1. Missing file -> missing (never created out of thin air)
      const rMissing = syncAgentsMd(true, nodes, 32_768, agentsPath);
      expect(rMissing.state).toBe("missing");
      expect(existsSync(agentsPath)).toBe(false);

      // 2. File without markers -> no-markers (left untouched)
      writeFileSync(agentsPath, "# AGENTS.md\nNo markers here.\n");
      const rNoMarkers = syncAgentsMd(true, nodes, 32_768, agentsPath);
      expect(rNoMarkers.state).toBe("no-markers");

      // 3. File with markers -> written on first sync, unchanged on second
      writeFileSync(agentsPath, `# AGENTS.md\n\n${AGENTS_MD_BEGIN}\n${AGENTS_MD_END}\n`);
      const rWritten = syncAgentsMd(true, nodes, 32_768, agentsPath);
      expect(rWritten.state).toBe("written");
      expect(rWritten.entries).toBe(1);
      expect(rWritten.dropped).toEqual([]);

      const rUnchanged = syncAgentsMd(false, nodes, 32_768, agentsPath);
      expect(rUnchanged.state).toBe("unchanged");
      expect(rUnchanged.entries).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("per-repo memory scope and link rebasing inside cat-harness (bean t5zb)", () => {
    expect(memoryDirsFor(ROOT).map((d) => d.replace(/\/+$/, ""))).toEqual([join(ROOT, "memory")]);
    expect(rebaseRuleLinks("See [`x`](../skills/ui/ui-core/render-logging.md).", ROOT)).toBe(
      "See [`x`](../../skills/ui/ui-core/render-logging.md).",
    );
    expect(rebaseAgentsMdLinks("See [`x`](../skills/ui/ui-core/render-logging.md).", ROOT)).toBe(
      "See [`x`](skills/ui/ui-core/render-logging.md).",
    );
    // The per-agent files sit three levels below the root.
    expect(rebaseAgentFileLinks("See [`x`](../skills/ui/ui-core/render-logging.md).", ROOT)).toBe(
      "See [`x`](../../../skills/ui/ui-core/render-logging.md).",
    );
  });

  test("rebaseAgentFileLinks points an index root's per-agent files into cat-harness", () => {
    const dir = mkdtempSync(join(tmpdir(), "agent-file-links-"));
    try {
      expect(rebaseAgentFileLinks("See [`x`](../skills/a/b.md) and [`y`](https://e.org/skills/).", dir)).toBe(
        "See [`x`](../../../cat-harness/skills/a/b.md) and [`y`](https://e.org/skills/).",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("mounted layers are never written into; stale committed memory surfaces are reported naming the layer (bean bx4c)", async () => {
    const indexRoot = mkdtempSync(join(tmpdir(), "memory-mounted-"));
    try {
      const mountedDir = join(indexRoot, "mounted-layer");
      mkdirSync(join(mountedDir, "memory"), { recursive: true });
      mkdirSync(join(mountedDir, ".claude", "agents"), { recursive: true });
      mkdirSync(join(mountedDir, ".claude", "agent-memory", "watcher"), { recursive: true });
      mkdirSync(join(mountedDir, ".agents", "rules"), { recursive: true });

      writeFileSync(
        join(mountedDir, "mounted-layer.json"),
        JSON.stringify({
          $schema: "cat-harness-declaration/1.0.0",
          name: "mounted-layer",
          directories: [{ id: "memory", path: "memory", graphTypologies: ["memory"] }],
        }),
      );
      writeFileSync(
        join(mountedDir, "memory", "lesson-one.md"),
        [
          "---",
          `$schema: ${MEMORY_SCHEMA_TAG}`,
          "id: lesson-one",
          "label: stable",
          'summary: "mounted lesson summary"',
          "createdAt: 2026-11-05",
          "references:",
          "  agents:",
          "    - watcher",
          "---",
          "mounted lesson body",
          "",
        ].join("\n"),
      );
      writeFileSync(
        join(mountedDir, ".claude", "agents", "watcher.md"),
        "---\nname: watcher\ndescription: Watches.\n---\n\nPrompt body.\n",
      );
      const staleMemoryMd = `# watcher — memory\n\n${BEGIN}\n## STABLE — outdated summary\nold body\n${END}\n`;
      const mountedMemoryPath = join(mountedDir, ".claude", "agent-memory", "watcher", "MEMORY.md");
      writeFileSync(mountedMemoryPath, staleMemoryMd);
      const staleRuleMd = `# Agent Memory\n\n${BEGIN}\noutdated rule\n${END}\n`;
      const mountedRulePath = join(mountedDir, ".agents", "rules", "agent-memory.md");
      writeFileSync(mountedRulePath, staleRuleMd);

      writeFileSync(
        join(indexRoot, "index.config.json"),
        JSON.stringify({
          $schema: "folio-index-config/v1",
          instances: [
            {
              name: "mounted-layer",
              source: { remote: { repository: "o/mounted-layer", ref: "b".repeat(40) } },
            },
          ],
        }),
      );
      writeFileSync(
        join(indexRoot, "index.lock.json"),
        JSON.stringify({
          $schema: "cat-harness-mount-lock/v1",
          mounts: [{ harness: "mounted-layer", repository: "o/mounted-layer", ref: "b".repeat(40) }],
          instances: [
            {
              instance: "mounted-layer",
              repository: "o/mounted-layer",
              sha: "b".repeat(40),
              upstreamRoot: "",
              path: "mounted-layer",
              via: "mounted-layer",
              pinnedBy: "declared",
              declaration: { file: "mounted-layer.json", sha256: "0".repeat(64) },
              directories: [{ id: "*", path: "mounted-layer", upstreamPath: ".", treeDigest: "0".repeat(64), files: 5 }],
              trust: { basis: "consent", by: "test", on: "2026-11-05", ref: "b".repeat(40), approver: "declared" },
            },
          ],
        }),
      );

      expect(isMountedInstance(mountedDir, indexRoot)).toBe(true);
      expect(isMountedInstance(indexRoot, indexRoot)).toBe(false);

      const r = await runAgentMemory({ baseRoot: indexRoot, check: false });
      // The index's own surface is rendered at the root.
      expect(existsSync(join(indexRoot, ".agents", "rules", "agent-memory.md"))).toBe(true);
      expect(readFileSync(join(indexRoot, ".agents", "rules", "agent-memory.md"), "utf8")).toContain(
        "mounted lesson summary",
      );
      // Nothing inside the mounted layer is rewritten or created.
      expect(readFileSync(mountedMemoryPath, "utf8")).toBe(staleMemoryMd);
      expect(readFileSync(mountedRulePath, "utf8")).toBe(staleRuleMd);
      expect(existsSync(join(mountedDir, ".agents", "skills"))).toBe(false);
      expect(existsSync(join(mountedDir, ".gemini"))).toBe(false);
      // The stale committed surface in the mounted layer is reported, naming the layer.
      expect(r.ok).toBe(false);
      expect(r.mountedStale).toBeGreaterThan(0);
      expect(r.mountedFindings.length).toBeGreaterThan(0);
      expect(r.mountedFindings.every((f) => f.includes("mounted-layer") && f.includes("not rewritten"))).toBe(true);
    } finally {
      rmSync(indexRoot, { recursive: true, force: true });
    }
  });
});
