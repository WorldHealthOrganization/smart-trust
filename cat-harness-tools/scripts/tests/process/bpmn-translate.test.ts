/**
 * BPMN label extraction and injection.
 *
 * The `bpmn` format was declared in schemas/library/translation-tools.ts with no
 * extractModule, no injectModule and no code — so these tests pin the
 * behaviour the declaration implied, and in particular the things a
 * translation pass must NOT touch. Translating an id disconnects the graph;
 * translating a `folio:skill ref` manufactures exactly the dangling
 * reference that `check:workflow-refs` exists to catch.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractBpmn, injectBpmn, decodeLabel } from "../../../pipeline/bpmn-translate.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { harnessPath } from "../../lib/harness-layout.ts";

const ROOT = join(HARNESS_ROOT);
const XML = readFileSync(join(ROOT, "processes/process/crdm-requirements.bpmn"), "utf-8");
/**
 * A phase of the same process, read for the things the parent no longer carries.
 *
 * `crdm-requirements` is now the outer diagram — detection, a decision, and six
 * call activities — so its bean operations and its Stakeholders lane live in the
 * phases. Reading both keeps these tests on the real corpus, where a translation
 * pass actually runs, rather than on an inline fixture that cannot go stale
 * because it is not connected to anything.
 */
const PHASE_XML = readFileSync(join(ROOT, "processes/process/crdm-deliver.bpmn"), "utf-8");
// A diagram that still draws its work-plan steps: since cat-harness#991 step
// 17 only the `sdlc` diagrams do (proposal §4.13), so this fixture is one of them.
// declared-path-literal: a diagram of the harness's own corpus, read as a translation fixture
const SDLC_XML = readFileSync(harnessPath("sdlc/processes/merge-refusal.bpmn", ROOT), "utf-8");

describe("extractBpmn", () => {
  test("finds the labels a reader sees", () => {
    const entries = extractBpmn(XML, "processes/process/crdm-requirements.bpmn");
    const msgids = entries.map((e) => e.msgid);
    expect(msgids).toContain("BA / Feature Requestor");
    expect(msgids).toContain("Detect feature request (crdm-detect skill)");
    expect(entries.length).toBeGreaterThan(20);
  });

  test("authored line breaks become spaces, because a translator never sees them", () => {
    expect(decodeLabel("Describe the need&#10;(chat, issue, discussion)")).toBe(
      "Describe the need (chat, issue, discussion)",
    );
  });

  test("never offers an id, a skill ref or a bean op for translation", () => {
    const msgids = extractBpmn(XML, "x.bpmn").map((e) => e.msgid);
    for (const forbidden of [
      "BA_Submit", "A_Detect", "Process_CRDM", "Lane_Agent",
      "crdm-detect", "crdm-requirements-workflow", "todo-manager",
      "note", "claim", "resolve",
    ]) {
      expect({ forbidden, present: msgids.includes(forbidden) }).toEqual({ forbidden, present: false });
    }
  });

  test("de-duplicates, because a repeated label is one translation", () => {
    const msgids = extractBpmn(XML, "x.bpmn").map((e) => e.msgid);
    expect(msgids.length).toBe(new Set(msgids).size);
  });
});

describe("injectBpmn", () => {
  test("translates a label and leaves the structure alone", () => {
    const out = injectBpmn(XML, new Map([["BA / Feature Requestor", "BA / Demandeur"]]));
    expect(out).toContain('name="BA / Demandeur"');
    // Every structural handle survives untouched.
    expect(out).toContain('id="Lane_BA"');
    expect(out).toContain("<bpmn:flowNodeRef>BA_Submit</bpmn:flowNodeRef>");
    expect(out).toContain('<bootstrap.processes:skill ref="crdm-detect"/>');

    // A work-plan operation is structure too, and survives translation.
    const sdlc = injectBpmn(SDLC_XML, new Map([["Agent", "Agent (fr)"]]));
    expect(sdlc).toContain('<cat-harness.processes:bean op="note"/>');
  });

  test("an untranslated msgid keeps its source text", () => {
    // A half-finished PO must leave a half-English diagram, not a blank one.
    const out = injectBpmn(XML, new Map([["BA / Feature Requestor", "BA / Demandeur"]]));
    expect(out).toContain('name="Agent"');
  });

  test("round-trips: inject then re-extract sees the translation", () => {
    const fr = new Map([["Agent", "Agent (fr)"], ["Stakeholders", "Parties prenantes"]]);
    expect(extractBpmn(injectBpmn(XML, fr), "x.bpmn").map((e) => e.msgid)).toContain("Agent (fr)");
    // The Stakeholders lane is in the phases now, not the outer diagram.
    expect(extractBpmn(injectBpmn(PHASE_XML, fr), "x.bpmn").map((e) => e.msgid)).toContain(
      "Parties prenantes",
    );
  });

  test("escapes a translation containing XML metacharacters", () => {
    const out = injectBpmn(XML, new Map([["Agent", 'A & B "quoted" <tag>']]));
    expect(out).toContain('name="A &amp; B &quot;quoted&quot; &lt;tag&gt;"');
    // ...and the result is still parseable as the same document shape.
    expect(out).toContain('id="Lane_Agent"');
  });
});
