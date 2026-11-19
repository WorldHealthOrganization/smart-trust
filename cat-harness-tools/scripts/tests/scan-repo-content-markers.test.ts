/**
 * The `markers` section of `scan-repo-content.ts` — what a harness could
 * declare, and whether it already does (bean `folio-assistant-dscv`).
 *
 * @module scripts/tests/scan-repo-content-markers
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { declarableDirs, formatMarkers, scanMarkers } from "../lib/content-markers.js";
import { scanRepo } from "../scan-repo-content.js";

function fixture(files: Record<string, string>): { root: string; list: string[]; done: () => void } {
  const root = mkdtempSync(join(tmpdir(), "markers-"));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), body);
  }
  return { root, list: Object.keys(files).sort(), done: () => rmSync(root, { recursive: true, force: true }) };
}

const IG_FILES = {
  "sushi-config.yaml": "id: x\n",
  "input/fsh/a.fsh": "Profile: A\n",
  "input/pagecontent/index.md": "# hi\n",
};

describe("scanMarkers", () => {
  test("with no index.config.json, every finding is `unknown`, never `not-declared`", () => {
    const f = fixture({ ...IG_FILES, "processes/a.bpmn": "<x/>" });
    try {
      const m = scanMarkers(f.root, f.list);
      expect(m.index).toBe("absent");
      expect(m.findings.length).toBeGreaterThan(0);
      for (const x of m.findings) expect(x.declared).toBe("unknown");
    } finally {
      f.done();
    }
  });

  test("sushi-config.yaml suggests contentTypes.ig with an include list of the paths present", () => {
    const f = fixture({ ...IG_FILES, "index.config.json": JSON.stringify({ instances: [] }) });
    try {
      const ig = scanMarkers(f.root, f.list).findings.find((x) => x.id === "ig")!;
      expect(ig.target).toBe("contentTypes");
      expect(ig.declared).toBe("not-declared");
      expect(ig.suggestion.snippet).toEqual({ ig: { include: ["sushi-config.yaml", "input/fsh/", "input/pagecontent/"] } });
    } finally {
      f.done();
    }
  });

  test("a declared section reads `declared`, and the scan writes nothing", () => {
    const index = JSON.stringify({ instances: [], contentTypes: { ig: { include: ["sushi-config.yaml"] } } });
    const f = fixture({ ...IG_FILES, "index.config.json": index });
    try {
      const m = scanMarkers(f.root, f.list);
      expect(m.findings.find((x) => x.id === "ig")!.declared).toBe("declared");
      expect(readFileSync(join(f.root, "index.config.json"), "utf-8")).toBe(index);
    } finally {
      f.done();
    }
  });

  test("a legacy dak.json suggests contentTypes.dak with its scalar fields", () => {
    const f = fixture({ "dak.json": JSON.stringify({ id: "x.y", name: "X", nested: { a: 1 } }), "index.config.json": "{}" });
    try {
      const dak = scanMarkers(f.root, f.list).findings.find((x) => x.id === "dak")!;
      expect(dak.suggestion.snippet).toEqual({ dak: { id: "x.y", name: "X" } });
    } finally {
      f.done();
    }
  });

  test("directories are checked against the local instance's declaration", () => {
    const f = fixture({
      "index.config.json": JSON.stringify({ instances: [{ name: "demo", source: { local: { at: "." } } }] }),
      "demo.json": JSON.stringify({ name: "demo", directories: [{ id: "lib", path: "library/", graphTypologies: ["library"] }] }),
      "library/a.pdf": "",
      "uploads/b.pdf": "",
      "processes/conduct/a.bpmn": "<x/>",
      ".beans.yml": "beans:\n  path: beans\n",
    });
    try {
      const m = scanMarkers(f.root, f.list);
      const by = (id: string) => m.findings.find((x) => x.id === id)!;
      expect(by("library").declared).toBe("declared");
      expect(by("uploads").declared).toBe("not-declared");
      expect(by("uploads").suggestion).toEqual({ at: "demo.json#directories", snippet: { id: "uploads", path: "uploads/", graphTypologies: ["uploads"] } });
      expect(by("processes").suggestion.snippet).toMatchObject({ path: "processes/" });
      expect(by("beans").paths).toEqual([".beans.yml"]);
    } finally {
      f.done();
    }
  });

  test("an unreadable index is its own state", () => {
    const f = fixture({ ...IG_FILES, "index.config.json": "{ not json" });
    try {
      const m = scanMarkers(f.root, f.list);
      expect(m.index).toBe("unreadable");
      expect(formatMarkers(m)).toContain("unknown");
    } finally {
      f.done();
    }
  });

  test("Lean and folio manifests suggest an instance contentType", () => {
    const f = fixture({ "index.config.json": "{}", "lakefile.lean": "", "folio/p/p.ts": "", "folio/p/x/x.ts": "" });
    try {
      const ids = scanMarkers(f.root, f.list).findings.map((x) => `${x.target}:${x.id}`);
      expect(ids).toContain("contentType:paper");
      expect(ids).toContain("contentType:document");
    } finally {
      f.done();
    }
  });

  test("build output and node_modules are never evidence", () => {
    const f = fixture({ "index.config.json": "{}", "node_modules/x/processes/a.bpmn": "", "fsh-generated/a.bpmn": "" });
    try {
      expect(scanMarkers(f.root, f.list).findings).toEqual([]);
    } finally {
      f.done();
    }
  });
});

describe("declarableDirs", () => {
  test("anchors on the nearest `processes` directory and collapses nested ones", () => {
    expect(declarableDirs(["a/processes/x/1.bpmn", "a/processes/2.bpmn", "b/3.bpmn"], "processes")).toEqual(["b/", "a/processes/"]);
  });
});

describe("scanRepo carries markers", () => {
  test("the full scan's JSON has a markers section", () => {
    const f = fixture({ ...IG_FILES, "index.config.json": "{}" });
    try {
      const r = scanRepo(f.root);
      expect(r.markers.findings.some((x) => x.id === "ig")).toBe(true);
    } finally {
      f.done();
    }
  });
});
