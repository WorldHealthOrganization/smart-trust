/**
 * install-skills: the prefix is applied at install, per harness (bean
 * `folio-assistant-x4mt`). Fixtures only: the real corpus run depends on
 * cat-harness declaring `skillPrefix`, which this repository's CI mounts at
 * cat-harness main.
 */
import { afterAll, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { HOSTS, INSTALLED_MARKER, ownedInstalls, planInstall, readChecklistSkill, renderInstalled, unmarkedFiles, type SourceSkill } from "../install-skills.ts";

const tmp = mkdtempSync(join(tmpdir(), "install-skills-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function skillFile(rel: string, text: string): string {
  const p = join(tmp, rel);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, text);
  return p;
}

const TODO = "---\nname: todo-manager\ndescription: Keep the todo list.\nallowed-tools: Read\n---\n\n# Todo manager\n\nBody text.\n";

describe("renderInstalled", () => {
  it("prefixes the name, keeps every other key and the body, and marks the copy", () => {
    const out = renderInstalled(TODO, "cat-todo-manager", "skills/todo-manager.md");
    expect(out.startsWith("---\nname: cat-todo-manager\ndescription: Keep the todo list.\nallowed-tools: Read\n---\n")).toBe(true);
    expect(out).toContain(INSTALLED_MARKER);
    expect(out).toContain("<!-- source: skills/todo-manager.md -->");
    expect(out.endsWith("\n# Todo manager\n\nBody text.\n")).toBe(true);
  });

  it("adds a name when the source has none (the name was its file name)", () => {
    expect(renderInstalled("---\ndescription: d\n---\nx\n", "fa-x", "x.md").split("\n").slice(0, 3)).toEqual(["---", "name: fa-x", "description: d"]);
  });

  it("refuses a file without front matter", () => {
    expect(() => renderInstalled("# just text\n", "cat-x", "x.md")).toThrow(/front matter/);
  });
});

describe("planInstall", () => {
  const a = skillFile("a/skills/todo-manager.md", TODO);
  const b = skillFile("b/skills/todo-manager.md", TODO.replace("Keep the todo list.", "The root's own."));
  const plain = skillFile("c/skills/plain.md", "---\nname: plain\ndescription: d\n---\nx\n");
  const s = (file: string, name: string, extra: Partial<SourceSkill> = {}): SourceSkill => ({ name, file, instance: tmp, ...extra });

  it("a skill takes ITS instance's prefix, so two harnesses' skills do not collide", () => {
    const plan = planInstall(tmp, [s(a, "todo-manager", { prefix: "cat" }), s(b, "todo-manager", { prefix: "fa" })]);
    expect([...plan.files.keys()]).toEqual(["cat-todo-manager", "fa-todo-manager"]);
    expect(plan.collisions).toEqual([]);
  });

  it("the same prefixed name twice: the later source (nearer the root) wins, and it is reported", () => {
    const plan = planInstall(tmp, [s(a, "todo-manager", { prefix: "cat" }), s(b, "todo-manager", { prefix: "cat" })]);
    expect(plan.files.get("cat-todo-manager")).toContain("The root's own.");
    expect(plan.collisions).toEqual([{ name: "cat-todo-manager", lost: "a/skills/todo-manager.md", won: "b/skills/todo-manager.md" }]);
  });

  it("no prefix on the skill's instance or the installing root: skipped with the reason, never installed bare", () => {
    const plan = planInstall(tmp, [s(plain, "plain")]);
    expect(plan.files.size).toBe(0);
    expect(plan.skipped).toEqual([{ file: "c/skills/plain.md", reason: "neither its instance nor the installing harness declares skillPrefix" }]);
  });

  it("a skill the reader marked as uninstallable is skipped with its reason", () => {
    const plan = planInstall(tmp, [s(plain, "plain", { prefix: "cat", skip: "no description: a host could never trigger it" })]);
    expect(plan.skipped[0]!.reason).toMatch(/no description/);
  });
});

describe("ownedInstalls", () => {
  it("only directories whose SKILL.md carries the marker are this script's to remove", () => {
    const host = join(tmp, "host/.claude/skills");
    skillFile("host/.claude/skills/cat-old/SKILL.md", `---\nname: cat-old\n---\n${INSTALLED_MARKER}\n`);
    skillFile("host/.claude/skills/my-own/SKILL.md", "---\nname: my-own\n---\nmine\n");
    expect(ownedInstalls(host)).toEqual(["cat-old"]);
    expect(ownedInstalls(join(tmp, "nowhere"))).toEqual([]);
  });
});

describe("unmarkedFiles (bean folio-assistant-dtda)", () => {
  it("lists every file under a host skill directory that lacks INSTALLED_MARKER", () => {
    const host = join(tmp, "unmarked/.github/skills");
    skillFile("unmarked/.github/skills/cat-good/SKILL.md", `---\nname: cat-good\n---\n${INSTALLED_MARKER}\n`);
    skillFile("unmarked/.github/skills/hand-written/SKILL.md", "---\nname: hand-written\n---\nbody\n");
    skillFile("unmarked/.github/skills/bpmn_author/validate.py", "# hand-written script\n");
    expect(unmarkedFiles(host)).toEqual(["bpmn_author/validate.py", "hand-written/SKILL.md"]);
    expect(unmarkedFiles(join(tmp, "nowhere"))).toEqual([]);
  });
});

describe("readChecklistSkill (bean folio-assistant-cy4p)", () => {
  const CHECKLIST = [
    "<!-- GENERATED from cat-harness/sdlc/processes/activity-log.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->",
    "",
    "# Checklist — Agent \"activity\" log: runs",
    "",
    "> **Generated, and not the authority.** Walked as a state machine.",
    "",
    "What an agent writes down about its own run.",
    "",
    "## Begin — Start (`Start`)",
    "",
    "- next: → `Task_A`",
    "",
  ].join("\n");
  const file = skillFile("p/processes/activity-log.checklist.md", CHECKLIST);

  it("names it process-<stem>, keeps the checklist body unchanged, and describes how to walk it", () => {
    const s = readChecklistSkill(file)!;
    expect(s.name).toBe("process-activity-log");
    expect(s.text!.endsWith(CHECKLIST)).toBe(true);
    const description = /^description: (.+)$/m.exec(s.text!)![1]!;
    // Double-quoted YAML is JSON string syntax, so the quotes and colon in the title survive.
    const parsed = JSON.parse(description) as string;
    expect(parsed).toContain('"Agent "activity" log: runs"');
    expect(parsed).toContain("cat-harness/sdlc/processes/activity-log.bpmn");
    expect(parsed).toContain("next:");
    expect(parsed.endsWith("What an agent writes down about its own run.")).toBe(true);
  });

  it("installs under the prefix like any skill, from its generated text", () => {
    const s = readChecklistSkill(file)!;
    const plan = planInstall(tmp, [{ ...s, prefix: "cat" }]);
    const out = plan.files.get("cat-process-activity-log")!;
    expect(out.startsWith("---\nname: cat-process-activity-log\ndescription: ")).toBe(true);
    expect(out).toContain(INSTALLED_MARKER);
    expect(out).toContain("# Checklist — ");
  });

  it("ignores a .checklist.md that bpmn-checklist.ts did not write, and any other file", () => {
    expect(readChecklistSkill(skillFile("p/processes/hand.checklist.md", "# my own list\n"))).toBeUndefined();
    expect(readChecklistSkill(skillFile("p/processes/notes.md", CHECKLIST))).toBeUndefined();
  });
});

describe("hosts (bean cat-tools-0nxe)", () => {
  it("every host reads <dir>/<name>/SKILL.md natively, each from its own documented directory", () => {
    expect(HOSTS).toEqual({
      claude: ".claude/skills",
      antigravity: ".agents/skills",
      gemini: ".gemini/skills",
      cursor: ".cursor/skills",
      copilot: ".github/skills",
    });
  });

  it("a name Cursor would refuse (not lowercase letters, digits and hyphens) is skipped with the reason", () => {
    const bad = skillFile("d/skills/Bad_Name.md", "---\nname: Bad_Name\ndescription: d\n---\nx\n");
    const plan = planInstall(tmp, [{ name: "Bad_Name", file: bad, instance: tmp, prefix: "cat" }]);
    expect(plan.files.size).toBe(0);
    expect(plan.skipped[0]!.reason).toMatch(/Cursor requires/);
  });
});
