/**
 * ig-annex-judge.ts — what an `ig-annex` directory's `annexes.json` SAYS is
 * consistent, not only how it is shaped.
 *
 * The `ig-annex` kind (`typologies/ig-annex.json`) is TYPED by its validator:
 * `check:kind-validators` parses each declaration against `ig-annexes/v1`.
 * Typing is not judging, and the kind read `typed-only` in
 * `audit:coverage:require-all` the day an IG repository first declared one
 * (folio-assistant#2681). This is the opinion,
 * kept to what this layer's GENERIC contract (page, file, columns) can say,
 * because the annex files themselves are another layer's kind:
 *
 * - **a declaration is there** — a declared `ig-annex` directory holds an
 *   `annexes.json`. One that holds none places nothing, and the IG build
 *   (`annexesIn`) would say nothing about it.
 * - **it is `ig-annexes/v1`** — `{ $schema, annexes: [...] }`, strict. The
 *   bare array `annexesIn` still reads is the shape `fhir-artifact-index/
 *   annexes.json` carried before the kind (fhir-harness#33); an `ig-annex`
 *   directory is newer than that, so it has no reason to hold it.
 * - **every file is held, inside its layer** — `file` is relative to the
 *   directory, and resolves to a file of the same layer. One that is not
 *   held is the failure `annexesIn` throws on at build time, found here first;
 *   one outside the layer is a file an index mounting it does not carry.
 * - **no record twice, no column twice** — two records for one page and one
 *   file mount the same table twice; a column named twice is shown twice.
 * - **the page** — `page` names a file under the IG's `input/pagecontent/`.
 *   It is judged when the layer holds that directory; an index mounts only
 *   declared directories, so there it is NOT verified, and the result says
 *   so rather than counting it.
 *
 * Read by `check-artifact-index.ts`, which a CI gate runs.
 *
 * @module fhir-harness/scripts/ig-annex-judge
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import { readDeclaration } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";
import { IG_ANNEX_KIND, IG_ANNEXES_FILE, IgAnnexesSchema } from "../schemas/ig-annexes.ts";

/** Where an IG keeps its narrative pages, relative to its root. */
export const IG_PAGECONTENT_DIR = join("input", "pagecontent");

/** What judging one `ig-annex` directory found. */
export interface IgAnnexJudgement {
  /** The `annexes.json`, absolute. */
  declaration: string;
  /** Records the declaration holds (0 when it could not be read). */
  records: number;
  findings: string[];
  /** Pages named and not verified, because the layer holds no `input/pagecontent/`. */
  pagesUnverified: string[];
}

function isFile(abs: string): boolean {
  try {
    return statSync(abs).isFile();
  } catch {
    return false;
  }
}

/** Whether `abs` lies inside `root` (or is it). */
function within(root: string, abs: string): boolean {
  const r = resolve(root);
  const a = resolve(abs);
  return a === r || a.startsWith(r + sep);
}

/**
 * Judge ONE `ig-annex` directory of the layer at `instanceRoot`.
 * `instanceRoot` bounds where a record's `file` may point, and is where the
 * IG's `input/pagecontent/` is looked for.
 */
export function judgeIgAnnexDir(instanceRoot: string, dir: string): IgAnnexJudgement {
  const declaration = join(dir, IG_ANNEXES_FILE);
  const out: IgAnnexJudgement = { declaration, records: 0, findings: [], pagesUnverified: [] };
  if (!existsSync(declaration)) {
    out.findings.push(`declared as ${IG_ANNEX_KIND} and holds no ${IG_ANNEXES_FILE}, so it places no annex`);
    return out;
  }
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(declaration, "utf-8"));
  } catch (e) {
    out.findings.push(`is not readable JSON — ${e instanceof Error ? e.message : String(e)}`);
    return out;
  }
  const parsed = IgAnnexesSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    out.findings.push(`does not validate as ig-annexes/v1: ${issue ? `${issue.path.join(".") || "(root)"}: ${issue.message}` : "unknown issue"}`);
    return out;
  }
  const records = parsed.data.annexes;
  out.records = records.length;
  const pagecontent = join(instanceRoot, IG_PAGECONTENT_DIR);
  const pagesHeld = existsSync(pagecontent);
  const seen = new Set<string>();
  for (const r of records) {
    const label = `annex ${r.file} on ${r.page}`;
    const key = `${r.page}\u0000${r.file}`;
    if (seen.has(key)) out.findings.push(`${label} is declared twice`);
    seen.add(key);
    const abs = resolve(dir, r.file);
    if (!within(instanceRoot, abs)) out.findings.push(`${label} names a file outside its instance (${relative(instanceRoot, abs)}), which an index mounting it does not carry`);
    else if (!isFile(abs)) out.findings.push(`${label} names a file that is not held`);
    const dupCols = (r.columns ?? []).filter((c, i, all) => all.indexOf(c) !== i);
    if (dupCols.length > 0) out.findings.push(`${label} shows column(s) twice: ${[...new Set(dupCols)].map((c) => `"${c}"`).join(", ")}`);
    if (!pagesHeld) {
      if (!out.pagesUnverified.includes(r.page)) out.pagesUnverified.push(r.page);
    } else if (!isFile(join(pagecontent, r.page))) {
      out.findings.push(`${label}: ${r.page} is not a page under ${IG_PAGECONTENT_DIR}/`);
    }
  }
  return out;
}

/**
 * Every `ig-annex` directory the layer at `instanceRoot` declares, judged.
 * A directory declared and absent from this checkout is returned in `absent`
 * — said, never read as empty and never counted as judged.
 */
export function judgeInstanceAnnexes(instanceRoot: string): { judged: IgAnnexJudgement[]; absent: string[] } {
  const judged: IgAnnexJudgement[] = [];
  const absent: string[] = [];
  for (const d of readDeclaration(instanceRoot)?.directories ?? []) {
    if (!(d.graphTypologies as readonly string[] | undefined)?.includes(IG_ANNEX_KIND)) continue;
    const abs = join(instanceRoot, d.path);
    if (existsSync(abs)) judged.push(judgeIgAnnexDir(instanceRoot, abs));
    else absent.push(abs);
  }
  return { judged, absent };
}
