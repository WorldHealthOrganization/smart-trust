import { describe, expect, test } from "bun:test";

import {
  IG_CHROME_SCHEMA_TAG,
  IgChromeSchema,
  chromeCss,
  chromeFileFor,
  tokenOf,
  tokensByPackage,
  type IgChrome,
} from "./ig-chrome";

function chrome(over: Partial<IgChrome> = {}): IgChrome {
  return {
    $schema: IG_CHROME_SCHEMA_TAG,
    id: "acme.template.root",
    version: "0.5.0",
    layers: [
      {
        package: "fhir.base.template",
        version: "1.0.0",
        of: "https://github.com/HL7/ig-template-base",
        ref: "849a8f5298f521a0af0a48256d4a0c5a83297664",
        path: "content/assets/css/project.css",
        readAt: "2026-09-23",
      },
    ],
    tokens: [{ name: "--navbar-bg-color", value: "#00477d", from: "acme.template.root", overrides: [] }],
    rules: [],
    conflicts: [],
    ...over,
  };
}

describe("the schema", () => {
  test("refusesChromeWithNoLayer", () => {
    expect(IgChromeSchema.safeParse(chrome({ layers: [] })).success).toBe(false);
  });

  test("refusesTokenWithoutDashes", () => {
    const bad = chrome({ tokens: [{ name: "navbar-bg-color", value: "#00477d", from: "x", overrides: [] }] });
    expect(IgChromeSchema.safeParse(bad).success).toBe(false);
  });

  test("refusesTruncatedLayerRef", () => {
    const bad = chrome({ layers: [{ ...chrome().layers[0]!, ref: "849a" }] });
    expect(IgChromeSchema.safeParse(bad).success).toBe(false);
  });

  test("acceptsMalformedConflictWithOneSite", () => {
    const one = chrome({
      conflicts: [
        {
          token: "--breadcrumb-text-color",
          kind: "malformed",
          detail: "a doubled #",
          sites: [{ package: "fhir.base.template", value: "##555555" }],
        },
      ],
    });
    expect(IgChromeSchema.safeParse(one).success).toBe(true);
  });

  test("refusesConflictWithNoSite", () => {
    const none = chrome({
      conflicts: [{ token: "--x", kind: "malformed", detail: "d", sites: [] }],
    });
    expect(IgChromeSchema.safeParse(none).success).toBe(false);
  });
});

describe("tokensByPackage", () => {
  test("countsTokensWonPerPackage", () => {
    const c = chrome({
      tokens: [
        { name: "--a", value: "1", from: "acme.template.root", overrides: [{ package: "fhir.base.template", value: "0" }] },
        { name: "--b", value: "2", from: "acme.template.root", overrides: [] },
        { name: "--c", value: "3", from: "fhir.base.template", overrides: [] },
      ],
    });
    // `--a` was declared by BOTH and is counted once, to the winner.
    expect(tokensByPackage(c)).toEqual({ "acme.template.root": 2, "fhir.base.template": 1 });
  });
});

describe("chromeCss", () => {
  test("neverEmitsBareRoot", () => {
    const css = chromeCss(chrome(), ".st-ig");
    expect(css).toContain(".st-ig {");
    expect(css).not.toMatch(/(^|[\s,}]):root\s*\{/);
  });

  test("emitsConflictedTokenWithNote", () => {
    const c = chrome({
      tokens: [{ name: "--toc-box-border", value: "navy", from: "acme.template.root", overrides: [] }],
      conflicts: [
        {
          token: "--toc-box-border",
          kind: "shape",
          detail: "two shapes",
          sites: [
            { package: "fhir.base.template", value: "1px solid navy" },
            { package: "acme.template.root", value: "navy" },
          ],
        },
      ],
    });
    const css = chromeCss(c, ".st-ig");
    // Dropping it would make our page differ from the IG invisibly, which is
    // worse than reproducing a rule the upstream also gets wrong.
    expect(css).toContain("--toc-box-border: navy;");
    expect(css).toContain("shape conflict");
  });

  test("scopesMirroredRule", () => {
    const c = chrome({
      rules: [
        {
          selector: "#publish-box",
          from: "fhir.base.template",
          declarations: [{ property: "background-color", value: "var(--publish-box-bg-color)" }],
        },
      ],
    });
    expect(chromeCss(c, ".st-ig")).toContain(".st-ig #publish-box {");
  });
});

describe("tokenOf", () => {
  test("tokenOfFindsOrUndefined", () => {
    expect(tokenOf(chrome(), "--navbar-bg-color")?.value).toBe("#00477d");
    expect(tokenOf(chrome(), "--nope")).toBeUndefined();
  });
});

describe("chromeFileFor", () => {
  const deps = (roots: string[], names: Record<string, string>, dirs: Record<string, string[]>, files: string[]) => ({
    instanceRootsIn: () => roots,
    declarationNameOf: (r: string) => names[r],
    directoriesForGraph: (r: string) => dirs[r] ?? [],
    exists: (p: string) => files.includes(p),
    join: (...parts: string[]) => parts.join("/"),
  });

  test("resolvesThroughDeclaration", () => {
    const found = chromeFileFor(
      "/repo",
      "acme-base",
      // The declared directory is `somewhere-else/`, not `fhir-artifact-index/`.
      // A path literal would have missed it — which is the `ylj7` defect.
      deps(["/repo/sb"], { "/repo/sb": "acme-base" }, { "/repo/sb": ["/repo/sb/somewhere-else"] }, [
        "/repo/sb/somewhere-else/chrome.json",
      ]),
    );
    expect(found).toBe("/repo/sb/somewhere-else/chrome.json");
  });

  test("ignoresSameDirDifferentName", () => {
    const found = chromeFileFor(
      "/repo",
      "acme-base",
      deps(["/repo/st"], { "/repo/st": "acme-ig" }, { "/repo/st": ["/repo/st/fhir-artifact-index"] }, [
        "/repo/st/fhir-artifact-index/chrome.json",
      ]),
    );
    expect(found).toBeUndefined();
  });

  test("declaredDirWithoutChromeIsUndefined", () => {
    const found = chromeFileFor(
      "/repo",
      "acme-base",
      deps(["/repo/sb"], { "/repo/sb": "acme-base" }, { "/repo/sb": ["/repo/sb/fhir-artifact-index"] }, []),
    );
    expect(found).toBeUndefined();
  });

  test("pathReachesNestedInstance", () => {
    // In an IG fork the platform is a submodule, so the chrome's owner sits two levels down.
    const d = deps(
      ["/fork/platform", "/fork/ig-data"],
      { "/fork/platform": "platform", "/fork/ig-data": "some-ig", "/fork/platform/base-harness": "base-harness" },
      { "/fork/platform/base-harness": ["/fork/platform/base-harness/themes"] },
      ["/fork/platform/base-harness/themes/chrome.json"],
    );
    expect(chromeFileFor("/fork", "base-harness", d)).toBeUndefined();
    expect(chromeFileFor("/fork", "platform/base-harness", d)).toBe("/fork/platform/base-harness/themes/chrome.json");
  });

  test("pathWithoutInstanceIsUndefined", () => {
    const d = deps([], {}, {}, ["/fork/nowhere/themes/chrome.json"]);
    expect(chromeFileFor("/fork", "nowhere", d)).toBeUndefined();
    expect(chromeFileFor("/fork", "x/nowhere", d)).toBeUndefined();
  });
});
