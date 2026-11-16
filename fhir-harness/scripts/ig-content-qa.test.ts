import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  pageItems,
  CONTENT_QA_SIDECAR,
  INJECTION_RULES,
  collectItems,
  contentDigest,
  contentGate,
  decoded,
  gateCheckout,
  makeSidecar,
  NOT_APPLICABLE_EXIT,
  notAnIgCheckout,
  readSidecar,
  resourceItems,
  runGate,
  scanText,
  scannedHits,
  sidecarProblems,
  trustedSvgHits,
  withoutTrustedSvgs,
  withoutTrustedScripts,
} from "./ig-content-qa.ts";

const rules = (t: string) => scanText(t).map((h) => h.rule);

/** A narrative of the shape the Publisher generates: no hit. */
const PUBLISHER_DIV =
  '<div xmlns="http://www.w3.org/1999/xhtml"><p class="res-header-id"><b>Generated Narrative: ValueSet example</b></p><a name="example"> </a><table class="grid"><tr><td colspan="2" style="background-color: #f0f0f0">Code</td></tr></table><ul><li>Include codes from <a href="CodeSystem-x.html"><code>http://example.org/cs</code></a></li></ul></div>';

describe("scanText", () => {
  test("a Publisher narrative and plain prose are clean", () => {
    expect(rules(PUBLISHER_DIV)).toEqual([]);
    expect(rules("When age < 5 and onset = birth, see [the guide](https://example.org/a?b=c). JavaScript: a language.")).toEqual([]);
    expect(rules("The expression is evaluated in FHIRPath")).toEqual([]);
  });

  test("each of the issue's flags is caught", () => {
    expect(rules("<div><script>alert(1)</script></div>")).toContain("script-tag");
    expect(rules('<iframe src="x">')).toContain("iframe-tag");
    expect(rules("<object data=x>")).toContain("object-tag");
    expect(rules("<embed src=x>")).toContain("embed-tag");
    expect(rules('<form action="https://evil">')).toContain("form-tag");
    expect(rules('<base href="https://evil/">')).toContain("base-tag");
    expect(rules('<meta http-equiv="refresh" content="0;url=https://evil">')).toContain("meta-http-equiv");
    expect(rules('<img src=x onerror="alert(1)">')).toContain("event-handler");
    expect(rules("<svg/onload=alert(1)>")).toContain("event-handler");
    expect(rules('<a href="javascript:alert(1)">x</a>')).toContain("script-url");
    expect(rules("[click](javascript:alert(1))")).toContain("script-url");
    expect(rules("<a href='vbscript:msgbox'>")).toContain("script-url");
    expect(rules('<a href="data:text/html;base64,PHNjcmlwdD4=">')).toContain("data-html-url");
    expect(rules('<iframe srcdoc="<p>">')).toContain("srcdoc");
    expect(rules("<style>p { width: expression(alert(1)) }</style>")).toContain("css-expression");
    expect(rules('<style>p { background: url("javascript:alert(1)") }</style>')).toContain("script-url");
    expect(rules("access‮gnp.exe")).toContain("bidi-control");
  });

  test("character references and a tab inside the scheme do not hide a URL", () => {
    expect(decoded("&#106;ava&#x09;script&colon;")).toBe("javascript:");
    expect(rules('<a href="&#106;avascript:alert(1)">')).toContain("script-url");
    expect(rules('<a href="java&#x09;script:alert(1)">')).toContain("script-url");
    expect(rules("&lt;script&gt;alert(1)&lt;/script&gt;")).toContain("script-tag");
    expect(rules('<a href="&amp;#106;avascript:x">')).toContain("script-url");
  });
});

describe("resourceItems", () => {
  test("the narrative and the markdown fields at any depth, contained resources included", () => {
    const items = resourceItems({
      resourceType: "StructureDefinition",
      id: "p",
      text: { status: "generated", div: PUBLISHER_DIV },
      description: "A profile.",
      purpose: "  ",
      title: "not markdown",
      differential: { element: [{ id: "a", definition: "Def A", comment: "C" }, { id: "b", short: "s" }] },
      contained: [{ resourceType: "ValueSet", id: "vs", text: { div: "<div>c</div>" }, description: "inner" }],
      note: [{ text: "an annotation" }],
    });
    expect(items.map((i) => `${i.kind} ${i.where} ${i.field}`)).toEqual([
      "narrative StructureDefinition/p text.div",
      "markdown StructureDefinition/p description",
      "markdown StructureDefinition/p differential.element[0].definition",
      "markdown StructureDefinition/p differential.element[0].comment",
      "narrative StructureDefinition/p contained[0].text.div",
      "markdown StructureDefinition/p contained[0].description",
      "markdown StructureDefinition/p note[0].text",
    ]);
  });
});

describe("contentDigest", () => {
  const a = resourceItems({ resourceType: "X", id: "1", description: "one", purpose: "two" });
  test("order-free, and any change changes it", () => {
    expect(contentDigest(a)).toBe(contentDigest([...a].reverse()));
    expect(contentDigest(a)).not.toBe(contentDigest(resourceItems({ resourceType: "X", id: "1", description: "one!", purpose: "two" })));
    expect(contentDigest(a)).not.toBe(contentDigest(a.slice(1)));
    expect(contentDigest(a)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe("contentGate", () => {
  const items = resourceItems({ resourceType: "X", id: "1", text: { div: PUBLISHER_DIV }, description: "fine" });
  const reviewer = { kind: "agent" as const, name: "claude" };

  test("reviewed and clean passes", () => {
    const v = contentGate({ items, sidecar: makeSidecar({ items, reviewer }) });
    expect(v.ok).toBe(true);
    expect(v.state).toBe("reviewed");
  });

  test("missing and stale refuse, unless a preview accepts them", () => {
    expect(contentGate({ items, sidecar: undefined })).toMatchObject({ ok: false, state: "missing" });
    const old = makeSidecar({ items: items.slice(1), reviewer });
    expect(contentGate({ items, sidecar: old })).toMatchObject({ ok: false, state: "stale" });
    expect(contentGate({ items, sidecar: old, acceptUnreviewed: true })).toMatchObject({ ok: true, accepted: true, state: "stale" });
    expect(contentGate({ items, sidecar: undefined, acceptUnreviewed: true })).toMatchObject({ ok: true, accepted: true, state: "missing" });
  });

  test("an open finding refuses, even on a preview; a cleared one with a reason passes", () => {
    const f = { where: "X/1", field: "description", kind: "prompt-injection", note: "asks an agent to ignore its instructions" };
    const open = makeSidecar({ items, reviewer, findings: [{ ...f, status: "open" }] });
    expect(contentGate({ items, sidecar: open, acceptUnreviewed: true })).toMatchObject({ ok: false, state: "open-findings" });
    const cleared = makeSidecar({ items, reviewer, findings: [{ ...f, status: "cleared", reason: "quotes an attack as an example" }] });
    expect(contentGate({ items, sidecar: cleared })).toMatchObject({ ok: true, state: "reviewed" });
    expect(() => makeSidecar({ items, reviewer, findings: [{ ...f, status: "cleared" }] })).toThrow(/without a reason/);
  });

  test("a pattern hit refuses whatever the review says", () => {
    const bad = resourceItems({ resourceType: "X", id: "1", description: "[x](javascript:alert(1))" });
    const v = contentGate({ items: bad, sidecar: makeSidecar({ items: bad, reviewer }), acceptUnreviewed: true });
    expect(v).toMatchObject({ ok: false, state: "pattern-hits" });
    expect(v.said).toContain("X/1 description");
  });

  test("an unusable review refuses", () => {
    expect(sidecarProblems({ $schema: "other" }).length).toBeGreaterThan(0);
    expect(contentGate({ items, sidecar: { unparsable: "x" } })).toMatchObject({ ok: false, state: "unusable" });
  });
});

describe("a checkout", () => {
  function igWith(description: string): string {
    const ig = mkdtempSync(join(tmpdir(), "ig-content-qa-"));
    mkdirSync(join(ig, "output-ast", "resources"), { recursive: true });
    mkdirSync(join(ig, "input", "pagecontent"), { recursive: true });
    writeFileSync(join(ig, "output-ast", "manifest.json"), JSON.stringify({ $schema: "ig-ast/v1", resources: [{ file: "resources/X-1.json" }] }));
    writeFileSync(join(ig, "output-ast", "resources", "X-1.json"), JSON.stringify({ resourceType: "X", id: "1", description }));
    writeFileSync(join(ig, "input", "pagecontent", "index.md"), "# Home\n");
    writeFileSync(join(ig, "input", "pagecontent", "logo.png"), "png");
    return ig;
  }

  test("collects the AST's texts and the IG's pages; record then gate passes, an edit makes it stale", () => {
    const ig = igWith("fine");
    const ast = join(ig, "output-ast");
    expect(collectItems({ ig, ast }).map((i) => `${i.where} ${i.field}`)).toEqual(["X/1 description", "input/pagecontent/index.md page"]);
    expect(() => runGate({ ig, ast, log: () => {} })).toThrow(/no review/);
    mkdirSync(join(ig, "qa"));
    writeFileSync(join(ig, CONTENT_QA_SIDECAR), JSON.stringify(makeSidecar({ items: collectItems({ ig, ast }), reviewer: { kind: "agent", name: "t" } })));
    const work = join(ig, "work");
    expect(runGate({ ig, ast, work, log: () => {} }).state).toBe("reviewed");
    expect(JSON.parse(readFileSync(join(work, "ig-content-qa-verdict.json"), "utf-8")).ok).toBe(true);
    writeFileSync(join(ig, "input", "pagecontent", "index.md"), "# Home, edited\n");
    expect(() => runGate({ ig, ast, log: () => {} })).toThrow(/stale/);
  });

  test("a review outside the declared read scope is refused, not silently skipped", () => {
    const ig = igWith("fine");
    mkdirSync(join(ig, "qa"));
    writeFileSync(join(ig, CONTENT_QA_SIDECAR), "{}");
    expect(() => readSidecar(ig, { declares: (r) => r !== CONTENT_QA_SIDECAR, reaches: () => true })).toThrow(/contentTypes\.ig\.include/);
  });
});

describe("the browser's copy of the rules", () => {
  test("ast-resource.js holds the same list as the gate", () => {
    const js = readFileSync(join(import.meta.dir, "templates", "ig-pages", "ast-resource.js"), "utf-8");
    const m = /INJECTION_RULES:BEGIN\s*\n\s*var INJECTION_RULES = ([\s\S]*?);\s*\n\s*\/\/ INJECTION_RULES:END/.exec(js);
    expect(m).not.toBeNull();
    expect(JSON.parse(m![1]!)).toEqual(INJECTION_RULES);
  });

  test("ast-resource.js shows a flagged narrative as text and renders a clean one", () => {
    const js = readFileSync(join(import.meta.dir, "templates", "ig-pages", "ast-resource.js"), "utf-8");
    // The loader's own functions, run outside a page: take the IIFE body up to `begin`.
    const body = js.slice(js.indexOf("// INJECTION_RULES:BEGIN"), js.indexOf("  function begin()"));
    const injectionHits = new Function(`${body}; return injectionHits;`)() as (t: string) => string[];
    expect(injectionHits(PUBLISHER_DIV)).toEqual([]);
    expect(injectionHits('<div><img src=x onerror="alert(1)"></div>')).toEqual(["an on* event handler attribute"]);
    expect(injectionHits('<a href="&#106;avascript:x">')).toEqual(["a javascript:/vbscript: URL"]);
  });
});

describe("pageItems: translated page catalogues (fhir-harness#382)", () => {
  test("translations/<locale>/pagecontent/*.po are cleared with the pages", () => {
    const ig = mkdtempSync(join(tmpdir(), "qa-tr-"));
    mkdirSync(join(ig, "input", "pagecontent"), { recursive: true });
    writeFileSync(join(ig, "input", "pagecontent", "index.md"), "Hello.\n");
    mkdirSync(join(ig, "translations", "fr", "pagecontent"), { recursive: true });
    writeFileSync(join(ig, "translations", "fr", "pagecontent", "index.po"), 'msgid "Hello."\nmsgstr "Bonjour."\n');
    writeFileSync(join(ig, "translations", "fr", "pagecontent", "index.pot"), 'msgid "Hello."\nmsgstr ""\n');
    expect(pageItems(ig).map((i) => i.where)).toEqual(["input/pagecontent/index.md", "translations/fr/pagecontent/index.po"]);
    const notDeclared = { declares: (r: string) => !r.startsWith("translations/"), reaches: () => true };
    expect(pageItems(ig, notDeclared).map((i) => i.where)).toEqual(["input/pagecontent/index.md"]);
  });
});

describe("scripts an IG trusts on its own pages (owner, 2026-11-12, Q-TRP-3 and Q-RAIL-2)", () => {
  const trusted = ["demo/widget.js"];
  const page = (text: string) => ({ kind: "page" as const, where: "input/pagecontent/qr.md", field: "page", sha: "x", text });

  test("a bare external script on the list is accepted on a page, with a module or classic type, defer or async", () => {
    for (const tag of [
      '<script type="module" src="demo/widget.js"></script>',
      "<script src='demo/widget.js' defer></script>",
      '<script src="demo/widget.js" type="text/javascript" async>\n</script>',
    ]) {
      expect(withoutTrustedScripts(`# QR\n${tag}\n`, trusted)).toBe("# QR\n\n");
      expect(scannedHits(page(tag), trusted)).toEqual([]);
    }
  });

  test("anything else in a script element is still refused", () => {
    for (const tag of [
      '<script src="other.js"></script>',
      '<script src="demo/widget.js">alert(1)</script>',
      '<script src="demo/widget.js" onload="x()"></script>',
      '<script src="demo/widget.js" src="evil.js"></script>',
      '<script type="text/html" src="demo/widget.js"></script>',
      '<script src="https://evil.example/demo/widget.js"></script>',
      "<script>fetch('x')</script>",
    ])
      expect(scannedHits(page(tag), trusted).map((h) => h.rule)).toContain("script-tag");
  });

  test("a trusted path is never accepted in a narrative or a markdown field, nor with no list", () => {
    const tag = '<script src="demo/widget.js"></script>';
    expect(scannedHits({ ...page(tag), kind: "narrative" }, trusted).map((h) => h.rule)).toContain("script-tag");
    expect(scannedHits({ ...page(tag), kind: "markdown" }, trusted).map((h) => h.rule)).toContain("script-tag");
    expect(scannedHits(page(tag)).map((h) => h.rule)).toContain("script-tag");
  });

  test("the gate takes the list; the review still reads the page as written", () => {
    const items = [page('<script type="module" src="demo/widget.js"></script>')];
    const sidecar = makeSidecar({ items, reviewer: { kind: "agent", name: "t" } });
    expect(contentGate({ items, sidecar })).toMatchObject({ ok: false, state: "pattern-hits" });
    expect(contentGate({ items, sidecar, trustedScripts: trusted })).toMatchObject({ ok: true, state: "reviewed" });
  });

  test("runGate reads the list from the read scope's declaration", () => {
    const ig = mkdtempSync(join(tmpdir(), "ig-content-qa-trusted-"));
    const ast = join(ig, "output-ast");
    mkdirSync(join(ast, "resources"), { recursive: true });
    mkdirSync(join(ig, "input", "pagecontent"), { recursive: true });
    writeFileSync(join(ast, "manifest.json"), JSON.stringify({ $schema: "ig-ast/v1", resources: [] }));
    writeFileSync(join(ig, "input", "pagecontent", "qr.md"), '# QR\n<script type="module" src="demo/widget.js"></script>\n');
    mkdirSync(join(ig, "qa"));
    writeFileSync(join(ig, CONTENT_QA_SIDECAR), JSON.stringify(makeSidecar({ items: collectItems({ ig, ast }), reviewer: { kind: "agent", name: "t" } })));
    const all = { declares: () => true, reaches: () => true };
    expect(() => runGate({ ig, ast, scope: all, log: () => {} })).toThrow(/pattern hit/);
    expect(runGate({ ig, ast, scope: { ...all, section: { trustedScripts: trusted } }, log: () => {} }).state).toBe("reviewed");
  });
});

describe("SVG drawings an IG trusts in <object> on its own pages (owner, 2026-11-12)", () => {
  const trusted = ["GDHCN.ONB.svg", "img/aggregation.svg"];
  const page = (text: string) => ({ kind: "page" as const, where: "input/pagecontent/onb.md", field: "page", sha: "x", text });
  const fallback = '<img src="GDHCN.ONB.svg" alt="x"/>';

  test("a listed same-site SVG object is accepted on a page; its body and closing tag stay", () => {
    for (const tag of [
      '<object data="GDHCN.ONB.svg" type="image/svg+xml" style="width:100%; max-width:1400px;" aria-label="Onboard a Participant (top level)">',
      "<object data='img/aggregation.svg' type='image/svg+xml'>",
      '<object type="image/svg+xml" data="GDHCN.ONB.svg" width="800" height="600" class="diagram" id="onb" role="img" title="ONB">',
    ]) {
      const text = `# ONB\n${tag}${fallback}</object>\n`;
      expect(withoutTrustedSvgs(text, trusted)).toBe(`# ONB\n${fallback}</object>\n`);
      expect(scannedHits(page(text), [], trusted)).toEqual([]);
    }
  });

  test("anything else in an object element is still refused", () => {
    for (const tag of [
      '<object data="other.svg" type="image/svg+xml"></object>',
      '<object data="GDHCN.ONB.svg" type="text/html"></object>',
      '<object data="GDHCN.ONB.svg" onload="x()"></object>',
      '<object data="GDHCN.ONB.svg" data="evil.svg"></object>',
      '<object data="GDHCN.ONB.svg" style="width:expression(alert(1))"></object>',
      '<object data="GDHCN.ONB.svg" codebase="https://evil.example/"></object>',
      '<object data="GDHCN.ONB.svg" hidden></object>',
      '<object data="https://evil.example/GDHCN.ONB.svg"></object>',
      '<object type="image/svg+xml"></object>',
    ])
      expect(scannedHits(page(tag), [], trusted).map((h) => h.rule)).toContain("object-tag");
  });

  test("the body of a trusted object is still scanned", () => {
    const text = '<object data="GDHCN.ONB.svg" type="image/svg+xml"><script>alert(1)</script></object>';
    expect(scannedHits(page(text), [], trusted).map((h) => h.rule)).toEqual(["script-tag"]);
  });

  test("a trusted path is never accepted in a narrative or a markdown field, nor with no list", () => {
    const tag = '<object data="GDHCN.ONB.svg" type="image/svg+xml"></object>';
    expect(scannedHits({ ...page(tag), kind: "narrative" }, [], trusted).map((h) => h.rule)).toContain("object-tag");
    expect(scannedHits({ ...page(tag), kind: "markdown" }, [], trusted).map((h) => h.rule)).toContain("object-tag");
    expect(scannedHits(page(tag)).map((h) => h.rule)).toContain("object-tag");
  });

  test("the gate takes the list, and runGate reads it from the read scope's declaration", () => {
    const items = [page('<object data="GDHCN.ONB.svg" type="image/svg+xml"></object>')];
    const sidecar = makeSidecar({ items, reviewer: { kind: "agent", name: "t" } });
    expect(contentGate({ items, sidecar })).toMatchObject({ ok: false, state: "pattern-hits" });
    expect(contentGate({ items, sidecar, trustedSvgs: trusted })).toMatchObject({ ok: true, state: "reviewed" });
    const ig = mkdtempSync(join(tmpdir(), "ig-content-qa-objects-"));
    const ast = join(ig, "output-ast");
    mkdirSync(join(ast, "resources"), { recursive: true });
    mkdirSync(join(ig, "input", "pagecontent"), { recursive: true });
    writeFileSync(join(ast, "manifest.json"), JSON.stringify({ $schema: "ig-ast/v1", resources: [] }));
    writeFileSync(join(ig, "input", "pagecontent", "onb.md"), '# ONB\n<object data="GDHCN.ONB.svg" type="image/svg+xml"></object>\n');
    mkdirSync(join(ig, "qa"));
    writeFileSync(join(ig, CONTENT_QA_SIDECAR), JSON.stringify(makeSidecar({ items: collectItems({ ig, ast }), reviewer: { kind: "agent", name: "t" } })));
    const all = { declares: () => true, reaches: () => true };
    expect(() => runGate({ ig, ast, scope: all, log: () => {} })).toThrow(/pattern hit/);
    // The listed file is scanned: missing, then clean, then carrying a script.
    expect(() => runGate({ ig, ast, scope: { ...all, section: { trustedSvgs: ["GDHCN.ONB.svg"] } }, log: () => {} })).toThrow(/trusted SVG the gate cannot read/);
    mkdirSync(join(ig, "input", "images"), { recursive: true });
    writeFileSync(join(ig, "input", "images", "GDHCN.ONB.svg"), '<svg xmlns="http://www.w3.org/2000/svg"><a href="onb.html#apply"><rect width="9" height="9"/></a></svg>');
    expect(runGate({ ig, ast, scope: { ...all, section: { trustedSvgs: ["GDHCN.ONB.svg"] } }, log: () => {} }).state).toBe("reviewed");
    writeFileSync(join(ig, "input", "images", "GDHCN.ONB.svg"), '<svg xmlns="http://www.w3.org/2000/svg"><rect onclick="steal()"/></svg>');
    expect(() => runGate({ ig, ast, scope: { ...all, section: { trustedSvgs: ["GDHCN.ONB.svg"] } }, log: () => {} })).toThrow(/input\/images\/GDHCN.ONB.svg svg: an on\* event handler/);
  });

  test("trustedSvgHits scans each listed file for every rule", () => {
    const ig = mkdtempSync(join(tmpdir(), "ig-content-qa-svgs-"));
    mkdirSync(join(ig, "input", "images"), { recursive: true });
    writeFileSync(join(ig, "input", "images", "a.svg"), "<svg><script>alert(1)</script></svg>");
    writeFileSync(join(ig, "input", "images", "b.svg"), '<svg><a href="javascript:alert(1)"><text>x</text></a></svg>');
    writeFileSync(join(ig, "input", "images", "c.svg"), '<svg><a href="page.html#x"><text>ok</text></a></svg>');
    expect(trustedSvgHits(ig, ["a.svg", "b.svg", "c.svg", "gone.svg"]).map((h) => `${h.where}:${h.rule}`)).toEqual([
      "input/images/a.svg:script-tag",
      "input/images/b.svg:script-url",
      "input/images/gone.svg:trusted-svg-unreadable",
    ]);
  });
});

describe("the gate command judges IG checkouts only", () => {
  const empty = () => mkdtempSync(join(tmpdir(), "ig-content-qa-kind-"));

  test("a document folio (no contentTypes.ig, no sushi-config.yaml) is not judged, even with no AST", async () => {
    const folio = empty();
    writeFileSync(join(folio, "index.config.json"), JSON.stringify({ $schema: "folio-index-config/v1", contentTypes: { document: {} } }));
    expect(await notAnIgCheckout(folio)).toMatch(/not an IG checkout/);
    const said: string[] = [];
    expect(await gateCheckout({ ig: folio, ast: join(folio, "output-ast"), log: (s) => said.push(s) })).toBeUndefined();
    expect(said.join("\n")).toMatch(/NOT APPLICABLE.*nothing was judged; this is not a pass/);
  });

  test("the command exits 78 (not applicable) at a non-IG root and at an IG whose run built no AST, never 0; 1 for a named AST that is missing", () => {
    const script = join(import.meta.dir, "ig-content-qa.ts");
    const folio = empty();
    const na = Bun.spawnSync(["bun", "run", script, "gate", "--ig", folio]);
    expect(NOT_APPLICABLE_EXIT).toBe(78);
    expect(na.exitCode).toBe(78);
    expect(na.stdout.toString()).toMatch(/NOT APPLICABLE.*this is not a pass/);
    const ig = empty();
    writeFileSync(join(ig, "sushi-config.yaml"), "id: x\n");
    const noAst = Bun.spawnSync(["bun", "run", script, "gate", "--ig", ig]);
    expect(noAst.exitCode).toBe(78);
    expect(noAst.stdout.toString()).toMatch(/NOT APPLICABLE: no AST at .*this is not a pass/);
    const named = Bun.spawnSync(["bun", "run", script, "gate", "--ig", ig, "--ast", join(ig, "output-ast")]);
    expect(named.exitCode).toBe(1);
    expect(named.stderr.toString()).toMatch(/no AST at/);
  });

  test("an IG declared by contentTypes.ig whose run built no AST is not applicable, not passed", async () => {
    const ig = empty();
    writeFileSync(join(ig, "index.config.json"), JSON.stringify({ contentTypes: { ig: { include: ["sushi-config.yaml", "input/"] } } }));
    expect(await notAnIgCheckout(ig)).toBeUndefined();
    const said: string[] = [];
    expect(await gateCheckout({ ig, ast: join(ig, "output-ast"), log: (s) => said.push(s) })).toBeUndefined();
    expect(said.join("\n")).toMatch(/NOT APPLICABLE: no AST at .*this is not a pass/);
  });

  test("an IG with an AST named explicitly that is missing still fails", async () => {
    const ig = empty();
    writeFileSync(join(ig, "sushi-config.yaml"), "id: x\n");
    await expect(gateCheckout({ ig, ast: join(ig, "output-ast"), astGiven: true, log: () => {} })).rejects.toThrow(/no AST at/);
  });

  test("with no AST, a pattern hit in a page still refuses", async () => {
    const ig = empty();
    writeFileSync(join(ig, "sushi-config.yaml"), "id: x\n");
    mkdirSync(join(ig, "input", "pagecontent"), { recursive: true });
    writeFileSync(join(ig, "input", "pagecontent", "index.md"), '<img src=x onerror="alert(1)">\n');
    await expect(gateCheckout({ ig, ast: join(ig, "output-ast"), log: () => {} })).rejects.toThrow(/pattern hit/);
  });

  test("with no AST, a hit in a trusted SVG still refuses", async () => {
    const ig = empty();
    writeFileSync(join(ig, "index.config.json"), JSON.stringify({ contentTypes: { ig: { include: ["sushi-config.yaml", "input/"], trustedSvgs: ["a.svg"] } } }));
    mkdirSync(join(ig, "input", "images"), { recursive: true });
    writeFileSync(join(ig, "input", "images", "a.svg"), '<svg onload="alert(1)"></svg>');
    await expect(gateCheckout({ ig, ast: join(ig, "output-ast"), log: () => {} })).rejects.toThrow(/pattern hit/);
  });

  test("the publish's runGate still refuses an IG with no AST", () => {
    const ig = empty();
    writeFileSync(join(ig, "sushi-config.yaml"), "id: x\n");
    expect(() => runGate({ ig, ast: join(ig, "output-ast"), log: () => {} })).toThrow(/no AST at/);
  });

  test("an unusable contentTypes.ig is an IG, and is refused rather than passed", async () => {
    const ig = empty();
    writeFileSync(join(ig, "index.config.json"), JSON.stringify({ contentTypes: { ig: { include: [] } } }));
    expect(await notAnIgCheckout(ig)).toBeUndefined();
    await expect(gateCheckout({ ig, ast: join(ig, "output-ast"), log: () => {} })).rejects.toThrow();
  });
});
