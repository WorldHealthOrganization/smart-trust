/**
 * Which `schemas/*.ts` modules are knowledge-graph nodes, read from the files.
 *
 * `harness.json` declares `schemas/` with `graphTypologies: ["schemas", "kg"]`,
 * so the exported graph must hold nodes of the `schemas` kind; this module
 * finds them.
 *
 * ## The declaration principle
 *
 * A directory says what to EXPECT; the files declare what they ARE: skills by
 * YAML front matter, beans by front matter, workflow instances by
 * `"$schema"`. For `schemas/*.ts`, `@module` only says WHERE, so `@graphNode`
 * says WHAT. It is a JSDoc tag rather than an exported constant so it costs
 * nothing at runtime and a consumer reading the repository, not importing it,
 * can answer the question.
 *
 * ## Every file declares, including the ones that are not nodes
 *
 * `@graphNode none — <reason>` is a real value, and the reason is required —
 * for example `builders.ts` (constructor functions over other modules'
 * schemas).
 *
 * **An untagged file is `undeclared`, never a pass.** Test files are not
 * excluded by pattern: a test file is excluded because it declares nothing
 * AND is a test, and the gate says so in those terms.
 *
 * @module scripts/schema-nodes
 * @graphNode none — tooling that reads the declarations, not a schema itself
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import { corpusDirectoriesForGraph } from "../schemas/kg/harness-config.js";
import { ownDirectoriesForGraph } from "./lib/gate-own.ts";
import { directoriesForGraph } from "../schemas/kg/cat-harness.js";
import type { CorpusScope } from "./known-skills.js";
import { withConcernGroupDirs } from "./concern-groups.ts";
// The `folio` graph typology is registered by CORE. This module is a LIBRARY, so it
// does NOT import that registration: a library's edge is inherited by every
// module that imports it, and the harness may not depend on core. The
// COMMAND that runs carries it — and since #840 every caller does, because
// the trigger sits at the foot of `cat-harness.ts` and a reader lives in that
// module, so loading it is a precondition of calling one.
//
// THIS COMMENT NAMED `check:composition-roots` AS THE GUARANTEE UNTIL
// 2026-09-22, in SEVEN files, AND THAT SCRIPT DOES NOT EXIST. `bun run
// check:composition-roots` exits "Script not found". The safety argument for
// a library omitting the registration rested on a gate nobody built, and no
// gate failed to say so — the same silence this repository keeps paying for.
// It is moot now rather than fixed: #840 made the registration automatic, so
// there is no longer a command that can forget it (bean `z9ax`).

/**
 * EVERY directory declaring the `schemas` graph, or the convention.
 *
 * It was `directoriesForGraph(...)[0]` — the FIRST one — until 2026-09-20, and by
 * then three directories declared the graph: `schemas/`,
 * the content core's `schemas/` and `large-datasets/schemas/`. So the gate
 * that exists to stop a module being silently absent from the published graph
 * was itself silently absent from two thirds of it. Bean `xxxb` is the defect
 * this file was written for; this is that defect, in this file, one directory
 * over.
 *
 * declared-path-literal: the fallback is at the call site so the choice is
 * visible. `schemas/` declares TWO graphs — it is a knowledge-graph node AND
 * the schema definitions — which is why the accessor is asked for the
 * `schemas` one by name rather than being handed a single-home guess.
 *
 * `scope` is the corpus by default, which is what the gate asks. `"instance"`
 * is the layer's own declaration alone — what `kg-export` publishes for it
 * since the split (bean `4ak5` item 2), so its schema nodes are its own.
 *
 * `own`, when given, keeps only the corpus directories those layers commit
 * (`scripts/lib/gate-own.ts`: owner ruling 2026-11-05, "Move the checks"). A
 * mounted lower layer's `schemas/` is judged by that layer's own CI, so a
 * defect committed there is not charged to every root that mounts it. With
 * `own` and none of its directories declared, there is nothing to read: `[]`,
 * not the `schemas/` fallback, which names the harness's own.
 */
function schemasRoots(root: string, scope: CorpusScope = "checkout", own?: ReadonlySet<string>): string[] {
  let declared: string[];
  if (scope === "instance") declared = directoriesForGraph(root, "schemas");
  else if (own) {
    declared = ownDirectoriesForGraph(root, "schemas", own);
    if (declared.length === 0) return [];
  } else declared = corpusDirectoriesForGraph(root, "schemas");
  // Each directory's concern groups too (`schemas/<group>/`, declared from
  // within by `schemas.json`; bean `f8wp`), one level deep like the rest.
  return withConcernGroupDirs(declared.length > 0 ? declared : [join(root, "schemas")], "schemas");
}

/** What a `schemas/*.ts` module declares itself to be. */
export type SchemaNodeKind = "schema" | "none" | "undeclared";

export interface SchemaModule {
  /** Repo-relative path, e.g. `schemas/tools/tool.ts`. */
  module: string;
  /** Bare stem, the identifier a node IRI is minted from. */
  name: string;
  kind: SchemaNodeKind;
  /** The reason given after `none —`, when one is. */
  reason?: string;
  /** First prose line of the leading docblock, for the node's summary (D5). */
  summary?: string;
  /** True for `*.test.ts`: in the directory, not of the graph. */
  isTest: boolean;
}

const TAG = /@graphNode\s+(\S+)(?:\s*[—-]\s*(.*))?/;

/**
 * Read every `.ts` under `schemas/` and what it says it is.
 *
 * Reads only the FIRST docblock. A `@graphNode` deeper in the file is a
 * mention, not a declaration — a module documenting the convention must not
 * thereby declare itself.
 */
export function schemaModules(root: string, scope: CorpusScope = "checkout", own?: ReadonlySet<string>): SchemaModule[] {
  const out: SchemaModule[] = [];
  for (const dir of schemasRoots(root, scope, own)) {
    if (!existsSync(dir)) continue;
    // The module id carries the DIRECTORY, not a bare `schemas/` prefix: three
    // directories declare this graph and two of them hold a `catalogue.ts` or an
    // `index.ts`, so a flat `schemas/<stem>` id would collide across layers
    // and the audit would report one module while another went unchecked. Same
    // reason `kgQaSidecarPath` mirrors each subject's path instead of flattening.
    const prefix = relative(root, dir).split(sep).join("/");
    for (const f of readdirSync(dir).sort()) {
      if (!f.endsWith(".ts")) continue;
      const module = `${prefix}/${f}`;
      const isTest = f.endsWith(".test.ts");
      const text = readFileSync(join(dir, f), "utf-8");
      const block = /^\/\*\*[\s\S]*?^ \*\//m.exec(text)?.[0] ?? "";
      const m = TAG.exec(block);
      const name = basename(f, ".ts");
      if (!m) {
        out.push({ module, name, kind: "undeclared", isTest });
        continue;
      }
      const value =
        m[1] === "none" ? "none" : m[1] === "schema" ? "schema" : "undeclared";
      // The first prose line: skip the opening `/**` and any leading tag lines.
      const summary = block
        .split("\n")
        .slice(1)
        .map((l) => l.replace(/^\s*\*\s?/, "").trim())
        .find((l) => l.length > 0 && !l.startsWith("@"));
      out.push({
        module,
        name,
        kind: value as SchemaNodeKind,
        reason: m[2]?.trim() || undefined,
        summary,
        isTest,
      });
    }
  }
  return out;
}

/** Just the modules that declare themselves schema nodes. */
export function schemaNodes(root: string): SchemaModule[] {
  return schemaModules(root).filter((m) => m.kind === "schema");
}

/** What a gate should report. Three states, and the third is never a pass. */
export interface SchemaNodeAudit {
  nodes: SchemaModule[];
  /** Declared `none`, with a reason. Deliberately not nodes. */
  exempt: SchemaModule[];
  /**
   * In the declared directory and saying nothing about itself.
   *
   * Reported separately for tests, because "a test file has no declaration" is
   * an expected shape with a different remedy from "somebody added a schema and
   * did not declare it".
   */
  undeclared: SchemaModule[];
  undeclaredTests: SchemaModule[];
  /** `@graphNode none` with no reason. Silencing must cost more than declaring. */
  reasonless: SchemaModule[];
  /** The directories read: empty only when `own` was given and none of its layers declares one. */
  directories: string[];
}

export function auditSchemaNodes(root: string, scope: CorpusScope = "checkout", own?: ReadonlySet<string>): SchemaNodeAudit {
  const all = schemaModules(root, scope, own);
  return {
    directories: schemasRoots(root, scope, own),
    nodes: all.filter((m) => m.kind === "schema"),
    exempt: all.filter((m) => m.kind === "none" && m.reason),
    undeclared: all.filter((m) => m.kind === "undeclared" && !m.isTest),
    undeclaredTests: all.filter((m) => m.kind === "undeclared" && m.isTest),
    reasonless: all.filter((m) => m.kind === "none" && !m.reason),
  };
}
