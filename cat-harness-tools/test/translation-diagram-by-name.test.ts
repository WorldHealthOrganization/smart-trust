/**
 * A content-type profile's `bpmnDiagrams` entry may name a diagram another
 * layer owns by its FILE NAME: found through the declared process graphs of
 * the chain, opt-in groups included whether switched on or not, so the entry
 * survives the owner regrouping its diagrams.
 */
import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { clearCheckoutCache } from "../schemas/kg/harness-config.ts";
import { resolveTranslationPath, type DeclaredContentTypeTranslation } from "../schemas/library/translation-tools.ts";

const made: string[] = [];
afterEach(() => clearCheckoutCache());
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

function write(root: string, files: Record<string, string | object>): void {
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), typeof body === "string" ? body : JSON.stringify(body, null, 2));
  }
}

const BPMN = '<?xml version="1.0"?><definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"><process id="P"/></definitions>\n';

/** `a` holds its diagrams in an opt-in group `x`; `b` needs `a` and declares the profile. */
function checkout(extra: Record<string, string | object> = {}): string {
  const parent = mkdtempSync(join(tmpdir(), "translation-by-name-"));
  made.push(parent);
  write(parent, {
    "a/a.json": { name: "a", needs: [], directories: [{ id: "x", path: "x/", graphTypologies: ["cat-harness"], optIn: true }] },
    "a/x/graph.json": { directories: [{ id: "x-processes", path: "processes/", subgraph: true, graphTypologies: ["processes"] }] },
    "a/x/processes/content/flow.bpmn": BPMN,
    "b/b.json": { name: "b", needs: ["a"], directories: [] },
    ...extra,
  });
  return join(parent, "b");
}

const profile = (b: string): DeclaredContentTypeTranslation =>
  ({ contentType: "doc", name: "Doc", formats: [], rtlSupported: false, declaredBy: b }) as DeclaredContentTypeTranslation;

describe("bpmnDiagrams by file name", () => {
  test("a diagram in another layer's switched-off opt-in group is found by name", () => {
    const b = checkout();
    expect(resolveTranslationPath(profile(b), "flow.bpmn")).toBe(join(b, "..", "a", "x", "processes", "content", "flow.bpmn"));
  });

  test("a name no layer in the chain declares is still a finding", () => {
    expect(resolveTranslationPath(profile(checkout()), "renamed.bpmn")).toBeUndefined();
  });

  test("a name two diagrams share is ambiguous, not picked", () => {
    const b = checkout({ "a/x/processes/other/flow.bpmn": BPMN });
    expect(resolveTranslationPath(profile(b), "flow.bpmn")).toBeUndefined();
  });

  test("a path is still a path: it is not matched by its last segment", () => {
    expect(resolveTranslationPath(profile(checkout()), "processes/content/flow.bpmn")).toBeUndefined();
  });
});
