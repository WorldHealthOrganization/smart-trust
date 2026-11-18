/**
 * The outside-software core and the ``software-library`` kind on it (bean
 * `jbvi`, option D), with its 1.1.0 vendored nodes (owner, 2026-10-26).
 *
 * Each fixture test changes ONE thing, so it cannot pass because of a second
 * violation elsewhere. The tool-release half proves the core did not loosen
 * `tool-release`: its own tests live with the tools layer, and these pin the
 * two places the core is WIDER than a tool release (sha512, a scoped name).
 *
 * @module schemas/software-library.test
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { defaultGraphTypologies, graphLayer, isRenderable } from "../kg/cat-harness.ts";
import {
  OutsideSoftwareCoreSchema,
  SoftwareDigestSchema,
  outsideSoftwareRef,
  parseOutsideSoftwareRef,
} from "./outside-software.ts";
import {
  LIBRARY_FILE_SUFFIX,
  SOFTWARE_LIBRARY_HELD_TAG,
  SOFTWARE_LIBRARY_SCHEMA_TAG,
  SOFTWARE_LIBRARY_VENDORED_TAG,
  SoftwareLibrarySchema,
  librarySchemaTag,
  libraryFileName,
  libraryLicenceProblem,
  vendoredLibraryFileName,
} from "./software-library.ts";
import { loadSpdxLicenseList } from "./spdx-license-expression.ts";
import { TOOL_RELEASE_SCHEMA_TAG, ToolReleaseSchema, toolReleaseLicenceProblem } from "../tools/tool-release.ts";

import { requireHarnessRoot } from "../harness-root.ts";
const HARNESS = requireHarnessRoot();
const CHECKOUT = resolve(HARNESS, "..");
const SHA512 = "b".repeat(128);
const SHA256 = "a".repeat(64);

function library(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    $schema: SOFTWARE_LIBRARY_SCHEMA_TAG,
    name: "bpmn-moddle",
    version: "10.3.1",
    digest: { algorithm: "sha512", digest: SHA512 },
    source: { type: "url", url: "https://registry.npmjs.org/bpmn-moddle/-/bpmn-moddle-10.3.1.tgz" },
    licence: "MIT",
    licenceSource: "the installed package's own package.json (`license`)",
    range: "^10.2.0",
    dev: false,
    usedBy: ["scripts/render-bpmn.ts", "src/workflow/process-model.ts"],
    shim: "types/bpmn-moddle.d.ts",
    ...over,
  };
}

const ok = (l: unknown) => SoftwareLibrarySchema.safeParse(l).success;

describe("the outside-software core", () => {
  test("its digest takes sha256 or sha512, and nothing else", () => {
    expect(SoftwareDigestSchema.safeParse({ algorithm: "sha256", digest: SHA256 }).success).toBe(true);
    expect(SoftwareDigestSchema.safeParse({ algorithm: "sha512", digest: SHA512 }).success).toBe(true);
    expect(SoftwareDigestSchema.safeParse({ algorithm: "sha512", digest: SHA256 }).success).toBe(false);
    expect(SoftwareDigestSchema.safeParse({ algorithm: "md5", digest: SHA256 }).success).toBe(false);
  });

  test("a ref splits at its LAST `@`, so a scoped name survives", () => {
    expect(parseOutsideSoftwareRef("@types/mdast@4.0.4")).toEqual({ name: "@types/mdast", version: "4.0.4" });
    expect(parseOutsideSoftwareRef("temurin-jre@21.0.4+7")).toEqual({ name: "temurin-jre", version: "21.0.4+7" });
    expect(parseOutsideSoftwareRef("zod")).toBeUndefined();
    expect(parseOutsideSoftwareRef("@types/mdast")).toBeUndefined();
    expect(outsideSoftwareRef({ name: "@types/mdast", version: "4.0.4" })).toBe("@types/mdast@4.0.4");
  });

  test("both kinds are the core: a valid record of either parses as one", () => {
    expect(OutsideSoftwareCoreSchema.safeParse(library()).success).toBe(true);
    for (const f of readdirSync(join(HARNESS, "tool-releases")).filter((f) => f.endsWith(".json"))) {
      const raw = JSON.parse(readFileSync(join(HARNESS, "tool-releases", f), "utf-8")) as { $schema?: string };
      if (raw.$schema !== TOOL_RELEASE_SCHEMA_TAG) continue;
      expect(OutsideSoftwareCoreSchema.safeParse(raw).success).toBe(true);
    }
  });
});

describe("tool-release keeps its four rules on the core", () => {
  test("every seeded release still parses", () => {
    const files = readdirSync(join(HARNESS, "tool-releases")).filter((f) => f.endsWith(".json"));
    let n = 0;
    for (const f of files) {
      const raw = JSON.parse(readFileSync(join(HARNESS, "tool-releases", f), "utf-8")) as { $schema?: string };
      if (raw.$schema !== TOOL_RELEASE_SCHEMA_TAG) continue;
      n++;
      const r = ToolReleaseSchema.safeParse(raw);
      expect(r.success ? "" : `${f}: ${r.error.message}`).toBe("");
    }
    expect(n).toBeGreaterThan(0);
  });

  test("a tool release does NOT inherit the core's sha512, nor a scoped name", () => {
    const raw = JSON.parse(readFileSync(join(HARNESS, "tool-releases", "plantuml-1.2026.10.json"), "utf-8")) as Record<string, unknown>;
    expect(ToolReleaseSchema.safeParse({ ...raw, digest: { algorithm: "sha512", digest: SHA512 } }).success).toBe(false);
    expect(ToolReleaseSchema.safeParse({ ...raw, name: "@scope/plantuml" }).success).toBe(false);
    const { entry: _e, ...noEntry } = raw;
    expect(ToolReleaseSchema.safeParse(noEntry).success).toBe(false);
  });
});

/** A vendored bundle's node: 1.1.0, `vendored`, no `range` and no `dev`. */
function vendoredLibrary(over: Record<string, unknown> = {}): Record<string, unknown> {
  const { range: _r, dev: _d, shim: _s, ...rest } = library();
  return {
    ...rest,
    $schema: SOFTWARE_LIBRARY_VENDORED_TAG,
    name: "jquery",
    version: "3.6.0",
    source: { type: "url", url: "https://registry.npmjs.org/jquery/-/jquery-3.6.0.tgz" },
    licenceSource: "scripts/assets/vendor/jquery/3.6.0/LICENSE.txt",
    usedBy: [],
    vendored: { path: "scripts/assets/vendor/jquery/3.6.0" },
    ...over,
  };
}

describe("software-library/1.0.0", () => {
  test("a valid library parses", () => {
    expect(ok(library())).toBe(true);
  });

  test("its digest may be sha512 — what bun.lock records — or sha256, and is required", () => {
    expect(ok(library({ digest: { algorithm: "sha256", digest: SHA256 } }))).toBe(true);
    const { digest: _d, ...rest } = library();
    expect(ok(rest)).toBe(false);
  });

  test("a scoped name is a name; an uppercase or `@`-less scope is not", () => {
    expect(ok(library({ name: "@types/mdast" }))).toBe(true);
    expect(ok(library({ name: "Zod" }))).toBe(false);
    expect(ok(library({ name: "types/mdast" }))).toBe(false);
  });

  test("its source is a registry URL over https, never an OCI image", () => {
    expect(ok(library({ source: { type: "url", url: "http://registry.npmjs.org/x.tgz" } }))).toBe(false);
    expect(ok(library({ source: { type: "oci", reference: `ghcr.io/x/y@sha256:${SHA256}` } }))).toBe(false);
  });

  test("range and dev are required; a shim is optional", () => {
    const { range: _r, ...noRange } = library();
    const { dev: _v, ...noDev } = library();
    const { shim: _s, ...noShim } = library();
    expect(ok(noRange)).toBe(false);
    expect(ok(noDev)).toBe(false);
    expect(ok(noShim)).toBe(true);
  });

  test("a shim is a `types/*.d.ts` file", () => {
    expect(ok(library({ shim: "src/bpmn-moddle.d.ts" }))).toBe(false);
    expect(ok(library({ shim: "types/bpmn-moddle.ts" }))).toBe(false);
  });

  test("`usedBy` is layer-relative, sorted and unique", () => {
    expect(ok(library({ usedBy: [] }))).toBe(true);
    expect(ok(library({ usedBy: ["src/b.ts", "scripts/a.ts"] }))).toBe(false);
    expect(ok(library({ usedBy: ["a.ts", "a.ts"] }))).toBe(false);
    expect(ok(library({ usedBy: ["/abs/a.ts"] }))).toBe(false);
    expect(ok(library({ usedBy: ["../other/a.ts"] }))).toBe(false);
  });

  test("its `$schema` is the kind's tag, at no newer minor than the kind", () => {
    expect(ok(library({ $schema: "software-library/1.0.0" }))).toBe(true);
    expect(ok(library({ $schema: "software-library/1.1.0" }))).toBe(true);
    expect(ok(library({ $schema: "software-library/1.2.0" }))).toBe(true);
    expect(ok(library({ $schema: "software-library/1.3.0" }))).toBe(false);
    expect(ok(library({ $schema: "folio-library/v1" }))).toBe(false);
  });

  test("an unknown field is refused", () => {
    expect(ok(library({ entry: { template: "{path}" } }))).toBe(false);
  });

  test("the file name never equals the `name`, and a scope cannot collide with a path", () => {
    expect(libraryFileName("zod")).toBe(`zod${LIBRARY_FILE_SUFFIX}`);
    expect(libraryFileName("@types/mdast")).toBe("types__mdast.library.json");
    expect(libraryFileName("@types/mdast")).not.toContain("/");
  });
});

describe("software-library/1.1.0 — a vendored bundle", () => {
  test("a vendored node parses, with no range and no dev", () => {
    const v = SoftwareLibrarySchema.safeParse(vendoredLibrary());
    expect(v.success ? "" : v.error.message).toBe("");
  });

  test("a vendored node carries neither `range` nor `dev`", () => {
    expect(ok(vendoredLibrary({ range: "3.6.0" }))).toBe(false);
    expect(ok(vendoredLibrary({ dev: false }))).toBe(false);
  });

  test("an empty `vendored` is not a way to drop `range` — its path is required, layer-relative", () => {
    expect(ok(vendoredLibrary({ vendored: {} }))).toBe(false);
    expect(ok(vendoredLibrary({ vendored: { path: "/abs/vendor/jquery/3.6.0" } }))).toBe(false);
    expect(ok(vendoredLibrary({ vendored: { path: "../other/vendor/jquery/3.6.0" } }))).toBe(false);
    expect(ok(vendoredLibrary({ vendored: { path: "vendor/jquery/3.6.0", tarball: "x" } }))).toBe(false);
  });

  test("`vendored` is a 1.1.0 field: a vendored node stamped 1.0.0 is refused", () => {
    expect(ok(vendoredLibrary({ $schema: SOFTWARE_LIBRARY_SCHEMA_TAG }))).toBe(false);
  });

  test("keeps the core: a digest and a registry tarball over https are still required", () => {
    const { digest: _d, ...noDigest } = vendoredLibrary();
    expect(ok(noDigest)).toBe(false);
    expect(ok(vendoredLibrary({ source: { type: "url", url: "http://registry.npmjs.org/jquery.tgz" } }))).toBe(false);
  });

  test("a node is stamped the OLDEST version with every field it uses", () => {
    expect(librarySchemaTag(library())).toBe(SOFTWARE_LIBRARY_SCHEMA_TAG);
    expect(librarySchemaTag(vendoredLibrary())).toBe(SOFTWARE_LIBRARY_VENDORED_TAG);
  });

  test("its file names the version, and never collides with a dependency's node", () => {
    expect(vendoredLibraryFileName("jquery", "3.6.0")).toBe("jquery-3.6.0.vendored.library.json");
    expect(vendoredLibraryFileName("@lhncbc/ucum-lhc", "8.0.0")).toBe("lhncbc__ucum-lhc-8.0.0.vendored.library.json");
    expect(vendoredLibraryFileName("jquery", "3.6.0")).not.toBe(libraryFileName("jquery"));
    expect(vendoredLibraryFileName("jquery", "3.6.0").endsWith(LIBRARY_FILE_SUFFIX)).toBe(true);
  });
});

describe("software-library/1.2.0 — a node held for a layer below the kind", () => {
  const held = (over: Record<string, unknown> = {}) => library({ $schema: SOFTWARE_LIBRARY_HELD_TAG, layer: "bootstrap-tools", ...over });

  test("a held node parses, naming the layer it describes", () => {
    const v = SoftwareLibrarySchema.safeParse(held());
    expect(v.success ? "" : v.error.message).toBe("");
  });

  test("`layer` is a 1.2.0 field: a held node stamped 1.0.0 or 1.1.0 is refused", () => {
    expect(ok(held({ $schema: SOFTWARE_LIBRARY_SCHEMA_TAG }))).toBe(false);
    expect(ok(held({ $schema: SOFTWARE_LIBRARY_VENDORED_TAG }))).toBe(false);
  });

  test("`layer` is an instance name, as `needs` names it", () => {
    expect(ok(held({ layer: "Bootstrap-Tools" }))).toBe(false);
    expect(ok(held({ layer: "../bootstrap-tools" }))).toBe(false);
    expect(ok(held({ layer: "" }))).toBe(false);
  });

  test("a held node keeps every other rule: range and dev are still required", () => {
    const { range: _r, ...noRange } = held();
    expect(ok(noRange)).toBe(false);
  });

  test("a held node is stamped 1.2.0, and nothing else is", () => {
    expect(librarySchemaTag({ layer: "bootstrap-tools" })).toBe(SOFTWARE_LIBRARY_HELD_TAG);
    expect(librarySchemaTag({ layer: "bootstrap-tools", vendored: { path: "vendor/x/1.0.0" } })).toBe(SOFTWARE_LIBRARY_HELD_TAG);
    expect(librarySchemaTag(library())).toBe(SOFTWARE_LIBRARY_SCHEMA_TAG);
  });
});

describe("one licence parser for both kinds", () => {
  const list = loadSpdxLicenseList(CHECKOUT);

  test("the pinned SPDX list loads", () => {
    expect(typeof list).not.toBe("string");
  });

  test("a library and a tool release give the same answer for the same licence", () => {
    if (typeof list === "string") throw new Error(list);
    for (const licence of ["MIT", "MIT OR Apache-2.0", "BlueOak-1.0.0", "Not-A-Licence", "MIT AND"]) {
      expect(libraryLicenceProblem({ licence }, list)).toBe(toolReleaseLicenceProblem({ licence }, list));
    }
    expect(libraryLicenceProblem({ licence: "MIT" }, list)).toBeUndefined();
    expect(libraryLicenceProblem({ licence: "Not-A-Licence" }, list)).toBeDefined();
  });
});

describe("the software-library graph typology", () => {
  test("is registered, derived, and not rendered", () => {
    expect(defaultGraphTypologies.names()).toContain("software-library");
    expect(graphLayer("software-library")).toBe("derived");
    expect(isRenderable("software-library")).toBe(false);
  });

  test("names all three families — 1.0.0, the vendored 1.1.0 and the held 1.2.0 — as generator output", () => {
    const def = defaultGraphTypologies.get("software-library");
    const tags = [SOFTWARE_LIBRARY_SCHEMA_TAG, SOFTWARE_LIBRARY_VENDORED_TAG, SOFTWARE_LIBRARY_HELD_TAG];
    expect(Object.keys(def?.nodeSchemas ?? {}).sort()).toEqual(tags);
    for (const tag of tags) expect(def?.nodeSchemas?.[tag]?.generated).toBe(true);
  });
});
