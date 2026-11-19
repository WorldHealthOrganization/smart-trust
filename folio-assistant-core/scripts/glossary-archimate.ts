/**
 * The ArchiMate elements and views that depict each glossary term.
 *
 * Owner, 2026-10-31 (dth-pc, option A, "Through the glossary"): a block
 * links its concepts to the glossary, and the glossary entry links on to the
 * ArchiMate elements and views that depict the concept. The SKOS glossary is
 * where a concept's meaning lives; the ArchiMate model is a separately
 * authored source whose elements depict concepts. So the link from a term to
 * the model is read from the model, never written into the glossary.
 *
 * Owner, 2026-11-01 (smart-ra#166, B then A): where a term's `focus` IS an
 * ArchiMate element, the model is drawn from the glossary instead
 * (`archimate-from-glossary.ts`). The element's `skosConcept` still points
 * back at the term, so this reader is unchanged.
 *
 * An element depicts a term when
 *
 * 1. its `skosConcept` property names the term: the term's IRI, or the
 *    `<scheme>.glossary.json#<term id>` form smart-ra's DTH specs write
 *    (`tools/archimate-dth/dth_pc.py`); or
 * 2. it has no `skosConcept`, and its name is exactly the term's prefLabel,
 *    and that label belongs to one term only. The DTH specs name elements by
 *    the Capitalized KG concept (dth-pc and dth-sc AGENTS.md).
 *
 * Only a layer that declares an ArchiMate pages visualiser is read, and
 * each element links to the page `gen-archimate-pages.ts` writes for it. Of a
 * layer's models, the newest that depicts a term is the one shown.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { directoriesForGraph, instanceRootsIn, readDeclaration } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";

const ARCHIMATE_CONFIG = "cat-archimate.config.json";

/**
 * A layer's `cat-archimate.config.json`: at its root, or inside a
 * directory it declares with graph typology `archimate`; undefined when
 * neither holds one. The rule of `configPath` in cat-harness-tools'
 * `archimate/scripts/check-archimate.ts`, restated because that module is
 * reached only by a relative import, and whether there is a config at all is
 * asked BEFORE importing it, so a checkout with no ArchiMate model never needs it.
 */
export function archimateConfigPath(root: string): string | undefined {
  const atRoot = join(root, ARCHIMATE_CONFIG);
  if (existsSync(atRoot)) return atRoot;
  return directoriesForGraph(root, "archimate")
    .map((d) => join(d, ARCHIMATE_CONFIG))
    .find((p) => existsSync(p));
}

export interface Depicted {
  name: string;
  type: string;
  /** Site-root path of the element's page, with a leading slash. */
  page: string;
}
export interface Depiction {
  instance: string;
  model: string;
  elements: Depicted[];
  views: Depicted[];
}

/** One glossary term, as this module needs it. */
export interface TermRef {
  /** The anchor of its entry (`anchorOf`), which keys the result. */
  anchor: string;
  iri: string;
  scheme: string;
  id: string;
  label: string;
}

/**
 * Site-root path of the page that cat-harness-tools' gen-archimate-pages.ts
 * writes for one element or view: `/<pageRoot>/<model>/<kind>/<segment>/`.
 * The kind segment is singular (`element/`, `view/`), as the generator has
 * written it since cat-harness-tools cf14a4e (Q-THIN-4); the plural
 * `elements/` and `views/` no longer exist on a built site.
 */
export function archimatePagePath(pageRoot: string, model: string, kind: "element" | "view", segment: string): string {
  return `/${pageRoot}/${model}/${kind}/${segment}/`;
}

/** Newest first: "0.3.0-draft.1" before "0.2.0" before "0.2.0-draft.3". */
export function newestFirst(a: string, b: string): number {
  const parse = (v: string) => {
    const [core, pre] = v.split("-", 2);
    return { nums: core!.split(".").map((n) => Number(n) || 0), pre };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < Math.max(x.nums.length, y.nums.length); i++) {
    const d = (y.nums[i] ?? 0) - (x.nums[i] ?? 0);
    if (d) return d;
  }
  if (x.pre === y.pre) return 0;
  if (x.pre === undefined) return -1;
  if (y.pre === undefined) return 1;
  return y.pre.localeCompare(x.pre, "en", { numeric: true });
}

export async function archimateDepictions(repo: string, terms: readonly TermRef[]): Promise<Map<string, Depiction>> {
  const out = new Map<string, Depiction>();
  const byIri = new Map(terms.map((t) => [t.iri, t.anchor]));
  const byFile = new Map(terms.map((t) => [`${t.scheme}.glossary.json#${t.id}`, t.anchor]));
  const labelCount = new Map<string, number>();
  for (const t of terms) labelCount.set(t.label, (labelCount.get(t.label) ?? 0) + 1);
  const byLabel = new Map(terms.filter((t) => labelCount.get(t.label) === 1).map((t) => [t.label, t.anchor]));
  const conceptOf = (v: string): string | undefined => byIri.get(v) ?? [...byFile].find(([k]) => v.endsWith(`/${k}`))?.[1];

  const roots = instanceRootsIn(repo).filter((r) => archimateConfigPath(r) !== undefined);
  if (!roots.length) return out;
  // The ArchiMate reader is in cat-harness-tools' archimate/, which its package does not export.
  const am = "../../cat-harness-tools/archimate";
  const { readArchimate } = await import(`${am}/schemas/archimate.ts`);
  const { planSlugs } = await import(`${am}/schemas/slugs.ts`);
  const { declaredPageRoot } = await import(`${am}/scripts/gen-archimate-pages.ts`);
  const { readConfig, archimateDir } = await import(`${am}/scripts/check-archimate.ts`);
  for (const root of roots) {
    const decl = readDeclaration(root) as { name: string } | undefined;
    if (!decl) continue;
    let pageRoot: string;
    let config: { directory: string; models: Array<{ id: string; file: string }> };
    let dir: string;
    try {
      config = readConfig(root);
      dir = archimateDir(root, config);
      pageRoot = declaredPageRoot(decl, config.directory);
    } catch {
      continue; // no pages are written for this layer, so there is nothing to link to
    }
    const seen = new Set<string>();
    for (const m of [...config.models].sort((a, b) => newestFirst(a.id, b.id))) {
      const file = join(dir, m.file);
      if (!existsSync(file)) continue;
      const model = readArchimate(readFileSync(file)) as {
        elements: Array<{ id: string; name: string; type: string; properties: Array<{ key: string; value: string }> }>;
        views: Array<{ id: string; name: string; nodes: Array<{ kind: string; ref?: string }> }>;
      };
      const slugOf: Map<string, string> = planSlugs(model);
      const page = (kind: "element" | "view", id: string) => archimatePagePath(pageRoot, m.id, kind, slugOf.get(id) ?? id);
      const found = new Map<string, Depiction>();
      for (const e of model.elements) {
        const named = e.properties.filter((p) => p.key === "skosConcept").map((p) => conceptOf(p.value));
        const anchors = named.length ? named.filter((a): a is string => a !== undefined) : [byLabel.get(e.name)].filter((a): a is string => a !== undefined);
        for (const a of anchors) {
          if (seen.has(a)) continue;
          const d = found.get(a) ?? { instance: decl.name, model: m.id, elements: [], views: [] };
          d.elements.push({ name: e.name, type: e.type, page: page("element", e.id) });
          for (const v of model.views) {
            if (v.nodes.some((n) => n.kind === "element" && n.ref === e.id) && !d.views.some((x) => x.name === v.name)) {
              d.views.push({ name: v.name, type: "view", page: page("view", v.id) });
            }
          }
          found.set(a, d);
        }
      }
      for (const [a, d] of found) {
        seen.add(a);
        out.set(a, d);
      }
    }
  }
  return out;
}
