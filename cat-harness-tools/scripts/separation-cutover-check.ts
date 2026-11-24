/**
 * `separation:cutover:check` — is this repository's cutover from the monorepo
 * COMPLETE? Measured, condition by condition, never assumed.
 *
 * @module cat-harness-tools/scripts/separation-cutover-check
 * @covers cat-harness — one separated checkout: its declarations, its wiring, its mounts and its site
 *
 * Run it in the separated repository; it answers for that repository alone.
 *
 * ## The conditions — six, each decided by a gate that already exists
 *
 * | id | condition | decided by |
 * |---|---|---|
 * | `mounts` | every layer the repository mounts is declared (`index.config.json`) and on disk at its pin | `remote-mount --check` |
 * | `declarations` | every path a declaration names resolves — directories, assets, visualisers, `needs` | `check:declaration-resolution` |
 * | `monorepo-paths` | no wiring still names the monorepo: `livesAt` on it, a submodule of it, a reusable workflow called from it, a path into its old checkout | this file ({@link monorepoPathFindings}) |
 * | `import-direction` | no module imports from a layer above its own | `check:import-direction` |
 * | `reference-direction` | nothing names a layer that depends on it | `check:reference-direction` |
 * | `site` | the site builds from the mounts alone, every link resolving | `build-instance-site --no-mount` (only with `--site`) |
 *
 * Only `monorepo-paths` is decided here; the rest are CALLED, so a rule lives
 * in one place.
 *
 * ## Three states, and `site`
 *
 * Exit 0 every condition passed · 1 at least one failed · 2 at least one could
 * not be determined (and none failed). A site build takes minutes, so it runs
 * only with `--site`; WITHOUT it the `site` condition is `not-run`, and a run
 * with a condition not run is not "complete" — exit 2. In an INSTANCE root
 * (the root declares its own instance) `site` is `not-applicable` without
 * `--site` instead, which does not block exit 0 (Q-NA-1 B).
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/separation-cutover-check.ts [--root <checkout>] [--site]
 *     [--monorepo <owner/repo>] [--monorepo-dir <dir>] [--json]
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

import { findDeclarationFile, layerRootsIn } from "../schemas/kg/instance-roots.js";

import { checkDeclarationResolution } from "./check-declaration-resolution.ts";
import { GATE_OWN_PATHS_ENV } from "./lib/gate-own.ts";
import { analyse as importDirection } from "./check-import-direction.ts";
import { analyse as referenceDirection } from "./check-reference-direction.ts";

export const CONDITIONS = ["mounts", "declarations", "monorepo-paths", "import-direction", "reference-direction", "site"] as const;
export type ConditionId = (typeof CONDITIONS)[number];
export type ConditionState = "pass" | "fail" | "could-not-determine" | "not-run" | "not-applicable";

export interface ConditionResult {
  id: ConditionId;
  state: ConditionState;
  /** The gate that decided it. */
  by: string;
  summary: string;
  findings: string[];
  /**
   * Findings inside a MOUNTED layer — a layer this repository does not
   * track. Reported, never counted: a cutover is this repository's, and a
   * defect in a layer it mounts at a pin is fixed upstream and re-pinned.
   */
  upstream?: string[];
}

export interface CutoverReport {
  root: string;
  instance: string | undefined;
  /** Layers this repository tracks — its own, as opposed to its mounts. */
  own: string[];
  conditions: ConditionResult[];
}

/**
 * The layers a checkout TRACKS, by declared name. A remote mount is
 * gitignored, so a layer with no tracked file is a layer this repository
 * consumes rather than one it owns.
 */
export function ownInstances(root: string): string[] {
  const out: string[] = [];
  for (const r of layerRootsIn(root)) {
    const name = findDeclarationFile(r)?.replace(/\.json$/, "");
    if (name === undefined) continue;
    const rel = relative(root, r);
    if (rel === "") {
      out.push(name);
      continue;
    }
    const g = spawnSync("git", ["ls-files", "--", rel], { cwd: root, encoding: "utf8" });
    if (g.status === 0 && g.stdout.trim() !== "") out.push(name);
  }
  return out;
}

/** The monorepo the separation left, by its repository and by its old checkout directory. */
export interface Monorepo {
  repository: string;
  dir: string;
}
export const DEFAULT_MONOREPO: Monorepo = { repository: "litlfred/folio-assistant", dir: "folio-assistant" };

/**
 * Records: what a repository SAYS about its past, never its wiring. A bean, an
 * archive or a proposal naming the monorepo is history, and rewriting it would
 * falsify the record (`rewrite-moved-paths` keeps the same list for the same reason).
 */
// declared-path-literal: a FALLBACK record list, not discovery. This gate judges a
// checkout whose declarations may be the very thing that is broken, so which
// directories are records must not depend on reading them; the conventional
// record locations are named here once.
export const RECORD_PREFIXES: readonly string[] = [
  "beans/", "todos/", "fsh-guts/", "memory/", "library/", "uploads/", "docs/proposals/", "test/fixtures/", "test/results/", "translations/",
];

/** Wiring: the file kinds whose text is EXECUTED or resolved, not read. */
const WIRING_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".sh", ".json", ".yml", ".yaml", ".toml", ".py"]);

const isComment = (line: string): boolean => /^\s*(#|\/\/|\*|\/\*)/.test(line);

/**
 * A path into the monorepo's old checkout, or the monorepo named as a source
 * of executable wiring. Pure over (path, text) pairs, so a test can hand it any.
 */
export function monorepoPathFindings(files: ReadonlyArray<{ path: string; text: string }>, mono: Monorepo = DEFAULT_MONOREPO): string[] {
  const out: string[] = [];
  const repo = mono.repository.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const dir = mono.dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // `folio-assistant/<segment>` as a PATH: not preceded by `<owner>/` (a repository
  // name) nor followed by `-` (a sibling layer such as `folio-assistant-<suffix>`).
  const pathRe = new RegExp(`(?<![\\w.-]/)(?<![\\w-])(?:\\.\\./)*${dir}/(?!\\.github/workflows/)[A-Za-z0-9_.][A-Za-z0-9_./-]*`);
  const usesRe = new RegExp(`\\buses:\\s*["']?${repo}/`);
  const submoduleRe = new RegExp(`url\\s*=\\s*\\S*${repo}(?:\\.git)?\\s*$`);
  for (const { path, text } of files) {
    if (RECORD_PREFIXES.some((p) => path.startsWith(p))) continue;
    const lines = text.split("\n");
    if (path === ".gitmodules" || path.endsWith("/.gitmodules")) {
      lines.forEach((l, i) => {
        if (submoduleRe.test(l)) out.push(`${path}:${i + 1}: a submodule of the monorepo — ${l.trim()}`);
      });
      continue;
    }
    if (!WIRING_EXTENSIONS.has(extname(path))) continue;
    // `livesAt` naming the monorepo (lesson 15): read structurally from a declaration.
    if (extname(path) === ".json") {
      try {
        const j = JSON.parse(text) as { livesAt?: { repository?: string; path?: string } };
        if (j && typeof j === "object" && j.livesAt?.repository === mono.repository) {
          out.push(`${path}: declares \`livesAt\` ${mono.repository}/${j.livesAt.path ?? ""} — the instance still says it is staged in the monorepo (kg-separation lesson 15)`);
        }
      } catch {
        // not JSON, or not a declaration: the line scan below still applies
      }
    }
    lines.forEach((l, i) => {
      if (isComment(l)) return;
      if (usesRe.test(l)) out.push(`${path}:${i + 1}: calls the monorepo's workflow — ${l.trim()} (kg-separation lessons 16–17)`);
      const m = pathRe.exec(l);
      if (m) out.push(`${path}:${i + 1}: a path into the monorepo's old checkout, \`${m[0]}\``);
    });
  }
  return out;
}

/**
 * The layer directories whose wiring this run judges, relative to the root:
 * the caller's own (`CAT_GATE_OWN_PATHS`, `gate-own.ts`), or `["."]` (the
 * whole checkout) when the run names none.
 *
 * A layer's PR checks compose the platform index and run from its root, and
 * that index IS the monorepo the separation left: listing the root's tracked
 * files judged the monorepo for naming itself, while the caller, a checkout of
 * its own placed inside it, was not among them at all (a FHIR IG judged with
 * no base, 2026-11-19). Each own layer is listed from its own directory.
 */
// input-site: env CAT_GATE_OWN_PATHS #cd789a3f — the layer directories judged; the value is the whole of what it contributes
export function judgedLayerDirs(env: Readonly<Record<string, string | undefined>> = process.env): string[] {
  const own = (env[GATE_OWN_PATHS_ENV] ?? "").split(",").map((x) => x.trim().replace(/^\.\/+/, "").replace(/\/+$/, "")).filter(Boolean);
  return own.length > 0 ? [...new Set(own.map((x) => x || "."))] : ["."];
}

/** Every own layer's wiring files, with paths relative to the root. `undefined` when one cannot be listed. */
function wiringFiles(root: string, env?: Readonly<Record<string, string | undefined>>): Array<{ path: string; text: string }> | undefined {
  const out: Array<{ path: string; text: string }> = [];
  const dirs = judgedLayerDirs(env);
  for (const d of dirs) {
    const files = trackedFiles(d === "." ? root : join(root, d));
    if (files === undefined) return undefined;
    for (const f of files) out.push(d === "." ? f : { ...f, path: `${d}/${f.path}` });
  }
  return out;
}

function trackedFiles(root: string): Array<{ path: string; text: string }> | undefined {
  const r = spawnSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) return undefined;
  const out: Array<{ path: string; text: string }> = [];
  for (const path of r.stdout.split("\0").filter(Boolean)) {
    const ext = extname(path);
    if (!WIRING_EXTENSIONS.has(ext) && !path.endsWith(".gitmodules")) continue;
    if (RECORD_PREFIXES.some((p) => path.startsWith(p))) continue;
    try {
      out.push({ path, text: readFileSync(join(root, path), "utf8") });
    } catch {
      // deleted in the working tree: not wiring any more
    }
  }
  return out;
}

/**
 * The `monorepo-paths` condition over the layers this run judges
 * ({@link judgedLayerDirs}): each scanned with LAYER-relative paths (the record
 * prefixes are a layer's) and reported with the layer's directory in front.
 */
export function monorepoPathsCondition(root: string, opts: { monorepo?: Monorepo; env?: Readonly<Record<string, string | undefined>> } = {}): ConditionResult {
  const dirs = judgedLayerDirs(opts.env);
  const files = wiringFiles(root, opts.env);
  if (files === undefined) {
    return { id: "monorepo-paths", state: "could-not-determine", by: "separation:cutover:check", summary: `not a git checkout: the tracked files of ${dirs.join(", ")} could not be listed`, findings: [] };
  }
  const found = dirs.flatMap((d) => {
    const mine = d === "." ? files : files.filter((f) => f.path.startsWith(`${d}/`)).map((f) => ({ ...f, path: f.path.slice(d.length + 1) }));
    return monorepoPathFindings(mine, opts.monorepo).map((x) => (d === "." ? x : `${d}/${x}`));
  });
  return { id: "monorepo-paths", state: found.length ? "fail" : "pass", by: "separation:cutover:check", summary: `${found.length} reference(s) to the monorepo in ${files.length} wiring file(s)`, findings: found };
}

const TOOLS_ROOT = resolve(import.meta.dir, "..");

function runGate(script: string, args: string[], cwd: string): { status: number; tail: string } {
  const r = spawnSync(process.execPath, [join(TOOLS_ROOT, "scripts", script), ...args], { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const text = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim().split("\n");
  return { status: r.status ?? 2, tail: text.slice(-12).join("\n") };
}

const stateOf = (status: number): ConditionState => (status === 0 ? "pass" : status === 1 ? "fail" : "could-not-determine");
const firstLine = (e: unknown): string => (e as Error).message.split("\n")[0]!;

export function checkCutover(rootArg: string, opts: { site?: boolean; monorepo?: Monorepo; env?: Readonly<Record<string, string | undefined>> } = {}): CutoverReport {
  const root = resolve(rootArg);
  const decl = findDeclarationFile(root);
  const instance = decl?.replace(/\.json$/, "");
  const own = new Set(ownInstances(root));
  const conditions: ConditionResult[] = [];

  // mounts
  if (!existsSync(join(root, "index.config.json"))) {
    const needsOutside = layerRootsIn(root).length <= 1 ? [] : ["(instances beside the root)"];
    conditions.push({
      id: "mounts",
      state: needsOutside.length === 0 ? "pass" : "fail",
      by: "remote-mount --check",
      summary: needsOutside.length === 0 ? "no index.config.json and no layer beside the root: nothing is mounted, nothing is owed" : "layers sit beside the root with no index.config.json declaring where they come from",
      findings: [],
    });
  } else {
    // `--excuse-own`: a layer's PR checks swap the caller's own instance in at
    // the PR head over its pinned mount, which is not a defect of the mount.
    const g = runGate("remote-mount.ts", ["--check", "--excuse-own"], root);
    conditions.push({ id: "mounts", state: stateOf(g.status), by: "remote-mount --check", summary: g.status === 0 ? "every declared mount is on disk at its pin" : "a declared mount is missing, modified or undetermined", findings: g.status === 0 ? [] : [g.tail] });
  }

  // declarations
  try {
    const r = checkDeclarationResolution(root);
    const mine = r.findings.filter((f) => own.has(f.instance));
    const theirs = r.findings.filter((f) => !own.has(f.instance));
    const code = r.undetermined.length > 0 || r.instances.length === 0 ? 2 : mine.length > 0 ? 1 : 0;
    conditions.push({
      id: "declarations",
      state: stateOf(code),
      by: "check:declaration-resolution",
      summary: `${mine.length} unresolved in this repository's own declaration(s); ${theirs.length} in mounted layers; ${r.instances.length} instance(s) read`,
      findings: [...mine.map((f) => `${f.instance} ${f.field} ${f.subject}: ${f.detail}`), ...r.undetermined.map((u) => `? ${u}`)],
      upstream: theirs.map((f) => `${f.instance} ${f.field} ${f.subject}: ${f.detail}`),
    });
  } catch (e) {
    conditions.push({ id: "declarations", state: "could-not-determine", by: "check:declaration-resolution", summary: firstLine(e), findings: [] });
  }

  // monorepo-paths
  conditions.push(monorepoPathsCondition(root, opts));

  // import-direction
  try {
    const r = importDirection(root);
    const all = r.findings.filter((f) => f.verdict === "wrong-direction");
    const wrong = all.filter((f) => own.has(f.fromInstance));
    const undetermined = r.undeclaredNeeds.some((n) => own.has(n)) || r.instances.length === 0;
    const line = (f: (typeof all)[number]): string => `${f.file}: ${f.fromInstance} → ${f.toInstance ?? "?"} (${f.specifier})`;
    conditions.push({
      id: "import-direction",
      state: wrong.length ? "fail" : undetermined ? "could-not-determine" : "pass",
      by: "check:import-direction",
      summary: `${wrong.length} wrong-direction import(s) in this repository's own instance(s); ${all.length - wrong.length} in mounted layers${r.undeclaredNeeds.length ? `; needs undeclared: ${r.undeclaredNeeds.join(", ")}` : ""}`,
      findings: wrong.map(line),
      upstream: all.filter((f) => !own.has(f.fromInstance)).map(line),
    });
  } catch (e) {
    conditions.push({ id: "import-direction", state: "could-not-determine", by: "check:import-direction", summary: firstLine(e), findings: [] });
  }

  // reference-direction
  try {
    const r = referenceDirection(root);
    const all = r.classified.filter((c) => c.verdict.verdict === "wrong-direction");
    const wrong = all.filter((c) => own.has(c.occurrence.from));
    const undetermined = r.undeclared.some((n) => own.has(n)) || r.instances === 0;
    const line = (c: (typeof all)[number]): string => `${relative(root, c.occurrence.file)}:${c.occurrence.line}: ${c.occurrence.from} names ${c.occurrence.to}`;
    conditions.push({
      id: "reference-direction",
      state: wrong.length ? "fail" : undetermined ? "could-not-determine" : "pass",
      by: "check:reference-direction",
      summary: `${wrong.length} wrong-direction reference(s) in this repository's own instance(s); ${all.length - wrong.length} in mounted layers`,
      findings: wrong.map(line),
      upstream: all.filter((c) => !own.has(c.occurrence.from)).map(line),
    });
  } catch (e) {
    conditions.push({ id: "reference-direction", state: "could-not-determine", by: "check:reference-direction", summary: firstLine(e), findings: [] });
  }

  // site
  if (!opts.site && instance !== undefined) {
    // An instance root (smart-ips-pilgrimage, the root declaring its own
    // instance) is not the platform index this condition was written for:
    // its own CI builds and publishes its site. Without `--site` the
    // condition is NOT APPLICABLE there rather than not-run, so the gate can
    // show complete on an instance's main (owner, Q-NA-1 B, 2026-11-08;
    // cat-harness-tools#1701). `--site` still builds and judges it, and the
    // index (whose root declares no instance) is still not-run without it.
    conditions.push({
      id: "site",
      state: "not-applicable",
      by: "build-instance-site --no-mount",
      summary: "not applicable here: an instance root builds its own site in its own CI; pass --site to build it anyway",
      findings: [],
    });
  } else if (!opts.site) {
    conditions.push({ id: "site", state: "not-run", by: "build-instance-site --no-mount", summary: "not run: pass --site (a full build, minutes)", findings: [] });
  } else if (instance === undefined) {
    conditions.push({ id: "site", state: "could-not-determine", by: "build-instance-site --no-mount", summary: "the checkout root declares no instance to build", findings: [] });
  } else {
    const g = runGate("build-instance-site.ts", ["--root", root, "--instance", instance, "--no-mount"], root);
    conditions.push({ id: "site", state: stateOf(g.status === 0 ? 0 : 1), by: "build-instance-site --no-mount", summary: g.status === 0 ? "built from the mounts alone, every link resolving" : `the build failed (exit ${g.status})`, findings: g.status === 0 ? [] : [g.tail] });
  }

  return { root, instance, own: [...own].sort(), conditions };
}

export function cutoverExitCode(r: CutoverReport): 0 | 1 | 2 {
  if (r.conditions.some((c) => c.state === "fail")) return 1;
  if (r.conditions.some((c) => c.state !== "pass" && c.state !== "not-applicable")) return 2;
  return 0;
}

export function formatCutover(r: CutoverReport): string {
  const mark: Record<ConditionState, string> = { pass: "✓", fail: "✗", "could-not-determine": "?", "not-run": "·", "not-applicable": "·" };
  const lines = [`separation:cutover:check — ${r.instance ?? "(no root instance)"} at ${r.root}; own instance(s): ${r.own.join(", ") || "none"}`];
  for (const c of r.conditions) {
    lines.push(`  ${mark[c.state]} ${c.id.padEnd(20)} ${c.state.padEnd(20)} ${c.summary}  [${c.by}]`);
    for (const f of c.findings.slice(0, 20)) lines.push(`      ${f.replace(/\n/g, "\n      ")}`);
    if (c.findings.length > 20) lines.push(`      … ${c.findings.length - 20} more`);
    if (c.upstream?.length) lines.push(`      (+ ${c.upstream.length} in mounted layers — upstream's to fix, not counted; --json lists them)`);
  }
  const code = cutoverExitCode(r);
  lines.push(code === 0 ? "CUTOVER COMPLETE — every applicable condition measured and passed" : code === 1 ? "CUTOVER INCOMPLETE — a condition failed" : "CUTOVER NOT SHOWN COMPLETE — a condition was not run or could not be determined. Not a pass.");
  return lines.join("\n");
}

function flag(argv: readonly string[], name: string): string | undefined {
  const at = argv.indexOf(name);
  if (at >= 0) return argv[at + 1];
  return argv.find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1);
}

function main(argv: readonly string[]): number {
  const rootArg = flag(argv, "--root");
  if (rootArg !== undefined && resolve(rootArg) !== resolve(process.cwd())) {
    // Re-run IN the checkout: the graph-typology registry reads the checkout
    // under inspection from cwd at import time (lesson 6).
    const rest: string[] = [];
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === "--root") { i++; continue; }
      if (argv[i]!.startsWith("--root=")) continue;
      rest.push(argv[i]!);
    }
    return spawnSync(process.execPath, [import.meta.path, ...rest], { cwd: resolve(rootArg), stdio: "inherit" }).status ?? 2;
  }
  const repository = flag(argv, "--monorepo");
  const dir = flag(argv, "--monorepo-dir");
  const monorepo: Monorepo = { repository: repository ?? DEFAULT_MONOREPO.repository, dir: dir ?? (repository ? repository.split("/").pop()! : DEFAULT_MONOREPO.dir) };
  const report = checkCutover(process.cwd(), { site: argv.includes("--site"), monorepo });
  if (argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
  else console.log(formatCutover(report));
  return cutoverExitCode(report);
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
