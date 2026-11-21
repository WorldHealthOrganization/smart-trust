#!/usr/bin/env bun
/**
 * The exported graph, once per locale — and the core graph never learns they exist.
 *
 * @module scripts/kg-locale-export
 * @covers cat-harness
 *
 * Translations reach the data, not only the rendered diagrams: one document
 * per locale.
 *
 * ## One document per locale, and the arrow runs ONE WAY
 *
 * Per-locale files rather than language maps in the published `@context`:
 * simple to serve, cacheable, and no new context binding. **THE CORE GRAPH
 * MUST NOT REFERENCE ITS TRANSLATIONS**: no `hasTranslation` /
 * `availableLocales` / `seeAlso` per node, which would grow with the
 * translation effort and give bootstrap's graph references it cannot validate.
 * A per-locale document references the core, never the reverse, and the core
 * is complete with no translation existing (the relation
 * `board-diagram-interchange` states for a board and its folio). The
 * filesystem discovers the translations, as the language bar does;
 * **`localeDocumentsUnreferenced`** checks it.
 *
 * ## A catalogue is scoped to the ASSET it was extracted from
 *
 * A `.po` is read only when its stem is the stem of an asset this graph
 * PROJECTS (a `.bpmn` this layer owns), so a docs page's translation (e.g.
 * `"yes"` in a table) is never applied to a diagram's gateway label. That is
 * provenance, not a path, so it survives a layout move.
 *
 * A msgid from diagram A applies to an identical string on a node from
 * diagram B — the model `kg-export` already uses when it dedupes lane-derived
 * `Role` nodes by name.
 *
 * Identity-bearing keys are excluded on top of that ({@link IDENTITY_KEYS}),
 * because a `@id`, a `notation` or a `sourceKind` colliding with a msgid would
 * be rewritten into something no link resolves to. It is a blocklist of what
 * must never move, so a new node field needs no list update.
 *
 * ## Fall-through, and why the language tag is per VALUE
 *
 * `parsePo` takes only non-empty `msgstr` and skips fuzzy entries, so an
 * untranslated string is absent from the map and the source survives, as
 * everywhere else translation happens here. A blanket `"@language": "fr"` on
 * the document would assert French over every fall-through, so a translated
 * value carries `{"@value", "@language"}` and a fall-through stays a plain
 * string under the document's declared source language: fall-through is
 * visible IN THE DATA.
 *
 * ## Which locales are emitted
 *
 * **A locale is emitted when it has at least one translation that applies to
 * this graph, and every locale is REPORTED either way**, so a zero is loud
 * rather than a missing file, and no byte-identical copies are published.
 * `--all-locales` forces emission for a consumer that would rather have a 0 %
 * document than a 404.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/kg-locale-export.ts [--instance ROOT] [--out-dir DIR]
 *   bun run cat-harness-tools/scripts/kg-locale-export.ts --check
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

import { parsePo } from "../pipeline/po-inject.js";
import { readHarnessConfig } from "../schemas/kg/harness-config.js";
import { localeDirIn, repoRootFor, translationsHomeFor } from "../schemas/kg/cat-harness.js";
import { buildExport, exportIdentity, publishedDocument, undeclaredRootTerms } from "./kg-export.js";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { STAGING_KEY } from "./staging-stamp.js";

const ROOT = resolve(HARNESS_ROOT);

/**
 * Keys whose value is an identity or a machine token, never prose.
 *
 * A BLOCKLIST of the things that must not move, not an allowlist of what may:
 * an allowlist is a second answer to "what does the extractor extract", and it
 * goes stale the first time a node kind gains a field. The catalogue decides
 * what is translatable; this decides what is not eligible whatever the
 * catalogue says.
 *
 * `notation` is here because it is the CODE a concept is cited by (`lqo9`),
 * and `sourceKind` because `bpmn-lane` is a provenance token that happens to
 * read like English.
 */
const IDENTITY_KEYS: ReadonlySet<string> = new Set([
  "@id",
  "@type",
  "@context",
  "notation",
  "source",
  "sourceKind",
  "nodeKind",
  "bpmnType",
  "workPlanOp",
  "layer",
  "$schema",
]);

/**
 * An IRI or a prefixed name is a LINK, whatever key it sits under.
 *
 * Two forms, both of which appear in this graph: `https://…` and `skos:Concept`
 * / `cat:Role`. The whitespace test is what keeps prose out — *"Note: this
 * happens"* has a colon and a space, an IRI never does — so a sentence is
 * never mistaken for a link and left untranslated.
 */
export function isIri(s: string): boolean {
  if (/\s/.test(s)) return false;
  return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(s);
}

/**
 * The layer's declared translations root — ONE answer, shared with
 * `translate-bpmn`.
 *
 * Resolved from the declaration rather than spelled, because two copies of
 * this join is how a check passes over a directory the writer never used.
 */
export function translationsHome(instanceRoot: string): ReturnType<typeof translationsHomeFor> {
  // `ROOT` is this script's own layer and therefore the HOST when
  // `--instance` names another: bootstrap's templates live in cat-harness's
  // corpus under `<locale>/bootstrap/`. The host is a DEPENDENT, not a
  // dependency — bootstrap declares `needs: []` — so it cannot be derived from
  // `--instance` and is supplied here instead.
  return translationsHomeFor(instanceRoot, ROOT);
}

/** The directory whose children are locales. Reporting still names one path. */
export function translationsRootFor(instanceRoot: string): string {
  return translationsHome(instanceRoot).root;
}

/** Every locale directory under the layer's translations root. */
export function knownLocales(instanceRoot: string): string[] {
  const home = translationsHome(instanceRoot);
  if (!existsSync(home.root)) return [];
  return readdirSync(home.root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    // A hosted layer's locale set is a SUBSET of its host's: a locale the
    // host translates but which carries nothing for this layer is not this
    // layer's locale. Filtering on the scope directory rather than on the
    // host's locale list is what keeps the two apart — otherwise bootstrap
    // would claim every locale cat-harness has, and a per-locale document would
    // be emitted for each over an empty catalogue.
    .filter((e) => home.scope.length === 0 || existsSync(localeDirIn(home, e.name)))
    .map((e) => e.name)
    .sort();
}

/**
 * Stems of the assets this graph PROJECTS — today, the layer's diagrams.
 *
 * A stem rather than a path, because that is the join a `.po` offers: the
 * extractor writes `<stem>.pot` beside the asset's own name.
 */
export function projectedStems(instanceRoot: string): Set<string> {
  const out = new Set<string>();
  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".bpmn")) out.add(basename(e.name, ".bpmn"));
    }
  };
  walk(instanceRoot);
  return out;
}

/**
 * The catalogues under one locale that apply to THIS graph, merged.
 *
 * Scoped by provenance — see the header on `"yes"` → `"oui"`. A `.po` whose
 * stem names no asset this graph projects is skipped, however many
 * translations it carries, because it was authored against a different
 * artefact and a coincidental msgid match is not a translation of this one.
 *
 * Recursive, because the diagram catalogues sit one level down while the page
 * catalogues sit at the top, and the stem test — not the depth — is what
 * decides. Later files override earlier for the same msgid, the order
 * `mergePoSources` documents.
 *
 * `.pot` is deliberately NOT read: a template carries empty `msgstr`s by
 * definition, so reading one would add nothing and would make "this locale has
 * catalogues" indistinguishable from "this locale has translations" — the
 * exact distinction the report below exists to make.
 */
export function catalogueFor(instanceRoot: string, locale: string): Map<string, string> {
  const dir = localeDirIn(translationsHome(instanceRoot), locale);
  const stems = projectedStems(instanceRoot);
  const out = new Map<string, string>();
  const walk = (d: string): void => {
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".po") && stems.has(basename(e.name, ".po"))) {
        for (const [k, v] of parsePo(readFileSync(p, "utf-8"))) out.set(k, v);
      }
    }
  };
  walk(dir);
  return out;
}

export interface LocaleReport {
  readonly locale: string;
  /** Non-empty `msgstr` entries this locale carries, across every `.po`. */
  readonly catalogue: number;
  /** ...of those, matched against a string in THIS graph. */
  readonly applicable: number;
  /** Values actually rewritten — a msgid may appear on several nodes. */
  readonly substitutions: number;
  /** Written, or reported and skipped for having nothing to say. */
  readonly emitted: boolean;
}

export interface LocaleExport {
  readonly doc: Record<string, unknown>;
  readonly report: LocaleReport;
}

/**
 * Translate one already-built core document.
 *
 * Takes the core rather than building it, so N locales cost ONE export rather
 * than N — and, more importantly, so every locale is provably a projection of
 * the SAME core rather than of N separate builds that could differ.
 */
export function translateDocument(
  core: Record<string, unknown>,
  locale: string,
  catalogue: Map<string, string>,
  sourceLocale: string,
): LocaleExport {
  let substitutions = 0;
  const hit = new Set<string>();

  const walk = (value: unknown, key: string | undefined): unknown => {
    if (typeof value === "string") {
      if (key !== undefined && IDENTITY_KEYS.has(key)) return value;
      if (isIri(value)) return value;
      const t = catalogue.get(value);
      if (t === undefined) return value;
      hit.add(value);
      substitutions += 1;
      // The tag rides the VALUE, never the document: a blanket
      // `"@language": "<locale>"` would assert this language over every string
      // that fell through, and fall-through is the normal case here.
      return { "@value": t, "@language": locale };
    }
    if (Array.isArray(value)) return value.map((v) => walk(v, key));
    if (value !== null && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = walk(v, k);
      return out;
    }
    return value;
  };

  // `@context` is walked with its own key so `IDENTITY_KEYS` catches it: a
  // context maps terms to IRIs, and rewriting one would repoint every
  // property in the document.
  const doc = walk(core, undefined) as Record<string, unknown>;
  // The document says what language its UNTAGGED strings are in. That is the
  // source language, not this locale — which is the whole point of tagging
  // per value above.
  (doc as { sourceLanguage?: string }).sourceLanguage = sourceLocale;

  return {
    doc,
    report: {
      locale,
      catalogue: catalogue.size,
      applicable: hit.size,
      substitutions,
      emitted: false,
    },
  };
}

/**
 * Does any node in the CORE document mention a translation?
 *
 * The owner's constraint, checked rather than intended. It looks for the three
 * shapes the ruling names — a translation property on a node, a locale-
 * suffixed `@id`, a locale key in the `@context` — because "we did not add
 * one" is not a property a future change preserves.
 */
export function localeDocumentsUnreferenced(
  core: Record<string, unknown>,
  locales: readonly string[],
): string[] {
  const bad: string[] = [];
  const BANNED_KEYS = new Set(["hasTranslation", "availableLocales", "translationOf", "translations"]);
  const walk = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    if (value === null || typeof value !== "object") return;
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (BANNED_KEYS.has(k)) bad.push(`${path}.${k}: the core graph must not reference its translations`);
      if (locales.includes(k)) bad.push(`${path}.${k}: a locale key in the core document`);
      if (k === "@id" && typeof v === "string") {
        for (const l of locales) {
          // `.<locale>.jsonld` and `/<locale>/` are the two spellings a
          // per-locale `@id` would take. Matched on the SUFFIX rather than
          // anywhere in the string, so `bootstrap/ns#Role` is not read as a
          // locale because some locale code appears inside a word.
          if (v.endsWith(`.${l}.jsonld`) || v.includes(`.${l}.jsonld#`)) {
            bad.push(`${v}: a per-locale @id in the core document`);
          }
        }
      }
      walk(v, `${path}.${k}`);
    }
  };
  walk(core, "$");
  return bad;
}

export interface LocaleBuild {
  readonly stub: string;
  readonly sourceLanguage: string;
  readonly locales: LocaleReport[];
  readonly docs: Map<string, Record<string, unknown>>;
  /** Findings from {@link localeDocumentsUnreferenced}. */
  readonly coreProblems: string[];
  /** Node `@id`s that differ between the core and any locale. UNDETERMINED is a finding. */
  readonly idDrift: string[];
  /**
   * Root-level fields of an emitted locale document that its own `@context`
   * does not declare — `<locale>: <field>`, one entry each.
   *
   * The same question {@link undeclaredRootTerms} is fatal for in
   * `kg-export.ts`, asked here because that guard structurally cannot see
   * these documents: it runs against the core at the point the core is
   * written, and a locale document is assembled in this file afterwards.
   *
   * `lvw0` is why it exists rather than why it is a good idea. `sourceLanguage`
   * was written to this root and declared nowhere, and the first thing that
   * noticed was `publish:verify` on the built site — after the export had
   * been called clean, and with the deploy skipped as a result. A guard that
   * covers one of two writers reports the covered one and says nothing about
   * the other, which is indistinguishable from a pass.
   */
  readonly rootUndeclared: string[];
}

export async function buildLocaleExports(opts: {
  instanceRoot?: string;
  baseUrl?: string;
  allLocales?: boolean;
  /**
   * The core document `kg-export.ts` has just written for the same layer,
   * base URL and scope (`--core <path>`), read instead of built again — bean
   * fwtz, the KG step: rebuilding it was this script's whole 19 s on `main`,
   * on runs that then wrote nothing. Its staging stamp is set aside, since the
   * built document never carries one. Refused when its `@id` is not the one
   * this run would publish, so a stale or foreign file cannot stand in.
   */
  core?: Record<string, unknown>;
} = {}): Promise<LocaleBuild> {
  const instanceRoot = resolve(opts.instanceRoot ?? ROOT);
  const id = exportIdentity({ baseUrl: opts.baseUrl, instanceRoot: opts.instanceRoot });
  if (opts.core !== undefined && opts.core["@id"] !== id.docIri) {
    throw new Error(`--core holds ${String(opts.core["@id"])}, not ${id.docIri}: not this run's core document`);
  }
  // `publishedDocument`, NOT the raw export — these documents are PUBLISHED,
  // so they carry what the core publishes and not what it computes. The four
  // fields it strips (`undeclaredTerms`, `undeclaredSchemaModules`,
  // `danglingLinks`, `problems`) are a QA reviewer's findings, relocated to
  // `test/results/` by the owner's 2026-09-19 rule, and their `@context`
  // terms were removed WITH them.
  //
  // `lvw0`: this read the raw export until 2026-09-26, so every locale
  // document re-published four fields the context no longer declares, a
  // JSON-LD processor dropped all four, and `publish:verify` refused the
  // documents — 16 of its 20 findings, and the deploy skipped with them. The
  // core was correct throughout: `kg-export.ts` was the function's only
  // caller, so the projection existed and this path went around it.
  const core = opts.core !== undefined ? withoutStagingStamp(opts.core) : publishedDocument(
    // `scope: "instance"` — the document `kg-export` publishes for the host,
    // tombstones included (bean `4ak5` item 2); a locale variant translates
    // that document, so it must not hold nodes the original no longer does.
    await buildExport({ baseUrl: opts.baseUrl, instanceRoot: opts.instanceRoot, scope: "instance" }),
  ) as unknown as Record<string, unknown>;
  // `config.translation.defaultLocale`, NOT `config.defaultLocale` — `tsc`
  // caught the second spelling, and it would have been the `dh4f` shape: a
  // read of a field that is not there, reporting the fallback as if it had
  // been declared. It happens to be `"en"` in this layer, so nothing here
  // would have looked wrong; a folio declaring another source language would
  // have had every locale document claim English fall-through.
  const sourceLanguage = readHarnessConfig(instanceRoot)?.translation?.defaultLocale ?? "en";

  const locales = knownLocales(instanceRoot);
  const coreProblems = localeDocumentsUnreferenced(core, locales);

  const coreIds = new Set(
    ((core["@graph"] as Record<string, unknown>[] | undefined) ?? []).map((n) => n["@id"] as string),
  );

  const reports: LocaleReport[] = [];
  const docs = new Map<string, Record<string, unknown>>();
  const idDrift: string[] = [];
  const rootUndeclared: string[] = [];

  for (const locale of locales) {
    const catalogue = catalogueFor(instanceRoot, locale);
    const { doc, report } = translateDocument(core, locale, catalogue, sourceLanguage);
    const emitted = opts.allLocales === true || report.applicable > 0;
    reports.push({ ...report, emitted });
    if (!emitted) continue;
    docs.set(locale, doc);

    // A translation is not a new term, so every `@id` must be the core's.
    // Asserted per locale rather than trusted from the walk, because the walk
    // is the thing that could break it.
    for (const n of (doc["@graph"] as Record<string, unknown>[] | undefined) ?? []) {
      const nid = n["@id"];
      if (typeof nid !== "string" || !coreIds.has(nid)) {
        idDrift.push(`${locale}: ${String(nid)}`);
      }
    }

    // Against the document's OWN `@context`, not the core's — they are the
    // same object today, and asserting that identity is not this check's job.
    // If the walk ever stops copying the context verbatim, a document checked
    // against a context it does not carry is checked against nothing.
    for (const t of undeclaredRootTerms(doc, (doc["@context"] ?? {}) as Record<string, unknown>)) {
      rootUndeclared.push(`${locale}: ${t}`);
    }
  }

  return { stub: id.stub, sourceLanguage, locales: reports, docs, coreProblems, idDrift, rootUndeclared };
}

/** A written core document as `buildExport` returned it: no staging stamp. */
function withoutStagingStamp(doc: Record<string, unknown>): Record<string, unknown> {
  const { [STAGING_KEY]: _stamp, ...rest } = doc;
  return rest;
}

/** `<stub>.<locale>.jsonld`, beside the core document. */
export function localeDocPath(stub: string, locale: string): string {
  return `${stub}.${locale}.jsonld`;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const arg = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  const check = argv.includes("--check");
  const instanceRoot = arg("--instance");
  const baseUrl = arg("--base-url") ?? process.env.KG_BASE_URL;
  const allLocales = argv.includes("--all-locales");
  const outDir = arg("--out-dir") ?? join(repoRootFor(ROOT), "_kg");

  const corePath = arg("--core");
  const core = corePath !== undefined ? (JSON.parse(readFileSync(corePath, "utf-8")) as Record<string, unknown>) : undefined;
  const build = await buildLocaleExports({ instanceRoot, baseUrl, allLocales, ...(core ? { core } : {}) });

  console.log(`${build.stub} graph per locale — source language ${build.sourceLanguage}`);
  if (build.locales.length === 0) {
    // `6tkl`: a per-locale build over no locales asserts nothing, and
    // reporting it clean would be a pass over an empty set.
    //
    // This briefly granted a DETERMINED EMPTY to a layer that declares no
    // `translation-sources`, and that was the wrong fix — reverted the same
    // day. The premise was that such a layer has nothing to export; the
    // actual state was that its templates had MOVED and this script was
    // looking in the wrong place. `translationsHomeFor` resolves the hosted
    // case now, so the empty this guards is once again the only empty there is.
    //
    // `code-quality-gates.yml` states the policy for the sibling generator and
    // it reads the same way: "a folio with no translations is a real state, and
    // this generator is not the thing that gets to decide the absence means
    // 'nothing to report'."
    console.error(
      `\nNo locale directories under ${relative(repoRootFor(ROOT), translationsRootFor(resolve(instanceRoot ?? ROOT)))} — refusing to call that clean.`,
    );
    process.exit(2);
  }
  for (const r of build.locales) {
    const note = r.emitted
      ? `${r.substitutions} substitution(s) from ${r.applicable} applicable msgid(s)`
      : r.catalogue === 0
        ? "no translations at all — reported, not emitted"
        : `${r.catalogue} translation(s), NONE applying to this graph — reported, not emitted`;
    console.log(`  ${r.emitted ? "✓" : "·"} ${r.locale.padEnd(4)} ${note}`);
  }

  for (const p of build.coreProblems) console.error(`  CORE REFERENCES A TRANSLATION: ${p}`);
  for (const d of build.idDrift) console.error(`  @id DRIFT: ${d}`);
  for (const t of build.rootUndeclared) {
    console.error(`  ROOT FIELD NOT IN THE @context, so a JSON-LD processor drops it: ${t}`);
  }
  if (build.rootUndeclared.length > 0) {
    console.error("  Declare each in `buildContext` — see the DOCUMENT ROOT section there.");
  }

  const bad = build.coreProblems.length + build.idDrift.length + build.rootUndeclared.length;
  if (check) {
    if (bad === 0) {
      console.log(
        `\ncore graph references no translation; ${build.docs.size} locale document(s) would be written, ` +
          `${build.locales.length - build.docs.size} reported and skipped`,
      );
    }
    process.exit(bad === 0 ? 0 : 1);
  }
  if (bad > 0) process.exit(1);

  mkdirSync(outDir, { recursive: true });
  for (const [locale, doc] of build.docs) {
    const out = join(outDir, localeDocPath(build.stub, locale));
    writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`);
    console.log(`  → ${relative(repoRootFor(ROOT), out)}`);
  }
  if (build.docs.size === 0) {
    console.log(`\nNothing written: no locale carries a translation applying to this graph.`);
    console.log(`  Pass --all-locales to emit a source-language copy per locale anyway.`);
  }
}
