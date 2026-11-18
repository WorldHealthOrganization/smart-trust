/**
 * check:declaration-resolution — every path a declaration names resolves, in
 * the checkout being checked (kg-separation lesson 6).
 */
import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { checkDeclarationResolution, coverageFindings, exitCodeOf } from "../../check-declaration-resolution.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

function fixture(files: Record<string, string | object>): string {
  const root = mkdtempSync(join(tmpdir(), "decl-res-"));
  made.push(root);
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), typeof body === "string" ? body : JSON.stringify(body));
  }
  spawnSync("git", ["init", "-q"], { cwd: root });
  return root;
}

const decl = (extra: object) => ({ $schema: "cat-harness-declaration/1.0.0", name: "demo", version: "0.1.0", needs: [], ...extra });

describe("coverageFindings — coversKinds, the one reference no composed gate resolves", () => {
  test("an unregistered kind is a finding; a registered one is not", () => {
    const f = coverageFindings("demo", [{ id: "v", coversKinds: ["docs", "not-a-kind"] }], (k) => k === "docs");
    expect(f.map((x) => x.detail)).toEqual([expect.stringContaining('"not-a-kind"')]);
    expect(f[0]!.field).toBe("visualisers");
  });
});

describe("checkDeclarationResolution over a checkout", () => {
  test("each field is resolved by the gate that owns it, and named", () => {
    const root = fixture({
      "demo.json": decl({
        needs: ["no-such-layer"],
        directories: [
          { id: "present", path: "present/", graphTypologies: ["docs"] },
          { id: "gone", path: "gone/", graphTypologies: ["docs"] },
        ],
        assets: [{ id: "readme", src: "README.md", role: "instance-readme", title: "r", description: "d" }],
        visualisers: [{ id: "v", renderedBy: "no-such-tool", covers: ["present"], coversKinds: ["not-a-kind"] }],
      }),
      "present/.keep": "",
    });
    const r = checkDeclarationResolution(root);
    const by = Object.fromEntries(r.findings.map((f) => [f.field, f.by]));
    expect(by).toEqual({
      directories: "check:declared-dirs",
      assets: "check:declared-assets",
      visualisers: "check:declaration-resolution",
      needs: "check:instance-graph",
    });
    expect(r.findings.find((f) => f.field === "directories")!.subject).toContain("gone");
    expect(r.examined).toEqual({ declaration: 1, directories: 2, assets: 1, visualisers: 1, needs: 1, enableSubgraphs: 0, optInLinks: 0, optInRefs: 0 });
    // A certain finding is never hidden behind "no Tool loaded".
    expect(exitCodeOf(r)).toBe(1);
  });

  test("a link from an always-on page into an opt-in sub-graph is a finding of check:optin-links", () => {
    const root = fixture({
      "demo.json": decl({
        directories: [
          { id: "present", path: "present/", graphTypologies: ["docs"] },
          { id: "extra", path: "extra/", optIn: true, graphTypologies: ["docs"] },
        ],
      }),
      "present/page.md": "See [g](../extra/g.md).\n",
      "extra/g.md": "Back to [page](../present/page.md).\n",
    });
    const r = checkDeclarationResolution(root);
    const links = r.findings.filter((f) => f.field === "optInLinks");
    expect(links).toEqual([
      expect.objectContaining({ instance: "demo", subject: "present/page.md", by: "check:optin-links", detail: expect.stringContaining("demo.extra") }),
    ]);
    expect(r.examined.optInLinks).toBe(2);
    expect(exitCodeOf(r)).toBe(1);
  });

  test("an always-on workflow naming a skill only an opt-in sub-graph holds is a finding of check:optin-refs", () => {
    const root = fixture({
      "demo.json": decl({
        enableSubgraphs: ["demo.extra"],
        directories: [
          { id: "processes", path: "processes/", graphTypologies: ["processes"] },
          { id: "extra", path: "extra/", optIn: true, graphTypologies: ["cat-harness"] },
        ],
      }),
      "extra/only.md": "# only\n",
      "processes/main.bpmn": '<definitions><process id="p"><task id="t"><extensionElements><bootstrap.processes:skill ref="only"/></extensionElements></task></process></definitions>\n',
    });
    const r = checkDeclarationResolution(root);
    expect(r.findings.filter((f) => f.field === "optInRefs")).toEqual([
      expect.objectContaining({ instance: "demo", subject: "processes/main.bpmn", by: "check:optin-refs", detail: expect.stringContaining("demo.extra") }),
    ]);
    expect(r.examined.optInRefs).toBeGreaterThanOrEqual(1);
    expect(exitCodeOf(r)).toBe(1);
  });

  test("a clean declaration with nothing undetermined exits 0", () => {
    const root = fixture({ "demo.json": decl({ directories: [{ id: "present", path: "present/", graphTypologies: ["docs"] }] }), "present/.keep": "" });
    const r = checkDeclarationResolution(root);
    expect(r.findings).toEqual([]);
    expect(exitCodeOf(r)).toBe(0);
  });

  test("an empty checkout is could-not-determine, never a pass", () => {
    const root = fixture({ "notes.txt": "nothing declared" });
    const r = checkDeclarationResolution(root);
    expect(exitCodeOf(r)).toBe(2);
  });
});

describe("lesson 6 — kinds come from the checkout under inspection", () => {
  test("a kind only a layer IN the checkout contributes is known when run there with --root", () => {
    const kind = { $schema: "folio-graph-typology/v1", kind: "l6-contributed", renderable: false, holds: "derived", summary: "a contributed kind" };
    const root = fixture({
      "contributor/contributor.json": decl({ name: "contributor", directories: [{ id: "contributor-typologies", path: "typologies/", graphTypologies: ["typologies"] }] }),
      "contributor/typologies/l6-contributed.json": kind,
      "consumer/consumer.json": decl({ name: "consumer", needs: ["contributor"], directories: [{ id: "held", path: "held/", graphTypologies: ["l6-contributed"] }] }),
      "consumer/held/.keep": "",
    });
    const script = resolve(import.meta.dir, "..", "..", "check-declaration-resolution.ts");
    const r = spawnSync(process.execPath, [script, "--root", root, "--json"], { encoding: "utf8", env: { ...process.env, REPO_ROOT: "" } });
    const report = JSON.parse(r.stdout) as ReturnType<typeof checkDeclarationResolution>;
    expect(report.findings.filter((f) => f.field === "declaration")).toEqual([]);
    expect(report.instances).toEqual(["consumer", "contributor"]);
  });
});

// A mounted layer's id into its own declaration may name a group declared from
// within one of its opt-in directories; a root that leaves that directory off
// has no copy of it (`<layer>.L2-collab`, inside L2/graph.json, read from
// an IG root that enables none of the layer's levels). That id is left to the layer's own root and said
// so; with the directory on disk it is judged as before.
describe("a mounted layer's enableSubgraphs into an unmounted opt-in directory", () => {
  const layer = (name: string, extra: object) => ({ $schema: "cat-harness-declaration/1.0.0", name, version: "0.1.0", needs: [], ...extra });
  const lyr = layer("lyr", {
    directories: [{ id: "lyr-L2", path: "L2/", optIn: true, graphTypologies: ["cat-harness"] }],
    enableSubgraphs: ["lyr.lyr-L2", "lyr.L2-collab"],
  });

  test("the directory is not mounted: not judged here, and named", () => {
    const root = fixture({ "app.json": decl({ name: "app" }), "lyr/lyr.json": lyr });
    const r = checkDeclarationResolution(root);
    expect(r.findings.filter((f) => f.field === "enableSubgraphs")).toEqual([]);
    expect(r.notJudgedHere).toEqual([expect.stringContaining("lyr enableSubgraphs lyr.L2-collab")]);
  });

  test("the directory is on disk without the group: still a finding", () => {
    const root = fixture({
      "app.json": decl({ name: "app" }),
      "lyr/lyr.json": lyr,
      "lyr/L2/graph.json": { name: "L2", directories: [] },
    });
    const r = checkDeclarationResolution(root);
    expect(r.findings.filter((f) => f.field === "enableSubgraphs").map((f) => f.subject)).toEqual(["lyr.L2-collab"]);
    expect(r.notJudgedHere ?? []).toEqual([]);
  });
});
