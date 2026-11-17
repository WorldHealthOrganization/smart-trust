#!/usr/bin/env bun
/**
 * Compile an IG's CodeSystems with its per-locale translation supplements,
 * with SUSHI, and check the supplements.
 *
 * @module fhir-harness/scripts/check-translation-supplements
 *
 * Usage:
 *   bun run fhir-harness/scripts/check-translation-supplements.ts [<ig-root>]
 *       [--sushi <bin>] [--tarballs <dir>] [--json]
 *
 * An IG's translated FHIR terms are CodeSystem supplements, one FSH file per
 * locale in `input/fsh/translations/<locale>.fsh`, each CodeSystem in it with
 * `^content = #supplement`, `^supplements = Canonical(<base>)` and
 * `^language = #<locale>`. The IG build compiles them, but an IG's build is
 * often not run on a pull request, so nothing else compiles them there. This
 * check does, in a throw-away FSHOnly SUSHI project of:
 *
 * - every `CodeSystem`, `Alias` and `RuleSet` entity of the IG's other FSH
 *   files (nothing else: profiles and instances would need the IG's
 *   dependencies, which the check does not load); and
 * - every `input/fsh/translations/<locale>.fsh`, whole.
 *
 * Then it requires, and reports every miss:
 *
 * - SUSHI reports 0 errors;
 * - every CodeSystem in a translation file is a supplement, and the
 *   CodeSystem it supplements is one this IG defines;
 * - every code it designates is a code of that CodeSystem;
 * - its `language` is the file's locale (`fr.fsh` → `fr`; case and `_`/`-`
 *   are not told apart), and every designation that names a language names
 *   that one;
 * - every CodeSystem id is unique across the IG and its translation files.
 *
 * An IG with no `input/fsh/translations/` directory, or whose declared read
 * scope does not reach it, is NOT APPLICABLE and exits 0.
 *
 * ## What is read
 *
 * Only paths the IG declares in `contentTypes.ig.include`
 * (`ig-read-scope.ts`; skill `ig-build-pipeline`, "What this layer reads"):
 * `sushi-config.yaml`, required, and the `.fsh` files under `input/fsh/`.
 *
 * ## Nothing is resolved at run time
 *
 * - SUSHI is `scripts/sushi/`'s, installed from its `package-lock.json` with
 *   `npm ci --ignore-scripts`. Its version is `ig-toolchain.env`'s
 *   `SUSHI_VERSION`, the one SUSHI pin of this layer: the run refuses a
 *   lockfile or a binary of any other version. No IG's `sushi-config.yaml`
 *   names a SUSHI version, so there is nothing of the IG's to read for it.
 * - The FHIR core package for the IG's `fhirVersion` comes from
 *   `scripts/sushi/fhir-packages.lock.json`: fetched from the npm mirror (or
 *   read from `--tarballs`), checked against its pinned sha512, and unpacked
 *   into a FHIR package cache made for this run. A `fhirVersion` the lock does
 *   not list is refused.
 * - SUSHI runs with that cache as its only cache (`HOME` is the run's own) and
 *   its proxy set to an address that refuses every connection, so it can
 *   fetch nothing: the packages SUSHI provides automatically
 *   (`hl7.fhir.uv.tools`, `hl7.terminology`, `hl7.fhir.uv.extensions`) are
 *   reported by SUSHI as not loaded, a warning, and are not needed to compile
 *   CodeSystems. The run then checks the cache holds the pinned core and
 *   nothing else.
 *
 * Exit codes: 0 pass or not applicable; 1 findings; 2 the check could not run
 * (usage, no SUSHI installed, a version that is not the pin, an unpinned
 * `fhirVersion`, a download that does not verify, an undeclared
 * `sushi-config.yaml`).
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import { sha512Integrity, unpackTgz } from "./fhir-cache-seed-npm.ts";
import { igReadScope } from "./ig-read-scope.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
/** Where SUSHI's lockfile, its install and the FHIR package lock are. */
export const SUSHI_DIR = join(HERE, "sushi");
export const TOOLCHAIN_ENV = join(HERE, "ig-toolchain.env");
export const FHIR_PACKAGES_LOCK = join(SUSHI_DIR, "fhir-packages.lock.json");
export const TRANSLATIONS_DIR = "input/fsh/translations";
const FSH_DIR = "input/fsh";
/** A proxy no connection can be made through: SUSHI fetches nothing. */
const NO_NETWORK = "http://127.0.0.1:9";

// ── Pins ─────────────────────────────────────────────────────────────

/** `SUSHI_VERSION` of `ig-toolchain.env`. */
export function pinnedSushiVersion(envFile = TOOLCHAIN_ENV): string {
  const m = readFileSync(envFile, "utf8").match(/^SUSHI_VERSION=(\S+)\s*$/m);
  if (!m) throw new Error(`${envFile}: no SUSHI_VERSION`);
  return m[1];
}

/** The fsh-sushi version `scripts/sushi/package-lock.json` installs. */
export function lockedSushiVersion(dir = SUSHI_DIR): string | undefined {
  const lock = JSON.parse(readFileSync(join(dir, "package-lock.json"), "utf8")) as {
    packages?: Record<string, { version?: string }>;
  };
  return lock.packages?.["node_modules/fsh-sushi"]?.version;
}

export interface PinnedFhirPackage {
  name: string;
  version: string;
  tarball: string;
  integrity: string;
}

/** The pinned core package for `fhirVersion`, or undefined when none is pinned. */
export function pinnedCorePackage(fhirVersion: string, lockFile = FHIR_PACKAGES_LOCK): PinnedFhirPackage | undefined {
  const lock = JSON.parse(readFileSync(lockFile, "utf8")) as { packages: PinnedFhirPackage[] };
  return lock.packages.find((p) => /^hl7\.fhir\.r[0-9]+b?\.core$/.test(p.name) && p.version === fhirVersion);
}

/**
 * Lay the pinned package down at `<cache>/<name>#<version>`, from
 * `<tarballs>/<name>-<version>.tgz` when that is there, else from its URL
 * (kept in `tarballs` when given). Either way the bytes must match the pinned
 * sha512, or nothing is unpacked.
 */
export async function layDownPackage(pkg: PinnedFhirPackage, cache: string, tarballs?: string): Promise<void> {
  const kept = tarballs ? join(tarballs, `${pkg.name}-${pkg.version}.tgz`) : undefined;
  let data: Buffer;
  if (kept && existsSync(kept)) {
    data = readFileSync(kept);
  } else {
    const res = await fetch(pkg.tarball);
    if (!res.ok) throw new Error(`${pkg.tarball}: HTTP ${res.status}`);
    data = Buffer.from(await res.arrayBuffer());
  }
  const got = sha512Integrity(data);
  if (got !== pkg.integrity) {
    throw new Error(`${pkg.name}#${pkg.version}: integrity mismatch (pinned ${pkg.integrity}, got ${got})`);
  }
  if (kept && !existsSync(kept)) {
    mkdirSync(dirname(kept), { recursive: true });
    writeFileSync(kept, data);
  }
  unpackTgz(data, join(cache, `${pkg.name}#${pkg.version}`));
}

// ── FSH ──────────────────────────────────────────────────────────────

const ENTITY = /^(Alias|Profile|Extension|Logical|Resource|Instance|ValueSet|CodeSystem|Invariant|Mapping|RuleSet)\s*:\s*(.*)$/;

export interface FshEntity {
  keyword: string;
  name: string;
  /** `Id:` when given, else the name (SUSHI's default). Only for CodeSystem. */
  id?: string;
  text: string;
}

/**
 * Split FSH text into its top-level entities. An entity starts at a line
 * that begins with an entity keyword outside a block comment or a `"""`
 * string, and runs to the next one. Text before the first is dropped
 * (comments, blank lines).
 */
export function fshEntities(text: string): FshEntity[] {
  const out: FshEntity[] = [];
  let cur: { keyword: string; name: string; lines: string[] } | undefined;
  let inComment = false;
  let inString = false;
  const flush = () => {
    if (!cur) return;
    const body = cur.lines.join("\n");
    const e: FshEntity = { keyword: cur.keyword, name: cur.name, text: `${body}\n` };
    if (cur.keyword === "CodeSystem") e.id = body.match(/^Id\s*:\s*(\S+)/m)?.[1] ?? cur.name;
    out.push(e);
  };
  for (const line of text.split(/\r?\n/)) {
    const m = !inComment && !inString ? line.match(ENTITY) : null;
    if (m) {
      flush();
      const name = m[1] === "Alias" ? m[2].split("=")[0].trim() : m[2].trim().split(/\s|\(/)[0];
      cur = { keyword: m[1], name, lines: [] };
    }
    cur?.lines.push(line);
    // Track where the next line starts: inside a """ string or a /* comment.
    let i = 0;
    while (i < line.length) {
      if (inComment) {
        const end = line.indexOf("*/", i);
        if (end < 0) break;
        inComment = false;
        i = end + 2;
      } else if (inString) {
        const end = line.indexOf('"""', i);
        if (end < 0) break;
        inString = false;
        i = end + 3;
      } else {
        const rest = line.slice(i);
        const c = rest.search(/\/\*|"""|\/\//);
        if (c < 0) break;
        if (rest.startsWith("//", c)) break;
        if (rest.startsWith("/*", c)) inComment = true;
        else inString = true;
        i += c + (rest.startsWith("/*", c) ? 2 : 3);
      }
    }
  }
  flush();
  return out;
}

/** What of a definition file the check compiles: its CodeSystems, Aliases and RuleSets. */
export function compilableFsh(text: string): string {
  return fshEntities(text)
    .filter((e) => e.keyword === "CodeSystem" || e.keyword === "Alias" || e.keyword === "RuleSet")
    .map((e) => e.text)
    .join("\n");
}

// ── The IG ───────────────────────────────────────────────────────────

export interface FshFile {
  /** Repository-relative, POSIX. */
  rel: string;
  text: string;
}

export interface TranslationFile extends FshFile {
  locale: string;
}

export interface IgInputs {
  root: string;
  sushiConfig: Record<string, unknown>;
  definitions: FshFile[];
  translations: TranslationFile[];
}

/**
 * Read what the check needs from the IG at `root`, through its read scope.
 * Undefined when the IG has no translations directory it lets this layer read.
 */
export function readIgInputs(root: string): IgInputs | undefined {
  const scope = igReadScope(root);
  if (!scope.reaches(TRANSLATIONS_DIR) || !existsSync(join(scope.root, TRANSLATIONS_DIR))) return undefined;
  const translations: TranslationFile[] = readdirSync(join(scope.root, TRANSLATIONS_DIR), { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".fsh") && scope.declares(`${TRANSLATIONS_DIR}/${e.name}`))
    .map((e) => e.name)
    .sort()
    .map((n) => {
      const rel = `${TRANSLATIONS_DIR}/${n}`;
      return { rel, locale: n.slice(0, -".fsh".length), text: readFileSync(join(scope.root, rel), "utf8") };
    });
  if (translations.length === 0) return undefined;
  const definitions: FshFile[] = [];
  const walk = (rel: string): void => {
    for (const e of readdirSync(join(scope.root, rel), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const r = `${rel}/${e.name}`;
      if (e.isDirectory()) {
        if (r !== TRANSLATIONS_DIR && scope.reaches(r)) walk(r);
      } else if (e.isFile() && e.name.endsWith(".fsh") && scope.declares(r)) {
        definitions.push({ rel: r, text: readFileSync(join(scope.root, r), "utf8") });
      }
    }
  };
  if (scope.reaches(FSH_DIR)) walk(FSH_DIR);
  const sushiConfig = (parseYaml(readFileSync(scope.path("sushi-config.yaml"), "utf8")) ?? {}) as Record<string, unknown>;
  return { root: scope.root, sushiConfig, definitions, translations };
}

/** The IG's FHIR version: `fhirVersion`, or the first of a list. */
export function fhirVersionOf(cfg: Record<string, unknown>): string | undefined {
  const v = Array.isArray(cfg.fhirVersion) ? cfg.fhirVersion[0] : cfg.fhirVersion;
  return typeof v === "string" || typeof v === "number" ? String(v).trim() : undefined;
}

/** The throw-away project's sushi-config.yaml: the IG's canonical, version, status and FHIR version, FSHOnly. */
export function projectConfig(cfg: Record<string, unknown>): string {
  const out: Record<string, unknown> = {};
  for (const k of ["canonical", "version", "status"]) if (cfg[k] !== undefined) out[k] = cfg[k];
  out.fhirVersion = fhirVersionOf(cfg);
  out.FSHOnly = true;
  return stringifyYaml(out);
}

/** Lay the throw-away project out at `work`; each file keeps its path in its name. */
export function writeProject(ig: IgInputs, work: string): void {
  const fsh = join(work, "input", "fsh");
  mkdirSync(fsh, { recursive: true });
  const name = (rel: string) => rel.slice(FSH_DIR.length + 1).split("/").join("--");
  for (const d of ig.definitions) {
    const keep = compilableFsh(d.text);
    if (keep.trim()) writeFileSync(join(fsh, name(d.rel)), keep);
  }
  for (const t of ig.translations) writeFileSync(join(fsh, name(t.rel)), t.text);
  writeFileSync(join(work, "sushi-config.yaml"), projectConfig(ig.sushiConfig));
}

// ── SUSHI's result, and the checks ───────────────────────────────────

/** SUSHI's error count (its results box) and its `error` lines. */
export function sushiErrors(log: string): { count: number | undefined; lines: string[] } {
  const m = log.match(/(\d+)\s+Errors?\b/);
  const lines = log.split(/\r?\n/).filter((l) => /^error\s/.test(l)).map((l) => l.replace(/^error\s+/, "").trim());
  return { count: m ? Number(m[1]) : undefined, lines };
}

interface Concept {
  code: string;
  concept?: Concept[];
  designation?: { language?: string; value?: string }[];
}

export interface CodeSystemJson {
  id: string;
  url?: string;
  content?: string;
  supplements?: string;
  language?: string;
  concept?: Concept[];
}

/** Every code of a CodeSystem, nested ones included. */
export function codesOf(cs: { concept?: Concept[] }): Set<string> {
  const out = new Set<string>();
  const walk = (cs: Concept[] | undefined) => {
    for (const c of cs ?? []) {
      out.add(c.code);
      walk(c.concept);
    }
  };
  walk(cs.concept);
  return out;
}

const lang = (s: string | undefined) => (s ?? "").toLowerCase().replace(/_/g, "-");

export interface Finding {
  /** The translation file, or `sushi`. */
  where: string;
  message: string;
}

/**
 * The structural checks, over the FSH files and SUSHI's CodeSystems. Pure:
 * SUSHI's own errors are reported by the caller.
 */
export function judge(ig: Pick<IgInputs, "definitions" | "translations">, compiled: CodeSystemJson[]): Finding[] {
  const findings: Finding[] = [];
  const byId = new Map(compiled.map((c) => [c.id, c]));
  const bases = new Map(compiled.filter((c) => c.content !== "supplement" && c.url).map((c) => [c.url!, c]));

  const ids = new Map<string, string[]>();
  const note = (id: string, rel: string) => ids.set(id, [...(ids.get(id) ?? []), rel]);
  for (const d of ig.definitions) for (const e of fshEntities(d.text)) if (e.id) note(e.id, d.rel);
  for (const t of ig.translations) for (const e of fshEntities(t.text)) if (e.id) note(e.id, t.rel);
  const duplicated = new Set<string>();
  for (const [id, where] of ids) {
    if (where.length > 1) duplicated.add(id);
    if (where.length > 1) findings.push({ where: where.find((w) => w.startsWith(TRANSLATIONS_DIR)) ?? where[0], message: `CodeSystem id ${id} is used ${where.length} times (${where.join(", ")})` });
  }

  for (const t of ig.translations) {
    const entities = fshEntities(t.text).filter((e) => e.keyword === "CodeSystem");
    if (entities.length === 0) findings.push({ where: t.rel, message: "defines no CodeSystem supplement" });
    for (const e of entities) {
      // Reported above; SUSHI keeps one of them, which may not be this one.
      if (duplicated.has(e.id!)) continue;
      const cs = byId.get(e.id!);
      const label = `${e.name} (${e.id})`;
      if (!cs) {
        findings.push({ where: t.rel, message: `${label}: SUSHI produced no CodeSystem for it` });
        continue;
      }
      if (cs.content !== "supplement") {
        findings.push({ where: t.rel, message: `${label}: content is ${cs.content ?? "not set"}, not supplement` });
        continue;
      }
      const target = (cs.supplements ?? "").split("|")[0];
      const base = bases.get(target);
      if (!base) {
        findings.push({ where: t.rel, message: `${label}: supplements ${cs.supplements ?? "nothing"}, which is not a CodeSystem of this IG` });
      } else {
        const extra = [...codesOf(cs)].filter((c) => !codesOf(base).has(c)).sort();
        if (extra.length) findings.push({ where: t.rel, message: `${label}: codes not in ${base.id}: ${extra.join(", ")}` });
      }
      if (lang(cs.language) !== lang(t.locale)) {
        findings.push({ where: t.rel, message: `${label}: language is ${cs.language ?? "not set"}, the file's locale is ${t.locale}` });
      }
      const walk = (cs2: Concept[] | undefined) => {
        for (const c of cs2 ?? []) {
          for (const d of c.designation ?? []) {
            if (d.language && cs.language && lang(d.language) !== lang(cs.language)) {
              findings.push({ where: t.rel, message: `${label}: ${c.code} has a designation in ${d.language}, the supplement is in ${cs.language}` });
            }
          }
          walk(c.concept);
        }
      };
      walk(cs.concept);
    }
  }
  return findings;
}

// ── The run ──────────────────────────────────────────────────────────

export interface CheckOptions {
  /** The SUSHI binary; default `scripts/sushi/node_modules/.bin/sushi`. */
  sushi?: string;
  /** Where verified FHIR package tarballs are kept between runs. */
  tarballs?: string;
}

export type CheckResult =
  | { status: "not-applicable"; reason: string }
  | { status: "cannot-run"; reason: string }
  | {
      status: "pass" | "fail";
      sushiVersion: string;
      fhirPackage: string;
      codeSystems: number;
      supplements: Record<string, number>;
      sushiErrors: string[];
      findings: Finding[];
    };

export class CannotRun extends Error {}

/** Check the SUSHI pins agree, and that `bin` is that SUSHI. Returns the version. */
export function verifySushi(bin: string): string {
  const pin = pinnedSushiVersion();
  const locked = lockedSushiVersion();
  if (locked !== pin) {
    throw new CannotRun(`scripts/sushi/package-lock.json installs fsh-sushi ${locked ?? "(none)"}, ig-toolchain.env pins SUSHI_VERSION=${pin}: relock it (see scripts/sushi/package.json)`);
  }
  if (!existsSync(bin)) {
    throw new CannotRun(`no SUSHI at ${bin}: install the pinned one with \`npm ci --ignore-scripts --prefix fhir-harness/scripts/sushi\``);
  }
  const v = spawnSync(bin, ["--version"], { encoding: "utf8" });
  const have = `${v.stdout ?? ""}`.match(/(\d+\.\d+\.\d+)/)?.[1];
  if (have !== pin) throw new CannotRun(`${bin} is SUSHI ${have ?? "(unknown)"}, not the pinned ${pin}`);
  return pin;
}

export async function checkTranslationSupplements(root: string, opts: CheckOptions = {}): Promise<CheckResult> {
  let ig: IgInputs | undefined;
  try {
    ig = readIgInputs(root);
  } catch (e) {
    return { status: "cannot-run", reason: e instanceof Error ? e.message : String(e) };
  }
  if (!ig) return { status: "not-applicable", reason: `no ${TRANSLATIONS_DIR}/*.fsh this layer may read in ${resolve(root)}` };

  const tmp = mkdtempSync(join(tmpdir(), "translation-supplements-"));
  try {
    const bin = opts.sushi ?? join(SUSHI_DIR, "node_modules", ".bin", "sushi");
    const sushiVersion = verifySushi(bin);
    const fv = fhirVersionOf(ig.sushiConfig);
    const pkg = fv ? pinnedCorePackage(fv) : undefined;
    if (!pkg) throw new CannotRun(`fhirVersion ${fv ?? "(none)"} has no core package in scripts/sushi/fhir-packages.lock.json`);
    const home = join(tmp, "home");
    const cache = join(home, ".fhir", "packages");
    mkdirSync(cache, { recursive: true });
    try {
      await layDownPackage(pkg, cache, opts.tarballs);
    } catch (e) {
      throw new CannotRun(e instanceof Error ? e.message : String(e));
    }

    const work = join(tmp, "project");
    writeProject(ig, work);
    const env: Record<string, string | undefined> = { ...process.env, HOME: home, USERPROFILE: home };
    for (const k of ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy", "ALL_PROXY", "all_proxy"]) env[k] = NO_NETWORK;
    for (const k of ["NO_PROXY", "no_proxy"]) delete env[k];
    const run = spawnSync(bin, ["build", work], { encoding: "utf8", env, maxBuffer: 64 * 1024 * 1024 });
    const log = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
    const errs = sushiErrors(log);
    const sushiErrorLines =
      errs.count === undefined
        ? [`SUSHI printed no result (exit ${run.status}): ${log.trim().split(/\r?\n/).slice(-5).join(" | ")}`]
        : errs.count > 0
          ? errs.lines.length ? errs.lines : [`${errs.count} error(s)`]
          : [];

    const out = join(work, "fsh-generated", "resources");
    const compiled: CodeSystemJson[] = existsSync(out)
      ? readdirSync(out)
          .filter((f) => /^CodeSystem-.*\.json$/.test(f))
          .map((f) => JSON.parse(readFileSync(join(out, f), "utf8")) as CodeSystemJson)
      : [];
    const findings = judge(ig, compiled);
    const extra = readdirSync(cache).filter((e) => e !== `${pkg.name}#${pkg.version}` && statSync(join(cache, e)).isDirectory());
    if (extra.length) findings.push({ where: "sushi", message: `SUSHI resolved packages at run time: ${extra.join(", ")}` });

    const supplements: Record<string, number> = {};
    for (const t of ig.translations) supplements[t.locale] = fshEntities(t.text).filter((e) => e.keyword === "CodeSystem").length;
    return {
      status: sushiErrorLines.length || findings.length ? "fail" : "pass",
      sushiVersion,
      fhirPackage: `${pkg.name}#${pkg.version}`,
      codeSystems: compiled.filter((c) => c.content !== "supplement").length,
      supplements,
      sushiErrors: sushiErrorLines,
      findings,
    };
  } catch (e) {
    if (e instanceof CannotRun) return { status: "cannot-run", reason: e.message };
    throw e;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** The report a person reads. */
export function render(r: CheckResult): string {
  if (r.status === "not-applicable") return `translation supplements: not applicable (${r.reason})`;
  if (r.status === "cannot-run") return `translation supplements: could not run: ${r.reason}`;
  const per = Object.entries(r.supplements).map(([k, v]) => `${k} ${v}`).join(", ");
  const lines = [
    `translation supplements: SUSHI ${r.sushiVersion} on ${r.fhirPackage}; ${r.sushiErrors.length ? "SUSHI errors" : "0 SUSHI errors"}; ${r.codeSystems} CodeSystem(s); supplements: ${per}`,
    ...r.sushiErrors.map((l) => `  ✗ sushi: ${l}`),
    ...r.findings.map((f) => `  ✗ ${f.where}: ${f.message}`),
    r.status === "pass" ? "✓ pass" : `✗ ${r.sushiErrors.length + r.findings.length} problem(s)`,
  ];
  return lines.join("\n");
}

export function exitCode(r: CheckResult): number {
  return r.status === "fail" ? 1 : r.status === "cannot-run" ? 2 : 0;
}

const USAGE = "usage: check-translation-supplements.ts [<ig-root>] [--sushi <bin>] [--tarballs <dir>] [--json]";

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const opts: CheckOptions = {};
  let root = ".";
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--sushi" || a === "--tarballs") {
      const v = argv[++i];
      if (!v) {
        console.error(USAGE);
        process.exit(2);
      }
      if (a === "--sushi") opts.sushi = resolve(v);
      else opts.tarballs = resolve(v);
    } else if (a === "--json") json = true;
    else if (a === "-h" || a === "--help") {
      console.log(USAGE);
      process.exit(0);
    } else if (a.startsWith("-")) {
      console.error(`unknown flag ${a}\n${USAGE}`);
      process.exit(2);
    } else root = a;
  }
  if (!existsSync(root)) {
    console.error(`${root}: no such directory\n${USAGE}`);
    process.exit(2);
  }
  const r = await checkTranslationSupplements(root, opts);
  console.log(json ? JSON.stringify(r, null, 2) : render(r));
  process.exit(exitCode(r));
}
