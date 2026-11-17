#!/usr/bin/env bun
/**
 * dmn-check: run the DMN table checks (src/workflow/dmn-qa.ts) over a
 * layer's decision tables, wherever they sit.
 *
 * Usage, from a layer root that mounts cat-harness-tools:
 *
 *   bun run cat-harness-tools/scripts/dmn-check.ts [paths…] [--root DIR]
 *       [--json] [--no-require-unknown] [--strict]
 *
 * With no paths it reads `folio/`, `processes/` and `decisions/` under the
 * root, whichever exist. A table beside a folio block is compared with that
 * block's Markdown (same file stem, `.md`). The same decision id in more than
 * one file is a `dmn-one-copy` warning: the copy beside the folio block is the
 * one to keep.
 *
 * Exit code 1 when any error is found (with --strict, any warning too).
 *
 * The script is `dmn:report`, not `dmn:check`: CI gates every `check:*` and
 * `*:check` script of every repository that mounts this layer. A DTH that
 * wants the gate declares its own `check:dmn` once its tables pass.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { listDecisions, loadDecisionTable } from "../src/workflow/decision-table.js";
import { CHECK_SEVERITY, checkFolioStructure, checkTable, type DmnFinding } from "../src/workflow/dmn-qa.js";

export interface FileReport {
  file: string;
  findings: DmnFinding[];
}

const SKIP = new Set(["node_modules", ".git"]);

function dmnFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  if (statSync(dir).isFile()) return dir.endsWith(".dmn") ? [dir] : [];
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name) || e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...dmnFiles(p));
    else if (e.name.endsWith(".dmn")) out.push(p);
  }
  return out;
}

/** Check every table under `paths`; paths are relative to `root`. */
export async function checkDmn(
  root: string,
  paths: string[] = ["folio", "processes", "decisions"],
  opts: { requireUnknown?: boolean } = {},
): Promise<FileReport[]> {
  const files = [...new Set(paths.flatMap((p) => dmnFiles(resolve(root, p))))].sort();
  const reports: FileReport[] = [];
  const seen = new Map<string, string[]>();

  for (const abs of files) {
    const rel = relative(root, abs);
    const findings: DmnFinding[] = [];
    let ids: string[];
    try {
      ids = (await listDecisions(abs)).map((d) => d.id);
    } catch (e) {
      reports.push({ file: rel, findings: [{ check: "dmn-loads", severity: "error", decision: basename(abs), detail: `does not parse: ${e instanceof Error ? e.message : e}` }] });
      continue;
    }
    if (ids.length === 0) {
      findings.push({ check: "dmn-loads", severity: "error", decision: basename(abs), detail: "declares no decision." });
    }
    for (const id of ids) {
      seen.set(id, [...(seen.get(id) ?? []), rel]);
      let table;
      try {
        table = await loadDecisionTable(abs, id);
      } catch (e) {
        findings.push({ check: "dmn-loads", severity: "error", decision: id, detail: `will not load: ${e instanceof Error ? e.message : e}` });
        continue;
      }
      findings.push(...checkTable(table, opts));
      // Only a table inside the folio has a block to be compared with.
      if (rel.split(/[\\/]/)[0] === "folio") {
        const md = join(dirname(abs), basename(abs).replace(/\.dmn$/, ".md"));
        findings.push(...checkFolioStructure(table, existsSync(md) ? readFileSync(md, "utf-8") : undefined, relative(root, md)));
      }
    }
    reports.push({ file: rel, findings });
  }

  for (const [id, where] of seen) {
    if (where.length < 2) continue;
    // declared-path-literal: the folio content root, the same root the table
    // check above keys on; the copy inside the folio is the one kept.
    const keep = where.find((w) => w.startsWith("folio/") || w.startsWith("folio\\"));
    for (const w of where) {
      if (w === keep) continue;
      reports
        .find((r) => r.file === w)!
        .findings.push({
          check: "dmn-one-copy",
          severity: CHECK_SEVERITY["dmn-one-copy"],
          decision: id,
          detail: `decision "${id}" is also declared in ${where.filter((x) => x !== w).join(", ")}.` +
            (keep ? ` Keep the copy beside the folio block (${keep}) and delete this one.` : " Keep one copy, beside its folio block."),
        });
    }
  }
  return reports;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let root = process.cwd();
  const paths: string[] = [];
  let json = false;
  let strict = false;
  let requireUnknown = true;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--root") root = resolve(argv[++i] ?? ".");
    else if (a === "--json") json = true;
    else if (a === "--strict") strict = true;
    else if (a === "--no-require-unknown") requireUnknown = false;
    else if (a === "--help" || a === "-h") {
      console.log("usage: dmn-check [paths…] [--root DIR] [--json] [--no-require-unknown] [--strict]");
      return;
    } else paths.push(a);
  }

  const reports = await checkDmn(root, paths.length > 0 ? paths : undefined, { requireUnknown });
  const all = reports.flatMap((r) => r.findings);
  const errors = all.filter((f) => f.severity === "error").length;
  const warnings = all.length - errors;

  if (json) {
    console.log(JSON.stringify({ tables: reports.length, errors, warnings, reports }, null, 2));
  } else {
    for (const r of reports) {
      console.log(`${r.findings.some((f) => f.severity === "error") ? "✗" : r.findings.length ? "!" : "✓"} ${r.file}`);
      for (const f of r.findings) {
        console.log(`    ${f.severity === "error" ? "error  " : "warning"} ${f.check} ${f.decision}${f.rule ? `/${f.rule}` : ""}: ${f.detail}`);
      }
    }
    console.log(`\n${reports.length} DMN file(s): ${errors} error(s), ${warnings} warning(s).`);
  }
  if (errors > 0 || (strict && warnings > 0)) process.exit(1);
}

if (import.meta.main) await main();
