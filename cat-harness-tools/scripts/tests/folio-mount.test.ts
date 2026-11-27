import { describe, expect, test } from "bun:test";

import { MARKER, fragment, hasMount, siteRootOf } from "../folio-mount.ts";
import { bodyInsertionPoint } from "../staging-banner.ts";
import { commentGuard, commentRanges } from "../html-comments.ts";

/**
 * The folio mount's two halves agree, and the comment scanner is ONE
 * scanner. Bean `jpjt`.
 *
 * The browser half of this is `test/content/folio-mount.e2e.ts`, which drives a real
 * generated who-iris page. This file pins the things a browser test cannot
 * see cheaply: that the derivation and the shipped string are the same
 * expression, and that `ur84` cannot come back through a second copy of the
 * comment scan.
 */

/** who-iris's own route pattern, as `gen-iris-pages.ts` declares it. */
const WHO_IRIS = /^(.*?)(?:docs\/)?who-iris\//;

describe("the site root is derived, not baked", () => {
  // The four bases this site is actually served under. An absolute URL in a
  // generated page is correct on exactly one of them, which is why the root
  // is computed in the browser at all.
  const cases: Array<[string, string | null]> = [
    ["/who-iris/community-list.html", "/"],
    ["/docs/who-iris/ingestion-notes.html", "/"],
    ["/folio-assistant/who-iris/item-x.html", "/folio-assistant/"],
    ["/folio-assistant/docs/who-iris/catalogue.html", "/folio-assistant/"],
    ["/STAGING/claude-example/who-iris/item-x.html", "/STAGING/claude-example/"],
    ["/STAGING/claude-example/docs/who-iris/index.html", "/STAGING/claude-example/"],
  ];

  test.each(cases)("%s -> %s", (path, want) => {
    expect(siteRootOf(path, WHO_IRIS)).toBe(want);
  });

  test("a path outside the instance returns null rather than a guess", () => {
    // A real state. A client that guessed would request two assets that 404
    // on every page of a layer that mis-declared its route — which reads
    // as a broken site rather than as a wrong configuration.
    expect(siteRootOf("/somewhere/else/page.html", WHO_IRIS)).toBeNull();
  });
});

describe("the shipped string and the tested function are ONE expression", () => {
  test("the fragment carries the pattern's own source", () => {
    // `staging-banner` keeps `previewRootOf` and its inlined regex as two
    // things a test must hold together. Here there is one `RegExp`, passed
    // in by the caller and serialised — so this asserts the serialisation
    // rather than an agreement between two authored copies.
    expect(fragment(WHO_IRIS)).toContain(JSON.stringify(WHO_IRIS.source));
  });

  test("and re-parsing that source gives back the same derivation", () => {
    const shipped = fragment(WHO_IRIS);
    const m = shipped.match(/new RegExp\((".*?")\)/);
    expect(m).not.toBeNull();
    const reparsed = new RegExp(JSON.parse(m![1]!) as string);
    for (const path of ["/who-iris/a.html", "/docs/who-iris/b.html", "/x/y.html"]) {
      expect(siteRootOf(path, reparsed)).toBe(siteRootOf(path, WHO_IRIS));
    }
  });

  test("the fragment is CONSTANT for a pattern — no per-page fact", () => {
    // `g196`'s property: a fragment that varies per page makes every rebuild
    // a new blob in `gh-pages`, which is how a preview tree reached 37.5 MB.
    expect(fragment(WHO_IRIS)).toBe(fragment(WHO_IRIS));
  });
});

describe("`ur84` cannot come back through a second comment scanner", () => {
  test("there is one scanner, and `bodyInsertionPoint` uses it", () => {
    // The failure: `head_custom.html`'s prose comment contains the words
    // `<body>` as an example, so a non-global `replace` spent its one
    // substitution there — on 323 of 670 staged pages.
    const html = "<!-- a stray <div> is hoisted into <body> by the browser --><body class=x>hi";
    const at = bodyInsertionPoint(html);
    expect(at).toBeGreaterThan(0);
    expect(html.slice(at)).toBe("hi");
  });

  test("a marker inside a comment is NOT a mount", () => {
    const html = `<!doctype html><html><body><!-- <script ${MARKER}></script> --></body></html>`;
    expect(html).toContain(MARKER);
    expect(hasMount(html)).toBe(false);
  });

  test("and outside one, it is", () => {
    const html = `<!doctype html><html><body>${fragment(WHO_IRIS)}</body></html>`;
    expect(hasMount(html)).toBe(true);
  });

  test("the guard is built once and answers many positions", () => {
    // Re-scanning per position turns an O(n) check into O(n²) over a
    // 670-page tree, which is the reason this is a closure.
    const html = "a<!--xx-->b<!--yy-->c";
    expect(commentRanges(html)).toHaveLength(2);
    const guard = commentGuard(html);
    //         0123456789...
    //         a<!--xx-->b<!--yy-->c
    // `<!--xx-->` is nine characters, so it occupies [1, 10) and 'b' is at 10.
    expect(guard(0)).toBe(false); // 'a'
    expect(guard(3)).toBe(true); // inside the first comment
    expect(guard(9)).toBe(true); // still inside it — the closing '>'
    expect(guard(10)).toBe(false); // 'b'
    expect(guard(12)).toBe(true); // inside the second
    expect(guard(20)).toBe(false); // 'c'
  });
});
