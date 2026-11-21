#!/usr/bin/env bun
/**
 * @covers fhir-artifact-index, qa
 *
 * P2's refusal record: every XML and Turtle representation an IG publishes
 * that this pipeline does not render (bean `ntyj`, `ig-publisher-reduction` P2).
 *
 * Owner, 2026-10-01: *"Keep P2 as approved: drop XML and Turtle, and treat the
 * refusal record as an accepted"* — an accepted, documented difference from
 * the standard render. This file IS that record, one per IG, so that
 * "publishes no Turtle" and "we ignored its Turtle" stay distinguishable:
 *
 * - `xml`, `ttl` — each representation the IG PUBLISHED and this pipeline
 *   refuses, with where the Publisher serves it (a reader follows that link);
 * - `not-published` — each artefact for which the IG published NO XML or no
 *   Turtle, so its absence from the two lists above is a fact about the IG,
 *   not a gap in this record.
 *
 * Read from the layer's artefact index (`fhir-artifact-index/index.json`),
 * whose `published` URLs the ingest recorded; written as a `qa-results/v1`
 * sidecar in the layer's `test/results/`. Generic: nothing here knows whose
 * IG it is.
 *
 *   bun run fhir-harness/scripts/p2-refusals.ts --instance <dir> [--check]
 *   bun run fhir-harness/scripts/p2-refusals.ts --combine <dir> <dir> [...] --out <file> [--check]
 *
 * `--combine` is P2's combined view (bean `ntyj`): two or more IGs in ONE
 * record, each refusal tagged with the IG it belongs to, and a `by-ig` family
 * stating each IG's counts — so one IG's 678 refusals cannot hide another's 0.
 * Each IG is recomputed from its own index, never read back from a sidecar
 * that may be stale.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { artifactPageName, type FhirArtifactIndex } from "../schemas/fhir-artifact-index.js";
import { sourceHashOf, type QaResult } from "../../cat-harness-tools/scripts/qa-results.ts";
import { indexReadPath } from "./lib/ig-index-at.ts";

const REPO = resolve(import.meta.dir, "..", "..");
const REASON =
  "P2 (ig-publisher-reduction, approved 2026-09-30; owner 2026-10-01): XML and Turtle are not rendered — an accepted, documented difference from the standard render";

/**
 * The Publisher's view page for a representation: StructureDefinitions get
 * `.profile.<rep>.html`, and the ImplementationGuide none — its XML and Turtle
 * files are published with no page (measured on the WHO SMART Trust IG, 2026-10-01: the
 * record then names exactly the Publisher's 1,354 XML/TTL view pages).
 */
export function publisherViewPage(a: { resourceType: string; id: string }, rep: "xml" | "ttl"): string | undefined {
  if (a.resourceType === "ImplementationGuide") return undefined;
  return `${artifactPageName(a)}${a.resourceType === "StructureDefinition" ? ".profile" : ""}.${rep}.html`;
}

export function refusals(ix: FhirArtifactIndex, script: string): QaResult {
  const fam = (rep: "xml" | "ttl") => {
    const entries = ix.artifacts
      .filter((a) => a.published?.[rep]?.url)
      .map((a) => {
        const page = publisherViewPage(a, rep);
        return { artifact: a.key, published: a.published![rep]!.url, ...(page ? { publisherPage: page } : {}), reason: REASON };
      });
    return {
      summary: `${rep === "xml" ? "XML" : "Turtle"} representations ${ix.packageId ?? ix.id} publishes that this pipeline refuses to render (P2); each stays reachable at the Publisher's URL`,
      count: entries.length,
      entries,
    };
  };
  const none = ix.artifacts
    .filter((a) => !a.published?.xml?.url || !a.published?.ttl?.url)
    .map((a) => ({ artifact: a.key, missing: (["xml", "ttl"] as const).filter((r) => !a.published?.[r]?.url) }));
  const xml = fam("xml");
  const ttl = fam("ttl");
  return {
    $schema: "qa-results/v1",
    producer: { script, script_hash: sourceHashOf(join(REPO, script)) },
    subject: { kind: "fhir-ig", id: ix.packageId ?? ix.id },
    families: {
      xml,
      ttl,
      "not-published": {
        summary: "Artefacts for which the IG published no XML or no Turtle — not refused, because there was nothing to refuse",
        count: none.length,
        entries: none,
      },
    },
    // Refusals are the record's findings; `not-published` is context, not a finding.
    total: xml.count + ttl.count,
  };
}

/** One IG's record within a combined view: the package it names, and its per-IG record. */
export interface IgRefusals {
  ig: string;
  record: QaResult;
}

/**
 * P2's combined view across IGs (bean `ntyj`): each family's entries tagged
 * with `ig`, and a `by-ig` family carrying each IG's counts. Refuses fewer
 * than two IGs or one IG twice -- a "combined" record of one IG, or one that
 * counts an IG twice, would claim a coverage it does not have.
 */
export function combinedRefusals(igs: IgRefusals[], script: string): QaResult {
  if (igs.length < 2) throw new Error(`a combined view needs at least two IGs, got ${igs.length}`);
  const seen = new Set<string>();
  for (const g of igs) {
    if (seen.has(g.ig)) throw new Error(`${g.ig} appears twice`);
    seen.add(g.ig);
  }
  const fam = (name: "xml" | "ttl" | "not-published") => {
    const entries = igs.flatMap((g) => (g.record.families[name]?.entries ?? []).map((e) => ({ ig: g.ig, ...(e as Record<string, unknown>) })));
    return { summary: `${igs[0]!.record.families[name]!.summary} — across ${igs.map((g) => g.ig).join(", ")}`, count: entries.length, entries };
  };
  const xml = fam("xml");
  const ttl = fam("ttl");
  return {
    $schema: "qa-results/v1",
    producer: { script, script_hash: sourceHashOf(join(REPO, script)) },
    subject: { kind: "fhir-ig-set", id: igs.map((g) => g.ig).join("+") },
    families: {
      "by-ig": {
        summary: "Each IG's counts, so the combined totals cannot hide one IG behind another",
        count: igs.length,
        entries: igs.map((g) => ({
          ig: g.ig,
          xml: g.record.families.xml!.count,
          ttl: g.record.families.ttl!.count,
          notPublished: g.record.families["not-published"]!.count,
        })),
      },
      xml,
      ttl,
      "not-published": fam("not-published"),
    },
    total: xml.count + ttl.count,
  };
}

function writeOrCheck(out: string, text: string, check: boolean, done: string): void {
  if (check) {
    if (!existsSync(out) || readFileSync(out, "utf8") !== text) {
      console.error(`✗ ${relative(REPO, out)} is stale — run without --check and commit it`);
      process.exit(1);
    }
    console.log(`✓ ${relative(REPO, out)} is current`);
    return;
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text);
  console.log(done);
}

function readIndex(inst: string): FhirArtifactIndex {
  const indexPath = indexReadPath(resolve(process.cwd(), inst), "index.json");
  if (!existsSync(indexPath)) {
    console.error(`${relative(REPO, indexPath)} does not exist — no IG, so nothing to refuse (not a pass)`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(indexPath, "utf8")) as FhirArtifactIndex;
}

if (import.meta.main && process.argv.includes("--combine")) {
  const args = process.argv.slice(process.argv.indexOf("--combine") + 1);
  const end = args.findIndex((a) => a.startsWith("--"));
  const dirs = end < 0 ? args : args.slice(0, end);
  const o = process.argv.indexOf("--out");
  const out = o >= 0 ? process.argv[o + 1] : undefined;
  if (dirs.length < 2 || !out) {
    console.error("usage: p2-refusals.ts --combine <dir> <dir> [...] --out <file> [--check]");
    process.exit(2);
  }
  const script = relative(REPO, join(import.meta.dir, "p2-refusals.ts"));
  const igs = dirs.map((d) => {
    const ix = readIndex(d);
    return { ig: ix.packageId ?? ix.id, record: refusals(ix, script) };
  });
  const record = combinedRefusals(igs, script);
  const by = record.families["by-ig"]!.entries as Array<{ ig: string; xml: number; ttl: number; notPublished: number }>;
  writeOrCheck(resolve(out), `${JSON.stringify(record, null, 2)}\n`, process.argv.includes("--check"),
    `${out}: ${record.total} refused across ${by.length} IGs — ${by.map((b) => `${b.ig} ${b.xml} XML + ${b.ttl} Turtle, ${b.notPublished} not published`).join("; ")}`);
} else if (import.meta.main) {
  const i = process.argv.indexOf("--instance");
  const inst = i >= 0 ? process.argv[i + 1] : undefined;
  if (!inst) {
    console.error("usage: p2-refusals.ts --instance <dir> [--check]");
    process.exit(2);
  }
  const root = resolve(process.cwd(), inst);
  const indexPath = indexReadPath(root, "index.json");
  if (!existsSync(indexPath)) {
    console.error(`${relative(REPO, indexPath)} does not exist — no IG, so nothing to refuse (not a pass)`);
    process.exit(1);
  }
  const ix = JSON.parse(readFileSync(indexPath, "utf8")) as FhirArtifactIndex;
  const record = refusals(ix, relative(REPO, join(import.meta.dir, "p2-refusals.ts")));
  const out = join(root, "test", "results", "p2-refusals.qa-results.json");
  const text = `${JSON.stringify(record, null, 2)}\n`;
  if (process.argv.includes("--check")) {
    if (!existsSync(out) || readFileSync(out, "utf8") !== text) {
      console.error(`✗ ${relative(REPO, out)} is stale — run without --check and commit it`);
      process.exit(1);
    }
    console.log(`✓ ${relative(REPO, out)} is current`);
  } else {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, text);
    const f = record.families;
    console.log(`${relative(REPO, out)}: ${f.xml!.count} XML + ${f.ttl!.count} Turtle refused; ${f["not-published"]!.count} artefact(s) with a representation the IG did not publish`);
  }
}
