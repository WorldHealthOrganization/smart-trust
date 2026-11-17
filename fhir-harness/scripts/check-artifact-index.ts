#!/usr/bin/env bun
/**
 * Validate every committed FHIR IG artefact index against its schema, and
 * judge every `ig-annex` declaration a layer holds.
 *
 * @module folio-assistant-core/scripts/check-artifact-index
 * @covers fhir-artifact-index, ig-annex
 *
 * ## Why this exists beside the retired `ingest:ig:check`
 *
 * `ingest:ig:check` was removed once IG layers stopped committing their
 * index (#124); `ig-index:build` writes it at publish. The history below is
 * kept because it explains what this check does and does not cover.
 *
 * They answer different questions, and only one of them can be asked in CI.
 *
 * `ingest:ig:check` re-derives an index from the IG's published output and
 * fails if the committed copy differs. That is the stronger check and it needs
 * the source — the WHO SMART Trust IG's `gh-pages` is 342,656 files — which no CI runner
 * here carries. Exempted from the gate set for that reason, with the exemption
 * written down in `gates.ts` rather than left as a silence.
 *
 * This one needs nothing but the repository. It asks whether each committed
 * index is a VALID `folio-fhir-artifact-index/v2` document: schema-conformant,
 * `count` agreeing with `artifacts.length`, keys unique, no DAK overlay on an
 * index that declares `sidecarApi: "absent"`.
 *
 * That is not the whole of what `ingest:ig:check` would catch, and this file
 * does not pretend otherwise. What it does catch is the failure that is
 * actually likely: a hand-edit. The WHO SMART Trust IG's `AGENTS.md` says nothing under the
 * graph is authored, and a gate is how that stops being a request.
 *
 * ## Three outcomes
 *
 * An index the layer declares `builtAtPublish` (#124) and that this
 * checkout has not built is said as such and not judged: a consumer that
 * mounts an IG layer (a document folio mounting the DAK layer) never builds it.
 *
 * Finding no index is **not** a pass. A repository that declares no
 * `fhir-artifact-index` graph has nothing to check and says so; a scan that
 * silently returned zero would read exactly like a clean run, which is the
 * shape this repository has paid for twice (`dh4f`, `xom7`).
 *
 * ## The annex declarations that left the index
 *
 * An IG's on-demand annexes were declared in `fhir-artifact-index/
 * annexes.json` until an IG repository stopped committing an artefact index
 * (#124); they now sit in a directory of their own, the `ig-annex` kind. The
 * kind was typed and judged by nothing (`audit:coverage:require-all`,
 * folio-assistant#2681), so this gate, which already reads the declarations
 * for the index beside them, judges them too ({@link judgeIgAnnexDir}): the
 * declaration is there and is `ig-annexes/v1`, every file it names is held
 * inside its layer, nothing is declared or shown twice, and each page is
 * an `input/pagecontent/` page where the layer holds one (said, not
 * counted, where it does not). No layer declaring an `ig-annex` directory
 * is an absence of subjects, said as such — not a pass.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { FhirArtifactIndexSchema, materializationCensus } from "../schemas/fhir-artifact-index.js";
import { declarationPathIn, repoRootFor } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";
import { gitTopLevelDirs } from "@litlfred/cat-harness-tools/schemas/sdlc/git-corpus.js";
import { judgeInstanceAnnexes } from "./ig-annex-judge.ts";

const ROOT = repoRootFor(join(import.meta.dir, ".."));

/**
 * Every `fhir-artifact-index/index.json` under a layer.
 *
 * Found by walking the repository's top level for a `harness.json` that
 * declares a directory holding the `fhir-artifact-index` graph — resolved from
 * the DECLARATION, never from a hardcoded path, so relocating a layer does
 * not silently take it out of the scan.
 *
 * The top level is ASKED OF GIT (`gitTopLevelDirs`), not walked: a bare
 * directory listing of the root here was the repository's one scan seeded at a root
 * constant without git awareness, found once `root-scan-census` covered this
 * layer (bean `tqv4`). A gitignored directory holding a stray declaration
 * would otherwise be checked as though it were committed.
 */
function declaredIndexes(): { path: string; builtAtPublish: boolean }[] {
  const out: { path: string; builtAtPublish: boolean }[] = [];
  for (const entry of declaringInstances()) {
    // RESOLVED, never composed: since #695 a layer declares itself in
    // `<name>.config.json`, so there is no single filename to join. Composing
    // one is how a reader stops seeing every layer the moment the
    // convention moves — which is exactly what this scan must not do.
    const decl = declarationPathIn(join(ROOT, entry))!;
    let parsed: { directories?: Array<{ path?: string; graphTypologies?: string[] }>; builtAtPublish?: Array<{ path?: string }> };
    try {
      parsed = JSON.parse(readFileSync(decl, "utf8"));
    } catch {
      console.error(`✗ ${decl.slice(ROOT.length + 1)} is not readable JSON — that is a failure, not a skip`);
      process.exitCode = 1;
      continue;
    }
    // An index the layer declares `builtAtPublish` (#124: `ig-index:build`
    // writes it from the IG's AST at publish) is absent from every checkout
    // that has not built it, a consumer's included: that is "not built here",
    // never "missing".
    const built = new Set((parsed.builtAtPublish ?? []).map((b) => b.path?.replace(/^\.\//, "")).filter(Boolean));
    for (const d of parsed.directories ?? []) {
      if (!d.graphTypologies?.includes("fhir-artifact-index") || !d.path) continue;
      const rel = join(d.path, "index.json");
      out.push({ path: join(ROOT, entry, rel), builtAtPublish: built.has(rel) });
    }
  }
  return out;
}

/** The repository's top-level directories (asked of git) that hold a layer declaration. */
function declaringInstances(): string[] {
  return gitTopLevelDirs(ROOT).names.filter((entry) => declarationPathIn(join(ROOT, entry)) !== undefined);
}

/** Judge every `ig-annex` directory every layer declares; the number of declarations with a finding. */
function checkAnnexes(): number {
  let bad = 0;
  let judged = 0;
  for (const entry of declaringInstances()) {
    const root = join(ROOT, entry);
    const { judged: all, absent } = judgeInstanceAnnexes(root);
    for (const a of absent) console.log(`? ${a.slice(ROOT.length + 1)}: declared as ig-annex and not in this checkout — not judged, and not a pass`);
    for (const j of all) {
      judged++;
      const rel = j.declaration.slice(ROOT.length + 1);
      if (j.findings.length === 0) console.log(`✓ ${rel}: ${j.records} annex record(s) resolve`);
      for (const f of j.findings) console.error(`✗ ${rel}: ${f}`);
      if (j.pagesUnverified.length > 0) {
        console.log(`  · ${rel}: page(s) ${j.pagesUnverified.join(", ")} not verified — ${entry} holds no input/pagecontent/ in this checkout`);
      }
      if (j.findings.length > 0) bad++;
    }
  }
  if (judged === 0) {
    console.log("? no instance declares an `ig-annex` directory here — no annex declaration to judge (an absence of subjects, not a pass).");
  }
  return bad;
}

const annexFailures = checkAnnexes();
if (annexFailures > 0) process.exitCode = 1;

const indexes = declaredIndexes();

if (indexes.length === 0) {
  console.log("? no instance declares a `fhir-artifact-index` graph — nothing to check.");
  console.log("  This is NOT a pass over indexes that exist; it is an absence of subjects.");
  process.exit(annexFailures > 0 ? 1 : 0);
}

let failed = 0;
let notBuilt = 0;
for (const { path, builtAtPublish } of indexes) {
  const rel = path.slice(ROOT.length + 1);
  if (!existsSync(path) && builtAtPublish) {
    console.log(`? ${rel}: built at publish (ig-index:build) and not built in this checkout — not judged, and not a pass`);
    notBuilt++;
    continue;
  }
  if (!existsSync(path)) {
    console.error(`✗ ${rel}: declared as a fhir-artifact-index graph, but no index.json is there`);
    failed++;
    continue;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    console.error(`✗ ${rel}: not readable JSON — ${e instanceof Error ? e.message : String(e)}`);
    failed++;
    continue;
  }
  const parsed = FhirArtifactIndexSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`✗ ${rel}: does not validate as folio-fhir-artifact-index/v2`);
    for (const issue of parsed.error.issues.slice(0, 5)) {
      console.error(`    ${issue.path.join(".")}: ${issue.message}`);
    }
    if (parsed.error.issues.length > 5) console.error(`    …and ${parsed.error.issues.length - 5} more`);
    failed++;
    continue;
  }
  const ix = parsed.data;
  const census = materializationCensus(ix.artifacts);
  console.log(
    `✓ ${rel}: ${ix.count} artefacts, sidecarApi=${ix.sidecarApi}, ` +
      `${Object.entries(census).map(([k, v]) => `${k}=${v}`).join(" ")}`,
  );
}

if (failed > 0) {
  console.error(`\n✗ ${failed} of ${indexes.length} artefact index/indexes did not validate.`);
  console.error("  Nothing under a fhir-artifact-index graph is hand-authored — re-run `ig-index:build`");
  console.error("  from the IG's AST rather than editing the file.");
  process.exit(1);
}
const judged = indexes.length - notBuilt;
console.log(`\n✓ ${judged} artefact index/indexes validate${notBuilt ? `; ${notBuilt} built at publish and not built here, not judged` : ""}`);
if (annexFailures > 0) {
  console.error(`✗ ${annexFailures} ig-annex declaration(s) did not resolve (above).`);
  process.exit(1);
}
