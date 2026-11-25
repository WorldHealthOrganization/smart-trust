/**
 * The diagram corpus is well-formed where a conformant parser would look.
 *
 * Gated here rather than only in `render:bpmn` because that script launches
 * Chromium, and a machine without a usable browser build would skip the check
 * entirely — which is the shape of failure it exists to prevent, one level up.
 * `bun test` runs everywhere.
 *
 * Bean `folio-assistant-qjog`. Seven artefacts — six `.bpmn` and, unanticipated
 * by the bean, one `.dmn` — carried `--` inside a comment, which XML 1.0 §2.5
 * forbids. Every gate in the repo was green over them for months because
 * `bpmn-moddle`, `dmn-moddle` and `fast-xml-parser` all accept it, while each
 * file's own header invites the reader to open it in "any other BPMN 2.0 tool".
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

import { checkXmlComments, xmlCommentFiles, xmlSourcesUnder } from "../xml-comment-check.js";
import { HARNESS_ROOT } from "../lib/roots.ts";

const root = resolve(HARNESS_ROOT);
const WORKFLOW_DIR = join(root, "processes");

describe("XML comments in the diagram corpus", () => {
  test("there are diagrams to check — otherwise this proves nothing", () => {
    expect(xmlSourcesUnder(WORKFLOW_DIR).length).toBeGreaterThan(10);
  });

  test("both .bpmn and .dmn are covered", () => {
    // The bean counted only `.bpmn`; the broken `.dmn` was found because the
    // scan was widened. Pinning both extensions keeps that from narrowing back.
    const files = xmlSourcesUnder(WORKFLOW_DIR);
    expect(files.some((f) => f.endsWith(".bpmn"))).toBe(true);
    expect(files.some((f) => f.endsWith(".dmn"))).toBe(true);
  });

  test("no diagram has a malformed comment", () => {
    const findings = xmlSourcesUnder(WORKFLOW_DIR).flatMap((f) =>
      checkXmlComments(readFileSync(f, "utf8"), relative(root, f)),
    );
    // The empty list, not a count: a count permits a swap — fix one, introduce
    // another — and reports the ledger balanced.
    expect(findings.map((f) => `${f.file}:${f.line} ${f.detail}`)).toEqual([]);
  });
});

describe("the rule itself", () => {
  test("a double hyphen in the body is caught", () => {
    const f = checkXmlComments(`<r><!-- a -- b --></r>`, "t.bpmn");
    expect(f).toHaveLength(1);
    expect(f[0]!.detail).toContain('contains "--"');
  });

  test("a body ending in a hyphen is caught — the case a lazy regex gets wrong", () => {
    // `/<!--.*?-->/` ends the match at the FIRST `-->`, one character into the
    // `---` run, yielding a body of " a -". Right by accident; the scan takes
    // the same boundary a parser does and then tests the production.
    const f = checkXmlComments(`<r><!-- a ---></r>`, "t.bpmn");
    expect(f).toHaveLength(1);
  });

  test("an em dash is fine — it is what the corpus was supposed to use", () => {
    expect(checkXmlComments(`<r><!-- a — b --></r>`, "t.bpmn")).toEqual([]);
  });

  test("`--` OUTSIDE a comment is legal and must not be reported", () => {
    // Five occurrences of `render:bpmn` --` sat in <bpmn:documentation>, where
    // the production does not apply. Flagging those would have made the check
    // demand edits to files that were never broken.
    expect(checkXmlComments(`<r><doc>run it with --json</doc></r>`, "t.bpmn")).toEqual([]);
  });

  test("an unterminated comment is reported, not skipped", () => {
    const f = checkXmlComments(`<r><!-- never closed</r>`, "t.bpmn");
    expect(f).toHaveLength(1);
    expect(f[0]!.detail).toContain("never closed");
  });

  test("the offending line is named, not the comment's first line", () => {
    // These comments run to thirty lines; reporting "line 1" sends the reader
    // to a header and leaves them to find the hyphen themselves.
    const f = checkXmlComments(`<r><!--\nfine\nfine\nbad -- here\n--></r>`, "t.bpmn");
    expect(f).toHaveLength(1);
    expect(f[0]!.line).toBe(4);
  });
});

describe("what it reads", () => {
  test("a declared business-processes directory is read, beside processes — the kind the registry says this check grades", () => {
    const at = mkdtempSync(join(tmpdir(), "xml-comment-bp-"));
    try {
      writeFileSync(
        join(at, "ig.json"),
        JSON.stringify({
          $schema: "cat-harness-declaration/1.0.0",
          name: "ig",
          version: "0.1.0",
          directories: [{ id: "ig-bp", path: "input/business-processes/", graphTypologies: ["business-processes"] }],
        }),
      );
      mkdirSync(join(at, "input", "business-processes"), { recursive: true });
      const bad = join(at, "input", "business-processes", "A.bpmn");
      writeFileSync(bad, "<bpmn:definitions><!-- a -- b --></bpmn:definitions>");
      const { files } = xmlCommentFiles(at);
      expect(files.map((f) => relative(at, f))).toEqual(["input/business-processes/A.bpmn"]);
      // And it is graded, not merely listed.
      expect(files.flatMap((f) => checkXmlComments(readFileSync(f, "utf8"), relative(at, f))).length).toBe(1);
    } finally {
      rmSync(at, { recursive: true, force: true });
    }
  });

  test("this checkout's processes directories are still read", () => {
    expect(xmlCommentFiles(root).files.filter((f) => f.startsWith(WORKFLOW_DIR + "/")).length).toBeGreaterThan(10);
  });
});
