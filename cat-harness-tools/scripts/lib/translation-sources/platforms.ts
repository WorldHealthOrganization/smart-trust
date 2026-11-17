/**
 * Translation platforms — Weblate, Crowdin and Transifex — as SOURCES of
 * candidate translations, never as adjudicators.
 *
 * @module scripts/lib/translation-sources/platforms
 * @covers translation-sources
 *
 * ## The rule (owner, 2026-11-14)
 *
 * A platform is never an adjudicator. A string that comes back from a
 * platform — even one "approved" there — is imported as a CANDIDATE in the
 * `translation-candidates/v1` sidecar (`<locale>/<catalogue>.candidates.json`,
 * {@link CandidatesFile}) with source `{kind: "web-service", id: <platform>}`,
 * and the platform's own state rides along as metadata
 * ({@link PlatformCandidate.metadata}). Only a person's GitHub issue records an
 * adjudication (`translation-adjudication/v1`). The one thing an import may
 * do to a `.po` is what any candidate source may do: an EMPTY `msgstr` takes
 * the first candidate, marked `#, fuzzy`, so candidates are never a barrier
 * to having a translation.
 *
 * ## Push: the layout each platform reads
 *
 * {@link catalogueLayout} reads the catalogues present in the layer's
 * declared `translation-sources` directory — nothing is hard-coded — and the
 * three writers turn that into each platform's own configuration:
 *
 * - {@link crowdinYml} — `crowdin.yml` at the repository root;
 * - {@link transifexConfig} — `.tx/config`;
 * - {@link weblateComponents} — Weblate keeps its configuration on the
 *   server, so this is the list of component definitions (gettext PO, the
 *   repository's own layout) to create through its API or UI, plus the one
 *   "component discovery" add-on rule that finds them all.
 *
 * Every layer here keeps a copy of each `.pot` template in every locale
 * directory (`translations/<locale>/<catalogue>.pot`), beside that locale's
 * `.po`. A platform wants ONE source file per catalogue, so the source is the
 * template in the first locale directory (sorted) that has it;
 * {@link catalogueLayout} reports a catalogue whose template copies differ.
 *
 * ## Pull: platform output → candidates
 *
 * {@link platformDiff} compares a platform's version of a `.po` (from its
 * PR, or an export) with the version on the base branch: the `.po` goes back
 * to the base's text, and every string the platform changed becomes a
 * candidate input for the shared writer (`scripts/lib/translation-candidates.ts`,
 * `addCandidates`), which appends to the sidecar and fills an empty `msgstr`
 * fuzzy exactly as for any other source. {@link annotatePlatformStates} then
 * records the platform's own state on its candidates.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { emptySidecar, mergeCandidates, type CandidateInput } from "../translation-candidates.ts";
import {
  CANDIDATES_SUFFIX,
  candidatesProblems,
  poEntries,
  type CandidateSource,
  type CandidatesFile,
} from "../translation-adjudication.ts";

// ── The platforms ────────────────────────────────────────────────────────

export const PLATFORMS = ["weblate", "crowdin", "transifex"] as const;
export type Platform = (typeof PLATFORMS)[number];

export function isPlatform(v: unknown): v is Platform {
  return (PLATFORMS as readonly unknown[]).includes(v);
}

/**
 * A platform's own view of a string, carried as metadata and never read as
 * a verdict. `approved` is what Weblate calls approved, Crowdin approved, and
 * Transifex reviewed / proofread; `translated` is a plain translation; `fuzzy`
 * is one the platform itself marks as needing editing.
 */
export const PLATFORM_STATES = ["approved", "translated", "fuzzy"] as const;
export type PlatformState = (typeof PLATFORM_STATES)[number];

/** A candidate as written by a platform import: `{text, source}` plus the platform's state. */
export interface PlatformCandidate {
  text: string;
  source: CandidateSource & { kind: "web-service"; id: Platform };
  metadata: { platformState: PlatformState };
}

// ── Push: the catalogues in the declared directory ───────────────────────

/** Locale tags this layer uses as directory names (`es`, `zh`, `pt-BR`, `sr-Latn`). */
const LOCALE_DIR_RE = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

export interface CatalogueLayout {
  /** The translations directory, relative to the repository root, with `/` separators and no trailing slash. */
  dir: string;
  /** Locale directories, sorted. */
  locales: string[];
  /** One per template, sorted by path. */
  catalogues: Array<{
    /** Path inside a locale directory, without extension (`processes/bean-drain`). */
    path: string;
    /** The locale whose copy of the template is the platform's source. */
    sourceLocale: string;
    /** Locales that hold a `.po` for it. */
    translated: string[];
  }>;
  /** Catalogues whose template copies differ between locales (header aside). */
  divergent: string[];
}

function walk(dir: string, ext: string, base = dir): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, ext, base));
    else if (name.endsWith(ext)) out.push(relative(base, p).split(sep).join("/").slice(0, -ext.length));
  }
  return out;
}

/** A template's strings without its header, so copies that differ only in dates compare equal. */
function templateKey(text: string): string {
  const body = poEntries(text).map((e) => `${e.msgctxt ?? ""}\u0004${e.msgid}\u0000${e.msgidPlural ?? ""}`).join("\n");
  return createHash("sha256").update(body).digest("hex");
}

/**
 * The catalogues in `translationsDir`, read from the files. `repoRoot` is the
 * repository root the platform sees, so paths come out relative to it.
 */
export function catalogueLayout(repoRoot: string, translationsDir: string): CatalogueLayout {
  const dir = relative(repoRoot, translationsDir).split(sep).join("/").replace(/\/$/, "") || ".";
  const locales = readdirSync(translationsDir)
    .filter((n) => LOCALE_DIR_RE.test(n) && statSync(join(translationsDir, n)).isDirectory())
    .sort();
  const byPath = new Map<string, { sourceLocale: string; translated: string[]; keys: Set<string> }>();
  for (const locale of locales) {
    const ld = join(translationsDir, locale);
    for (const path of walk(ld, ".pot")) {
      const key = templateKey(readFileSync(join(ld, `${path}.pot`), "utf-8"));
      const c = byPath.get(path);
      if (c) c.keys.add(key);
      else byPath.set(path, { sourceLocale: locale, translated: [], keys: new Set([key]) });
    }
  }
  for (const locale of locales) {
    for (const path of walk(join(translationsDir, locale), ".po")) byPath.get(path)?.translated.push(locale);
  }
  const paths = [...byPath.keys()].sort();
  return {
    dir,
    locales,
    catalogues: paths.map((path) => ({ path, sourceLocale: byPath.get(path)!.sourceLocale, translated: byPath.get(path)!.translated })),
    divergent: paths.filter((p) => byPath.get(p)!.keys.size > 1),
  };
}

/**
 * The `translation-sources` directory a layer's declaration
 * (`<instance>.json`, `cat-harness-declaration/*`) names, read from the file
 * alone; `undefined` when none is declared. The mounted harness's
 * `translationsDirOf` (`gen-translation-status.ts`) is preferred where it
 * loads; this is the same lookup without the harness.
 */
export function declaredTranslationsDir(root: string): string | undefined {
  for (const name of readdirSync(root).sort()) {
    if (!name.endsWith(".json")) continue;
    let decl: { $schema?: unknown; directories?: Array<{ path?: unknown; graphTypologies?: unknown }> };
    try {
      decl = JSON.parse(readFileSync(join(root, name), "utf-8"));
    } catch {
      continue;
    }
    if (typeof decl.$schema !== "string" || !decl.$schema.startsWith("cat-harness-declaration/")) continue;
    const d = (decl.directories ?? []).find((x) => Array.isArray(x.graphTypologies) && x.graphTypologies.includes("translation-sources"));
    return typeof d?.path === "string" ? join(root, d.path) : undefined;
  }
  return undefined;
}

const GENERATED = "Generated by cat-harness-tools scripts/translation-platforms.ts from the declared translation-sources directory; regenerate rather than edit.";

/** YAML double-quoted scalar. */
const yq = (s: string) => JSON.stringify(s);

/**
 * `crowdin.yml`. Crowdin's own language code for most bare tags is its
 * `%two_letters_code%`; a region- or script-tagged directory (`pt-BR`) is
 * mapped explicitly. The project id and token are read from environment
 * variables, never written here.
 */
export function crowdinYml(l: CatalogueLayout): string {
  const tagged = l.locales.filter((x) => x.includes("-"));
  const out = [
    `# ${GENERATED}`,
    "# Inert until the owner creates a Crowdin project and sets CROWDIN_PROJECT_ID and",
    "# CROWDIN_PERSONAL_TOKEN where Crowdin runs. Strings Crowdin sends back — approved",
    "# or not — become CANDIDATES (layer-translation-platform-import.yml), never verdicts.",
    'project_id_env: "CROWDIN_PROJECT_ID"',
    'api_token_env: "CROWDIN_PERSONAL_TOKEN"',
    'base_path: "."',
    "preserve_hierarchy: true",
    "files:",
  ];
  for (const c of l.catalogues) {
    out.push(
      `  - source: ${yq(`/${l.dir}/${c.sourceLocale}/${c.path}.pot`)}`,
      `    translation: ${yq(`/${l.dir}/%two_letters_code%/${c.path}.po`)}`,
    );
    if (tagged.length > 0) {
      out.push("    languages_mapping:", "      two_letters_code:");
      for (const t of tagged) out.push(`        ${yq(t)}: ${yq(t)}`);
    }
  }
  return `${out.join("\n")}\n`;
}

/** A Transifex resource slug: lowercase, `[a-z0-9_-]`, path separators as `--`. */
export function resourceSlug(path: string): string {
  return path.toLowerCase().replace(/\//g, "--").replace(/[^a-z0-9_-]+/g, "_").slice(0, 50) + (path.length > 50 ? `-${createHash("sha256").update(path).digest("hex").slice(0, 8)}` : "");
}

/**
 * `.tx/config` for the Transifex CLI (`tx`). `organization` and `project`
 * are the owner's to choose; until they do, the sections name placeholders
 * that `tx` refuses, so nothing can be pushed by accident.
 */
export function transifexConfig(l: CatalogueLayout, opts: { organization?: string; project?: string } = {}): string {
  const org = opts.organization ?? "OWNER-SETS-ORGANIZATION";
  const project = opts.project ?? "OWNER-SETS-PROJECT";
  const tagged = l.locales.filter((x) => x.includes("-"));
  const out = [
    `# ${GENERATED}`,
    "# Inert until the owner names a Transifex organization and project here and gives tx",
    "# a token (TX_TOKEN). Translations pulled back become CANDIDATES, never verdicts.",
    "[main]",
    "host = https://app.transifex.com",
  ];
  // Transifex writes region tags with an underscore; map them back to this layer's directories.
  if (tagged.length > 0) out.push(`lang_map = ${tagged.map((t) => `${t.replace(/-/g, "_")}: ${t}`).join(", ")}`);
  for (const c of l.catalogues) {
    out.push(
      "",
      `[o:${org}:p:${project}:r:${resourceSlug(c.path)}]`,
      `file_filter = ${l.dir}/<lang>/${c.path}.po`,
      `source_file = ${l.dir}/${c.sourceLocale}/${c.path}.pot`,
      "source_lang = en",
      "type = PO",
    );
  }
  return `${out.join("\n")}\n`;
}

/** A Weblate component slug. */
const weblateSlug = (path: string) => path.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);

/**
 * Weblate component definitions in the shape its REST API takes
 * (`POST /api/projects/<project>/components/`), one per catalogue, in the
 * repository's own gettext layout; and the equivalent single
 * "component discovery" add-on rule (`weblate.discovery.discovery`).
 * The repository URL and project are the owner's to fill in.
 */
export function weblateComponents(l: CatalogueLayout, opts: { repository?: string; branch?: string } = {}): string {
  const repo = opts.repository ?? "https://github.com/OWNER-SETS/REPOSITORY.git";
  const branch = opts.branch ?? "main";
  const src = l.catalogues[0]?.sourceLocale ?? "<locale>";
  const doc = {
    _comment: `${GENERATED} Weblate keeps its configuration on its server: create these components with its API or UI (wlc, or Project → Add component). Inert until the owner does. Weblate's translations — approved or not — come back as a pull request that layer-translation-platform-import.yml rewrites into CANDIDATES, never verdicts.`,
    discovery: {
      _comment: "One rule that finds every catalogue: Add-ons → Component discovery. It uses one source locale's templates for every component.",
      addon: "weblate.discovery.discovery",
      configuration: {
        file_format: "po",
        match: `${l.dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/(?P<language>[^/]+)/(?P<component>.+)\\.po`,
        name_template: "{{ component }}",
        base_file_template: "",
        new_base_template: `${l.dir}/${src}/{{ component }}.pot`,
        language_regex: "^[^.]+$",
        remove: false,
      },
    },
    components: l.catalogues.map((c) => ({
      name: c.path,
      slug: weblateSlug(c.path),
      file_format: "po",
      filemask: `${l.dir}/*/${c.path}.po`,
      template: "",
      new_base: `${l.dir}/${c.sourceLocale}/${c.path}.pot`,
      new_lang: "add",
      vcs: "github",
      repo,
      branch,
      push_branch: BRANCH_PREFIX.weblate,
      source_language: "en",
    })),
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}

/**
 * `transifex.yml`, read by Transifex's GitHub integration (the `.tx/config`
 * above is the CLI's). Its pull requests come from `transifex_<id>` branches.
 */
export function transifexYml(l: CatalogueLayout): string {
  const out = [
    `# ${GENERATED}`,
    "# Read by the Transifex GitHub integration once the owner installs it. Its pull requests",
    "# (branches transifex_*) are rewritten into CANDIDATES, never verdicts.",
    "git:",
    "  filters:",
  ];
  for (const c of l.catalogues) {
    out.push(
      "    - filter_type: file",
      "      file_format: PO",
      "      source_language: en",
      `      source_file: ${yq(`${l.dir}/${c.sourceLocale}/${c.path}.pot`)}`,
      `      translation_files_expression: ${yq(`${l.dir}/<lang>/${c.path}.po`)}`,
    );
  }
  out.push("  settings:", '    pr_branch_name: "transifex_<br_unique_id>"');
  return `${out.join("\n")}\n`;
}

export interface PlatformFile {
  /** Repository-relative path the platform reads. */
  path: string;
  text: string;
}

/**
 * The head-branch prefix each platform's GitHub integration pushes, as the
 * files here configure it (Crowdin's default service branch `l10n_<base>`).
 */
export const BRANCH_PREFIX: Record<Platform, string> = {
  weblate: "weblate-translations",
  crowdin: "l10n_",
  transifex: "transifex_",
};

/** The files each platform reads, from the layout. */
export function platformFiles(p: Platform, l: CatalogueLayout, opts: { organization?: string; project?: string; repository?: string; branch?: string } = {}): PlatformFile[] {
  if (p === "crowdin") return [{ path: "crowdin.yml", text: crowdinYml(l) }];
  if (p === "transifex") return [{ path: ".tx/config", text: transifexConfig(l, opts) }, { path: "transifex.yml", text: transifexYml(l) }];
  return [{ path: "weblate-components.json", text: weblateComponents(l, opts) }];
}

// ── Pull: a platform's .po → candidates ──────────────────────────────────

const keyOf = (e: { msgctxt?: string; msgid: string }) => `${e.msgctxt ?? ""}\u0004${e.msgid}`;

/**
 * The platform's state per string, when an export says more than the PO can
 * (a PO carries `fuzzy` and nothing about approval). Keyed by
 * {@link stateKey}.
 */
export type StateHints = Map<string, PlatformState>;

export const stateKey = (msgid: string, msgctxt?: string) => keyOf({ msgid, ...(msgctxt !== undefined ? { msgctxt } : {}) });

/**
 * Weblate's units export (`GET /api/translations/<p>/<c>/<lang>/units/`,
 * its `results`): `state` 10 needs editing, 20 translated, 30 approved,
 * 100 read-only. `source`/`target` are lists (plural forms).
 */
export function weblateStateHints(units: unknown): StateHints {
  const out: StateHints = new Map();
  const list = Array.isArray(units) ? units : ((units as { results?: unknown[] } | null)?.results ?? []);
  for (const u0 of list) {
    const u = u0 as { source?: unknown; context?: unknown; state?: unknown };
    const src = Array.isArray(u.source) ? u.source[0] : u.source;
    if (typeof src !== "string" || typeof u.state !== "number") continue;
    const ctx = typeof u.context === "string" && u.context !== "" ? u.context : undefined;
    out.set(stateKey(src, ctx), u.state >= 30 ? "approved" : u.state >= 20 ? "translated" : "fuzzy");
  }
  return out;
}

/**
 * Crowdin's and Transifex's string exports, normalised by the caller to
 * `{msgid, msgctxt?, approved?: boolean, reviewed?: boolean, proofread?: boolean}`
 * — Crowdin's `approvals` count > 0 or Transifex's `reviewed`/`proofread`
 * become `approved`.
 */
export function flagStateHints(rows: unknown): StateHints {
  const out: StateHints = new Map();
  if (!Array.isArray(rows)) return out;
  for (const r0 of rows) {
    const r = r0 as { msgid?: unknown; msgctxt?: unknown; approved?: unknown; reviewed?: unknown; proofread?: unknown };
    if (typeof r.msgid !== "string") continue;
    const approved = r.approved === true || r.reviewed === true || r.proofread === true;
    out.set(stateKey(r.msgid, typeof r.msgctxt === "string" ? r.msgctxt : undefined), approved ? "approved" : "translated");
  }
  return out;
}

export interface ImportInput {
  platform: Platform;
  locale: string;
  /** Path inside the locale directory, without extension. */
  catalogue: string;
  /** The `.po` on the base branch, or `undefined` when the platform created it. */
  base: string | undefined;
  /** The platform's version of the `.po`. */
  incoming: string;
  /** The existing candidates sidecar, if any. */
  candidates?: CandidatesFile;
  hints?: StateHints;
  /** `version` on the source: the platform project/component, when known. */
  version?: string;
  /** ISO 8601. */
  at: string;
  /**
   * Every catalogue the platform sends uses the platform's export of all
   * strings, or only those approved there (`export_only_approved`,
   * `--mode reviewed`). With `"approved"`, a non-fuzzy string with no hint is
   * `approved`; otherwise `translated`.
   */
  exportMode?: "all" | "approved";
}

export interface ImportResult {
  /** The `.po` to keep: the base, with empty msgstrs filled fuzzy from the first candidate. */
  po: string;
  candidates: CandidatesFile;
  /** One line per string imported. */
  imported: string[];
  /** One line per string NOT imported, with the reason. */
  skipped: string[];
  /** msgids whose empty msgstr took the first candidate, fuzzy. */
  filled: string[];
  /** Candidates newly recorded (an identical one already there is not). */
  added: number;
}

/** Blank every msgstr of a `.po` (plural forms included), keeping comments, flags and header. */
export function blankTranslations(text: string): string {
  const lines = text.split("\n");
  const entries = poEntries(text);
  // Work from the end so earlier line numbers stay valid.
  for (const e of [...entries].reverse()) {
    const out: string[] = [];
    let inStr = false;
    for (let k = e.start; k < e.end; k++) {
      const l = lines[k]!;
      const m = /^(msgstr(?:\[\d+\])?)\s/.exec(l);
      if (m) { out.push(`${m[1]} ""`); inStr = true; continue; }
      if (inStr && l.trimStart().startsWith('"')) continue;
      inStr = false;
      out.push(l);
    }
    lines.splice(e.start, e.end - e.start, ...out);
  }
  return lines.join("\n");
}

/**
 * The subject of the commit the import makes on a platform's branch
 * (`layer-translation-platform-import.yml` writes the same words). A `.po`
 * whose latest commit has it holds the import's own output, not the
 * platform's, so a later run leaves it alone until the platform syncs again.
 */
export const rewriteSubject = (p: Platform) => `Rewrite ${p} translations as candidates`;

export interface PlatformDiff {
  /**
   * The `.po` to restore before candidates are added: the base branch's, or,
   * for a catalogue the platform created, the platform's with every
   * translation blanked. The platform's text never stays in a `msgstr`.
   */
  base: string;
  /** The platform's strings, for the shared writer (`addCandidates` / `mergeCandidates`). */
  inputs: CandidateInput[];
  /** The platform's state per string, keyed by {@link stateKey}, with the text it describes. */
  states: Map<string, { text: string; state: PlatformState }>;
  /** One line per string NOT offered, with the reason. */
  skipped: string[];
}

const show = (s: string) => JSON.stringify(s.length > 60 ? `${s.slice(0, 57)}…` : s);

/**
 * What a platform's `.po` offers beyond the base: one candidate input per
 * translated string whose text differs from the base's. Pure. Writing —
 * the sidecar, an empty `msgstr` filled fuzzy, the node — is the shared
 * writer's (`scripts/lib/translation-candidates.ts`), as for every source.
 */
export function platformDiff(input: Omit<ImportInput, "locale" | "catalogue" | "candidates">): PlatformDiff {
  const source: PlatformCandidate["source"] = {
    kind: "web-service",
    id: input.platform,
    ...(input.version ? { version: input.version } : {}),
    at: input.at,
  };
  const base = input.base ?? blankTranslations(input.incoming);
  const baseEntries = new Map(poEntries(base).map((e) => [keyOf(e), e]));
  const inputs: CandidateInput[] = [];
  const states: PlatformDiff["states"] = new Map();
  const skipped: string[] = [];
  for (const inc of poEntries(input.incoming)) {
    if (inc.msgstr === "") continue;
    const k = keyOf(inc);
    const b = baseEntries.get(k);
    if (!b) { skipped.push(`${show(inc.msgid)}: not in the base catalogue (a template change is not the platform's to make)`); continue; }
    if (inc.msgidPlural !== undefined) { skipped.push(`${show(inc.msgid)}: plural entry; plural forms are suggested by hand`); continue; }
    if (inc.msgstr === b.msgstr) continue; // nothing new from the platform
    const state: PlatformState = inc.fuzzy
      ? "fuzzy"
      : input.hints?.get(k) ?? (input.exportMode === "approved" ? "approved" : "translated");
    inputs.push({ ...(inc.msgctxt !== undefined ? { msgctxt: inc.msgctxt } : {}), msgid: inc.msgid, text: inc.msgstr, source });
    states.set(k, { text: inc.msgstr, state });
  }
  return { base, inputs, states, skipped };
}

/**
 * Record the platform's own state on its candidates, as
 * `metadata.platformState`: metadata, never a verdict. A candidate already
 * there from an earlier import has its state refreshed. Returns a copy.
 */
export function annotatePlatformStates(file: CandidatesFile, platform: Platform, states: PlatformDiff["states"]): CandidatesFile {
  const out = structuredClone(file);
  for (const e of out.entries) {
    const st = states.get(keyOf(e));
    if (!st) continue;
    const mine = e.candidates.filter((c) => c.source.kind === "web-service" && c.source.id === platform);
    // The writer may normalise the text (placeholders); fall back to this platform's newest candidate.
    const c = mine.find((x) => x.text === st.text) ?? mine[mine.length - 1];
    if (c) (c as Partial<PlatformCandidate>).metadata = { platformState: st.state };
  }
  return out;
}

/**
 * The whole import, in memory: {@link platformDiff}, the shared writer's
 * {@link mergeCandidates}, then {@link annotatePlatformStates}. Pure. The CLI
 * does the same on disk with `addCandidates`.
 */
export function importPlatformPo(input: ImportInput): ImportResult {
  const d = platformDiff(input);
  const sidecar = input.candidates ?? emptySidecar(input.locale, input.catalogue);
  const m = mergeCandidates(d.base, sidecar, d.inputs);
  const candidates = annotatePlatformStates(m.sidecar, input.platform, d.states);
  const problems = candidatesProblems(candidates);
  if (problems.length > 0) throw new Error(`candidates file would not validate: ${problems.join("; ")}`);
  const rejectedKeys = new Set(m.rejected.map((r) => keyOf(r)));
  return {
    po: m.po,
    candidates,
    imported: d.inputs.filter((i) => !rejectedKeys.has(keyOf(i))).map((i) => `${show(i.msgid)} (${d.states.get(keyOf(i))!.state} on ${input.platform})`),
    skipped: [...d.skipped, ...m.rejected.map((r) => `${show(r.msgid)}: ${r.reason}`)],
    filled: m.filled.map((f) => f.msgid),
    added: m.added,
  };
}

/** The sidecar's path for a catalogue. */
export function candidatesPath(translationsDir: string, locale: string, catalogue: string): string {
  return join(translationsDir, locale, `${catalogue}${CANDIDATES_SUFFIX}`);
}

/** Read a sidecar, or `undefined` when there is none. Throws when one exists but does not validate: it is never overwritten. */
export function readCandidates(path: string): CandidatesFile | undefined {
  if (!existsSync(path)) return undefined;
  const parsed: unknown = JSON.parse(readFileSync(path, "utf-8"));
  const problems = candidatesProblems(parsed);
  if (problems.length > 0) throw new Error(`${path}: ${problems.join("; ")}`);
  return parsed as CandidatesFile;
}

/**
 * Split a repository-relative path of a changed `.po` into locale and
 * catalogue, when it lies in `translationsDir` (repository-relative, `/`).
 */
export function poPathParts(translationsDir: string, path: string): { locale: string; catalogue: string } | undefined {
  const prefix = translationsDir === "." ? "" : `${translationsDir}/`;
  if (!path.startsWith(prefix) || !path.endsWith(".po")) return undefined;
  const rest = path.slice(prefix.length, -".po".length).split("/");
  if (rest.length < 2 || !LOCALE_DIR_RE.test(rest[0]!) || rest.some((s) => s === "" || s === "." || s === "..")) return undefined;
  return { locale: rest[0]!, catalogue: rest.slice(1).join("/") };
}
