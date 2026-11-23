#!/usr/bin/env bun
/**
 * Render every catalogue record as Dublin Core XML and DCMI-Terms JSON-LD,
 * into the layer's published root, and check that they are current.
 *
 * @module folio-assistant-core/scripts/dc-render
 * @covers catalogue
 *
 * Bean `7eak`. The mapping lives in `schemas/dublin-core-render.ts`; WHICH
 * records get a rendering, and where, is decided here, and the reasons are in
 * the `dublin-core-renderings` skill.
 *
 * ## Which records
 *
 * Exactly the `folio-dublin-core/v1` files a catalogue ITEM names through its
 * `metadataRef`. A record no item names is not rendered: it describes nothing
 * the catalogue publishes a page for, so a rendering of it would sit beside
 * no page. A `metadataRef` that does not resolve is not this script's to
 * report — `check:catalogue` already fails on it — so it is skipped here.
 *
 * ## Where
 *
 * `<published root>/dublin-core/<stem>.dc.xml` and `.dc.jsonld`, where the
 * published root is the directory the layer DECLARES `instanceRoot: true`
 * (for an IRIS mirror: `site/`, served at `/<instance>/`) and `<stem>` is the record's own
 * filename less `.dc.json`. The mount copies that directory whole
 * (`mount-instance-docs.ts`), so the renderings publish beside the item pages
 * with no pipeline change — the two files ARE the rendering pipeline's output.
 * A layer that declares no published root is refused, not given a guess.
 *
 * ## `--check`
 *
 * Fails (exit 1) on a rendering that is MISSING, STALE (bytes differ from a
 * fresh render), or ORPHANED (a file in the directory no record produces —
 * the item it described is gone, and a reader would still find it).
 *
 * In a layer's PR checks it judges only the caller's own layer (owner
 * ruling 2026-11-05, "Move the checks"; cat-harness-tools `lib/gate-own.ts`):
 * every root that mounts a catalogue layer ran this check over that
 * layer's renderings, which are its own CI's to judge.
 *
 * Usage:
 *   bun run folio-assistant-core/scripts/dc-render.ts <instance-root>          (e.g. an IRIS mirror)
 *   bun run folio-assistant-core/scripts/dc-render.ts <instance-root> --check
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs";
import { basename, join, relative, resolve } from "path";

import { resolveDirectories } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";
import { gateOwnsFile } from "@litlfred/cat-harness-tools/scripts/lib/gate-own.ts";
import { CatalogueNodeSchema, CatalogueSchema, type CatalogueNode } from "../schemas/catalogue.js";
import { DublinCoreRecordSchema } from "../schemas/dublin-core.js";
import { DC_JSONLD_SUFFIX, DC_XML_SUFFIX, renderDcJsonLd, renderDcXml } from "../schemas/dublin-core-render.js";

/** The checkout root: the index when this layer is mounted, the one ownership is decided relative to. */
const REPO = resolve(import.meta.dir, "..", "..");

/** The subdirectory of the published root the renderings go in. */
export const DC_RENDER_DIR = "dublin-core";

/** The directory a layer declares as its published root (`instanceRoot: true`), or undefined. */
export function publishedRootOf(instance: string): string | undefined {
  return resolveDirectories([{ name: "(local)", root: instance, own: true }]).find(
    // `instanceRoot` is carried through from the declared entry at run time;
    // `ResolvedDirectory`'s static type does not name it (mount-instance-docs
    // reads it off the raw entry for the same reason).
    (d) => d.own && (d as { instanceRoot?: boolean }).instanceRoot === true,
  )?.absPath;
}

/** Where one record's two renderings live, given the layer and the item's `metadataRef`. */
export function dcRenderingsFor(instance: string, metadataRef: string): { xml: string; jsonld: string } | undefined {
  const root = publishedRootOf(instance);
  if (root === undefined) return undefined;
  const stem = basename(metadataRef).replace(/\.dc\.json$|\.json$/, "");
  return {
    xml: join(root, DC_RENDER_DIR, `${stem}${DC_XML_SUFFIX}`),
    jsonld: join(root, DC_RENDER_DIR, `${stem}${DC_JSONLD_SUFFIX}`),
  };
}

/** Every catalogue item that names a record which is there. */
export function itemsWithRecords(instance: string): CatalogueNode[] {
  // declared-path-literal: `catalogue/catalogue.json` is the catalogue's own
  // fixed entry point, read the same way by check-catalogue.ts.
  const cat = CatalogueSchema.parse(JSON.parse(readFileSync(join(instance, "catalogue", "catalogue.json"), "utf8")));
  const dir = join(instance, "catalogue", cat.nodesDir);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => CatalogueNodeSchema.parse(JSON.parse(readFileSync(join(dir, f), "utf8"))))
    .filter((n) => n.kind === "item" && n.metadataRef !== undefined && existsSync(join(instance, n.metadataRef)));
}

/** Every rendering the layer should hold, keyed by absolute path. */
export function plannedRenderings(instance: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const n of itemsWithRecords(instance)) {
    const paths = dcRenderingsFor(instance, n.metadataRef!);
    if (paths === undefined) continue;
    const raw = JSON.parse(readFileSync(join(instance, n.metadataRef!), "utf8")) as Record<string, unknown>;
    // Top-level `_` keys are annotations for a person reading the file (the
    // records' `_comment` explains each transcription), exactly as
    // check-catalogue.ts strips them; they are not metadata and never rendered.
    for (const k of Object.keys(raw)) if (k.startsWith("_")) delete raw[k];
    const rec = DublinCoreRecordSchema.parse(raw);
    out.set(paths.xml, renderDcXml(rec));
    out.set(paths.jsonld, renderDcJsonLd(rec, { handle: n.handle }));
  }
  return out;
}

function main(argv: string[]): number {
  const arg = argv.find((a) => !a.startsWith("-"));
  if (!arg) {
    console.error("usage: dc-render.ts <instance-root> [--check]   (e.g. an IRIS mirror)");
    return 2;
  }
  const instance = resolve(arg);
  if (argv.includes("--check") && gateOwnsFile(relative(REPO, instance)) === false) {
    console.log(`dc-render --check: ${relative(REPO, instance)} is another layer's instance — not this caller's; its own CI judges its renderings.`);
    return 0;
  }
  if (!existsSync(join(instance, "catalogue", "catalogue.json"))) {
    console.error(`dc-render: ${arg} has no catalogue/catalogue.json — not a catalogue instance`);
    return 2;
  }
  const root = publishedRootOf(instance);
  if (root === undefined) {
    console.error(`dc-render: ${arg} declares no directory with \`instanceRoot: true\` — nowhere to publish renderings, and a guess would publish them nowhere`);
    return 2;
  }
  const dir = join(root, DC_RENDER_DIR);
  const planned = plannedRenderings(instance);
  const present = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith(DC_XML_SUFFIX) || f.endsWith(DC_JSONLD_SUFFIX)).map((f) => join(dir, f))
    : [];
  const orphans = present.filter((p) => !planned.has(p));
  const rel = (p: string) => relative(process.cwd(), p);

  if (argv.includes("--check")) {
    const problems: string[] = [];
    for (const [p, body] of planned) {
      if (!existsSync(p)) problems.push(`missing: ${rel(p)}`);
      else if (readFileSync(p, "utf8") !== body) problems.push(`stale: ${rel(p)}`);
    }
    for (const p of orphans) problems.push(`orphan (no record renders it): ${rel(p)}`);
    if (problems.length) {
      for (const x of problems) console.error(`  ✗ ${x}`);
      console.error(`dc-render --check: ${problems.length} problem(s). Run: bun run cat dc:render`);
      return 1;
    }
    console.log(`dc-render --check: ${planned.size / 2} record(s), ${planned.size} rendering(s) current, no orphans.`);
    return 0;
  }

  mkdirSync(dir, { recursive: true });
  let wrote = 0;
  for (const [p, body] of planned) {
    if (existsSync(p) && readFileSync(p, "utf8") === body) continue;
    writeFileSync(p, body);
    wrote++;
  }
  for (const p of orphans) rmSync(p);
  console.log(`dc-render: ${planned.size / 2} record(s); wrote ${wrote}, removed ${orphans.length} orphan(s), in ${rel(dir)}`);
  return 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
