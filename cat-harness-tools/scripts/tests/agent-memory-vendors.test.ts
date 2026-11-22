/**
 * Per-agent files for Gemini CLI, Codex, Cursor and Copilot carry the Claude
 * agent's prompt and the same memory (bean `31ni`; `4682`, `5zs1`, `uvfs`, `xxh4`).
 *
 * What is worth gating: a file a host cannot parse (bad TOML, missing
 * required key), a budget that truncates silently, and a cleanup that deletes
 * a hand-written file.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { MEMORY_SCHEMA_TAG, MemoryNodeSchema } from "../../schemas/conduct/memory.js";
import { EMPTY_NOTE_TAGS } from "../../schemas/kg/carried-note.js";
import {
  COPILOT_AGENT_CHAR_BUDGET,
  VENDOR_TARGETS,
  copilotTools,
  geminiTools,
  isReadonly,
  readClaudeAgent,
  renderCodexAgent,
  renderCopilotAgent,
  renderCursorAgent,
  renderGeminiAgent,
  renderVendorAgent,
  renderVendorMemory,
  syncVendorAgents,
  tomlMultiline,
  tomlString,
  type ClaudeAgentDef,
  type VendorTargetDef,
} from "../agent-memory-vendors.ts";

const node = (id: string, label: "stable" | "trap" | "baseline", agent = "watcher", extra: Record<string, unknown> = {}) =>
  MemoryNodeSchema.parse({
    id,
    summary: `summary for ${id}`,
    comment: `comment for ${id}, see [x](../skills/a/b.md)`,
    createdAt: "2026-10-06T12:00:00Z",
    label,
    tags: { ...EMPTY_NOTE_TAGS, references: [{ kind: "agent", id: agent }] },
    $schema: MEMORY_SCHEMA_TAG,
    ...(label === "baseline" ? { measured: { command: "bun test", date: "2026-10-06", result: "0 failures" } } : {}),
    ...extra,
  });

const def: ClaudeAgentDef = {
  name: "watcher",
  description: 'Reads "CI" state.',
  tools: ["Read", "Grep", "Glob", "Bash", "ToolSearch"],
  prompt: "# watcher\n\nDo the thing.",
};

/** A minimal TOML reader for the three keys we write (basic or literal strings). */
function parseCodex(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /^(\w+) = (?:'''\n([\s\S]*?)'''|("(?:[^"\\]|\\.)*"))/gm;
  for (const m of text.matchAll(re)) {
    out[m[1]!] = m[2] !== undefined ? m[2].replace(/\n$/, "") : (JSON.parse(m[3]!) as string);
  }
  return out;
}

describe("tool translation", () => {
  test("Gemini and Copilot names are mapped, and a tool with no equivalent is left out", () => {
    expect(geminiTools(def.tools!)).toEqual(["read_file", "read_many_files", "grep_search", "glob", "list_directory", "run_shell_command"]);
    expect(copilotTools(def.tools!)).toEqual(["read", "search", "execute"]);
  });

  test("readonly means no file-writing tool, and an absent tools list is not readonly", () => {
    expect(isReadonly(def.tools)).toBe(true);
    expect(isReadonly(["Read", "Edit"])).toBe(false);
    expect(isReadonly(undefined)).toBe(false);
  });
});

describe("rendering per host", () => {
  const memory = renderVendorMemory("watcher", [node("a", "trap"), node("b", "stable", "watcher", { detail: "long" })]);

  test("memory is ordered STABLE first, links rebased, detail named from the repo root", () => {
    expect(memory.indexOf("STABLE")).toBeLessThan(memory.indexOf("TRAP"));
    expect(memory).toContain("](../../cat-harness/skills/a/b.md)");
    expect(memory).toContain("`.claude/agent-memory/watcher/detail/b.md`");
  });

  test("no memory renders the prompt alone", () => {
    expect(renderVendorMemory("watcher", [])).toBe("");
    expect(renderGeminiAgent(def, "")).toContain("Do the thing.\n");
  });

  test("Gemini and Copilot files start with front matter carrying name and description", () => {
    for (const text of [renderGeminiAgent(def, memory), renderCopilotAgent(def, memory)]) {
      expect(text.startsWith("---\nname: watcher\ndescription: \"Reads \\\"CI\\\" state.\"\n")).toBe(true);
      expect(text).toContain("## Memory");
    }
  });

  test("Cursor marks a non-writing agent readonly", () => {
    expect(renderCursorAgent(def, memory)).toContain("readonly: true\n");
    expect(renderCursorAgent({ ...def, tools: ["Edit"] }, memory)).not.toContain("readonly");
  });

  test("Codex TOML carries the three required keys and round-trips the prompt", () => {
    const text = renderCodexAgent(def, memory);
    const parsed = parseCodex(text);
    expect(parsed["name"]).toBe("watcher");
    expect(parsed["description"]).toBe('Reads "CI" state.');
    expect(parsed["developer_instructions"]).toBe(`${def.prompt}\n\n${memory}`);
    expect(text).not.toContain("shell_tool");
    expect(renderCodexAgent({ ...def, tools: ["Read"] }, "")).toContain("[features]\nshell_tool = false\n");
  });

  test("a prompt a TOML literal cannot hold falls back to an escaped basic string", () => {
    expect(tomlMultiline("has ''' inside")).toBe(tomlString("has ''' inside"));
    expect(tomlMultiline("ends in '")).toBe(tomlString("ends in '"));
    expect(tomlString('a"b\\c\nd')).toBe('"a\\"b\\\\c\\nd"');
  });
});

describe("budgets drop lowest priority first and report it", () => {
  const nodes = [node("s", "stable"), node("t", "trap"), node("b", "baseline")];
  const copilot = VENDOR_TARGETS.find((t) => t.id === "copilot")!;

  test("within budget nothing is dropped", () => {
    const r = renderVendorAgent(copilot, "watcher", def, nodes);
    expect(r.dropped).toEqual([]);
    expect(r.size).toBeLessThanOrEqual(COPILOT_AGENT_CHAR_BUDGET);
  });

  test("over budget, baseline goes before trap before stable", () => {
    const full = renderVendorAgent(copilot, "watcher", def, nodes).size;
    const tight = renderVendorAgent({ ...copilot, budget: { unit: "chars", limit: full - 1 } }, "watcher", def, nodes);
    expect(tight.dropped.map((d) => d.id)).toEqual(["b"]);
    expect(tight.size).toBeLessThan(full);
    const none = renderVendorAgent({ ...copilot, budget: { unit: "chars", limit: 1 } }, "watcher", def, nodes);
    expect(none.dropped.map((d) => d.id)).toEqual(["b", "t", "s"]);
  });

  test("archived nodes are never written and never counted as dropped", () => {
    const r = renderVendorAgent(copilot, "watcher", def, [...nodes, node("old", "stable", "watcher", { archived: true })]);
    expect(r.content).not.toContain("summary for old");
    expect(r.dropped).toEqual([]);
  });
});

describe("syncVendorAgents", () => {
  test("writes, then reports unchanged, skips an agent with no definition, and only removes generated files", () => {
    const dir = mkdtempSync(join(tmpdir(), "vendor-agents-"));
    try {
      const claude = join(dir, ".claude", "agents");
      mkdirSync(claude, { recursive: true });
      writeFileSync(
        join(claude, "watcher.md"),
        "---\nname: watcher\ndescription: Reads CI.\ntools: Read, Grep\nmemory: project\n---\n\n# watcher\n\nBody.\n",
      );
      expect(readClaudeAgent("watcher", claude)?.tools).toEqual(["Read", "Grep"]);

      const targets: VendorTargetDef[] = VENDOR_TARGETS.map((t) => ({ ...t, dir: join(dir, t.id) }));
      const nodes = [node("s", "stable")];
      const opts = { agents: ["watcher", "ghost"], claudeAgentsDir: claude, targets };

      const first = syncVendorAgents(true, nodes, opts);
      expect(first.filter((r) => r.agent === "watcher").map((r) => r.state)).toEqual(["written", "written", "written", "written"]);
      expect(first.filter((r) => r.agent === "ghost").every((r) => r.state === "no-definition")).toBe(true);
      expect(existsSync(join(dir, "copilot", "watcher.agent.md"))).toBe(true);
      expect(existsSync(join(dir, "gemini", "ghost.md"))).toBe(false);
      expect(readFileSync(join(dir, "codex", "watcher.toml"), "utf8")).toContain("summary for s");

      const second = syncVendorAgents(false, nodes, opts);
      expect(second.filter((r) => r.agent === "watcher").every((r) => r.state === "unchanged")).toBe(true);

      // A retired agent's generated file goes; a hand-written file stays.
      writeFileSync(join(dir, "gemini", "retired.md"), readFileSync(join(dir, "gemini", "watcher.md"), "utf8"));
      writeFileSync(join(dir, "gemini", "mine.md"), "---\nname: mine\ndescription: hand-written\n---\n");
      syncVendorAgents(true, nodes, opts);
      expect(existsSync(join(dir, "gemini", "retired.md"))).toBe(false);
      expect(existsSync(join(dir, "gemini", "mine.md"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
