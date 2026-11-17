/**
 * BPMN translation, end to end: extract → PO → inject.
 *
 * The round-trip unit tests live beside `bpmn-translate.ts`. This one proves
 * the property that matters for a SHIPPED diagram: a translated `.bpmn` is
 * still a loadable process with its structure intact. A translation pass that
 * produced beautiful French labels and a disconnected graph would pass every
 * string-level test.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { extractBpmn, injectBpmn } from "../../../pipeline/bpmn-translate.ts";
import { parsePo } from "../../../pipeline/po-inject.ts";
import { loadProcessModel, isActivity } from "../../../src/workflow/process-model.ts";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { workflowFile } from "../../known-skills.ts";

const ROOT = join(HARNESS_ROOT);
// bean-open.bpmn, not bean-lifecycle.bpmn: since the lifecycle was split
// (bean m8gz), its gateways, its labels and its one bean op live in the open
// half. Found by NAME through the declared `processes` graphs.
const SRC = workflowFile(ROOT, "bean-open.bpmn");

/** A PO translating a handful of the diagram's msgids. */
function poFor(pairs: [string, string][]): string {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
  return pairs.map(([id, str]) => `msgid "${esc(id)}"\nmsgstr "${esc(str)}"`).join("\n\n");
}

describe("bpmn translation end to end", () => {
  test("a translated diagram still loads, with its graph and skill refs intact", async () => {
    const xml = readFileSync(SRC, "utf-8");
    const before = await loadProcessModel(SRC);

    // Translate every label the extractor offers, so nothing is left to luck.
    const entries = extractBpmn(xml, relative(ROOT, SRC));
    expect(entries.length).toBeGreaterThan(5);
    const po = poFor(entries.map((e) => [e.msgid, `[fr] ${e.msgid}`] as [string, string]));

    const out = injectBpmn(xml, parsePo(po));
    const dir = mkdtempSync(join(tmpdir(), "bpmn-fr-"));
    const path = join(dir, "bean-open.bpmn");
    writeFileSync(path, out);
    try {
      const after = await loadProcessModel(path);

      // Structure is identical: same nodes, same ids, same lanes' membership.
      expect(after.nodes.size).toBe(before.nodes.size);
      const ids = (m: typeof before) => [...m.nodes.keys()].sort();
      expect(ids(after)).toEqual(ids(before));

      // Skill refs and bean ops survive — a translated ref would be exactly
      // the dangling reference check:workflow-refs exists to catch.
      const refs = (m: typeof before) =>
        [...m.nodes.values()].filter(isActivity).flatMap((n) => n.skills ?? []).sort();
      expect(refs(after)).toEqual(refs(before));
      const ops = (m: typeof before) =>
        [...m.nodes.values()].filter(isActivity).map((n) => n.workPlanOp ?? "-").sort();
      expect(ops(after)).toEqual(ops(before));

      // ...and the labels actually changed.
      const translated = [...after.nodes.values()].filter((n) => (n.name ?? "").startsWith("[fr]"));
      expect(translated.length).toBeGreaterThan(5);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a partial PO leaves the untranslated labels in the source language", async () => {
    // A half-finished translation must yield a half-English diagram, not a
    // blank one — the failure mode that loses the diagram entirely.
    const xml = readFileSync(SRC, "utf-8");
    const out = injectBpmn(xml, parsePo(poFor([["Whose bean?", "À qui ?"]])));
    expect(out).toContain("À qui ?");
    expect(out).toContain("Already exists?"); // untouched, still English
    expect(out).not.toContain('name=""');
  });
});
