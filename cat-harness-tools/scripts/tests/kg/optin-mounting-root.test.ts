/**
 * A check resolving a MOUNTED layer sees the opt-in sub-graphs the root that
 * mounted it switched on — not the mounted layer's own list.
 *
 * Owner, 2026-11-12, card Q-OPTIN-DIRS A: "CI checks should align on opt
 * in/out". `up` switches `up.ops` on for itself and leaves `up.extra` off. A
 * consumer that has `ops` off and `extra` on must see exactly that in every
 * reader of the mounted `up`: the directories, the skills that exist
 * (check:tools' `satisfies`, check:workflow-refs' skill refs) and the
 * workflows read. The same `up` resolved where no mount placed it keeps its
 * own list.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { defaultEnabledSubgraphs, resolveDirectories } from "../../../schemas/kg/cat-harness.js";
import { WHOLE_INSTANCE_ID } from "../../../schemas/kg/remote-mount.js";
import { judgeSatisfiesTarget, switchedOffSkillHomes } from "../../check-tools.ts";
import { judgeSkillRef, parseSkillIndex } from "../../lib/switched-off-skills.ts";
import { mergeCarriedPackages } from "../../../pipeline/readme-sections.ts";
import { dmnRefSwitchedOff } from "../../test-plan-audit.ts";
import { knownSkills, workflowFiles } from "../../known-skills.js";
import { writeDeclaration } from "../../../test/support/instance-fixture.js";

const made: string[] = [];
afterAll(() => {
  for (const p of made) rmSync(p, { recursive: true, force: true });
});

const SHA = "a".repeat(40);
const DIGEST = "b".repeat(64);

/** `up` at `root`: always-on `skills/`, opt-in `ops/` (on for itself) and `extra/` (off for itself), each with a skill and a workflow. */
function upstream(root: string, groups: readonly string[]): void {
  mkdirSync(root, { recursive: true });
  writeDeclaration(root, {
    name: "up",
    enableSubgraphs: ["up.ops"],
    directories: [
      { id: "skills", path: "skills/", graphTypologies: ["cat-harness"] },
      { id: "ops", path: "ops/", graphTypologies: ["cat-harness"], optIn: true },
      { id: "extra", path: "extra/", graphTypologies: ["cat-harness"], optIn: true },
    ],
  });
  const put = (rel: string, body: string): void => {
    mkdirSync(join(root, rel, ".."), { recursive: true });
    writeFileSync(join(root, rel), body);
  };
  put("skills/base.md", "# base\n");
  for (const g of groups) {
    put(`${g}/${g}-skill.md`, `# ${g}\n`);
    put(`${g}/processes/${g}.bpmn`, "<definitions/>\n");
  }
}

/** A consumer that switches `on` on and mounts `up` whole, leaving out every group it has off. */
function consumer(on: readonly string[]): string {
  const scope = mkdtempSync(join(tmpdir(), "optin-mounting-"));
  made.push(scope);
  writeDeclaration(scope, { name: "down", enableSubgraphs: on.map((g) => `up.${g}`), directories: [] });
  const up = join(scope, "up");
  upstream(up, on);
  const except = ["ops", "extra"].filter((g) => !on.includes(g));
  writeFileSync(
    join(scope, "index.lock.json"),
    JSON.stringify({
      $schema: "cat-harness-mount-lock/v1",
      mounts: [{ harness: "up", repository: "o/up", ref: SHA }],
      instances: [
        {
          instance: "up",
          repository: "o/up",
          sha: SHA,
          upstreamRoot: "",
          path: "up",
          via: "up",
          pinnedBy: "declared",
          declaration: { file: "up.json", sha256: DIGEST },
          directories: [{ id: WHOLE_INSTANCE_ID, path: "up", upstreamPath: ".", treeDigest: DIGEST, files: 0, ...(except.length ? { except } : {}) }],
        },
      ],
      unmounted: [],
    }),
  );
  return up;
}

const ids = (root: string): string[] => resolveDirectories([{ name: "(local)", root, own: true }]).map((d) => d.id);
const workflows = (root: string): string[] => workflowFiles(root).map((f) => f.slice(root.length + 1)).sort();

describe("a consumer that switched a group OFF that the mounted layer has on", () => {
  const up = consumer([]);

  test("the mounting root's list decides", () => {
    expect(defaultEnabledSubgraphs(up)).toEqual(new Set());
    expect(ids(up)).not.toContain("ops");
  });

  test("its skills do not exist for check:tools / check:workflow-refs, and its workflows are not read", () => {
    const skills = knownSkills(up);
    expect(skills.has("base")).toBe(true);
    expect(skills.has("ops-skill")).toBe(false);
    expect(workflows(up)).toEqual([]);
  });
});

describe("a consumer that switched a group ON that the mounted layer has off", () => {
  const up = consumer(["extra"]);

  test("the mounting root's list decides", () => {
    expect(defaultEnabledSubgraphs(up)).toEqual(new Set(["up.extra"]));
    expect(ids(up)).toContain("extra");
    expect(ids(up)).not.toContain("ops");
  });

  test("its skills exist and its workflows are read", () => {
    expect(knownSkills(up).has("extra-skill")).toBe(true);
    expect(workflows(up)).toEqual(["extra/processes/extra.bpmn"]);
  });
});

describe("a layer no mount placed keeps its own list", () => {
  test("`ops` on, `extra` off, as `up` declares for itself", () => {
    const own = mkdtempSync(join(tmpdir(), "optin-own-"));
    made.push(own);
    upstream(own, ["ops", "extra"]);
    expect(defaultEnabledSubgraphs(own)).toEqual(new Set(["up.ops"]));
    expect(ids(own)).toContain("ops");
    expect(ids(own)).not.toContain("extra");
    expect(knownSkills(own).has("ops-skill")).toBe(true);
    expect(knownSkills(own).has("extra-skill")).toBe(false);
  });
});

describe("check:tools: a `satisfies` target in a group the mounting root switched off (card Q-SKILL-TOOL-LINK B)", () => {
  // The three cases the owner's B separates: switched off → not judged;
  // switched on but missing → dangling; a name no layer holds → dangling.
  test("left out by the mount: a Tool of the mounted layer naming a skill there is not judged", () => {
    const up = consumer([]);
    const off = switchedOffSkillHomes([up]);
    expect(off.leftOut.get(up)?.sort()).toEqual(["up.extra", "up.ops"]);
    expect(judgeSatisfiesTarget("ops-skill", up, off)?.groups.sort()).toEqual(["up.extra", "up.ops"]);
  });

  test("switched off but still on disk: judged by name — held is not judged, absent is dangling", () => {
    const own = mkdtempSync(join(tmpdir(), "optin-own-tools-"));
    made.push(own);
    upstream(own, ["ops", "extra"]); // `extra` is off for `up` itself, and on disk
    const off = switchedOffSkillHomes([own]);
    expect(off.leftOut.size).toBe(0);
    expect(judgeSatisfiesTarget("extra-skill", own, off)).toEqual({ groups: ["up.extra"], reason: expect.stringContaining("switched off") });
    expect(judgeSatisfiesTarget("no-such-skill", own, off)).toBeUndefined();
  });

  test("a group the mounting root switched ON that is missing: dangling", () => {
    const up = consumer(["extra"]);
    rmSync(join(up, "extra"), { recursive: true, force: true });
    const off = switchedOffSkillHomes([up]);
    // `ops` is off and left out; `extra` is on, so its absence excuses nothing.
    expect(off.leftOut.get(up)).toEqual(["up.ops"]);
    expect(off.held.has("extra-skill")).toBe(false);
    // A Tool of ANOTHER layer gets no pass from `up`'s left-out groups.
    expect(judgeSatisfiesTarget("extra-skill", "/elsewhere", off)).toBeUndefined();
  });

  test("a name no layer holds, from a Tool whose layer left nothing out: dangling", () => {
    const up = consumer(["ops", "extra"]);
    const off = switchedOffSkillHomes([up]);
    expect(off.leftOut.size).toBe(0);
    expect(judgeSatisfiesTarget("no-such-skill", up, off)).toBeUndefined();
  });
});

describe("a left-out group's skills are named by the layer's committed index (smart-ips-pilgrimage#66)", () => {
  // `readme:sync` lists every skill of every opt-in group in SKILLS.md, under
  // a heading marked `(opt-in \`<layer>.<group>\`)`, and the layer's own CI
  // keeps it current with every group on. A mount that leaves the group out
  // still carries that file, so the names are known, not guessed.
  const section = (dir: string, group: string, names: readonly string[]): string =>
    [`**\`${dir}/\`** (${names.length}) (opt-in \`${group}\`)`, "", "| Skill | What it is for |", "|---|---|", ...names.map((n) => `| \`${n}\` | for ${n} |`), ""].join("\n");
  const index = (up: string, ...sections: string[]): void => writeFileSync(join(up, "SKILLS.md"), ["_n skills_", "", ...sections].join("\n"));

  test("a name the index lists in a left-out group is held there, whichever layer refers to it", () => {
    const up = consumer([]);
    index(up, section("ops", "up.ops", ["ops-skill"]), section("extra", "up.extra", ["extra-skill"]));
    const off = switchedOffSkillHomes([up]);
    expect(off.leftOut.size).toBe(0);
    expect(judgeSkillRef("ops-skill", "/elsewhere", off)?.groups).toEqual(["up.ops"]);
    expect(judgeSkillRef("no-such-skill", "/elsewhere", off)).toBeUndefined();
  });

  test("a left-out group the index does not list keeps the narrower pass: the layer's own refs only", () => {
    const up = consumer([]);
    index(up, section("ops", "up.ops", ["ops-skill"]));
    const off = switchedOffSkillHomes([up]);
    expect(off.leftOut.get(up)).toEqual(["up.extra"]);
    expect(judgeSkillRef("extra-skill", "/elsewhere", off)).toBeUndefined();
    expect(judgeSkillRef("extra-skill", up, off)?.groups).toEqual(["up.extra"]);
  });

  test("a group the mounting root switched ON that is missing is not excused by the index", () => {
    const up = consumer(["extra"]);
    rmSync(join(up, "extra"), { recursive: true, force: true });
    index(up, section("extra", "up.extra", ["extra-skill"]));
    const off = switchedOffSkillHomes([up]);
    expect(off.held.has("extra-skill")).toBe(false);
    expect(judgeSkillRef("extra-skill", "/elsewhere", off)).toBeUndefined();
  });

  test("a section whose rows disagree with its count is not a record", () => {
    const text = ["**`ops/`** (2) (opt-in `up.ops`)", "", "| Skill | What it is for |", "|---|---|", "| `a` | x |", ""].join("\n");
    expect(parseSkillIndex(text)).toEqual([]);
    expect(parseSkillIndex(section("ops", "up.ops", ["a", "b"]))).toEqual([{ dir: "ops", rows: ["| `a` | for a |", "| `b` | for b |"], optIn: "up.ops" }]);
  });

  test("readme:sync keeps a left-out group's sections where the committed index had them", () => {
    const regen = [{ dir: "skills/a", rows: ["| a |"] }, { dir: "skills/new", rows: ["| n |"] }, { dir: "skills/z", rows: ["| z |"] }];
    const committed = [
      { dir: "skills/a", rows: ["| a |"] },
      { dir: "ops", rows: ["| o |"], optIn: "up.ops" },
      { dir: "skills/z", rows: ["| z-old |"] },
    ];
    const merged = mergeCarriedPackages(regen, committed, (p) => p.optIn === "up.ops");
    expect(merged.map((p) => p.dir)).toEqual(["skills/a", "ops", "skills/new", "skills/z"]);
    // Only the carried group is taken from the committed index; the rest is regenerated.
    expect(merged.find((p) => p.dir === "skills/z")?.rows).toEqual(["| z |"]);
  });

  test("a test plan's exit DMN in a left-out group is not judged; one in a switched-on group is", () => {
    const off = consumer([]);
    expect(dmnRefSwitchedOff("ops/decisions/exit.dmn#Decision_Exit", [off])).toBe(true);
    expect(dmnRefSwitchedOff("skills/exit.dmn#Decision_Exit", [off])).toBe(false);
    const on = consumer(["ops"]);
    rmSync(join(on, "ops"), { recursive: true, force: true });
    expect(dmnRefSwitchedOff("ops/decisions/exit.dmn#Decision_Exit", [on])).toBe(false);
  });
});
