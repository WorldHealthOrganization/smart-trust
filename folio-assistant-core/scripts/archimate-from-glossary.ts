#!/usr/bin/env bun
/**
 * archimate-from-glossary: write an ArchiMate model's elements and
 * relationships from the knowledge graph. The Tool `archimate-from-glossary`.
 *
 * Owner, 2026-11-01 (smart-ra#166): "much of models should be rendered from
 * KG content", then option B, "whole model from the graph", and A, the
 * relationships "on each glossary term". A term whose `focus` is an ArchiMate
 * element (`folio-glossary/v1`, {@link ArchimateFocus}) says what the element
 * is and how it relates to other terms' elements. This makes the model agree:
 *
 * - **Match by link, never by name.** An element belongs to a term when its
 *   `skosConcept` property names it: `<file>.glossary.json#<term id>`, or
 *   the term's IRI path ending in `/glossary/<scheme>/<term id>`.
 * - **Elements.** A term with no element gets one, in the folder of its
 *   layer, on no view: the author places it in Archi (or
 *   `archimate-detangle` does). A linked element takes the term's prefLabel
 *   as its name and its definition as its documentation. A type that
 *   disagrees with the term is reported, never changed: changing a type can
 *   make its relationships illegal, so a person decides.
 * - **Relationships.** One the term lists and the model lacks is added. One
 *   between two linked elements that no term lists is reported, and removed
 *   with `--prune`, with every line that draws it.
 * - **Layout.** No box or line is moved. Archi keeps the layout.
 *
 * The model file keeps every byte this does not change. Archi's zipped
 * archive is written back as a zip.
 *
 * **Seeding, once, from an ingested model only.** `--seed` goes the other
 * way, one time: every term an element already points at (`skosConcept`) and
 * that has no `focus` yet gets one, with the element's type and its
 * relationships to the other linked elements. A term that already has a focus
 * is never overwritten. Owner, 2026-11-02: "i dont want ArchiMate to be source
 * of SKOS (unless it was ingested)", then card B. So `--seed` reads only a
 * model held in the layer's `library/` (a source as received), named with
 * `--from <path>` or as the configured model's file, and refuses an authored
 * model. After a seed the glossary is the source, and this Tool keeps the
 * model agreeing.
 *
 * Usage:
 *   bun run cat archimate:from-glossary --instance <dir> --model <model id> [--write] [--prune] [--check] [--json]
 *   bun run cat archimate:from-glossary --instance <dir> --seed --from library/<entry>/<file>.archimate [--write]
 *
 * Without `--write` it reports what it would change. `--check` fails when
 * anything would change, or a type disagrees. The report also counts the
 * elements that point at no term: the part of the model still authored only
 * in Archi.
 *
 * @module folio-assistant-core/scripts/archimate-from-glossary
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";

import { ARCHIMATE_RELATIONSHIPS, GlossarySchema, isArchimateFocus, type ArchimateFocus, type ArchimateRelationshipType, type LangText } from "../schemas/glossary.ts";

export const TOOL_ID = "archimate-from-glossary";

/** One term that is an element: where it is, and what the graph says of it. */
export interface GraphElement {
  /** `<file>.glossary.json#<term id>`: the `skosConcept` value written on a new element. */
  key: string;
  scheme: string;
  termId: string;
  name: string;
  documentation?: string;
  focus: ArchimateFocus;
}

/** The model as this needs it (cat-harness-tools' `ArchimateModel`, narrowed). */
export interface ModelLike {
  elements: Array<{ id: string; type: string; name: string; documentation?: string; properties: Array<{ key: string; value: string }> }>;
  relationships: Array<{ id: string; type: string; source: string; target: string; accessType?: string }>;
}

export interface Plan {
  /** Terms with no element: each gets one. */
  create: Array<{ id: string; term: GraphElement }>;
  /** Linked elements whose name or documentation the term changes. */
  update: Array<{ id: string; term: GraphElement; name?: string; documentation?: string }>;
  /** Relationships the graph lists and the model lacks. */
  relate: Array<{ id: string; type: ArchimateRelationshipType; source: string; target: string; accessType?: string; from: string }>;
  /** Relationships between two linked elements that no term lists. */
  extra: Array<{ id: string; type: string; source: string; target: string }>;
  /** Problems a person decides: a type that disagrees, two elements for one term, a link to no term. */
  problems: string[];
  /** Elements that point at no term. */
  unlinked: number;
  linked: number;
}

const text = (v: LangText | undefined): string | undefined => (v === undefined ? undefined : typeof v === "string" ? v : (v.en ?? Object.values(v)[0]));
const archiId = (seed: string): string => `id-${createHash("sha1").update(seed).digest("hex").slice(0, 32)}`;

/** The terms of a layer's glossaries whose focus is an ArchiMate element. */
export function graphElements(instanceRoot: string): GraphElement[] {
  const dir = join(instanceRoot, "glossary");
  if (!existsSync(dir)) return [];
  const out: GraphElement[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".glossary.json")).sort()) {
    const g = GlossarySchema.parse(JSON.parse(readFileSync(join(dir, f), "utf8")));
    for (const t of g.terms) {
      if (!isArchimateFocus(t.focus)) continue;
      const documentation = text(t.definition);
      out.push({ key: `${f}#${t.id}`, scheme: g.id, termId: t.id, name: text(t.prefLabel)!, ...(documentation ? { documentation } : {}), focus: t.focus });
    }
  }
  return out;
}

/** What the model must change to agree with the graph. */
export function plan(model: ModelLike, terms: readonly GraphElement[], modelId: string): Plan {
  const byKey = new Map(terms.map((t) => [t.key, t]));
  const termOf = (value: string): GraphElement | undefined =>
    byKey.get(value) ?? byKey.get(value.replace(/^.*\//, "")) ?? terms.find((t) => value.endsWith(`/glossary/${t.scheme}/${t.termId}`));
  const p: Plan = { create: [], update: [], relate: [], extra: [], problems: [], unlinked: 0, linked: 0 };
  const elementOf = new Map<string, string>(); // term key -> element id
  for (const e of model.elements) {
    const links = e.properties.filter((x) => x.key === "skosConcept");
    if (!links.length) {
      if (e.type !== "Grouping" && e.type !== "Junction") p.unlinked++;
      continue;
    }
    for (const l of links) {
      const t = termOf(l.value);
      if (!t) {
        // A link to a word that is not (yet) an element in the graph: not this Tool's to judge.
        continue;
      }
      p.linked++;
      if (elementOf.has(t.key)) {
        p.problems.push(`${t.key}: two elements point at it (${elementOf.get(t.key)}, ${e.id}); one term, one element`);
        continue;
      }
      elementOf.set(t.key, e.id);
      if (e.type !== t.focus.archimate) p.problems.push(`${t.key}: the model's ${e.id} is a ${e.type}, the graph says ${t.focus.archimate}`);
      const name = e.name !== t.name ? t.name : undefined;
      const documentation = t.documentation !== undefined && (e.documentation ?? "") !== t.documentation ? t.documentation : undefined;
      if (name !== undefined || documentation !== undefined) p.update.push({ id: e.id, term: t, ...(name !== undefined ? { name } : {}), ...(documentation !== undefined ? { documentation } : {}) });
    }
  }
  for (const t of terms) {
    if (elementOf.has(t.key)) continue;
    const id = archiId(`${modelId}|element|${t.key}`);
    p.create.push({ id, term: t });
    elementOf.set(t.key, id);
  }
  const keyOfTerm = new Map(terms.map((t) => [`${t.scheme}/${t.termId}`, t.key]));
  const wanted = new Set<string>();
  for (const t of terms) {
    for (const r of t.focus.relationships ?? []) {
      // A target by IRI is an element outside this graph: it cannot be drawn here.
      const targetKey = keyOfTerm.get(`${t.scheme}/${r.target}`);
      if (!targetKey) continue;
      const source = elementOf.get(t.key)!;
      const target = elementOf.get(targetKey)!;
      const sig = `${source}|${r.type}|${target}`;
      wanted.add(sig);
      if (model.relationships.some((m) => `${m.source}|${m.type}|${m.target}` === sig)) continue;
      p.relate.push({ id: archiId(`${modelId}|relationship|${sig}`), type: r.type, source, target, ...(r.accessType ? { accessType: r.accessType } : {}), from: t.key });
    }
  }
  const linkedIds = new Set(elementOf.values());
  for (const m of model.relationships) {
    if (linkedIds.has(m.source) && linkedIds.has(m.target) && !wanted.has(`${m.source}|${m.type}|${m.target}`)) p.extra.push({ id: m.id, type: m.type, source: m.source, target: m.target });
  }
  return p;
}

/** One glossary file's terms, each with the focus the model gives it: the `--seed` plan. */
export interface Seed {
  file: string;
  focus: Array<{ termId: string; focus: ArchimateFocus }>;
}

/**
 * The focus each linked, focus-less term would take from the model: the
 * element's type, and its relationships to other linked elements (by term
 * id, when both terms are in the same glossary). Groupings and junctions are
 * how a view is drawn, so they are never seeded.
 */
export function seedFrom(model: ModelLike, glossaries: Array<{ file: string; id: string; terms: Array<{ id: string; focus?: unknown }> }>): Seed[] {
  const termOf = new Map<string, { file: string; scheme: string; termId: string; hasFocus: boolean }>();
  for (const g of glossaries) for (const t of g.terms) termOf.set(`${g.file}#${t.id}`, { file: g.file, scheme: g.id, termId: t.id, hasFocus: t.focus !== undefined });
  const linked = new Map<string, { file: string; scheme: string; termId: string; hasFocus: boolean }>(); // element id -> term
  const taken = new Set<string>();
  for (const e of model.elements) {
    if (e.type === "Grouping" || e.type === "Junction") continue;
    for (const l of e.properties.filter((x) => x.key === "skosConcept")) {
      const t = termOf.get(l.value) ?? termOf.get(l.value.replace(/^.*\//, ""));
      const k = t && `${t.file}#${t.termId}`;
      if (!t || taken.has(k!)) continue; // one element per term: the first wins, as plan() reports
      taken.add(k!);
      linked.set(e.id, t);
    }
  }
  const out = new Map<string, Seed>();
  for (const e of model.elements) {
    const t = linked.get(e.id);
    if (!t || t.hasFocus) continue;
    const relationships = model.relationships
      .filter((r) => r.source === e.id && linked.get(r.target)?.file === t.file && (ARCHIMATE_RELATIONSHIPS as readonly string[]).includes(r.type))
      .map((r) => ({ type: r.type as ArchimateRelationshipType, target: linked.get(r.target)!.termId, ...(r.type === "Access" && r.accessType ? { accessType: r.accessType as "read" } : {}) }))
      .sort((a, b) => `${a.type}|${a.target}`.localeCompare(`${b.type}|${b.target}`));
    const seed = out.get(t.file) ?? { file: t.file, focus: [] };
    seed.focus.push({ termId: t.termId, focus: { archimate: e.type, ...(relationships.length ? { relationships } : {}) } });
    out.set(t.file, seed);
  }
  return [...out.values()];
}

// ── Writing ──────────────────────────────────────────────────────────────

const escAttr = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;").replace(/\n/g, "&#xD;&#xA;");
const escText = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Archi's top folder for an element type. */
export function folderTypeOf(layer: string): string {
  switch (layer) {
    case "Strategy":
      return "strategy";
    case "Business":
      return "business";
    case "Application":
      return "application";
    case "Technology":
    case "Physical":
      return "technology";
    case "Motivation":
      return "motivation";
    case "Implementation & Migration":
      return "implementation_migration";
    default:
      return "other";
  }
}

/** From `<tag` to the end of its opening tag, and to its matching close. */
function span(xml: string, id: string): { open: number; openEnd: number; selfClosing: boolean; close: number; end: number; tag: string } {
  const at = xml.indexOf(` id="${id}"`);
  if (at < 0) throw new Error(`no object with id ${id} in the model XML`);
  const open = xml.lastIndexOf("<", at);
  const tag = /^<([\w:]+)/.exec(xml.slice(open))![1]!;
  const openEnd = xml.indexOf(">", at) + 1;
  if (xml[openEnd - 2] === "/") return { open, openEnd, selfClosing: true, close: openEnd, end: openEnd, tag };
  const re = new RegExp(`<${tag}[\\s>/]|</${tag}>`, "g");
  re.lastIndex = openEnd;
  let depth = 1;
  for (let m = re.exec(xml); m; m = re.exec(xml)) {
    if (m[0].startsWith("</")) {
      if (--depth === 0) return { open, openEnd, selfClosing: false, close: m.index, end: m.index + m[0].length, tag };
    } else if (xml[xml.indexOf(">", m.index) - 1] !== "/") depth++;
  }
  throw new Error(`unclosed <${tag}> for ${id}`);
}

/** Insert `child` as the first line inside the top folder of this type. */
function intoFolder(xml: string, folderType: string, child: string): string {
  const m = new RegExp(`<folder\\b[^>]*\\btype="${folderType}"[^>]*?(/?)>`).exec(xml);
  if (!m) throw new Error(`the model has no top folder of type "${folderType}"`);
  const lineStart = xml.lastIndexOf("\n", m.index) + 1;
  const indent = xml.slice(lineStart, m.index);
  if (m[1] === "/") {
    const opened = m[0].replace(/\s*\/>$/, ">");
    return xml.slice(0, m.index) + `${opened}\n${indent}  ${child}\n${indent}</folder>` + xml.slice(m.index + m[0].length);
  }
  const at = m.index + m[0].length;
  return xml.slice(0, at) + `\n${indent}  ${child}` + xml.slice(at);
}

/** The model XML with the plan applied; `prune` also removes the extra relationships and the lines that draw them. */
export function applyPlan(xml: string, p: Plan, layerOf: (type: string) => string, opts: { prune?: boolean } = {}): string {
  let out = xml;
  for (const u of p.update) {
    const s = span(out, u.id);
    let head = out.slice(s.open, s.openEnd);
    if (u.name !== undefined) head = / name="[^"]*"/.test(head) ? head.replace(/ name="[^"]*"/, ` name="${escAttr(u.name)}"`) : head.replace(/^<[\w:]+/, (t) => `${t} name="${escAttr(u.name!)}"`);
    let body = s.selfClosing ? "" : out.slice(s.openEnd, s.close);
    if (u.documentation !== undefined) {
      const doc = `<documentation>${escText(u.documentation)}</documentation>`;
      body = /<documentation>[\s\S]*?<\/documentation>/.test(body) ? body.replace(/<documentation>[\s\S]*?<\/documentation>/, doc) : `${doc}${body}`;
    }
    const opened = head.replace(/\s*\/>$/, ">");
    const replaced = body ? `${opened}${body}</${s.tag}>` : s.selfClosing ? head : `${opened}</${s.tag}>`;
    out = out.slice(0, s.open) + replaced + out.slice(s.end);
  }
  for (const c of p.create) {
    const t = c.term;
    const doc = t.documentation ? `<documentation>${escText(t.documentation)}</documentation>` : "";
    const el = `<element xsi:type="archimate:${t.focus.archimate}" name="${escAttr(t.name)}" id="${c.id}">${doc}<property key="skosConcept" value="${escAttr(t.key)}"/></element>`;
    out = intoFolder(out, folderTypeOf(layerOf(t.focus.archimate)), el);
  }
  const ACCESS: Record<string, string> = { write: "0", read: "1", access: "2", readwrite: "3" };
  for (const r of p.relate) {
    const access = r.type === "Access" ? ` accessType="${ACCESS[r.accessType ?? "write"]}"` : "";
    out = intoFolder(out, "relations", `<element xsi:type="archimate:${r.type}Relationship" id="${r.id}" source="${r.source}" target="${r.target}"${access}/>`);
  }
  if (opts.prune) {
    for (const x of p.extra) {
      // Every line that draws it, then the relationship itself, each with its own line.
      for (let m = new RegExp(`<sourceConnection\\b[^>]*\\barchimateRelationship="${x.id}"`).exec(out); m; m = new RegExp(`<sourceConnection\\b[^>]*\\barchimateRelationship="${x.id}"`).exec(out)) {
        const cid = / id="([^"]*)"/.exec(out.slice(m.index, out.indexOf(">", m.index)))![1]!;
        out = cut(out, span(out, cid));
        out = out.replace(new RegExp(`\\s*\\btargetConnections="${cid}"`), "").replace(new RegExp(`(targetConnections="[^"]*?)\\s*\\b${cid}\\b`), "$1");
      }
      out = cut(out, span(out, x.id));
    }
  }
  return out;
}

function cut(xml: string, s: { open: number; end: number }): string {
  const lineStart = xml.lastIndexOf("\n", s.open);
  const before = xml.slice(lineStart + 1, s.open);
  return /^\s*$/.test(before) ? xml.slice(0, lineStart) + xml.slice(s.end) : xml.slice(0, s.open) + xml.slice(s.end);
}

export function report(p: Plan, model: string): string {
  const lines = [`${TOOL_ID}: model ${model} against the graph`];
  lines.push(`  ${p.linked} element(s) point at a term; ${p.unlinked} point at none (still authored only in Archi)`);
  for (const c of p.create) lines.push(`  + element ${c.term.focus.archimate} "${c.term.name}" (${c.term.key}), on no view yet`);
  for (const u of p.update) lines.push(`  ~ element ${u.id}: ${[u.name !== undefined ? `name → "${u.name}"` : "", u.documentation !== undefined ? "documentation from the definition" : ""].filter(Boolean).join(", ")}`);
  for (const r of p.relate) lines.push(`  + ${r.type} ${r.source} → ${r.target} (from ${r.from})`);
  for (const x of p.extra) lines.push(`  - ${x.type} ${x.id} (${x.source} → ${x.target}): no term lists it${""}`);
  for (const pr of p.problems) lines.push(`  ✗ ${pr}`);
  if (!p.create.length && !p.update.length && !p.relate.length && !p.extra.length && !p.problems.length) lines.push("  ✓ the model agrees with the graph");
  return lines.join("\n");
}

/**
 * Whether a model file is ingested: held under the layer's `library/`,
 * where sources are kept as received. Only such a model may seed the
 * glossary; an authored model never does.
 */
export function isIngested(root: string, file: string): boolean {
  const rel = relative(resolve(root), resolve(file));
  return !rel.startsWith("..") && !isAbsolute(rel) && rel.split(sep)[0] === "library";
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (import.meta.main) {
  const instance = arg("instance");
  const seeding = process.argv.includes("--seed");
  const from = arg("from");
  const modelId = arg("model") ?? (seeding && from ? basename(from) : undefined);
  if (!instance || !modelId) {
    console.error("usage: archimate-from-glossary.ts --instance <dir> --model <model id> [--write] [--prune] [--check] [--json]");
    console.error("       archimate-from-glossary.ts --instance <dir> --seed --from library/<entry>/<file>.archimate [--write]");
    process.exit(2);
  }
  const root = resolve(instance);
  const am = "../../cat-harness-tools/archimate";
  const { readArchimate, modelXmlOf, layerOf } = await import(`${am}/schemas/archimate.ts`);
  const { readConfig, archimateDir } = await import(`${am}/scripts/check-archimate.ts`);
  const { withModelXml } = await import(`${am}/scripts/archimate-detangle.ts`);
  let file: string;
  if (seeding && from) {
    file = resolve(root, from);
  } else {
    const config = readConfig(root) as { models: Array<{ id: string; file: string }> };
    const m = config.models.find((x) => x.id === modelId);
    if (!m) {
      console.error(`✗ no model "${modelId}" in ${basename(root)}'s ArchiMate config`);
      process.exit(2);
    }
    file = join(archimateDir(root, config), m.file);
  }
  if (seeding && !isIngested(root, file)) {
    console.error(`✗ --seed refused: ${relative(root, file)} is an authored model, not an ingested one.`);
    console.error("  An authored ArchiMate model is never a source of the glossary (owner, 2026-11-02).");
    console.error("  Only a model held under library/ (a source as received) may seed terms: pass it with --from.");
    process.exit(2);
  }
  const bytes = readFileSync(file);
  if (seeding) {
    const dir = join(root, "glossary");
    const files = existsSync(dir) ? readdirSync(dir).filter((x) => x.endsWith(".glossary.json")).sort() : [];
    const raw = new Map(files.map((f) => [f, JSON.parse(readFileSync(join(dir, f), "utf8")) as { id: string; terms: Array<Record<string, unknown> & { id: string }> }]));
    const seeds = seedFrom(readArchimate(bytes) as ModelLike, [...raw].map(([f, g]) => ({ file: f, id: g.id, terms: g.terms })));
    for (const s of seeds) {
      console.log(`${s.file}: ${s.focus.length} term(s) take their focus from model ${modelId}`);
      for (const x of s.focus) console.log(`  ${x.termId}: ${x.focus.archimate}${x.focus.relationships?.length ? `, ${x.focus.relationships.length} relationship(s)` : ""}`);
      if (!process.argv.includes("--write")) continue;
      const g = raw.get(s.file)!;
      for (const x of s.focus) {
        const t = g.terms.find((u) => u.id === x.termId)!;
        t.focus = x.focus;
      }
      GlossarySchema.parse(g); // never write a glossary the schema refuses
      writeFileSync(join(dir, s.file), `${JSON.stringify(g, null, 2)}\n`);
      console.log(`wrote glossary/${s.file}`);
    }
    if (!seeds.length) console.log("nothing to seed: no linked term is without a focus");
    process.exit(0);
  }
  const p = plan(readArchimate(bytes) as ModelLike, graphElements(root), modelId);
  if (process.argv.includes("--json")) console.log(JSON.stringify(p, null, 2));
  else console.log(report(p, modelId));
  const prune = process.argv.includes("--prune");
  const changes = p.create.length + p.update.length + p.relate.length + (prune ? p.extra.length : 0);
  if (process.argv.includes("--write") && changes) {
    writeFileSync(file, withModelXml(bytes, applyPlan(modelXmlOf(bytes), p, layerOf, { prune })));
    console.log(`wrote ${file}`);
  }
  if (process.argv.includes("--check") && (changes || p.extra.length || p.problems.length)) process.exit(1);
}
