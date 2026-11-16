#!/usr/bin/env bun
/**
 * A QA report on the class model the schemas viewer draws: what every reader —
 * Zod/TypeScript, JSON Schema, FHIR logical models — could and could not
 * determine, as a `kg-qa/v1` sidecar.
 *
 * @module scripts/class-model-qa
 * @graphNode none — a reporter over the schema graph, not a schema itself
 * @covers none — writer — records what the readers could not determine; gates nothing
 *
 * The viewer shows each gap where it is (a dashed box, a `?..?`, a name under
 * "resolved to no declaration"). This is the same facts counted across the
 * whole checkout, per source, so a reader can see how much of the picture is
 * stated rather than determined without opening 2,000 declarations.
 *
 * | criterion | fails when |
 * |---|---|
 * | `class-model-determined` | a declaration is `undetermined` (dashed box) |
 * | `class-model-references-resolve` | a reference resolves to no declaration of the graph |
 * | `class-model-cardinality-known` | a field's cardinality is `?..?` |
 * | `class-model-sources-read` | a declared source could not be opened (`unknown`, never a pass) |
 * | `class-model-sources-drawn` | nothing — it lists what each reader drew, so a zero is visible |
 * | `class-model-vocabularies-recorded` | a vocabulary or metamodel read (SKOS, BPMN, …) is named by no external-schema record; `n/a` when none is read, `unknown` when the registry is not found |
 *
 * Usage:
 *   bun run cat schema:qa            # write <qa home>/kg-qa/schema-class-model.kg-qa.json
 *   bun run cat schema:qa --stdout   # print it instead
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { kgQaHomeFor } from "../schemas/kg/cat-harness.js";
import { checkoutDirectoriesForGraph } from "../schemas/kg/harness-config.js";
import { KG_QA_SCHEMA, type KgCriterionEntry, type KgQaReport } from "../schemas/sdlc/kg-qa.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { readSchemaGraph, type SchemaGraph } from "./schema-graph.ts";
import { sourceOfKind } from "./type-links.ts";

/** The sidecar's subject id, and its file name stem. */
export const CLASS_MODEL_QA_ID = "schema-class-model";

/** The source a declaration was read from, for the per-source breakdown. */
function sourceOf(d: SchemaGraph["decls"][number]): string {
  if (d.kind !== "undetermined") return sourceOfKind(d.kind);
  if (/StructureDefinition|\/fhir\//.test(d.module)) return "fhir";
  return d.module.endsWith(".json") ? "json-schema" : "zod";
}

/**
 * A namespace without its closing `#` or `/`, so `…/core#` and `…/core` are
 * one, and with `https:` read as `http:`: schema.org publishes both, and
 * `@vocabulary/schema` writes `http://schema.org/` where the record says https.
 */
const bareNs = (ns: string): string => ns.replace(/^https:/, "http:").replace(/[#/]+$/, "");

/**
 * The external-schema records (`folio-external-schema/v1`) in the declared
 * `external-schema` directories, as `{id, namespaces}`; `undefined` when no
 * directory is declared or none exists — the registry not found, which is not
 * the registry empty.
 */
export function externalSchemaRecords(root: string): { id: string; namespaces: string[] }[] | undefined {
  let dirs: string[] = [];
  try {
    dirs = checkoutDirectoriesForGraph("external-schema", root).filter((d) => existsSync(d));
  } catch {
    dirs = [];
  }
  if (dirs.length === 0) return undefined;
  const out: { id: string; namespaces: string[] }[] = [];
  for (const dir of dirs) {
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
      try {
        const r = JSON.parse(readFileSync(join(dir, f), "utf-8")) as { $schema?: unknown; id?: unknown; namespaces?: unknown };
        if (r.$schema !== "folio-external-schema/v1" || typeof r.id !== "string") continue;
        out.push({ id: r.id, namespaces: Array.isArray(r.namespaces) ? r.namespaces.filter((n): n is string => typeof n === "string") : [] });
      } catch {
        continue;
      }
    }
  }
  return out;
}

/** The report over `g`. Pure: the caller decides where it goes. */
export function classModelQa(g: SchemaGraph, records?: readonly { id: string; namespaces: readonly string[] }[]): KgQaReport {
  const criteria: Record<string, KgCriterionEntry> = {};
  const verdict = (findings: KgCriterionEntry["findings"]): KgCriterionEntry => ({ result: findings.length ? "fail" : "pass", findings });

  criteria["class-model-determined"] = verdict(
    g.decls
      .filter((d) => d.kind === "undetermined")
      .map((d) => ({ where: d.id, detail: `«${sourceOf(d)}» ${d.name} could not be determined: ${(d.note ?? "no reason recorded").slice(0, 160)}` })),
  );
  criteria["class-model-references-resolve"] = verdict(
    g.decls
      .filter((d) => d.unresolved.length > 0)
      .map((d) => ({ where: d.id, detail: `«${sourceOf(d)}» ${d.name} names ${d.unresolved.length} thing(s) the graph does not hold: ${d.unresolved.slice(0, 8).join(", ")}${d.unresolved.length > 8 ? ", …" : ""}` })),
  );
  criteria["class-model-cardinality-known"] = verdict(
    g.decls.flatMap((d) =>
      d.fields.filter((f) => f.cardinalityUnknown).map((f) => ({ where: `${d.id}.${f.name}`, detail: `«${sourceOf(d)}» ${d.name}.${f.name} states no cardinality; drawn ?..?` })),
    ),
  );
  // Could-not-read is UNKNOWN: an unbuilt index may hold every model or none.
  criteria["class-model-sources-read"] = g.unread.length
    ? { result: "unknown", findings: g.unread.map((u) => ({ where: u.split(":")[0]!, detail: `not read: ${u}` })) }
    : { result: "pass", findings: [] };
  const bySource = new Map<string, { decls: number; modules: Set<string>; edges: number }>();
  const declSource = new Map(g.decls.map((d) => [d.id, sourceOf(d)]));
  for (const d of g.decls) {
    const s = bySource.get(sourceOf(d)) ?? { decls: 0, modules: new Set<string>(), edges: 0 };
    s.decls++;
    s.modules.add(d.module);
    bySource.set(sourceOf(d), s);
  }
  for (const e of g.edges) {
    const s = bySource.get(declSource.get(e.from) ?? "");
    if (s) s.edges++;
  }
  criteria["class-model-sources-drawn"] = {
    result: "pass",
    findings: [...bySource.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([s, n]) => ({ where: s, detail: `${n.decls} declaration(s) in ${n.modules.size} module(s), ${n.edges} edge(s)` })),
  };

  // Every vocabulary the class model draws is a specification the platform
  // depends on, so the registry names it (`external-schema.ts`): one it does
  // not name is a dependency nobody recorded the edition of.
  const vocabs = g.vocabularies ?? [];
  if (vocabs.length === 0) criteria["class-model-vocabularies-recorded"] = { result: "n/a", findings: [] };
  else if (!records) {
    criteria["class-model-vocabularies-recorded"] = { result: "unknown", findings: [{ where: "external-schema", detail: "no external-schema registry found: the vocabularies read cannot be checked against it" }] };
  } else {
    const known = new Set(records.flatMap((r) => r.namespaces.map(bareNs)));
    criteria["class-model-vocabularies-recorded"] = verdict(
      vocabs
        .filter((v) => !known.has(bareNs(v.namespace)))
        .map((v) => ({ where: v.module, detail: `${v.prefix}: ${v.namespace} (${v.source}) is read and no external-schema record names it` })),
    );
  }

  const totals = { pass: 0, fail: 0, "n/a": 0, unknown: 0 } as KgQaReport["totals"];
  for (const c of Object.values(criteria)) totals[c.result]++;
  return { $schema: KG_QA_SCHEMA, subject: { kind: "graph", id: CLASS_MODEL_QA_ID, path: null }, source_hash: null, criteria, totals };
}

if (import.meta.main) {
  const g = readSchemaGraph(HARNESS_ROOT, { scope: "checkout" });
  if (g === null) {
    console.log("  · no schemas directory — no class model to report on");
    process.exit(0);
  }
  const report = classModelQa(g, externalSchemaRecords(HARNESS_ROOT));
  const text = JSON.stringify(report, null, 2) + "\n";
  if (process.argv.includes("--stdout")) {
    process.stdout.write(text);
  } else {
    const out = join(kgQaHomeFor(HARNESS_ROOT).root, "kg-qa", `${CLASS_MODEL_QA_ID}.kg-qa.json`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, text);
    console.log(`  ✓ ${out}`);
  }
  for (const [id, c] of Object.entries(report.criteria)) console.log(`  ${c.result.padEnd(7)} ${id} (${c.findings.length})`);
}
