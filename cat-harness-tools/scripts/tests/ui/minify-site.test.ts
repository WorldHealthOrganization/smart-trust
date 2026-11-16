/**
 * `minify-site` — the bytes a reader never sees go, and nothing else does.
 *
 * The script itself is `ci-only` (there is no `_site` in a checkout), so this
 * file is what covers its logic here — the same split `strip-preview-seo.ts`
 * and `set-html-lang.ts` use. The cases are chosen from what the published
 * corpus actually holds: 150 inline `<svg>`s a page, Rouge-highlighted code
 * samples, a nav of 461 links, and `<meta>` attributes carrying JSON and prose.
 *
 * The two defects these assertions exist for, named so they are not
 * re-introduced as "simplifications":
 *
 * 1. **`>\s+<` → `><` over a whole document corrupts code samples.** A
 *    `<pre>` block's whitespace is its content.
 * 2. **`>\s+<` → `><` deletes WORD BOUNDARIES.** `<a>one</a> <a>two</a>`
 *    renders "one two"; collapsing the run to nothing renders "onetwo". The
 *    whole reason this is a tokenizer is to tell that case from `</li>\n<li>`.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isOwnAsset,
  keepComment,
  minifyCss,
  minifyHtml,
  minifyJs,
  runMinifyAssets,
  runMinifySite,
  strictness,
  tokenize,
} from "../../minify-site.ts";

const min = (s: string) => minifyHtml(s).html;

describe("verbatim regions are copied byte for byte", () => {
  test("a <pre> code sample keeps every newline and every indent", () => {
    const pre = '<pre class="highlight"><code>if (a) {\n    b();\n}\n</code></pre>';
    const page = `<div>\n  ${pre}\n</div>`;
    expect(min(page)).toContain(pre);
  });

  test("an inline <code> span keeps its interior spacing", () => {
    // `white-space: normal` would collapse this on screen, but a reader
    // COPIES a code span, and the corpus documents path templates in them.
    const out = min("<p>Run <code>a   b</code> now</p>");
    expect(out).toContain("<code>a   b</code>");
  });

  test("a <!-- inside a script string is not a comment", () => {
    const page = `<script>var s = "<!-- not a comment -->";\nvar t = 1;</script>`;
    expect(min(page)).toBe(page);
  });

  test("a <style> block's declarations are untouched", () => {
    const page = "<head>\n<style>\nbody { color: red }\n</style>\n</head>";
    expect(min(page)).toContain("<style>\nbody { color: red }\n</style>");
  });

  test("<textarea> content survives", () => {
    const page = "<form>\n<textarea>\n  keep\n  me\n</textarea>\n</form>";
    expect(min(page)).toContain("<textarea>\n  keep\n  me\n</textarea>");
  });

  test("an unclosed verbatim tag is treated as a plain tag rather than swallowing the page", () => {
    // Malformed, but a pass over a built tree must not lose content over it.
    const out = min("<div>\n<pre>\n<span>x</span>\n</div>");
    expect(out).toContain("<span>x</span>");
  });
});

describe("whitespace: dropped where it cannot render, one space where it can", () => {
  test("between block elements it goes", () => {
    expect(min("<ul>\n  <li>a</li>\n  <li>b</li>\n</ul>")).toBe("<ul><li>a</li><li>b</li></ul>");
  });

  test("between two inline elements it becomes exactly one space", () => {
    expect(min("<p><a>one</a>\n  <a>two</a></p>")).toBe("<p><a>one</a> <a>two</a></p>");
  });

  test("…which is the word boundary a naive `>\\s+<` would delete", () => {
    expect(min("<span>one</span>\n<span>two</span>")).not.toBe("<span>one</span><span>two</span>");
  });

  test("whitespace touching TEXT is part of the text and is left alone", () => {
    const page = "<p>Cats <em>and</em>\n  dogs</p>";
    expect(min(page)).toBe(page);
  });

  test("a single space between inline elements is already minimal and is not rewritten", () => {
    const page = "<p><a>a</a> <a>b</a></p>";
    expect(minifyHtml(page).counts.squeezed).toBe(0);
    expect(min(page)).toBe(page);
  });

  test("inside an <svg> it goes, because it is not text there", () => {
    expect(min('<svg>\n  <path d="M0 0"/>\n  <g>\n  </g>\n</svg>')).toBe('<svg><path d="M0 0"/><g></g></svg>');
  });

  test("…but not around an svg <text> element", () => {
    const out = min("<svg><text>a</text>\n<text>b</text></svg>");
    expect(out).toBe("<svg><text>a</text> <text>b</text></svg>");
  });

  test("whitespace after a closing </svg> is between two INLINE boxes", () => {
    expect(min("<p><svg></svg>\n<svg></svg></p>")).toBe("<p><svg></svg> <svg></svg></p>");
  });

  test("an unknown element keeps its space — the safe default", () => {
    expect(min("<p><fa-chip>a</fa-chip>\n<fa-chip>b</fa-chip></p>")).toBe("<p><fa-chip>a</fa-chip> <fa-chip>b</fa-chip></p>");
  });
});

describe("tag scanning survives the attributes this corpus actually ships", () => {
  test("a `>` inside a quoted attribute does not end the tag", () => {
    const page = '<head>\n<meta name="x" content="a > b">\n<div>y</div>\n</head>';
    const toks = tokenize(page).filter((t) => t.kind === "tag");
    expect(toks.map((t) => t.text)).toContain('<meta name="x" content="a > b">');
    expect(min(page)).toBe('<head><meta name="x" content="a > b"><div>y</div></head>');
  });

  test("an HTML-escaped JSON blob in a meta content attribute is preserved", () => {
    const meta = `<meta name="fa-tiles" content="[{&quot;id&quot;:&quot;a&quot;,&quot;n&quot;:1}]">`;
    expect(min(`<head>\n${meta}\n</head>`)).toContain(meta);
  });

  test("the doctype counts as a block boundary", () => {
    expect(min("<!doctype html>\n<html>\n<head></head>\n</html>")).toBe("<!doctype html><html><head></head></html>");
  });
});

describe("comments: three classes stay, and the reason is recorded", () => {
  test("maintainer prose goes", () => {
    const out = minifyHtml("<head>\n<!-- Why this meta and not a div: … -->\n<meta>\n</head>");
    expect(out.html).toBe("<head><meta></head>");
    expect(out.counts.comments).toBe(1);
  });

  test("a licence notice stays — MIT requires it to travel with the copy", () => {
    const notice = "<!-- Feather. MIT License: https://github.com/feathericons/feather/blob/master/LICENSE -->";
    expect(keepComment(notice)).toBe("licence");
    expect(min(`<head>\n${notice}\n<meta>\n</head>`)).toContain(notice);
  });

  test("a conditional comment stays — it is markup, not prose", () => {
    const cc = "<!--[if lt IE 9]><script src=\"x.js\"></script><![endif]-->";
    expect(keepComment(cc)).toBe("conditional");
    expect(min(`<head>${cc}</head>`)).toContain(cc);
  });

  test("the downlevel-revealed pair both stay", () => {
    expect(keepComment("<!--[if !IE]>-->")).toBe("conditional");
    expect(keepComment("<!--<![endif]-->")).toBe("conditional");
  });

  test("a region marker stays — it exists to be found by a tool", () => {
    for (const m of [
      "<!-- fa-first-paint:begin -->",
      "<!-- fa-first-paint:end -->",
      "<!-- kg:subgraph:begin -->",
      "<!-- detail -->",
    ]) {
      expect(keepComment(m)).toBe("marker");
      expect(min(`<div>\n${m}\n</div>`)).toContain(m);
    }
  });

  test("a GENERATED-by banner is prose and goes", () => {
    const banner = "<!-- GENERATED by cat-harness/scripts/gen-navbar-include.ts. Do not hand-edit: `bun run cat navbar:include` rewrites it. -->";
    expect(keepComment(banner)).toBeNull();
    expect(min(`<div>\n${banner}\n<span>x</span></div>`)).not.toContain("GENERATED by");
  });

  test("consecutive dropped comments leave ONE whitespace decision, not three", () => {
    expect(min("<head>\n  <!-- a -->\n  <!-- b -->\n  <meta>\n</head>")).toBe("<head><meta></head>");
  });

  test("an unterminated comment is consumed rather than reopening the document", () => {
    expect(min("<div><!-- never closed")).toBe("<div>");
  });
});

describe("idempotent — a second run writes nothing", () => {
  const FIXTURES = [
    '<!doctype html><html>\n<head>\n<!-- prose -->\n<meta charset="UTF-8">\n<style>body{}</style>\n</head>\n<body>\n<nav>\n<ul>\n<li><a>one</a>\n<a>two</a></li>\n</ul>\n</nav>\n<pre><code>a\n  b\n</code></pre>\n<svg>\n<use href="#x"/>\n</svg>\n</body>\n</html>',
    "<div>\n<!-- kg:subgraph:begin -->\n<p>Cats <em>and</em>\n dogs</p>\n<!-- kg:subgraph:end -->\n</div>",
    "<p><a>a</a> <a>b</a></p>",
  ];
  test.each(FIXTURES.map((f, i) => [i, f] as const))("fixture %d", (_i, f) => {
    const once = min(f);
    expect(min(once)).toBe(once);
    // And the second pass reports nothing to do.
    const second = minifyHtml(once).counts;
    expect(second.comments).toBe(0);
    expect(second.dropped).toBe(0);
    expect(second.squeezed).toBe(0);
  });
});

describe("the runner's three states", () => {
  function site(pages: Record<string, string>): string {
    const d = mkdtempSync(join(tmpdir(), "minify-site-"));
    for (const [rel, text] of Object.entries(pages)) {
      const at = join(d, rel);
      mkdirSync(join(at, ".."), { recursive: true });
      writeFileSync(at, text);
    }
    return d;
  }

  test("an unreadable site directory is exit 2, never a clean pass", () => {
    const r = runMinifySite({ site: join(tmpdir(), "minify-site-does-not-exist") });
    expect(r.exitCode).toBe(2);
    expect(r.text).toContain("could not read");
    expect(r.bytesBefore).toBe(0);
  });

  test("--check reports and writes nothing", () => {
    const page = "<head>\n<!-- prose -->\n<meta>\n</head>";
    const d = site({ "a.html": page, "deep/b.html": page });
    const r = runMinifySite({ site: d, check: true });
    expect(r.exitCode).toBe(0);
    expect(r.filesSeen).toBe(2);
    expect(r.filesChanged).toBe(2);
    expect(r.bytesAfter).toBeLessThan(r.bytesBefore);
    expect(r.text).toContain("would save");
    expect(readFileSync(join(d, "a.html"), "utf-8")).toBe(page);
  });

  test("a write pass changes the files and a re-run changes nothing", () => {
    const d = site({ "a.html": "<head>\n<!-- prose -->\n<meta>\n</head>", "keep.txt": "<!-- not a page -->" });
    const first = runMinifySite({ site: d });
    expect(first.filesChanged).toBe(1);
    expect(first.filesSeen).toBe(1); // `.txt` is not a page
    expect(readFileSync(join(d, "a.html"), "utf-8")).toBe("<head><meta></head>");
    const again = runMinifySite({ site: d });
    expect(again.filesChanged).toBe(0);
    expect(again.bytesBefore).toBe(again.bytesAfter);
  });
});

describe("shared scripts and stylesheets", () => {
  const js = (s: string) => {
    const r = minifyJs(s);
    if (!("text" in r)) throw new Error(`skipped: ${r.skip}`);
    return r.text;
  };
  const IIFE = `/*\n * The chrome's shape: one commented IIFE.\n */\n(function () {\n  "use strict";\n  // a comment\n  var x = 1;\n  window.faX = function () { return this === undefined; };\n})();\n`;

  test("comments and whitespace go, and the script still runs the same", () => {
    const out = js(IIFE);
    expect(out.length).toBeLessThan(IIFE.length);
    expect(out).not.toContain("a comment");
    const w: Record<string, unknown> = {};
    new Function("window", out)(w);
    const bare = w.faX as () => boolean;
    expect(bare()).toBe(true); // still strict: a bare call has `this` undefined
  });

  test("a directive opening the whole-script IIFE comes back at the top", () => {
    expect(strictness(IIFE)).toBe("whole");
    expect(js(IIFE)).toStartWith('"use strict";\n(function(){');
  });

  test("a directive anywhere else leaves the file as it was, never silently sloppy", () => {
    const nested = "var a = 1;\nfunction f() {\n  \"use strict\";\n  return this;\n}\n";
    expect(strictness(nested)).toBe("other");
    expect("skip" in minifyJs(nested)).toBe(true);
  });

  test("top-level names are kept: a classic script's globals are other scripts' API", () => {
    const out = js("function faShared(a) { return a + 1; }\nvar faCount = 2;\n");
    expect(out).toContain("function faShared(");
    expect(out).toContain("faCount=2");
  });

  test("a licence comment travels with the copy", () => {
    const out = js("/** @license MIT, Example Co. */\nvar a = 1; // gone\n");
    expect(out).toContain("@license MIT, Example Co.");
    expect(out).not.toContain("gone");
  });

  test("a script that does not parse is reported and left alone", () => {
    expect("skip" in minifyJs("---\nlayout: null\n---\nvar a = 1;")).toBe(true);
  });

  test("minifying twice is minifying once", () => {
    const once = js(IIFE);
    expect(js(once)).toBe(once);
  });

  test("CSS is minified, url() and @import untouched in meaning", async () => {
    const src = '/* prose */\n@import url("other.css");\n.a {\n  background: url("../img/x.webp") no-repeat;\n  color: red;\n}\n@media print {\n  .b { display: none }\n}\n';
    const r = await minifyCss(src);
    if (!("text" in r)) throw new Error(r.skip);
    expect(r.text.length).toBeLessThan(src.length);
    expect(r.text).not.toContain("prose");
    expect(r.text).toContain("url(../img/x.webp)");
    expect(r.text).toContain('@import "other.css"');
    expect(r.text).toContain("@media print");
    const again = await minifyCss(r.text);
    expect("text" in again && again.text).toBe(r.text);
  });

  test("vendored, already-minified and non-asset files are not ours to rewrite", () => {
    expect(isOwnAsset("assets/js/docs-ui.js")).toBe(true);
    expect(isOwnAsset("assets/css/docs-ui.css")).toBe(true);
    expect(isOwnAsset("assets/js/vendor/qrcode.js")).toBe(false);
    expect(isOwnAsset("assets/js/vendor/wasm-graphviz/index.js")).toBe(false);
    expect(isOwnAsset("assets/katex.min.css")).toBe(false);
    expect(isOwnAsset("assets/data.json")).toBe(false);
  });

  test("the runner writes once, reports bytes, and a re-run changes nothing", async () => {
    const d = mkdtempSync(join(tmpdir(), "minify-assets-"));
    mkdirSync(join(d, "assets", "js", "vendor"), { recursive: true });
    mkdirSync(join(d, "assets", "css"), { recursive: true });
    writeFileSync(join(d, "assets", "js", "a.js"), IIFE);
    writeFileSync(join(d, "assets", "js", "vendor", "v.js"), "// vendored\nvar v = 1;\n");
    writeFileSync(join(d, "assets", "css", "a.css"), "/* x */\n.a {\n  color: red;\n}\n");
    const check = await runMinifyAssets({ site: d, check: true });
    expect(check.filesChanged).toBe(2);
    expect(readFileSync(join(d, "assets", "js", "a.js"), "utf-8")).toBe(IIFE);
    const first = await runMinifyAssets({ site: d });
    expect(first.exitCode).toBe(0);
    expect(first.filesSeen).toBe(2);
    expect(first.bytesAfter).toBeLessThan(first.bytesBefore);
    expect(first.gzipAfter).toBeLessThanOrEqual(first.gzipBefore);
    expect(readFileSync(join(d, "assets", "js", "vendor", "v.js"), "utf-8")).toContain("// vendored");
    const again = await runMinifyAssets({ site: d });
    expect(again.filesChanged).toBe(0);
  });

  test("a print handler survives: minifying changes what a script is, not what it does on print", () => {
    // Owner, 2026-11-14: "Make sure printing loads all of the content before it
    // renders the PDF on the browser". This pass defers nothing; what it must
    // not do is lose a `beforeprint` handler (docs-ui.js opens closed
    // disclosures there) or the strictness it runs under.
    const src = `(function () {\n  "use strict";\n  // open everything for the printer\n  window.addEventListener("beforeprint", function () {\n    document.details.open = true;\n  });\n})();\n`;
    const handlers: Record<string, () => void> = {};
    const doc = { details: { open: false } };
    new Function("window", "document", js(src))({ addEventListener: (t: string, f: () => void) => { handlers[t] = f; } }, doc);
    handlers.beforeprint!();
    expect(doc.details.open).toBe(true);
  });

  test("an unreadable site directory is exit 2", async () => {
    expect((await runMinifyAssets({ site: join(tmpdir(), "minify-assets-does-not-exist") })).exitCode).toBe(2);
  });
});
