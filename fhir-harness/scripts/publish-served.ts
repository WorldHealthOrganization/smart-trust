#!/usr/bin/env bun
/**
 * Publish an IG layer's SERVED directories into its own built site.
 *
 * On the main site `mount-instance-docs.ts` publishes every `served: true`
 * directory at `/<instance>/<path>`. An IG repository's OWN site
 * (`templates/ig-repo-site/folio-site.yml`, since replaced by `site-publish.yml`) is that layer alone, at the
 * site root, and copied exactly one served directory by hand —
 * `fhir-artifact-index`. Every other one was missing, and the first casualty
 * was the `openapi` graph: the WHO SMART Trust IG's pages link `openapi/index.html`
 * (deep links `#/<tag>/<operationId>` too), which `gen-openapi-pages` writes
 * into that graph, and 43 links on the WHO SMART Trust IG's gh-pages led nowhere
 * (measured 2026-10-09). Owner, same day: *"openapi fix links so point to new
 * openapi render pipeline"*.
 *
 * So the list is READ from the declaration, never written in the workflow: a
 * served directory declared later is published without anyone editing a
 * workflow in every IG repository.
 *
 * Verbatim, like the main site's mount: no Liquid, no layout. A destination
 * that already exists in the built site is REFUSED, not merged — the site
 * already publishes something at that URL, and two answers for one URL is the
 * defect `mount-instance-docs` refuses for the same reason.
 *
 * Usage (from the folio-assistant checkout, after `jekyll build`):
 *   bun run fhir-harness/scripts/publish-served.ts --instance <name> --site <built site>
 *
 * @module fhir-harness/scripts/publish-served
 */
import { cpSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { servedDirectories, type Served } from "../../cat-harness-tools/scripts/mount-instance-docs.ts";

export interface ServedPlan {
  copy: Array<{ from: string; to: string }>;
  refused: string[];
}

/**
 * Which of `served` belong to `instance`, and where each lands in a site whose
 * root IS that layer: the route without its `<instance>/` prefix.
 */
export function planServed(served: Served[], instance: string, site: string, exists: (p: string) => boolean = existsSync): ServedPlan {
  const plan: ServedPlan = { copy: [], refused: [] };
  for (const s of served) {
    if (s.name !== instance) continue;
    const rel = s.route.slice(instance.length + 1);
    const to = join(site, rel);
    if (!exists(s.dir)) plan.refused.push(`${rel}/ is declared served, but ${s.dir} does not exist`);
    else if (exists(to)) plan.refused.push(`${rel}/ is declared served, but the site already publishes something there`);
    else plan.copy.push({ from: s.dir, to });
  }
  return plan;
}

function main(): number {
  const arg = (k: string) => {
    const i = process.argv.indexOf(`--${k}`);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  const instance = arg("instance");
  const site = arg("site");
  if (!instance || !site) {
    console.error("usage: publish-served.ts --instance <name> --site <built site>");
    return 2;
  }
  const plan = planServed(servedDirectories(), instance, resolve(site));
  for (const c of plan.copy) {
    cpSync(c.from, c.to, { recursive: true });
    console.log(`served ${c.to} — verbatim, from ${c.from}`);
  }
  if (!plan.copy.length && !plan.refused.length) console.log(`${instance} declares no served directory`);
  for (const r of plan.refused) console.error(`REFUSED: ${r}`);
  return plan.refused.length ? 1 : 0;
}

if (import.meta.main) process.exit(main());
