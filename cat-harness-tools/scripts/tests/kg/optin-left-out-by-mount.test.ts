/**
 * An opt-in sub-graph the mount LEFT OUT is switched off for the mounted
 * layer's resolution: not a declared directory gone missing.
 *
 * A downstream that has not switched `up.grp` on mounts `up` whole, and the
 * mount leaves `grp/` out (`switchedOffOptInPaths`, recorded as the lock's
 * `except`). `up`'s own declaration still enables `up.grp` — for itself — so a
 * gate resolving the mounted `up` (kg-export's `collectInstanceNodes`,
 * `harness:dirs`) asked `up`'s list, found `grp/` on, and reported it absent
 * (smart-ra#242: "declared knowledge-graph directory is absent: sdlc/").
 *
 * The falsifiers stay: an opt-in sub-graph the mount TOOK that is not there,
 * and one no mount placed, are still reported absent.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkWireframes, wireframesLeftOut } from "../../check-wireframes.ts";
import { collectInstanceNodes } from "../../kg-export.js";
import { resolveDirectories } from "../../../schemas/kg/cat-harness.js";
import { leftOutByMount, WHOLE_INSTANCE_ID } from "../../../schemas/kg/remote-mount.js";
import { mirroredSubjectDir } from "../../../schemas/sdlc/kg-qa.js";
import { REPO_ROOT } from "../../lib/roots.ts";
import { writeDeclaration } from "../../../test/support/instance-fixture.js";

const made: string[] = [];
afterAll(() => {
  for (const p of made) rmSync(p, { recursive: true, force: true });
});

const SHA = "a".repeat(40);
const DIGEST = "b".repeat(64);
const DOC = "https://example.org/kg/doc";
const BASE = "https://example.org/kg/";
const ABSENT = /^declared knowledge-graph directory is absent: grp\/$/;

/** `up`: two opt-in sub-graphs it switches on for itself; `kept/` on disk, `grp/` not. */
function upstream(up: string): void {
  mkdirSync(join(up, "kept"), { recursive: true });
  writeDeclaration(up, {
    name: "up",
    enableSubgraphs: ["up.grp", "up.kept"],
    directories: [
      { id: "grp", path: "grp/", graphTypologies: ["cat-harness"], optIn: true },
      { id: "kept", path: "kept/", graphTypologies: ["cat-harness"], optIn: true },
    ],
  });
}

/**
 * A downstream scope that mounts `up` whole; `except` is what the mount left
 * out (none: it took everything). The downstream switches on exactly the
 * groups its mount took, as a real mount's `except` follows its list.
 */
function mounted(except: string[] | undefined): string {
  const scope = mkdtempSync(join(tmpdir(), "optin-left-out-"));
  made.push(scope);
  const on = ["grp", "kept"].filter((g) => !(except ?? []).includes(g)).map((g) => `up.${g}`);
  writeDeclaration(scope, { name: "down", enableSubgraphs: on, directories: [] });
  const up = join(scope, "up");
  upstream(up);
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
          directories: [{ id: WHOLE_INSTANCE_ID, path: "up", upstreamPath: ".", treeDigest: DIGEST, files: 0, ...(except ? { except } : {}) }],
        },
      ],
      unmounted: [],
    }),
  );
  return up;
}

const ids = (root: string): string[] => resolveDirectories([{ name: "(local)", root, own: true }]).map((d) => d.id);

async function absentProblems(root: string): Promise<string[]> {
  const problems: string[] = [];
  await collectInstanceNodes(root, DOC, BASE, problems);
  return problems.filter((p) => ABSENT.test(p));
}

describe("an opt-in sub-graph the mount left out", () => {
  const up = mounted(["grp"]);

  test("is switched off for the mounted layer's resolution", () => {
    expect(ids(up)).not.toContain("grp");
    // The one the mount took, and that is on disk, is untouched.
    expect(ids(up)).toContain("kept");
  });

  test("is still declared: a structural reader asking for everything sees it", () => {
    const all = resolveDirectories([{ name: "(local)", root: up, own: true }], undefined, { enabledSubgraphs: "all" });
    expect(all.map((d) => d.id)).toContain("grp");
  });

  test("is not reported as a declared directory that is absent", async () => {
    expect(await absentProblems(up)).toEqual([]);
  });
});

describe("the absences that are still defects", () => {
  test("an opt-in sub-graph the mount TOOK, and that is not there, is reported", async () => {
    const up = mounted(undefined);
    expect(ids(up)).toContain("grp");
    expect(await absentProblems(up)).toHaveLength(1);
  });

  test("an opt-in sub-graph of a layer no mount placed, and that is not there, is reported", async () => {
    const own = mkdtempSync(join(tmpdir(), "optin-unmounted-"));
    made.push(own);
    upstream(own);
    expect(ids(own)).toContain("grp");
    expect(await absentProblems(own)).toHaveLength(1);
  });
});

describe("leftOutByMount: absent by consent, and nothing else", () => {
  test("left out by the mount, and not on disk", () => {
    const up = mounted(["grp"]);
    expect(leftOutByMount(up, join(up, "grp"))).toBe(true);
    expect(leftOutByMount(up, join(up, "grp", "skills", "deep"))).toBe(true);
  });

  test("on disk, taken by the mount, or placed by no mount: not consent", () => {
    const up = mounted(["grp", "kept"]);
    // `kept/` is on disk, whatever the lock says.
    expect(leftOutByMount(up, join(up, "kept"))).toBe(false);
    const took = mounted(undefined);
    expect(leftOutByMount(took, join(took, "grp"))).toBe(false);
    const own = mkdtempSync(join(tmpdir(), "optin-own-"));
    made.push(own);
    upstream(own);
    expect(leftOutByMount(own, join(own, "grp"))).toBe(false);
  });
});

describe("kg:audit: an attestation whose subject the mount left out", () => {
  // `attestationOrphans` walks the store and hands back files; the subject a
  // file judges is the directory its path mirrors (`kgQaSidecarPath`).
  test("its mirrored subject is the left-out directory, so it is not judged here", () => {
    const up = mounted(["grp"]);
    const tree = join(up, "qa", "attestations", "kg-qa");
    const file = join(tree, "grp", "skills", "x.kg-qa.attestations.json");
    const subject = mirroredSubjectDir(file, tree, up);
    expect(subject).toBe(join(up, "grp", "skills"));
    expect(leftOutByMount(up, subject!)).toBe(true);
  });

  test("an attestation of a subject the mount took, and that is gone, is still an orphan", () => {
    const up = mounted(undefined);
    const tree = join(up, "qa", "attestations", "kg-qa");
    const subject = mirroredSubjectDir(join(tree, "grp", "skills", "x.kg-qa.attestations.json"), tree, up);
    expect(leftOutByMount(up, subject!)).toBe(false);
  });

  test("a file outside the tree mirrors nothing", () => {
    expect(mirroredSubjectDir("/elsewhere/x.json", "/tree", "/root")).toBeUndefined();
  });
});

describe("check:wireframes: a harness whose own wireframes the mount left out", () => {
  test("is named by wireframesLeftOut only when the mount left them out", () => {
    expect(wireframesLeftOut(mounted(["docs/wireframes"]))).toEqual(["up"]);
    expect(wireframesLeftOut(mounted(undefined))).toEqual([]);
    const own = mkdtempSync(join(tmpdir(), "optin-own-wf-"));
    made.push(own);
    upstream(own);
    expect(wireframesLeftOut(own)).toEqual([]);
  });

  test("its visualisers are not judged; another harness's uncovered visualiser still fails", () => {
    const empty = mkdtempSync(join(tmpdir(), "optin-wf-empty-"));
    made.push(empty);
    const judged = checkWireframes(REPO_ROOT, [{ dir: empty, prefix: "" }], []);
    const harness = judged.uncovered.map((u) => u.ref).filter((ref) => ref.startsWith("cat-harness/"));
    expect(harness.length).toBeGreaterThan(0);
    const off = checkWireframes(REPO_ROOT, [{ dir: empty, prefix: "" }], ["cat-harness"]);
    expect(off.notJudged.map((n) => n.ref)).toEqual(harness);
    expect(off.uncovered.map((u) => u.ref)).toEqual(judged.uncovered.map((u) => u.ref).filter((ref) => !ref.startsWith("cat-harness/")));
  });
});
