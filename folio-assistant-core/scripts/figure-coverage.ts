#!/usr/bin/env bun
/**
 * figure-coverage: for every figure a source publication declares, does the
 * folio built from it have a block, and is that block computable or only a
 * picture?
 *
 * ## Why it exists
 *
 * On 2026-10-31 the supply chain handbook's folio (litlfred/dth-sc) had no
 * blocks for nine of its 32 figures. The vector-figure arm had missed their
 * captions (`Fig 1.` with no dot, cat-harness-tools#1119), and nothing compared
 * the figures the publication declares with the figure blocks the folio holds.
 * So the gap was invisible until a reader looked for the figures. This check
 * makes it a count, the same way `l1-coverage` does for normative sentences.
 *
 * It also answers the owner's second question, "can we recreate them
 * computably?". A figure block whose file is a PNG crop of the PDF is a
 * picture: its boxes and arrows are not nodes. The report says, per figure,
 * whether it is only a picture, a picture linked to a model view, or rebuilt
 * from data (the `figure-rebuild` skill).
 *
 * ## Inputs
 *
 * - `--entry`: the L1 library entry directory. Its `sections/*.md` are read
 *   with cat-harness-tools' `declaredFigureCaptions`, the same reading
 *   `check:l1-complete` uses, so the two checks cannot disagree about which
 *   figures exist.
 * - `--folio`: the folio's document directory (e.g. `folio/dth-sc`). Every
 *   `*.jsonld` block of kind `figure`, `diagram` or `table` is read, with its
 *   `.ts` caption and `.md` text, and the figure numbers it names are taken
 *   from those (`Fig. 26. ...; Fig. 27. ...` names two).
 * - `--exclusions` (optional): JSON `[{ "figure": "12", "scope": "block" |
 *   "rebuild", "reason": "...", "signedOffBy"?: "...", "signedOffAt"?: "..." }]`.
 *   `scope: "block"` means the folio deliberately has no block (third-party
 *   content used by permission); `scope: "rebuild"` means the figure stays a
 *   cited picture (a country example, a screenshot, a photograph). As in
 *   `l1-coverage`, an exclusion with no `signedOffBy` is a proposal and does
 *   not count.
 *
 * ## States, per declared figure
 *
 * - `missing`: no block names it, and no signed-off block exclusion.
 * - `excluded`: no block, by a signed-off `scope: "block"` exclusion.
 * - `picture`: only blocks whose source method is a crop or image.
 * - `linked`: a picture whose block links a model view (`meta.figureViews`),
 *   or names the publication it reproduces (`meta.reproduces` with a
 *   `source` and a `component`, as the figure-rebuild skill asks: linked,
 *   never redrawn; core#486).
 * - `computable`: a `diagram` block, a `table` block, or a figure block whose
 *   `meta.source.method` is one of {@link COMPUTABLE_METHODS}.
 * - `cited`: a picture by a signed-off `scope: "rebuild"` exclusion.
 *
 * Exit 1 when any figure is `missing` (or an exclusion is malformed); with
 * `--require-computable`, also when any is `picture` or `linked`. 2 on
 * unusable input.
 *
 * @graphNode none, a check over an entry and a folio, not a schema
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { declaredFigureCaptions } from "@litlfred/cat-harness-tools/scripts/check-l1-complete.ts";

/** Methods that mean the figure was rebuilt from data, not cropped. */
export const COMPUTABLE_METHODS = [
  "redrawn",
  "generated",
  "archimate-view",
  "bpmn",
  "dmn",
  "fhir-logical-model",
] as const;

export const BLOCK_KINDS = ["figure", "diagram", "table"] as const;
export const EXCLUSION_SCOPES = ["block", "rebuild"] as const;

export type FigureState = "missing" | "excluded" | "picture" | "linked" | "computable" | "cited";

export interface FigureBlock {
  /** The block's `.jsonld` path, relative to the folio directory. */
  file: string;
  kind: string;
  figures: string[];
  method: string | null;
  linkedViews: number;
  /** The block reproduces a figure of another publication and names it. */
  reproduces?: boolean;
}

export interface Exclusion {
  figure: string;
  scope: string;
  reason: string;
  signedOffBy?: string;
  signedOffAt?: string;
}

export interface FigureRow {
  figure: string;
  caption: string | null;
  state: FigureState;
  blocks: string[];
  reason?: string;
}

export interface Report {
  $schema: "figure-coverage-report/v1";
  declared: number;
  counts: Record<FigureState, number>;
  figures: FigureRow[];
  /** Blocks naming a figure number the publication does not declare. */
  undeclared: { file: string; figure: string }[];
  problems: string[];
}

/**
 * The figure numbers a caption names. `Fig.`, `Fig` and `Figure` all count,
 * and so does a combined caption (`Fig. 26. ...; Fig. 27. ...`).
 */
export function figureNumbers(caption: string): string[] {
  const out: string[] = [];
  for (const m of caption.matchAll(/\b(?:Fig\.?|Figure)[ \t]*(\d+(?:\.\d+)*)/g)) {
    if (!out.includes(m[1]!)) out.push(m[1]!);
  }
  return out;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".jsonld")) out.push(p);
  }
  return out;
}

/** Read every figure, diagram and table block under a folio directory. */
export function readBlocks(folioDir: string): FigureBlock[] {
  const blocks: FigureBlock[] = [];
  for (const path of walk(folioDir)) {
    let doc: Record<string, unknown>;
    try {
      doc = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    } catch {
      continue;
    }
    const kind = typeof doc.kind === "string" ? doc.kind : "";
    if (!(BLOCK_KINDS as readonly string[]).includes(kind)) continue;
    const stem = path.slice(0, -".jsonld".length);
    const ts = existsSync(stem + ".ts") ? readFileSync(stem + ".ts", "utf8") : "";
    const md = existsSync(stem + ".md") ? readFileSync(stem + ".md", "utf8") : "";
    const caption = /caption:\s*"((?:[^"\\]|\\.)*)"/.exec(ts)?.[1] ?? "";
    // The .md's first line holds the caption as image alt text or an italic
    // title; deeper lines are body text, whose cross-references must not count.
    const mdHead = md.split("\n").find((l) => l.trim() !== "") ?? "";
    const figures = figureNumbers(`${caption}\n${mdHead}`);
    if (figures.length === 0) continue; // an ordinary table, not a figure
    const meta = (doc.meta ?? {}) as Record<string, unknown>;
    const source = (meta.source ?? {}) as Record<string, unknown>;
    const views = Array.isArray(meta.figureViews) ? meta.figureViews.length : 0;
    const rep = (meta.reproduces ?? null) as Record<string, unknown> | null;
    const named = (v: unknown) => typeof v === "string" && v.trim() !== "";
    const reproduces = rep !== null && typeof rep === "object" && named(rep.source) && named(rep.component);
    blocks.push({
      file: path.slice(folioDir.length).replace(/^\/+/, ""),
      kind,
      figures,
      method: typeof source.method === "string" ? source.method : null,
      linkedViews: views,
      reproduces,
    });
  }
  return blocks;
}

function isComputable(b: FigureBlock): boolean {
  if (b.kind === "diagram" || b.kind === "table") return true;
  return b.method !== null && (COMPUTABLE_METHODS as readonly string[]).includes(b.method);
}

export function coverage(
  declared: Map<string, string | null>,
  blocks: FigureBlock[],
  exclusions: Exclusion[] = [],
): Report {
  const problems: string[] = [];
  const signed = new Map<string, Exclusion>();
  for (const e of exclusions) {
    if (!(EXCLUSION_SCOPES as readonly string[]).includes(e.scope)) {
      problems.push(`exclusion for Fig. ${e.figure}: scope must be "block" or "rebuild", not ${JSON.stringify(e.scope)}`);
      continue;
    }
    if (!declared.has(e.figure)) {
      problems.push(`exclusion names Fig. ${e.figure}, which the publication does not declare`);
      continue;
    }
    if (!e.reason?.trim()) {
      problems.push(`exclusion for Fig. ${e.figure} has no reason`);
      continue;
    }
    if (e.signedOffBy) signed.set(`${e.scope}:${e.figure}`, e);
  }

  const order = [...declared.keys()].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const rows: FigureRow[] = order.map((figure) => {
    const own = blocks.filter((b) => b.figures.includes(figure));
    const row: FigureRow = { figure, caption: declared.get(figure) ?? null, state: "missing", blocks: own.map((b) => b.file) };
    if (own.length === 0) {
      const ex = signed.get(`block:${figure}`);
      if (ex) Object.assign(row, { state: "excluded", reason: ex.reason });
      return row;
    }
    if (own.some(isComputable)) row.state = "computable";
    else if (signed.has(`rebuild:${figure}`)) Object.assign(row, { state: "cited", reason: signed.get(`rebuild:${figure}`)!.reason });
    else if (own.some((b) => b.linkedViews > 0 || b.reproduces === true)) row.state = "linked";
    else row.state = "picture";
    return row;
  });

  const undeclared: { file: string; figure: string }[] = [];
  for (const b of blocks) for (const f of b.figures) if (!declared.has(f)) undeclared.push({ file: b.file, figure: f });

  const counts = { missing: 0, excluded: 0, picture: 0, linked: 0, computable: 0, cited: 0 } as Record<FigureState, number>;
  for (const r of rows) counts[r.state]++;
  return { $schema: "figure-coverage-report/v1", declared: rows.length, counts, figures: rows, undeclared, problems };
}

export function exitCodeFor(r: Report, requireComputable = false): number {
  if (r.problems.length > 0 || r.counts.missing > 0) return 1;
  if (requireComputable && r.counts.picture + r.counts.linked > 0) return 1;
  return 0;
}

function arg(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const entry = arg(argv, "--entry");
  const folio = arg(argv, "--folio");
  if (argv.includes("--help") || !entry || !folio) {
    console.error(
      "usage: bun run folio-assistant-core/scripts/figure-coverage.ts --entry <library/<doc-id>> --folio <folio/<doc>> [--exclusions <exclusions.json>] [--require-computable] [--out <report.json>]",
    );
    process.exit(argv.includes("--help") ? 0 : 2);
  }
  let report: Report;
  try {
    const sections = join(entry, "sections");
    if (!existsSync(sections)) throw new Error(`${sections} does not exist`);
    if (!existsSync(folio)) throw new Error(`${folio} does not exist`);
    const exPath = arg(argv, "--exclusions");
    report = coverage(
      declaredFigureCaptions(sections),
      readBlocks(folio),
      exPath ? (JSON.parse(readFileSync(exPath, "utf8")) as Exclusion[]) : [],
    );
  } catch (e) {
    console.error(`  ✗ ${(e as Error).message}`);
    process.exit(2);
  }
  const out = arg(argv, "--out");
  const json = JSON.stringify(report, null, 2) + "\n";
  if (out) writeFileSync(out, json);
  else process.stdout.write(json);
  for (const r of report.figures) {
    const where = r.blocks.length ? r.blocks.map((b) => basename(b, ".jsonld")).join(", ") : "-";
    console.error(`  Fig. ${r.figure.padEnd(5)} ${r.state.padEnd(10)} ${where}${r.reason ? `  (${r.reason})` : ""}`);
  }
  const c = report.counts;
  console.error(
    `  ${report.declared} declared: ${c.computable} computable, ${c.linked} linked, ${c.picture} picture, ${c.cited} cited, ${c.excluded} excluded, ${c.missing} missing`,
  );
  for (const u of report.undeclared) console.error(`  ! ${u.file} names Fig. ${u.figure}, which the publication does not declare`);
  for (const p of report.problems) console.error(`  ✗ ${p}`);
  process.exit(exitCodeFor(report, argv.includes("--require-computable")));
}
