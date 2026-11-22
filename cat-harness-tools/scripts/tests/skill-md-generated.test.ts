/**
 * A generated file is never a skill (`isSkillMd`, known-skills.ts).
 *
 * cat-harness#236 committed a `<diagram>.checklist.md` beside every BPMN
 * diagram under `processes/<topic>/`, a declared knowledge-graph directory.
 * They carry no `$schema`, so every topic directory read as a skill package
 * and `gen-skill-docs` threw on import: "skill package(s) with no category in
 * SKILLS_CATEGORIES: content, kg, library, process, sdlc, ui".
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { isSkillMd, kgDirectories } from "../known-skills.js";
import { packageDirsIn } from "../skill-topics.js";
import { HARNESS_ROOT } from "../lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);

function judge(name: string, text: string): boolean {
  const dir = mkdtempSync(join(tmpdir(), "skill-md-generated-"));
  try {
    const file = join(dir, name);
    writeFileSync(file, text);
    return isSkillMd(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("isSkillMd: what a generator wrote is not a skill", () => {
  test("an authored instruction body is a skill (the control)", () => {
    expect(judge("a-skill.md", "# A skill\n\nDo the thing.\n")).toBe(true);
  });

  test("a first-line GENERATED mark, as bpmn-checklist.ts writes it, is not", () => {
    const text =
      "<!-- GENERATED from cat-harness/processes/kg/x.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit. -->\n\n# Checklist — X\n";
    expect(judge("x.checklist.md", text)).toBe(false);
  });

  test("front matter declaring `generated:` is not", () => {
    expect(judge("page.md", "---\ngenerated: scripts/gen-skill-docs.ts\ntitle: X\n---\n\n# X\n")).toBe(false);
  });

  test("`$schema` front matter still marks a non-skill node", () => {
    expect(judge("node.md", "---\n$schema: https://example.invalid/node.json\n---\n\n# Node\n")).toBe(false);
  });

  test("a skill that QUOTES the mark below its head stays a skill", () => {
    const text = "# Checklists\n\nEach file opens with `<!-- GENERATED from <diagram> -->`:\n\n<!-- GENERATED from x.bpmn -->\n";
    expect(judge("checklists.md", text)).toBe(true);
  });
});

describe("the harness's own knowledge-graph directories", () => {
  test("no committed BPMN checklist is read as a skill", () => {
    const checklists: string[] = [];
    let examined = 0;
    for (const d of kgDirectories(ROOT, "instance")) {
      if (!existsSync(d.absPath)) continue;
      for (const pkg of [{ dir: d.absPath }, ...packageDirsIn(d.absPath)]) {
        for (const f of readdirSync(pkg.dir)) {
          if (!f.endsWith(".checklist.md")) continue;
          examined++;
          if (isSkillMd(join(pkg.dir, f))) checklists.push(join(pkg.dir, f));
        }
      }
    }
    // The premise: cat-harness commits its checklists beside the diagrams
    // (cat-harness#236), so a pass over none would prove nothing.
    expect(examined).toBeGreaterThan(0);
    expect(checklists).toEqual([]);
  });
});
