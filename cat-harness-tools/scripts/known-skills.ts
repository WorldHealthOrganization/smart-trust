/**
 * Where a skill lives, and therefore what "this skill exists" means — shared
 * by `check-workflow-refs.ts` and `kg-audit.ts` so the two cannot disagree.
 *
 * Kept in step with `GROUPS` in `gen-skill-docs.ts`, plus the two homes that
 * file does not generate from: `schemas/skills/<name>/` (a directory of JSON
 * schemas) and `.claude/skills/<group>/`.
 *
 * @module scripts/known-skills
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, isAbsolute, join, join as joinPath, relative, resolve } from "node:path";

import { checkoutRootFor, directoriesForGraph, resolveDirectories, repoRootFor, isKgContentDirectory } from "../schemas/kg/cat-harness.js";
import { HARNESS_ROOT } from "./lib/roots.ts";

/**
 * The layer this module belongs to — the one that owns the repository-level
 * agent configuration under `.claude/`.
 *
 * Derived from the module's own path and never written down: the same device
 * `kg-audit.ts` uses for `AUDITOR_ROOT` and `skill-register.ts` for
 * `INSTANCE_ROOT`. A literal would be the defect this file was extracted to fix,
 * one directory along.
 */
const OWN_INSTANCE = resolve(HARNESS_ROOT);

/**
 * Which directories a known-skills question is asked over (placement PR0a,
 * bean `ejye`).
 *
 * - `"instance"` — the layer at `root` alone, through its own declaration.
 *   Since PR0 this sees nothing above it: cat-harness no longer declares its
 *   dependents' directories.
 * - `"checkout"` — `root` and every layer the checkout stacks ON it
 *   (`checkoutDirectories` with `stackedOn`), which is what a CORPUS-WIDE
 *   tool shipped by `root` asks. Its own dependencies are not added: callers
 *   that resolve downward already walk `orderedDependencies`. Paths are still
 *   composed relative to `root`, so a caller's ids do not change shape.
 *
 * Before PR0 the corpus-wide answer came from 19 `scope: "repository"`
 * mirrors in the platform's declaration, so every call with the platform's
 * root was silently corpus-wide. The DEFAULT is therefore
 * {@link corpusScopeFor} — that same behaviour, now a rule rather than a
 * declaration, so no caller shrinks in silence — and the corpus-wide scripts
 * also say so at the call site. Pass `"instance"` to ask about the platform
 * alone, which is what the cmsl falsifier ("resolved alone, it sees nothing
 * above it") is held to.
 */
export type CorpusScope = "instance" | "checkout";

/**
 * Which opt-in sub-graphs a directory scan resolves with. Absent, each
 * instance resolves with its root's own switches; `"all"` reads every group
 * the checkout declares, switched on or not, for a check that judges a
 * declaration rather than what one root is given.
 */
export interface SubgraphOpts {
  enabledSubgraphs?: EnabledSubgraphs;
}

/**
 * The scope a platform tool asks over when it is pointed at `root`: the
 * CHECKOUT when `root` is the platform layer that ships these tools — the
 * corpus-wide run, which is what the mirrors made every such run — and the
 * layer alone otherwise (`kg-audit --instance core` audits core, not core
 * and everything stacked on it). This is the pre-PR0 behaviour stated as a
 * rule instead of produced by a declaration, which is the whole of PR0a for a
 * known-skills caller.
 */
export function corpusScopeFor(root: string): CorpusScope {
  return resolve(root) === OWN_INSTANCE ? "checkout" : "instance";
}
import { readRoleGraph, type RoleGraph } from "../schemas/process/role-graph.js";
import { checkoutDirectories, orderedDependencies } from "../schemas/kg/harness-config.js";
import type { EnabledSubgraphs } from "../schemas/kg/opt-in-subgraphs.js";
import { packageDirsIn } from "./skill-topics.js";
import { checkoutRoleGraph } from "../schemas/process/scenario-overlay.js";
import { parseFrontMatter, scalar, type FrontMatter } from "../schemas/kg/front-matter.js";
// The `folio` graph typology is registered by CORE. This module is a LIBRARY, so it
// does NOT import that registration: a library's edge is inherited by every
// module that imports it, and the harness may not depend on core. The
// COMMAND that runs carries it — and since #840 every caller does, because
// the trigger sits at the foot of `cat-harness.ts` and a reader lives in that
// module, so loading it is a precondition of calling one.
//
// THIS COMMENT NAMED `check:composition-roots` AS THE GUARANTEE UNTIL
// 2026-09-22, in SEVEN files, AND THAT SCRIPT DOES NOT EXIST. `bun run
// check:composition-roots` exits "Script not found". The safety argument for
// a library omitting the registration rested on a gate nobody built, and no
// gate failed to say so — the same silence this repository keeps paying for.
// It is moot now rather than fixed: #840 made the registration automatic, so
// there is no longer a command that can forget it (bean `z9ax`).

/**
 * Claude Code's skill-loader stub file name. Under `.claude/skills/` it is a
 * trigger pointing at a corpus skill, so a group holding only that is not a
 * group of skills. Elsewhere `SKILL.md` IS a skill's own file (the IRIS replica's
 * voices use that layout), so this is checked only where the stubs live.
 */
export const LOADER_STUB = "SKILL.md";

/**
 * Groups under `.claude/skills/` that hold something other than skills.
 *
 * Each one is a different kind of node in the knowledge graph — participants,
 * environment probes, an assignment table, a shell hook, conformance
 * requirements — and none of them is an instruction body an activity can name.
 *
 * `scripts/generate-registry.ts` states the same taxonomy and is the reason to
 * trust this list rather than the directory's name: it loads `actors/` as
 * `ActorDefinition`, `capabilities/` as `CapabilityDefinition`, `requirements/`
 * as `Requirement` and **only `local/` as `SkillDefinition`**.
 *
 * `requirements/` is the one that looks most like skills and is least like
 * them. Its entries are `{ id: "req:commit-hygiene", statements: [{ conformance:
 * "SHALL", … }] }` — a skill points at a requirement statement it satisfies
 * (`satisfies:`, #1168); a requirement is not a skill. Reading the four of them as
 * skills is what made `commit-hygiene`, `content-lifecycle`, `lean-verification`
 * and `session-start` appear as reachable skill names with nothing behind them.
 */
// `conventions` joins these for the same reason as the rest: the directory
// holds a different NODE KIND, and a scan that took them for skills would
// publish a convention as something an activity could implement.
export const NON_SKILL_GROUPS = new Set([
  "actors", "capabilities", "roles", "hooks", "requirements", "conventions", "skill-definitions",
]);

/**
 * Does this directory hold at least one SKILL `.md` directly?
 *
 * Not merely a `.md`. The two halves of this arrived from opposite directions
 * and meet here: declaration-driven discovery asks WHICH DIRECTORIES to look
 * in, and {@link isSkillMd} asks WHICH FILES in one count. Either alone
 * overcounts — the 25 agent-memory nodes then in `skills/memory/` were `.md` in a
 * declared directory, and were admitted until the file-level predicate
 * existed.
 */
function holdsMarkdown(abs: string): boolean {
  if (!existsSync(abs)) return false;
  return readdirSync(abs).some((f) => f.endsWith(".md") && isSkillMd(joinPath(abs, f)));
}

/**
 * The layer's declared `cat-harness` directories, or nothing it cannot read.
 *
 * A declaration that will not parse is the layer's problem to fix, not this
 * function's to guess around — but skill discovery must not crash a tool that
 * had nothing to do with the declaration, so an unreadable one yields an empty
 * list and the explicit extras below still resolve.
 *
 * **Exported, and it carries `id`, because the path is the unstable half.**
 * {@link kgRoots} drops everything but `absPath`, which is all a scanner
 * needs; a consumer that must NAME a root needs the declared id. `harness.json`
 * states the rule on its own `cat-harness` entry — *"ids are stable across a
 * relocation, paths are not"* — and `gen-skill-docs` is where it was paid for:
 * it keyed a category heading on the basename, that basename was `bootstrap`
 * only while the root was `bootstrap/`, and when #422 moved the skills to
 * `bootstrap/skills/` the generator demanded a heading for a package called
 * "skills".
 */
export function kgDirectories(
  root: string,
  scope: CorpusScope = corpusScopeFor(root),
  opts: SubgraphOpts = {},
): Array<{ id: string; path: string; absPath: string; graphTypologies?: string[]; optInSubgraph?: string }> {
  return declaredKgDirectories(root, scope, opts).filter((d) => existsSync(d.absPath));
}

/**
 * The knowledge-graph directories `root` DECLARES, whether or not they are on
 * disk. {@link kgDirectories} is this list with the absent ones dropped; the
 * two differ exactly where "declares none" and "declares one that is missing"
 * must not read alike — the first is a tree with nothing of this kind, the
 * second is check:declared-dirs' finding and never a clean pass.
 */
export function declaredKgDirectories(
  root: string,
  scope: CorpusScope = corpusScopeFor(root),
  opts: SubgraphOpts = {},
): Array<{ id: string; path: string; absPath: string; graphTypologies?: string[]; optInSubgraph?: string }> {
  const en = opts.enabledSubgraphs === undefined ? {} : { enabledSubgraphs: opts.enabledSubgraphs };
  try {
    return (scope === "checkout" ? checkoutDirectories(root, { stackedOn: root, ...en }) : resolveDirectories([{ name: "(local)", root, own: true }], undefined, en))
      // EXACTLY ONE knowledge-graph typology, not merely including one.
      //
      // `schemas/` declares `["schemas", "cat-harness"]` — a schema IS a
      // knowledge-graph node, which is why it carries the kind at all — but
      // its `.md` files are READMEs and its nodes are `.ts`. Including it
      // added `schemas/README.md` and `schemas/block-qa-schema/README.md` to
      // the skill set: 150 where the corpus has 149.
      //
      // Requiring YAML front matter instead would have been the principled
      // rule and is measurably wrong here: only 117 of 147 skill bodies carry
      // any, so it would have dropped 30 real skills. A directory that holds
      // one kind can be scanned for it; one that holds several has to say
      // which file is which, and for `schemas/` that answer is `@graphNode`
      // on the `.ts`, not a guess about the `.md`.
      .filter(isKgContentDirectory);
  } catch (err) {
    // NOT swallowed into an empty list, and the reason is measured.
    //
    // This was `catch { return []; }`. `AGENTS.md` states the contract it was
    // silently breaking: "Absent declaration is fine (an unmigrated instance
    // falls back to today's conventions); a present-but-unreadable one throws."
    // So the only thing this catch could ever catch was the case that is
    // supposed to be loud — and it turned it into "this instance has no
    // knowledge-graph directories".
    //
    // Measured 2026-09-20, when a `folio` graph was first declared here
    // (issue #464): `resolveDirectories` threw, this returned `[]`,
    // `workflowDirs` found nothing, and `translate-bpmn --check` reported
    // "No .bpmn files in any declared knowledge-graph directory" and EXITED 0
    // on a repository holding 36 of them. `skill_list` and `skill_fetch` read
    // the same list. That is the `dh4f` defect from the inside — a consumer
    // scans nothing and reports a clean run over it — and it is worse than the
    // error it was hiding, because a broken declaration is recoverable and a
    // silent empty graph is believed.
    throw new Error(
      `cannot resolve knowledge-graph directories for ${root}: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
}

/**
 * Every directory the layer declares as holding ONLY its knowledge graph.
 *
 * Absolute paths. This is the answer to `join(root, "skills")` — the literal
 * `check:declared-paths` found in a dozen consumers, each of which a topical
 * layout (`bootstrap/`, `crdm/`) breaks silently.
 *
 * ## It is a LIST, and callers must not quietly take the first
 *
 * One root is today's shape, not the contract. A consumer that scans for
 * role graphs, memory nodes or requirements has to look in every declared
 * root or it reports a clean run over the ones it did not visit — the `dh4f`
 * defect, arriving through a helper that was supposed to prevent it. Where a
 * call site genuinely needs one directory (a WRITE target, a fallback), it
 * says so and carries its reason.
 *
 * `schemas/` is excluded because it declares TWO graphs: it is a
 * knowledge-graph node AND the schema definitions, and its `.md` files are
 * READMEs. See {@link kgDirectories} for the measurement that established it.
 */
/**
 * This layer's role graph, found across EVERY declared graph root.
 *
 * Callers wrote `readRoleGraph(kgRoots(root)[0])`, which worked only while the
 * roles lived under the first root returned. Since 2026-09-21 they are in
 * `scenarios/`, a declared directory of its own, and `[0]` is `skills/` — so
 * taking the first root silently returned `undefined` and every consumer read
 * that as "this instance declares no roles".
 *
 * That is the `kgRoots(root)[0]` hazard AGENTS.md names outright: taking the
 * first root is the `dh4f` defect arriving through the helper written to
 * prevent it. One root is today's shape, never the contract.
 */
export function roleGraphFor(root: string, scope: CorpusScope = corpusScopeFor(root)): RoleGraph | undefined {
  // NOT `kgRoots(root, "checkout")`: that is deepest-first, so its first role
  // graph is bootstrap's 4 roles rather than this layer's 48 — the `[0]`
  // hazard above, one level out. The checkout's answer is this layer's
  // own graph with its DEPENDENTS' extensions overlaid by id (placement PR0b).
  let own: RoleGraph | undefined;
  for (const r of kgRoots(root)) {
    own = readRoleGraph(r);
    if (own !== undefined) break;
  }
  return scope === "checkout" ? checkoutRoleGraph(root, own)?.graph : own;
}

export function kgRoots(root: string, scope: CorpusScope = corpusScopeFor(root)): string[] {
  return kgDirectories(root, scope).map((d) => d.absPath);
}

/**
 * Knowledge-graph roots this audit may write sidecars for.
 *
 * **Every root the layer DECLARES, minus the ones belonging to another
 * layer** — bean `lps0`. This walked the literal
 * `KG_ROOT = join(root, "skills")`, so a skill in a topical directory was not
 * audited AND not reported as unaudited: the `dh4f` shape inside the tool
 * whose job is finding that shape. Measured when it was fixed — 219 skills
 * under the literal, 229 under the declaration, and the 10 in the gap had
 * never been audited at all.
 *
 * ## Another layer's roots are excluded, and that is not this function's
 * ## judgement to make
 *
 * `kgRoots` resolves a DEPENDENCY's directories too, so it returns paths like
 * `../bootstrap/skills`. Walking them is forbidden by
 * `instance-graph-isolation.test.ts`, which guards a live 2026-09-19 leak of
 * 88 references: one layer's graph must not carry another's nodes.
 * `unreadNestedInstances` states the same rule in its own finding text — *"do
 * NOT declare its directories here"*.
 *
 * It would break this audit's own output as well. {@link sidecarPath}
 * composes `dirname(join(root, subject.path))` and mirrors it under
 * `test/results/kg-qa/`, so a `../` subject normalises to
 * `test/results/bootstrap/render` — **outside the results tree
 * altogether**, which is the escaping-path defect bean `chq5` fixed one store
 * over.
 *
 * **The exclusion is not silent, and it needs nothing added here.** The
 * `nested-instance-audited` criterion already names every unread nested
 * layer and counts what it holds — added by bean `sa8y` for exactly this
 * invisibility. A second report from this function would be a second answer to
 * one question, free to disagree with the first.
 */
export function ownKgRoots(root: string): string[] {
  const here = resolve(root);
  const kept = kgRoots(root).filter((r) => {
    const rel = relative(here, resolve(r));
    // `rel === ""` is the layer root itself, which would walk everything
    // including its own results tree.
    return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
  });
  // DEDUPLICATED. `resolveDirectories` supplies the conventional defaults
  // alongside the declaration, so a layer that ALSO declares `skills/`
  // gets it twice — measured on a fixture declaring it explicitly. Harmless to
  // a caller that dedupes its own output and wasteful to one that does not,
  // and a caller cannot tell the two apart from the list alone.
  return [...new Set(kept.map((r) => resolve(r)))].sort();
}

/** A generator's own mark on the first line: `<!-- GENERATED from <source> … -->` (see {@link isSkillMd}). */
const GENERATED_MARK = /^\uFEFF?\s*<!--\s*GENERATED from\s/;

/**
 * NOTE ON THE EXAMPLES BELOW: the agent-memory nodes moved out of
 * `skills/memory/` to the declared `memory/` graph on 2026-09-20 (bean
 * `07xs`), so they are no longer scanned here at all. The history is kept in
 * the present tense of the defect rather than rewritten, because the
 * file-level predicate exists BECAUSE of it — and `isSkillMd` is still what
 * does the work, which is why the move was safe rather than urgent. A reader
 * following `skills/memory/` today finds nothing; that is the point.
 *
 * Is this `.md` a skill, or another node kind that happens to live here?
 *
 * **Declaration over location.** A markdown file whose front matter carries
 * `$schema:` is declaring what it IS, and a skill does not — skills declare
 * `name` / `summary`. So a `$schema` is a positive statement that this file is
 * something else, and it is the same contract `part-of:` carries for a split
 * skill's siblings.
 *
 * ## This module's own header was falsified, and this is the repair
 *
 * {@link skillMdDirs} says non-skill directories under `skills/` "are excluded
 * by carrying **no `.md`**, which is the same test that admits a package", and
 * that "a directory that later grows a `.md` is a decision somebody makes
 * visibly". `skills/memory/` was exactly that directory: 25 agent-memory nodes,
 * every one a `.md`, none a skill. Measured 2026-09-19 — before this guard,
 * `skill-coverage.test.ts` demanded a published reference page for all 25, and
 * `kg-audit` had already written 25 bogus `kg-qa/` sidecars beside them
 * asserting brevity and heading rules against files that are not instruction
 * bodies.
 *
 * The visible decision the header asks for is the `$schema` line inside each
 * file, not the directory's name — a name list is the thing this module exists
 * to stop, and a directory's contents can be mixed.
 *
 * Unreadable is **not** "not a skill": an unreadable file returns `true` and is
 * counted, so a permissions error or a truncated read cannot silently shrink
 * the skill set. Undercounting here is what produces a clean run over nothing.
 *
 * ## A generated file is never a skill
 *
 * A skill is an instruction body somebody WROTE. A file a generator wrote is a
 * rendering of something else, so it is not a node in its own right, whatever
 * directory it sits in. Two marks say so, both read from the head of the file
 * only, so a skill that DISCUSSES generation cannot exempt itself by quoting
 * one further down:
 *
 * - front matter carrying `generated:` (the markdown form
 *   `declaresGenerated` in check-reference-direction.ts reads); or
 * - a first line `<!-- GENERATED from … -->`, the mark `bpmn-checklist.ts`
 *   writes on each `<diagram>.checklist.md`.
 *
 * The second is why this exists. cat-harness#236 committed a checklist beside
 * every BPMN diagram under `processes/<topic>/`, a declared knowledge-graph
 * directory. None carries `$schema`, so each topic directory read as a skill
 * package: `gen-skill-docs` threw "skill package(s) with no category: content,
 * kg, library, process, sdlc, ui" on import, and every test that loads it
 * failed with it.
 */
export function isSkillMd(path: string): boolean {
  // A README is documentation ABOUT a directory, never a node IN it.
  //
  // This is the one name-based exclusion in a module whose whole doctrine is
  // declaration over location, and it earns the exception by being a
  // filesystem-wide convention rather than this repository's layout: no
  // directory anywhere has a skill called `README`.
  //
  // It has already cost something once. `schemas/` is excluded from the KG
  // scan partly because "its `.md` files are READMEs" — without that, the
  // corpus read 150 skills where it holds 149. Now `bootstrap/README.md` is
  // the entry point an agent with no context reads first, and declaring
  // `bootstrap/` as a knowledge graph would have admitted it as a skill named
  // `README`, making `<bootstrap.processes:skill ref="README"/>` resolve and handing
  // `kg-audit` a sidecar asserting heading and brevity rules against a
  // README. Requiring every README to carry a `$schema` disclaimer instead
  // would mean inventing a schema so that a file can say it is not something
  // it was never going to be.
  if (basename(path).toLowerCase() === "readme.md") return false;

  let text: string;
  try {
    text = readFileSync(path, "utf-8");
  } catch {
    return true;
  }
  if (GENERATED_MARK.test(text)) return false;
  const fm = /^---\n([\s\S]*?)\n---/.exec(text);
  return fm === null || !/^(\$schema|generated):\s*\S+/m.test(fm[1]!);
}

/**
 * Directories holding one `<skill>.md` per skill, DISCOVERED rather than listed.
 *
 * ## Why it stopped being a literal
 *
 * It was five hardcoded entries, four of them under `skills/`. Measured
 * 2026-09-19: **six** `skills/` directories hold `.md`, so `authoring-math`
 * (3 skills) and `authoring-who-smart-guidelines` (9) were absent from the one
 * function that answers "does this skill exist".
 *
 * Nothing had broken, and that is the point. All twelve resolved anyway
 * through a SECOND home — eleven because they also have a
 * `schemas/skills/<name>/` I/O contract, and the tools skill named after the DAK base layer
 * because it also had a `.claude/skills/local/<name>.json` (now under
 * the DAK base layer's `skills/skill-definitions/`, bean `rqao`). Delete any one of
 * those second homes and `check-workflow-refs` reports a real, present skill
 * as dangling: the "wall of false dangling refs" this module's own header says
 * it exists to prevent, arriving from the module itself.
 *
 * `kg-export.ts`'s `skillMdDirs()` already scanned `skills/*` dynamically and
 * saw all six, so the two definitions disagreed BY CONSTRUCTION and agreed only
 * BY COINCIDENCE. A list somebody has to remember to extend is not a single
 * answer; it is a copy that happens to match today.
 *
 * ## Why scanning is safe here
 *
 * `skills/` is not uniformly skill packages — `framework/`, `permissions/`,
 * `remote-packages/`, `requirements/`, `roles/` and `workflows/` are other
 * node kinds. Most are excluded by carrying **no `.md`**, which is the same
 * test that admits a package, rather than by a name list that would need the
 * same remembering.
 *
 * **That test alone was not enough, and it was falsified within the day.**
 * This doc said "a directory that later grows a `.md` is a decision somebody
 * makes visibly"; `skills/memory/` then arrived with 25 of them, none a skill.
 * So the admitting test is now `.md` **that {@link isSkillMd} accepts** — the
 * visible decision is the `$schema` line inside each file rather than the
 * directory's name, because a name list is the thing this module exists to
 * stop and a directory's contents can be mixed.
 */
export function skillMdDirs(root: string, scope: CorpusScope = corpusScopeFor(root)): string[][] {
  const dirs: string[][] = [];

  // Every directory the layer DECLARES as holding a `cat-harness` graph —
  // not the literal `skills/`.
  //
  // This is what lets a topical directory (`bootstrap/`, `crdm/`, …) cost a
  // declaration line and no code change. The literal was the last thing
  // standing between the layout and the declaration that is supposed to
  // describe it: `harness.json` said where the knowledge graph lives and
  // this function did not read it.
  //
  // `resolveDirectories` supplies the defaults too, so a layer that
  // follows the convention still resolves `skills/` without declaring it.
  for (const d of kgDirectories(root, scope)) {
    // RELATIVE TO `root`, computed from the absPath the resolver already
    // produced — not from `d.path`, which is relative to whatever root the
    // entry's SCOPE names. Those were the same directory until the move (bean
    // `wggr`); afterwards `bootstrap/skills/` is repository-scoped, so `d.path`
    // said `bootstrap/skills` while `root` was the layer, and every caller
    // resolved `<instance>/bootstrap/skills`. kg-export's `collectSkills`
    // skips a directory that is not there as "a package this instance does not
    // carry", so bootstrap's skills left the published graph IN SILENCE —
    // `confirm-harness` became a dangling `hasSkill` and `kg-navigation` only
    // looked fine because a second copy exists under `skills/` (bean `v3se`).
    //
    // `relative()` may yield a `../` prefix, and that is correct here: it is a
    // COMPUTED path between two known roots, not a declared one. The
    // dot-prefix guard in `check-harness-dirs.ts` governs what a declaration
    // may SAY, which is still `bootstrap/skills/` with a scope beside it.
    // SPLIT back into segments, preserving this function's contract: callers
    // index them (`p[0] === "skills"`, `p[1]` is the package name) as well as
    // joining them. Returning one joined string fixed the root and broke the
    // shape, which `skill-coverage.test.ts` caught by asserting set equality
    // against the filesystem.
    const rel = (abs: string): string[] => relative(root, abs).split("/");
    // The directory itself, when it holds skills directly — the shape a
    // topical directory has (`bootstrap/getting-started.md`).
    if (holdsMarkdown(d.absPath)) dirs.push(rel(d.absPath));
    // ...and its immediate subdirectories, which is how `skills/` is laid out
    // today: one package per subdirectory.
    // ...or two, inside a topic the directory's `skills.json` declares
    // (bean `9umr`) — so the package name is the LAST segment, not `p[1]`.
    for (const p of packageDirsIn(d.absPath)) {
      if (holdsMarkdown(p.dir)) dirs.push(rel(p.dir));
    }
  }
  // Not under `skills/`, so not reachable by the scan above.
  if (existsSync(join(root, "src", "skills"))) dirs.push(["src", "skills"]);

  // `.claude/skills/<group>/`, minus the groups that hold other node kinds.
  //
  // A DENY-list, so a new group of real skills is picked up automatically and a
  // new group of something else is a one-line addition to
  // {@link NON_SKILL_GROUPS}. `kg-export.ts` had its own copy of this that
  // hardcoded `local` alone; measured 2026-09-19 by creating
  // `.claude/skills/probegroup/probe-skill.md`, which `knownSkills()` resolved
  // and the exported graph did not — a skill by this repository's own
  // definition, absent from the graph. Latent rather than live (only `local`
  // exists today), and now impossible: the exporter reads this function.
  //
  // `checkoutRootFor` (bean `g43f`): `repoRootFor` is `dirname`, so for the
  // root layer this read `.claude/worktrees/.claude/skills` in a worktree
  // and `/home/user/.claude/skills` in the main checkout — outside the
  // checkout. The root layer now reads the checkout's own `.claude/skills`
  // (owner, 2026-10-04: "do g43f"), which is the same directory a nested
  // layer already reached through `repoRootFor`.
  //
  // `SKILL.md` does not make a group. It is Claude Code's loader stub
  // (`.claude/skills/<name>/SKILL.md`), a trigger pointing at the corpus
  // skill, so a group holding only that is not a group of skills — counted,
  // it published a skill literally named `SKILL` (measured 2026-10-03: the
  // root layer went 0 -> 4 names with it, 0 -> 3 without).
  const checkout = checkoutRootFor(root);
  const localRoot = join(checkout, ".claude", "skills");
  if (existsSync(localRoot)) {
    for (const g of readdirSync(localRoot, { withFileTypes: true })) {
      if (!g.isDirectory() || NON_SKILL_GROUPS.has(g.name)) continue;
      if (readdirSync(join(localRoot, g.name)).some((f) => f.endsWith(".md") && f !== LOADER_STUB)) {
        dirs.push([".claude", "skills", g.name]);
      }
    }
  }
  // ONE entry per directory. Over the checkout a directory can be reached two
  // ways — sci's `skills/lean/` is a package of the `skills/` member AND a
  // root declared from within it (placement PR0) — and every caller here walks
  // what it is given, so a duplicate is every skill in it counted twice.
  const seen = new Set<string>();
  return dirs.filter((p) => {
    const k = p.join("/");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}



/**
 * The `.md` file of the skill `name`, found through {@link skillMdDirs} — the
 * directories the declaration says hold skills — rather than a spelled
 * `skills/<area>/<pkg>/<name>.md`. `undefined` when no declared skill
 * directory holds it: a skill that moved is found where it went, and one that
 * is gone reads as gone rather than as ENOENT on a stale path.
 */
export function skillMdFile(root: string, name: string, scope: CorpusScope = corpusScopeFor(root)): string | undefined {
  for (const dir of skillMdDirs(root, scope)) {
    const p = join(root, ...dir, `${name}.md`);
    if (existsSync(p)) return p;
  }
  return undefined;
}

/**
 * Skills a **declared remote package** supplies, which this layer does not hold.
 *
 * Two questions, and they must not be collapsed:
 *
 *  - **can this layer SERVE it** — {@link knownSkills}. A remote skill is
 *    `false` here: its body is in another repository, so `skill_fetch` cannot
 *    answer for it and an activity naming it is a real dangling reference.
 *  - **is this entry a real skill SOMEWHERE** — this function, unioned with
 *    {@link knownSkills}. A bundle manifest curating a remote skill is the
 *    design, not a defect.
 *
 * This lived only in `kg-audit.ts`, whose own comment records the near-miss:
 * *"collapsing them would have had this criterion demand the deletion of three
 * correct manifest entries the first time it ran. That very nearly happened."*
 *
 * **It then happened anyway, because the answer was in one checker and not the
 * other.** `d3e63f15a` set out to fix exactly the two-definitions defect — it
 * pointed `skill-manifest-coverage.test.ts` at `knownSkills()` so the test and
 * this module could not disagree — but `knownSkills()` had never read
 * `remote-packages/`, so it was a THIRD definition. Under it,
 * `scientific-visualization`, `hypothesis-generation` and
 * `scientific-critical-thinking` read as dangling, and all three were deleted
 * from the formal-math layer's `skills/content/authoring-math/package-manifest.json` two hours after bean
 * `m4zg` recorded that deleting them would be wrong. The evidence offered was a
 * `git log --diff-filter=A` search finding no file ever added for any of them —
 * which is the wrong question, because a remote skill has no file here by
 * design.
 *
 * So the answer lives beside the other one now. A checker that needs the wider
 * question unions the two; a checker that needs the narrower one does not, and
 * the difference is visible at the call site instead of buried in whether a
 * module happened to scan a directory.
 */
export function remotePackageSkills(root: string): Set<string> {
  // Derived from the per-declaration reader below rather than scanning the
  // directory again: two readers of one directory is how they come to disagree,
  // which is the defect this module's header is about.
  return new Set(remotePackageDeclarations(root).map((d) => d.skill));
}

/** One declared skill, and which wrapper declared it. */
export interface RemoteDeclaration {
  /** The wrapper's filename, e.g. `smarter-fhir.json`. */
  file: string;
  /** A name from that wrapper's `wrapper.skills`. */
  skill: string;
  /** The wrapper's `sync` block, verbatim, or `undefined` when it declares none. */
  sync?: unknown;
}

/**
 * Every remote-package declaration, one row per skill, carrying its wrapper.
 *
 * `remotePackageSkills` flattens this to a name set, which is what a "is this a
 * real skill somewhere" check wants. A check that has to REPORT a finding needs
 * the wrapper too: the two files here have different maintainers and different
 * remedies, so a finding that does not name which one declared the skill is one
 * somebody has to measure again. Bean `wlqd`.
 */
export function remotePackageDeclarations(root: string): RemoteDeclaration[] {
  const out: RemoteDeclaration[] = [];
  // EVERY declared skills root, not `kgRoots(root)[0]`: a wrapper sits with
  // the layer whose skills use it — sci holds `claude-scientific-skills`,
  // the FHIR IG harness `smarter-fhir` (placement PR1, bean `ybwt`) — and from the
  // checkout the first root is the deepest layer's, which holds none.
  const dirs = [...new Set(kgRoots(root).map((d) => resolve(d, "remote-packages")))].filter((d) => existsSync(d));
  for (const dir of dirs) for (const f of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    try {
      const p = JSON.parse(readFileSync(join(dir, f), "utf-8")) as {
        wrapper?: { skills?: string[] };
        sync?: unknown;
      };
      for (const skill of p.wrapper?.skills ?? []) out.push({ file: f, skill, sync: p.sync });
    } catch {
      // A remote-package file that will not parse is validate-skills.ts's finding.
    }
  }
  return out;
}

/**
 * Every name a **manifest entry** may legitimately carry: held here, or
 * declared by a remote package.
 *
 * The one answer to "is this a real skill somewhere". Named rather than left as
 * a union at each call site, because the union IS the rule and two call sites
 * spelling it out is how they come to disagree.
 */
export function manifestResolvableSkills(root: string, scope: CorpusScope = corpusScopeFor(root)): Set<string> {
  return new Set([...knownSkills(root, scope), ...remotePackageSkills(root)]);
}

/**
 * The skills that declare `consulted: true` — reference material nobody
 * PERFORMS.
 *
 * ## The distinction, and why it had to be declared
 *
 * `kg-audit`'s `skill-in-role-or-process` reported **110 skills bound to no
 * role and no activity**, graded `major`, and the number was not one
 * population. `build-pdf`, `lean-generation` and `proof-triage` are tasks
 * somebody performs; `directory-conventions`, `opening-brief` and
 * `untrusted-input` are what the performer READS. A consulted skill belongs
 * in no lane **by its nature**, so counting it as unbound measures the
 * criterion rather than the corpus.
 *
 * It is not derivable. Two discriminators were tested over the 110 (bean
 * `y1w9`): a sibling `.ts` `SkillDefinition` covers 20 and misses
 * `glossary-build` and `editor`; an `allowed-tools:` line covers 58 and
 * splits the same families arbitrarily. Both cut across the distinction
 * rather than along it. So the axis is real, load-bearing for an audit
 * criterion, and was declared nowhere — the mirror of this repository's
 * usual defect, which is a field declared and read by nothing.
 *
 * ## Why `consulted` is the EXCEPTION rather than the default
 *
 * Absent means performed. Annotating the smaller set is the difference
 * between marking dozens of files and marking every one of them, and an
 * axis whose default costs 180 edits does not get adopted.
 *
 * ## Why this ships with its reader in the same change
 *
 * Bean `qif9` removed a front-matter field that carried 288 annotations and
 * was consumed by nothing, for three months. `kg-audit` reads this one from
 * the commit it lands in, in BOTH directions: the criterion skips a
 * consulted skill, and a separate criterion reports a consulted skill that
 * a lane or a role claims — so a wrong annotation is a finding rather than
 * a quiet exemption.
 */
export function consultedSkills(root: string, scope: CorpusScope = corpusScopeFor(root)): Set<string> {
  const out = new Set<string>();
  for (const parts of skillMdDirs(root, scope)) {
    const dir = join(root, ...parts);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".md") || !isSkillMd(join(dir, f))) continue;
      let fm: FrontMatter;
      try {
        fm = parseFrontMatter(readFileSync(join(dir, f), "utf-8")).fm;
      } catch {
        // Unreadable is not "not consulted", by the same reasoning
        // `isSkillMd` gives for the opposite default: there, undercounting
        // the skill set produces a clean run over nothing. Here the risk
        // runs the other way — treating an unreadable file as consulted
        // would EXEMPT it from the criterion — so it stays performed and
        // gets reported.
        continue;
      }
      if (scalar(fm, "consulted") === "true") out.add(f.slice(0, -3));
    }
  }
  return out;
}

/**
 * The skills that declare `published: false` — kept out of every published
 * graph, because publishing them advertises what they document.
 *
 * ## Why a declaration, when a name match already worked
 *
 * `isPublishedSkill` strips a skill whose NAME is an unpublished graph typology,
 * and its own note says why that was enough and where it stops:
 *
 * > *"Same list, because the skill and the kind share a name by
 * > construction. If that ever stops being true this needs its own list, not
 * > a cleverer derivation."*
 *
 * This is that list, and it is a declaration rather than a list in code for
 * the reason this repository applies everywhere else — `isSkillMd`, a bean's
 * front matter, a workflow instance's `$schema`: **a directory is a place to
 * look and the file says what it is.** A skill that must not be published
 * says so in its own front matter, where the author who writes it is looking.
 *
 * It EXTENDS the name rule rather than replacing it. The two answer different
 * questions — "is this named after the trashcan" and "did this skill say not
 * to publish it" — and a skill whose subject is an unpublished graph but
 * whose name is something else was previously unexpressible. Keeping both is
 * the "an unavoidable duplicate is fine while an unchecked one is not" rule:
 * the blanket test in `fsh-guts-unpublished.test.ts` asserts the OUTCOME over
 * the built document at any depth, so neither input can quietly stop working.
 *
 * Unreadable is not "publishable", and the asymmetry is deliberate — the same
 * shape as `consultedSkills` above, resolved the other way. There, treating
 * an unreadable file as consulted would EXEMPT it from a criterion, so it
 * stays performed. Here, treating one as publishable would LEAK it, so it
 * stays unpublished.
 */
export function unpublishedSkills(root: string, scope: CorpusScope = corpusScopeFor(root)): Set<string> {
  const out = new Set<string>();
  for (const parts of skillMdDirs(root, scope)) {
    const dir = join(root, ...parts);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".md") || !isSkillMd(join(dir, f))) continue;
      let fm: FrontMatter;
      try {
        fm = parseFrontMatter(readFileSync(join(dir, f), "utf-8")).fm;
      } catch {
        out.add(f.slice(0, -3));
        continue;
      }
      if (scalar(fm, "published") === "false") out.add(f.slice(0, -3));
    }
  }
  return out;
}

/** Every skill name this layer can resolve. */
export function knownSkills(root: string, scope: CorpusScope = corpusScopeFor(root)): Set<string> {
  const names = new Set<string>();

  for (const parts of skillMdDirs(root, scope)) {
    const dir = join(root, ...parts);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      // Filtered per FILE, not per directory: admitting a package says the
      // directory holds skills, never that everything in it is one. A mixed
      // directory is explicitly allowed here -- #263's rule that a place to
      // look may hold more than one part of the graph.
      if (f.endsWith(".md") && isSkillMd(join(dir, f))) names.add(f.slice(0, -3));
    }
  }

  // `schemas/skills/<name>/` — a directory per skill, beside loose .json files.
  const schemaDir = join(root, "schemas", "skills");
  if (existsSync(schemaDir)) {
    for (const e of readdirSync(schemaDir, { withFileTypes: true })) {
      if (e.isDirectory()) names.add(e.name);
    }
  }

  // `.claude/skills/<group>/<name>.{md,json}` — but only the groups that hold
  // skills.
  //
  // This directory is NOT uniformly skills, and reading it as though it were
  // was a live defect: `actors/` holds eighteen participants, `capabilities/`
  // holds environment probes (`docker`, `pandoc`, `python3`), `roles/` holds an
  // assignment table and `hooks/` holds a shell script. Scanning all of them
  // put 46 non-skills into the skill set — which means a diagram could have
  // referenced `<bootstrap.processes:skill ref="viewer"/>` or `ref="latex-compiler"` and the
  // reference checker would have called it resolved.
  //
  // The list is a deny-list of the groups that are known not to be skills
  // rather than an allow-list of `local/`, so that a NEW group of real skills
  // is picked up automatically and a new group of something else is a one-line
  // addition here.
  // Only `.json` here: the `.md` files come through `skillMdDirs()` above, so
  // the deny-list is applied in ONE place rather than two that can disagree.
  //
  // AND IT IS READ FOR ONE LAYER ONLY. `repoRootFor` here is the REPOSITORY,
  // so without this guard every nested layer inherited the repository's
  // agent-level skills as its own. Measured 2026-09-27:
  //
  //     knownSkills("./bootstrap")   30, of which 23 came from .claude/skills/local/
  //     bootstrap's OWN skills        7 — bootstrap-graph-emission,
  //                                   bootstrap-graph-publication,
  //                                   bootstrap-kg-navigation, confirm-harness,
  //                                   discussion, log-message, root-readme
  //
  // Those 23 are exactly the `.json` files in `local/`, the only group
  // `NON_SKILL_GROUPS` admits. They surfaced as `kg-audit --instance` reporting
  // 23 `skill-in-role-or-process` findings against bootstrap for skills it does
  // not declare, and as `graph.test.ts`'s "nothing in bootstrap/ names anything
  // above it" (bean `iwtn`) failing on the tools skill named after the DAK base layer — a cat-harness skill.
  //
  // The direction is DECLARED, not a matter of taste. `needs` records the
  // layering in the owner's words — *"So bootsteap, cat harness, fa-core, f-a,
  // from bottom to top"* — with `cat-harness.needs = ["bootstrap"]` and
  // `bootstrap.needs = []`. So cat-harness inherits bootstrap's skills and
  // bootstrap inherits NOTHING; reading the repository's `.claude/` into
  // bootstrap inherited upward, against that chain.
  //
  // Attributed to OWN_INSTANCE rather than to the top of the chain because that
  // is where these skills live: all 23 `local/` names also exist as
  // `cat-harness/skills/**/<name>.md`, measured. Which means the scan adds NO
  // name at root in this corpus — redundant today, and kept anyway, because the
  // deny-list exists so a new group of json-declared skills is picked up
  // automatically. Redundant is not pointless; a fourth leak of this exact
  // `repoRootFor` shape is.
  const localRoot = join(repoRootFor(root), ".claude", "skills");
  if (resolve(root) === OWN_INSTANCE && existsSync(localRoot)) {
    for (const g of readdirSync(localRoot, { withFileTypes: true })) {
      if (!g.isDirectory() || NON_SKILL_GROUPS.has(g.name)) continue;
      for (const f of readdirSync(join(localRoot, g.name))) {
        if (f.endsWith(".json")) names.add(f.slice(0, -5));
      }
    }
  }

  return names;
}

/**
 * Where this layer's BPMN and DMN live, read from the declaration.
 *
 * ## The literal this replaces
 *
 * Nine production sites hardcoded `processes` — `src/tools/workflow.ts`,
 * `src/impact/stakeholder-map.ts`, `src/workflow/corpus-gate.ts`,
 * `scripts/kg-audit.ts`, `scripts/translate-bpmn.ts`, `scripts/render-bpmn.ts`,
 * `scripts/xml-comment-check.ts` among them. Nine copies of one fact is the
 * same defect `known-skills.ts` was extracted to fix for skills, one directory
 * along, and it is what would have made a topical split a nine-file edit
 * instead of a declaration.
 *
 * ## The shape
 *
 * A `cat-harness` directory's `workflows/` subdirectory, plus the directory
 * itself when it holds diagrams directly. That covers today's
 * `processes/` and a topical `bootstrap/processes/` without either
 * being written down.
 *
 * Returns ABSOLUTE paths, unlike {@link skillMdDirs}, because every caller
 * reads files from them rather than composing repo-relative ids.
 */
/**
 * Whether a directory holds a `.bpmn` or `.dmn` at ANY depth.
 *
 * Recursive since placement PR3 (bean `63wl`): a declared `processes/` groups
 * its diagrams by concern (`processes/sdlc/`, `processes/kg/decisions/`, …)
 * and holds none directly, so the flat test this replaced reported a
 * 59-diagram directory as empty — and every consumer then scanned nothing.
 */
function holdsDiagrams(dir: string): boolean {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isFile() && (e.name.endsWith(".bpmn") || e.name.endsWith(".dmn"))) return true;
    if (e.isDirectory() && holdsDiagrams(joinPath(dir, e.name))) return true;
  }
  return false;
}

export function workflowDirs(root: string, scope: CorpusScope = corpusScopeFor(root), opts: SubgraphOpts = {}): string[] {
  const out: string[] = [];
  for (const d of kgDirectories(root, scope, opts)) {
    // A `business-processes` directory DESCRIBES work and is never run (owner,
    // 2026-11-01, Q-SUBG-6 A). It is read by KIND, not by file extension: its
    // `.bpmn` files would otherwise reach the engine through `holdsDiagrams`
    // below, and every engine gate would grade a DAK's diagrams as workflows.
    if (d.graphTypologies?.includes("business-processes")) continue;
    // `processes/`, the convention since 2026-09-21. A layer that has not
    // migrated declares its diagrams directly and is reached by the second
    // branch below, so no legacy name is needed here.
    // declared-path-literal: the convention fallback, at the call site. This
    // walks a DEPENDENCY's directory, so the local declaration cannot answer
    // for it — the second branch below is what catches a layer that
    // declares its diagrams directly instead.
    const wf = joinPath(d.absPath, "processes");
    if (existsSync(wf)) out.push(wf);
    else if (holdsDiagrams(d.absPath)) {
      out.push(d.absPath);
    }
  }
  // DE-DUPLICATED, because the two branches above can name one directory.
  //
  // `skills/` reaches `processes/` by the CONVENTION in the first
  // branch; since the 2026-09-21 split `processes/` is also declared in
  // its own right, kind `processes`, and reaches itself by the second. One
  // directory, two routes, and every caller here walks what it is given — so
  // the duplicate arrived in the export as 1,354 nodes sharing 677 `@id`s,
  // which is the one thing a JSON-LD consumer may not be handed.
  //
  // Deduping HERE rather than in each caller: the ambiguity is created by this
  // function's own two branches, and a caller cannot see that the path it was
  // handed twice is the same directory found two ways.
  //
  // NESTED, too, not only identical. A declared directory with no `processes/`
  // is pushed whole when `holdsDiagrams` finds a diagram at ANY depth, so an
  // opt-in level (`L2/`) claims the processes of a sub-graph declared inside it
  // (`L2/collab/processes/`), which is also pushed in its own right. Every
  // caller walks recursively, so each of those diagrams reached the KG export
  // twice: 207 nodes sharing their IRIs, and `slice:sqlite` failed on
  // `UNIQUE constraint failed: nodes.iri` (folio-assistant main after #3119).
  return outermostDirs(out);
}

/**
 * The given directories without duplicates and without any that lies inside
 * another of them: a recursive walk of the outer one already reaches it.
 * Order is kept, by first appearance.
 */
export function outermostDirs(dirs: readonly string[]): string[] {
  const uniq = [...new Set(dirs.map((d) => resolve(d)))];
  const inside = (d: string, outer: string): boolean => {
    const rel = relative(outer, d);
    return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
  };
  return uniq.filter((d) => !uniq.some((o) => o !== d && inside(d, o)));
}

/**
 * Every `.bpmn` and `.dmn` this layer declares, as absolute paths.
 *
 * One call for the common case, so a caller that only wants the files does not
 * have to re-derive "and their `decisions/` subdirectory too".
 */
export function workflowFiles(root: string, scope: CorpusScope = corpusScopeFor(root), opts: SubgraphOpts = {}): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = joinPath(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".bpmn") || e.name.endsWith(".dmn")) out.push(p);
    }
  };
  for (const d of workflowDirs(root, scope, opts)) walk(d);
  // Belt and braces on top of `workflowDirs`'s own dedupe: a caller may pass
  // overlapping directories this function never chose, and the same file
  // reached twice is a duplicate `@id` downstream either way.
  return [...new Set(out)].sort();
}

/**
 * The `.bpmn` files of the `business-processes` and `folio` directories
 * `root` itself declares: diagrams that describe work as content (a DAK's business
 * processes), which the processes viewer and `render:bpmn` draw and the
 * engine never runs (owner, 2026-11-01, Q-SUBG-3). Not in
 * {@link workflowFiles}, so no engine gate reads them.
 */
export function businessProcessFiles(root: string, opts: { folio?: boolean } = {}): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = joinPath(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".bpmn")) out.push(p);
    }
  };
  // Also every `.bpmn` inside a declared `folio`: a diagram held as a document
  // block (a DTH's `bp-*` blocks, the DAK layer's `businessProcess()`, kind
  // `business-process`) describes work by construction. `folio` is not
  // knowledge-graph content, so the engine never read these; the viewer did
  // not either until now. Read by the directory's kind, so the blocks stay
  // where the chapter manifests point at them.
  const dirs: string[] = [];
  // `render:bpmn` passes `folio: false`: a folio block carries its own drawn
  // SVG (`meta.svgFile`), so drawing it again would be a second copy to keep.
  for (const kind of opts.folio === false ? ["business-processes"] : ["business-processes", "folio"]) {
    try {
      dirs.push(...directoriesForGraph(root, kind));
    } catch {
      // an unreadable declaration is `check:harness-dirs`'s to report
    }
  }
  for (const d of dirs) walk(d);
  return [...new Set(out)].sort();
}

/**
 * One declared diagram by FILE NAME (`getting-started.bpmn`,
 * `draft-qa-gate.dmn`), wherever its owner placed it.
 *
 * Placement PR3 (bean `63wl`) grouped every layer's diagrams by concern and
 * moved the content-type ones up to their owners, so a path composed as
 * `<instance>/processes/<name>` stopped being a fact about the diagram. A
 * name is: `workflowFiles` already walks every declared `processes` graph in
 * the corpus scope, so resolving through it survives the next regroup too.
 * Throws rather than guessing when the name is absent or ambiguous.
 */
export function workflowFile(root: string, name: string, scope: CorpusScope = corpusScopeFor(root)): string {
  const hits = workflowFiles(root, scope).filter((f) => basename(f) === name);
  if (hits.length === 1) return hits[0]!;
  throw new Error(
    hits.length === 0
      ? `no declared diagram named ${name} under ${root}`
      : `${hits.length} declared diagrams are named ${name}: ${hits.join(", ")}`,
  );
}

/**
 * Every servable skill name, with the packages that hold one of that name.
 *
 * {@link knownSkills} collapses names into a set, so two packages holding the
 * same name read as one skill. This keeps them apart, which is what lets
 * {@link resolveSkillRef} say "ambiguous" instead of picking (#1168 B8).
 * A package is the declared directory's last segment, e.g. `folio-core`.
 */
export function skillIndex(root: string, scope: CorpusScope = corpusScopeFor(root)): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const parts of skillMdDirs(root, scope)) {
    const dir = join(root, ...parts);
    if (!existsSync(dir)) continue;
    const pkg = parts[parts.length - 1] ?? "";
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".md") || !isSkillMd(join(dir, f))) continue;
      const name = f.slice(0, -3);
      const held = out.get(name) ?? [];
      if (!held.includes(pkg)) held.push(pkg);
      out.set(name, held);
    }
  }
  return out;
}

/**
 * {@link skillIndex} over this layer AND everything it `needs`.
 *
 * Resolution follows `needs` downward — the rule `kg-audit.ts` applies to
 * `<skill ref>` (`resolvableSkills`) and `check-tools.ts` to `satisfies`
 * (`satisfiableSkills`): a Tool here may satisfy a skill that lives in
 * `bootstrap`, and "not in my overlay is not does not exist" (`pve3`).
 * `orderedDependencies` walks the chain, so this adds no second walker.
 */
export function resolvableSkillIndex(root: string): Map<string, string[]> {
  const out = skillIndex(root);
  for (const dep of orderedDependencies(root)) {
    for (const [name, pkgs] of skillIndex(dep.rootPath)) {
      const held = out.get(name) ?? [];
      for (const p of pkgs) if (!held.includes(p)) held.push(p);
      out.set(name, held);
    }
  }
  return out;
}

/** What a skill reference names. */
export type SkillRefResolution =
  | { kind: "ok"; name: string; package: string }
  | { kind: "missing"; ref: string }
  /** A bare name more than one package holds: qualify it as `package/name`. */
  | { kind: "ambiguous"; ref: string; packages: string[] };

/**
 * Resolve `name` or `package/name` against a {@link skillIndex}.
 *
 * Owner, 2026-09-30 (*"both; qualify if ambiguous"*): a bare name that more
 * than one package holds is reported, never resolved to whichever came first.
 */
export function resolveSkillRef(ref: string, index: ReadonlyMap<string, readonly string[]>): SkillRefResolution {
  const slash = ref.indexOf("/");
  const pkg = slash === -1 ? undefined : ref.slice(0, slash);
  const name = slash === -1 ? ref : ref.slice(slash + 1);
  const held = index.get(name) ?? [];
  if (pkg !== undefined) return held.includes(pkg) ? { kind: "ok", name, package: pkg } : { kind: "missing", ref };
  if (held.length === 0) return { kind: "missing", ref };
  if (held.length > 1) return { kind: "ambiguous", ref, packages: [...held].sort() };
  return { kind: "ok", name, package: held[0]! };
}
