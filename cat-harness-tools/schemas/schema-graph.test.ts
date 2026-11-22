/**
 * The schema-graph reader, tested against shapes that actually occur here.
 *
 * @module schemas/schema-graph.test
 * @graphNode none — a test over the reader, not a schema itself
 *
 * ## Why these cases and not a snapshot of the real corpus
 *
 * A snapshot of `schemas/` would go red on every schema anybody adds, which
 * makes it a tax rather than a test. Each case below is a SHAPE the reader
 * classifies, written as a fixture, plus a small number of properties asserted
 * against the real directory where the property is about the corpus rather
 * than about one expression.
 *
 * Every fixture is a shape that was measured in this repository, and three of
 * them are shapes the FIRST draft of the reader got wrong — `.extend()`
 * classified as undetermined, `z` reported as the graph's most-referenced
 * missing declaration, and an interface's base class carried where literal
 * enum members go. A test that only covered what the reader already handled
 * would have passed on all three.
 */
import { describe, expect, test } from "bun:test";
import { TOOLS_ROOT } from "../scripts/lib/roots.ts";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readSchemaGraph } from "../scripts/schema-graph.ts";

/** A throwaway layer whose `schemas/` holds exactly the given files. */
function fixture(files: Record<string, string>): { root: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "schema-graph-"));
  mkdirSync(join(root, "schemas"), { recursive: true });
  // No `harness.json`: `schemasRoot` falls back to the convention, which is
  // the path an unmigrated layer takes and therefore worth exercising.
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(root, "schemas", name), body);
  }
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

describe("readSchemaGraph", () => {
  test("a missing schemas directory reads as null, not as an empty graph", () => {
    const root = mkdtempSync(join(tmpdir(), "schema-graph-empty-"));
    try {
      expect(readSchemaGraph(root)).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("z.object fields, optionality and arrays", () => {
    const f = fixture({
      "a.ts": `
import { z } from "zod";
/** A thing. */
export const ASchema = z.object({
  id: z.string(),
  tags: z.array(z.string()).optional(),
});
`,
    });
    try {
      const g = readSchemaGraph(f.root)!;
      const a = g.decls.find((d) => d.name === "ASchema")!;
      expect(a.kind).toBe("zod-object");
      expect(a.doc).toBe("A thing.");
      expect(a.fields.map((x) => x.name)).toEqual(["id", "tags"]);
      expect(a.fields[1]!.optional).toBe(true);
      expect(a.fields[1]!.array).toBe(true);
      expect(a.fields[0]!.optional).toBe(false);
    } finally {
      f.cleanup();
    }
  });

  test("`z` is external, never an unresolved reference", () => {
    // The first draft reported `z` 175 times as the graph's most-referenced
    // missing declaration. It is bound — to `zod`, a non-relative import — so
    // it resolved fine, to somewhere outside this graph.
    const f = fixture({
      "a.ts": `import { z } from "zod";\nexport const ASchema = z.object({ id: z.string() });\n`,
    });
    try {
      const a = readSchemaGraph(f.root)!.decls.find((d) => d.name === "ASchema")!;
      expect(a.unresolved).not.toContain("z");
      expect(a.external).toContain("z");
    } finally {
      f.cleanup();
    }
  });

  test(".extend() is an object with a generalisation edge, not undetermined", () => {
    // 31 declarations here were classified undetermined by the first draft for
    // exactly this shape, which is the inheritance relation of this corpus.
    const f = fixture({
      "base.ts": `import { z } from "zod";\nexport const BaseSchema = z.object({ kind: z.string() });\n`,
      "sub.ts": `
import { z } from "zod";
import { BaseSchema } from "./base.js";
export const SubSchema = BaseSchema.extend({ extra: z.string().optional() });
`,
    });
    try {
      const g = readSchemaGraph(f.root)!;
      const sub = g.decls.find((d) => d.name === "SubSchema")!;
      expect(sub.kind).toBe("zod-object");
      expect(sub.extendsNames).toContain("BaseSchema");
      expect(sub.fields.map((x) => x.name)).toEqual(["extra"]);
      const edge = g.edges.find((e) => e.from === sub.id && e.kind === "extends");
      expect(edge).toBeDefined();
      // Suffix, not equality: an id is repo-root-relative, and a fixture in a
      // temp directory has whatever prefix `repoRootFor` resolves there. The
      // property under test is the edge's TARGET, not where the fixture sits.
      expect(edge!.to.endsWith("schemas/base.ts#BaseSchema")).toBe(true);
    } finally {
      f.cleanup();
    }
  });

  test("a cross-module field reference becomes a resolved edge", () => {
    const f = fixture({
      "leaf.ts": `import { z } from "zod";\nexport const LeafSchema = z.string();\n`,
      "root.ts": `
import { z } from "zod";
import { LeafSchema } from "./leaf.js";
export const RootSchema = z.object({ leaf: LeafSchema, many: z.array(LeafSchema) });
`,
    });
    try {
      const g = readSchemaGraph(f.root)!;
      const root = g.decls.find((d) => d.name === "RootSchema")!;
      expect(root.refs).toHaveLength(1);
      expect(root.refs[0]!.endsWith("schemas/leaf.ts#LeafSchema")).toBe(true);
      const viaMany = g.edges.find((e) => e.from === root.id && e.via === "many")!;
      expect(viaMany.array).toBe(true);
      expect(g.edges.find((e) => e.from === root.id && e.via === "leaf")!.array).toBe(false);
    } finally {
      f.cleanup();
    }
  });

  test("a declared concern group is read, and an import through an old-path shim still resolves", () => {
    // Bean `f8wp`: `schemas/<group>/` holds the moved modules, declared from
    // within by `schemas/schemas.json`, with a re-export left at each old
    // path. Reading the top level alone saw only the shims, and the schemas
    // page lost every moved declaration (its overview e2e went red on fa main).
    const f = fixture({
      "schemas.json": JSON.stringify({ $schema: "concern-groups/v1", groups: ["kg"] }),
      "leaf.ts": `/**\n * Moved.\n *\n * @graphNode none — a re-export at the old path\n */\nexport * from "./kg/leaf.js";\n`,
      "root.ts": `
import { z } from "zod";
import { LeafSchema } from "./leaf.js";
export const RootSchema = z.object({ leaf: LeafSchema });
`,
    });
    mkdirSync(join(f.root, "schemas", "kg"));
    writeFileSync(join(f.root, "schemas", "kg", "leaf.ts"), `import { z } from "zod";\nexport const LeafSchema = z.string();\n`);
    writeFileSync(
      join(f.root, "schemas", "kg", "mid.ts"),
      `import { z } from "zod";\nimport { LeafSchema } from "./leaf.js";\nimport { RootSchema } from "../root.js";\n` +
        `export const MidSchema = z.object({ leaf: LeafSchema, root: RootSchema });\n`,
    );
    try {
      const g = readSchemaGraph(f.root)!;
      const leaf = g.decls.find((d) => d.name === "LeafSchema")!;
      expect(leaf.module.endsWith("schemas/kg/leaf.ts")).toBe(true);
      // The shim declares nothing, so the moved declaration is not counted twice.
      expect(g.decls.filter((d) => d.name === "LeafSchema")).toHaveLength(1);
      // Through the shim, from the top level.
      const root = g.decls.find((d) => d.name === "RootSchema")!;
      expect(root.refs).toEqual([leaf.id]);
      expect(root.unresolved).toEqual([]);
      // Within the group, and back up out of it.
      const mid = g.decls.find((d) => d.name === "MidSchema")!;
      expect([...mid.refs].sort()).toEqual([leaf.id, root.id].sort());
      expect(mid.unresolved).toEqual([]);
    } finally {
      f.cleanup();
    }
  });

  test("an unrecognised expression is undetermined and says what it saw", () => {
    const f = fixture({
      // A bare object literal, not a Zod call. This is the real shape:
      // `kgNodeLabelShape` and `DAK_SCHEMA_EXTENSIONS` are the two
      // declarations in this repository the reader cannot classify, and both
      // are this. An alias (`export const A = B`) is deliberately NOT here:
      // that is an extension, and the reader classifies it as one.
      "odd.ts": `import { z } from "zod";\nexport const OddSchema = { a: z.string(), b: z.number() };\n`,
    });
    try {
      const g = readSchemaGraph(f.root)!;
      const odd = g.decls.find((d) => d.name === "OddSchema");
      // It is picked up by the `Schema$` heuristic, and it is honest about
      // being unclassifiable rather than rendering as an empty object.
      expect(odd?.kind).toBe("undetermined");
      expect(odd?.note).toBeTruthy();
    } finally {
      f.cleanup();
    }
  });

  test("an interface's base goes to extendsNames, not to values", () => {
    const f = fixture({
      "i.ts": `
export interface Base { a: string }
/** A sub. */
export interface Sub extends Base { b?: number }
`,
    });
    try {
      const g = readSchemaGraph(f.root)!;
      const sub = g.decls.find((d) => d.name === "Sub")!;
      expect(sub.kind).toBe("interface");
      expect(sub.extendsNames).toEqual(["Base"]);
      expect(sub.values).toEqual([]);
      expect(sub.fields[0]!.optional).toBe(true);
      expect(g.edges.some((e) => e.from === sub.id && e.kind === "extends")).toBe(true);
    } finally {
      f.cleanup();
    }
  });

  test("a self-reference through z.lazy is a box, not an edge", () => {
    const f = fixture({
      "rec.ts": `
import { z } from "zod";
export const NodeSchema: z.ZodTypeAny = z.lazy(() => z.object({ child: NodeSchema.optional() }));
`,
    });
    try {
      const g = readSchemaGraph(f.root)!;
      const n = g.decls.find((d) => d.name === "NodeSchema")!;
      expect(g.edges.some((e) => e.from === n.id && e.to === n.id)).toBe(false);
    } finally {
      f.cleanup();
    }
  });

  test("the module's @graphNode declaration is carried through", () => {
    const f = fixture({
      "tagged.ts": `/**\n * Tagged.\n *\n * @graphNode schema\n */\nimport { z } from "zod";\nexport const TSchema = z.string();\n`,
      "untagged.ts": `import { z } from "zod";\nexport const USchema = z.string();\n`,
      "excused.ts": `/**\n * Excused.\n *\n * @graphNode none — a barrel\n */\nexport const x = 1;\n`,
    });
    try {
      const g = readSchemaGraph(f.root)!;
      const by = new Map(g.modules.map((m) => [m.name, m]));
      expect(by.get("tagged")!.graphNode).toBe("schema");
      expect(by.get("untagged")!.graphNode).toBe("undeclared");
      expect(by.get("excused")!.graphNode).toBe("none");
      expect(by.get("excused")!.reason).toBe("a barrel");
    } finally {
      f.cleanup();
    }
  });

  test("the reading is stable — two reads of one directory agree exactly", () => {
    // The projection built from this is committed, so an artefact reproducible
    // only where it was generated would be a snapshot rather than a generated
    // file. Directory order must not reach the output.
    const f = fixture({
      "b.ts": `import { z } from "zod";\nimport { ASchema } from "./a.js";\nexport const BSchema = z.object({ a: ASchema });\n`,
      "a.ts": `import { z } from "zod";\nexport const ASchema = z.string();\n`,
    });
    try {
      const one = JSON.stringify(readSchemaGraph(f.root));
      const two = JSON.stringify(readSchemaGraph(f.root));
      expect(one).toBe(two);
      // And a forward reference resolves the same as a backward one: `b.ts` is
      // read before `a.ts`, and the edge exists anyway.
      const g = readSchemaGraph(f.root)!;
      expect(g.edges.some((e) => e.to.endsWith("schemas/a.ts#ASchema"))).toBe(true);
    } finally {
      f.cleanup();
    }
  });
});

describe("the real schema graph", () => {
  // The schema corpus is this layer's since bean 8lcl moved it out of cat-harness.
  const root = TOOLS_ROOT;

  test("reads, and is not empty", () => {
    const g = readSchemaGraph(root);
    expect(g).not.toBeNull();
    expect(g!.modules.length).toBeGreaterThan(50);
    expect(g!.decls.length).toBeGreaterThan(300);
    expect(g!.edges.length).toBeGreaterThan(100);
  });

  test("the corpus is mostly classified — undetermined is a handful, not a third", () => {
    // Not a fixed number: that would go red on an unrelated schema. The
    // property is that the reader classifies nearly everything, which is what
    // distinguishes it from the first draft (31 of 713).
    const g = readSchemaGraph(root)!;
    const undetermined = g.decls.filter((d) => d.kind === "undetermined").length;
    expect(undetermined / g.decls.length).toBeLessThan(0.02);
  });

  test("every edge lands on a declaration that exists", () => {
    const g = readSchemaGraph(root)!;
    const ids = new Set(g.decls.map((d) => d.id));
    const dangling = g.edges.filter((e) => !ids.has(e.to) || !ids.has(e.from));
    expect(dangling).toEqual([]);
  });

  test("`z` is external everywhere, and nowhere unresolved", () => {
    const g = readSchemaGraph(root)!;
    expect(g.decls.filter((d) => d.unresolved.includes("z"))).toEqual([]);
  });
});
