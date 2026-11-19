/**
 * `user_invocable` skills as MCP prompts — bean `j6t3`, option F.
 *
 * @module cat-harness/src/tools/skill-prompts.test
 *
 * The last block goes through a real MCP client over an in-memory transport,
 * because "registered" and "a host can list and fetch it" are different
 * claims, and only the second is the one the owner asked for.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { declaresUserInvocable, promptText, registerSkillPrompts, userInvocableSkills } from "./skill-prompts.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

const skill = (name: string | undefined, invocable: boolean, body = "Do the thing.") =>
  `---\n${name ? `name: ${name}\n` : ""}description: >\n  The ${name ?? "nameless"} skill.\n${invocable ? "user_invocable: true\n" : ""}---\n\n# ${name ?? "x"}\n\n${body}\n`;

/** Two packages in a temp dir. */
function packages(files: Record<string, Record<string, string>>): Record<string, string> {
  const root = mkdtempSync(join(tmpdir(), "skill-prompts-"));
  made.push(root);
  const out: Record<string, string> = {};
  for (const [pkg, fs] of Object.entries(files)) {
    const dir = join(root, pkg);
    mkdirSync(dir, { recursive: true });
    for (const [f, text] of Object.entries(fs)) writeFileSync(join(dir, f), text);
    out[pkg] = dir;
  }
  return out;
}

describe("the declaration decides, and nothing else", () => {
  test("only front matter counts — a body that MENTIONS the key is not a declaration", () => {
    expect(declaresUserInvocable(skill("a", true))).toBe(true);
    expect(declaresUserInvocable(skill("a", false))).toBe(false);
    expect(declaresUserInvocable("# a\n\nuser_invocable: true\n")).toBe(false);
  });

  test("invocable skills are listed by name across packages; the rest are not", () => {
    const p = packages({ one: { "a.md": skill("a", true), "b.md": skill("b", false) }, two: { "c.md": skill("c", true) } });
    const r = userInvocableSkills(p);
    expect(r.skills.map((s) => [s.name, s.packageName])).toEqual([["a", "one"], ["c", "two"]]);
    expect(r.duplicates).toEqual([]);
  });

  test("a declaration with no name is skipped — the name IS the command", () => {
    const p = packages({ one: { "x.md": skill(undefined, true) } });
    expect(userInvocableSkills(p).skills).toEqual([]);
  });

  test("a name declared twice is served once and REPORTED", () => {
    const p = packages({ one: { "a.md": skill("a", true) }, two: { "a.md": skill("a", true) } });
    const r = userInvocableSkills(p);
    expect(r.skills.length).toBe(1);
    expect(r.duplicates.map((d) => [d.name, d.paths.length])).toEqual([["a", 2]]);
  });
});

describe("the prompt carries the skill's own body, never a paraphrase", () => {
  test("the body and the person's arguments", () => {
    const p = packages({ one: { "a.md": skill("a", true, "Step one: measure.") } });
    const [a] = userInvocableSkills(p).skills;
    const text = promptText(a, "PR 12");
    expect(text).toContain("Step one: measure.");
    expect(text).toContain("## Arguments\n\nPR 12");
    expect(promptText(a)).not.toContain("## Arguments");
  });
});

describe("through a real MCP client", () => {
  test("a host LISTS the prompts and GETS one, and no tool is registered", async () => {
    const p = packages({ one: { "a.md": skill("a", true, "Step one: measure."), "b.md": skill("b", false) } });
    const server = new McpServer({ name: "t", version: "0" });
    expect(registerSkillPrompts(server, p)).toEqual(["a"]);
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await server.connect(st);
    const client = new Client({ name: "c", version: "0" });
    await client.connect(ct);
    const listed = await client.listPrompts();
    expect(listed.prompts.map((x) => x.name)).toEqual(["a"]);
    expect(listed.prompts[0].description).toBe("The a skill.");
    const got = await client.getPrompt({ name: "a", arguments: { args: "now" } });
    const first = got.messages[0];
    expect(first.role).toBe("user");
    expect(first.content.type === "text" && first.content.text).toContain("Step one: measure.");
    await expect(client.listTools()).rejects.toThrow();
    await client.close();
  });
});

describe("over this repository", () => {
  test("every user_invocable skill here is a prompt, with no duplicate names", () => {
    const r = userInvocableSkills();
    expect(r.skills.length).toBeGreaterThan(0);
    expect(r.duplicates).toEqual([]);
    expect(r.skills.map((s) => s.name)).toContain("coordinate");
    expect(r.skills.map((s) => s.name)).toContain("prepare-merge");
  });
});
