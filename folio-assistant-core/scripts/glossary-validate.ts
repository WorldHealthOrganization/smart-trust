#!/usr/bin/env bun
/**
 * Check a layer's glossary and its links into the layers it mounts.
 *
 *   bun run folio-assistant-core/scripts/glossary-validate.ts --instance <name> [--repo .] [--capitalized]
 *
 * The cross-layer glossary validator of the L2 DTH plan (litlfred/dth-pc#2,
 * PC-6; dth-hrh#47). It started as dth-pc's `scripts/glossary/validate.ts`
 * and moved here because a validator is the platform's, not a folio's
 * (dth-pc AGENTS.md; owner, 2026-10-31). Every layer calls this one copy.
 *
 * It checks:
 *
 * - every scheme in `<repo>/glossary/*.glossary.json`, and in each mount, parses
 *   as `folio-glossary/v1` (which already refuses a bare id naming no term);
 * - every `broader`, `related` and SKOS match (`exactMatch`, `closeMatch`,
 *   `broadMatch`, `narrowMatch`) that names this layer's namespace, or a
 *   MOUNTED layer's, names a term that exists there. A match into a
 *   namespace that is not mounted (GS1, HL7, …) is not checked, nor is an
 *   IRI into a mounted namespace outside its `glossary/` (a vocabulary class);
 * - every concept a block names in `meta.glossary` exists, here or in a mount;
 * - every ArchiMate element or view a block names in `meta.archimate`, and
 *   every figure-to-view mapping, exists in a mounted layer's model, or,
 *   for an IRI under this layer's own `iriBase`, in its own model;
 * - the overlay rule, for a layer whose own `archimate/` model tags its
 *   items `overlay:base` or `overlay:owner` (a DTH's overlay on smart-ra): every
 *   element and relationship is a reference copy of a mounted item (same id,
 *   named by IRI) or owned by this layer and not in the base model; an
 *   `overlay:dth` copy from another DTH's overlay is noted, not checked;
 * - with `--capitalized`, every prefLabel starts with a capital (the DTH rule
 *   that KG concepts are Capitalized; owner, 2026-10-31). A name written
 *   with one lower-case letter before a capital, such as iHRIS or mHealth,
 *   counts as Capitalized: that is how its owner spells it.
 *
 * A mounted layer is any directory `<repo>/<d>/` holding `<d>.json`. It
 * reports each failure and exits 1 if there is one. ArchiMate links are
 * reported as unchecked, not failed, when no mounted layer holds a model,
 * or holds the model but not the version the link names.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { folioDir } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";
import { GlossarySchema } from "../schemas/glossary.ts";
import { archimateConfigPath } from "./glossary-archimate.ts";
import { instanceNs } from "./glossary-page.ts";

const MATCHES = ["exactMatch", "closeMatch", "broadMatch", "narrowMatch"] as const;

export interface Instance {
  name: string;
  ns: string;
  root: string;
  /** The declared `iriBase`, under which the layer's own ArchiMate IRIs sit. */
  iriBase?: string;
}

type Glossary = ReturnType<typeof GlossarySchema.parse>;

export interface Report {
  errors: string[];
  notes: string[];
}

/**
 * An ArchiMate node IRI, read as `{ model, kind, id }` with the kind plural,
 * as the model's id sets are keyed. Two forms: the slash IRI the site writes
 * now, `…/archimate/<model>/element/<id>` (cat-harness-tools Q-THIN-2 A,
 * issue #1830), and the older `…/archimate/<model>/elements/<id>.jsonld`
 * the DTH overlays were tagged with first (owner, Q-RAL-2 C, 2026-11-12).
 */
export function archimateIriOf(iri: string): { iri: string; model: string; kind: "elements" | "relationships" | "views"; id: string } | undefined {
  const m = iri.match(/\/archimate\/([^/]+)\/(?:(element|relationship|view)s\/([^/]+)\.jsonld|(element|relationship|view)\/([^/.]+))$/);
  if (!m) return undefined;
  const kind = `${m[2] ?? m[4]}s` as "elements" | "relationships" | "views";
  return { iri, model: m[1]!, kind, id: (m[3] ?? m[5])! };
}

function instanceAt(root: string, file: string): Instance {
  const d = JSON.parse(readFileSync(join(root, file), "utf-8"));
  return { name: d.name, ns: instanceNs(d.name, d.stub, d), root, iriBase: d.iriBase };
}

/** Every term and scheme IRI a layer's `glossary/` declares. */
function glossaryOf(
  inst: Instance,
  errors: string[] = [],
): { known: Set<string>; bareIds: Set<string>; docs: Array<{ f: string; g: Glossary }> } {
  const dir = join(inst.root, "glossary");
  const known = new Set<string>();
  const bareIds = new Set<string>();
  const docs: Array<{ f: string; g: Glossary }> = [];
  if (!existsSync(dir)) return { known, bareIds, docs };
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".glossary.json")).sort()) {
    const parsed = GlossarySchema.safeParse(JSON.parse(readFileSync(join(dir, f), "utf-8")));
    if (!parsed.success) {
      for (const i of parsed.error.issues) errors.push(`${inst.name} ${f}: ${i.path.join(".")}: ${i.message}`);
      continue;
    }
    const g = parsed.data;
    known.add(`${inst.ns}glossary/${g.id}`);
    for (const t of g.terms) {
      known.add(t.iri ?? `${inst.ns}glossary/${g.id}/${t.id}`);
      bareIds.add(t.id);
    }
    docs.push({ f, g });
  }
  return { known, bareIds, docs };
}

/** The layers mounted at the repository root: `<d>/<d>.json`. */
export function mountedInstances(repo: string, self: string): Instance[] {
  const out: Instance[] = [];
  for (const d of readdirSync(repo).sort()) {
    if (d === self || d.startsWith(".") || d === "node_modules") continue;
    const p = join(repo, d);
    if (!statSync(p).isDirectory() || !existsSync(join(p, `${d}.json`))) continue;
    try {
      out.push(instanceAt(p, `${d}.json`));
    } catch {
      // not a layer declaration
    }
  }
  return out;
}

function walkTs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walkTs(join(dir, e.name)) : e.name.endsWith(".ts") ? [join(dir, e.name)] : [],
  );
}

/** The parts of a block's meta this validator reads. */
export interface Meta {
  glossary?: Array<string | { iri?: unknown }>;
  glossaryTerms?: Array<string | { iri?: unknown }>;
  archimate?: {
    elements?: Array<{ iri?: unknown; name?: unknown }>;
    views?: Array<{ iri?: unknown; name?: unknown }>;
    figures?: Array<{ figure?: unknown; model?: unknown; view?: unknown }>;
  };
  [key: string]: unknown;
}

/**
 * A block's `meta: { … }` object, read as JSON whether it is written on one
 * line or pretty-printed over several. `undefined` if there is none or it is
 * not JSON.
 */
export function metaOf(src: string): Meta | undefined {
  const start = src.search(/\bmeta:\s*\{/);
  if (start < 0) return undefined;
  const open = src.indexOf("{", start);
  let depth = 0;
  let inStr = false;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      try {
        return JSON.parse(src.slice(open, i + 1));
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

/** Starts with a capital, or is a name like iHRIS or mHealth (one lower-case letter, then a capital). */
export const CAPITALIZED = /^(?:[A-Z]|[a-z][A-Z])/;

export async function validate(repo: string, instance: string, opts: { capitalized?: boolean } = {}): Promise<Report> {
  const errors: string[] = [];
  const notes: string[] = [];
  const self = instanceAt(repo, `${instance}.json`);
  const mounted = mountedInstances(repo, instance);
  const here = glossaryOf(self, errors);
  const there = new Map(mounted.map((m) => [m, glossaryOf(m, errors).known]));

  const checkRef = (ctx: string, r: string) => {
    if (!r.includes("://")) {
      if (!here.bareIds.has(r)) errors.push(`${ctx}: bare id "${r}" is not a term in ${self.name}`);
      return;
    }
    if (r.startsWith(self.ns)) {
      if (!here.known.has(r)) errors.push(`${ctx}: ${r} is not a term in ${self.name}`);
      return;
    }
    const inst = mounted.find((x) => r.startsWith(x.ns));
    if (!inst) return;
    // Only glossary IRIs are glossary terms; a class of the layer's own
    // vocabulary (a `ns/BusinessProcess` class) is not checked here.
    if (!r.startsWith(`${inst.ns}glossary/`)) {
      otherIris.set(inst.name, (otherIris.get(inst.name) ?? 0) + 1);
      return;
    }
    if (!there.get(inst)!.has(r)) errors.push(`${ctx}: ${r} is not a term in ${inst.name}`);
  };
  const otherIris = new Map<string, number>();

  for (const { f, g } of here.docs) {
    for (const t of g.terms) {
      // prefLabel is a string or a language map; every label must be Capitalized.
      const labels = typeof t.prefLabel === "string" ? [t.prefLabel] : Object.values(t.prefLabel);
      for (const l of labels) {
        if (opts.capitalized && !CAPITALIZED.test(l)) errors.push(`${f}: ${t.id} prefLabel "${l}" is not Capitalized`);
      }
      for (const b of t.broader ?? []) checkRef(`${f}: ${t.id} broader`, b);
      for (const r of t.related ?? []) checkRef(`${f}: ${t.id} related`, r);
      for (const m of MATCHES) for (const r of t[m] ?? []) checkRef(`${f}: ${t.id} ${m}`, r);
    }
    const linked = g.terms.filter((t) => MATCHES.some((m) => t[m]?.length)).length;
    notes.push(`${f}: ${g.terms.length} terms (${linked} matched to another scheme)`);
  }

  // ArchiMate models of every mounted layer, keyed by model id, and this
  // layer's own models (a DTH's overlay, linked under its own IRI base).
  type Ids = { elements: Set<string>; relationships: Set<string>; views: Set<string> };
  type Item = { id: string; name?: string; properties: Array<{ key: string; value: string }> };
  type Loaded = { id: string; ids: Ids; items: Record<keyof Ids, Item[]> };
  const models = new Map<string, Ids>();
  const unmountedModels = new Map<string, number>();
  const loadModels = async (root: string): Promise<Loaded[]> => {
    // The config and the directory it names, as the layer declares them,
    // not a spelled `archimate/`.
    const cfgPath = archimateConfigPath(root);
    if (cfgPath === undefined) return [];
    const { archimateDir } = await import("../../cat-harness-tools/archimate/scripts/check-archimate.ts");
    const cfg = JSON.parse(readFileSync(cfgPath, "utf-8"));
    let dir: string;
    try {
      dir = archimateDir(root, cfg);
    } catch {
      return [];
    }
    const { readArchimate } = await import("../../cat-harness-tools/archimate/schemas/archimate.ts");
    const out: Loaded[] = [];
    for (const cm of cfg.models ?? []) {
      const p = join(dir, cm.file);
      if (!existsSync(p)) continue;
      const model = readArchimate(readFileSync(p));
      const items = { elements: model.elements, relationships: model.relationships, views: model.views } as Record<keyof Ids, Item[]>;
      const ids = {
        elements: new Set(items.elements.map((e) => e.id)),
        relationships: new Set(items.relationships.map((e) => e.id)),
        views: new Set(items.views.map((e) => e.id)),
      };
      out.push({ id: String(cm.id), ids, items });
    }
    return out;
  };
  for (const m of mounted) for (const l of await loadModels(m.root)) models.set(l.id, l.ids);
  const ownModels = await loadModels(repo);
  const own = new Map(ownModels.map((l) => [l.id, l.ids]));
  const ownBase = self.iriBase ? `${self.iriBase.replace(/\/?$/, "/")}archimate/` : undefined;

  // The overlay rule: a DTH builds an overlay on the reference architecture
  // and does not add to it. Every element and relationship of its own model is
  // a reference copy (`overlay:base`, the mounted item's IRI, same id) or its
  // own (`overlay:owner` = this layer), and an item it owns is not already
  // in a mounted model. A view may carry either tag. Checked only for a model
  // that tags at least one item, so a layer that is not an overlay passes.
  for (const l of ownModels) {
    const all = [...l.items.elements, ...l.items.relationships, ...l.items.views];
    if (!all.some((x) => x.properties.some((p) => p.key.startsWith("overlay:")))) {
      if (models.size) notes.push(`${self.name} archimate ${l.id}: no overlay:base or overlay:owner tags, overlay rule not checked`);
      continue;
    }
    // The base versions are the mounted models its reference copies name. An
    // owned item must not be in them; one that is in another mounted version
    // (a newer draft still to drop it) is noted.
    const baseVersions = new Set(
      all.map((x) => archimateIriOf(x.properties.find((p) => p.key === "overlay:base")?.value ?? "")?.model).filter((v): v is string => !!v),
    );
    const elsewhere = new Map<string, number>();
    let base = 0;
    let owned = 0;
    let fromDth = 0;
    for (const kind of ["elements", "relationships", "views"] as const) {
      for (const x of l.items[kind]) {
        const ctx = `${self.name} archimate ${l.id}: ${kind.slice(0, -1)} '${x.name ?? x.id}' (${x.id})`;
        const b = x.properties.find((p) => p.key === "overlay:base")?.value;
        const o = x.properties.find((p) => p.key === "overlay:owner")?.value;
        if (b) {
          const hit = archimateIriOf(b);
          if (!hit || hit.kind !== kind) errors.push(`${ctx}: overlay:base is not an ArchiMate ${kind.slice(0, -1)} IRI: ${b}`);
          else if (hit.id !== x.id) errors.push(`${ctx}: overlay:base names ${hit.id}, not its own id`);
          else if (!models.has(hit.model)) unmountedModels.set(hit.model, (unmountedModels.get(hit.model) ?? 0) + 1);
          else if (!models.get(hit.model)![kind].has(x.id)) errors.push(`${ctx}: overlay:base names an item mounted model ${hit.model} does not hold`);
          else base++;
        } else if (o) {
          if (o !== self.name) errors.push(`${ctx}: overlay:owner is ${o}, not ${self.name}`);
          for (const [v, ids] of models) {
            if (!ids[kind].has(x.id)) continue;
            if (baseVersions.has(v)) errors.push(`${ctx}: owned by the overlay, but its base model ${v} already holds it; tag it overlay:base`);
            else elsewhere.set(v, (elsewhere.get(v) ?? 0) + 1);
          }
          owned++;
        } else if (x.properties.some((p) => p.key === "overlay:dth")) {
          // A copy from another DTH's overlay (dth-sfp borrows from dth-phc).
          fromDth++;
        } else if (kind !== "views") {
          errors.push(`${ctx}: has neither overlay:base nor overlay:owner=${self.name}`);
        }
      }
    }
    notes.push(`${self.name} archimate ${l.id} overlay on ${[...baseVersions].join(", ") || "no base"}: ${owned} owned, ${base} reference copies checked`);
    if (fromDth) notes.push(`${fromDth} item(s) of the ${self.name} overlay are overlay:dth copies from another DTH's overlay: not checked`);
    for (const [v, n] of elsewhere) notes.push(`${n} item(s) the ${self.name} overlay owns are also in mounted model ${v}, which it does not overlay`);
  }
  let glosLinks = 0;
  let archLinks = 0;
  let unchecked = 0;
  for (const file of walkTs(join(folioDir(repo), instance))) {
    const src = readFileSync(file, "utf-8");
    // As keys: a chapter manifest's `dir: "glossary"` is not a link.
    if (!/"(archimate|glossary|glossaryTerms)"\s*:/.test(src)) continue;
    const meta = metaOf(src);
    if (!meta) {
      errors.push(`${file}: names "archimate" or "glossary" but its meta is not a JSON object`);
      continue;
    }
    // `glossary: [{ iri, … }]`, or the older `glossaryTerms: [iri]` (dth-phc).
    for (const [key, list] of [["glossary", meta.glossary], ["glossaryTerms", meta.glossaryTerms]] as const) {
      for (const gEntry of Array.isArray(list) ? list : []) {
        glosLinks++;
        checkRef(`${file} meta.${key}`, String(typeof gEntry === "string" ? gEntry : gEntry.iri));
      }
    }
    const a = meta.archimate;
    if (!a) continue;
    for (const x of [...(a.elements ?? []), ...(a.views ?? [])]) {
      const parsed = archimateIriOf(String(x.iri));
      // Links name elements and views only.
      const hit = parsed && parsed.kind !== "relationships" ? ([parsed.iri, parsed.model, parsed.kind, parsed.id] as const) : null;
      // A link into this layer's own model (its overlay).
      if (ownBase && hit && String(x.iri).startsWith(ownBase)) {
        archLinks++;
        if (!own.has(hit[1])) errors.push(`${file}: ${x.iri} (${x.name}) names model ${hit[1]}, which ${self.name} does not hold`);
        else if (!own.get(hit[1])![hit[2] as "elements" | "views"].has(hit[3])) {
          errors.push(`${file}: ${x.iri} (${x.name}) is not in ${self.name}'s ArchiMate model ${hit[1]}`);
        }
        continue;
      }
      if (!models.size) {
        unchecked++;
        continue;
      }
      if (hit && !models.has(hit[1])) {
        // A model version the mount does not hold (an older pin): not checked.
        unmountedModels.set(hit[1], (unmountedModels.get(hit[1]) ?? 0) + 1);
        continue;
      }
      archLinks++;
      if (!hit || !models.get(hit[1])![hit[2] as "elements" | "views"].has(hit[3])) {
        errors.push(`${file}: ${x.iri} (${x.name}) is not in a mounted ArchiMate model`);
      }
    }
    for (const fm of models.size ? (a.figures ?? []) : []) {
      if (!models.has(String(fm.model))) {
        unmountedModels.set(String(fm.model), (unmountedModels.get(String(fm.model)) ?? 0) + 1);
        continue;
      }
      archLinks++;
      if (!models.get(String(fm.model))?.views.has(String(fm.view))) {
        errors.push(`${file}: figure ${fm.figure} view ${fm.view} is not in mounted ArchiMate model ${fm.model}`);
      }
    }
  }
  notes.push(`glossary links from blocks: ${glosLinks}; ArchiMate links and figure mappings: ${archLinks}`);
  for (const [name, n] of otherIris) {
    notes.push(`${n} link(s) into ${name} name something other than a glossary term (a vocabulary class): not checked`);
  }
  for (const [model, n] of unmountedModels) {
    notes.push(`${n} ArchiMate link(s) name model ${model}, which no mounted instance holds (repin it to check them): not checked`);
  }
  if (unchecked) notes.push(`${unchecked} ArchiMate link(s) from blocks, but no mounted instance holds a model: not checked`);
  notes.push(`mounted instances: ${mounted.map((m) => m.name).join(", ") || "none"}`);
  return { errors, notes };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const at = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const instance = at("--instance");
  if (!instance) {
    console.error("usage: glossary-validate.ts --instance <name> [--repo .] [--capitalized]");
    process.exit(2);
  }
  const r = await validate(at("--repo") ?? ".", instance, { capitalized: args.includes("--capitalized") });
  for (const n of r.notes) console.log(`· ${n}`);
  for (const e of r.errors) console.error(`✗ ${e}`);
  console.log(r.errors.length ? `✗ ${r.errors.length} problem(s)` : "✓ glossary and links resolve");
  process.exit(r.errors.length ? 1 : 0);
}
