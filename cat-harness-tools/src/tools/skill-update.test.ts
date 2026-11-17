/**
 * `skill_update`: every gate, against a real git repository in a temp dir.
 *
 * @module src/tools/skill-update.test
 *
 * The spec's acceptance scenarios (litlfred/folio-assistant#875, Adjudicated
 * 2026-10-29) are the tests: a permitted valid edit is written; a front matter
 * that does not parse, an added dead link, an unpermitted actor, a stale hash,
 * another repository's skill and a reference package are each refused and
 * leave the file byte-identical. The handler is called directly, with no MCP
 * transport, as `mcp-graph-tools.test.ts` warns a closure-only test misses.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { actionGraph, type OdrlPolicy } from "../../schemas/content/odrl.js";
import type { AccessContext } from "../core/access.js";
import { SKILL_UPDATE, sha256, skillUpdate, type SkillUpdateDeps, type SkillUpdateRequest } from "./skill-update.js";

const SKILL = "---\nname: demo\ndescription: a demo skill\n---\n\n# Demo\n\nSee [other](other.md).\n";
const OTHER = "---\nname: other\n---\n\n# Other\n";

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

function gitRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "skill-update-"));
  made.push(root);
  const g = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { stdio: "ignore" });
  g("init", "-q");
  g("config", "user.email", "t@example.com");
  g("config", "user.name", "t");
  mkdirSync(join(root, "skills", "pkg"), { recursive: true });
  writeFileSync(join(root, "skills", "pkg", "demo.md"), SKILL);
  writeFileSync(join(root, "skills", "pkg", "other.md"), OTHER);
  g("add", ".");
  g("commit", "-q", "-m", "init");
  return root;
}

function policy(rules: OdrlPolicy["permission"], prohibition: OdrlPolicy["prohibition"] = []): OdrlPolicy {
  return {
    "@context": {},
    "@type": "Set",
    uid: "urn:test:policy",
    profile: "urn:test:profile",
    permission: rules,
    prohibition,
  };
}

function access(p: OdrlPolicy = policy([{ assignee: "editor", action: SKILL_UPDATE }])): AccessContext {
  return {
    policies: new Map([[p.uid, p]]),
    graph: actionGraph([{ id: SKILL_UPDATE, includedIn: ["odrl:modify"] }, { id: "content-authoring", includedIn: ["odrl:modify"] }]),
    actors: new Map([
      ["editor", { id: "editor", roles: [] }],
      ["writer", { id: "writer", roles: [] }],
    ]) as unknown as AccessContext["actors"],
  };
}

function setup(over: Partial<SkillUpdateDeps> = {}) {
  const root = gitRepo();
  const file = join(root, "skills", "pkg", "demo.md");
  const deps: SkillUpdateDeps = {
    packages: { pkg: join(root, "skills", "pkg") },
    referencePackages: { external: {} },
    access: access(),
    env: {},
    workRoot: root,
    now: () => new Date("2026-10-29T12:00:00Z"),
    ...over,
  };
  const req = (r: Partial<SkillUpdateRequest> = {}): SkillUpdateRequest => ({
    skill: "demo",
    packageName: "pkg",
    newContent: SKILL.replace("# Demo", "# Demo, revised"),
    baseSha256: sha256(SKILL),
    reason: "clarify the heading",
    actor: "editor",
    ...r,
  });
  return { root, file, deps, req };
}

const verdicts = (r: ReturnType<typeof skillUpdate>): Record<string, string> => Object.fromEntries(r.gates.map((g) => [g.gate, g.verdict]));

describe("P1: a permitted, valid edit is written", () => {
  test("the file holds the new content and every gate is reported satisfied", () => {
    const { file, deps, req } = setup();
    const r = skillUpdate(req(), deps);
    expect(r.written).toBe(true);
    expect(readFileSync(file, "utf8")).toContain("# Demo, revised");
    expect(r.gates.map((g) => g.gate)).toEqual(["resolve", "layer", "generated", "permission", "base-hash", "front-matter", "references"]);
    expect(r.gates.every((g) => g.verdict === "satisfied")).toBe(true);
    expect(r.diff).toEqual({ added: 1, removed: 1 });
    expect(r.sha256).toBe(sha256(req().newContent));
  });

  test("with process, task and role, an accepted write returns a valid PROV-O activity", () => {
    const { deps, req } = setup();
    const r = skillUpdate(req({ process: "skill-maintenance.bpmn", task: "Task_Edit", role: "editor" }), deps);
    expect(r.written).toBe(true);
    expect(r.activity?.["prov:qualifiedAssociation"]["prov:hadPlan"]).toBe("skill-maintenance#Task_Edit");
    expect(r.activity?.["cat-harness:underPolicy"]).toEqual(["urn:test:policy"]);
  });

  test("without them, no activity is invented, and the result says so", () => {
    const { deps, req } = setup();
    const r = skillUpdate(req(), deps);
    expect(r.activity).toBeUndefined();
    expect(r.findings.join("\n")).toContain("none is invented");
  });
});

describe("P1: refusals leave the file byte-identical", () => {
  const refused = (r: ReturnType<typeof skillUpdate>, file: string, gate: string, verdict = "unsatisfied") => {
    expect(r.written).toBe(false);
    expect(readFileSync(file, "utf8")).toBe(SKILL);
    expect(verdicts(r)[gate]).toBe(verdict);
  };

  test("front matter that does not parse", () => {
    const { file, deps, req } = setup();
    refused(skillUpdate(req({ newContent: "---\nname: demo\ndescription: [unclosed\n---\n# x\n" }), deps), file, "front-matter");
  });

  test("front matter that never closes", () => {
    const { file, deps, req } = setup();
    refused(skillUpdate(req({ newContent: "---\nname: demo\n# x\n" }), deps), file, "front-matter");
  });

  test("a renamed skill: the name is its identity", () => {
    const { file, deps, req } = setup();
    refused(skillUpdate(req({ newContent: SKILL.replace("name: demo", "name: demo2") }), deps), file, "front-matter");
  });

  test("an added link that does not resolve", () => {
    const { file, deps, req } = setup();
    const r = skillUpdate(req({ newContent: SKILL + "\nAnd [missing](missing.md).\n" }), deps);
    refused(r, file, "references");
    expect(r.gates.find((g) => g.gate === "references")!.reason).toContain("missing.md");
  });

  test("an added external link cannot be checked, and that refuses (owner answer 3)", () => {
    const { file, deps, req } = setup();
    refused(skillUpdate(req({ newContent: SKILL + "\n[site](https://example.org/x)\n" }), deps), file, "references", "could-not-determine");
  });

  test("an added link that resolves is fine", () => {
    const { file, deps, req } = setup();
    const r = skillUpdate(req({ newContent: SKILL + "\nAlso [again](./other.md#top).\n" }), deps);
    expect(r.written).toBe(true);
    expect(readFileSync(file, "utf8")).toContain("again");
  });

  test("no policy grants skill-update: unknown is not permit (owner answer 2)", () => {
    const { file, deps, req } = setup();
    const r = skillUpdate(req({ actor: "writer" }), deps);
    refused(r, file, "permission");
    expect(r.gates.find((g) => g.gate === "permission")!.reason).toContain("only Roles the owner grants");
  });

  test("a sibling grant does not stand in: content-authoring is not skill-update", () => {
    const { file, deps, req } = setup({ access: access(policy([{ assignee: "writer", action: "content-authoring" }])) });
    refused(skillUpdate(req({ actor: "writer" }), deps), file, "permission");
  });

  test("a prohibition refuses even with a grant", () => {
    const p = policy([{ assignee: "editor", action: SKILL_UPDATE }], [{ assignee: "editor", action: SKILL_UPDATE }]);
    const { file, deps, req } = setup({ access: access(p) });
    refused(skillUpdate(req(), deps), file, "permission");
  });

  test("no actor, or an undeclared one", () => {
    const { file, deps, req } = setup();
    refused(skillUpdate(req({ actor: undefined }), deps), file, "permission");
    refused(skillUpdate(req({ actor: "stranger" }), deps), file, "permission");
  });

  test("the file changed since it was read", () => {
    const { file, deps, req } = setup();
    const r = skillUpdate(req({ baseSha256: "0".repeat(64) }), deps);
    refused(r, file, "base-hash");
    expect(r.sha256).toBe(sha256(SKILL));
  });

  test("a generated file is refused, naming its generator", () => {
    const { file, deps, req } = setup();
    const gen = "---\nname: demo\ngenerated: scripts/x.ts\n---\n\n# Demo\n";
    writeFileSync(file, gen);
    const r = skillUpdate(req({ baseSha256: sha256(gen), newContent: gen + "more\n" }), deps);
    expect(r.written).toBe(false);
    expect(verdicts(r).generated).toBe("unsatisfied");
    expect(readFileSync(file, "utf8")).toBe(gen);
  });

  test("every gate runs, so one call reports every problem", () => {
    const { file, deps, req } = setup();
    const r = skillUpdate(req({ actor: "writer", baseSha256: "0".repeat(64), newContent: "---\nname: x\n---\n" }), deps);
    refused(r, file, "permission");
    expect(verdicts(r)["base-hash"]).toBe("unsatisfied");
    expect(verdicts(r)["front-matter"]).toBe("unsatisfied");
  });
});

describe("edge cases: where the skill lives", () => {
  test("a reference package is never edited", () => {
    const { deps, req } = setup();
    const r = skillUpdate(req({ packageName: "external" }), deps);
    expect(r.written).toBe(false);
    expect(verdicts(r).resolve).toBe("unsatisfied");
  });

  test("a skill in another repository is refused (owner answer 4)", () => {
    const { file, deps, req } = setup();
    const elsewhere = gitRepo();
    const r = skillUpdate(req(), { ...deps, workRoot: elsewhere });
    expect(r.written).toBe(false);
    expect(verdicts(r).layer).toBe("unsatisfied");
    expect(r.gates.find((g) => g.gate === "layer")!.reason).toContain("another repository");
    expect(readFileSync(file, "utf8")).toBe(SKILL);
  });

  test("an untracked copy, as a mount lays one down, is refused", () => {
    const { root, deps, req } = setup();
    mkdirSync(join(root, "mounted"), { recursive: true });
    writeFileSync(join(root, "mounted", "demo.md"), SKILL);
    const r = skillUpdate(req(), { ...deps, packages: { pkg: join(root, "mounted") } });
    expect(r.written).toBe(false);
    expect(verdicts(r).layer).toBe("unsatisfied");
    expect(r.gates.find((g) => g.gate === "layer")!.reason).toContain("not tracked");
  });

  test("an unknown skill names the packages, as skill_fetch does", () => {
    const { deps, req } = setup();
    const r = skillUpdate(req({ skill: "nope" }), deps);
    expect(r.written).toBe(false);
    expect(verdicts(r).resolve).toBe("unsatisfied");
  });
});
