#!/usr/bin/env bun
/**
 * A README for every declared directory — cat-harness's call into the
 * writer in bootstrap-tools.
 *
 * @module scripts/subgraph-readmes
 * @covers cat-harness
 *
 * The writer, its Liquid templates and its findings are
 * `bootstrap-tools/scripts/subgraph-readmes.ts` — one copy, in the tools
 * repository. What stays here is what only a harness knows:
 *
 * - **resolving its Extensions** before the writer sees a directory: a
 *   directory entry `scope: "repository"` is relative to the repository
 *   rather than the layer, one declaring `absent` may be missing, and an
 *   asset's README is found through {@link declaredAssetPath}, which honours
 *   the asset's scope too;
 * - **resolving the governing process** a directory declares in
 *   `coverage.process` — its name, diagrams and the site each diagram renders
 *   into — so {@link governing-process} resolves them here and the writer is
 *   handed a finished `ProcessView`. `check-subgraph-coverage` shares that
 *   resolver, so the page and the axis cannot disagree;
 * - **recording the findings** as the committed QA sidecar
 *   `test/results/subgraph-readmes.qa-results.json`. Reported, not failed: a
 *   gap in a declaration is its owner's to fill. What `--check` FAILS on is a
 *   stale README, or a declared directory newly absent / a process newly
 *   unresolved against a baseline (the committed working copy, or
 *   `--against <ref>`; a missing baseline is UNKNOWN and not gated). A `qa` or
 *   `health` directory that is not in the checkout is not `absent-directory`
 *   either: those kinds leave `main`.
 *
 * Usage: `bun run cat readme:subgraphs` · `bun run cat readme:subgraphs:check`
 *
 * ## `--repo <checkout>`: a mounted layer's own READMEs
 *
 * Run in an index, the writer skips every remote-mounted layer (a mount is
 * another repository's bytes), and in the layer's own checkout there is no
 * gates workflow and no `cat` command. `--repo` plans and writes (or
 * `--check`s) the READMEs of the layers in ANOTHER checkout — the layer's
 * own git checkout, where its files are tracked, not the swapped-in copy
 * inside the index (no `.git`, so every README would say the directory holds
 * nothing). Run it from the composed index (its working directory), so the
 * graph typologies are the composed set (`defaultTypologyRoots` reads the
 * working directory) rather than the layer's alone.
 *
 * In this mode the QA sidecar is neither written nor judged, and the QA
 * working copy is not required: the stored directories that read it are
 * skipped ({@link isStored}), and what a README lists is what git commits.
 * `layer-post-merge-regen.yml` runs it.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  apply,
  DESCRIPTION_WORDS,
  type InstanceInput,
  type Plan,
  plan,
} from "@litlfred/bootstrap-tools/scripts/subgraph-readmes.ts";
import { instanceDirectories, declaredAssetPath, INSTANCE_README_ROLE, layerRootsIn, readDeclaration, repoRootFor } from "../schemas/kg/cat-harness.ts";
import { mountScopeFor } from "../schemas/kg/remote-mount.ts";
import { defaultGraphTypologies, type GraphTypologyRegistry } from "../schemas/kg/graph-typology-registry.ts";
import { contentIsOffCheckout } from "../schemas/kg/subgraph-source.ts";
import { forDirectory, processIndex, resolveProcess, type ProcessIndex } from "./governing-process.ts";
import { againstOrUsage, buildQaResult, judgeQaResult, judgeUsage, mayLeaveMain, writeQaResult } from "./qa-results.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);
const REPO = repoRootFor(ROOT);

/**
 * What each SUBDIRECTORY of `abs` is, by name — read from the directory's own
 * declaration file, the one its graph typologies name as `declarationFile` (the
 * owner's rule, 2026-09-20: each type declares its own filename, so
 * relocating `beans/` to `work/` renames nothing inside it).
 *
 * Only entries WITHOUT `"subgraph": true`. Those are parts of this
 * directory's graph (`beans.json`'s `defs`), and they are what the README's
 * table names; a `subgraph: true` entry is promoted to a layer directory
 * of its own (`skills.json`'s `voices`) and describes itself under its own
 * heading. The two partition, so a promoted directory's row borrows nothing.
 *
 * Only a single-segment `path` names a row — `defs/archive` is a directory
 * inside a row, not one. A missing, unparseable or description-less
 * declaration supplies nothing and the row says nothing declares it (no
 * count since bean `ba9e`):
 * absent stays absent rather than being invented. An unparseable file is
 * `check:harness-dirs`'s finding, not this one's.
 */
export function subdirDescriptions(
  abs: string,
  graphTypologies: readonly string[],
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): Record<string, string> {
  const out: Record<string, string> = {};
  const files = graphTypologies.map((g) => registry.get(g)?.declarationFile).filter((f): f is string => typeof f === "string");
  for (const f of [...new Set(files)]) {
    const p = join(abs, f);
    if (!existsSync(p)) continue;
    let nested: { directories?: unknown; topics?: unknown };
    try {
      nested = JSON.parse(readFileSync(p, "utf-8"));
    } catch {
      continue;
    }
    // `topics` is `skills.json`'s name for the same thing — it predates the
    // concern-group code list (see `declaredGroupsIn`), and each topic declares
    // its directory with a `path` and a `description` as a directory entry
    // does. A `concern-groups/v1` file declares only CODES, so it describes
    // nothing and supplies nothing here.
    const entries = [nested.directories, nested.topics].flatMap((a) => (Array.isArray(a) ? a : []));
    for (const nd of entries as Array<Record<string, unknown>>) {
      if (nd.subgraph === true || typeof nd.path !== "string" || typeof nd.description !== "string") continue;
      const sub = nd.path.replace(/^\.\//, "").replace(/\/+$/, "");
      const description = nd.description.trim();
      if (sub === "" || sub.includes("/") || description === "" || sub in out) continue;
      out[sub] = description;
    }
  }
  return out;
}

/** Does a directory declaration carry `storage` — its record lives on a branch, not in the checkout? */
export function isStored(d: unknown): boolean {
  const s = (d as { storage?: { branch?: unknown; branchPrefix?: unknown } }).storage;
  if (typeof s !== "object" || s === null) return false;
  // A branch FAMILY (bean `lehh`) is stored too, on `branchPrefix` rather than one `branch`;
  // reading only `branch` would generate a README into a mount path that is empty by design.
  return (typeof s.branch === "string" && s.branch !== "") || (typeof s.branchPrefix === "string" && s.branchPrefix !== "");
}

/**
 * Every layer under `repo`, with this harness's Extensions resolved: the
 * declared README (scope-aware), each directory's real location, and whether
 * it may be absent. An unreadable declaration is skipped — it is
 * `readDeclaration`'s own finding, reported by its checkers.
 */
export function harnessInstances(repo: string): InstanceInput[] {
  const out: InstanceInput[] = [];
  // Built on FIRST USE, not up front: it reads every `.bpmn` in the
  // repository, and a repository whose directories declare no process should
  // not pay for a walk whose answer nothing asks for.
  let processes: ProcessIndex | undefined;
  const index = (): ProcessIndex => (processes ??= processIndex(repo));
  for (const inst of layerRootsIn(repo)) {
    // A remote mount is another repository's bytes (bean `nn8e`, `hupw`): its READMEs
    // are generated there, and writing here would only break the lock's digest.
    if (resolve(inst) !== resolve(repo) && mountScopeFor(inst) !== undefined) continue;
    let decl;
    try {
      decl = readDeclaration(inst);
    } catch {
      continue;
    }
    if (!decl) continue;
    out.push({
      root: inst,
      decl: decl as unknown as InstanceInput["decl"],
      readme: declaredAssetPath(inst, INSTANCE_README_ROLE),
      // Own entries AND those declared from within (bean `cmsl`): the five
      // `voices/` READMEs dropped out of coverage when the entries moved into
      // `skills/skills.json` (75 → 70, measured 2026-09-30, bean `2j2r`).
      //
      // A STORED directory (`storage`, bean `16ei`) is skipped — bean `f3bh`.
      // Its contents live on their branch and the checkout holds at most a
      // working copy, so a README written from it, and the findings about it,
      // would depend on whether this contributor ran `qa:fetch`: the 12 `qa`
      // directories added 12 READMEs and 12 `no-title` findings when present
      // and none when absent. The parent's README already omits them, because
      // `.gitignore` lists every working copy and the writer lists only what
      // git would commit; `directory-storage.test.ts` keeps that list equal to
      // the declarations.
      //
      // The same holds for a `source`-declared branch (bean `9c7h`: fsh-guts),
      // which `isStored` does not see because it reads only `storage`:
      // counting the files git tracks here would rewrite its README as "holds
      // no files" — true of main, false of the subgraph.
      dirs: instanceDirectories(inst, decl).filter((d) => !isStored(d) && !contentIsOffCheckout(d)).map((d) => {
        const base = (d as { scope?: string }).scope === "repository" ? repo : inst;
        const abs = resolve(base, d.path);
        // Absent declaration means the writer gets nothing and prints no
        // section: a directory owes no process, so silence here is an answer
        // rather than a gap. A declared name resolving to no diagram still
        // gets a view, because the section has to say *could not determine*.
        const declared = (d as { coverage?: { process?: string } }).coverage?.process;
        const subdirs = subdirDescriptions(abs, d.graphTypologies as string[]);
        return {
          id: d.id,
          path: d.path,
          abs,
          title: (d as { title?: string }).title,
          description: (d as { description?: string }).description,
          graphTypologies: d.graphTypologies as string[],
          // `absent` declared, OR a kind the qa-reports arc moves off `main`
          // (bean `0dav`): its working copy being missing is not a finding.
          mayBeAbsent: Boolean((d as { absent?: unknown }).absent) || mayLeaveMain(d as { graphTypologies?: string[]; storage?: unknown }),
          ...(Object.keys(subdirs).length > 0 ? { subdirs } : {}),
          ...(declared !== undefined
            ? { process: forDirectory(resolveProcess(index(), declared), repo, abs) }
            : {}),
        };
      }),
    });
  }
  return out;
}

/** The writer's plan over every layer in this checkout. */
export function harnessPlan(repo: string = REPO): Promise<Plan> {
  return plan(repo, harnessInstances(repo));
}

/** The committed QA record of what the declarations do not say. */
export function qaResult(p: Plan) {
  const families: Record<string, { summary: string; entries: unknown[] }> = {
    "no-title": {
      summary: "Declared directories with no `title`: their README heading falls back to the id.",
      entries: p.findings["no-title"],
    },
    "no-description": {
      summary: "Declared directories with no `description`: their README says so instead of saying what they hold.",
      entries: p.findings["no-description"],
    },
    "long-description": {
      summary: `Declared directories whose description runs over ${DESCRIPTION_WORDS} words: shown to readers under the README heading, so history and argument belong in a \`_comment\` instead.`,
      entries: p.findings["long-description"],
    },
    "absent-directory": {
      summary: "Declared directories not on disk and not declared `absent`: a consumer scanning them finds nothing and may report a clean run.",
      entries: p.findings["absent-directory"],
    },
    "unmarked-readme": {
      summary: "READMEs that exist without the kg:subgraph markers, left untouched because somebody wrote them. Add the marker pair to adopt the generated section.",
      entries: p.findings["unmarked-readme"],
    },
    "unresolved-process": {
      summary:
        "Directories whose `coverage.process` names a diagram no instance declares: the README says `could not determine` in place of the drawing. Declaring none is not here — a directory owes no process, and only a declaration that points at nothing is a finding.",
      entries: p.findings["unresolved-process"],
    },
  };
  return buildQaResult({
    script: "scripts/subgraph-readmes.ts",
    scriptAbsPath: import.meta.path,
    subject: { kind: "graph", id: "subgraph-readmes" },
    families,
  });
}

const GATE = "readme:subgraphs";

/**
 * The checkout `--repo <dir>` (or `--repo=<dir>`) names, resolved; `undefined`
 * when the flag is absent. A flag with no value THROWS: running over this tree
 * instead would be a silent answer to a question nobody asked.
 */
export function repoArg(argv: readonly string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--repo=")) {
      const v = a.slice("--repo=".length);
      if (v === "") throw new Error("--repo needs a directory");
      return resolve(v);
    }
    if (a === "--repo") {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("--")) throw new Error("--repo needs a directory");
      return resolve(v);
    }
  }
  return undefined;
}

/**
 * `--repo`: write (or `--check`) the READMEs of another checkout's layers,
 * and nothing else — see the module comment. Exit 1 on a stale README under
 * `--check`, 2 when the directory is not a checkout this harness can read.
 */
async function runForRepo(repo: string, check: boolean): Promise<number> {
  if (!existsSync(repo) || layerRootsIn(repo).length === 0) {
    console.error(`${GATE}: UNKNOWN — ${repo} holds no instance declaration; nothing was written or checked.`);
    return 2;
  }
  const p = await harnessPlan(repo);
  const { stale, wrote } = apply(p, check, repo);
  for (const f of stale) console.error(`  ✗ ${f} is stale`);
  for (const u of p.findings["untracked-not-counted"]) {
    console.warn(`  ! untracked, so not counted or listed in ${u.directory}'s README until staged: ${u.path}`);
  }
  console.log(`${GATE} --repo ${repo}: ${p.writes.size} directory README(s); ${check ? `${stale.length} stale` : `${wrote} written`}.`);
  if (check && stale.length > 0) console.error(`\nRun \`bun cat-harness-tools/scripts/subgraph-readmes.ts --repo ${repo}\` and commit there.`);
  return check && stale.length > 0 ? 1 : 0;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const check = argv.includes("--check");
  if (check) {
    const usage = judgeUsage(GATE, argv, ["--against", "--repo"]);
    if (usage !== undefined) process.exit(usage);
  }
  let other: string | undefined;
  try {
    other = repoArg(argv);
  } catch (e) {
    console.error(`${GATE}: ${(e as Error).message}`);
    process.exit(2);
  }
  if (other !== undefined) process.exit(await runForRepo(other, check));
  const { against, exit: badRef } = againstOrUsage(GATE, argv);
  if (badRef !== undefined) process.exit(badRef);
  // Stored (`qa`, `beans`, `todos`) and off-checkout directories are filtered
  // out by `harnessInstances` (`!isStored(d) && !contentIsOffCheckout(d)`, bean
  // `f3bh`), so neither `--check` nor the writer reads `test/results/`.
  const p = await harnessPlan(REPO);
  const { stale: staleFiles, wrote } = apply(p, check, REPO);
  for (const f of staleFiles) console.error(`  ✗ ${f} is stale`);
  const stale = staleFiles.length;
  const result = qaResult(p);
  if (!check) writeQaResult(ROOT, "subgraph-readmes", result);
  // PRINTED, never recorded (bean `ba9e`). A finding that depends on the
  // worktree would make the recorded result depend on it too — the defect
  // counting the committed tree exists to remove.
  for (const u of p.findings["untracked-not-counted"]) {
    console.warn(`  ! untracked, so not counted or listed in ${u.directory}'s README until staged: ${u.path}`);
  }
  const f = p.findings;
  console.log(
    `${p.writes.size} directory README(s); ${check ? `${stale} stale` : `${wrote} written`}. ` +
      `Findings: ${f["no-title"].length} no title, ${f["no-description"].length} no description, ` +
      `${f["long-description"].length} long description, ` +
      `${f["absent-directory"].length} absent, ${f["unmarked-readme"].length} unmarked, ` +
      `${f["unresolved-process"].length} unresolved process.`,
  );
  if (check) {
    // The READMEs are committed docs and stay a comparison; the sidecar is a QA
    // record and is JUDGED (bean `0dav`): a directory newly absent, or a
    // process newly unresolved, fails; the description backlog never did.
    const judged = judgeQaResult({
      gate: `${GATE}:check`,
      fresh: result,
      failOnNew: ["absent-directory", "unresolved-process"],
      baseline: { root: ROOT, stem: "subgraph-readmes", writer: GATE, against },
    });
    if (stale) console.error("\nRun `bun run cat readme:subgraphs` and commit.");
    process.exit(stale ? 1 : judged.exit);
  }
}
