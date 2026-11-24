#!/usr/bin/env bun
/**
 * ig-site-sidecars.ts: smart-base's step in an IG repository's site, the
 * checkout script `ig-site:sidecars`. It writes the IG's DAK API sidecars from
 * the cached AST and hands them to fhir-harness, which binds and serves them.
 *
 *   bun run smart-base/scripts/ig-site-sidecars.ts [--ig <checkout>] [--work <dir>]
 *
 * ## Why it is here
 *
 * Owner, 2026-10-14, on an IG repository (the WHO SMART Trust IG) that lost its DAK API
 * sidecars when it dropped its own `site.build`: *"that should already be
 * there in smart-base (dak api)"*. An IG repository declares no steps of its
 * own; it names this layer as its site's landing (`index.config.json`
 * `"site": {"landing": "smart-base"}`), and the site route
 * (cat-harness-tools `stage-local.ts`) runs the `ig-site:sidecars` step that
 * the landing layer provides. This file is that step for every IG built on
 * smart-base, so no IG repository carries a copy.
 *
 * ## What it does, and what it leaves to fhir-harness
 *
 * 1. Runs fhir-harness's `ig-api-gen.ts` over the AST `ig-site:ast`
 *    restored (`<ig>/output-ast`): the ValueSet schemas, displays and
 *    JSON-LD vocabularies, the logical-model schemas, their OpenAPI wrappers,
 *    the enumeration schemas and the Swagger page `openapi/index.html`. It is
 *    the generic port of WHO's post-processing generators (owner, 2026-10-23,
 *    bean `h7ap`); this layer passes only what WHO calls things: the label and
 *    the JSON-LD prefix of its data types ({@link DAK_VOCAB_BASE}). The
 *    per-artefact files land in `<work>/ig-api/sidecars/`, the rest in
 *    `<work>/ig-api/site/`, at the paths a site root serves them.
 *    The hub page itself is fhir-harness's (`ig-api-hub.ts`, bean `h7ap`):
 *    it draws the hub from the artefact index's bound sidecars, at the IG's
 *    page holding the marker this step's descriptor names (`placeholder`),
 *    under the label it names. Nothing here writes a hub page.
 * 2. Leaves the files in `<work>/ig-api/sidecars/` and writes
 *    `<work>/ig-api/ig-api.json`, saying what the IG calls them: `DAK API`
 *    when the IG declares a DAK (`index.config.json#contentTypes.dak`, or a legacy `dak.json`), and no label
 *    otherwise, so fhir-harness's own default, "IG API", stands.
 *
 * fhir-harness's `ig-site:compose` and `ig-site:publisher-pages` read that
 * directory and descriptor (its `ig-repo-site.ts`, §"What a layer above
 * leaves"). The DAK name stays here: fhir-harness must not know it
 * (`check:fhir-harness-exclusions`).
 *
 * `<work>` is the site build's work directory, `SITE_WORK` when the build runs
 * the step.
 *
 * @module smart-base/scripts/ig-site-sidecars
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { readIgDakMetadata } from "./ig-dak-metadata.ts";


/** fhir-harness's names for the handshake (`ig-repo-site.ts` `IG_API_WORK`, `IG_API_DESCRIPTOR`). */
export const IG_API_WORK = "ig-api";
export const IG_API_DESCRIPTOR = "ig-api.json";
/** Under `ig-api/`: files served verbatim at the site root (`ig-repo-site.ts` `IG_API_SITE`). */
export const IG_API_SITE = "site";
/** What a DAK calls its sidecars. */
export const DAK_API_LABEL = "DAK API";

/** The JSON-LD prefix a DAK's vocabularies give FHIR data types: smart-base's own `DataTypes.jsonld`. */
export const DAK_VOCAB_BASE = "https://smart.who.int/base/DataTypes.jsonld#";

/** The marker an IG's own hub page holds where the hub goes (`generate_dak_api_hub.py`'s). */
export const HUB_MARKER = "<!-- DAK_API_CONTENT -->";

/**
 * The descriptor this step writes for an IG: the DAK label when it declares a
 * DAK, none otherwise; and the marker a page of the IG's own holds where this
 * layer's hub page goes.
 */
export function descriptorFor(ig: string): { label?: string; placeholder: string } {
  return { ...(readIgDakMetadata(ig) !== undefined ? { label: DAK_API_LABEL } : {}), placeholder: HUB_MARKER };
}

export function igSiteSidecars(o: { ig: string; work: string; log?: (s: string) => void }): { files: number; label?: string; placeholder: string } {
  const log = o.log ?? ((s: string) => console.error(s));
  const ig = resolve(o.ig);
  const ast = join(ig, "output-ast");
  if (!existsSync(join(ast, "manifest.json"))) throw new Error(`${ast}: no AST — the site route's ig-site:ast step restores it first`);
  const dir = join(resolve(o.work), IG_API_WORK);
  const sidecars = join(dir, "sidecars");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(sidecars, { recursive: true });
  const site = join(dir, IG_API_SITE);
  const d = descriptorFor(ig);
  const gen = join(import.meta.dir, "..", "..", "fhir-harness", "scripts", "ig-api-gen.ts");
  if (!existsSync(gen)) throw new Error(`${gen}: fhir-harness is not mounted beside this layer, so the IG API cannot be generated`);
  const r = spawnSync("bun", ["run", gen, "--ast", ast, "--out", sidecars, "--site", site, "--label", d.label ?? "IG API", "--vocab-base", DAK_VOCAB_BASE], { cwd: ig, stdio: ["ignore", "inherit", "inherit"] });
  if (r.status !== 0) throw new Error(`ig-api-gen.ts exited ${r.status}: the IG's sidecars were not written`);
  writeFileSync(join(dir, IG_API_DESCRIPTOR), `${JSON.stringify(d, null, 2)}\n`);
  const files = readdirSync(sidecars).length;
  log(`ig-site:sidecars: ${files} sidecar file(s) in ${sidecars}${d.label ? `, called "${d.label}"` : " (not a DAK: no label, the IG API default stands)"}; ${existsSync(join(site, "openapi", "index.html")) ? "openapi/index.html" : "no OpenAPI page"} in ${site}`);
  return { files, ...d };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (k: string) => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const work = opt("--work") ?? process.env.SITE_WORK;
  if (!work) {
    console.error("usage: ig-site-sidecars.ts [--ig <checkout>] [--work <dir>]  (SITE_WORK from the site build when --work is absent)");
    process.exit(2);
  }
  try {
    igSiteSidecars({ ig: opt("--ig") ?? ".", work });
  } catch (e) {
    console.error(`✗ ig-site:sidecars: ${(e as Error).message}`);
    process.exit(1);
  }
}
