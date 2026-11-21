/**
 * Three gates that judged opt-in content the mounting root switched off, or
 * looked for a page where nothing writes it any more (smart-ra#242, the
 * cat-harness sibling's simulation). Owner, 2026-11-12, card Q-OPTIN-DIRS A:
 * "CI checks should align on opt in/out".
 *
 * 1. check:requirements — a `proposals` directory switched off by the root
 *    that mounted its layer is not judged; one switched on and missing still
 *    fails; a layer no mount placed judges what it has on disk, as before.
 * 2. translate-bpmn:check — a template whose diagram is in a switched-off
 *    group is not judged; a template with no diagram anywhere still is.
 * 3. check:process-index — the page is found in any layer of the checkout.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { judgedDirFor } from "../../check-requirements.ts";
import { PAGE_BLOCK, processIndexPage } from "../../check-process-index.ts";
import { notJudgedInSwitchedOff, switchedOffGroups } from "../../../schemas/kg/opt-in-roots.js";
import { WHOLE_INSTANCE_ID } from "../../../schemas/kg/remote-mount.js";
import { writeDeclaration } from "../../../test/support/instance-fixture.js";

const made: string[] = [];
afterAll(() => {
  for (const p of made) rmSync(p, { recursive: true, force: true });
});

const SHA = "a".repeat(40);
const DIGEST = "b".repeat(64);

const put = (abs: string, body = "x\n"): void => {
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, body);
};

/** `up`: always-on `requirements/` and `processes/`; opt-in `proposals/` and `ops/` (with a diagram), both on for itself. */
function upstream(root: string, present: readonly string[]): void {
  mkdirSync(root, { recursive: true });
  writeDeclaration(root, {
    name: "up",
    enableSubgraphs: ["up.proposals", "up.ops"],
    directories: [
      { id: "requirements", path: "requirements/", graphTypologies: ["requirements"] },
      { id: "proposals", path: "proposals/", graphTypologies: ["proposals"], optIn: true },
      { id: "ops", path: "ops/", graphTypologies: ["cat-harness"], optIn: true },
    ],
  });
  put(join(root, "requirements", "index.md"));
  if (present.includes("proposals")) put(join(root, "proposals", "index.md"));
  if (present.includes("ops")) put(join(root, "ops", "processes", "ops-flow.bpmn"), "<definitions/>\n");
}

/** A consumer that switches `on` on and mounts `up` whole, leaving out what it has off; `present` is what is on disk. */
function consumer(on: readonly string[], present: readonly string[] = on): string {
  const scope = mkdtempSync(join(tmpdir(), "optin-rbp-"));
  made.push(scope);
  writeDeclaration(scope, { name: "down", enableSubgraphs: on.map((g) => `up.${g}`), directories: [] });
  const up = join(scope, "up");
  upstream(up, present);
  const except = ["proposals", "ops"].filter((g) => !on.includes(g));
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

describe("check:requirements: the proposals directory", () => {
  test("switched off by the mounting root (and left out): not judged", () => {
    const up = consumer([]);
    expect(judgedDirFor(up, "proposals")).toEqual({ notJudged: expect.stringContaining("up.proposals") });
    // `requirements` is always on, and judged.
    expect(judgedDirFor(up, "requirements")).toEqual({ dir: join(up, "requirements/") });
  });

  test("switched on by the mounting root and missing: still fails", () => {
    const up = consumer(["proposals"], []);
    expect(() => judgedDirFor(up, "proposals")).toThrow(/which does not exist/);
  });

  test("a layer no mount placed judges what is on disk, its own list aside", () => {
    const own = mkdtempSync(join(tmpdir(), "optin-rbp-own-"));
    made.push(own);
    upstream(own, ["proposals"]);
    expect(judgedDirFor(own, "proposals")).toEqual({ dir: join(own, "proposals/") });
  });
});

describe("translate-bpmn:check: a template whose diagram the mounting root switched off", () => {
  test("left out by the mount: not judged", () => {
    const up = consumer([]);
    const r = notJudgedInSwitchedOff("ops-flow", ".bpmn", up);
    expect(r?.groups.sort()).toEqual(["up.ops", "up.proposals"]);
    expect(r?.reason).toContain("left out");
  });

  test("switched off but on disk: not judged when the diagram is there, an orphan when it is not", () => {
    const up = consumer([], ["ops"]); // the mount predates `except`: `ops/` is on disk, and off
    const groups = switchedOffGroups(up);
    expect(groups.onDisk.map((g) => g.id)).toEqual(["up.ops"]);
    expect(notJudgedInSwitchedOff("ops-flow", ".bpmn", up, { onDisk: groups.onDisk, leftOut: [] })?.groups).toEqual(["up.ops"]);
    expect(notJudgedInSwitchedOff("renamed-away", ".bpmn", up, { onDisk: groups.onDisk, leftOut: [] })).toBeUndefined();
  });

  test("nothing switched off: a template with no diagram is an orphan", () => {
    const up = consumer(["proposals", "ops"]);
    expect(notJudgedInSwitchedOff("renamed-away", ".bpmn", up)).toBeUndefined();
  });
});

describe("check:process-index: where the page is", () => {
  function checkout(pageIn: "base" | "other" | "none"): { base: string; repo: string } {
    const repo = mkdtempSync(join(tmpdir(), "optin-pindex-"));
    made.push(repo);
    const base = join(repo, "base");
    const other = join(repo, "other");
    for (const [dir, name] of [[base, "base"], [other, "other"]] as const) {
      mkdirSync(dir, { recursive: true });
      writeDeclaration(dir, { name, directories: [] });
    }
    if (pageIn !== "none") put(join(repo, pageIn, "docs", "source", PAGE_BLOCK), "<div data-fa-process-index></div><noscript>x</noscript>\n");
    return { base, repo };
  }

  test("held by a layer that does not depend on the base: found there", () => {
    const { base, repo } = checkout("other");
    expect(processIndexPage(base, repo)).toBe(join(repo, "other", "docs", "source", PAGE_BLOCK));
  });

  test("held by the base: found there", () => {
    const { base, repo } = checkout("base");
    expect(processIndexPage(base, repo)).toBe(join(base, "docs", "source", PAGE_BLOCK));
  });

  test("held by no layer: the base layer's path is named, as where it was expected", () => {
    const { base, repo } = checkout("none");
    expect(processIndexPage(base, repo)).toBe(join(base, "docs", "source", PAGE_BLOCK));
  });
});
