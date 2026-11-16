#!/usr/bin/env bun
/**
 * Does each methodology's cited source actually exist in a library?
 *
 * Every methodology node carries an `origin` naming authors and a
 * publication (what `methodology-adoption` uses to tell an adoption from a
 * house process). This reports each origin whose source no declared library
 * holds.
 *
 * It REPORTS by default (exit 0 with findings); whether a methodology without
 * a reachable source may be used is not this script's call. `--strict` exits
 * 1 on any finding.
 *
 * **Two things always fail:** front matter that does not validate, and an
 * `evidence` reference pointing at a bib-slug no declared library holds (a
 * citation that claims to resolve and does not).
 *
 * If no directory declares a `methodology` graph, it reports `undetermined`
 * and exits 2 rather than printing a clean run.
 *
 * Usage:
 *   bun run cat check:methodology-evidence
 *   bun run cat check:methodology-evidence -- --strict    # any finding exits 1
 *   bun run cat check:methodology-evidence -- --json      # sidecar only, no prose
 *   bun run cat check:methodology-evidence:check          # JUDGE: compute and judge, write nothing (the gate)
 *
 * Exit: 0 reported, 1 a hard finding (or any finding under --strict),
 *       2 could not determine. Judge mode (`--check`) keeps the
 *       same table (`--strict` included) and adds 2 for an unknown flag or a
 *       run that threw.
 *
 * @module scripts/check-methodology-evidence
 * @covers methodology, library
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

import {
  MethodologyFrontMatterSchema,
  METHODOLOGY_SCHEMA_TAG,
  type MethodologyFrontMatter,
} from "../schemas/process/methodology.ts";
import {
  buildQaResult,
  concludeJudgement,
  judgementOf,
  judgeUsage,
  judging,
  writeQaResult,
  type Judgement,
  type QaResult,
} from "./qa-results.ts";
import { isDirectoryReadme } from "../schemas/kg/kg-node.ts";
import { corpusDirectoriesForGraph } from "../schemas/kg/harness-config.js";
import { gateDirectoriesForGraph, nothingOwnLine } from "./lib/gate-own.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { isSkillMd, skillMdDirs } from "./known-skills.ts";
import { libraryEntryDir } from "./lib/library-entry-graphs.ts";

/**
 * This module's own layer root.
 *
 * Derived from the module's location rather than the CWD, for the reason
 * `ingest-document.ts` records at length: after the stub move the CWD is the
 * REPOSITORY root, which declares nothing, so a CWD-relative resolution
 * reported "this instance declares no such graph" — a true sentence about a
 * directory that is not this layer.
 */
const INSTANCE_ROOT = resolve(HARNESS_ROOT);

interface Finding {
  node: string;
  name?: string;
  detail: string;
}

export interface EvidenceReport {
  undetermined: boolean;
  nodes: number;
  invalid: Finding[];
  unresolved: Finding[];
  noEvidence: Finding[];
  untagged: Finding[];
  resolved: { node: string; name: string; evidence: string; at: string }[];
  /** Skills whose `uses-methodology` names a methodology no declared directory holds — {@link methodologyUses}. */
  badUses?: Finding[];
}

/**
 * The skill → methodology edge's key (owner, 2026-10-16: *"uses-methodology in
 * Skill"*). Defined, with its shape, in cat-harness `schemas/process/methodology.ts`
 * (`USES_METHODOLOGY_FIELD`, litlfred/cat-harness#325); spelled here as well
 * until this layer's pin of cat-harness carries that export.
 */
export const USES_METHODOLOGY = "uses-methodology";

/** One skill's `uses-methodology` edge: the skill, its file relative to `root`, and the names. */
export interface MethodologyUse {
  skill: string;
  file: string;
  root: string;
  names: string[];
}

/** Every skill under `root` that declares `uses-methodology`, read from its front matter. */
export function methodologyUses(root: string): MethodologyUse[] {
  const out: MethodologyUse[] = [];
  for (const parts of skillMdDirs(root)) {
    const dir = join(root, ...parts);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).sort()) {
      const abs = join(dir, f);
      if (!f.endsWith(".md") || !isSkillMd(abs)) continue;
      const fm = frontMatterOf(readFileSync(abs, "utf-8"));
      if (fm === undefined || !fm.includes(USES_METHODOLOGY)) continue;
      let parsed: Record<string, unknown> | undefined;
      try {
        parsed = parseYaml(fm) as Record<string, unknown>;
      } catch {
        continue; // unparseable front matter is the skill gates' finding, not this one
      }
      const v = parsed?.[USES_METHODOLOGY];
      const names = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : typeof v === "string" ? [v] : [];
      out.push({ skill: typeof parsed?.name === "string" ? parsed.name : basename(f, ".md"), file: relative(root, abs), root, names });
    }
  }
  return out;
}

/**
 * Every `.md` under every directory declaring a `methodology` graph, or under
 * `dirs` when a gate scoped them to its caller's own (owner ruling 2026-11-05, "Move the checks"; `lib/gate-own.ts`).
 */
export function methodologyFiles(root: string, dirs: readonly string[] = corpusDirectoriesForGraph(root, "methodology")): string[] {
  const out: string[] = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      // Only files directly in the graph directory. A methodology that owns a
      // SUBDIRECTORY (crdm/, raci/) declares that subdirectory itself, and its
      // nodes are its own — the `x4v4` rule that a subgraph's nodes are not
      // also its container's. Recursing here would attribute a CRDM skill to
      // the methodology graph and make every count computed from it wrong.
      if (e.endsWith(".md") && !isDirectoryReadme(p) && statSync(p).isFile()) out.push(p);
    }
  }
  return out.sort();
}

/** Front matter between the first two `---` lines, or undefined. */
export function frontMatterOf(text: string): string | undefined {
  if (!text.startsWith("---")) return undefined;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return undefined;
  return text.slice(text.indexOf("\n", 3) + 1, end + 1);
}

/**
 * Where a `library/<bib-slug>` reference resolves, across EVERY declared
 * library, or undefined.
 *
 * Fanned out rather than resolved against the node's own layer, per bean
 * `a02m`: several layers declare a library, and a methodology's source may
 * sit in a sibling's corpus — `grade`'s would belong with the WHO material.
 * Resolving against one would report a present document as missing.
 */
export function resolveEvidence(root: string, ref: string): string | undefined {
  // declared-path-literal: this is the `evidence` field's REFERENCE GRAMMAR,
  // not a directory. `library/<bib-slug>` is the spelling a node writes and
  // `MethodologyFrontMatterSchema` validates; the directories it is resolved
  // AGAINST are read from the declaration, on the next line. Reading the
  // declaration to strip this prefix would be asking where a library lives in
  // order to parse a string that does not name one.
  //
  // The slug is the identity and the group only where it is filed (bean
  // `6fez`): `library/<bib-slug>` resolves to `library/<slug>/` or
  // `library/<group>/<slug>/`, so no reference is rewritten when an entry is
  // filed. Anything after the slug is a path inside the entry, as before.
  const [slug = "", ...rest] = ref.slice("library/".length).split("/");
  for (const lib of corpusDirectoriesForGraph(root, "library")) {
    const entry = libraryEntryDir(lib, slug);
    if (entry === undefined) continue;
    const p = join(entry, ...rest);
    if (existsSync(p) && statSync(p).isDirectory()) return p;
  }
  return undefined;
}

/**
 * One methodology node, read once — valid or not.
 *
 * ## Why this exists as its own export
 *
 * `checkMethodologyEvidence` walks the graph, parses each node's front matter,
 * validates it, and then keeps only `name`, `origin` and `evidence`, because a
 * report is all it was asked for. A VIEWER needs the rest: `title` and
 * `applies-when` are what make a page a view of the graph rather than a second
 * listing of its findings.
 *
 * The alternative was a second walk in the generator, and that is the failure
 * this repository keeps paying for. Bean `zw4a` states it for the adjacent
 * case: *"a second traversal is a second answer … free to disagree with the
 * first."* Here the two answers would be about which files are in the graph at
 * all — the one thing a viewer and its gate must not differ on.
 *
 * So the walk is here, both consumers read it, and the subdirectory rule it
 * carries (`x4v4`: a methodology owning `crdm/` declares that subdirectory
 * itself, so `methodologyFiles` does not recurse) is stated once.
 */
export interface MethodologyNode {
  /** Path relative to `root`, spelled as every finding spells it. */
  readonly node: string;
  /** Parsed and valid front matter, present only when `state` is `ok`. */
  readonly front?: MethodologyFrontMatter;
  /**
   * WHY there is no `front`, when there is none.
   *
   * `untagged` is not a defect — a README sitting in the graph directory is
   * untagged and correct. `invalid` is. Collapsing the two would make a
   * malformed node and an index file look alike, which is exactly the
   * distinction this script's own two buckets already keep.
   */
  readonly state: "ok" | "untagged" | "invalid";
  /** For `untagged` and `invalid`, what is wrong. */
  readonly detail?: string;
}

/** Every methodology node in the graph, parsed once, valid or not. */
export function methodologyNodes(root = INSTANCE_ROOT, dirs?: readonly string[]): MethodologyNode[] {
  const out: MethodologyNode[] = [];
  for (const f of methodologyFiles(root, dirs)) {
    const node = relative(root, f);
    const fm = frontMatterOf(readFileSync(f, "utf-8"));

    if (fm === undefined || !fm.includes(METHODOLOGY_SCHEMA_TAG)) {
      // NOT an invalid methodology — it may legitimately be a README or an
      // index sitting in the directory. It is still reported, because a node
      // nobody tagged is a node no consumer of the graph can see, which is the
      // same silence a declared-but-absent directory produces.
      out.push({ node, state: "untagged", detail: `carries no \`$schema: ${METHODOLOGY_SCHEMA_TAG}\`` });
      continue;
    }

    let parsed: unknown;
    try {
      parsed = parseYaml(fm);
    } catch (e) {
      out.push({ node, state: "invalid", detail: `front matter is not valid YAML: ${(e as Error).message}` });
      continue;
    }

    const v = MethodologyFrontMatterSchema.safeParse(parsed);
    if (!v.success) {
      out.push({
        node,
        state: "invalid",
        detail: v.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; "),
      });
      continue;
    }

    out.push({ node, state: "ok", front: v.data });
  }
  return out;
}

/**
 * `dirs` scopes the SUBJECTS (the methodology nodes judged); a citation still
 * resolves against every library in the corpus, since a caller may cite what
 * it mounts.
 */
export function checkMethodologyEvidence(root = INSTANCE_ROOT, dirs: readonly string[] = corpusDirectoriesForGraph(root, "methodology")): EvidenceReport {
  const r: EvidenceReport = {
    undetermined: dirs.length === 0,
    nodes: 0,
    invalid: [],
    unresolved: [],
    noEvidence: [],
    untagged: [],
    resolved: [],
    badUses: [],
  };
  if (r.undetermined) return r;

  for (const n of methodologyNodes(root, dirs)) {
    const node = n.node;
    if (n.state === "untagged") {
      r.untagged.push({ node, detail: n.detail ?? "" });
      continue;
    }
    if (n.state === "invalid") {
      r.invalid.push({ node, detail: n.detail ?? "" });
      continue;
    }

    r.nodes += 1;
    const { name, evidence, origin } = n.front!;

    if (evidence === undefined || evidence.length === 0) {
      r.noEvidence.push({
        node,
        name,
        detail: `cites an origin (${origin.replace(/\s+/g, " ").trim().slice(0, 90)}…) with no ingested source`,
      });
      continue;
    }

    // EVERY reference is resolved, not just the first. A node citing two
    // sources where one is missing is not backed — it is half backed, and
    // reporting it as resolved would put the more reassuring of the two
    // answers on the record.
    const missing: string[] = [];
    const found: { ref: string; at: string }[] = [];
    for (const ref of evidence) {
      const at = resolveEvidence(root, ref);
      if (at === undefined) missing.push(ref);
      else found.push({ ref, at: relative(root, at) });
    }
    if (missing.length > 0) {
      r.unresolved.push({
        node,
        name,
        detail: `${missing.map((m) => `\`${m}\``).join(", ")} in no declared library`,
      });
      continue;
    }
    for (const f of found) r.resolved.push({ node, name, evidence: f.ref, at: f.at });
  }

  // The edge from this layer's skills: each name must be a node somewhere
  // in the corpus, the same reach the nodes above were read from.
  const names = new Set(methodologyNodes(root).flatMap((n) => (n.front ? [n.front.name] : [])));
  for (const u of methodologyUses(root)) {
    const missing = u.names.filter((n) => !names.has(n));
    if (u.names.length === 0) {
      r.badUses!.push({ node: u.file, name: u.skill, detail: "`uses-methodology` names no methodology; it is a list of methodology names" });
    } else if (missing.length > 0) {
      r.badUses!.push({
        node: u.file,
        name: u.skill,
        detail: `\`uses-methodology\` names ${missing.map((m) => `\`${m}\``).join(", ")}, which no methodology directory holds`,
      });
    }
  }
  return r;
}

/**
 * Bean `bo44`'s four states over a report. A hard finding (invalid front
 * matter, an unresolved `evidence` ref) always fails; the reported families
 * fail only under `strict`, exactly as the writer's exit has always decided.
 */
export function judgeMethodologyEvidence(r: EvidenceReport, strict = false): Judgement {
  const hard = r.invalid.length + r.unresolved.length + (r.badUses?.length ?? 0);
  const soft = strict ? r.noEvidence.length + r.untagged.length : 0;
  return judgementOf({ failing: hard + soft, undetermined: r.undetermined });
}

if (import.meta.main) {
  const strict = process.argv.includes("--strict");
  const GATE = "check:methodology-evidence";
  // In a layer's PR checks, only the caller's own methodologies (owner ruling 2026-11-05, "Move the checks"; `lib/gate-own.ts`).
  // The committed QA document covers the whole corpus and is the owning
  // repository's, so a scoped run neither writes nor compares it.
  const { dirs: subjects, scoped } = gateDirectoriesForGraph(INSTANCE_ROOT, "methodology");
  if (scoped && subjects.length === 0) {
    console.log(nothingOwnLine(GATE, "methodology directory", scoped));
    process.exit(0);
  }
  if (judging()) {
    // Judge mode: compute, judge, write NOTHING (bean `bo44`).
    const usage = judgeUsage(GATE, process.argv.slice(2), ["--strict"]);
    if (usage !== undefined) process.exit(usage);
    let jr: EvidenceReport;
    try {
      jr = checkMethodologyEvidence(INSTANCE_ROOT, subjects);
    } catch (e) {
      process.exit(concludeJudgement({ gate: GATE, judgement: "error", detail: (e as Error).message }));
    }
    for (const f of jr.unresolved) console.error(`  ✗ ${(f.name ?? f.node).padEnd(16)} ${f.detail}`);
    for (const f of jr.invalid) console.error(`  ✗ ${f.node}: ${f.detail}`);
    for (const f of jr.badUses ?? []) console.error(`  ✗ ${f.node}: ${f.detail}`);
    process.exit(
      concludeJudgement({
        gate: GATE,
        judgement: judgeMethodologyEvidence(jr, strict),
        detail: jr.undetermined
          ? "no directory declares a `methodology` graph"
          : `${jr.nodes} node(s): ${jr.unresolved.length} unresolved, ${jr.invalid.length} invalid, ` +
            `${jr.noEvidence.length} with no evidence${strict ? " (gated: --strict)" : " (reported)"}`,
        ...(jr.undetermined || scoped
          ? {}
          : {
              committed: {
                root: INSTANCE_ROOT,
                stem: "methodology-evidence",
                fresh: methodologyEvidenceDocument(jr),
                writer: GATE,
              },
            }),
      }),
    );
  }
  const r = checkMethodologyEvidence(INSTANCE_ROOT, subjects);

  if (r.undetermined) {
    console.error("UNDETERMINED: no directory declares a `methodology` graph — nothing was checked.");
    console.error("This is not a pass. Declare the graph, or say why this instance has none.");
    process.exit(2);
  }

  if (!scoped) writeQaResult(INSTANCE_ROOT, "methodology-evidence", methodologyEvidenceDocument(r));

  if (!process.argv.includes("--json")) {
    printReport(r);
  }

  const hard = r.invalid.length + r.unresolved.length + (r.badUses?.length ?? 0);
  if (hard > 0) process.exit(1);
  if (strict && r.noEvidence.length + r.untagged.length > 0) process.exit(1);
}

/** The sidecar document for a report. Pure, so the judge and the writer render ONE computation. */
export function methodologyEvidenceDocument(r: EvidenceReport): QaResult {
  return buildQaResult({
    script: "cat-harness-tools/scripts/check-methodology-evidence.ts",
    scriptAbsPath: fileURLToPath(import.meta.url),
    subject: { kind: "corpus", id: "methodologies" },
    families: {
      "evidence-unresolved": {
        summary:
          "An `evidence:` reference naming a bib-slug no declared library holds. WORSE than declaring none: " +
          "it reads as an ingested source in every listing, so a reader who does not open it is told the " +
          "citation resolves. Fails by default, unlike a missing `evidence` field, because a broken pointer " +
          "is not an open question about whether to adopt something.",
        entries: r.unresolved,
      },
      "invalid-front-matter": {
        summary:
          "A node tagged `folio-methodology/v1` whose front matter does not validate against " +
          "`schemas/process/methodology.ts`. The schema is `strict()`, so a misspelled key is a finding rather than " +
          "a silent omission — `applies_when` beside a correct `applies-when` would otherwise validate while " +
          "the selection question never reached the node. Fails by default.",
        entries: r.invalid,
      },
      "no-evidence-declared": {
        summary:
          "A valid methodology citing an origin, with no `evidence:` pointing at an ingested source. THE " +
          "FINDING THIS AXIS WAS BUILT FOR: on 2026-09-22 this was six of six. Reported, never gated — " +
          "whether a methodology whose source nobody can open may still be used is the owner's call, and a " +
          "gate failing on the whole corpus at once is one somebody switches off. `literature-search` is the " +
          "skill that closes one of these.",
        entries: r.noEvidence,
      },
      "untagged-file": {
        summary:
          "A `.md` sitting in a directory declared as a `methodology` graph, carrying no " +
          "`$schema: folio-methodology/v1`. It may legitimately be a README, which is why this is separate " +
          "from `invalid-front-matter` and is not gated — but an untagged node is one no consumer of the " +
          "graph can see, and that silence is indistinguishable from the file not being there.",
        entries: r.untagged,
      },
      // Only when there is one, so a clean corpus's committed sidecar is unchanged.
      ...((r.badUses?.length ?? 0) > 0
        ? {
            "uses-methodology-unresolved": {
              summary:
                "A skill's `uses-methodology` naming a methodology no declared directory holds: the typed " +
                "skill → methodology edge (cat-harness `schemas/process/methodology.ts`) pointing at nothing. Fails by " +
                "default, like an unresolved `evidence` reference, because a broken edge reads as an applied method.",
              entries: r.badUses!,
            },
          }
        : {}),
    },
  });
}

/** The writer's prose report. */
function printReport(r: EvidenceReport): void {
  console.log(`methodology evidence — ${r.nodes} node(s) across the declared \`methodology\` graph(s)\n`);
  for (const g of r.resolved) {
    console.log(`  ✓ ${g.name.padEnd(16)} ${g.evidence}  →  ${g.at}`);
  }
  for (const f of r.noEvidence) {
    console.log(`  · ${(f.name ?? basename(f.node)).padEnd(16)} no ingested source — ${f.detail}`);
  }
  for (const f of r.unresolved) console.log(`  ✗ ${(f.name ?? f.node).padEnd(16)} ${f.detail}`);
  for (const f of r.invalid) console.log(`  ✗ ${f.node}: ${f.detail}`);
  for (const f of r.badUses ?? []) console.log(`  ✗ ${f.node}: ${f.detail}`);
  for (const f of r.untagged) console.log(`  ? ${f.node}: ${f.detail}`);

  // COUNT THE METHODOLOGIES, NOT THE REFERENCES. `resolved` holds one entry
  // per (node, source) pair since `evidence` became an array, so its length
  // is a count of citations — and printing that as "N of 5 methodologies"
  // read as 2 the moment one node gained a second source. Exactly the
  // "never quote a count from prose" failure, in the script that exists to
  // replace prose counts with measured ones.
  const backed = new Set(r.resolved.map((g) => g.name)).size;
  const refs = r.resolved.length;
  console.log(
    `\n  ${backed} of ${r.nodes} methodolog${r.nodes === 1 ? "y" : "ies"} rest on a source this ` +
      `checkout holds${refs > backed ? `, across ${refs} ingested source(s)` : ""}.`,
  );
  if (r.noEvidence.length > 0) {
    console.log(`  ${r.noEvidence.length} cite${r.noEvidence.length === 1 ? "s" : ""} an origin nobody has ingested.`);
    console.log("  Not a gate. Run `literature-search` against one, or record why it stays as it is.");
  }
}
