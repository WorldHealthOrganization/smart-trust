#!/usr/bin/env bun
/**
 * Regenerate everything adding a skill stales, and REFUSE a skill that arrived
 * without its declarations — one command, because a documented list is not
 * reachable at the moment of authoring.
 *
 * It also gates in CI (the obligation is refused, not merely documented),
 * reports **dangling** manifest entries, and strips **retired** front-matter
 * keys.
 *
 * ## The chain
 *
 * The writer and check pairs are `STEPS` in this file, ending with
 * `subgraph:jsonld`: a skill's body is published as a content-addressed
 * PAYLOAD (`docs/payload/sha256/<hex>`) that its subgraph index points at, so
 * editing a body moves the hash; it is LAST because it reads the graph the
 * steps above write into. Checks downstream of a step (`slice:sqlite:check`,
 * `check:ci-invocations`) are not steps of their own.
 *
 * A step is an ARGUMENT LIST of package script names — the scripts CI runs —
 * so a step can carry a flag and every name can be asserted against
 * `package.json` ({@link missingScripts}).
 *
 * No entry joins the chain without an isolated red-then-green run of its
 * check against a known tree. `bun run cat gates` cannot derive the chain:
 * `bun test` runs some writers, so a stale artefact is repaired before its
 * check reads it, and checks run in sequence perturb each other. Even an
 * isolated run is not proof, so {@link main} verifies at runtime instead of
 * trusting the list.
 *
 * ## Order
 *
 * One pass is not a fixed point: e.g. `kg:audit` writes sidecars,
 * `uml:overview` renders them into pages, and `auto:docs:check` goes stale
 * though `auto:docs` ran earlier. Every check runs after the writes and the
 * command exits non-zero while any is red, so a stale artefact is named rather
 * than shipped.
 *
 * ## Why it shells out instead of importing
 *
 * Every step runs as the package script CI runs, so the versions cannot drift
 * from what the gate set executes, and no generator writes files on import
 * (guarded by `declared-directory-resolves.test.ts`).
 *
 * ## Third state
 *
 * Exit 2 — never 0, never 1 — when the question could not be answered: no
 * package manifests found, or a chain step that is not a registered script.
 *
 * ## What it does not do
 *
 * It does not add the package-manifest entry. That is the author's assertion
 * that the file is a skill of that package, not a derivable fact.
 * `skill package manifests cover the package` fails loudly when it is missing,
 * and this script says so.
 *
 * It also does not prune a manifest entry whose file is gone. See
 * {@link dangling}.
 *
 * @module cat-harness/scripts/skill-register
 * @covers skills — the kind this gate JUDGES. It reads a skill's declarations:
 *   its manifest entry, its front matter, and whether the manifest points at
 *   anything absent. The derived `folio` reference pages and `qa` sidecars are
 *   judged by their own gates (`skills:docs:check`, `kg:audit:check`). The
 *   subject set is resolved from the layer's declarations via
 *   `kgDirectories`, never from a list written here
 * @covers cat-harness — retained, though in `cat-harness.json` the
 *   `cat-harness` kind is declared on the `schemas/` directories and this gate
 *   does not read a schema; an open question
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { corpusScopeFor, declaredKgDirectories, kgDirectories } from "./known-skills.js";
import { packageDirsIn } from "./skill-topics.js";
import { buildQaResult, writeQaResult } from "./qa-results.js";
import { scriptsOf } from "../schemas/sdlc/script-table.ts";
import { HARNESS_ROOT, REPO_ROOT, resolveWorkingInstanceRoot, runnerRootFor } from "./lib/roots.ts";
import { BUILDING_ENV } from "./qa-working-copy.ts";
import { exitNotApplicable } from "./lib/not-applicable.ts";
import { BUILD_TYPE_ENV, buildTypeOf } from "./lib/build-type.ts";

/**
 * The layer being worked on — `resolveWorkingInstanceRoot` in
 * `lib/roots.ts`: the harness in its own repository and in an index checkout,
 * the separated layer that MOUNTS it otherwise (bean `j3ls`: from a separated content layer
 * this audited the mount and wrote its sidecar into a gitignored tree).
 *
 * NOT `process.cwd()`, and that is a correction rather than a preference.
 * `writeQaResult` composes `<root>/test/results/`, so a cwd-relative root puts
 * the sidecar wherever the command happened to be invoked from — measured:
 * run from the repository root it landed in a fresh top-level `test/results/`,
 * a directory no layer declares and no sweep reads. Every sibling here
 * derives the root from its own module path for that reason
 * (`check-layout-norms.ts`, `check-harness-state.ts`), so the sidecar goes to
 * the same place whoever runs the command and from wherever.
 */
const INSTANCE_ROOT = resolveWorkingInstanceRoot().root;

/**
 * Where `bun run cat` resolves the steps' scripts: the checkout holding the
 * harness, not the layer's parent. Since bean `j3ls` the layer may be a
 * separated repository that MOUNTS the harness, whose parent is outside it.
 */
const RUNNER_ROOT = runnerRootFor(HARNESS_ROOT, REPO_ROOT);

/* ───────────────────────── the declarations, audited ───────────────────────── */

/** A package directory that declares which skills it holds. */
export interface SkillPackage {
  name: string;
  dir: string;
  manifest: string;
  /** Names the manifest lists. */
  listed: string[];
  /** Skill basenames actually present as `<name>.md`. */
  present: string[];
}

/**
 * The retired front-matter keys a registration may strip.
 *
 * Deliberately NOT a second copy of `RETIRED` in
 * `check-retired-front-matter.ts`: that registry is the authority on what is
 * retired and why, and it refuses an entry without a record to point at. This
 * is the subset a *registration* can act on mechanically, which today is the
 * one key that keeps coming back. A key retired for a graph typology this command
 * does not touch has no business here.
 */
const STRIPPABLE = ["roles", "package", "capability"] as const;

/**
 * Skill packages, found in the directories the INSTANCE_ROOT DECLARES.
 *
 * Not `join(instance, "skills")`. That literal is what
 * `check-declared-paths.ts` refuses, and rightly — `cat-harness.json` owns the
 * `skills` entry's path, ids are stable across a relocation while paths are
 * not (bean `iwtn` moved this very id), and a command that hardcodes it audits
 * the wrong tree the day somebody moves it.
 *
 * Asking the declaration also widens the subject correctly rather than by
 * accident: `kgDirectories` resolves a dependent layer's packages too
 * (the content core's and the IRIS replica's `skills/`
 * here), so a skill added in one of those is judged by the same gate instead of
 * being a case nobody thought of.
 *
 * A package is a directory holding `package-manifest.json`, which is the same
 * predicate `tests/skill-manifest-coverage.test.ts` uses — the test that fails
 * when this command has not been run.
 */
export function skillPackages(instance: string = INSTANCE_ROOT): SkillPackage[] {
  const out: SkillPackage[] = [];
  // The corpus on the platform's own run (placement PR0): what the mirrors
  // used to add — the FHIR IG harness's `skills/` packages among them — is asked of
  // the checkout now.
  for (const graph of kgDirectories(instance, corpusScopeFor(instance))) {
    for (const d of packageDirsIn(graph.absPath)) {
      const dir = d.dir;
      const manifest = join(dir, "package-manifest.json");
      if (!existsSync(manifest)) continue;
      const parsed = JSON.parse(readFileSync(manifest, "utf-8")) as { skills?: string[] };
      out.push({
        // Qualified by its graph, so two layers' packages of the same name
        // are two rows rather than one ambiguous finding.
        name: graph.id === "skills" ? d.name : `${graph.id}/${d.name}`,
        dir,
        manifest,
        listed: parsed.skills ?? [],
        present: readdirSync(dir)
          .filter((f) => f.endsWith(".md"))
          .map((f) => f.slice(0, -3)),
      });
    }
  }
  return out;
}

/** A skill present in its package and absent from the manifest. */
export interface Unlisted {
  pkg: string;
  skill: string;
  manifest: string;
}

export function unlisted(pkgs: SkillPackage[]): Unlisted[] {
  const out: Unlisted[] = [];
  for (const p of pkgs) {
    const have = new Set(p.listed);
    for (const s of p.present) {
      if (!have.has(s)) out.push({ pkg: p.name, skill: s, manifest: p.manifest });
    }
  }
  return out;
}

/** A manifest entry with no `<name>.md` behind it. */
export interface Dangling {
  pkg: string;
  skill: string;
  manifest: string;
}

/**
 * The inverse of {@link unlisted}, and this command REPORTS it rather than
 * fixing it.
 *
 * Found by falsification on 2026-09-26 rather than by design: registering a
 * probe skill and then deleting the file left an entry pointing at nothing, and
 * `kg:audit` raised `manifest-skill-exists` at severity **critical**.
 *
 * Pruning is deliberately NOT done. `KNOWN_DANGLING` in
 * `tests/skill-manifest-coverage.test.ts` is empty on purpose, with its own
 * note that an entry belongs there *"consciously, with the reason, instead of
 * the check being loosened"* — and a command that silently drops declarations
 * makes that decision for whoever renamed or removed the file, which is
 * `deletion-requires-confirmation` pointed at a declaration instead of a file.
 * Two remedies exist and only a person can choose: restore the skill, or remove
 * the entry knowing what referenced it.
 */
export function dangling(pkgs: SkillPackage[]): Dangling[] {
  const out: Dangling[] = [];
  for (const p of pkgs) {
    const have = new Set(p.present);
    for (const s of p.listed) {
      if (!have.has(s)) out.push({ pkg: p.name, skill: s, manifest: p.manifest });
    }
  }
  return out;
}

/** A skill file carrying a key that was retired. */
export interface RetiredKey {
  pkg: string;
  skill: string;
  key: string;
  file: string;
}

/**
 * Front-matter keys, read without a YAML parser.
 *
 * Only top-level `key:` lines inside the leading `---` fence, which is all a
 * retired-key question needs. A nested `roles:` under some other key is a
 * different field with the same seven letters — the distinction
 * `check-retired-front-matter.ts` makes with `exceptSchemas`, and the reason
 * this does not simply grep the file.
 */
export function frontMatterKeys(src: string): string[] {
  if (!src.startsWith("---\n")) return [];
  const end = src.indexOf("\n---", 3);
  if (end === -1) return [];
  return src
    .slice(4, end)
    .split("\n")
    .filter((l) => /^[A-Za-z_][\w-]*\s*:/.test(l))
    .map((l) => l.slice(0, l.indexOf(":")).trim());
}

export function retiredKeys(pkgs: SkillPackage[]): RetiredKey[] {
  const out: RetiredKey[] = [];
  for (const p of pkgs) {
    for (const s of p.present) {
      const file = join(p.dir, `${s}.md`);
      const keys = frontMatterKeys(readFileSync(file, "utf-8"));
      for (const k of STRIPPABLE) {
        if (keys.includes(k)) out.push({ pkg: p.name, skill: s, key: k, file });
      }
    }
  }
  return out;
}

/** Remove a top-level front-matter key's line(s). */
export function withoutKey(src: string, key: string): string {
  if (!src.startsWith("---\n")) return src;
  const end = src.indexOf("\n---", 3);
  if (end === -1) return src;
  const head = src.slice(4, end).split("\n");
  const kept: string[] = [];
  let dropping = false;
  for (const line of head) {
    if (new RegExp(`^${key}\\s*:`).test(line)) {
      dropping = true;
      continue;
    }
    // A dropped key's continuation lines are indented; the next top-level key
    // ends the drop. Without this a block value would leave orphaned lines that
    // parse as something else.
    if (dropping && /^\s+\S/.test(line)) continue;
    dropping = false;
    kept.push(line);
  }
  return `---\n${kept.join("\n")}${src.slice(end)}`;
}

/** What a registration would report, without changing anything. */
export interface Findings {
  /** Reported, never repaired — the manifest entry is the author's assertion. */
  unlisted: Unlisted[];
  /** Repaired by {@link stripRetired}. */
  retired: RetiredKey[];
  /** Reported, never repaired — see {@link dangling}. */
  dangling: Dangling[];
  packages: number;
  skills: number;
}

/**
 * Why there is nothing for this command to judge in `instance`, or `undefined`
 * when there is.
 *
 * A layer that declares no `skills` directory holds no skill, so no
 * skill of it can be unregistered and nothing the chain regenerates is staled
 * by one. Since bean `j3ls` the layer judged is the one MOUNTING the harness
 * (a content layer's own index, such as a FHIR IG's), and most of those
 * declare no skills graph: before this they read as exit 2, "cannot tell",
 * which is a question with no answer rather than one nobody could reach.
 *
 * Deliberately narrow, so `dh4f` stays shut: it is the DECLARATION that is
 * asked, not the disk. A layer that declares a `skills` directory and has
 * no package manifests in it is still the third state. Any OTHER
 * knowledge-graph directory (`scenarios`, which an IG declares for the actors
 * its journeys name) holds no skill package, so it does not make the layer
 * applicable.
 */
export function notApplicable(instance: string = INSTANCE_ROOT): string | undefined {
  // A `skills` directory, not any knowledge-graph one: an IG that declares
  // only `scenarios` (the actors its journeys name) holds no skill package,
  // and judging it ended in "no package manifests found".
  const dirs = declaredKgDirectories(instance, corpusScopeFor(instance));
  if (dirs.some((d) => (d.graphTypologies ?? []).includes("skills"))) return undefined;
  return `${instance} declares no \`skills\` directory, so it holds no skill to register`;
}

export function audit(instance: string = INSTANCE_ROOT): Findings {
  const pkgs = skillPackages(instance);
  return {
    unlisted: unlisted(pkgs),
    retired: retiredKeys(pkgs),
    dangling: dangling(pkgs),
    packages: pkgs.length,
    skills: pkgs.reduce((n, p) => n + p.present.length, 0),
  };
}

/**
 * Strip retired front-matter keys. Returns the files written.
 *
 * The one repair this command performs, and it is safe to perform for the same
 * reason the manifest entry is not: a retired key carries no information. It was
 * read by nothing and pointed at actor ids that never existed in any commit, so
 * there is no author intent to guess at.
 */
export function stripRetired(instance: string = INSTANCE_ROOT): string[] {
  const written: string[] = [];
  for (const r of audit(instance).retired) {
    writeFileSync(r.file, withoutKey(readFileSync(r.file, "utf-8"), r.key));
    written.push(r.file);
  }
  return written;
}

/* ──────────────────────────── the generator chain ──────────────────────────── */

/** One regeneration step: the writer, and the check that proves it landed. */
export interface Step {
  /** What to run, as `bun run` arguments. One script name, for the reasons above. */
  readonly write: readonly string[];
  /** The same question asked rather than written — the repo-wide `--check` convention. */
  readonly verify: readonly string[];
  /** Why this is in the chain, so a reader can re-derive rather than trust. */
  readonly because: string;
  /**
   * The writer draws the QA working copy (`requireCurrentWorkingCopy`), so it
   * does not run INSIDE a build of that copy — see {@link stepsToRun}.
   */
  readonly readsQaCopy?: true;
  /**
   * `derive:publish` runs this writer itself, after `uml:overview`, so in a
   * PREVIEW's build of the QA working copy it is not run here as well (owner
   * card Q-CONE-2 B, 2026-11-01: "no double builds"). See {@link stepsToRun}.
   *
   * Only a writer whose outputs NO later step of the QA working copy reads may
   * carry it, or a preview's QA would judge main's stale copy of them. Traced
   * 2026-11-01 over the 15 `qa:refresh` steps after `skill:register`: nothing
   * opens what `skills:docs` or `lsi:viz` write, while `auto-docs.json` (a
   * declaration file the graph walk reads), `docs/subgraph/`, `docs/payload/`
   * and the glossary's SKOS files are read by `kg:export`, `audit:coverage`,
   * `check:reference-direction` and eight more. So `auto:docs`,
   * `subgraph:jsonld` and `glossary:page` still run here.
   */
  readonly builtAtPublish?: true;
}

/**
 * The chain. Hand-declared, because no file states which artefacts a skill
 * feeds — but every entry was measured red-then-green in isolation, and
 * {@link main} re-proves sufficiency at runtime rather than asserting it.
 *
 * **`check:glossary` is not a typo for `glossary:check`.** They are different
 * programs: `check:glossary` is `glossary-page.ts --check`, the checker for what
 * `glossary:page` writes, while `glossary:check` is `glossary-export.ts --check`
 * over the SKOS projection. `nfv3`'s version paired `glossary:page` with
 * `glossary:check` — a writer against an unrelated check — and the reason is
 * worth recording: its test asserted *every check ends in `:check`*, a naming
 * convention this repository does not hold, and that assertion drove out the
 * correct pairing. A convention test can enforce a defect.
 */
export const STEPS: readonly Step[] = [
  {
    write: ["skill:commands"],
    verify: ["skill:commands:check"],
    because: "a skill declaring `user_invocable: true` owes a slash command (bean `j6t3`)",
  },
  {
    write: ["skills:docs"],
    builtAtPublish: true,
    verify: ["skills:docs:check"],
    because: "the skill's published reference page",
  },
  {
    write: ["glossary:page"],
    verify: ["check:glossary"],
    because: "the glossary page and its SKOS projection",
  },
  {
    write: ["auto:docs"],
    verify: ["auto:docs:check"],
    because: "the generated docs index",
  },
  {
    write: ["lsi:skills"],
    verify: ["lsi:skills:check"],
    because: "the skills graph's LSI index — a new or edited skill changes its fingerprint, and the run record it writes is what kg:audit's `tool-downstream-fresh` reads next",
  },
  {
    write: ["lsi:viz"],
    builtAtPublish: true,
    verify: ["lsi:viz:check"],
    because:
      "the LSI index's VIEWER PAGE, which `lsi:skills` above stales and nothing here regenerated until 2026-09-30. Measured: adding one skill left `cat-harness/docs/lsi/index.md` stale while this chain reported \"8 artefact(s) current\" — so the claim to be at a fixed point was false in exactly the way this chain exists to prevent, and it reddened `main` through `lsi:viz:check` in the Repository-gates job. The index and its page are two artefacts, and a chain that writes one and verifies only the other is a chain with a hole in it. " +
      "Since bean `tqjj` (2026-10-04) that measurement is the ARGUMENT RATHER THAN THE SYMPTOM, and the repair was to the PAGE rather than to this chain: the half of it that one skill edit moved — each index's size, retained share, dimension poles and findings — is no longer committed, and the docs-site build adds it with `--detail`. What `lsi:viz` writes and this step verifies is now a function of the TREE alone, so one pass settles it instead of chasing whatever was published last",
  },
  {
    write: ["kg:audit"],
    verify: ["kg:audit:check"],
    because: "the skill's kg-qa sidecar — masked inside `gates` by `bun test`",
  },
  {
    write: ["kg:detangle"],
    verify: ["kg:detangle:check"],
    because: "the skills subgraph gains a node, so its detangle sidecar moves",
  },
  {
    write: ["uml:overview"],
    verify: ["uml:overview:check"],
    because: "the UML overview renders the QA tree the two steps above just wrote",
    readsQaCopy: true,
  },
  {
    write: ["subgraph:jsonld"],
    verify: ["subgraph:jsonld:check"],
    because:
      "a skill's BODY is a content-addressed payload its subgraph index points at, so editing it moves the hash " +
      "(#2139 went red on exactly this); `slice:sqlite:check` reads the same payload tree and follows from this write",
  },
];

/**
 * The writers, in order. Derived from {@link STEPS} so there is one list.
 *
 * Joined to a string per step, which keeps the public shape a `string[]` across
 * `v625`'s move to argument lists — and keeps the tests' comparisons MEANINGFUL.
 * `s.verify !== s.write` on two arrays compares references and is true of every
 * conceivable pair, so an assertion written against the old shape would have
 * gone vacuous rather than red. A test that cannot fail is bean `1xhc` inside
 * the test suite.
 */
export const CHAIN: readonly string[] = STEPS.map((s) => s.write.join(" "));

/** The checks that decide convergence. Derived from {@link STEPS}. */
export const CHECKS: readonly string[] = STEPS.map((s) => s.verify.join(" "));

/**
 * The steps this run performs, and the ones it defers because a build of the
 * QA working copy is in progress ({@link BUILDING_ENV} set by
 * `qa-working-copy.ts` and `qa:refresh` for their own steps).
 *
 * Measured 2026-10-15 in a `derive:publish`: the process chain ran
 * `uml:overview` → (its working copy was stale) `qa:refresh` → its
 * `skill:register` writer → `uml:overview`, and `uml:overview:check`
 * (`publish-check.ts uml:overview`, which RUNS its writer) → `uml:overview`.
 * A writer was run from inside the build of its own input, twice, drawing a
 * QA tree half of whose writers had not run yet; only the env guard in
 * `requireCurrentWorkingCopy` kept the cycle from recursing further. Every
 * step that reads the copy is the build's CONSUMER, never one of its steps:
 * whoever asked for the build (the generator, `regen`, the gates job) draws
 * from the finished copy after it. So inside a build such a step is neither
 * written nor verified here, and is reported as not run.
 */
export function stepsToRun(
  steps: readonly Step[] = STEPS,
  // input-site: env QA_WORKING_COPY_BUILDING,CAT_BUILD_TYPE #949cc29c — whether this run is part of a QA working-copy build, and of which build type (buildTypeOf): both decide which steps run here
  env: Readonly<Record<string, string | undefined>> = process.env,
): { run: Step[]; deferred: Step[] } {
  if (env[BUILDING_ENV] !== "1") return { run: [...steps], deferred: [] };
  const later = (s: Step) => s.readsQaCopy === true || (s.builtAtPublish === true && previewBuild(env));
  return { run: steps.filter((s) => !later(s)), deferred: steps.filter(later) };
}

/** Whether this is a PREVIEW build (`lib/build-type.ts`); anything else, or a refused value, is not. */
function previewBuild(env: Readonly<Record<string, string | undefined>>): boolean {
  const bt = buildTypeOf(env);
  return "type" in bt && bt.type === "preview";
}

/** Why a deferred step is not run here. */
export function deferredWhy(s: Step): string {
  return s.readsQaCopy
    ? `it reads the QA working copy this run is part of building; ${BUILDING_ENV}=1`
    : `a preview's derive:publish runs ${s.write.join(" ")} after this build; ${BUILD_TYPE_ENV}=preview`;
}

/**
 * The environment variable a CI workflow sets to the check scripts its OWN
 * gates will run over this same tree (comma-separated), so a writing run here
 * does not ask them a second time. Owner, 2026-10-23 (option A): in a layer
 * PR's `derive:publish`, `uml:overview` builds the QA working copy, whose
 * `skill:register` step re-ran nine checks (~190 s measured) that the PR's
 * gate shards run anyway.
 */
export const VERIFIED_BY_GATES_ENV = "CAT_SKILL_REGISTER_VERIFIED_BY_GATES";

/**
 * Of the steps this run performs, the ones it verifies and the ones whose
 * verify it leaves to the run's gates ({@link VERIFIED_BY_GATES_ENV}). Leaves
 * nothing to the gates unless ALL hold: this is the writing path (never
 * `--check`, whose verifies ARE the gate), `CI` is set and true, and the step's
 * verify is one script that the variable names. Locally every step is
 * verified, as before. A step left to the gates is reported `ran: false`,
 * never as current.
 */
export function verifyHere(
  steps: readonly Step[],
  checking: boolean,
  // input-site: env CI,CAT_SKILL_REGISTER_VERIFIED_BY_GATES #949cc29c — in CI, the steps the gates job verifies itself are left to it
  env: Readonly<Record<string, string | undefined>> = process.env,
): { verify: Step[]; byGates: Step[] } {
  const ci = (env.CI ?? "").trim().toLowerCase();
  const inCi = ci !== "" && ci !== "0" && ci !== "false";
  const named = new Set((env[VERIFIED_BY_GATES_ENV] ?? "").split(",").map((x) => x.trim()).filter(Boolean));
  if (checking || !inCi || named.size === 0) return { verify: [...steps], byGates: [] };
  const left = (s: Step) => s.verify.length === 1 && named.has(s.verify[0]!);
  return { verify: steps.filter((s) => !left(s)), byGates: steps.filter(left) };
}

/** Scripts named here that `package.json` does not declare. */
export function missingScripts(runner: string = RUNNER_ROOT): string[] {
  // A step's first argument is what `bun run` resolves; anything after it is a
  // flag. Only names are asserted against `package.json` — a step given as a
  // path (`v625`'s original shape, and still legal) is checked as a FILE, since
  // asking `package.json` about it would report every path as missing and turn
  // the third state below into a permanent exit 2.
  const heads = STEPS.flatMap((s) => [s.write[0]!, s.verify[0]!]);
  const paths = heads.filter((h) => h.includes("/") || h.endsWith(".ts"));
  const named = heads.filter((h) => !paths.includes(h));
  const absentPaths = paths.filter((p) => !existsSync(resolve(runner, p)));
  const pkgPath = join(resolve(runner), "package.json");
  if (!existsSync(pkgPath)) return [...named, ...absentPaths];
  const scripts = scriptsOf(resolve(runner));
  return [...named.filter((s) => !(s in scripts)), ...absentPaths];
}

/* ────────────────────────────────── the command ────────────────────────────── */

/**
 * Run one step. `spawnSync` with inherited stdio, so a generator's own output
 * reaches the reader rather than being swallowed and summarised.
 *
 * It shells out instead of importing for the reason in §"Why it shells out":
 * an imported generator is free to drift from the one CI executes, and
 * `declared-directory-resolves.test.ts` guards a real defect where importing a
 * generator WROTE files.
 */
function run(args: readonly string[]): number {
  // input-site: scripts skill:commands:check,skills:docs:check,check:glossary,auto:docs:check,lsi:skills:check,lsi:viz:check,kg:audit:check,kg:detangle:check,uml:overview:check,subgraph:jsonld:check #6eb27c09 — the verify half of every STEP (the write half runs only without --check, in the main block's write mode); input-sites.test.ts holds this list to STEPS
  const r = spawnSync("bun", ["run", "cat", ...args], {
    stdio: "inherit",
    cwd: RUNNER_ROOT,
  });
  return r.status ?? 1;
}

/**
 * Run one VERIFY step quietly, without blocking — the verification pass starts
 * all of them at once.
 *
 * Every step it is given is a `--check` (or `check`) command that writes
 * nothing, so they share only the cores. Serially they were 29 s of the
 * Repository gates job, measured 2026-10-03 (bean `fmdl`). Verdicts are still
 * printed in `STEPS` order, so the report reads the same whichever finished
 * first. Generating steps stay on {@link run}: those write, and their order is
 * the chain.
 */
async function verifyQuietly(args: readonly string[]): Promise<number> {
  // input-site: scripts skill:commands:check,skills:docs:check,check:glossary,auto:docs:check,lsi:skills:check,lsi:viz:check,kg:audit:check,kg:detangle:check,uml:overview:check,subgraph:jsonld:check #2261f276 — the verify half of every STEP; input-sites.test.ts holds this list to STEPS
  const p = Bun.spawn(["bun", "run", "cat", ...args], {
    cwd: RUNNER_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });
  // Drained so a chatty check cannot fill the pipe and stall.
  await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
  return (await p.exited) ?? 1;
}

/**
 * The flags, and why each exists rather than being inferred.
 *
 * `--check` predates the others: verify without writing. The rest were added
 * on the owner's instruction (2026-09-26) alongside the QA report and the gate,
 * because a command that only ever streams to a terminal cannot be read by CI,
 * by a sibling session, or by a person asking *"was this ever checked?"*.
 */
export interface Flags {
  /** Verify only — regenerate nothing and write no sidecar (bean `bo44`). What CI runs. */
  check: boolean;
  /** Print the chain and exit 0. Writes nothing, verifies nothing. */
  dryRun: boolean;
  /** Emit the report as JSON on stdout instead of prose. Implies no colour, no prompts. */
  json: boolean;
  /** Skip the committed QA sidecar. For a scratch tree that must not be dirtied. */
  noReport: boolean;
  /**
   * With `--check` only: judge the DECLARATIONS and the third states, and run
   * none of the chain's checks (bean `8qyc`).
   *
   * For `regen`, which asks every one of {@link CHECKS} as a pair of its own:
   * re-running them here doubled the most expensive part of the run (107 s of
   * 637 s, measured 2026-10-05). `regen` derives this gate's verdict as this
   * residual AND those pairs' verdicts on the same tree — the same programs,
   * spelt the same way, so the conjunction is the gate's answer. It is never
   * what CI runs: CI runs the whole `--check`.
   */
  declarationsOnly: boolean;
}

/**
 * Does a VERIFYING run write the committed QA sidecar?
 *
 * Never under `--check` (bean `bo44`): the gate form judges and writes
 * nothing, and measured 2026-10-01 it was rewriting
 * `test/results/skill-register.qa-results.json` whenever that differed — the
 * gate CI runs was a writer of the record it reports into. `--no-report` keeps
 * its meaning for the writing path. (`--dry-run` decides separately, above
 * the verify.)
 */
export function writesReport(flags: Flags): boolean {
  return !flags.noReport && !flags.check;
}

export function parseFlags(argv: readonly string[]): Flags {
  return {
    check: argv.includes("--check"),
    dryRun: argv.includes("--dry-run"),
    json: argv.includes("--json"),
    noReport: argv.includes("--no-report"),
    declarationsOnly: argv.includes("--declarations-only"),
  };
}

/** One step's verdict, as the report and the JSON both carry it. */
export interface StepVerdict {
  /** The `--check` invocation, exactly as run. */
  verify: string;
  /** What staling it means for a reader — the step's own `because`. */
  because: string;
  /**
   * Was the check RUN at all? Emitted on every step, never left to absence.
   *
   * `--dry-run` produces `ran: false`, and a reader must be able to tell that
   * from a clean verify. An absent `current` would have carried that fact
   * implicitly, which is the rule this repository states on `hasInstructions`
   * in `kg-export`: absence must not be the carrier of a fact.
   */
  ran: boolean;
  /** `true` only when the check exited 0. Absent iff `ran` is false. */
  current?: boolean;
}

/** One declaration finding, as the sidecar carries it. */
export interface DeclarationVerdict {
  /** `undeclared` | `retired-key` | `dangling` — which of the three audits fired. */
  finding: string;
  /** `<package>/<skill>`, qualified by graph where the graph is not `skills`. */
  subject: string;
  /** What a reader must do, and who must do it. */
  remedy: string;
}

/**
 * Write the run's verdicts as a committed `qa-results/v1` sidecar.
 *
 * **Why a file and not just the console.** The checks in this chain are the only
 * ones nothing else verifies UNMASKED — `bun test` runs the `kg-audit` and
 * `detangle` writers, so by the time `gates` reaches their checks the artefacts
 * are already repaired (bean `ymsu`). A printed verdict is gone the moment the
 * terminal scrolls, which makes *"never verified"* and *"verified clean"* the
 * same observation. That is the exact confusion this repository builds sidecars
 * to prevent.
 *
 * `ran: false` on every step is therefore a REAL state and not a placeholder:
 * it says the chain was listed and not run (`--dry-run`). It is emitted rather
 * than implied, because absence must not be the carrier of a fact.
 *
 * **Two families, because this command answers two questions.** `v625` recorded
 * the chain; the consolidation added the DECLARATION audit, and a sidecar that
 * carried only the chain would report a clean run over a skill registered
 * nowhere. An empty `declarations` family is a real verdict — audited, nothing
 * found — which is why it is written rather than omitted when empty.
 */
export function writeReport(
  root: string,
  verdicts: readonly StepVerdict[],
  declarations: readonly DeclarationVerdict[],
): string {
  return writeQaResult(
    root,
    "skill-register",
    buildQaResult({
      script: "cat-harness-tools/scripts/skill-register.ts",
      scriptAbsPath: fileURLToPath(import.meta.url),
      subject: { kind: "corpus", id: "skill-registration-chain" },
      families: {
        "registration-chain": {
          summary:
            "Each artefact that adding a skill stales, with the verdict of its own `--check` run " +
            "INDIVIDUALLY rather than through `bun run cat gates`. The distinction is the point: " +
            "`bun test` runs the kg-audit and detangle writers, so a gates run repairs two of " +
            "these before their checks read them and reports as current what is not (bean `ymsu`). " +
            "`ran: false` means the step was listed but not run — what `--dry-run` produces — and is " +
            "not a pass. It is emitted on every entry so that absence never carries that fact.",
          entries: verdicts as unknown[],
        },
        declarations: {
          summary:
            "Skills whose DECLARATIONS are wrong: present in no package manifest, carrying a " +
            "retired front-matter key, or listed in a manifest with no file. Empty means audited " +
            "and clean, not unaudited — the chain family above records whether the run happened. " +
            "Only the retired key is repaired; the other two are the author's assertion to make " +
            "and this command reports them rather than guessing.",
          entries: declarations as unknown[],
        },
      },
    }),
  );
}

const FIX_UNLISTED =
  "  Add the slug to its `package-manifest.json` `skills` list, sorted. This\n" +
  "  command deliberately will not: which package a file belongs to is your\n" +
  "  assertion, not a derivable fact, and a command that guessed it would\n" +
  "  register files somebody was still drafting.\n";

const HELP =
  `skill-register — regenerate everything adding a skill stales, and refuse a\n` +
  `skill that arrived without its declarations (beans \`v625\`, \`nfv3\`).\n\n` +
  `  bun run cat skill:register              regenerate, then verify\n` +
  `  bun run cat skill:register --check      verify only, write nothing (not even the QA sidecar) — what CI runs\n` +
  `  bun run cat skill:register --dry-run    print the chain; write and verify nothing\n` +
  `  bun run cat skill:register --json       emit the verdicts as JSON\n` +
  `  bun run cat skill:register --no-report  skip the committed QA sidecar\n` +
  `  bun run cat skill:register --check --declarations-only\n` +
  `                                      the declarations only, none of the chain's checks — for regen,\n` +
  `                                      which asks each of those as a pair of its own. Not a gate.\n\n` +
  `It deliberately does NOT add a package-manifest entry: which package a\n` +
  `file belongs to is your assertion, not a derivable fact.\n\n` +
  `Exit 2 is a THIRD STATE, never a pass and never a finding: no package\n` +
  `manifests found, or a chain step naming a script that is not registered.\n`;

/** The audit's findings, flattened for the sidecar. */
function declarationVerdicts(f: Findings): DeclarationVerdict[] {
  return [
    ...f.unlisted.map((u) => ({
      finding: "undeclared",
      subject: `${u.pkg}/${u.skill}`,
      remedy: "add the slug to its package-manifest.json — the author's assertion, not derivable",
    })),
    ...f.retired.map((r) => ({
      finding: "retired-key",
      subject: `${r.pkg}/${r.skill}`,
      remedy: `strip the retired \`${r.key}\` key — this command repairs it on the writing path`,
    })),
    ...f.dangling.map((d) => ({
      finding: "dangling",
      subject: `${d.pkg}/${d.skill}`,
      remedy:
        "restore the skill or remove the manifest entry — a deletion, so a person's decision",
    })),
  ];
}

async function main(): Promise<number> {
  const flags = parseFlags(process.argv);
  const checking = flags.check;
  // Inside a build of the QA working copy, the steps that read it are deferred to its consumer.
  const { run: active, deferred } = stepsToRun();

  if (process.argv.includes("--help")) {
    console.log(HELP);
    return 0;
  }

  if (flags.declarationsOnly && (!checking || flags.dryRun || flags.json)) {
    // Refused rather than ignored: without `--check` the flag would silently
    // run the WRITER, and a residual that wrote would not be a residual.
    console.error("skill-register: --declarations-only is a --check form; it takes no --dry-run or --json.");
    return 2;
  }

  const na = notApplicable();
  if (na !== undefined) {
    // Not a pass and not a finding: nothing here is of the kind judged. Says
    // so and writes nothing (no sidecar: there is no subject to record a
    // verdict about). Exits 78, not 0 (cat-harness-tools#1701): `qa:refresh`
    // read the silent 0 as a writer that "produced nothing" and failed the QA
    // working copy in an IG repository that is its own index; 78 is the
    // convention every runner reads as not applicable, and no gate turns red
    // over it (`lib/not-applicable.ts`).
    if (flags.json) console.log(JSON.stringify({ notApplicable: na }, null, 2));
    exitNotApplicable("skill-register", na);
  }

  const f = audit();

  // Third state, all three directions. A run that found no packages, an empty
  // chain, or a chain naming a script nothing registered has cleared nothing —
  // and reporting any of them as clean is bean `dh4f`.
  if (f.packages === 0) {
    console.error(
      "skill-register: no package manifests found — cannot tell registered from unregistered.",
    );
    return 2;
  }
  // The vacuity guard `gates.ts` argues for: a runner that executes an empty
  // list exits 0 and reads as a clean sweep. An empty chain is a defect in
  // this file, never a tree that needs nothing.
  if (STEPS.length === 0) {
    console.error("skill-register: the chain is empty — that is a bug here, not a clean tree.");
    return 2;
  }
  const absent = missingScripts();
  if (absent.length > 0) {
    console.error(`skill-register: this chain names ${absent.length} unresolvable step(s):`);
    for (const s of absent) console.error(`    ${s}`);
    return 2;
  }

  if (flags.dryRun) {
    // Listed, not run. The report records `ran: false` for each, which is a
    // third state rather than a pass — see {@link writeReport}.
    const listed: StepVerdict[] = STEPS.map((st) => ({
      verify: st.verify.join(" "),
      because: st.because,
      ran: false,
    }));
    if (flags.json) console.log(JSON.stringify({ dryRun: true, steps: listed }, null, 2));
    else {
      console.log(`\nWould regenerate ${STEPS.length} artefact(s), then verify each:\n`);
      for (const st of listed) console.log(`  ${st.verify}\n      (${st.because})`);
      console.log("");
    }
    if (!flags.noReport) writeReport(INSTANCE_ROOT, listed, declarationVerdicts(f));
    return 0;
  }

  /*
   * The declaration audit runs in BOTH modes, and under `--check` it no longer
   * short-circuits the chain.
   *
   * `nfv3`'s version returned as soon as it had a declaration finding, so the
   * six checks never ran and the gate reported ONE of the two things it exists
   * to judge. Whoever fixed the manifest entry then got the staleness on their
   * next run instead of this one. Both halves are reported, then one exit
   * decision is taken over both.
   */
  const problems = f.unlisted.length + f.retired.length + f.dangling.length;
  if (checking) {
    for (const u of f.unlisted) console.log(`✗ ${u.pkg}/${u.skill}.md is in no package manifest`);
    for (const r of f.retired) {
      console.log(`✗ ${r.pkg}/${r.skill}.md carries the retired key \`${r.key}\``);
    }
    for (const d of f.dangling) {
      console.log(
        `✗ ${d.pkg}/package-manifest.json lists \`${d.skill}\`, which has no ${d.skill}.md ` +
          "— restore the skill, or remove the entry (this command will not)",
      );
    }
    if (problems === 0) {
      console.log(
        `✓ ${f.skills} skill(s) across ${f.packages} package(s): every one declared, ` +
          "none carrying a retired key, nothing dangling",
      );
    }
  } else {
    const stripped = stripRetired();
    for (const s of stripped) {
      console.log(`  stripped a retired key from  ${s.replace(`${RUNNER_ROOT}/`, "")}`);
    }

    // Said on the performing path too. An author running this to fix one thing
    // should not have a critical finding left silently behind them — and neither
    // of these is this command's to repair.
    for (const u of f.unlisted) {
      console.log(`  NOT DECLARED  ${u.pkg}/${u.skill}.md is in no package manifest — yours to add`);
    }
    for (const d of f.dangling) {
      console.log(
        `  NOT TOUCHED  ${d.pkg}/package-manifest.json lists \`${d.skill}\` with no file ` +
          "— yours to resolve; `kg:audit` calls this critical",
      );
    }

    console.log(`\nRegenerating ${active.length} artefact(s) that adding a skill stales.\n`);
    for (const s of active) {
      console.log(`── ${s.write.join(" ")}   (${s.because})`);
      const rc = run(s.write);
      if (rc !== 0) {
        console.error(`\nskill-register: \`${s.write.join(" ")}\` exited ${rc}. Stopping.`);
        return rc;
      }
    }
  }

  if (flags.declarationsOnly) {
    // The residual: everything above, none of the chain's checks. Its caller
    // owns asking those (see {@link Flags.declarationsOnly}).
    console.log(`  (--declarations-only: the ${STEPS.length} chain check(s) were NOT run; the caller asks them)`);
    return problems > 0 ? 1 : 0;
  }

  // Verification is the point. The list above is hand-maintained and so can
  // UNDER-declare; this cannot make the command claim success falsely, because
  // what it reports is the checks' own verdicts rather than "I ran six things".
  if (!flags.json) console.log(`\nVerifying — each check run on its own, never through \`gates\`:\n`);
  const red: string[] = [];
  const verdicts: StepVerdict[] = [];
  // A check that WRITES is not safe beside the others. Since B1 (owner,
  // 2026-10-14) several of these are `publish-check.ts <writer>`: each runs its
  // writer and then compares, and run concurrently they overwrite one another's
  // pages mid-comparison, so every such check read red here while each passed
  // alone (folio-assistant#2529). The read-only ones still share the cores; the
  // writing ones run after them, one at a time, in STEPS order.
  const table = scriptsOf(RUNNER_ROOT);
  const writes = (s: Step): boolean => /publish-check\.ts/.test(table[s.verify[0]!] ?? "");
  // In CI, the checks the run's own gates ask over this tree are left to them.
  const { verify: asked, byGates } = verifyHere(active, checking);
  const codes: number[] = new Array(asked.length);
  await Promise.all(asked.map(async (s, i) => (writes(s) ? undefined : (codes[i] = await verifyQuietly(s.verify)))));
  for (const [i, s] of asked.entries()) if (writes(s)) codes[i] = await verifyQuietly(s.verify);
  for (const s of deferred) {
    // Listed, not run: `ran: false`, never a pass (see {@link writeReport}).
    verdicts.push({ verify: s.verify.join(" "), because: s.because, ran: false });
    if (!flags.json) console.log(`  – ${s.verify.join(" ")}  (not run: ${deferredWhy(s)})`);
  }
  for (const s of byGates) {
    // Listed, not run here: this CI run's gates ask it over the same tree.
    verdicts.push({ verify: s.verify.join(" "), because: s.because, ran: false });
    if (!flags.json) console.log(`  – ${s.verify.join(" ")}  (not run here: this CI run's gates ask it; ${VERIFIED_BY_GATES_ENV})`);
  }
  for (const [i, s] of asked.entries()) {
    const rc = codes[i]!;
    verdicts.push({ verify: s.verify.join(" "), because: s.because, ran: true, current: rc === 0 });
    if (!flags.json) console.log(`${rc === 0 ? "  ✓" : "  ✗"} ${s.verify.join(" ")}`);
    if (rc !== 0) red.push(s.verify.join(" "));
  }

  // Written BEFORE the exit branches, so a red run is recorded rather than only
  // printed. A sidecar that exists only on success cannot distinguish "clean"
  // from "never ran".
  //
  // NOT under `--check` (bean `bo44`). The gate form judges and writes nothing:
  // measured 2026-10-01, `skill:register:check` rewrote
  // `test/results/skill-register.qa-results.json` whenever it differed, so the
  // gate CI runs was also a writer of the record it reports into. The record is
  // the author's command's to write (`bun run cat skill:register`); the gate's
  // verdict is its exit code.
  const reportAt = writesReport(flags)
    ? writeReport(INSTANCE_ROOT, verdicts, declarationVerdicts(f))
    : undefined;
  if (flags.json) {
    console.log(
      JSON.stringify(
        { checking, red, problems, steps: verdicts, declarations: declarationVerdicts(f), report: reportAt },
        null,
        2,
      ),
    );
    return red.length > 0 || problems > 0 ? 1 : 0;
  }
  if (reportAt !== undefined) console.log(`\n  report → ${reportAt}`);

  if (problems > 0) {
    console.error(
      `\n✗ ${problems} skill declaration problem(s) across ${f.packages} package(s) ` +
        `(${f.unlisted.length} undeclared, ${f.retired.length} retired key(s), ` +
        `${f.dangling.length} dangling).\n` +
        (f.unlisted.length > 0 ? `\n${FIX_UNLISTED}` : "") +
        "\n  Adding a skill is never a one-file change. Seven merges between\n" +
        "  2026-09-24 and 2026-09-26 each broke the gate set this way, and each was\n" +
        "  repaired by whoever opened the next PR rather than by its author, because\n" +
        "  CI judges the MERGE of every open head into the base.\n" +
        "  A retired key is not a judgement call: see the record\n" +
        "  `check-retired-front-matter.ts` points at before re-adding one.\n",
    );
  }

  if (red.length > 0) {
    console.error(formatChainRedDiagnostic(checking, red));
  }

  if (red.length > 0 || problems > 0) return 1;

  // Never "current" for a step left to the gates (bean `dh4f`).
  console.log(
    byGates.length === 0
      ? `\n✓ ${STEPS.length} artefact(s) current, ${f.skills} skill(s) across ${f.packages} ` +
          `package(s) declared. Commit them with the skill.\n`
      : `\n✓ ${asked.length} artefact(s) verified current here, ${byGates.length} left to this CI run's gates; ` +
          `${f.skills} skill(s) across ${f.packages} package(s) declared.\n`,
  );
  return 0;
}

/**
 * Format the diagnostic printed when one or more registration-chain steps fail.
 *
 * Names both causes of "red in CI, green here":
 * 1. The CORPUS (`xd1g`): a gitignored `node_modules/` on disk distorts a
 *    directory walk (`scripts/git-corpus.ts`).
 * 2. The TREE (`1xhc` / `nytj`): CI judges `refs/pull/N/merge` (`origin/main`
 *    merged into the branch), not the branch head alone, so an attestation or
 *    glossary whose inputs `main` also touched is current on head and stale on
 *    the merge (`bun run cat check:merged`).
 */
export function formatChainRedDiagnostic(checking: boolean, red: readonly string[]): string {
  // The wording must state WHICH mode ran, and that is a correction rather
  // than a nicety. Under `--check` nothing is regenerated, so "still red
  // after regenerating" was false in exactly the mode CI runs — measured
  // on this gate's first CI run, where it also pointed the reader at a
  // missing package-manifest entry that was not the cause. A diagnostic
  // that names the wrong remedy costs more than none.
  return (
    (checking
      ? `\n${red.length} check(s) red — nothing was regenerated (\`--check\`):\n`
      : `\n${red.length} check(s) still red after regenerating:\n`) +
    red.map((r) => `    ${r}`).join("\n") +
    (checking
      ? `\n\nRun \`bun run cat skill:register\` (without \`--check\`) to regenerate, then\n` +
        `commit what it writes. If a check is STILL red after that, read on.\n\n`
      : "\n\n") +
    "Three causes look identical from here and this command does NOT guess\n" +
    "between them — run the red check above directly and read what it names:\n\n" +
    "  · a MISSING PACKAGE-MANIFEST ENTRY. Reported above when this run found\n" +
    "    one; this command deliberately does not add it.\n" +
    "  · a subject was REMOVED, leaving a derived artefact orphaned. `kg:audit`\n" +
    "    reports `SUBJECT GONE` and refuses to delete it, which is correct:\n" +
    "    `deletion-requires-confirmation` makes removing a durable artefact a\n" +
    "    person's decision, so no amount of regenerating can settle it. Delete\n" +
    "    the named file yourself, or restore its subject. Measured 2026-09-26 by\n" +
    "    registering a probe skill and then deleting it.\n" +
    "  · the chain is not at a FIXED POINT yet. A later step can stale an\n" +
    "    earlier step's artefact: `uml:overview` renders the QA tree `kg:audit`\n" +
    "    writes, and its new pages stale `auto:docs`, two steps earlier.\n" +
    "    Measured 2026-09-27: pass 1 red, pass 2 exit 0. If the red check is one\n" +
    "    an EARLIER step owns, run this command again before reading on.\n" +
    "  · the chain above is INCOMPLETE. Measure by running that ONE check against\n" +
    "    a clean tree with and without your skill. Do NOT measure through\n" +
    "    `bun run cat gates` — `bun test` runs some of these writers and repairs what\n" +
    "    later gates read (bean `ymsu`), so gates reports artefacts as current\n" +
    "    that are not. Four separate attempts to recall this list were wrong.\n\n" +
    "And if it is red in CI but green here, check BOTH the corpus and the tree:\n" +
    "  1. THE CORPUS (`xd1g`): ask git what the corpus is, not the disk. A\n" +
    "     gitignored `node_modules/` in a subpackage inflated `cat-harness/schemas`\n" +
    "     from 227 nodes to 1441 in one container while a fresh checkout saw 227 —\n" +
    "     see `kg-detangle.ts`'s `walk` and `scripts/git-corpus.ts`.\n" +
    "  2. THE MERGE TREE (`1xhc` / `nytj`): CI on `pull_request` checks out\n" +
    "     `refs/pull/N/merge` (`origin/main` merged into your branch), not your\n" +
    "     branch head alone. When `main` moved a file that a committed attestation\n" +
    "     or glossary hashes, the corpus is identical and the TREE is not — run\n" +
    "     `bun run cat check:merged`, or merge `origin/main` and re-run\n" +
    "     `bun run cat skill:register`.\n"
  );
}

if (import.meta.main) process.exit(await main());
