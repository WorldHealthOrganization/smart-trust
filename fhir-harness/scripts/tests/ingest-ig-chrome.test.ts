import { describe, expect, test } from "bun:test";

import { declarationsIn, malformation, overlay, rootTokens, ruleFor, type RawLayer } from "../ingest-ig-chrome";
import type { IgChromeLayer } from "../../schemas/ig-chrome";

function layer(pkg: string, css: string): RawLayer {
  const meta: IgChromeLayer = {
    package: pkg,
    version: "1.0.0",
    of: `https://github.com/example/${pkg}`,
    ref: "0000000000000000000000000000000000000000",
    path: "content/assets/css/x.css",
    readAt: "2026-09-23",
  };
  return { layer: meta, css };
}

describe("rootTokens", () => {
  test("readsEveryRootBlock", () => {
    // `who.css` really does this — a WHO block and a "generic settings" block.
    const css = `:root { --a: 1; }\n.x { color: red }\n:root { --b: 2; }`;
    expect(rootTokens(css).map((t) => t.name)).toEqual(["--a", "--b"]);
  });

  test("commentSemicolonNoEnd", () => {
    const css = `:root { --a: 1; /* note; with a semicolon */ --b: 2; }`;
    expect(rootTokens(css)).toEqual([
      { name: "--a", value: "1" },
      { name: "--b", value: "2" },
    ]);
  });
});

describe("ruleFor", () => {
  test("absentSelectorUndefined", () => {
    // This is not a nicety. `who.css` styles no `#publish-box`, and only an
    // absent/present distinction can attribute the rule to the right layer.
    expect(ruleFor(`#ig-status { color: red; }`, "#publish-box")).toBeUndefined();
  });

  test("noSuffixSelectorMatch", () => {
    // `#ig-status` must not be answered by `#not-ig-status`.
    expect(ruleFor(`#not-ig-status { color: red; }`, "#ig-status")).toBeUndefined();
  });

  test("readsCompoundSelector", () => {
    const decls = ruleFor(`#ig-status.ig-status-draft { background-image: url("x"); }`, "#ig-status.ig-status-draft");
    expect(decls).toEqual([{ property: "background-image", value: 'url("x")' }]);
  });
});

describe("overlay", () => {
  test("lastLayerWinsShadowRecorded", () => {
    const { tokens } = overlay([
      layer("fhir.base.template", `:root { --navbar-bg-color: #7b1fad; }`),
      layer("who.template.root", `:root { --navbar-bg-color: #00477d; }`),
    ]);
    expect(tokens).toEqual([
      {
        name: "--navbar-bg-color",
        value: "#00477d",
        from: "who.template.root",
        overrides: [{ package: "fhir.base.template", value: "#7b1fad" }],
      },
    ]);
  });

  test("oneLayerEmptyOverrides", () => {
    // Nobody at WHO ever touched the publish box. An empty `overrides` is what
    // says so, and it is why the field is required rather than optional.
    const { tokens } = overlay([
      layer("fhir.base.template", `:root { --publish-box-bg-color: yellow; }`),
      layer("who.template.root", `:root { --navbar-bg-color: #00477d; }`),
    ]);
    const box = tokens.find((t) => t.name === "--publish-box-bg-color")!;
    expect(box.from).toBe("fhir.base.template");
    expect(box.overrides).toEqual([]);
  });

  test("identicalValueNotOverride", () => {
    // Otherwise `overrides: []` would stop meaning "one layer decided this".
    const { tokens } = overlay([
      layer("base", `:root { --x: #fff; }`),
      layer("top", `:root { --x: #fff; }`),
    ]);
    expect(tokens[0]!.overrides).toEqual([]);
  });

  test("lastDeclarationInLayerWins", () => {
    const { tokens } = overlay([layer("one", `:root { --x: 1; }\n:root { --x: 2; }`)]);
    expect(tokens[0]!.value).toBe("2");
    expect(tokens[0]!.overrides).toEqual([]);
  });

  test("detectsShapeConflict", () => {
    const { conflicts } = overlay([
      layer("fhir.base.template", `:root { --toc-box-border: 1px solid navy; }`),
      layer("who.template.root", `:root { --toc-box-border: navy; }`),
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.kind).toBe("shape");
    expect(conflicts[0]!.sites.map((s) => s.value)).toEqual(["1px solid navy", "navy"]);
  });

  test("agreeingLayersNoConflict", () => {
    const { conflicts } = overlay([
      layer("base", `:root { --a: #fff; --b: 1px solid navy; }`),
      layer("top", `:root { --a: #000; }`),
    ]);
    expect(conflicts).toEqual([]);
  });

  test("malformedRecordedOnLayer", () => {
    const { conflicts } = overlay([layer("fhir.base.template", `:root { --breadcrumb-text-color: ##555555; }`)]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.kind).toBe("malformed");
    expect(conflicts[0]!.sites).toEqual([{ package: "fhir.base.template", value: "##555555" }]);
  });

  test("malformedStillMirrored", () => {
    const { tokens } = overlay([layer("fhir.base.template", `:root { --breadcrumb-text-color: ##555555; }`)]);
    expect(tokens[0]!.value).toBe("##555555");
  });

  test("ruleToTopmostLayer", () => {
    const { rules } = overlay([
      layer("fhir.base.template", `#publish-box { background-color: yellow; }\n#ig-status p { color: red; }`),
      layer("who.template.root", `#ig-status p { color: blue; }`),
    ]);
    const byId = Object.fromEntries(rules.map((r) => [r.selector, r.from]));
    expect(byId["#ig-status p"]).toBe("who.template.root");
    expect(byId["#publish-box"]).toBe("fhir.base.template");
  });
});

describe("malformation", () => {
  test("malformationDoubledHashOnly", () => {
    expect(malformation("##555555")).toContain("doubled");
    expect(malformation("#555555")).toBeUndefined();
    expect(malformation("navy")).toBeUndefined();
    expect(malformation("1px solid navy")).toBeUndefined();
    // NARROW on purpose: a false positive accuses somebody else's published
    // stylesheet of a fault it does not have.
    expect(malformation("rgba(245,45,45,0.5)")).toBeUndefined();
    expect(malformation('url("data:image/svg+xml;utf8,<svg/>")')).toBeUndefined();
  });
});

// who.css 82603d0, line 567: the DRAFT watermark. Its value holds `;` and `:`
// inside a quoted data URI; a `[^;]+` split cut it into a truncated `url(` and a
// bogus `http` property, and browsers then dropped every later mirrored rule.
const DRAFT_RULE = `#ig-status.ig-status-draft {
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='150px'><text fill='rgba(245,45,45,0.5)'>DRAFT</text></svg>");
  background-size: calc(50% / 5) 100px;
  background-repeat: repeat-x;
}`;

describe("declarations inside strings and parentheses", () => {
  test("dataUriOneDeclaration", () => {
    const decls = ruleFor(DRAFT_RULE, "#ig-status.ig-status-draft");
    expect(decls?.map((d) => d.property)).toEqual(["background-image", "background-size", "background-repeat"]);
    expect(decls?.[0]?.value).toBe(
      `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='150px'><text fill='rgba(245,45,45,0.5)'>DRAFT</text></svg>")`,
    );
  });

  test("firstColonOutsideString", () => {
    expect(declarationsIn("a: b; --x: url(http://e.org/a;b); c:d")).toEqual([
      { property: "a", value: "b" },
      { property: "--x", value: "url(http://e.org/a;b)" },
      { property: "c", value: "d" },
    ]);
  });

  test("quotedSemicolonKept", () => {
    expect(rootTokens(`:root { --q: "a;b"; --c: #fff; }`)).toEqual([
      { name: "--q", value: `"a;b"` },
      { name: "--c", value: "#fff" },
    ]);
  });
});
