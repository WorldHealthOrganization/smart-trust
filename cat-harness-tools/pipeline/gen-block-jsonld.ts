#!/usr/bin/env bun
/**
 * Generate the `.jsonld` sibling for every content block.
 *
 * A block is authored as `<block>.ts` and rendered from `<block>.md`. This
 * adds a third companion, `<block>.jsonld`, carrying the same manifest as
 * linked data. It is **generated, never hand-edited** — the same rule that
 * governs `docs/reference/skills/*` — and `--check` is the CI gate that keeps
 * the two from drifting into two truths.
 *
 * ## Why a committed sibling rather than a build directory
 *
 * Three reasons, in the order they mattered:
 *
 * 1. **Ingested and authored nodes become one population.** `library/**`
 *    documents are written as JSON-LD directly (they have no author and so no
 *    authoring surface). With the sibling in place, both sides share a
 *    `@context`, a `@type` vocabulary and an edge vocabulary, and a graph
 *    loader is `glob("**\/*.jsonld")` rather than two code paths — one
 *    importing TypeScript, one parsing JSON.
 * 2. **A sandboxed session can consume it.** `docs/proposals/rag-document-ingestion.md`
 *    §10 settled that artefacts are committed so a session with no egress and
 *    no toolchain can still read them. A gitignored build directory cannot do
 *    that, and cannot give an external consumer a stable URL either.
 * 3. **It fits the existing convention.** `Companions` in `schemas/types.ts`
 *    is `md` / `lean` / `test` plus an open `[role: string]` index, so
 *    `jsonld` is one more companion role rather than a new concept.
 *
 * The `.ts` remains authoritative: it is what `block-module.ts` imports, and
 * that import is itself a validation step this must not displace.
 *
 * Usage:
 *   bun run cat-harness-tools/pipeline/gen-block-jsonld.ts               # write
 *   bun run cat-harness-tools/pipeline/gen-block-jsonld.ts --check       # CI gate
 *   bun run cat-harness-tools/pipeline/gen-block-jsonld.ts --paper <dir>
 *
 * @module pipeline/gen-block-jsonld
 * @covers folio
 */

import { folioDir } from "../schemas/kg/cat-harness.js";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, dirname, basename } from "path";
import { documentContext } from "../schemas/content/content-context.ts";
import { atInstanceContext } from "./instance-document-context.ts";
import {
  resolveLabel,
  mintNodeId,
  resolveReferenceKey,
  typesForKind,
  parseReference,
} from "../schemas/kg/jsonld.ts";
import { loadBlocksUnder, reportLoadFailures, type LoadedBlock } from "./block-module";
import { contributionsRoot, findContentRepoRoot, findPapers } from "./repo-root";
import { loadContributions } from "../schemas/kg/harness-config.ts";
import { ContributionRegistry, type FolioContribution } from "../schemas/content/contributions.ts";
import { paperArg } from "./cli-args";

/** A reference that could not be resolved to an IRI, with where it came from. */
interface DanglingRef {
  block: string;
  field: string;
  ref: string;
  reason: string;
}

/**
 * A reference that DID resolve but deviates from the label convention.
 *
 * Kept apart from {@link DanglingRef} because the two need opposite responses:
 * a dangling reference lost an edge and must be fixed before the graph is
 * trusted, whereas this one is in the graph and merely reads oddly. Merging
 * them would either overstate a convention nit as data loss, or — the way it
 * actually failed — resolve the nit by DELETING the edge.
 */
interface UnconventionalRef {
  block: string;
  field: string;
  ref: string;
}

const SCALAR_FIELDS = ["title"] as const;
const REF_LIST_FIELDS = ["uses", "foreshadows", "proofs", "examples"] as const;
const PLAIN_LIST_FIELDS = ["tags", "defines"] as const;

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** Deduplicate, preserving authored order — `uses[]` order is editorial. */
function dedupe(xs: string[]): string[] {
  return [...new Set(xs)];
}

/**
 * Build the JSON-LD document for one loaded block.
 *
 * Key order is fixed rather than derived from the manifest so output is
 * byte-stable across runs; the `--check` gate depends on that.
 */
export function blockToJsonLd(
  loaded: LoadedBlock,
  paper: string,
  dangling: DanglingRef[],
  unconventional: UnconventionalRef[] = [],
  /** Registry of contributed kinds, so a persona or requirement is typed. */
  contributions?: ContributionRegistry,
): Record<string, unknown> {
  const b = loaded.block;
  const types = typesForKind(loaded.kind, contributions);

  const doc: Record<string, unknown> = {
    "@context": documentContext(types),
    // `mintNodeId`, not `resolveLabel`: a block's own label always yields an
    // id. The placeholder this replaces gave every prefix-less label the same
    // `@id`, which collided 12 blocks into one on the real corpus.
    "@id": mintNodeId(loaded.label, paper),
    "@type": types,
    label: loaded.label,
    kind: loaded.kind,
  };

  for (const f of SCALAR_FIELDS) {
    if (typeof b[f] === "string" && b[f]) doc[f] = b[f];
  }

  const resolveList = (field: string, refs: string[]): string[] => {
    const out: string[] = [];
    for (const r of dedupe(refs)) {
      const resolved = resolveLabel(r, paper);
      if (resolved) {
        out.push(resolved);
        // Resolved, but written without a kind prefix. Reported so the
        // convention stays visible; the edge is kept, because dropping it was
        // the old behaviour and it cost 35 real edges on the qou corpus.
        if (parseReference(r).form === "bare-label") {
          unconventional.push({ block: loaded.label, field, ref: r });
        }
      } else {
        const parsed = parseReference(r);
        dangling.push({
          block: loaded.label,
          field,
          ref: r,
          reason: parsed.form === "unresolvable" ? parsed.reason : "unknown",
        });
      }
    }
    return out;
  };

  for (const f of REF_LIST_FIELDS) {
    const refs = resolveList(f, strList(b[f]));
    if (refs.length) doc[f] = refs;
  }

  if (typeof b.interprets === "string" && b.interprets) {
    const resolved = resolveLabel(b.interprets, paper);
    if (resolved) {
      doc.interprets = resolved;
      if (parseReference(b.interprets).form === "bare-label") {
        unconventional.push({
          block: loaded.label, field: "interprets", ref: b.interprets,
        });
      }
    } else {
      const parsed = parseReference(b.interprets);
      dangling.push({
        block: loaded.label,
        field: "interprets",
        ref: b.interprets,
        reason: parsed.form === "unresolvable" ? parsed.reason : "unknown",
      });
    }
  }

  const cites = dedupe(strList(b.cites));
  if (cites.length) doc.cites = cites.map(resolveReferenceKey);

  for (const f of PLAIN_LIST_FIELDS) {
    const xs = dedupe(strList(b[f]));
    if (xs.length) doc[f] = xs;
  }

  const lean = b.lean as { ref?: string; sorryFree?: boolean } | undefined;
  if (lean && typeof lean.ref === "string") {
    doc.leanRef = lean.ref;
    if (typeof lean.sorryFree === "boolean") doc.sorryFree = lean.sorryFree;
  }

  // Companions as links. Emitted only when the file is actually there, so a
  // consumer never follows a link to nothing.
  const dir = dirname(loaded.file);
  const stem = basename(loaded.file, ".ts");
  if (existsSync(join(dir, `${stem}.md`))) doc.text = `${stem}.md`;
  if (existsSync(join(dir, `${stem}.lean`))) doc.leanSource = `${stem}.lean`;

  if (b.meta && typeof b.meta === "object") doc.meta = b.meta;

  doc.provenance = "authored";
  return doc;
}

/** The node as written to disk: what `--check` compares byte for byte. */
export function serialise(doc: Record<string, unknown>): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

async function run(): Promise<number> {
  const argv = process.argv.slice(2);
  const check = argv.includes("--check");
  const explicitPaper = paperArg(argv);

  const root = findContentRepoRoot();
  const papers = explicitPaper ? [explicitPaper] : findPapers(root);

  if (papers.length === 0) {
    console.log(
      "gen-block-jsonld: no papers under folio/ — nothing to generate.\n" +
        "  (folio-assistant is the platform; papers live in the folio repo.)",
    );
    return 0;
  }

  let written = 0;
  let unchanged = 0;
  const stale: string[] = [];
  const dangling: DanglingRef[] = [];
  const unconventional: UnconventionalRef[] = [];
  let anyLoadFailure = false;

  // A dependency's block kinds (the contributed `dak` kinds) are blocks too.
  // Loaded as qa-sweep loads them; registering them is also what lets
  // `typesForKind` type them.
  const contributions = await loadContributions<FolioContribution, ContributionRegistry>(
    contributionsRoot(),
    new ContributionRegistry(),
  );
  const contributedKinds = new Set(contributions.contributedBuilders().values());

  for (const paper of papers) {
    const paperDir = join(folioDir(root),  paper);
    if (!existsSync(paperDir)) {
      console.error(`gen-block-jsonld: no such paper directory: ${paperDir}`);
      return 2;
    }

    const { blocks, failures } = await loadBlocksUnder(paperDir, contributedKinds);
    if (reportLoadFailures(failures)) anyLoadFailure = true;

    for (const loaded of [...blocks.values()].sort((a, b) => a.file.localeCompare(b.file))) {
      const out = loaded.file.replace(/\.ts$/, ".jsonld");
      // The block names the context of the layer its file sits in (bean
      // folio-assistant-63q4), applied here because this is where `out` is known.
      const next = serialise(atInstanceContext(blockToJsonLd(loaded, paper, dangling, unconventional, contributions), out));
      const prev = existsSync(out) ? readFileSync(out, "utf-8") : undefined;

      if (prev === next) {
        unchanged++;
        continue;
      }
      if (check) {
        stale.push(out.slice(root.length + 1));
        continue;
      }
      writeFileSync(out, next);
      written++;
    }
  }

  if (dangling.length) {
    console.warn(`\n${dangling.length} reference(s) could not be resolved to an IRI:`);
    for (const d of dangling.slice(0, 20)) {
      console.warn(`  ${d.block} .${d.field} → "${d.ref}"  (${d.reason})`);
    }
    if (dangling.length > 20) console.warn(`  … and ${dangling.length - 20} more`);
    console.warn(
      "These are dropped from the emitted graph. An unresolvable reference is a\n" +
        "content defect, not a generator limitation — fix the label or register\n" +
        "its prefix in KNOWN_LABEL_PREFIXES.",
    );
  }

  if (unconventional.length) {
    const blocks = new Set(unconventional.map((u) => u.block));
    const targets = [...new Set(unconventional.map((u) => u.ref))].sort();
    console.warn(
      `\n${unconventional.length} reference(s) in ${blocks.size} block(s) name a ` +
        `label with no kind prefix:`,
    );
    console.warn(`  ${targets.slice(0, 12).join(", ")}` +
      (targets.length > 12 ? `, … and ${targets.length - 12} more` : ""));
    console.warn(
      "These ARE in the emitted graph — they resolve by the same rule a\n" +
        "prefix-less label mints its own @id with. Reported because the\n" +
        "convention is a prefix (`prose` excepted); a target that does not\n" +
        "exist will surface as a dangling edge when the graph is walked.",
    );
  }

  if (check) {
    if (stale.length) {
      console.error(
        `\n${stale.length} .jsonld sibling(s) are stale or missing:\n` +
          stale.slice(0, 40).map((s) => `  ${s}`).join("\n") +
          (stale.length > 40 ? `\n  … and ${stale.length - 40} more` : "") +
          `\n\nRun: bun run cat-harness-tools/pipeline/gen-block-jsonld.ts`,
      );
      return 1;
    }
    console.log(`gen-block-jsonld --check: ${unchanged} sibling(s) up to date.`);
    return anyLoadFailure ? 1 : 0;
  }

  console.log(
    `gen-block-jsonld: ${written} written, ${unchanged} unchanged` +
      (dangling.length ? `, ${dangling.length} dangling reference(s)` : "") +
      (unconventional.length ? `, ${unconventional.length} prefix-less reference(s)` : ""),
  );
  return anyLoadFailure ? 1 : 0;
}

if (import.meta.main) {
  run()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(e);
      process.exit(2);
    });
}
