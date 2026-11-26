#!/usr/bin/env bun
/**
 * One knowledge-graph export per declared layer, so each harness can be
 * fetched on its own.
 *
 * @module scripts/instance-exports
 * @covers cat-harness
 *
 * ## The set is DERIVED from the declarations, never listed
 *
 * The workflows run THIS script, which asks {@link layerRootsIn}, so a new
 * declaration is published with no workflow edit.
 *
 * ## Published elsewhere — the only list, and each entry is CHECKED
 *
 * {@link PUBLISHED_ELSEWHERE} names the layers that keep their own
 * publisher, each with the command that publishes it, and
 * `check:published-instance-exports` fails when a workflow that runs this
 * script does not also run that command.
 *
 * Each document lands at `<out-dir>/<name>/<stub>.jsonld`, which is the
 * `docPath` `exportIdentity` gives a foreign layer, with the `.json` alias
 * beside it because Pages serves `.jsonld` as octet-stream. The `<name>/`
 * segment is cat-harness's one URL-space resolver (`schemas/kg/url-space.ts`),
 * through {@link instanceSitePath}: the segment is the layer's NAME, never
 * its stub. A layer declaring `"enabled": false` is not published.
 *
 * Beside it, `<out-dir>/<name>/schema/`: the layer's own skill I/O
 * contracts, its public Zod schemas under `zod/<module>/<Export>.schema.json`
 * (every exported Zod `*Schema` const), and a `<stub>.schema.json` index. A
 * Zod module that fails to import or render fails the run, as a failed export
 * does. Policy: `instance-publication` §"The schema".
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/instance-exports.ts --out-dir ./_site [--base-url URL]
 *   bun run cat-harness-tools/scripts/instance-exports.ts --list
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

import { artefactStub, layerRootsIn, ownDirectories, readDeclaration, repoRootFor } from "../schemas/kg/cat-harness.js";
import { loadCodeLists } from "../schemas/library/code-list.ts";
import { buildCodeListsDoc } from "./code-lists.ts";
import { isPublished, publishedPath } from "../schemas/kg/url-space.js";
import { INSTANCE_SCHEMA_DIR } from "./harness-schema-export.js";
import { stagingFields, withStaging } from "./staging-stamp.js";
import { HARNESS_ROOT, TOOLS_ROOT } from "./lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);
const REPO = repoRootFor(ROOT);

/** A layer this script does not export, and the command that does. */
export interface PublishedElsewhere {
  /** Matches the publishing command in a workflow's text. */
  publisher: RegExp;
  /** Why it keeps its own publisher. */
  why: string;
}

/** Keyed by declared stub (`artefactStub`), not by path: declaration over location. */
export const PUBLISHED_ELSEWHERE: Readonly<Record<string, PublishedElsewhere>> = {
  "cat-harness": {
    // `--scope instance` is optional because it is the default, and is the
    // only scope accepted: `--scope checkout` would publish every stacked
    // layer's nodes under this name again, so it does not match.
    // `<name>/<stub>.jsonld` since #603 decision 1b (owner, 2026-10-23): the
    // host's document sits under its own directory like every layer's. The
    // old `--out "./_site/${STUB}.jsonld"` still matches: the exporter reads
    // it as naming the same site and writes the document at its published
    // path (`placedOut`). Nothing is written at the old root address any more
    // (clean break, cat-harness-tools#1378). Drop the old arm with `placedOut`.
    publisher: /kg-export\.ts\s+(?:--base-url\s+\S+\s+)?(?:--scope\s+instance\s+)?--out\s+"\.\/_site\/(?:\$\{STUB\}\/)?\$\{STUB\}\.jsonld"/,
    why:
      "the host: built by its own step, not this script, though since 2026-10-23 it publishes where every layer " +
      "does, `<name>/<stub>.jsonld`, the address every published `@id` names. " +
      "Built in instance scope since bean `4ak5` item 2 (the split): its own directories only",
  },
  bootstrap: {
    publisher: /bootstrap-tools\/scripts\/export-graph\.ts\s+--root\s+\.\/bootstrap\s/,
    why: "owner ruling 2026-09-30 (bean `xsqm`): bootstrap's graph is written by bootstrap-tools' `export-graph.ts`",
  },
};

/** One layer this script exports. */
export interface PlannedExport {
  /** Repository-relative, as a workflow would spell it: `./<dir>`. */
  path: string;
  /** The declared `name`: the layer's segment of the site ({@link instanceSitePath}). */
  name: string;
  stub: string;
  /**
   * The layer declares its own `canonicalUrl`, so its document's `@id` is
   * minted against that and a `--base-url` is NOT passed: `exportIdentity`
   * puts a self-based layer at `<base>/<stub>.jsonld`, which under a
   * preview's base is a path nothing writes (measured 2026-10-04 for
   * `cat-harness-tools`, `cat-openapi`, the FHIR IG harness and the DAK base layer).
   * Its own address is the honest one in every build.
   */
  ownCanonical: boolean;
}

/**
 * Where `rel` is served inside a layer's own part of the site,
 * site-relative with no leading slash: `<name>/<rel>`.
 *
 * Every consumer that writes or looks for a foreign layer's published
 * files asks this, so the deploy, the identity `kg-export` mints and the root
 * index cannot disagree about the segment. It is cat-harness's
 * `publishedPath` (`case: "instance"`), not a template here: a second spelling
 * of the rule is how two of them drift.
 */
export function instanceSitePath(name: string, rel: string): string {
  return publishedPath({ case: "instance", instance: name, path: rel }).replace(/^\//, "");
}

/** Where a foreign layer's export document is served: `<name>/<stub>.jsonld`. */
export function instanceDocPath(d: { name: string; stub: string }): string {
  return instanceSitePath(d.name, `${d.stub}.jsonld`);
}

/**
 * The layer's OWN code lists as one SKOS document, `@id` `docIri`, or
 * `undefined` when it declares none (litlfred/cat-harness-tools#960).
 *
 * The host's lists are published by `glossary-export` beside its glossary
 * (`<stub>/<stub>-code-lists.jsonld`); no other layer's were published at
 * all, so a concept IRI into, say, the content core's
 * `grade-recommendation-strength` named a document nobody wrote. Only the
 * layer's own directories are read: a dependency's lists are that
 * dependency's document.
 */
export function ownCodeListsDocument(instanceRoot: string, name: string, docIri: string): Record<string, unknown> | undefined {
  const dirs = ownDirectories({ name, root: instanceRoot, own: true })
    .filter((d) => d.graphTypologies.includes("code-list"))
    .map((d) => d.absPath);
  const lists = [...loadCodeLists(dirs).values()];
  return lists.length === 0 ? undefined : buildCodeListsDoc(lists, docIri);
}

/**
 * Does this layer mint its `@id`s against its OWN `canonicalUrl`? Then the
 * deploy passes it no `--base-url` ({@link PlannedExport.ownCanonical}), and
 * anything that names a node in its published document — `kg-export`'s
 * tombstones and re-homed skill links (bean `4ak5` item 2) — must mint the
 * same way, or it names a document nobody writes.
 */
export function declaresOwnCanonical(decl: { canonicalUrl?: string } | undefined): boolean {
  return typeof decl?.canonicalUrl === "string" && decl.canonicalUrl !== "";
}

/**
 * Does the deploy write this layer a `<stub>/schema/` directory (bean `4ak5`
 * item 1)? Exactly when it is in {@link instanceExportPlan} — the plan's own
 * answer, so `kg-export`'s link to the schema index and this script's write of
 * it cannot disagree about which layers have one.
 */
export function publishesInstanceSchema(instanceRoot: string, repo: string = REPO): boolean {
  const abs = resolve(instanceRoot);
  return instanceExportPlan(repo).some((p) => resolve(repo, p.path) === abs);
}

/** Every declared layer's stub, readable declarations only. */
export function declaredInstanceStubs(repo: string = REPO): Set<string> {
  const out = new Set<string>();
  for (const abs of layerRootsIn(repo)) {
    try {
      const d = readDeclaration(abs);
      if (d) out.add(artefactStub(d));
    } catch {
      // unreadable: its own checkers report it
    }
  }
  return out;
}

/**
 * Every declared layer not in {@link PUBLISHED_ELSEWHERE}, in path order.
 * An unreadable declaration is skipped here and reported by `readDeclaration`'s
 * own checkers; the completeness gate still sees the layer, by its root.
 */
export function instanceExportPlan(repo: string = REPO): PlannedExport[] {
  const out: PlannedExport[] = [];
  for (const abs of layerRootsIn(repo)) {
    let name: string;
    let stub: string;
    let ownCanonical: boolean;
    try {
      const d = readDeclaration(abs);
      // Not publishing is a declaration (`"enabled": false`), so leaving the
      // layer out here is the answer, not a gap: `isPublished` is the one
      // place that reads it.
      if (!d || !isPublished(d)) continue;
      name = d.name;
      stub = artefactStub(d);
      ownCanonical = declaresOwnCanonical(d);
    } catch {
      continue;
    }
    if (stub in PUBLISHED_ELSEWHERE) continue;
    const rel = relative(repo, abs).replace(/\\/g, "/");
    out.push({ path: rel === "" ? "." : `./${rel}`, name, stub, ownCanonical });
  }
  return out;
}

if (import.meta.main) {
  const arg = (flag: string): string | undefined => {
    const i = process.argv.indexOf(flag);
    return i !== -1 ? process.argv[i + 1] : undefined;
  };
  const plan = instanceExportPlan();
  if (process.argv.includes("--list")) {
    for (const p of plan) console.log(`${p.path}\t${p.stub}`);
    for (const [stub, e] of Object.entries(PUBLISHED_ELSEWHERE)) console.log(`(elsewhere)\t${stub}\t${e.why}`);
    process.exit(0);
  }
  const outDir = arg("--out-dir");
  if (!outDir) {
    console.error("usage: instance-exports.ts --out-dir <dir> [--base-url <url>] | --list");
    process.exit(2);
  }
  if (plan.length === 0) {
    // Nothing declared is could-not-determine, not a clean publish.
    console.error("✗ no declared instance to export — the declarations were not found");
    process.exit(2);
  }
  const baseUrl = arg("--base-url");
  // Dynamic, and only here: `kg-export` imports this module (for
  // `declaresOwnCanonical` and the plan), so a static import back would be a
  // cycle, and `--list` has no use for the exporter's whole import graph.
  const { scannedInstanceSchemas, exportIdentity } = await import("./kg-export.js");
  // This site's base: where an own-canonical layer's copy is served (#638).
  const siteBase = exportIdentity(baseUrl ? { baseUrl } : {}).base;
  const staging = stagingFields();
  // The deploy publishes documents, not QA sidecars: those are committed and
  // compared by `kg:export:check`. A temp root keeps this run from writing
  // into the tree it publishes.
  const qaRoot = mkdtempSync(join(tmpdir(), "instance-exports-qa-"));
  let failed = 0;
  try {
    for (const p of plan) {
      const doc = join(outDir, instanceDocPath(p));
      mkdirSync(dirname(doc), { recursive: true });
      const args = ["run", join(TOOLS_ROOT, "scripts", "kg-export.ts"), "--instance", p.path, "--out", doc, "--qa-root", qaRoot];
      if (baseUrl && !p.ownCanonical) args.push("--base-url", baseUrl);
      // An own-canonical layer mints at its own site, which serves nothing
      // yet; its subject pages are a copy here, `sameAs` the canonical IRI
      // (owner, 2026-10-29, litlfred/cat-harness-tools#638 option B).
      if (p.ownCanonical && siteBase) args.push("--served-at", `${siteBase}/${instanceDocPath(p)}`);
      const r = spawnSync("bun", args, { cwd: REPO, encoding: "utf-8" });
      if (r.status !== 0) {
        failed++;
        console.error(`  ✗ ${p.path}: kg-export exited ${r.status}\n${(r.stderr ?? "").trim()}`);
        continue;
      }
      copyFileSync(doc, doc.replace(/\.jsonld$/, ".json"));
      // ── AND ITS SCHEMA, beside it (bean `4ak5` item 1, owner ruling
      // 2026-10-05, option B): its own skill I/O contracts and an index, at
      // `<stub>/schema/`. `$id`s are its PUBLISHED identity's, from the same
      // `publishedIdentity` its document's `@id` came from; this site is where
      // the bytes are staged. Stamped like the host's (`harness-schema-export`).
      //
      // With its public Zod schemas under `schema/zod/` (part 2, owner ruling
      // 2026-10-05, option C: "every exported *Schema").
      const schemaDir = join(outDir, instanceSitePath(p.name, INSTANCE_SCHEMA_DIR));
      const built = await scannedInstanceSchemas(resolve(REPO, p.path), baseUrl);
      for (const [rel, body] of built.files) {
        const out = join(schemaDir, rel);
        mkdirSync(dirname(out), { recursive: true });
        writeFileSync(out, JSON.stringify({ ...body, ...staging }, null, 2) + "\n");
      }
      // ── AND ITS CODE LISTS, beside it, at the address the host's take
      // (`<stub>/<stub>-code-lists.jsonld`), so each concept IRI loads (#960).
      if (siteBase) {
        const clPath = instanceDocPath(p).replace(/\.jsonld$/, "-code-lists.jsonld");
        const cl = ownCodeListsDocument(resolve(REPO, p.path), p.name, `${siteBase}/${clPath}`);
        if (cl !== undefined) {
          const clOut = join(outDir, clPath);
          writeFileSync(clOut, JSON.stringify(withStaging(cl), null, 2) + "\n");
          copyFileSync(clOut, clOut.replace(/\.jsonld$/, ".json"));
        }
      }
      const zod = built.zodScanned ? `${built.zod.length} Zod schema(s)` : "Zod schemas NOT scanned";
      // A module that would not import or an export that would not render is
      // a FAILED layer, as a failed `kg-export` is: what did render is still
      // written (the index lists the rest as `unrendered`), the loop goes on,
      // and the run exits 1. Logging and exiting 0 would publish a partial
      // `zod/` that reads as complete — the third-state failure.
      if (built.zodProblems.length > 0 || !built.zodScanned) {
        failed++;
        console.error(`  ✗ ${p.path}: ${built.contracts.length} contract(s), ${zod}, ${built.zodProblems.length} failure(s)`);
        for (const line of built.zodProblems) console.error(`      ${line}`);
        continue;
      }
      console.log(
        `  ✓ ${p.path} → ${relative(process.cwd(), doc)} + ${relative(process.cwd(), schemaDir)}/ ` +
          `(${built.contracts.length} contract(s), ${zod})`,
      );
    }
  } finally {
    rmSync(qaRoot, { recursive: true, force: true });
  }
  console.log(`${plan.length - failed} of ${plan.length} instance graph(s) exported; ${Object.keys(PUBLISHED_ELSEWHERE).length} published by their own step.`);
  process.exit(failed > 0 ? 1 : 0);
}
