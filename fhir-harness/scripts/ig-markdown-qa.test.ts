import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { leftoverMarkup, markdownQaMarkdown, pageMarkdownDrawer, scanDir } from "./ig-markdown-qa.ts";

const draw = pageMarkdownDrawer();
/** A renderer that, like the one before fhir-harness#374, draws only links. */
const linksOnly = pageMarkdownDrawer(`function breaks(t){return String(t||"");}
function description(text){var f=document.createDocumentFragment();text.split(/\\n\\s*\\n/).forEach(function(p){var e=el("p");e.append(p);f.append(e);});return f;}
function stats(){}`);

describe("ig-markdown-qa", () => {
  test("drawnMarkdownLeavesNothing", () => {
    const md = "**Persona**: a *shared* `phone`.\n\n**In**:\n\n- [J4](scenarios.html#j4): one\n- two\n\n1. a\n2. b";
    expect(leftoverMarkup(md, draw)).toEqual([]);
    expect(leftoverMarkup("Uses `**not bold**` in code", draw)).toEqual([]);
    expect(leftoverMarkup("Every element (TD.<data set>.DE<nn>).", draw)).toEqual([]);
  });

  test("undrawnMarkupIsNamed", () => {
    expect(leftoverMarkup("**Persona**: x\n\n- one", linksOnly).sort()).toEqual(["bold", "list marker"]);
    expect(leftoverMarkup("## Heading\n\n| a | b |\n|---|---|\n| 1 | 2 |", draw).sort()).toEqual(["heading", "table"]);
    expect(leftoverMarkup("see <b>this</b>", draw)).toEqual(["HTML tag"]);
    expect(leftoverMarkup("- ![Bo](data:image/svg+xml;base64,AA==) [Bo](p.html)", draw)).toEqual([]);
    expect(leftoverMarkup("see ![x](y.png)", linksOnly)).toContain("image");
  });

  test("scanAstAndReport", () => {
    const d = mkdtempSync(join(tmpdir(), "md-qa-"));
    mkdirSync(join(d, "resources"), { recursive: true });
    writeFileSync(join(d, "resources", "a.json"), JSON.stringify({ resourceType: "Basic", id: "Phone", extension: [{ url: "x.description", valueMarkdown: "## Persona | pipe" }], text: { div: "<b>narrative</b>" } }));
    writeFileSync(join(d, "resources", "b.json"), JSON.stringify({ resourceType: "ValueSet", id: "ok", description: "**fine**" }));
    writeFileSync(join(d, "manifest.json"), JSON.stringify({ resources: [] }));
    const r = scanDir(d, draw);
    expect(r.scanned).toBe(2);
    expect(r.findings).toEqual([{ resource: "Basic/Phone", path: "extension[0].valueMarkdown", markup: ["heading"], excerpt: "## Persona | pipe" }]);
    const md = markdownQaMarkdown(r).join("\n");
    expect(md).toContain("### Markdown rendering");
    expect(md).toContain("2 resource(s) scanned");
    expect(md).toContain("| `Basic/Phone` | `extension[0].valueMarkdown` | heading | ## Persona \\| pipe |");
    expect(markdownQaMarkdown({ scanned: 3, findings: [] }).join("\n")).toContain("**Findings:** none.");
    const slash = markdownQaMarkdown({ scanned: 1, findings: [{ resource: "X/y", path: "description", markup: ["heading"], excerpt: "## a\\" }] }).join("\n");
    expect(slash).toContain("| ## a\\\\ |");
  });
});
