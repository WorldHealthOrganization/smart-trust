/**
 * Where a folio's glossary and its narrative do not meet: a REPORT for a
 * person, never an edit, and never a failure (owner, 2026-11-01,
 * folio-assistant-core#498, Q-GLO-1 C: "warn-only QA"; "I don't want to get
 * heavy / prescriptive").
 *
 * Three findings, each a warning:
 *
 * - `source-missing`: an authored-scheme term's `source` names a repository
 *   file that is not there, so its term page cannot link the glossary row that
 *   defines it (Q-GLO-3 C: the glossary row is the defining site).
 * - `defines-unknown`: a block's manifest lists a term id in `defines` that no
 *   authored scheme of the folio holds, so the block explains a term nobody
 *   can link to.
 * - `unused`: a term that no passage of the folio's documents explains or
 *   uses. Often right (a term only the glossary needs), so it is listed last
 *   and only with `--all`.
 *
 *   bun run folio-assistant-core/scripts/glossary-links.ts [--repo DIR] [--json] [--all]
 *
 * @module folio-assistant-core/scripts/glossary-links
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Passage } from "./term-passages.ts";

export interface LinkFinding {
  kind: "source-missing" | "defines-unknown" | "unused";
  /** The term's `<instance>/<scheme>/<id>`, or the block's source for `defines-unknown`. */
  where: string;
  message: string;
}

interface TermRow {
  instance: string;
  scheme: string;
  id: string;
  label: string;
  source?: string;
  root: string;
}
interface BlockRow {
  source: string;
  defines: readonly string[];
}

/** The findings for these terms, blocks and passages; pure, for the tests. */
export function findings(terms: readonly TermRow[], blocks: readonly BlockRow[], passages: ReadonlyMap<string, readonly Passage[]>, all = false): LinkFinding[] {
  const out: LinkFinding[] = [];
  const ids = new Set(terms.map((t) => t.id));
  for (const t of terms) {
    const path = t.source?.split("#", 1)[0];
    // A path into a layer this checkout does not mount (its first segment
    // names no directory here) cannot be judged here, so it is left alone.
    const mounted = path ? existsSync(join(t.root, path.split("/", 1)[0]!)) : false;
    if (path && mounted && !/^[a-z][a-z0-9+.-]*:/i.test(path) && !existsSync(join(t.root, path))) {
      out.push({ kind: "source-missing", where: `${t.instance}/${t.scheme}/${t.id}`, message: `"${t.label}": source ${t.source} is not in the checkout, so its term page cannot link the glossary row that defines it` });
    }
  }
  for (const b of blocks) {
    for (const d of b.defines) {
      if (!ids.has(d)) out.push({ kind: "defines-unknown", where: b.source, message: `defines "${d}", which no authored glossary scheme holds; add the term, or fix the id` });
    }
  }
  if (all) {
    for (const t of terms) {
      if (!passages.has(`${t.instance}--${t.scheme}--${t.id}`)) out.push({ kind: "unused", where: `${t.instance}/${t.scheme}/${t.id}`, message: `"${t.label}": no passage of the folio's documents explains or uses it` });
    }
  }
  return out;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const at = args.indexOf("--repo");
  const repo = resolve(at >= 0 && args[at + 1] ? args[at + 1]! : process.cwd());
  const { collect, anchorOf, instanceOwners } = await import("./glossary-page.ts");
  const { narrativeBlocks, passagesIn } = await import("./term-passages.ts");
  const c = collect(repo);
  const roots = new Map(instanceOwners(repo).map((o) => [o.name, o.root] as const));
  const authored = c.glossaries.filter((s) => !s.extracted);
  const first = (l: unknown) => (typeof l === "string" ? l : String((l as Record<string, string>).en ?? Object.values(l as object)[0] ?? ""));
  const terms: TermRow[] = authored.flatMap((s) =>
    s.glossary.terms.map((t) => ({ instance: s.instance, scheme: s.glossary.id, id: t.id, label: first(t.prefLabel), root: roots.get(s.instance) ?? repo, ...(t.source ? { source: t.source } : {}) })),
  );
  const blocks = await narrativeBlocks(repo);
  const passages = passagesIn(
    blocks,
    authored.flatMap((s) => s.glossary.terms.map((t) => ({ key: anchorOf(s, t.id), id: t.id, labels: [first(t.prefLabel), ...(t.altLabel ?? [])], ...(t.notation ? { notation: t.notation } : {}), ...(t.source ? { source: t.source } : {}) }))),
  );
  const f = findings(terms, blocks, passages, args.includes("--all"));
  if (args.includes("--json")) console.log(JSON.stringify(f, null, 2));
  else {
    for (const x of f) console.warn(`! ${x.kind}  ${x.where}  ${x.message}`);
    console.log(`${f.length} warning(s) over ${terms.length} term(s) and ${blocks.length} block(s). A report, never a failure.`);
  }
}
