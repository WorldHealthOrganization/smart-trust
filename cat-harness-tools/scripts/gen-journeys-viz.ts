#!/usr/bin/env bun
/**
 * The journeys viewer: write the pages of the `journeys-viewer` visualiser a
 * layer declares — an index of every journey in the checkout, one page per
 * journey, and the workshop layer — into a site being built.
 *
 * @module scripts/gen-journeys-viz
 * @covers user-scenario, workshop
 *
 * Usage:
 *   bun run cat journeys:viz --instance <dir> [--site <site dir>]
 *
 * The pages go to the route of the visualiser `--instance` declares
 * `renderedBy: "journeys-viewer"`, `<site>/<locale>/<instance>/<id>/`
 * (`visualiserRoute`). A layer that declares none gets nothing and the
 * run exits 78 (not applicable), so a site build running every declared
 * writer (`visualiser-writers.ts`) reads it as declined rather than failed.
 * Without `--site` the pages go under the layer's own site directory.
 *
 * WHAT is drawn is read from the declarations (`journeys/read.ts`): every
 * `user-scenario` and `workshop` directory of every layer in the checkout,
 * so a downstream's site shows its own journeys and those of the layers it
 * mounts, each layer a sub-graph page. HOW is `journeys/render.ts`.
 *
 * Nothing is committed: like `archimate:pages --out`, the pages are a build
 * product of the site, and a re-run with the same inputs writes the same
 * bytes.
 *
 * ## Languages
 *
 * The pages are drawn in English, then once more for every locale the
 * declaring layer has a catalogue for, `translations/<locale>/journeys-viewer.po`,
 * at the same route under `<locale>/` (`journeys/locales.ts`). `--pot` writes
 * the templates those catalogues are made from, one per supported locale, and
 * `--pot-check` exits 1 when one is missing or stale. `--pot --merge [--locale fr,es]`
 * also brings each locale's `.po` up to its template, filling what the
 * layer's other catalogues already translate.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, posix, relative, resolve } from "node:path";

import { findDeclarationFile } from "../schemas/kg/instance-roots.js";
import { siteDirFor } from "../schemas/kg/cat-harness.js";
import { visualiserRoute } from "../schemas/kg/visualiser-route.js";
import { declaredVisualisers, pageParts } from "./viewer-declarations.ts";
import { exitNotApplicable } from "./lib/not-applicable.ts";
import { readArchimate } from "../archimate/schemas/archimate.ts";
import { planSlugs } from "../archimate/schemas/slugs.ts";
import { archimateDir, configPath, localDirOf, readConfig } from "../archimate/scripts/check-archimate.ts";
import { declaredPageRoot } from "../archimate/scripts/gen-archimate-pages.ts";
import { readJourneyCorpus, type JourneyCorpus } from "./journeys/read.ts";
import { renderJourneyPages, TOOL_ID, type ArchimateElementLink, type ArchimateViewLink, type ArchitectureBox, type ArchitecturePanel, type PageFile, type SiteLinks } from "./journeys/render.ts";
import type { ArchimateModel } from "../archimate/schemas/archimate.ts";
import { typeLabel } from "../archimate/scripts/render-view.ts";
import { subjectHref } from "./lib/subject-pages.ts";
import { panelFile } from "./lib/task-panel.ts";
import { catalogueLocales, CATALOGUE_STEM, formatJourneysPot, localizedFiles, mergeCatalogue, readCatalogue, translationMemory, type LocaleReport } from "./journeys/locales.ts";
import { readHarnessConfig, TranslationConfigSchema } from "../schemas/kg/harness-config.ts";
import { potWithoutTimestamp } from "../pipeline/pot-extract.ts";

export { TOOL_ID };

interface Decl {
  name: string;
  title?: string;
  visualisers?: { id: string; renderedBy: string }[];
  directories: { id: string; path: string }[];
}

function readDecl(root: string): Decl {
  const file = findDeclarationFile(root);
  if (file === undefined) throw new Error(`no instance declaration in ${root}`);
  return JSON.parse(readFileSync(join(root, file), "utf8")) as Decl;
}

/** The route the layer declares for this Tool, site-relative with no trailing slash; undefined when it declares none. */
export function journeysRoute(root: string): string | undefined {
  const d = readDecl(root);
  const v = (d.visualisers ?? []).find((x) => x.renderedBy === TOOL_ID);
  return v === undefined ? undefined : visualiserRoute(pageParts({ harness: d.name, visualiser: v.id })).replace(/\/$/, "");
}

/**
 * The architecture panel How it works opens with (JV-13), read from the
 * ArchiMate graph alone. Rows: the groupings `root` aggregates. Columns: the
 * `countries` groupings. A country's systems are the elements its grouping
 * aggregates, less its instances of reference blocks (those that specialize
 * one); a system's parts are what it is composed of or realizes (itself when
 * nothing). A part goes in the row of the reference block it realizes, through
 * its country's instance (Realization, then Specialization); its moments come
 * from the `bpmn` property of the processes its system serves. Undefined when
 * a ref names nothing in the model.
 */
export function architecturePanel(
  model: ArchimateModel,
  element: (id: string) => ArchimateElementLink | undefined,
  spec: { root: string; countries: readonly { group: string }[]; shared?: string },
): ArchitecturePanel | undefined {
  const byId = new Map(model.elements.map((x) => [x.id, x]));
  if (![spec.root, ...spec.countries.map((c) => c.group), ...(spec.shared ? [spec.shared] : [])].every((id) => byId.has(id))) return undefined;
  const rels = model.relationships;
  const holds = (t: string) => t === "Aggregation" || t === "Composition";
  const children = (id: string) => rels.filter((r) => holds(r.type) && r.source === id).map((r) => r.target);
  const parents = (id: string) => rels.filter((r) => holds(r.type) && r.target === id).map((r) => r.source);
  const prop = (id: string, key: string) => byId.get(id)?.properties.find((p) => p.key === key)?.value;
  const specializes = (id: string) => rels.find((r) => r.type === "Specialization" && r.source === id)?.target;
  const layers = children(spec.root).filter((id) => byId.get(id)?.type === "Grouping");
  const layerSet = new Set(layers);
  // A block some layers share (the DPI-F Information Mediator is also cross-cutting) sits in the first of them.
  const layerOf = (id: string): string | undefined => {
    const seen = new Set<string>();
    const found = new Set<string>();
    const queue = [id];
    while (queue.length) {
      const x = queue.shift()!;
      if (seen.has(x)) continue;
      seen.add(x);
      if (layerSet.has(x)) found.add(x);
      else queue.push(...parents(x));
    }
    return layers.find((l) => found.has(l));
  };
  // A row's own blocks (descending through sub-groupings), named when no country has a part there.
  const blocksIn = (id: string): string[] => children(id).flatMap((c) => (byId.get(c)?.type === "Grouping" ? blocksIn(c) : [c]));
  const rows = layers.map((l) => ({ layer: element(l)!, cells: spec.countries.map((): ArchitectureBox[] => []), blocks: blocksIn(l).flatMap((b) => element(b) ?? []) }));
  spec.countries.forEach((c, ci) => {
    for (const sys of children(c.group)) {
      if (specializes(sys) !== undefined) continue; // the country's instance of a reference block, not a system
      const bpmn = rels
        .filter((r) => r.type === "Serving" && r.source === sys && byId.get(r.target)?.type === "BusinessProcess")
        .flatMap((r) => prop(r.target, "bpmn") ?? []);
      const parts = rels
        // A Device realizes its app; an app's Realization of its country's instance is not a part.
        .filter((r) => r.source === sys && (r.type === "Composition" || (r.type === "Realization" && specializes(r.target) === undefined)))
        .map((r) => r.target)
        .filter((id) => byId.get(id)?.type === "ApplicationComponent");
      for (const part of parts.length ? parts : [sys]) {
        let block: string | undefined;
        for (const r of rels) {
          if (r.type !== "Realization" || r.source !== part) continue;
          const b = specializes(r.target) ?? r.target;
          if (layerOf(b) !== undefined) { block = b; break; }
        }
        if (block === undefined) continue;
        const row = rows[layers.indexOf(layerOf(block)!)]!;
        const link = element(part)!;
        if (row.cells[ci]!.some((x) => x.page === link.page)) continue;
        const ig = prop(part, "ig");
        row.cells[ci]!.push({ ...link, block: element(block)!, ...(ig ? { ig } : {}), bpmn });
      }
    }
  });
  return {
    countries: spec.countries.map((c) => element(c.group)!),
    rows,
    ...(spec.shared ? { shared: { group: element(spec.shared)!, members: children(spec.shared).flatMap((id) => element(id) ?? []) } } : {}),
  };
}

/** Where the links that leave the viewer go: the processes viewer's sub-graph pages, and ArchiMate views. */
export function siteLinks(corpus: JourneyCorpus, route: string, title: string): SiteLinks {
  const processes = declaredVisualisers(corpus.checkout).find((v) => v.renderedBy === "processes-viewer");
  type Placed = { views: Map<string, ArchimateViewLink>; blocks: Map<string, ArchimateElementLink[]>; models: Map<string, { model: ArchimateModel; element: (id: string) => ArchimateElementLink | undefined }> };
  const placed = new Map<string, Placed | null>();
  const archimateFor = (instance: string): Placed | undefined => {
    if (placed.has(instance)) return placed.get(instance) ?? undefined;
    let out: Placed | null = null;
    const info = corpus.instances.get(instance);
    try {
      if (info && configPath(info.root) !== undefined) {
        const config = readConfig(info.root);
        const decl = readDecl(info.root);
        const graphPath = localDirOf(info.root, archimateDir(info.root, config)).replace(/\/$/, "");
        const pageRoot = declaredPageRoot(decl as never, config.directory);
        out = { views: new Map(), blocks: new Map(), models: new Map() };
        for (const cm of config.models) {
          const model = readArchimate(readFileSync(join(archimateDir(info.root, config), cm.file)));
          const slugOf = planSlugs(model);
          // The pages and drawings `gen-archimate-pages.ts` writes: singular kind segments (Q-THIN-4 = A).
          const byId = new Map(model.elements.map((el) => [el.id, el]));
          const element = (id: string): ArchimateElementLink | undefined => {
            const el = byId.get(id);
            return el ? { name: el.name || typeLabel(el.type), type: typeLabel(el.type), page: `${posix.join(pageRoot, cm.id, "element", slugOf.get(id) ?? id)}/` } : undefined;
          };
          out.models.set(cm.id, { model, element });
          for (const v of model.views) {
            const shown = [...new Set(v.nodes.flatMap((n) => (n.kind === "element" && n.ref ? [n.ref] : [])))];
            out.views.set(`${cm.id}\0${v.id}`, {
              svg: posix.join(graphPath, cm.id, "view", `${v.id}.svg`),
              page: `${posix.join(pageRoot, cm.id, "view", slugOf.get(v.id) ?? v.id)}/`,
              name: v.name,
              elements: shown.flatMap((id) => element(id) ?? []),
            });
          }
          // A block's elements: those whose `buildingBlocks` property names it (the overlay writes it, comma-separated).
          for (const el of model.elements) {
            for (const p of el.properties) {
              if (p.key !== "buildingBlocks") continue;
              for (const b of p.value.split(/[\s,]+/).filter(Boolean)) {
                const list = out.blocks.get(b) ?? [];
                const link = element(el.id)!;
                if (!list.some((x) => x.page === link.page)) list.push(link);
                out.blocks.set(b, list);
              }
            }
          }
        }
      }
    } catch {
      out = null; // no ArchiMate pages for this layer: the view is drawn as unresolved
    }
    placed.set(instance, out);
    return out ?? undefined;
  };
  return {
    route,
    title,
    ...(processes
      ? {
          processesPage: (instance: string) => `${"../".repeat(route.split("/").length + 2)}${visualiserRoute(pageParts({ harness: processes.harness, visualiser: processes.id, subgraph: instance }))}`,
          // The ⓘ panel's sidecar the processes viewer writes for the drawing, beside its pages.
          processPanel: (_instance: string, bpmn: string) => visualiserRoute({ ...pageParts({ harness: processes.harness, visualiser: processes.id }), asset: panelFile(posix.basename(bpmn, ".bpmn")) }),
        }
      : {}),
    archimateView: (instance, model, view) => archimateFor(instance)?.views.get(`${model}\0${view}`),
    archimateBlock: (instance, block) => archimateFor(instance)?.blocks.get(block) ?? [],
    archimateArchitecture: (instance, spec) => {
      const m = archimateFor(instance)?.models.get(spec.model);
      return m ? architecturePanel(m.model, m.element, spec) : undefined;
    },
    // A step's page as the KG site's own BPMN rendering links it
    // (`render-bpmn.ts`): its subject IRI, where a page is published for it.
    stepPage: (instance, bpmn, process, task) => {
      const root = corpus.instances.get(instance)?.root;
      return root === undefined ? undefined : subjectHref(resolve(root, bpmn), "process", `${process}/node/${task}`);
    },
  };
}

/** The declaring layer's translation config, with the schema's defaults (the six UN languages, source `en`). */
export function translationConfig(root: string): { defaultLocale: string; supportedLocales: string[]; translationDir: string } {
  const raw = (readHarnessConfig(root) as { translation?: unknown } | null)?.translation ?? {};
  const parsed = TranslationConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : TranslationConfigSchema.parse({});
}

/** The pages in the source language only, site-relative. */
export function sourceJourneyFiles(instanceRoot: string): { route: string; files: PageFile[]; corpus: JourneyCorpus } | undefined {
  const route = journeysRoute(instanceRoot);
  if (route === undefined) return undefined;
  const decl = readDecl(instanceRoot);
  const corpus = readJourneyCorpus(instanceRoot);
  const files = renderJourneyPages(corpus, siteLinks(corpus, route, decl.title ?? decl.name), decl.name).map((f) => ({ ...f, path: posix.join(route, f.path) }));
  return { route, files, corpus };
}

/** Every file the run writes, site-relative: the source pages, then each locale's ({@link localizedFiles}). */
export function journeyFiles(instanceRoot: string): { route: string; routes: string[]; files: PageFile[]; corpus: JourneyCorpus; reports: LocaleReport[] } | undefined {
  const src = sourceJourneyFiles(instanceRoot);
  if (src === undefined) return undefined;
  const t = translationConfig(instanceRoot);
  const locales = catalogueLocales(instanceRoot, t.supportedLocales.filter((l) => l !== t.defaultLocale), t.translationDir);
  const catalogues = new Map(locales.map((l) => [l, readCatalogue(instanceRoot, l, t.translationDir)] as const));
  const { files, reports } = localizedFiles(src.files, catalogues, t.defaultLocale);
  const routes = [src.route, ...locales.map((l) => src.route.replace(/^[^/]+\//, `${l}/`))];
  return { route: src.route, routes, files, corpus: src.corpus, reports };
}

/**
 * Bring `translations/<locale>/journeys-viewer.po` up to its template for each
 * locale in `locales` (every supported one when empty): translations kept, new
 * msgids filled from the layer's other catalogues where they match exactly,
 * the rest left empty for a translator. Creating the file is what publishes
 * the locale, so this runs only when asked (`--merge`).
 */
export function mergeJourneysPos(instanceRoot: string, locales: readonly string[]): { locale: string; fromMemory: number; translated: number; total: number }[] {
  const t = translationConfig(instanceRoot);
  const out: { locale: string; fromMemory: number; translated: number; total: number }[] = [];
  for (const l of t.supportedLocales.filter((x) => x !== t.defaultLocale && (locales.length === 0 || locales.includes(x)))) {
    const potPath = join(instanceRoot, t.translationDir, l, `${CATALOGUE_STEM}.pot`);
    if (!existsSync(potPath)) continue;
    const poPath = potPath.replace(/\.pot$/, ".po");
    const r = mergeCatalogue(readFileSync(potPath, "utf8"), existsSync(poPath) ? readFileSync(poPath, "utf8") : undefined, translationMemory(instanceRoot, l, t.translationDir));
    writeFileSync(poPath, r.text);
    out.push({ locale: l, fromMemory: r.fromMemory, translated: r.translated, total: r.total });
  }
  return out;
}

/** Write (or with `check`, compare) `translations/<locale>/journeys-viewer.pot` for every supported locale; the paths that were stale. */
export function writeJourneysPots(instanceRoot: string, check: boolean): string[] {
  const src = sourceJourneyFiles(instanceRoot);
  if (src === undefined) return [];
  const t = translationConfig(instanceRoot);
  const name = readDecl(instanceRoot).name;
  const stale: string[] = [];
  for (const l of t.supportedLocales.filter((x) => x !== t.defaultLocale)) {
    const pot = formatJourneysPot(src.files, l, name);
    const p = join(instanceRoot, t.translationDir, l, `${CATALOGUE_STEM}.pot`);
    if (existsSync(p) && potWithoutTimestamp(readFileSync(p, "utf8")) === potWithoutTimestamp(pot)) continue;
    stale.push(relative(instanceRoot, p));
    if (!check) {
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, pot);
    }
  }
  return stale;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (import.meta.main) {
  const instance = arg("instance");
  if (!instance) {
    console.error("usage: gen-journeys-viz.ts --instance <dir> [--site <site dir>]");
    process.exit(2);
  }
  const root = resolve(instance);
  if (process.argv.includes("--pot") || process.argv.includes("--pot-check")) {
    const check = process.argv.includes("--pot-check");
    const stale = writeJourneysPots(root, check);
    for (const p of stale) console.log(`${check ? "  ✗ stale" : "  wrote"} ${p}`);
    if (check && stale.length) {
      console.error(`${stale.length} journeys-viewer template(s) missing or stale: bun run cat journeys:viz --instance ${instance} --pot`);
      process.exit(1);
    }
    console.log(`✓ journeys-viewer templates ${check ? "current" : "written"}`);
    if (!check && process.argv.includes("--merge")) {
      const only = (arg("locale") ?? "").split(",").filter(Boolean);
      for (const r of mergeJourneysPos(root, only)) console.log(`  ${r.locale}: ${r.translated}/${r.total} translated (${r.fromMemory} from the layer's other catalogues)`);
    }
    process.exit(0);
  }
  const out = journeyFiles(root);
  if (out === undefined) {
    exitNotApplicable("journeys:viz", `${readDecl(root).name} declares no visualiser renderedBy ${TOOL_ID}`);
  }
  const siteArg = arg("site");
  const site = siteArg !== undefined ? resolve(siteArg) : (() => {
    const d = siteDirFor(root);
    return isAbsolute(d) ? d : join(root, d);
  })();
  // The route is this Tool's alone, so what an earlier run left there is replaced whole.
  const target = join(site, out.route);
  for (const r of out.routes) {
    const t = join(site, r);
    if (existsSync(t)) rmSync(t, { recursive: true, force: true });
  }
  for (const f of out.files) {
    const p = join(site, f.path);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, f.content);
  }
  const pages = out.files.filter((f) => f.path.endsWith("index.html") && f.path.startsWith(`${out.route}/`)).length;
  for (const p of out.corpus.problems) console.warn(`! ${p.instance}/${p.file}: ${p.message}`);
  for (const r of out.reports) {
    console.log(`  ${r.locale}: ${r.pages} page(s), ${r.translated} segment(s) translated, ${r.untranslated} left in the source language${r.rejected.length ? `, ${r.rejected.length} translation(s) refused for their placeholders` : ""}`);
    for (const m of r.rejected.slice(0, 5)) console.warn(`    ! ${r.locale}: placeholders differ from the msgid: ${m.slice(0, 100)}`);
  }
  console.log(
    `wrote ${pages} page(s) in ${relative(process.cwd(), target) || "."}/ — ${out.corpus.journeys.length} journey(s), ${out.corpus.workshops.length} workshop(s) across ${new Set(out.corpus.journeys.map((j) => j.instance)).size} instance(s)`,
  );
}
