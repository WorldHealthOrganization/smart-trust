/**
 * `visualiser-writers.ts`: the writer of each declared visualiser, and how it
 * is pointed at a site, read from the declarations (visualiser → renderedBy →
 * Tool → invoke.shell and its `site` / `instance` inputs), never kept as a list.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { repoRootFor } from "../../../schemas/kg/cat-harness.ts";

import { HARNESS_ROOT } from "../../lib/roots.ts";
import { RUN_SCRIPT, writerCommand } from "../../lib/script-command.ts";
import { siteArg, siteTarget } from "../../lib/site-target.ts";
import { inPublishOrder, runVisualiserWriters, visualiserWriters, writerArgv, writersFor, type VisualiserWriter } from "../../visualiser-writers.ts";
import { writerFilesFor, type DeclaredVisualiser } from "../../viewer-declarations.ts";
import type { ExpectedPage } from "../../site-coverage.ts";

const vis = (harness: string, id: string, renderedBy: string, harnessRoot = `/r/${harness}`): DeclaredVisualiser =>
  ({ harness, id, renderedBy, harnessRoot, covers: ["x"] }) as unknown as DeclaredVisualiser;

const flag = (name: string, f: string, required = false) => ({ name, required, arg: { flag: f } });
const tool = (id: string, shell: string | undefined, inputs: object[] = []) =>
  ({ id, invoke: shell === undefined ? { manual: true } : { shell }, io: { inputs, outputs: [] } }) as never;

/** A checkout with (`cat`) or without a `cat` runner in its own package.json. */
function checkout(withCat: boolean): string {
  const dir = mkdtempSync(join(tmpdir(), "vw-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ scripts: withCat ? { cat: "bun x" } : {} }));
  return dir;
}

describe("visualiserWriters", () => {
  const tools = [
    tool("library-viewer", "bun run cat library:viz", [flag("check", "--check"), flag("site", "--site")]),
    tool("state-viewer", "bun run cat state:visualizer", [flag("site", "--site")]),
    tool("archimate-pages", "bun run x/gen-archimate-pages.ts", [flag("instance", "--instance", true), flag("out", "--out")]),
    tool("ig-pages", "bun run x/gen-ig-pages.ts", [{ name: "instance", required: true }]),
    tool("needy", "bun run cat needy", [flag("site", "--site"), flag("label", "--label", true)]),
    tool("bare", "bun run cat bare:viz", [flag("check", "--check")]),
    tool("manual", undefined),
    tool("shelly", "bun run cat a; rm -rf /", [flag("site", "--site")]),
  ];
  const ws = visualiserWriters("/r", [
    vis("cat-harness", "library", "library-viewer"),
    vis("cat-harness", "beans", "state-viewer"),
    vis("cat-harness", "qa", "state-viewer"),
    vis("a", "archimate", "archimate-pages", "/r/a"),
    vis("b", "archimate", "archimate-pages", "/r/b"),
    vis("smart-base", "artifact-index", "ig-pages"),
    vis("h", "needy", "needy"),
    vis("h", "bare", "bare"),
    vis("h", "manual", "manual"),
    vis("h", "shelly", "shelly"),
    vis("h", "ghost", "no-such-tool"),
  ], tools);
  const of = (t: string): VisualiserWriter[] => ws.filter((w) => w.tool === t);

  test("the command is the Tool's invocation and the site flag its declared `site` input", () => {
    const [w] = of("library-viewer");
    expect(w!.invoke).toEqual(["bun", "run", "cat", "library:viz"]);
    expect(w!.siteFlag).toBe("--site");
    expect(w!.unrunnable).toBeUndefined();
  });

  test("one Tool drawing several visualisers runs once", () => {
    expect(of("state-viewer")).toHaveLength(1);
    expect(of("state-viewer")[0]!.visualisers.map((v) => v.visualiser)).toEqual(["beans", "qa"]);
  });

  test("a Tool with an `instance` input runs once per declaring harness, and `out` serves as its site", () => {
    const a = of("archimate-pages");
    expect(a.map((w) => w.instance)).toEqual([{ flag: "--instance", root: "/r/a" }, { flag: "--instance", root: "/r/b" }]);
    expect(a.every((w) => w.siteFlag === "--out")).toBe(true);
  });

  test("what cannot be run is said, with the reason, never dropped", () => {
    expect(of("ig-pages")[0]!.unrunnable).toMatch(/`instance` input declares no flag/);
    expect(of("needy")[0]!.unrunnable).toMatch(/requires input\(s\) `label`/);
    expect(of("manual")[0]!.unrunnable).toMatch(/no shell invocation/);
    expect(of("shelly")[0]!.unrunnable).toMatch(/not a plain command/);
    expect(of("no-such-tool")[0]!.unrunnable).toMatch(/names no discovered Tool/);
  });

  test("a Tool with no `site` input runs into its own site, and is refused one being built", () => {
    const [w] = of("bare");
    expect(w!.unrunnable).toBeUndefined();
    expect(w!.siteFlag).toBeUndefined();
    const root = checkout(true);
    try {
      expect(writerArgv(root, w!)).toEqual(["bun", "run", "cat", "bare:viz"]);
      expect(() => writerArgv(root, w!, "/s")).toThrow(/declares no `site` input/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("writerArgv", () => {
  const w: VisualiserWriter = { tool: "t", visualisers: [], invoke: ["bun", "run", "cat", "library:viz"], siteFlag: "--site" };

  test("`bun run cat` goes through run-script.ts where the checkout has no `cat` script", () => {
    for (const withCat of [true, false]) {
      const root = checkout(withCat);
      try {
        expect(writerArgv(root, w, "/s")).toEqual([...writerCommand(root, "library:viz"), "--site", "/s"]);
        expect(writerArgv(root, w, "/s").includes(RUN_SCRIPT)).toBe(!withCat);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  test("a path invocation runs as declared, with the instance and the site", () => {
    const a: VisualiserWriter = { tool: "a", visualisers: [], invoke: ["bun", "run", "x/gen.ts"], siteFlag: "--out", instance: { flag: "--instance", root: "/r/a" } };
    expect(writerArgv("/r", a, "/s")).toEqual(["bun", "run", "x/gen.ts", "--instance", "/r/a", "--out", "/s"]);
  });
});

describe("writersFor and runVisualiserWriters", () => {
  const ref = (harness: string, visualiser: string) => ({ harness, visualiser, harnessRoot: `/r/${harness}` });
  const page = (harness: string, visualiser: string): ExpectedPage => ({ route: `en/${harness}/${visualiser}/`, legacyRoute: `${harness}/${visualiser}/`, harness, visualiser });
  const writers: VisualiserWriter[] = [
    { tool: "state", visualisers: [ref("h", "beans"), ref("h", "qa")], invoke: ["bun", "run", "s.ts"], siteFlag: "--site" },
    { tool: "lib", visualisers: [ref("h", "library")], invoke: ["bun", "run", "l.ts"], siteFlag: "--site" },
    { tool: "ig", visualisers: [ref("sb", "artifact-index")], unrunnable: "no flag" },
  ];

  test("only the writers of missing pages run, each once", () => {
    const owed = writersFor(writers, [page("h", "qa"), page("sb", "artifact-index")]);
    expect(owed.map((w) => w.tool)).toEqual(["state", "ig"]);
    expect(owed[0]!.visualisers.map((v) => v.visualiser)).toEqual(["qa"]);
  });

  test("a per-instance writer runs again for each other instance owed a sub-graph page", () => {
    const ig: VisualiserWriter = { tool: "ig", visualisers: [ref("sb", "artifact-index")], invoke: ["bun", "run", "ig.ts"], siteFlag: "--site", instance: { flag: "--instance", root: "/r/sb" } };
    const sub = (instance: string): ExpectedPage => ({ ...page("sb", "artifact-index"), route: `en/sb/artifact-index/${instance}/`, instance });
    const roots: Record<string, string> = { sb: "/r/sb", trust: "/r/trust" };
    const owed = writersFor([ig], [page("sb", "artifact-index"), sub("sb"), sub("trust"), sub("unplaced")], (n) => roots[n]);
    expect(owed.map((w) => w.instance?.root)).toEqual(["/r/sb", "/r/trust"]);
    expect(writerArgv("/r", owed[1]!, "/s")).toEqual(["bun", "run", "ig.ts", "--instance", "/r/trust", "--site", "/s"]);
  });

  test("a failure, a decline and an unrunnable writer are returned for the caller to judge", () => {
    const seen: string[][] = [];
    const runs = runVisualiserWriters("/r", writers, "/s", (argv) => {
      seen.push([...argv]);
      return argv.includes("s.ts") ? { kind: "failed", exit: 1 } : { kind: "skipped", why: "nothing here" };
    });
    expect(seen).toEqual([["bun", "run", "s.ts", "--site", "/s"], ["bun", "run", "l.ts", "--site", "/s"]]);
    expect(runs.map((r) => r.outcome.kind)).toEqual(["failed", "skipped", "unrunnable"]);
  });
});

describe("site-target", () => {
  test("`--site` is read in either spelling, absolute; absent, the writer's own site", () => {
    expect(siteArg(["--check", "--site", "/a/b"])).toBe("/a/b");
    expect(siteArg(["--site=/c"])).toBe("/c");
    expect(siteArg(["--check"])).toBeUndefined();
    expect(siteTarget("/own", [])).toBe("/own");
    expect(siteTarget("/own", ["--site", "/x"])).toBe("/x");
  });
});

describe("over this checkout", () => {
  const root = repoRootFor(HARNESS_ROOT);

  test("every writer whose Tool declares a `site` input reads it", () => {
    // The declaration is what a site build reads; a Tool that promises `--site`
    // while its script ignores it would write into its pinned harness instead.
    for (const w of visualiserWriters(root).filter((x) => x.siteFlag === "--site" && x.invoke?.[2] === "cat")) {
      const files = writerFilesFor(root, [w.invoke![3]!]);
      if (files === undefined) continue;
      const text = readFileSync(join(root, files[0]!), "utf-8");
      expect({ tool: w.tool, reads: /lib\/site-target/.test(text) }).toEqual({ tool: w.tool, reads: true });
    }
  });
});

describe("inPublishOrder — a viewer runs after the viewers whose pages it links (owner, 2026-11-10)", () => {
  const w = (tool: string, script?: string): VisualiserWriter => ({
    tool,
    visualisers: [],
    ...(script ? { invoke: ["bun", "run", "cat", script] } : {}),
  });

  test("puts library:viz before methodologies:viz, as derive:publish does, and leaves the others in place", () => {
    const writers = [w("methodologies-viewer", "methodologies:viz"), w("other", "other:viz"), w("library-viewer", "library:viz"), w("unrunnable")];
    const out = inPublishOrder(writers, ["library:viz", "methodologies:viz"]);
    expect(out.map((x) => x.tool)).toEqual(["library-viewer", "other", "methodologies-viewer", "unrunnable"]);
  });

  test("changes nothing when the plan names none of them", () => {
    const writers = [w("a", "a:viz"), w("b", "b:viz")];
    expect(inPublishOrder(writers, [])).toEqual(writers);
  });
});
