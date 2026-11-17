/**
 * A step runs when its inputs changed, when something it needs re-ran, or
 * when nothing can be concluded. Never otherwise, and never silently.
 *
 * @module scripts/tests/render-selection.test
 *
 * Bean `9c34`. The failure this guards is one-directional and quiet: **a page
 * that was not re-rendered looks exactly like a page that was.** So the cases
 * that matter most here are the ones where the answer is "run anyway" —
 * a missing manifest, a step the manifest never mentions, a step that never
 * declared what it reads. Each of those is a *could not determine*, and this
 * repository's rule is that could-not-determine is never rendered as clean.
 */
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildManifest,
  filesUnder,
  hashInputs,
  readManifest,
  selectSteps,
  resolvedInputs,
  MANIFEST_SCHEMA,
  type StepInputs,
} from "../../render-selection.ts";

function repo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "render-sel-"));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(join(abs, "..").replace(/[\\/][^\\/]*$/, "") || abs, { recursive: true });
    mkdirSync(abs.slice(0, abs.lastIndexOf("/")), { recursive: true });
    writeFileSync(abs, body);
  }
  return root;
}

const STEPS: StepInputs[] = [
  { id: "skills", inputs: ["skills"] },
  { id: "pages", inputs: ["catalogue"], needs: ["skills"] },
  { id: "index", inputs: ["catalogue"], needs: ["pages"] },
];

describe("hashInputs", () => {
  it("is stable across runs and independent of mtime", () => {
    const root = repo({ "skills/a.md": "one", "skills/b.md": "two" });
    const a = hashInputs(root, { id: "s", inputs: ["skills"] });
    // Rewrite identical content: a new mtime, the same bytes.
    writeFileSync(join(root, "skills/a.md"), "one");
    expect(hashInputs(root, { id: "s", inputs: ["skills"] })).toBe(a);
  });

  it("changes when content changes", () => {
    const root = repo({ "skills/a.md": "one" });
    const before = hashInputs(root, { id: "s", inputs: ["skills"] });
    writeFileSync(join(root, "skills/a.md"), "ONE");
    expect(hashInputs(root, { id: "s", inputs: ["skills"] })).not.toBe(before);
  });

  it("changes when a file MOVES, because an index keyed on names notices", () => {
    const a = repo({ "skills/a.md": "x" });
    const b = repo({ "skills/b.md": "x" });
    expect(hashInputs(a, { id: "s", inputs: ["skills"] })).not.toBe(
      hashInputs(b, { id: "s", inputs: ["skills"] }),
    );
  });

  it("is undefined — not a hash of nothing — when no inputs are declared", () => {
    const root = repo({ "skills/a.md": "x" });
    expect(hashInputs(root, { id: "s" })).toBeUndefined();
    expect(hashInputs(root, { id: "s", inputs: [] })).toBeUndefined();
  });

  it("skips dot-prefixed segments", () => {
    const root = repo({ "skills/a.md": "x" });
    const before = hashInputs(root, { id: "s", inputs: ["skills"] });
    mkdirSync(join(root, "skills/.cache"), { recursive: true });
    writeFileSync(join(root, "skills/.cache/junk"), "noise");
    expect(hashInputs(root, { id: "s", inputs: ["skills"] })).toBe(before);
  });

  it("a declared input that does not exist contributes nothing rather than throwing", () => {
    const root = repo({ "skills/a.md": "x" });
    expect(hashInputs(root, { id: "s", inputs: ["skills", "absent"] })).toBe(
      hashInputs(root, { id: "s", inputs: ["skills"] }),
    );
  });
});

describe("filesUnder is deterministic", () => {
  it("returns a sorted list, so the hash cannot depend on readdir order", () => {
    const root = repo({ "d/z.md": "1", "d/a.md": "2", "d/sub/m.md": "3" });
    expect(filesUnder(root, "d")).toEqual(["d/a.md", "d/sub/m.md", "d/z.md"]);
  });

  it("sorts by codepoint, not by locale — the same on every machine", () => {
    const root = repo({ "d/README.md": "1", "d/a.md": "2" });
    expect(filesUnder(root, "d")).toEqual(["d/README.md", "d/a.md"]);
  });

  it("a single file resolves to itself", () => {
    const root = repo({ "d/a.md": "1" });
    expect(filesUnder(root, "d/a.md")).toEqual(["d/a.md"]);
  });
});

describe("selectSteps — nothing changed", () => {
  it("a build whose inputs match its seed runs nothing", () => {
    // The bean's first `Done when`: a staging build that changes nothing
    // renders nothing.
    const root = repo({ "skills/a.md": "x", "catalogue/n.json": "{}" });
    const m = buildManifest(root, STEPS);
    const sel = selectSteps(root, STEPS, m);
    expect(sel.run).toEqual([]);
    expect(sel.skip).toEqual(["skills", "pages", "index"]);
  });
});

describe("selectSteps — the projection edge", () => {
  it("one changed source file re-runs its own step", () => {
    const root = repo({ "skills/a.md": "x", "catalogue/n.json": "{}" });
    const m = buildManifest(root, STEPS);
    writeFileSync(join(root, "skills/a.md"), "CHANGED");
    const sel = selectSteps(root, STEPS, m);
    expect(sel.why["skills"]!.kind).toBe("inputs-changed");
  });
});

describe("selectSteps — the index edge, which is the whole bean", () => {
  it("a changed MEMBER re-runs the index that counts it", () => {
    // The index file itself did not change; a member of the set it is derived
    // from did. Missing this is the failure nobody notices.
    const root = repo({ "skills/a.md": "x", "catalogue/n.json": "{}" });
    const m = buildManifest(root, STEPS);
    writeFileSync(join(root, "catalogue/n.json"), '{"changed":true}');
    const sel = selectSteps(root, STEPS, m);
    expect(sel.run).toContain("pages");
    expect(sel.run).toContain("index");
    expect(sel.why["pages"]!.kind).toBe("inputs-changed");
  });

  it("a step re-runs because something it NEEDS re-ran, not because its own inputs moved", () => {
    const root = repo({ "skills/a.md": "x", "catalogue/n.json": "{}" });
    const m = buildManifest(root, STEPS);
    writeFileSync(join(root, "skills/a.md"), "CHANGED");
    const sel = selectSteps(root, STEPS, m);
    expect(sel.why["pages"]).toEqual({
      kind: "needs-rerun",
      needs: "skills",
      detail: "`skills` is re-running, and this step reads what it writes",
    });
  });

  it("the cascade reaches a fixed point, not just one hop", () => {
    // `index` needs `pages` needs `skills`. A single sweep in declaration
    // order would catch `pages` and could miss `index`.
    const root = repo({ "skills/a.md": "x", "catalogue/n.json": "{}" });
    const m = buildManifest(root, STEPS);
    writeFileSync(join(root, "skills/a.md"), "CHANGED");
    expect(selectSteps(root, STEPS, m).run).toEqual(["skills", "pages", "index"]);
  });

  it("the cascade works when declaration order runs against the dependency order", () => {
    // Declared leaf-first: a one-pass implementation in declaration order
    // would propagate nothing.
    const reversed: StepInputs[] = [
      { id: "index", inputs: ["catalogue"], needs: ["pages"] },
      { id: "pages", inputs: ["catalogue"], needs: ["skills"] },
      { id: "skills", inputs: ["skills"] },
    ];
    const root = repo({ "skills/a.md": "x", "catalogue/n.json": "{}" });
    const m = buildManifest(root, reversed);
    writeFileSync(join(root, "skills/a.md"), "CHANGED");
    expect(selectSteps(root, reversed, m).run.sort()).toEqual(["index", "pages", "skills"]);
  });
});

describe("selectSteps — could-not-determine always runs", () => {
  const root = () => repo({ "skills/a.md": "x", "catalogue/n.json": "{}" });

  it("no manifest at all is a FULL render", () => {
    const sel = selectSteps(root(), STEPS, undefined);
    expect(sel.run).toEqual(["skills", "pages", "index"]);
    expect(sel.why["skills"]!.kind).toBe("no-manifest");
  });

  it("a step the manifest never mentions runs — absent is not fresh", () => {
    const r = root();
    const m = buildManifest(r, STEPS);
    delete m.steps["pages"];
    const sel = selectSteps(r, STEPS, m);
    expect(sel.why["pages"]!.kind).toBe("not-in-manifest");
    // ...and the cascade still reaches what depends on it.
    expect(sel.run).toContain("index");
  });

  it("a step that never said what it reads runs", () => {
    const r = root();
    const undeclared: StepInputs[] = [{ id: "mystery" }];
    const sel = selectSteps(r, undeclared, buildManifest(r, undeclared));
    expect(sel.why["mystery"]!.kind).toBe("undeclared-inputs");
  });

  it("an alwaysRun step runs and says why", () => {
    const r = root();
    const steps: StepInputs[] = [{ id: "clock", inputs: ["skills"], alwaysRun: "stamps the build time" }];
    const sel = selectSteps(r, steps, buildManifest(r, steps));
    expect(sel.why["clock"]).toEqual({ kind: "always", detail: "stamps the build time" });
  });
});

describe("readManifest refuses a seed it cannot trust", () => {
  it("absent is undefined", () => {
    expect(readManifest(join(repo({ "a": "x" }), "nope.json"))).toBeUndefined();
  });

  it("unparseable is undefined, not a partial read", () => {
    const r = repo({ "m.json": "{ not json" });
    expect(readManifest(join(r, "m.json"))).toBeUndefined();
  });

  it("a wrong schema tag is undefined", () => {
    const r = repo({ "m.json": JSON.stringify({ $schema: "something-else/v9", steps: {} }) });
    expect(readManifest(join(r, "m.json"))).toBeUndefined();
  });

  it("a manifest with no steps object is undefined", () => {
    const r = repo({ "m.json": JSON.stringify({ $schema: MANIFEST_SCHEMA }) });
    expect(readManifest(join(r, "m.json"))).toBeUndefined();
  });

  it("a well-formed one round-trips", () => {
    const r = repo({ "skills/a.md": "x" });
    const steps: StepInputs[] = [{ id: "s", inputs: ["skills"] }];
    const m = buildManifest(r, steps, "abc1234");
    writeFileSync(join(r, "m.json"), JSON.stringify(m));
    const back = readManifest(join(r, "m.json"))!;
    expect(back.steps["s"]).toBe(m.steps["s"]);
    expect(back.commit).toBe("abc1234");
    expect(selectSteps(r, steps, back).run).toEqual([]);
  });
});

describe("inputGraphs — read the declaration, do not spell the paths", () => {
  // `check:declared-paths` rejected the first draft for listing nine declared
  // directories as literals, and it was right: `harness.json` already answers
  // "where do the skills live", and a second answer goes stale the moment one
  // moves — while the render goes on hashing a path that is not there and
  // reporting everything unchanged.
  const resolve = (g: string): string[] =>
    g === "kg" ? ["a/skills", "b/skills"] : g === "beans" ? ["beans/defs"] : [];

  it("resolves a graph typology to its declared directories", () => {
    const root = repo({ "a/skills/x.md": "1", "b/skills/y.md": "2" });
    expect(resolvedInputs(root, { id: "s", inputGraphs: ["kg"] }, resolve)).toEqual([
      "a/skills",
      "b/skills",
    ]);
  });

  it("merges literals and graphs, deduplicated and sorted", () => {
    const root = repo({ "a/skills/x.md": "1" });
    // Codepoint order, so uppercase sorts before lowercase — and it is the
    // same on every machine, which `localeCompare` is not. A hash whose
    // input order varies by ICU version mismatches between the machine that
    // wrote a seed and the one reading it.
    expect(
      resolvedInputs(root, { id: "s", inputs: ["README.md", "a/skills"], inputGraphs: ["kg"] }, resolve),
    ).toEqual(["README.md", "a/skills", "b/skills"]);
  });

  it("a step declaring only graphs is CACHEABLE, not undeclared", () => {
    // The regression this guards: the first wiring tested `inputs.length`
    // alone, so every step converted to `inputGraphs` silently became
    // "declares no inputs" — which always re-renders. The build would still
    // be correct and would have quietly stopped being incremental.
    const root = repo({ "a/skills/x.md": "1", "b/skills/y.md": "2" });
    const steps: StepInputs[] = [{ id: "s", inputGraphs: ["kg"] }];
    const m = buildManifest(root, steps, undefined, resolve);
    expect(m.steps["s"]).toBeDefined();
    expect(selectSteps(root, steps, m, resolve).run).toEqual([]);
  });

  it("a change inside a resolved directory re-runs the step", () => {
    const root = repo({ "a/skills/x.md": "1", "b/skills/y.md": "2" });
    const steps: StepInputs[] = [{ id: "s", inputGraphs: ["kg"] }];
    const m = buildManifest(root, steps, undefined, resolve);
    writeFileSync(join(root, "b/skills/y.md"), "CHANGED");
    expect(selectSteps(root, steps, m, resolve).why["s"]!.kind).toBe("inputs-changed");
  });

  it("a graph the resolver knows nothing about contributes nothing", () => {
    // And the step is then undeclared, so it always runs — rather than
    // hashing an empty set and matching a seed that means something else.
    const root = repo({ "a/skills/x.md": "1" });
    const steps: StepInputs[] = [{ id: "s", inputGraphs: ["no-such-graph"] }];
    expect(resolvedInputs(root, steps[0]!, resolve)).toEqual([]);
    expect(selectSteps(root, steps, buildManifest(root, steps, undefined, resolve), resolve).why["s"]!.kind).toBe(
      "undeclared-inputs",
    );
  });

  it("without a resolver, inputGraphs contribute nothing rather than throwing", () => {
    const root = repo({ "a/skills/x.md": "1" });
    expect(resolvedInputs(root, { id: "s", inputGraphs: ["kg"] })).toEqual([]);
  });
});
