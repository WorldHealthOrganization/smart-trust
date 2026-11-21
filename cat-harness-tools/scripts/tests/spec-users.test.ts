/**
 * A user declares the specification it depends on (bean `u63y`). Four forms,
 * and a declaration naming no record is a finding.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { boundNamespaces, frontMatterSpecs, refModule, specUsers, taggedSpecs } from "../spec-users.js";

describe("reading one declaration", () => {
  test("a @conformsTo tag in a doc comment is read; the same words in code are not", () => {
    const src = "/**\n * Thing.\n * @conformsTo w3c-skos\n * @conformsTo w3c-rdfs\n */\nconst s = \"@conformsTo not-this\";\n";
    expect(taggedSpecs(src)).toEqual(["w3c-skos", "w3c-rdfs"]);
  });

  test("a placeholder in prose is not a declaration", () => {
    expect(taggedSpecs(" * each module carries `@conformsTo <spec-id>`\n")).toEqual([]);
  });

  test("front matter: a list, or a single value", () => {
    expect(frontMatterSpecs("---\nname: x\nconformsTo:\n  - dcmi-terms\n  - w3c-skos\n---\n# x\n")).toEqual(["dcmi-terms", "w3c-skos"]);
    expect(frontMatterSpecs("---\nconformsTo: dcmi-terms\n---\n")).toEqual(["dcmi-terms"]);
    expect(frontMatterSpecs("# no front matter\nconformsTo: dcmi-terms\n")).toEqual([]);
  });

  test("xmlns bindings, prefixed and default", () => {
    expect(boundNamespaces('<d xmlns="urn:a" xmlns:b="urn:b" b:x="urn:c"/>')).toEqual(["urn:a", "urn:b"]);
  });

  test("a registry ref names its module, with or without an instance prefix", () => {
    expect(refModule("folio-assistant-core:schemas/dublin-core.ts#X", "cat-harness")).toBe("folio-assistant-core/schemas/dublin-core.ts");
    expect(refModule("schemas/content/odrl.ts#OdrlPolicySchema", "cat-harness")).toBe("cat-harness/schemas/content/odrl.ts");
  });
});

describe("specUsers over a repository", () => {
  function repo(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), "spec-users-"));
    for (const [f, body] of Object.entries(files)) {
      mkdirSync(join(root, dirname(f)), { recursive: true });
      writeFileSync(join(root, f), body);
    }
    return root;
  }
  const specs = [
    { id: "w3c-skos", namespaces: ["http://www.w3.org/2004/02/skos/core#"] },
    { id: "omg-bpmn-2.0", namespaces: ["http://www.omg.org/spec/BPMN/20100524/MODEL"] },
  ];
  const files = {
    "inst/schemas/vocab.ts": "/**\n * @conformsTo w3c-skos\n */\nexport const x = 1;\n",
    "inst/skills/s.md": "---\nconformsTo:\n  - w3c-skos\n---\n",
    "inst/processes/p.bpmn": '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"/>',
    "inst/scripts/bad.ts": "/**\n * @conformsTo no-such-spec\n */\n",
  };
  const kinds = {
    glossary: { validator: "schemas/vocab.ts#V" },
    docs: { nodeSchemas: { "folio-x/v1": { shape: "schemas/vocab.ts#X" }, "folio-y/v1": { validator: "schemas/other.ts#Y" } } },
  };

  test("each direct form is read, and a kind inherits its typing module's declaration", () => {
    const root = repo(files);
    const got = specUsers(root, Object.keys(files), specs, kinds, "inst");
    expect(got.uses.map((u) => `${u.form}:${u.user}→${u.spec}`).sort()).toEqual([
      "front-matter:inst/skills/s.md→w3c-skos",
      "kind:folio-x/v1 nodes→w3c-skos",
      "kind:glossary graph→w3c-skos",
      "tag:inst/schemas/vocab.ts→w3c-skos",
      "xmlns:inst/processes/p.bpmn→omg-bpmn-2.0",
    ]);
  });

  test("a declaration naming no record is reported, never silently dropped", () => {
    const root = repo(files);
    expect(specUsers(root, Object.keys(files), specs, kinds, "inst").unknown).toEqual([
      { user: "inst/scripts/bad.ts", spec: "no-such-spec" },
    ]);
  });
});
