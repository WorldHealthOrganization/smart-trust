#!/usr/bin/env bun
/**
 * How far each locale's `.po` is behind its `.pot`, and the merge that brings
 * it level. Warn-only: a change to an English source must not fail a PR for
 * translations nobody has written yet. A STALE `.pot` is what fails, and that
 * is `translation-pot.ts --check`.
 *
 * The harness's `translation:drift:check` and `translation:obsolete:check`
 * read cat-harness's own catalogues and take no `--instance`, so they say
 * nothing about this instance's `translations/`. This is the same question
 * asked of every `translations/<locale>/**.pot` here and the `.po` beside it.
 *
 * Per catalogue it reports:
 * - new      — a template msgid the `.po` does not carry (needs translating)
 * - obsolete — a `.po` msgid the template no longer has (the source changed)
 * - fuzzy    — an entry flagged `#, fuzzy` (needs re-review)
 * - empty    — an entry with no `msgstr`
 *
 * `--merge` writes, per `.po`: each new msgid appended with an empty `msgstr`
 * and the template's comments, and each obsolete entry kept as `#~` (gettext's
 * obsolete form, translation preserved and revivable) rather than deleted.
 * There is no `msgmerge` in this container; this is its two safe halves. It
 * does not guess which new msgid an obsolete one became; a translator does,
 * and can revive the old text from the `#~` entry.
 *
 * Usage:
 *   bun input/scripts/po-status.ts           # report; exit 0
 *   bun input/scripts/po-status.ts --merge   # bring every .po level with its .pot
 *   bun input/scripts/po-status.ts --github  # report as GitHub warning annotations
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..", "..");
const TR = join(ROOT, "translations");

/** One entry: its raw lines (comments included), msgctxt + msgid as key, msgstr, fuzzy. */
interface Entry { lines: string[]; key: string; msgid: string; msgstr: string; fuzzy: boolean }

/** A PO string literal's value: C escapes as gettext writes them (\\n \\t \\" \\\\, others kept as the bare character). */
const unq = (s: string) =>
  s.slice(1, -1).replace(/\\(.)/g, (_, c: string) => ({ n: "\n", t: "\t", r: "\r" } as Record<string, string>)[c] ?? c);

/** Split a PO/POT into its header (first entry, empty msgid) and entries; `#~` lines are kept with the header-less tail. */
export function parsePo(text: string): { header: string[]; entries: Entry[]; obsolete: string[] } {
  const blocks = text.split(/\n{2,}/);
  const header: string[] = [];
  const entries: Entry[] = [];
  const obsolete: string[] = [];
  for (const b of blocks) {
    const lines = b.split("\n").filter((l) => l !== "");
    if (!lines.length) continue;
    if (lines.every((l) => l.startsWith("#~") || l.startsWith("#"))) {
      if (lines.some((l) => l.startsWith("#~"))) obsolete.push(lines.join("\n"));
      else header.push(...lines);
      continue;
    }
    let field = "";
    const v: Record<string, string> = { msgctxt: "", msgid: "", msgstr: "" };
    let ctx = false;
    for (const l of lines) {
      const m = /^(msgctxt|msgid|msgstr) (".*")$/.exec(l);
      if (m) { field = m[1]!; v[field] = unq(m[2]!); if (field === "msgctxt") ctx = true; continue; }
      if (l.startsWith('"') && field) v[field] += unq(l);
    }
    if (v.msgid === "" && !ctx) { header.push(...lines); continue; }
    entries.push({ lines, key: `${v.msgctxt}\u0004${v.msgid}`, msgid: v.msgid!, msgstr: v.msgstr!, fuzzy: lines.some((l) => l.startsWith("#,") && l.includes("fuzzy")) });
  }
  return { header, entries, obsolete };
}

function templates(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? templates(join(dir, e.name)) : e.name.endsWith(".pot") ? [join(dir, e.name)] : [],
  );
}

const merge = process.argv.includes("--merge");
const github = process.argv.includes("--github");
const totals: Record<string, { cat: number; missing: number; new: number; obsolete: number; fuzzy: number; empty: number; entries: number }> = {};

for (const locale of existsSync(TR) ? readdirSync(TR, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort() : []) {
  const t = (totals[locale] = { cat: 0, missing: 0, new: 0, obsolete: 0, fuzzy: 0, empty: 0, entries: 0 });
  for (const potPath of templates(join(TR, locale)).sort()) {
    const poPath = potPath.replace(/\.pot$/, ".po");
    const pot = parsePo(readFileSync(potPath, "utf8"));
    if (!existsSync(poPath)) { t.missing++; continue; }
    t.cat++;
    const po = parsePo(readFileSync(poPath, "utf8"));
    const potKeys = new Set(pot.entries.map((e) => e.key));
    const poKeys = new Set(po.entries.map((e) => e.key));
    const fresh = pot.entries.filter((e) => !poKeys.has(e.key));
    const gone = po.entries.filter((e) => !potKeys.has(e.key));
    const fuzzy = po.entries.filter((e) => e.fuzzy && potKeys.has(e.key)).length;
    const empty = po.entries.filter((e) => !e.msgstr && potKeys.has(e.key)).length;
    t.entries += pot.entries.length; t.new += fresh.length; t.obsolete += gone.length; t.fuzzy += fuzzy; t.empty += empty;
    const rel = relative(ROOT, poPath);
    if (fresh.length || gone.length || fuzzy) {
      const msg = `${rel}: ${fresh.length} new, ${gone.length} obsolete, ${fuzzy} fuzzy — the English source changed; translation is behind (unofficial, not a failure)`;
      console.log(github ? `::warning file=${rel}::${msg}` : `  · ${msg}`);
    }
    if (merge && (fresh.length || gone.length)) {
      const goneKeys = new Set(gone.map((e) => e.key));
      const kept = po.entries.filter((e) => !goneKeys.has(e.key)).map((e) => e.lines.join("\n"));
      const added = fresh.map((e) => e.lines.join("\n"));
      const dead = gone.map((e) => e.lines.filter((l) => !l.startsWith("#:")).map((l) => (l.startsWith("#") && !l.startsWith("#,") ? l : `#~ ${l}`)).join("\n"));
      writeFileSync(poPath, [po.header.join("\n"), ...kept, ...added, ...po.obsolete, ...dead].join("\n\n") + "\n");
    }
  }
}
for (const [l, t] of Object.entries(totals)) {
  const done = t.entries - t.new - t.empty;
  console.log(`${l}: ${t.cat} catalogue(s), ${t.missing} template(s) with no .po, ${done}/${t.entries} string(s) translated, ${t.new} new, ${t.obsolete} obsolete, ${t.fuzzy} fuzzy${merge ? " — merged" : ""}`);
}
