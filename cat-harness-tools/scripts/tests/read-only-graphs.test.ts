/**
 * A declaration and its bytes must agree — and "deliberately different" is a
 * third answer, not a failure.
 *
 * Owner, 2026-09-22, choosing how read-only is established: **declare it, and
 * gate that it matches.** The declaration is what a listing reads without
 * scanning a corpus; the gate is what stops it drifting from the nodes.
 *
 * ## The case that added a fourth verdict
 *
 * The first version compared two booleans: declared writable + materialized
 * nodes = contradiction. It fired within minutes on `who-iris/uploads/` — the
 * ingestion DROP ZONE, created by `adapters/document/paths.ts` on a first
 * ingest precisely so somebody can write there. The declaration was right and
 * the gate was wrong.
 *
 * The bytes are materialized; the directory is a write target. A boolean
 * comparison cannot ask the second question, so what separates a deliberate
 * exception from a declaration that is simply wrong is whether anybody said
 * why — `readOnlyBasis`, required on BOTH values, the same way `GateSchema`'s
 * `basis` is required on `permitted` and not only on `refused`.
 *
 * @module cat-harness/scripts/tests/read-only-graphs.test
 */
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { materializedNodesIn, run } from "../check-read-only-graphs.js";

const REPO = resolve(import.meta.dir, "..", "..", "..");

/** A layer with one declared directory holding `nodes` materialized records. */
function fixture(dir: Record<string, unknown>, nodes: number, top: Record<string, unknown> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "ro-"));
  const inst = join(root, "inst");
  mkdirSync(join(inst, "d"), { recursive: true });
  writeFileSync(
    join(inst, "inst.json"),
    JSON.stringify({ name: "inst", directories: [{ id: "x", path: "d/", ...dir }], ...top }),
  );
  for (let i = 0; i < nodes; i++) {
    writeFileSync(join(inst, "d", `n${i}.json`), JSON.stringify({ materialization: { state: "materialized" } }));
  }
  return root;
}

const only = (root: string) => run(root)[0]!;

describe("the four verdicts stay apart", () => {
  it("declared read-only over materialized nodes agrees", () => {
    const r = fixture({ readOnly: true, readOnlyBasis: "copies" }, 3);
    try {
      expect(only(r).kind).toBe("agrees");
    } finally {
      rmSync(r, { recursive: true, force: true });
    }
  });

  it("declared read-only over NOTHING materialized contradicts", () => {
    // The mirror defect: freezing content nobody said was a copy. Different
    // from the other contradiction and it must not share a message.
    const r = fixture({ readOnly: true, readOnlyBasis: "copies" }, 0);
    try {
      expect(only(r).kind).toBe("contradicts");
    } finally {
      rmSync(r, { recursive: true, force: true });
    }
  });

  it("declared read-only over nothing YET is not-applicable when its content is built at publish", () => {
    // smart-base's and smart-trust's `fhir-artifact-index/`: the index is
    // written by `ig-index:build` at publish and never committed, so a
    // checkout holds none of it. Zero nodes is the declared state there.
    const r = fixture({ readOnly: true, readOnlyBasis: "generated" }, 0, {
      builtAtPublish: [{ path: "d/index.json", writer: ["w"], because: "checkout" }],
    });
    try {
      const v = only(r);
      expect(v.kind).toBe("not-applicable");
      expect(v.why).toContain("built at publish");
      expect(v.why).toContain("d/index.json");
    } finally {
      rmSync(r, { recursive: true, force: true });
    }
  });

  it("...but a builtAtPublish path OUTSIDE the directory excuses nothing", () => {
    // Only content the directory itself is built to hold explains its
    // emptiness; a sibling `d2/` sharing the prefix must not.
    const r = fixture({ readOnly: true, readOnlyBasis: "copies" }, 0, {
      builtAtPublish: [{ path: "d2/index.json" }, { path: "e/" }],
    });
    try {
      expect(only(r).kind).toBe("contradicts");
    } finally {
      rmSync(r, { recursive: true, force: true });
    }
  });

  it("...and does not excuse a missing basis", () => {
    const r = fixture({ readOnly: true }, 0, { builtAtPublish: [{ path: "d/index.json" }] });
    try {
      expect(only(r).kind).toBe("contradicts");
    } finally {
      rmSync(r, { recursive: true, force: true });
    }
  });

  it("DECLARED WRITABLE OVER MATERIALIZED NODES IS AN EXCEPTION when a basis says why", () => {
    // The `who-iris/uploads/` case, pinned. A drop zone whose contents are
    // materialized is correct, and the first version of this gate failed it.
    const r = fixture({ readOnly: false, readOnlyBasis: "the ingestion drop zone" }, 1);
    try {
      const v = only(r);
      expect(v.kind).toBe("exception");
      expect(v.why).toContain("drop zone");
    } finally {
      rmSync(r, { recursive: true, force: true });
    }
  });

  it("...and a CONTRADICTION when nothing says why", () => {
    // The whole load the basis carries: without it, a deliberate exception and
    // a declaration nobody thought about have the same spelling.
    const r = fixture({ readOnly: false }, 1);
    try {
      expect(only(r).kind).toBe("contradicts");
    } finally {
      rmSync(r, { recursive: true, force: true });
    }
  });

  it("silence over materialized nodes is `undeclared`, never `false`", () => {
    // Absent is NOT a declaration of writability. A directory that has not
    // answered has not asserted anything.
    const r = fixture({}, 2);
    try {
      const v = only(r);
      expect(v.kind).toBe("undeclared");
      expect(v.declared).toBeUndefined();
    } finally {
      rmSync(r, { recursive: true, force: true });
    }
  });

  it("silence over nothing materialized is not a finding at all", () => {
    const r = fixture({}, 0);
    try {
      expect(only(r).kind).toBe("not-applicable");
    } finally {
      rmSync(r, { recursive: true, force: true });
    }
  });
});

describe("materializedNodesIn counts records, not the word", () => {
  it("does not count prose that mentions the state", () => {
    // A grep-based count would report every skill DISCUSSING materialization as
    // a directory full of frozen content — including the module that does the
    // counting. Parsing is not an optimisation here, it is the correctness.
    const root = mkdtempSync(join(tmpdir(), "ro-prose-"));
    try {
      writeFileSync(join(root, "a.json"), JSON.stringify({ note: 'the state "materialized" means bytes are here' }));
      expect(materializedNodesIn(root)).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("finds a record nested at any depth", () => {
    const root = mkdtempSync(join(tmpdir(), "ro-deep-"));
    try {
      writeFileSync(join(root, "a.json"), JSON.stringify({ a: { b: [{ materialization: { state: "materialized" } }] } }));
      expect(materializedNodesIn(root)).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ignores states that are not materialized", () => {
    const root = mkdtempSync(join(tmpdir(), "ro-ref-"));
    try {
      writeFileSync(join(root, "a.json"), JSON.stringify({ materialization: { state: "referenced" } }));
      expect(materializedNodesIn(root)).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("this repository's own declarations", () => {
  const verdicts = run(REPO);

  it("examines directories at all", () => {
    // Vacuity guard — a sweep that found no declaration would report clean.
    expect(verdicts.length).toBeGreaterThan(0);
  });

  it("none contradicts its content", () => {
    expect(verdicts.filter((v) => v.kind === "contradicts").map((v) => `${v.instance}/${v.id}: ${v.why}`)).toEqual([]);
  });

  it("every directory holding materialized nodes has answered", () => {
    // `undeclared` is reported rather than failed by the gate, because the
    // field is new. Asserted here because THIS repository has finished its
    // migration, and a regression would otherwise only ever be a console line.
    expect(verdicts.filter((v) => v.kind === "undeclared").map((v) => `${v.instance}/${v.id}`)).toEqual([]);
  });

  it("every stated exception actually states something", () => {
    for (const v of verdicts.filter((x) => x.kind === "exception")) {
      expect(v.why.length, `${v.instance}/${v.id} exception with an empty basis`).toBeGreaterThan(40);
    }
  });
});
