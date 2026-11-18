/**
 * Obsolete the msgids a committed `.po` still carries but its source no longer
 * yields — `lvk9`'s last Done-when item, "with tooling, not dropped".
 *
 * When the extractor's segmentation changes, msgids in existing catalogues stop
 * matching their source. Deleting them throws away translation work; leaving them
 * shows a translator strings the page does not contain. gettext's answer is the
 * third state: an OBSOLETE entry, `#~`-prefixed, translation kept and marked
 * dead, revivable by a human. There is no `msgmerge` in this container, so the
 * mechanism lives here.
 *
 * ## It asks the FILE what its source is
 *
 * A `.po` declares its source in `#:` reference comments, and this reads them.
 * Three earlier attempts at the same measurement invented a pairing rule instead,
 * and each was wrong in a way that still produced a confident number:
 *
 *   - `join(DOCS, page + ".md")` — top-level pages only. Reported "0 of 14 pages
 *     differ" and was used to claim no catalogue was stranded. Three were.
 *   - recursive match on BASENAME — found a same-named file for everything, so it
 *     paired `kg-viewer.po` with `docs/reference/skill-instructions/kg-viewer.md`
 *     and called all 40 of its msgids stale. Its `#:` lines say
 *     `scripts/kg-viewer-strings.ts`: TypeScript UI strings this extractor never
 *     touches. 200 of a reported 281 findings were that one mistake.
 *   - the same, plus a uniqueness check — sound, but still a guess where a
 *     declaration existed.
 *
 * So the classification below is the point of this module, not a preamble to it.
 * A catalogue whose source cannot be determined is reported as such and never
 * counted clean, because "no findings over the subset I could resolve" is exactly
 * the shape that produced the wrong claim above.
 *
 * ## `--instance <dir>`
 *
 * Surveys the catalogues of the layer at `<dir>` instead of this one: its
 * `translation-sources` directory, from its declaration, and its pages,
 * resolved against its own root. A layer that declares no such directory
 * is reported and exits 2 — "no catalogue" is not "no stale catalogue".
 *
 * @covers translation-sources
 * @module pipeline/obsolete-stale-po
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

import { extractMarkdown } from "./pot-extract.ts";
import { directoryForGraph, readDeclaration } from "../schemas/kg/cat-harness.ts";
import { instanceSiteRoot, siteRoot } from "./translation-index.ts";
import { gateOwnInstances, gateOwnsFile, nothingOwnLine } from "../scripts/lib/gate-own.ts";
import { explicitInstanceRoot, HARNESS_ROOT, REPO_ROOT } from "../scripts/lib/roots.ts";

/** Locale directories, which are never a source page. */
const LOCALE_DIR_RE = /(^|\/)(ar|es|fr|ru|zh)(\/|$)/;

/** Why a catalogue was not compared. Each is a state, not a zero. */
export type Unresolved =
  /** Every `#:` names something other than a `.md` — not this extractor's subject. */
  | "other-sourced"
  /** No `#:` at all: the file declares no source, so nothing can be concluded. */
  | "undeclared"
  /** It declares a source that no file on disk matches. */
  | "source-absent"
  /** The declared path matches more than one page, so picking one would be a guess. */
  | "ambiguous";

export interface Catalogue {
  /** Path relative to the layer root. */
  po: string;
  /** The resolved source, or the reason there is none. */
  source: string | Unresolved;
  /** msgids present and live. Only meaningful when `source` resolved. */
  live: number;
  /** msgids present and no longer in the source: the obsoletion subject. */
  stale: string[];
  /** Entries already `#~`-obsolete, which are left exactly as they are. */
  alreadyObsolete: number;
}

function walk(dir: string, want: (f: string) => boolean, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    // input-site: inert #a4c66fe8 — names a build-output directory only to leave it out of a walk
    if (e.startsWith(".") || e === "node_modules" || e === "_site") continue;
    const p = join(dir, e);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p, want, out);
    else if (want(e)) out.push(p);
  }
  return out;
}

/** The `#:` sources a catalogue declares, de-duplicated, without line numbers. */
export function declaredSources(poText: string): string[] {
  return [...new Set([...poText.matchAll(/^#: (\S+?):\d+/gm)].map((m) => m[1]))];
}

/** `"…"` on its own line: gettext's continuation of the string above it. */
const PO_CONTINUATION_RE = /^"((?:[^"\\]|\\.)*)"$/;

/**
 * The ACTIVE msgids — a `#~ msgid` is already obsolete and must not be
 * re-obsoleted or counted as stale.
 *
 * Continuation lines are joined, because gettext writes a long string as
 * `msgid "first part "` followed by bare `"…"` lines and the msgid is their
 * concatenation. The corpus happens to contain none today (measured: 0 of 73
 * catalogues), which is exactly why this is easy to get wrong — reading only the
 * first line would return a TRUNCATED msgid, match nothing in the source, and
 * report a live string as stale. The rewrite half already carries continuation
 * lines, so this was the only half that could not see them.
 */
export function activeMsgids(poText: string): string[] {
  const out: string[] = [];
  const lines = poText.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = /^msgid "((?:[^"\\]|\\.)*)"$/.exec(lines[i]);
    if (m === null) continue;
    let raw = m[1];
    for (let j = i + 1; j < lines.length; j++) {
      const c = PO_CONTINUATION_RE.exec(lines[j]);
      if (c === null) break;
      raw += c[1];
      i = j;
    }
    if (raw === "") continue;
    out.push(raw.replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
  }
  return out;
}

/**
 * Resolve a declared reference to a file. Exact path first; then as a SUFFIX,
 * and only when exactly one non-locale page matches — because a derived
 * catalogue writes `agent-onboarding.md` for a page at
 * `docs/guides/agent-onboarding.md`, so the declaration is real but abbreviated.
 * An ambiguous suffix is reported rather than picked.
 */
export function resolveSource(
  root: string,
  ref: string,
): { path: string } | { unresolved: "source-absent" | "ambiguous" } {
  // `siteRoot` rather than a `docs` literal, for the reason `derive-po.ts` gives
  // at its own call site: two directories in this layer declare that path, and
  // `siteRoot` CONFIRMS a site by finding `_config.yml` rather than trusting the
  // name. The `site-dir-single-answer` gate exists because a hardcoded "docs"
  // silently stops being the site root the moment the declaration moves — and it
  // caught this file on its first push.
  // An instance-relative path is resolved before any site is asked for: it
  // names its file exactly, and a layer with no Jekyll site (an IG whose
  // pages are under `input/`) still has one.
  const exact = join(root, ref);
  if (existsSync(exact) && statSync(exact).isFile()) return { path: exact };
  // This layer's site, else the site the layer at `root` declares for
  // itself (`--instance`).
  const docs = siteRoot(root) ?? instanceSiteRoot(root);
  if (docs === undefined) return { unresolved: "source-absent" };
  const inSite = join(docs, ref);
  if (existsSync(inSite) && statSync(inSite).isFile()) return { path: inSite };
  const hits = walk(docs, (f) => f.endsWith(".md")).filter(
    (c) => !LOCALE_DIR_RE.test(relative(docs, c)) && c.endsWith(`/${ref}`),
  );
  if (hits.length === 1) return { path: hits[0] };
  return { unresolved: hits.length === 0 ? "source-absent" : "ambiguous" };
}

/** Classify and measure every committed catalogue under `translations/`. */
export function survey(root: string, opts: { translationsDir?: string } = {}): Catalogue[] {
  // The declaration, not the name. `translations/` is the `translation-sources`
  // graph, and `directoryForGraph` resolves it — and THROWS if more than one
  // directory declares the kind rather than picking the first, which is bean
  // `wggr`: resolving `cat-harness` to `schemas/` silently wrote 37 sidecars
  // against the wrong subjects on a run that exited 0.
  //
  // `opts.translationsDir` is what the tests pass, following `derive-po.ts`'s
  // `opts.docsDir` for the same reason: a temp-dir fixture carries no layer
  // declaration, so resolving through it there would test the declaration
  // machinery rather than this module's classification.
  const dir = opts.translationsDir ?? directoryForGraph(root, "translation-sources");
  if (dir === undefined || !existsSync(dir)) return [];
  const out: Catalogue[] = [];
  for (const po of walk(dir, (f) => f.endsWith(".po")).sort()) {
    const text = readFileSync(po, "utf8");
    const rel = relative(root, po);
    const alreadyObsolete = (text.match(/^#~ msgid /gm) ?? []).length;
    const refs = declaredSources(text);
    if (refs.length === 0) {
      out.push({ po: rel, source: "undeclared", live: 0, stale: [], alreadyObsolete });
      continue;
    }
    if (!refs.every((r) => r.endsWith(".md"))) {
      out.push({ po: rel, source: "other-sourced", live: 0, stale: [], alreadyObsolete });
      continue;
    }
    const live = new Set<string>();
    let resolved = "";
    let why: Unresolved | "" = "";
    for (const r of refs) {
      const got = resolveSource(root, r);
      if ("unresolved" in got) {
        why = got.unresolved;
        continue;
      }
      resolved = relative(root, got.path);
      for (const e of extractMarkdown(readFileSync(got.path, "utf8"), got.path)) live.add(e.msgid);
    }
    if (resolved === "") {
      out.push({ po: rel, source: why === "" ? "source-absent" : why, live: 0, stale: [], alreadyObsolete });
      continue;
    }
    const ids = activeMsgids(text);
    out.push({
      po: rel,
      source: resolved,
      live: ids.filter((i) => live.has(i)).length,
      stale: ids.filter((i) => !live.has(i)),
      alreadyObsolete,
    });
  }
  return out;
}

/**
 * Rewrite one catalogue so its stale entries are obsolete.
 *
 * Block-based rather than parse-and-reprint: everything that is not a stale entry
 * is passed through byte-for-byte, so a diff shows only the entries that moved.
 * Obsolete entries are appended at the end, which is where gettext keeps them.
 */
export function obsoleteEntries(poText: string, stale: readonly string[]): string {
  if (stale.length === 0) return poText;
  const dead = new Set(stale);
  const blocks = poText.split(/\n\n+/);
  const kept: string[] = [];
  const moved: string[] = [];
  for (const block of blocks) {
    // `activeMsgids` rather than a regex on the block: a block holds at most one
    // msgid, and this way the continuation-joining and the `#~` exclusion are
    // defined once. A regex here would truncate a wrapped msgid and then fail to
    // match `dead`, silently leaving a stale entry active.
    const id = activeMsgids(block)[0];
    if (id === undefined || !dead.has(id)) {
      kept.push(block);
      continue;
    }
    // Only the msgid and msgstr survive obsoletion: a `#:` reference into a
    // source that no longer contains the string would be a dangling pointer, and
    // gettext drops them for exactly that reason.
    const lines = block.split("\n").filter((l) => /^(msgid|msgstr|")/.test(l.trim()));
    moved.push(lines.map((l) => `#~ ${l}`).join("\n"));
  }
  const body = kept.join("\n\n").replace(/\n+$/, "");
  return moved.length === 0 ? `${body}\n` : `${body}\n\n${moved.join("\n\n")}\n`;
}

function main(): void {
  const explicit = explicitInstanceRoot();
  const root = explicit ?? join(HARNESS_ROOT);
  const check = process.argv.includes("--check");
  const dir = directoryForGraph(root, "translation-sources");
  if (explicit !== undefined) {
    // Named by the caller, so judged whoever commits it: the layer-PR scoping
    // below is for the default run over this layer.
    if (dir === undefined || !existsSync(dir)) {
      console.error(
        `${root} declares no \`translation-sources\` directory, or it is absent. ` +
          "Nothing was surveyed, and that is NOT a pass.",
      );
      process.exit(2);
    }
    console.log(`Catalogues of ${root}: ${relative(root, dir)}/`);
  } else {
    // In a layer's PR checks, only catalogues the caller commits (owner ruling
    // 2026-11-05, "Move the checks"; `scripts/lib/gate-own.ts`).
    const own = gateOwnInstances();
    const instName = readDeclaration(root)?.name ?? "cat-harness";
    const repoRoot = REPO_ROOT ?? root;
    if (check && ((own !== undefined && !own.has(instName)) || (dir !== undefined && gateOwnsFile(relative(repoRoot, dir)) === false))) {
      console.log(
        own !== undefined
          ? nothingOwnLine("translation:obsolete", "translations directory", own)
          : `✓ translation:obsolete --check: the catalogues live in ${relative(repoRoot, dir!)}, which the caller does not commit; the owning layer's CI judges them.`,
      );
      return;
    }
  }
  const rows = survey(root);

  const comparable = rows.filter((r) => !isUnresolved(r.source));
  const staleRows = comparable.filter((r) => r.stale.length > 0);
  const totalStale = staleRows.reduce((n, r) => n + r.stale.length, 0);
  const totalLive = comparable.reduce((n, r) => n + r.live, 0);

  console.log(
    `\nCatalogues: ${comparable.length} comparable, ${rows.length - comparable.length} not — ` +
      `${totalLive} live msgid(s), ${totalStale} stale`,
  );

  for (const state of ["other-sourced", "undeclared", "source-absent", "ambiguous"] as const) {
    const hit = rows.filter((r) => r.source === state);
    if (hit.length === 0) continue;
    console.log(`\n  ? ${hit.length} ${state} — NOT counted clean, nothing was concluded about them:`);
    for (const h of hit) console.log(`      ${h.po}`);
  }

  if (staleRows.length === 0) {
    console.log("\n  ✓ every comparable catalogue's msgids are all still in its source\n");
    return;
  }

  for (const r of staleRows) {
    console.log(`\n  ${check ? "✗" : "→"} ${r.po}  (source ${r.source})`);
    console.log(`      ${r.stale.length} stale of ${r.live + r.stale.length} active` +
      (r.alreadyObsolete > 0 ? `, ${r.alreadyObsolete} already obsolete` : ""));
    for (const s of r.stale.slice(0, 3)) console.log(`      · ${JSON.stringify(s.slice(0, 92))}`);
    if (r.stale.length > 3) console.log(`      · …and ${r.stale.length - 3} more`);
  }

  if (check) {
    console.log(
      "\n  A stale msgid is a string the page no longer contains, still offered to a\n" +
        "  translator. Run without `--check` to mark them `#~` obsolete — the\n" +
        "  translation is kept and a human can revive it. Never delete them.\n",
    );
    process.exit(1);
  }

  for (const r of staleRows) {
    const abs = join(root, r.po);
    writeFileSync(abs, obsoleteEntries(readFileSync(abs, "utf8"), r.stale));
    console.log(`  ✓ ${r.po} — ${r.stale.length} entr(ies) now obsolete`);
  }
  console.log("");
}

/** True when the source is a reason rather than a path. */
export function isUnresolved(source: string | Unresolved): source is Unresolved {
  return source === "other-sourced" || source === "undeclared" || source === "source-absent" || source === "ambiguous";
}

if (import.meta.main) main();
