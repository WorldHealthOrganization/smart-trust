/**
 * search-split.ts — split the site's one search index into one index per
 * SCOPE, plus a manifest naming them.
 *
 * just-the-docs writes ONE `assets/js/search-data.json` for the whole site,
 * so a reader searching one IG page pays to load and index every page of the
 * site. Split by where a page lives, they load only their scope.
 *
 * ## What a scope is — derived, never listed
 *
 * From the page's site-relative URL and two DECLARED facts:
 *
 *   - a LAYER scope when the first path segment is a declared layer's
 *     name (`/<instance>/…`), or the second is and the first is not (`/<kind>/
 *     <instance>/…`, the kind route `mount-instance-docs.ts` also publishes);
 *   - a LOCALE scope when the first segment is one of the platform's declared
 *     target locales (`translation-index.ts`);
 *   - the PLATFORM scope otherwise — except that a platform SECTION (a page's
 *     first path segment, below the root) whose entries exceed
 *     {@link SECTION_BUDGET_BYTES} becomes a `section-<name>` scope of its own.
 *
 * Every entry lands in exactly one scope: their entry counts sum to the
 * source's, which `publish-verify`'s `search-scopes` verifier checks on every
 * published and staged tree.
 *
 * ## What it does not change
 *
 * `search-data.json` itself stays exactly as the theme writes it — staging
 * previews borrow it, and the `search-index` verifier judges it. This writes
 * NEXT to it: `assets/js/search/manifest.json` and one
 * `assets/js/search/<scope>.json` per scope, each in the theme's own entry
 * shape so the theme's loader reads any of them unchanged.
 *
 * ## Stable entry ids — the cone
 *
 * The theme keys entries by a running number, so one added page would rewrite
 * every scope file. The scope files key each entry by a hash of its URL
 * ({@link stableKeys}), so a page change touches only its own scope's files
 * and the manifest. The key is opaque to the client; "search everywhere"
 * loads the theme's whole index with the theme's own keys.
 *
 * ## Prebuilt indexes
 *
 * A scope over {@link PREBUILT_TOKEN_BUDGET} also gets `<scope>.idx.json`:
 * the lunr index the theme would build from it, serialized, and named in the
 * manifest's `index`. The client LOADS it instead of building one, trading
 * download bytes for main-thread time on first search.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/search-split.ts --dir <built site>          # write
 *   bun run cat-harness-tools/scripts/search-split.ts --dir <built site> --check  # verify only
 *   bun run cat-harness-tools/scripts/search-split.ts --dir <built site> --repo <checkout>  # scope by that checkout's layers
 *
 * `build-instance-site.ts` runs {@link splitSite} on every site it builds,
 * with the checkout it built from as `repo`.
 *
 * @module scripts/search-split
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

// @ts-expect-error -- lunr ships no types; only `lunr()`, `tokenizer` and `Index.load` are used.
import lunr from "lunr";

import { layerRootsIn, readDeclaration } from "../schemas/kg/cat-harness.js";
import { targetLocales } from "../pipeline/translation-index.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";

/** Where the theme writes the whole index, relative to the site root. */
export const SOURCE_PATH = "assets/js/search-data.json";
/** Where the scoped indices and their manifest go, relative to the site root. */
export const SCOPES_DIR = "assets/js/search";
export const MANIFEST_SCHEMA = "folio-search-manifest/v1";

/** One entry in the theme's index. Only `relUrl` is read; the rest is carried as is. */
export interface SearchEntry {
  relUrl?: string;
  [k: string]: unknown;
}

export type ScopeKind = "instance" | "locale" | "section" | "platform";

export interface Scope {
  id: string;
  kind: ScopeKind;
}

export interface ManifestScope extends Scope {
  /** Site-relative path of this scope's index. */
  path: string;
  entries: number;
  bytes: number;
  /**
   * A lunr index already built from this scope's entries (bean `lrzn`),
   * present only when the scope is over {@link PREBUILT_TOKEN_BUDGET}. The
   * client loads it with `lunr.Index.load` instead of building one.
   */
  index?: { path: string; bytes: number };
}

/**
 * A searchable thing that is NOT a lunr scope: the identifier lookup a
 * layer publishes under `<site>/id-lookup/<id>/` (bean `1br0`, issue
 * #1972 step 3). The search box links to it rather than loading it — the
 * owner's ruling on `4pm8` keeps it a page of its own.
 */
export interface RemoteScope {
  id: string;
  kind: "id-lookup";
  /** Site-relative URL of the lookup page, opened on this index. */
  href: string;
  /** The index's own `entryCount`. */
  entries: number;
}

export interface SearchManifest {
  $schema: typeof MANIFEST_SCHEMA;
  /** The whole index the scopes were cut from — what "search everywhere" loads. */
  source: { path: string; sha256: string; entries: number; bytes: number };
  scopes: ManifestScope[];
  /** Absent when the tree publishes no identifier lookup. */
  remote?: RemoteScope[];
}

/** Where `publish-id-lookup.ts` puts the lookup client and its indexes, under the site root. */
export const ID_LOOKUP_DIR = "id-lookup";

/**
 * Every identifier-lookup index PUBLISHED in a built site: a directory under
 * `id-lookup/` holding a `manifest.json`, beside the client page. Read from
 * the tree rather than from the declarations, so the manifest names exactly
 * what a reader can open — a declared index the build did not publish would
 * be a link to "could not be read".
 */
export function publishedLookups(site: string): RemoteScope[] {
  const root = join(site, ID_LOOKUP_DIR);
  if (!existsSync(join(root, "index.html"))) return [];
  const out: RemoteScope[] = [];
  for (const name of readdirSync(root).sort()) {
    const m = join(root, name, "manifest.json");
    if (!existsSync(m)) continue;
    let entries = 0;
    try {
      entries = Number((JSON.parse(readFileSync(m, "utf-8")) as { entryCount?: unknown }).entryCount) || 0;
    } catch {
      continue; // unreadable: not something to link a reader to
    }
    out.push({ id: name, kind: "id-lookup", href: `${ID_LOOKUP_DIR}/?index=${encodeURIComponent(name)}/`, entries });
  }
  return out;
}

/** The id the platform scope uses. Not a possible layer or locale name, so it cannot collide. */
export const PLATFORM = "_platform";

/**
 * A platform SECTION — the first path segment of a page below the site root —
 * whose entries exceed this many bytes becomes a scope of its own (bean
 * `mm2n`, issue #1972).
 *
 * **Basis: measured.** First-search script cost runs at ~0.33 s per MB of
 * scope (#1988: a DAK IG's 1.5 MB, 504 ms), so a section under 512 KiB
 * costs under ~0.17 s — not worth a scope, and not worth the reader having to
 * widen to find it. Measured 2026-10-03, 512 KiB cuts the 7.82 MB platform
 * scope into five section scopes — `reference` 3.85 MB, `glossary` 0.97,
 * `uml` 0.91, `processes` 0.66, `proposals` 0.53 — and a 0.90 MB remainder.
 * (`proposals` crosses only because a section's own index page counts as
 * part of it; a budget this close to a section's size is a reason to read
 * the manifest, never to restate the list.)
 *
 * A BUDGET rather than a list because the site's sections are pages rendered
 * inside the one declared `docs` graph, not graph directories of their own:
 * there is no declaration to read them from, and a hand list of names is a
 * second place to keep the site's layout. Which sections cross it is a fact
 * about the content, so the manifest records them and the client reads them
 * from there.
 */
export const SECTION_BUDGET_BYTES = 512 * 1024;

/**
 * The scope a page belongs to, from its site-relative URL (the theme's
 * `relUrl`: no base URL, leading slash).
 */
export function scopeOf(relUrl: string, instances: ReadonlySet<string>, locales: ReadonlySet<string>): Scope {
  const [first = "", second = ""] = relUrl.split("#")[0]!.split("/").filter(Boolean);
  if (instances.has(first)) return { id: first, kind: "instance" };
  if (locales.has(first)) return { id: `locale-${first}`, kind: "locale" };
  if (instances.has(second)) return { id: second, kind: "instance" };
  return { id: PLATFORM, kind: "platform" };
}

/**
 * The platform section a page path belongs to: its first segment, when the
 * page is BELOW it (`/reference/skills.html`) or is its index (`/reference/`).
 * A page at the root (`/`, `/start/getting-started.html`) belongs to none. The
 * client's `scopeForPage` applies the same rule to `location.pathname`.
 */
export function sectionOfPath(path: string): string | undefined {
  const seg = path.split("/").filter(Boolean);
  if (seg.length > 1) return seg[0];
  if (seg.length === 1 && path.endsWith("/")) return seg[0];
  return undefined;
}

/**
 * Partition the index by scope. Keys are the source's here ({@link render}
 * re-keys them by URL); every entry lands in exactly one scope.
 */
export function split(
  index: Readonly<Record<string, SearchEntry>>,
  instances: ReadonlySet<string>,
  locales: ReadonlySet<string>,
  sectionBudget: number = SECTION_BUDGET_BYTES,
): Map<string, { scope: Scope; entries: Record<string, SearchEntry> }> {
  const out = new Map<string, { scope: Scope; entries: Record<string, SearchEntry> }>();
  const put = (scope: Scope, key: string, entry: SearchEntry) => {
    let bucket = out.get(scope.id);
    if (!bucket) out.set(scope.id, (bucket = { scope, entries: {} }));
    bucket.entries[key] = entry;
  };
  // The platform's entries wait until every section's size is known.
  const platform: [string, SearchEntry][] = [];
  for (const [key, entry] of Object.entries(index)) {
    const scope = scopeOf(typeof entry.relUrl === "string" ? entry.relUrl : "", instances, locales);
    if (scope.kind === "platform") platform.push([key, entry]);
    else put(scope, key, entry);
  }
  const sectionOf = (entry: SearchEntry): string | undefined =>
    sectionOfPath((typeof entry.relUrl === "string" ? entry.relUrl : "").split("#")[0]!);
  const bytes = new Map<string, number>();
  for (const [, entry] of platform) {
    const sec = sectionOf(entry);
    if (sec !== undefined) bytes.set(sec, (bytes.get(sec) ?? 0) + Buffer.byteLength(JSON.stringify(entry)));
  }
  for (const [key, entry] of platform) {
    const sec = sectionOf(entry);
    if (sec !== undefined && (bytes.get(sec) ?? 0) > sectionBudget) put({ id: `section-${sec}`, kind: "section" }, key, entry);
    else put({ id: PLATFORM, kind: "platform" }, key, entry);
  }
  return out;
}

/**
 * A scope whose entries tokenize to more than this many tokens is published
 * with its lunr index PREBUILT (bean `lrzn`, issue #1972): `<scope>.idx.json`
 * beside `<scope>.json`, named in the manifest.
 *
 * **Basis: measured, 2026-10-03, Node, lunr 2.3.9 on the built site.**
 * Building costs ~3–5 µs per token; loading a serialized index is 5–8×
 * faster (`section-reference` 2,593 ms → 546 ms, a DAK IG's scope 683 → 82) —
 * but the index is 2–3× the entries' gzipped size and is downloaded ON TOP
 * of them, since results are rendered from the entries. Under ~128 Ki tokens
 * the build is ~0.4–0.6 s, comparable to fetching the extra bytes on a slow
 * link, so a small scope builds as before. On that build the budget prebuilt
 * five scopes — `section-reference`, two DAK IGs' scopes, `_platform`,
 * `section-glossary` — and the owner chose "big scopes only".
 *
 * TOKENS rather than milliseconds because the output must be the same bytes
 * for the same index (`--check`, and the hash `search-scopes` verifies); a
 * timing is not. Which scopes cross it is a fact about the content: read the
 * manifest, never this list.
 */
export const PREBUILT_TOKEN_BUDGET = 128 * 1024;

/**
 * The theme's tokenizer separator — just-the-docs' default, which this site
 * does not override (`_config.yml` sets no `search.tokenizer_separator`). The
 * prebuilt index must tokenize exactly as the browser would, or a term the
 * reader types is not the term the index holds.
 */
export const TOKENIZER_SEPARATOR = /[\s\-/]+/;

interface Lunr {
  (config: (this: LunrBuilder) => void): { toJSON(): unknown };
  tokenizer: ((s: unknown) => unknown[]) & { separator: RegExp };
}
interface LunrBuilder {
  ref(f: string): void;
  field(f: string, attrs?: { boost: number }): void;
  metadataWhitelist: string[];
  add(doc: Record<string, unknown>): void;
}
const L = lunr as Lunr;

/** How many tokens the theme's index would hold for these entries. */
export function tokenCount(entries: Readonly<Record<string, SearchEntry>>): number {
  L.tokenizer.separator = TOKENIZER_SEPARATOR;
  let n = 0;
  for (const e of Object.values(entries)) {
    for (const f of ["title", "content", "relUrl"] as const) n += L.tokenizer(e[f]).length;
  }
  return n;
}

/**
 * The lunr index the theme's `buildSearchIndex` would build from these
 * entries — same ref, fields, boosts, separator and metadata whitelist, docs
 * added in the same order (`for (var i in docs)`) — serialized. Keep the two
 * in step: the theme's copy is the site's `assets/js/just-the-docs.js`.
 */
export function buildIndex(entries: Readonly<Record<string, SearchEntry>>): unknown {
  L.tokenizer.separator = TOKENIZER_SEPARATOR;
  return L(function () {
    this.ref("id");
    this.field("title", { boost: 200 });
    this.field("content", { boost: 2 });
    this.field("relUrl");
    this.metadataWhitelist = ["position"];
    for (const [id, e] of Object.entries(entries)) {
      this.add({ id, title: e.title, content: e.content, relUrl: e.relUrl });
    }
  }).toJSON();
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Hex digits of the URL hash an entry is keyed by: 48 bits, so ~12k entries collide with odds near 1 in 4 million. */
export const STABLE_KEY_HEX = 12;

/**
 * The key each entry gets in its scope file, by its source key: the first
 * {@link STABLE_KEY_HEX} hex digits of the sha256 of its `relUrl` (the theme
 * gives a page and each of its headings their own `relUrl`, `#anchor`
 * included). An entry with no `relUrl` hashes its `url`, else its source key.
 * Two entries that land on one key — the same URL twice, or a hash collision —
 * keep the first in source order and give the rest `-2`, `-3`, …, so keys stay
 * unique across all scopes, as `search-scopes` checks.
 */
export function stableKeys(index: Readonly<Record<string, SearchEntry>>): Map<string, string> {
  const out = new Map<string, string>();
  const used = new Set<string>();
  for (const [key, entry] of Object.entries(index)) {
    const basis = typeof entry.relUrl === "string" ? entry.relUrl : typeof entry.url === "string" ? `url:${entry.url}` : `key:${key}`;
    const base = sha256(basis).slice(0, STABLE_KEY_HEX);
    let k = base;
    for (let n = 2; used.has(k); n++) k = `${base}-${n}`;
    used.add(k);
    out.set(key, k);
  }
  return out;
}

/** The same entries, in the same order, under their stable keys. */
function rekey(entries: Readonly<Record<string, SearchEntry>>, keys: ReadonlyMap<string, string>): Record<string, SearchEntry> {
  const out: Record<string, SearchEntry> = {};
  for (const [key, entry] of Object.entries(entries)) out[keys.get(key)!] = entry;
  return out;
}

/**
 * Every file the split writes, keyed by site-relative path, manifest last.
 * Deterministic: scopes are ordered by id and each body is the source's own
 * entries in the source's order under their {@link stableKeys}, so the same
 * index always yields the same bytes, and a scope whose entries did not
 * change keeps its bytes when other scopes' pages come and go.
 */
export function render(
  sourceText: string,
  instances: ReadonlySet<string>,
  locales: ReadonlySet<string>,
  sectionBudget: number = SECTION_BUDGET_BYTES,
  remote: readonly RemoteScope[] = [],
  prebuiltBudget: number = PREBUILT_TOKEN_BUDGET,
): Map<string, string> {
  const index = JSON.parse(sourceText) as Record<string, SearchEntry>;
  const files = new Map<string, string>();
  const scopes: ManifestScope[] = [];
  const parts = [...split(index, instances, locales, sectionBudget).values()].sort((a, b) => a.scope.id.localeCompare(b.scope.id));
  const keys = stableKeys(index);
  for (const part of parts) {
    const scope = part.scope;
    const entries = rekey(part.entries, keys);
    const path = `${SCOPES_DIR}/${scope.id}.json`;
    const body = JSON.stringify(entries);
    files.set(path, body);
    const m: ManifestScope = { ...scope, path, entries: Object.keys(entries).length, bytes: Buffer.byteLength(body) };
    if (tokenCount(entries) > prebuiltBudget) {
      const idxPath = `${SCOPES_DIR}/${scope.id}.idx.json`;
      const idxBody = JSON.stringify(buildIndex(entries));
      files.set(idxPath, idxBody);
      m.index = { path: idxPath, bytes: Buffer.byteLength(idxBody) };
    }
    scopes.push(m);
  }
  const manifest: SearchManifest = {
    $schema: MANIFEST_SCHEMA,
    source: {
      path: SOURCE_PATH,
      sha256: sha256(sourceText),
      entries: Object.keys(index).length,
      bytes: Buffer.byteLength(sourceText),
    },
    scopes,
    ...(remote.length > 0 ? { remote: [...remote] } : {}),
  };
  files.set(`${SCOPES_DIR}/manifest.json`, JSON.stringify(manifest, null, 2) + "\n");
  return files;
}

/** The declared layer names in this checkout: each declaration's `name`, else its directory's. */
export function declaredInstanceNames(repo: string): Set<string> {
  const names = new Set<string>();
  for (const root of layerRootsIn(repo)) {
    let name: string | undefined;
    try {
      name = readDeclaration(root)?.name;
    } catch {
      name = undefined;
    }
    const n = name ?? basename(root);
    // The checkout-root layer has no route of its own under the site.
    if (resolve(root) !== resolve(repo)) names.add(n);
  }
  return names;
}

/**
 * The layer that holds the harness in the checkout at `repo`: the declared
 * layer named `cat-harness`, else {@link HARNESS_ROOT}. Its declared locales
 * are the site's target locales.
 */
export function harnessRootIn(repo: string): string {
  for (const root of layerRootsIn(repo)) {
    try {
      if (readDeclaration(root)?.name === "cat-harness") return root;
    } catch {
      // an unreadable declaration names nothing
    }
  }
  return resolve(HARNESS_ROOT);
}

/** What {@link splitSite} did to one built site. */
export interface SplitOutcome {
  manifest: SearchManifest;
  /** Every file the split owns, by site-relative path. */
  files: Map<string, string>;
  /** With `check`: how many of them are missing or differ on disk. */
  stale: string[];
}

/**
 * Split the built site at `site`, its layers and locales read from the
 * checkout at `repo` — the checkout the site was BUILT from, so a folio or an
 * IG checkout scopes by the layers it declares and mounts, not by wherever
 * this file happens to sit. `undefined` when the site has no theme index to
 * split. With `check`, nothing is written and the stale files are returned.
 */
export function splitSite(site: string, repo: string, opts: { check?: boolean; harnessRoot?: string } = {}): SplitOutcome | undefined {
  const source = join(site, SOURCE_PATH);
  if (!existsSync(source)) return undefined;
  const harness = opts.harnessRoot ?? harnessRootIn(repo);
  const files = render(
    readFileSync(source, "utf-8"),
    declaredInstanceNames(repo),
    new Set(targetLocales(harness)),
    SECTION_BUDGET_BYTES,
    publishedLookups(site),
  );
  const stale: string[] = [];
  for (const [rel, body] of files) {
    const p = join(site, rel);
    if (opts.check) {
      if (!existsSync(p) || readFileSync(p, "utf-8") !== body) stale.push(rel);
      continue;
    }
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, body);
  }
  const manifest = JSON.parse(files.get(`${SCOPES_DIR}/manifest.json`)!) as SearchManifest;
  return { manifest, files, stale };
}

/** The lines a run prints about the scopes it wrote. */
export function describeSplit(manifest: SearchManifest): string[] {
  const out: string[] = [];
  for (const s of manifest.scopes) {
    const idx = s.index ? `  + prebuilt index ${(s.index.bytes / 1e6).toFixed(2)} MB` : "";
    out.push(`  ${s.kind.padEnd(8)} ${s.id.padEnd(24)} ${String(s.entries).padStart(6)} entries  ${(s.bytes / 1e6).toFixed(2)} MB${idx}`);
  }
  for (const r of manifest.remote ?? []) out.push(`  remote   ${r.id.padEnd(24)} ${String(r.entries).padStart(6)} entries  → ${r.href}`);
  return out;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const at = args.indexOf(name);
    return at >= 0 ? args[at + 1] : undefined;
  };
  const dirArg = flag("--dir");
  if (!dirArg) {
    console.error("usage: search-split.ts --dir <built site> [--repo <checkout>] [--check]");
    process.exit(2);
  }
  const dir = resolve(dirArg);
  const check = args.includes("--check");
  // The checkout whose layers scope the site: `--repo`, else the one holding the harness.
  const repoArg = flag("--repo");
  const repo = repoArg ? resolve(repoArg) : resolve(HARNESS_ROOT, "..");
  const out = splitSite(dir, repo, { check, ...(repoArg ? {} : { harnessRoot: resolve(HARNESS_ROOT) }) });
  if (!out) {
    console.error(`search-split: ${SOURCE_PATH} is not in ${dir} — nothing to split`);
    process.exit(1);
  }
  for (const rel of out.stale) console.error(`  ✗ ${rel} is missing or stale`);
  for (const line of describeSplit(out.manifest)) console.log(line);
  const m = out.manifest;
  console.log(
    `${m.scopes.length} scope(s) from ${m.source.entries} entries (${(m.source.bytes / 1e6).toFixed(2)} MB)` +
      (check ? (out.stale.length ? ` — ${out.stale.length} file(s) stale` : " — current") : ` → ${SCOPES_DIR}/`),
  );
  process.exit(check && out.stale.length > 0 ? 1 : 0);
}
