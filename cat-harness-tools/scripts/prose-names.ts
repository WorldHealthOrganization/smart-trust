/**
 * Do the files a general node's PROSE names still exist?
 *
 * A process's documentation may name a file to explain a step
 * ("`feature-staging.yml` publishes the branch"); that stays, unlike a data
 * reference (data-modelling step 8). But prose cannot notice a rename, so
 * this lists each name that no longer resolves. It is ADVISORY: it says a
 * name went stale, not that naming it was wrong.
 *
 * | state | means |
 * |---|---|
 * | `resolves` | a path in the checkout, or a bare file name some tracked file carries |
 * | `not-a-path` | a glob or a placeholder (`<slug>.md`, `*.bpmn`) — not checkable, not a finding |
 * | `undetermined` | a BARE name nothing here carries — a run's output (`qa.json`), a folio's file (`AtomicMass.lean`) or an example (`file.dmn`) as often as a stale one, and prose does not say which |
 * | `missing` | a path whose DIRECTORY is here and whose file is not — the one finding |
 *
 * @module scripts/prose-names
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/** File extensions a name in prose is recognised by. */
const EXT = "ts|js|mjs|py|sh|yml|yaml|json|jsonld|md|bpmn|dmn|lean|fsh";

export type NameState = "resolves" | "not-a-path" | "undetermined" | "missing";

/** Every file name a piece of prose mentions, in order, without repeats. */
export function namedFiles(prose: string): string[] {
  const out: string[] = [];
  const re = new RegExp(String.raw`(?<![\w/.:<*-])([\w.*<>{}-][\w./*<>{}-]*\.(?:${EXT}))(?![\w/-])`, "g");
  for (const m of prose.matchAll(re)) {
    const name = m[1]!;
    // Part of a URL is not a file in this checkout.
    if (/https?:\/\/\S*$/.test(prose.slice(Math.max(0, m.index! - 200), m.index!))) continue;
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

/**
 * Classify one name.
 *
 * A name with a directory is tried against each root, because the corpus
 * spells repository-relative and instance-relative paths alike. A BARE name
 * (`feature-staging.yml`) names a file without saying where, so it resolves
 * when some tracked file has that basename — the reader of the prose finds it
 * the same way — and is `undetermined`, never `missing`, when none does.
 */
export function classifyName(name: string, roots: readonly string[], basenames: ReadonlySet<string>): NameState {
  if (/[*?<>{}]/.test(name)) return "not-a-path";
  if (!name.includes("/")) return basenames.has(name) ? "resolves" : "undetermined";
  const trimmed = name.replace(/^\.\//, "");
  if (roots.some((r) => existsSync(join(r, trimmed)))) return "resolves";
  // MISSING only where the prose names a real directory and the file is not
  // in it — `docs/proposals/x.md` with `docs/proposals/` present. A path whose
  // directory is not here either (`work/work.json`, a relocation described
  // hypothetically; a folio's tree) makes no claim this checkout can refute.
  // The same rule `pair-claims.ts` applies to a cited module.
  return roots.some((r) => existsSync(join(r, dirname(trimmed)))) ? "missing" : "undetermined";
}

/**
 * The documentation of a `@general` TypeScript declaration: its leading doc
 * comment and its body, up to the first line back at column 0.
 */
export function generalDeclarationProse(source: string): { name: string; prose: string }[] {
  const out: { name: string; prose: string }[] = [];
  const re = /\/\*\*((?:(?!\*\/)[\s\S])*?)\*\/\s*export (?:const|interface|type) (\w+)([\s\S]*?)\n(?=[^\s])/g;
  for (const m of source.matchAll(re)) {
    if (!/(^|\s)@general\b/.test(m[1]!)) continue;
    out.push({ name: m[2]!, prose: `${m[1]}\n${m[3]}` });
  }
  return out;
}

/** Every `<bpmn:documentation>` in a diagram, entity-decoded once. */
export function diagramProse(xml: string): string {
  return [...xml.matchAll(/<bpmn:documentation>([\s\S]*?)<\/bpmn:documentation>/g)]
    .map((m) => m[1]!.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&"))
    .join("\n");
}
