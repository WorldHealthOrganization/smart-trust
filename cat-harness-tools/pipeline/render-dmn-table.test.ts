/**
 * Decision tables are drawn from their `.dmn` file (issue #1323, owner Q-DMN-1 A).
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DMN_TABLE_MARKER, linkRefs, placeDmnTable, plainCell, renderDmnFile } from "./render-dmn-table";
import { renderBlockMarkdown } from "./render-markdown";
import type { Block } from "../schemas/types.ts";

const dir = mkdtempSync(join(tmpdir(), "dmn-render-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const dmn = (rules: string, extra = "") => `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="Defs" name="T" namespace="urn:t">
  <decision id="Decision_T" name="Pick a <colour> &amp; size">
    <decisionTable id="DT" hitPolicy="FIRST">
      <input id="I1" label="Light"><inputExpression id="IE1" typeRef="string"><text>light</text></inputExpression></input>
      <input id="I2"><inputExpression id="IE2" typeRef="number"><text>count</text></inputExpression></input>
      <output id="O1" name="action" label="Action to take" typeRef="string"/>
      ${rules}
    </decisionTable>
  </decision>${extra}
</definitions>`;

const RULES = `
      <rule id="R1"><description>Stop on red.</description>
        <inputEntry id="a"><text>"red"</text></inputEntry><inputEntry id="b"><text>&gt; 0</text></inputEntry>
        <outputEntry id="c"><text>"stop"</text></outputEntry></rule>
      <rule id="R2">
        <inputEntry id="d"><text>-</text></inputEntry><inputEntry id="e"><text>-</text></inputEntry>
        <outputEntry id="f"><text>"go"</text></outputEntry></rule>`;

function file(name: string, xml: string): string {
  const p = join(dir, name);
  writeFileSync(p, xml);
  return p;
}

describe("renderDmnFile", () => {
  test("draws inputs, outputs, hit policy and one row per rule, escaped", async () => {
    const r = await renderDmnFile(file("ok.dmn", dmn(RULES)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const h = r.html;
    expect(h).toContain('<div class="fa-numbered fa-numbered-decision-table" data-dmn-decision="Decision_T" data-dmn-file="ok.dmn" data-dmn-hit-policy="FIRST">');
    expect(h).toContain("<strong>Pick a &lt;colour&gt; &amp; size</strong><br>The first rule that matches applies.");
    // Labels shown, the fact names a hover away.
    expect(h).toContain('<span title="light">Light</span>');
    expect(h).toContain('<span title="action">Action to take</span>');
    expect(h).toContain('colspan="2" class="fa-dmn-input fa-dmn-side">When</th>');
    // Plain values: no quotes, "any" for "-", comparisons as written.
    expect(h).toContain('title="&quot;red&quot;"><span class="fa-dmn-chip fa-dmn-chip-input">red</span>');
    expect(h).toContain('<span class="fa-dmn-chip fa-dmn-chip-input">&gt; 0</span>');
    expect(h).toContain('<span class="fa-dmn-any">any</span>');
    expect(h).toMatch(/fa-dmn-chip-output fa-dmn-hue-\d">stop</);
    expect(h).toContain('<tr class="fa-dmn-description"><td></td><td colspan="3"><small><em>Stop on red.</em></small></td></tr>');
    // One raw-HTML block for CommonMark: no blank line inside it.
    expect(h).not.toMatch(/\n\s*\n/);
  });

  test("is deterministic", async () => {
    const p = file("same.dmn", dmn(RULES));
    const a = await renderDmnFile(p);
    const b = await renderDmnFile(p);
    expect(a).toEqual(b);
  });

  test("refuses FEEL the reader cannot read, naming the cell", async () => {
    const bad = RULES.replace("&gt; 0", "[1..5]");
    const r = await renderDmnFile(file("range.dmn", dmn(bad)));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain("R1 input column 2");
  });

  test("refuses a hit policy the reader does not implement", async () => {
    const r = await renderDmnFile(file("collect.dmn", dmn(RULES).replace('hitPolicy="FIRST"', 'hitPolicy="COLLECT"')));
    expect(r.ok).toBe(false);
  });

  test("a file with two decisions needs the block to name one", async () => {
    const two = dmn(RULES, `
  <decision id="Decision_U" name="U"><decisionTable id="DT2"><input id="X"><inputExpression id="XE"><text>x</text></inputExpression></input><output id="XO" name="y"/><rule id="U1"><inputEntry id="u"><text>-</text></inputEntry><outputEntry id="v"><text>1</text></outputEntry></rule></decisionTable></decision>`);
    const p = file("two.dmn", two);
    expect((await renderDmnFile(p)).ok).toBe(false);
    const named = await renderDmnFile(p, "Decision_U");
    expect(named.ok && named.decisionId).toBe("Decision_U");
  });
});

describe("reader-facing text", () => {
  test("a header's trailing citation becomes linked marks", async () => {
    const xml = dmn(RULES).replace('label="Light"', 'label="Light (fr:A, fr:B)"');
    const refs = new Map([
      ["fr:A", { title: "Requirement A", href: "#fr:A" }],
      ["fr:B", { title: "Requirement B", href: "#fr:B" }],
    ]);
    const r = await renderDmnFile(file("cite.dmn", xml), undefined, { refs });
    expect(r.ok && r.html).toContain(
      '<span title="light">Light</span><sup><a class="fa-dmn-ref" href="#fr:A" title="Requirement A">\u2197</a><a class="fa-dmn-ref" href="#fr:B" title="Requirement B">\u2197</a></sup>',
    );
  });
  test("a block label becomes a link reading as the block's title; an unknown one stays", () => {
    const refs = new Map([["freq:FR-ID-01", { title: "Unique identifier", href: "#freq:FR-ID-01" }]]);
    expect(linkRefs("Check (freq:FR-ID-01, freq:FR-XX-09, Section 7.1)", refs)).toBe(
      'Check (<a href="#freq:FR-ID-01" title="freq:FR-ID-01">Unique identifier</a>, freq:FR-XX-09, Section 7.1)',
    );
  });
  test("cells read as words", () => {
    expect(plainCell('"a", "b"')).toBe(
      '<span class="fa-dmn-chip fa-dmn-chip-input">a</span> <span class="fa-dmn-or">or</span> <span class="fa-dmn-chip fa-dmn-chip-input">b</span>',
    );
    expect(plainCell('not("red")')).toBe('<span class="fa-dmn-not">not</span> <span class="fa-dmn-chip fa-dmn-chip-input">red</span>');
    expect(plainCell(" - ")).toBe('<span class="fa-dmn-any">any</span>');
    expect(plainCell('"go"', "output")).toMatch(/^<span class="fa-dmn-chip fa-dmn-chip-output fa-dmn-hue-\d+">go<\/span>$/);
  });
});

describe("placing the table in the block", () => {
  test("at the marker line, else after the body", () => {
    expect(placeDmnTable(`Before.\n\n${DMN_TABLE_MARKER}\n\nAfter.`, "<div>T</div>")).toBe("Before.\n\n<div>T</div>\n\nAfter.");
    expect(placeDmnTable("Only prose.", "<div>T</div>")).toBe("Only prose.\n\n<div>T</div>");
  });

  test("renderBlockMarkdown puts it in the block body", () => {
    const md = renderBlockMarkdown({
      block: { kind: "decision-table", label: "dt:x", title: "X" } as unknown as Block,
      mdContent: `**Purpose.** Decide.\n\n${DMN_TABLE_MARKER}\n\n*Notes.*`,
      dmnTable: "<div>T</div>",
    });
    expect(md).toContain("**Purpose.** Decide.\n\n<div>T</div>\n\n*Notes.*");
    expect(md).not.toContain(DMN_TABLE_MARKER);
  });
});
