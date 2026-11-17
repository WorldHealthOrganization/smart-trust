/**
 * kg-audit writes a verdict only about a subject its OWN layer holds
 * (Q-A PR 4, epic `7x5n`, owner confirmation 2026-10-01 ~17:30).
 *
 * Until then the default run wrote two kinds of duplicate: eight sidecars under
 * `kg-qa/_external/` for diagrams smart-base, large-datasets and
 * folio-assistant-core own, and 29 under `kg-qa/tools/` for Tools fhir-harness,
 * core and smart-base declare. Every one had a counterpart in its owner's own
 * results tree. Two verdicts about one subject are two answers free to drift.
 *
 * The unit half pins the narrowing (`partitionBySubjectOwner`,
 * `owningInstanceOf`, `subjectEscapes`). The corpus half pins the tree: a
 * regression that widened either subject set again would put the files back,
 * and `kg:audit:check` would then call them CURRENT, because it compares what
 * the writer would write — so only a test of the tree itself can fail on it.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, test } from "bun:test";

import { kgQaHomeFor } from "../../../schemas/kg/cat-harness.js";
import {
  ForeignSubjectError,
  kgQaSidecarPath,
  owningInstanceOf,
  partitionBySubjectOwner,
  subjectEscapes,
} from "../../../schemas/sdlc/kg-qa.js";
import { portableSegment } from "../../../schemas/kg/portable-path.js";
import { toolsOf } from "../../../tools/discover.js";
import { HARNESS_ROOT } from "../../lib/roots.ts";

const HARNESS = resolve(HARNESS_ROOT);

describe("subjectEscapes", () => {
  test("inside, and the instance root itself, do not escape", () => {
    expect(subjectEscapes("/repo/a", "/repo/a/processes")).toBe(false);
    expect(subjectEscapes("/repo/a", "/repo/a")).toBe(false);
  });

  test("a sibling escapes, including one that merely SHARES a name prefix", () => {
    expect(subjectEscapes("/repo/cat-harness", "/repo/smart-base/processes")).toBe(true);
    // A string-prefix test would call this inside; `relative` does not.
    expect(subjectEscapes("/repo/cat-harness", "/repo/cat-harness-tools/processes")).toBe(true);
    expect(subjectEscapes("/repo/cat-harness", "/repo")).toBe(true);
  });

  test("a directory whose NAME begins with two dots is inside", () => {
    expect(subjectEscapes("/repo/a", "/repo/a/..hidden")).toBe(false);
  });
});

describe("owningInstanceOf", () => {
  // The repository root is itself a layer and contains every other one,
  // so the DEEPEST root must win or everything would be "owned by the root".
  const roots = ["/repo", "/repo/cat-harness", "/repo/smart-base"];

  test("the deepest containing instance wins", () => {
    expect(owningInstanceOf("/repo/smart-base/processes/x.bpmn", roots)).toBe("/repo/smart-base");
    expect(owningInstanceOf("/repo/processes/x.bpmn", roots)).toBe("/repo");
  });

  test("nothing contains it: undefined, never a guess", () => {
    expect(owningInstanceOf("/elsewhere/x.bpmn", roots)).toBeUndefined();
  });
});

describe("partitionBySubjectOwner", () => {
  const roots = ["/repo", "/repo/cat-harness", "/repo/smart-base"];
  const r = (path: string | null) => ({ subject: { path } });

  test("own and path-less subjects are kept", () => {
    const p = partitionBySubjectOwner([r("processes/a.bpmn"), r(null)], "/repo/cat-harness", roots);
    expect(p.kept).toHaveLength(2);
    expect(p.skipped).toHaveLength(0);
    expect(p.unowned).toHaveLength(0);
  });

  test("a subject another instance owns is SKIPPED, naming that owner", () => {
    const p = partitionBySubjectOwner([r("../smart-base/processes/l2.bpmn")], "/repo/cat-harness", roots);
    expect(p.kept).toHaveLength(0);
    expect(p.skipped.map((s) => s.owner)).toEqual(["/repo/smart-base"]);
  });

  test("a subject outside with NO owner is reported, not dropped", () => {
    // Dropping it would be a clean run over nothing (`dh4f`).
    const p = partitionBySubjectOwner([r("../../elsewhere/x.bpmn")], "/repo/cat-harness", roots);
    expect(p.kept).toHaveLength(0);
    expect(p.skipped).toHaveLength(0);
    expect(p.unowned).toHaveLength(1);
  });

  test("falsifier: with no instance roots, a foreign subject is unowned rather than skipped", () => {
    const p = partitionBySubjectOwner([r("../smart-base/processes/l2.bpmn")], "/repo/cat-harness", []);
    expect(p.unowned).toHaveLength(1);
  });
});

describe("kgQaSidecarPath refuses a foreign subject", () => {
  test("it throws rather than composing an `_external/` path", () => {
    expect(() => kgQaSidecarPath("/repo/cat-harness", "/repo/smart-base/processes", "l2")).toThrow(ForeignSubjectError);
  });

  test("an inside subject still mirrors its directory", () => {
    const p = kgQaSidecarPath("/repo/cat-harness", "/repo/cat-harness/processes", "x", "/t");
    expect(p).toBe(join("/t", "processes", "x.kg-qa.json"));
  });
});

describe("the committed cat-harness tree holds no verdict about another instance's subject", () => {
  const home = kgQaHomeFor(HARNESS);
  const tree = join(home.root, "kg-qa");

  test("no `_external/` tree", () => {
    expect(existsSync(join(tree, "_external"))).toBe(false);
  });

  test("every tool sidecar is about a Tool cat-harness itself declares", () => {
    const toolDir = join(tree, "tools");
    const own = new Set(toolsOf(HARNESS).map((t) => `${portableSegment(t.id)}.kg-qa.json`));
    expect(own.size).toBeGreaterThan(0);
    if (!existsSync(toolDir)) {
      // Since bean `5hox` the tree is a computed working copy (`qa:working-copy`),
      // stored on `qa-reports` rather than committed. Where it has not been
      // computed — the standalone layer, which lays out TRACKED files only —
      // the claim is about what is committed, so ask git, rather than reading
      // a missing directory as a crash or as a clean run over nothing.
      const tracked = spawnSync("git", ["ls-files", "--", tree], { cwd: HARNESS, encoding: "utf-8" });
      expect(tracked.status).toBe(0);
      expect(tracked.stdout.trim()).toBe("");
      return;
    }
    const foreign = readdirSync(toolDir).filter((f) => f.endsWith(".kg-qa.json") && !own.has(f));
    expect(foreign).toEqual([]);
  });
});
