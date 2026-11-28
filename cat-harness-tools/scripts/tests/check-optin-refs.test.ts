/**
 * Always-on workflows and Tools naming a skill only an opt-in sub-graph holds
 * (owner, 2026-11-11, option B: report, never rewrite; smart-ra#242).
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkOptInRefs, optInOnly, workflowSkillRefs, type SkillHomes } from "../check-optin-refs.ts";
import { FIXTURE_INSTANCE, writeDeclaration } from "../../test/support/instance-fixture.js";

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

const bpmn = (...refs: string[]): string =>
  `<definitions><process id="p">${refs.map((r, i) => `<task id="t${i}"><extensionElements><bootstrap.processes:skill ref="${r}"/></extensionElements></task>`).join("")}</process></definitions>\n`;

/**
 * Always-on `skills/` and `processes/`; opt-in `grp/` and `more/`, each a
 * knowledge-graph directory holding skills and a `processes/` (the shape of
 * cat-harness's `sdlc/`), switched on for itself.
 */
function layer(files: Record<string, string>, moreRequires?: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "optin-refs-"));
  dirs.push(root);
  writeDeclaration(root, {
    name: FIXTURE_INSTANCE,
    enableSubgraphs: [`${FIXTURE_INSTANCE}.grp`, `${FIXTURE_INSTANCE}.more`],
    directories: [
      { id: "skills", path: "skills/", graphTypologies: ["cat-harness"] },
      { id: "processes", path: "processes/", graphTypologies: ["processes"] },
      { id: "grp", path: "grp/", optIn: true, graphTypologies: ["cat-harness"] },
      { id: "more", path: "more/", optIn: true, graphTypologies: ["cat-harness"], ...(moreRequires ? { requires: moreRequires } : {}) },
    ],
  });
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(root, rel, ".."), { recursive: true });
    writeFileSync(join(root, rel), body);
  }
  return root;
}

describe("which references are read", () => {
  test("every skill ref of a workflow, prefixed or not", () => {
    expect(workflowSkillRefs(bpmn("a", "pkg/b") + '<skill ref="c"/>')).toEqual(["a", "pkg/b", "c"]);
  });

  test("a skill held only in opt-in groups, from outside them, is opt-in only", () => {
    const homes: SkillHomes = new Map([
      ["only", { groups: new Set(["x.grp"]), alwaysOn: false }],
      ["both", { groups: new Set(["x.grp"]), alwaysOn: true }],
    ]);
    expect(optInOnly("only", homes, undefined)).toEqual(["x.grp"]);
    expect(optInOnly("pkg/only", homes, undefined)).toEqual(["x.grp"]);
    expect(optInOnly("only", homes, "x.grp")).toEqual([]);
    expect(optInOnly("only", homes, "x.other")).toEqual(["x.grp"]);
    expect(optInOnly("both", homes, undefined)).toEqual([]);
    // From a group that requires the skill's group, it is on wherever the referrer is.
    expect(optInOnly("only", homes, "x.other", new Map([["x.other", ["x.grp"]]]))).toEqual([]);
    expect(optInOnly("only", homes, "x.third", new Map([["x.third", ["x.other"]], ["x.other", ["x.grp"]]]))).toEqual([]);
    expect(optInOnly("only", homes, "x.grp", new Map([["x.other", ["x.grp"]]]))).toEqual([]);
    // A name no layer holds is check:workflow-refs' finding, not this one's.
    expect(optInOnly("nowhere", homes, undefined)).toEqual([]);
  });
});

describe("the check", () => {
  test("an always-on workflow naming an opt-in-only skill is a finding; the rest are not", () => {
    const root = layer({
      "skills/shared.md": "# shared\n",
      "grp/only.md": "# only\n",
      "grp/shared.md": "# shared\n",
      "processes/main.bpmn": bpmn("only", "shared", "nowhere"),
      "grp/processes/inner.bpmn": bpmn("only"),
    });
    const r = checkOptInRefs(root);
    expect(r.workflows).toBe(2);
    expect(r.findings).toEqual([{ from: "processes/main.bpmn", kind: "workflow", ref: "only", groups: [`${FIXTURE_INSTANCE}.grp`] }]);
  });

  test("a workflow in ANOTHER opt-in group naming it is a finding: each group is switched on alone", () => {
    const root = layer({ "grp/only.md": "# only\n", "more/processes/other.bpmn": bpmn("only") });
    expect(checkOptInRefs(root).findings).toEqual([{ from: "more/processes/other.bpmn", kind: "workflow", ref: "only", groups: [`${FIXTURE_INSTANCE}.grp`] }]);
  });

  test("a workflow in a group that REQUIRES the skill's group is not a finding; the other way round still is", () => {
    const root = layer({ "grp/only.md": "# only\n", "more/extra.md": "# extra\n", "more/processes/other.bpmn": bpmn("only"), "grp/processes/back.bpmn": bpmn("extra") }, [`${FIXTURE_INSTANCE}.grp`]);
    expect(checkOptInRefs(root).findings).toEqual([{ from: "grp/processes/back.bpmn", kind: "workflow", ref: "extra", groups: [`${FIXTURE_INSTANCE}.more`] }]);
  });

  test("nothing opt-in-only referenced: no finding", () => {
    const root = layer({ "skills/shared.md": "# shared\n", "processes/main.bpmn": bpmn("shared") });
    expect(checkOptInRefs(root).findings).toEqual([]);
  });
});
