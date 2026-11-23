/**
 * `libraries:derive` and `libraries:check` (bean `jbvi`, option D), over a
 * fixture layer built in a temporary directory, so each refusal is shown on
 * an input made to trigger exactly it.
 *
 * @module scripts/tests/libraries.test
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { loadSpdxLicenseList } from "../../schemas/library/spdx-license-expression.ts";
import { SoftwareLibrarySchema } from "../../schemas/library/software-library.ts";
import {
  HOLDER,
  KIND_OWNER,
  asHeld,
  codeFiles,
  deriveLayer,
  heldLayers,
  strayHeldDirs,
  layerFindings,
  libraryLayers,
  licenceOf,
  licenseRefFor,
  recogniseLicenceText,
  vendoredBundles,
  packageOf,
  parseBunLock,
  readModuleRefs,
  sha512Hex,
  tarballUrl,
  typesPackageFor,
  writeLayer,
  type LibraryLayer,
} from "../libraries.ts";

const REPO = resolve(import.meta.dir, "..", "..", "..");
const SPDX = loadSpdxLicenseList(REPO);
/** 64 bytes, so a valid sha512 integrity, and the hex it must become. */
const BYTES = Buffer.alloc(64, 7);
const INTEGRITY = `sha512-${BYTES.toString("base64")}`;
const HEX = BYTES.toString("hex");

let root: string;
let layer: LibraryLayer;

function put(rel: string, text: string): void {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "libraries-"));
  layer = { name: "fixture", root, dir: join(root, "libraries") };
  put(
    "package.json",
    JSON.stringify({
      name: "@litlfred/fixture",
      dependencies: { "pkg-a": "^1.0.0", "@scope/b": "2.0.0", "@litlfred/cat-harness": "0.1.0" },
      devDependencies: { "@types/c": "^1.0.0" },
    }),
  );
  // bun.lock's trailing commas are part of the fixture: the parser must take them.
  put(
    "bun.lock",
    `{
  "lockfileVersion": 1,
  "workspaces": { "": { "name": "@litlfred/fixture", }, },
  "packages": {
    "pkg-a": ["pkg-a@1.0.1", "", {}, "${INTEGRITY}"],
    "@scope/b": ["@scope/b@2.0.0", "https://npm.example.org/", {}, "${INTEGRITY}"],
    "@types/c": ["@types/c@1.2.0", "", {}, "${INTEGRITY}"],
    "@litlfred/cat-harness": ["@litlfred/cat-harness@workspace:../cat-harness"],
  },
}
`,
  );
  put("node_modules/pkg-a/package.json", JSON.stringify({ name: "pkg-a", version: "1.0.1", license: "MIT" }));
  put("node_modules/@scope/b/package.json", JSON.stringify({ name: "@scope/b", version: "2.0.0", license: { type: "Apache-2.0" } }));
  put("node_modules/@types/c/package.json", JSON.stringify({ name: "@types/c", version: "1.1.0", licenses: [{ type: "MIT" }] }));
  put(
    "src/a.ts",
    [
      `import a from "pkg-a";`,
      `import type { C } from "c";`,
      `import { h } from "@litlfred/cat-harness/schemas/x.ts";`,
      `import { readFileSync } from "node:fs";`,
      `import path from "path";`,
      `import { test } from "bun:test";`,
      `import { local } from "./local.ts";`,
      `// import "in-a-comment";`,
      `export const s = "import y from 'in-a-string'";`,
    ].join("\n"),
  );
  put("src/b.ts", `export async function f() { return import("@scope/b/sub"); }\n`);
  put("types/pkg-a.d.ts", `declare module "pkg-a" { const a: unknown; export default a; }\n`);
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("the small readers", () => {
  test("bun.lock parses with its trailing commas", () => {
    expect(parseBunLock(`{"a": [1, 2,], "b": {"c": 1,},}`)).toEqual({ a: [1, 2], b: { c: 1 } } as never);
  });

  test("a sha512 integrity becomes 128 hex characters; anything else is undefined", () => {
    expect(sha512Hex(INTEGRITY)).toBe(HEX);
    expect(sha512Hex("sha1-abc")).toBeUndefined();
    expect(sha512Hex(undefined)).toBeUndefined();
  });

  test("a specifier names its package, and a types package is found for it", () => {
    expect(packageOf("@scope/b/sub")).toBe("@scope/b");
    expect(packageOf("pkg-a/deep/x.js")).toBe("pkg-a");
    expect(typesPackageFor("c")).toBe("@types/c");
    expect(typesPackageFor("@scope/b")).toBe("@types/scope__b");
  });

  test("the tarball URL is the registry's, with the default for an empty one", () => {
    expect(tarballUrl("", "zod", "4.6.5")).toBe("https://registry.npmjs.org/zod/-/zod-4.6.5.tgz");
    expect(tarballUrl("https://npm.example.org/", "@scope/b", "2.0.0")).toBe("https://npm.example.org/@scope/b/-/b-2.0.0.tgz");
  });

  test("a licence is read from `license` in either form, or the old `licenses` array", () => {
    expect(licenceOf({ license: "MIT" })).toBe("MIT");
    expect(licenceOf({ license: { type: "ISC" } })).toBe("ISC");
    expect(licenceOf({ licenses: [{ type: "MIT" }, { type: "Apache-2.0" }] })).toBe("(MIT OR Apache-2.0)");
    expect(licenceOf({})).toBeUndefined();
  });

  test("imports are read from the syntax tree: never from a comment or a string", () => {
    const r = readModuleRefs("x.ts", `// import "a";\nconst s = "import b from 'b'";\nimport c from "c";\nconst d = require("d");\ntype E = import("e").E;\n`);
    expect(r.imports.sort()).toEqual(["c", "d", "e"]);
  });
});

describe("deriving a layer", () => {
  test("one node per outside dependency; the platform's own layers get none", () => {
    const d = deriveLayer(root);
    expect(d.problems).toEqual([]);
    expect([...d.nodes.keys()].sort()).toEqual(["pkg-a.library.json", "scope__b.library.json", "types__c.library.json"]);
    for (const n of d.nodes.values()) expect(SoftwareLibrarySchema.safeParse(n).success).toBe(true);
  });

  test("each field comes from where the module says", () => {
    const d = deriveLayer(root);
    const a = d.nodes.get("pkg-a.library.json")!;
    expect(a.version).toBe("1.0.1");
    expect(a.range).toBe("^1.0.0");
    expect(a.dev).toBe(false);
    expect(a.digest).toEqual({ algorithm: "sha512", digest: HEX });
    expect(a.source).toEqual({ type: "url", url: "https://registry.npmjs.org/pkg-a/-/pkg-a-1.0.1.tgz" });
    expect(a.licence).toBe("MIT");
    expect(a.shim).toBe("types/pkg-a.d.ts");
    expect(a.usedBy).toEqual(["src/a.ts"]);
    const b = d.nodes.get("scope__b.library.json")!;
    expect(b.licence).toBe("Apache-2.0");
    expect(b.usedBy).toEqual(["src/b.ts"]);
    expect(b.shim).toBeUndefined();
  });

  test("an import of `c` is satisfied by `@types/c`, a dev dependency", () => {
    const c = deriveLayer(root).nodes.get("types__c.library.json")!;
    expect(c.dev).toBe(true);
    expect(c.usedBy).toEqual(["src/a.ts"]);
  });

  test("an installed version that differs from the locked one is noted, never refused", () => {
    const d = deriveLayer(root);
    expect(d.notes.some((n) => n.includes("@types/c") && n.includes("1.1.0") && n.includes("1.2.0"))).toBe(true);
    expect(d.nodes.get("types__c.library.json")!.version).toBe("1.2.0");
  });
});

describe("--check", () => {
  test("a freshly written layer has no findings", () => {
    const d = deriveLayer(root);
    writeLayer(layer, d);
    expect(layerFindings(layer, d, SPDX)).toEqual([]);
  });

  test("a hand-edited node is stale", () => {
    const p = join(layer.dir, "pkg-a.library.json");
    const before = readFileSync(p, "utf-8");
    writeFileSync(p, before.replace('"MIT"', '"ISC"'));
    const f = layerFindings(layer, deriveLayer(root), SPDX);
    expect(f.some((x) => x.includes("pkg-a.library.json") && x.includes("stale"))).toBe(true);
    writeFileSync(p, before);
  });

  test("a node no dependency names is stale, and a dependency with no node is missing", () => {
    const extra = join(layer.dir, "ghost.library.json");
    writeFileSync(extra, readFileSync(join(layer.dir, "pkg-a.library.json"), "utf-8").replace('"pkg-a"', '"ghost"'));
    const gone = join(layer.dir, "scope__b.library.json");
    const kept = readFileSync(gone, "utf-8");
    rmSync(gone);
    const f = layerFindings(layer, deriveLayer(root), SPDX);
    expect(f.some((x) => x.includes("ghost.library.json") && x.includes("stale"))).toBe(true);
    expect(f.some((x) => x.includes("scope__b.library.json") && x.includes("missing"))).toBe(true);
    rmSync(extra);
    writeFileSync(gone, kept);
  });

  test("an import that names no node is a finding", () => {
    put("src/c.ts", `import u from "undeclared-pkg";\n`);
    const f = layerFindings(layer, deriveLayer(root), SPDX);
    expect(f.some((x) => x.includes("`undeclared-pkg`") && x.includes("src/c.ts"))).toBe(true);
    rmSync(join(root, "src/c.ts"));
  });

  test("a nested package with its own lockfile is its own package: its imports are not the layer's", () => {
    put("pkgs/inner/package.json", JSON.stringify({ name: "@x/inner", devDependencies: { vitest: "^4" } }));
    put("pkgs/inner/bun.lock", "{}\n");
    put("pkgs/inner/tests/t.test.ts", 'import { test } from "vitest";\n');
    try {
      expect(codeFiles(root).some((f) => f.startsWith("pkgs/inner/"))).toBe(false);
      expect(deriveLayer(root).unknownImports.has("vitest")).toBe(false);
      rmSync(join(root, "pkgs/inner/bun.lock"));
      expect(deriveLayer(root).unknownImports.has("vitest")).toBe(true);
    } finally {
      rmSync(join(root, "pkgs"), { recursive: true, force: true });
    }
  });

  test("a shim that names no node is a finding", () => {
    put("types/ghost.d.ts", `declare module "ghost-pkg" {}\n`);
    const f = layerFindings(layer, deriveLayer(root), SPDX);
    expect(f.some((x) => x.includes("types/ghost.d.ts") && x.includes("`ghost-pkg`"))).toBe(true);
    rmSync(join(root, "types/ghost.d.ts"));
  });

  test("a licence off the pinned SPDX list is a finding", () => {
    const p = join(root, "node_modules/pkg-a/package.json");
    const before = readFileSync(p, "utf-8");
    writeFileSync(p, JSON.stringify({ name: "pkg-a", version: "1.0.1", license: "Not-A-Licence" }));
    const d = deriveLayer(root);
    writeLayer(layer, d);
    const f = layerFindings(layer, d, SPDX);
    expect(f.some((x) => x.includes("pkg-a.library.json") && x.includes("licence"))).toBe(true);
    writeFileSync(p, before);
    writeLayer(layer, deriveLayer(root));
  });

  test("what the writer could not determine is a finding, never a skipped node", () => {
    rmSync(join(root, "node_modules/@scope/b"), { recursive: true });
    const d = deriveLayer(root);
    expect(d.nodes.has("scope__b.library.json")).toBe(false);
    expect(layerFindings(layer, d, SPDX).some((x) => x.includes("@scope/b") && x.includes("not installed"))).toBe(true);
    put("node_modules/@scope/b/package.json", JSON.stringify({ name: "@scope/b", version: "2.0.0", license: { type: "Apache-2.0" } }));
  });

  test("a layer with no bun.lock could not be determined", () => {
    const bare = mkdtempSync(join(tmpdir(), "libraries-bare-"));
    writeFileSync(join(bare, "package.json"), "{}");
    expect(deriveLayer(bare).problems.some((p) => p.includes("bun.lock"))).toBe(true);
    rmSync(bare, { recursive: true, force: true });
  });
});

describe("a vendored bundle (owner, 2026-10-26: record as vendored)", () => {
  const MIT = `Copyright Somebody and other contributors

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
`;
  const sha256 = (t: string) => createHash("sha256").update(t).digest("hex");
  const BUNDLE_JS = `import "promise-polyfill";\nexport const lib = 1;\n`;
  const OWN_TERMS = "Our own terms, which no SPDX id names.\n";

  function vendor(name: string, dir: string, version: string, licenceFile: [string, string], extra: Record<string, unknown> = {}): void {
    const at = `scripts/assets/vendor/${dir}/${version}`;
    put(`${at}/${licenceFile[0]}`, licenceFile[1]);
    put(`${at}/lib.js`, BUNDLE_JS);
    put(
      `${at}/vendored.json`,
      JSON.stringify({
        _comment: "fixture",
        package: name,
        version,
        tarball: `https://registry.npmjs.org/${name}/-/${name.split("/").pop()}-${version}.tgz`,
        integrity: INTEGRITY,
        files: [
          { path: licenceFile[0], sha256: sha256(licenceFile[1]) },
          { path: "lib.js", sha256: sha256(BUNDLE_JS) },
        ],
        ...extra,
      }),
    );
  }

  beforeAll(() => {
    vendor("libmit", "libmit", "3.6.0", ["LICENSE.txt", MIT]);
    vendor("@own/terms", "own-terms", "8.0.0", ["LICENSE.md", OWN_TERMS]);
  });
  afterAll(() => {
    rmSync(join(root, "scripts"), { recursive: true, force: true });
    writeLayer(layer, deriveLayer(root));
  });

  test("each `vendor/<name>/<version>/` is a bundle, and its files are not read for imports", () => {
    expect(vendoredBundles(root)).toEqual(["scripts/assets/vendor/libmit/3.6.0", "scripts/assets/vendor/own-terms/8.0.0"]);
    expect(codeFiles(root, new Set(vendoredBundles(root))).some((f) => f.includes("/vendor/"))).toBe(false);
    const d = deriveLayer(root);
    expect(d.unknownImports.has("promise-polyfill")).toBe(false);
  });

  test("one 1.1.0 node per bundle, marked vendored, with no range or dev; the other nodes stay 1.0.0", () => {
    const d = deriveLayer(root);
    expect(d.problems).toEqual([]);
    const v = d.nodes.get("libmit-3.6.0.vendored.library.json")!;
    expect(SoftwareLibrarySchema.safeParse(v).success).toBe(true);
    expect(v.$schema).toBe("software-library/1.1.0");
    expect(v.vendored).toEqual({ path: "scripts/assets/vendor/libmit/3.6.0" });
    expect(v.range).toBeUndefined();
    expect(v.dev).toBeUndefined();
    expect(v.version).toBe("3.6.0");
    expect(v.digest).toEqual({ algorithm: "sha512", digest: HEX });
    expect(v.source).toEqual({ type: "url", url: "https://registry.npmjs.org/libmit/-/libmit-3.6.0.tgz" });
    expect(v.usedBy).toEqual([]);
    expect(d.nodes.get("pkg-a.library.json")!.$schema).toBe("software-library/1.0.0");
  });

  test("the licence is read from the bundle's own files: a recognised text is its id, any other a LicenseRef", () => {
    const d = deriveLayer(root);
    const mit = d.nodes.get("libmit-3.6.0.vendored.library.json")!;
    expect(mit.licence).toBe("MIT");
    expect(mit.licenceSource).toBe("scripts/assets/vendor/libmit/3.6.0/LICENSE.txt");
    const own = d.nodes.get("own__terms-8.0.0.vendored.library.json")!;
    expect(own.licence).toBe("LicenseRef-own-terms");
    expect(own.licenceSource).toBe("scripts/assets/vendor/own-terms/8.0.0/LICENSE.md");
    expect(recogniseLicenceText(`${MIT}\nAnd one more term.`)).toBeUndefined();
    expect(licenseRefFor("@lhncbc/ucum-lhc")).toBe("LicenseRef-lhncbc-ucum-lhc");
  });

  test("a font's OFL.txt is OFL-1.1 when it is the licence whole, under its copyright line and the standard notice", () => {
    const ofl = readFileSync(join(import.meta.dir, "fixtures", "licences", "OFL-1.1-plus-jakarta-sans.txt"), "utf-8");
    expect(recogniseLicenceText(ofl)).toBe("OFL-1.1");
    // The licence alone, with no notice above it, is the licence too.
    expect(recogniseLicenceText(ofl.slice(ofl.indexOf("SIL OPEN FONT LICENSE")))).toBe("OFL-1.1");
    // One more term, or anything but the notice above it, is not.
    expect(recogniseLicenceText(`${ofl}\nAnd one more term.`)).toBeUndefined();
    expect(recogniseLicenceText(`Use only on Tuesdays.\n${ofl}`)).toBeUndefined();
    expect(recogniseLicenceText(ofl.replace("may be sold by itself", "may be sold"))).toBeUndefined();
  });

  test("a written layer with bundles is clean, and its licences parse on the pinned list", () => {
    const d = deriveLayer(root);
    writeLayer(layer, d);
    expect(layerFindings(layer, d, SPDX)).toEqual([]);
  });

  test("a kept file whose bytes changed is a finding, and the bundle gets no node", () => {
    const p = join(root, "scripts/assets/vendor/libmit/3.6.0/lib.js");
    writeFileSync(p, `${BUNDLE_JS}// patched\n`);
    const d = deriveLayer(root);
    expect(d.nodes.has("libmit-3.6.0.vendored.library.json")).toBe(false);
    expect(d.problems.some((x) => x.includes("lib.js") && x.includes("sha256"))).toBe(true);
    writeFileSync(p, BUNDLE_JS);
  });

  test("a bundle with no manifest, or one that disagrees with its directory, could not be determined", () => {
    put("scripts/assets/vendor/bare/1.0.0/x.js", "export {};\n");
    vendor("libmit", "skewed", "2.0.0", ["LICENSE", MIT], { version: "2.0.1" });
    const p = deriveLayer(root).problems;
    expect(p.some((x) => x.includes("vendor/bare/1.0.0") && x.includes("vendored.json"))).toBe(true);
    expect(p.some((x) => x.includes("vendor/skewed/2.0.0") && x.includes("2.0.1"))).toBe(true);
    rmSync(join(root, "scripts/assets/vendor/bare"), { recursive: true });
    rmSync(join(root, "scripts/assets/vendor/skewed"), { recursive: true });
  });
});

describe("the layers this checkout judges", () => {
  test("cat-harness-tools declares its own libraries directory", () => {
    expect(libraryLayers(REPO).map((l) => l.name)).toContain("cat-harness-tools");
  });
});

describe("a layer below the kind is held by the writer's layer (owner, 2026-10-30, bootstrap-tools#44)", () => {
  let co: string;
  const decl = (name: string, needs: string[], pkg: boolean) => {
    mkdirSync(join(co, name), { recursive: true });
    writeFileSync(join(co, name, `${name}.json`), JSON.stringify({ name, version: "0.1.0", needs }));
    if (pkg) writeFileSync(join(co, name, "package.json"), JSON.stringify({ name: `@litlfred/${name}` }));
  };
  beforeAll(() => {
    co = mkdtempSync(join(tmpdir(), "libraries-held-"));
    decl("base", [], false); // no package.json: nothing to hold
    decl("base-tools", ["base"], true); // below the kind: held
    decl(KIND_OWNER, ["base", "base-tools"], true); // the kind's owner declares its own
    decl("tools", [KIND_OWNER, "base-tools"], true); // the holder
    decl("above", ["tools"], true); // reaches the kind: never held, declares its own
  });
  afterAll(() => rmSync(co, { recursive: true, force: true }));
  const holder = (): LibraryLayer => ({ name: "tools", root: join(co, "tools"), dir: join(co, "tools", "libraries") });

  test("the held set is derived: a layer with a package.json that does not reach the kind's owner", () => {
    const held = heldLayers(co, [holder()], "tools");
    expect(held.map((l) => l.name)).toEqual(["base-tools"]);
    expect(held[0].dir).toBe(join(co, "tools", "libraries", "held", "base-tools"));
    expect(held[0].heldBy?.name).toBe("tools");
  });

  test("with no holder in the checkout, nothing is held", () => {
    expect(heldLayers(co, [], "tools")).toEqual([]);
  });

  test("a layer that declares its own libraries directory is never held", () => {
    const own = [holder(), { name: "base-tools", root: join(co, "base-tools"), dir: join(co, "base-tools", "libraries") }];
    expect(heldLayers(co, own, "tools")).toEqual([]);
  });

  test("a held node names its layer and is stamped 1.2.0; usedBy stays relative to that layer", () => {
    const d = asHeld(deriveLayer(root), "fixture");
    for (const n of d.nodes.values()) {
      expect(n.layer).toBe("fixture");
      expect(n.$schema).toBe("software-library/1.2.0");
      expect(SoftwareLibrarySchema.safeParse(n).success).toBe(true);
    }
    expect(d.nodes.get("pkg-a.library.json")?.usedBy).toEqual(deriveLayer(root).nodes.get("pkg-a.library.json")!.usedBy);
  });

  test("a held directory for a layer the checkout does not hold is reported, never deleted", () => {
    const h = holder();
    mkdirSync(join(h.dir, "held", "gone"), { recursive: true });
    expect(strayHeldDirs(h, heldLayers(co, [h], "tools"))).toEqual(["gone"]);
    rmSync(join(h.dir, "held"), { recursive: true });
  });

  test("this layer is the holder", () => {
    expect(HOLDER).toBe("cat-harness-tools");
  });
});

describe("npm's `SEE LICENSE IN <file>`", () => {
  test("the named file is read: a listed licence's text is its id, any other a LicenseRef", () => {
    const dir = mkdtempSync(join(tmpdir(), "libraries-see-"));
    const put2 = (rel: string, text: string) => {
      mkdirSync(dirname(join(dir, rel)), { recursive: true });
      writeFileSync(join(dir, rel), text);
    };
    put2("package.json", JSON.stringify({ name: "@litlfred/see", dependencies: { custom: "^1.0.0" } }));
    put2("bun.lock", `{"lockfileVersion": 1, "workspaces": {"": {"name": "@litlfred/see"}}, "packages": {"custom": ["custom@1.0.0", "", {}, "${INTEGRITY}"]}}`);
    put2("node_modules/custom/package.json", JSON.stringify({ name: "custom", version: "1.0.0", license: "SEE LICENSE IN LICENSE" }));
    put2("node_modules/custom/LICENSE", "Copyright the authors. You may use this only with the watermark shown.\n");
    put2("src/a.ts", `import c from "custom";\n`);
    const d = deriveLayer(dir);
    expect(d.problems).toEqual([]);
    const n = d.nodes.get("custom.library.json")!;
    expect(n.licence).toBe("LicenseRef-custom");
    expect(n.licenceSource).toContain("`LICENSE`");
    rmSync(join(dir, "node_modules/custom/LICENSE"));
    expect(deriveLayer(dir).problems.some((p) => p.includes("no such file"))).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});
