/**
 * A translated page sits one directory deeper than the page it was translated
 * from, and its relative links have to move with it.
 *
 * A link copied verbatim from `docs/<path>` to `docs/<locale>/<path>` resolves
 * one level too deep (the reference tree is not translated, so such links must
 * climb back to the English one). `check:subgraphs` only counts these under
 * `siteResolved`, mixed with links the docs build will generate.
 *
 * ## The rule
 *
 * A link on `docs/<locale>/<path>` is a **depth** finding when it does NOT
 * resolve from its own directory but DOES resolve from the directory of
 * `docs/<path>` — the page it was translated from. Then, and only then,
 * prepending one `../` repairs it, and the repair is verified against disk
 * before it is made. Every other unresolved link (e.g. `api/` or generated
 * `.html`) is left alone.
 *
 * Usage:
 *   bun run cat translated-links:check   # non-zero if any translated page's link
 *                                    # resolves at its SOURCE depth but not its own
 *   bun run cat translated-links:fix     # prepend exactly one `../` to each, verified
 *
 * @covers docs
 * @graphNode tool
 */
import { HARNESS_ROOT } from "./lib/roots.ts";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { isRenderable, resolveDirectories } from "../schemas/kg/cat-harness.js";
import { knownLocales } from "./kg-locale-export.js";
import { scanSubgraphs } from "./check-subgraphs.js";

const ROOT = HARNESS_ROOT;

/** One link that resolves at its source page's depth but not at its own. */
export interface DepthFinding {
  /** Instance-relative path of the translated page. */
  readonly file: string;
  readonly locale: string;
  /** The link exactly as written. */
  readonly target: string;
  /** What it becomes — one `../`, never more. */
  readonly repaired: string;
}

export interface DepthReport {
  readonly locales: readonly string[];
  readonly findings: readonly DepthFinding[];
  /** Pages carrying at least one finding. */
  readonly pages: number;
  /**
   * Links on a translated page that do NOT resolve at the source depth
   * either — the published-tree links this check must not touch.
   *
   * Reported as a COUNT rather than swallowed, for `check:subgraphs`'
   * own reason: a bucket nobody can see is indistinguishable from an empty
   * one, and this is the number that says the control is discriminating
   * rather than passing everything through.
   */
  readonly publishedOnly: number;
}

/**
 * Does `target`, read from `dir`, name something on disk?
 *
 * `.html` is tried as `.md` because a renderable graph links to what Jekyll
 * will render, and an extensionless target is tried as both a page and a
 * directory index — the three shapes `docs/` actually uses.
 */
function resolvesFrom(dir: string, target: string): boolean {
  const abs = resolve(dir, target);
  const candidates = [abs, `${abs}.md`, join(abs, "index.md")];
  if (abs.endsWith(".html")) candidates.push(`${abs.slice(0, -".html".length)}.md`);
  return candidates.some((c) => existsSync(c));
}

/**
 * A link whose meaning does not depend on where the page sits is not this
 * check's business: a site-absolute path, an external URL, or a bare
 * fragment. Each would be "repaired" into nonsense by a `../`.
 */
export function depthSensitive(target: string): boolean {
  if (target.startsWith("/") || target.startsWith("#")) return false;
  return !/^[a-z][a-z0-9+.-]*:/i.test(target);
}

/**
 * Index of the locale segment in a page's path RELATIVE TO THE SITE ROOT, or
 * `-1` when there is none.
 *
 * Exported so the rule can be tested directly. The first version of this
 * check asked `segs[0] === locale`, which covered `docs/fr/x.md` and missed
 * `docs/guides/ar/x.md` — 24 links across four pages, found by re-measuring
 * for `mi97` rather than by any check, because the only check that could have
 * found them was this one. A rule that lives inline is a rule with no test.
 *
 * The LAST segment is never a candidate: it is the filename, and a page
 * called `fr.md` is not a locale directory.
 */
export function localeSegmentIndex(segs: readonly string[], locales: readonly string[]): number {
  return segs.findIndex((seg, i) => i < segs.length - 1 && locales.includes(seg));
}

export function translatedLinkDepth(root: string = ROOT): DepthReport {
  const locales = knownLocales(root);
  const report = scanSubgraphs(root);
  const findings: DepthFinding[] = [];
  const pages = new Set<string>();
  let publishedOnly = 0;

  // `check:declared-paths` refused a hardcoded `"docs"` here, and was right
  // to: which directory publishes a site is a DECLARATION, and naming it
  // would make this gate silently scan nothing the day the layer moves it
  // — the `dh4f` shape. Taken from the same resolution `scanSubgraphs` uses,
  // keyed by the `fromDir` id it already reports, so the two cannot disagree
  // about which directory a page belongs to.
  //
  // Renderable only, for the reason the bucket exists: `siteResolved` is
  // populated for a renderable graph, so a non-renderable directory
  // contributes nothing here and a locale subdirectory of one would not mean
  // the same thing.
  const siteDirs = new Map<string, string>();
  for (const d of resolveDirectories([{ name: "(local)", root, own: true }])) {
    if (d.graphTypologies.some((g) => isRenderable(g))) siteDirs.set(d.id, d.path);
  }

  for (const link of report.siteResolved) {
    const base = siteDirs.get(link.fromDir);
    if (base === undefined) continue;
    const within = relative(join(root, base), join(root, link.from));
    const segs = within.split(/[\\/]/);
    if (segs.length < 2) continue;
    // The locale segment at ANY depth, not just the first. `docs/fr/x.md` and
    // `docs/guides/ar/x.md` are the same defect, and the first version of this
    // check only looked at `segs[0]` — so it reported the 745 at depth 1 and
    // said nothing about 24 more nested a level in, across four pages.
    //
    // That is this file's own docblock coming true one merge later: a guard
    // that covers one of two writers reports the covered one and says nothing
    // about the other, which is indistinguishable from a pass. Found by
    // re-measuring for `mi97` rather than by any check, because the only
    // check that could have found it was this one.
    //
    // Never the LAST segment: that is the filename, and a page that happens to
    // be called `fr.md` is not a locale directory.
    const localeAt = localeSegmentIndex(segs, locales);
    if (localeAt < 0) continue;
    const locale = segs[localeAt];
    if (!depthSensitive(link.target)) continue;

    const ownDir = dirname(join(root, link.from));
    // The control: the SAME link, read from the page this one was translated
    // from — that one locale segment removed, so `<site>/fr/a/b.md` becomes
    // `<site>/a/b.md` and `<site>/guides/ar/b.md` becomes `<site>/guides/b.md`.
    // One segment either way, which is why the repair stays exactly one `../`.
    const sourceDir = dirname(
      join(root, base, ...segs.filter((_, i) => i !== localeAt)),
    );

    if (resolvesFrom(ownDir, link.target)) continue;
    if (!resolvesFrom(sourceDir, link.target)) {
      publishedOnly += 1;
      continue;
    }
    findings.push({ file: link.from, locale, target: link.target, repaired: `../${link.target}` });
    pages.add(link.from);
  }

  return { locales, findings, pages: pages.size, publishedOnly };
}

/**
 * Rewrite each finding in place, and return the files touched.
 *
 * Every occurrence of a finding's target in that file is rewritten, not the
 * first: the same literal target on the same page resolves the same way, so
 * one occurrence being wrong makes all of them wrong.
 *
 * Anchored on `](` and on what may follow a path, because `scanSubgraphs`
 * reports the target with any `#fragment` ALREADY STRIPPED. A plain
 * `](target)` match therefore misses every link that carries one, and 25 of
 * the first 745 did — `](guides/who-smart-ig.html#the-l3-pipeline)` among
 * them. They are the same defect and were silently left behind, which is the
 * kind of partial repair that reads as success: the count drops, the gate
 * still fails, and the remainder looks like a different problem.
 *
 * `)` ends the link, `#` a fragment, `?` a query, and whitespace a title —
 * so a longer path that merely starts with this target cannot match.
 */
export function repair(report: DepthReport, root: string = ROOT): string[] {
  const byFile = new Map<string, DepthFinding[]>();
  for (const f of report.findings) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f]);

  const touched: string[] = [];
  for (const [file, fs] of byFile) {
    const abs = join(root, file);
    const before = readFileSync(abs, "utf-8");
    let after = before;
    // Longest target first, so a shorter target that prefixes a longer one
    // cannot consume it. `](a/b)` and `](a/b/c)` are distinct links and the
    // exact-match parenthesis makes them distinguishable, but ordering costs
    // nothing and removes the need to reason about it.
    for (const f of [...new Set(fs.map((x) => x.target))].sort((a, b) => b.length - a.length)) {
      const escaped = f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      after = after.replace(new RegExp(`\\]\\(${escaped}(?=[)#?\\s])`, "g"), `](../${f}`);
    }
    if (after !== before) {
      writeFileSync(abs, after);
      touched.push(file);
    }
  }
  return touched;
}

if (import.meta.main) {
  const check = process.argv.slice(2).includes("--check");
  const report = translatedLinkDepth();

  if (report.locales.length === 0) {
    // `6tkl`: a sweep over no locales asserts nothing, and reporting it clean
    // would be a pass over an empty set.
    console.error("No locales under translations/ — refusing to call that clean.");
    process.exit(2);
  }

  console.log(
    `Translated link depth — ${report.locales.length} locale(s): ${report.locales.join(", ")}`,
  );
  console.log(
    `  ${report.publishedOnly} link(s) resolve only in the published tree at either depth — left alone`,
  );

  if (report.findings.length === 0) {
    console.log("✓ every depth-sensitive link on a translated page resolves at its own depth");
    process.exit(0);
  }

  if (check) {
    console.error(
      `\n✗ ${report.findings.length} link(s) across ${report.pages} translated page(s) resolve at their SOURCE page's depth but not their own.`,
    );
    const shown = report.findings.slice(0, 20);
    for (const f of shown) console.error(`  ${f.file}  →  ${f.target}   (want ${f.repaired})`);
    if (report.findings.length > shown.length) {
      console.error(`  …and ${report.findings.length - shown.length} more`);
    }
    console.error("\nRun `bun run cat translated-links:fix` and commit the result.");
    process.exit(1);
  }

  const touched = repair(report);
  console.log(`  repaired ${report.findings.length} link(s) in ${touched.length} file(s)`);
  for (const f of touched.slice(0, 10)) console.log(`    ${relative(".", f)}`);
  if (touched.length > 10) console.log(`    …and ${touched.length - 10} more`);
}
