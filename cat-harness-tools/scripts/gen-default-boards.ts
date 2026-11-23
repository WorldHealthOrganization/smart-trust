#!/usr/bin/env bun
/**
 * Every harness above the floor gets a board, and it shows everything.
 *
 * @module scripts/gen-default-boards
 * @covers boards
 *
 * A harness instance's default rendering is LHS + docs/ + a themed folio
 * board, so every instantiated harness gets one; a folio does not opt in.
 *
 * ## "Filled with all contents" is the ABSENT filter
 *
 * In `schemas/ui/board.ts` a board with no `filter` shows the whole folio, so
 * the default board is the MINIMAL one — id, title, nothing else.
 *
 * ## "Above bootstrap" is read from the DECLARATION, not from a name
 *
 * The test is {@link isExemptFrom}`(decl, "visualiser")`, the rule the navbar
 * tiles sort by: bootstrap's own `renderExemption` says it renders nothing a
 * human browses. No layer is named here.
 *
 * ## INSTANTIATED, not merely present
 *
 * Only instantiated harnesses (the repository root has a
 * `<harness>.config.json`) get a board; a dependency that merely sits in the
 * checkout does not. The navbar uses the same signal.
 *
 * Usage:  bun run cat-harness-tools/scripts/gen-default-boards.ts [--check]
 *
 * `--check` writes nothing and exits 1 when a board is missing or stale.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { BOARD_SCHEMA_TAG, wholeFolioBoard } from "../schemas/ui/board.js";
import { isExemptFrom, readDeclaration } from "../schemas/kg/cat-harness.js";
import { instantiatedHarnessNames } from "../schemas/kg/harness-config.js";
import { TODO_GRAPH_FILE, parseTodoGraph } from "../schemas/sdlc/todo-graph.js";
import { checkoutTopLevelDirs } from "../schemas/sdlc/git-corpus.ts";
import { TODO_ROOT } from "./todos.js";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { graphReadPath } from "./graph-read.ts";
import { exitNotApplicable } from "./lib/not-applicable.ts";

const ROOT = resolve(HARNESS_ROOT);
const REPO_ROOT = resolve(ROOT, "..");
const check = process.argv.includes("--check");

/**
 * Where the boards live — READ, at both levels, never written here.
 *
 * The todo graph's own root comes from `scripts/todos.ts`, which resolves it
 * through `directoryForGraph` against the declaration; the boards directory
 * inside it comes from `todos.json`. Two lookups because they are two
 * declarations, and `check:declared-paths` is what stops either becoming a
 * literal — it caught this function composing `todos/` by hand.
 */
export function boardsDir(_repoRoot: string, todoRoot: string = TODO_ROOT()): string {
  const graph = parseTodoGraph(JSON.parse(readFileSync(join(todoRoot, TODO_GRAPH_FILE), "utf8")));
  const entry = graph.directories.find((d) => (d.graphTypologies ?? []).includes("boards"));
  if (entry === undefined) {
    throw new Error(
      `${todoRoot}/${TODO_GRAPH_FILE} declares no directory holding a \`boards\` graph. ` +
        `The default boards have nowhere to go; declare one rather than assuming a path here.`,
    );
  }
  return join(todoRoot, entry.path);
}

/**
 * The harnesses that owe a board: instantiated here, and above the floor.
 *
 * Returned sorted, so the set is a function of the declarations rather than of
 * the directory walk — the same reason `readTodoFiles` sorts.
 */
export function harnessesOwedABoard(repoRoot: string, names: readonly string[]): string[] {
  const out: string[] = [];
  // INSTANTIATED is the checkout's answer, not a file test: an index lists its
  // layers in `index.config.json` and none of them has a root
  // `<name>.config.json`, so asking for the file owed no harness a board in
  // the index checkout (2026-10-09, `gen-default-boards-checkout`). Without an
  // index, `instantiatedHarnessNames` is the same root config set as before.
  const instantiated = new Set(instantiatedHarnessNames(repoRoot));
  for (const name of [".", ...names]) {
    const dir = name === "." ? repoRoot : join(repoRoot, name);
    const decl = readDeclaration(dir);
    if (decl === undefined || decl === null) continue;
    if (!instantiated.has(decl.name)) continue;
    if (isExemptFrom(decl, "visualiser")) continue;
    out.push(decl.name);
  }
  return [...new Set(out)].sort();
}

/** The document a harness's default board is — minimal, which is to say total. */
export function defaultBoard(name: string, title: string): string {
  return JSON.stringify(wholeFolioBoard(name, title), null, 2) + "\n";
}

if (import.meta.main) {
  // The boards live INSIDE the todo graph. Where `state:mount` determined that
  // graph absent from this checkout (declared for every checkout by a mounted
  // instance, not by this root, and not on this remote — an IG repository that
  // is its own index), there is no board directory to judge: not applicable,
  // never "missing" (cat-harness-tools#1701). A refusal for any other reason
  // still throws below, exactly as before.
  const todos = graphReadPath("todos", REPO_ROOT);
  if (todos.state === "refused" && todos.absent) exitNotApplicable("boards:default", todos.reason);
  const dir = boardsDir(REPO_ROOT);
  // ASKED OF GIT (bean `qrlc`). The hand-written filter below admitted **26**
  // top-level names on this container and `_kg` was the first: a gitignored
  // directory of knowledge-graph exports that a clean checkout does not have.
  // Git's answer is 24 — it drops `_kg` and `test-results`, both gitignored,
  // and gains nothing.
  //
  // Latent today, and by a DIFFERENT mechanism from `xd1g`'s eleven: the
  // committed output carries 0 mentions of `_kg` because a later predicate
  // drops anything without a declaration. The walk was contaminated and the
  // artefact was not — which is luck a reader cannot see from the walk, and
  // the argument for asking git here rather than trusting the filter behind.
  const names = checkoutTopLevelDirs(REPO_ROOT).names;
  const owed = harnessesOwedABoard(REPO_ROOT, names);

  let stale = 0;
  let wrote = 0;
  for (const name of owed) {
    const decl = readDeclaration(name === readDeclaration(REPO_ROOT)?.name ? REPO_ROOT : join(REPO_ROOT, name));
    const title = decl?.title ?? name;
    const path = join(dir, `${name}.json`);
    const next = defaultBoard(name, title);
    const current = existsSync(path) ? readFileSync(path, "utf8") : "";
    if (current === next) continue;
    if (check) {
      console.error(`  ✗ ${relative(REPO_ROOT, path)} ${current === "" ? "is missing" : "is stale"}`);
      stale++;
      continue;
    }
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, next);
    wrote++;
    console.log(`  ✓ ${relative(REPO_ROOT, path)}`);
  }

  // A board for a harness that is NOT owed one is reported rather than
  // removed: `deletion-requires-confirmation` applies to a board like any
  // other durable artefact, and a file here may be a board somebody authored
  // deliberately for a harness this checkout no longer instantiates.
  const extra = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".json") && !owed.includes(f.replace(/\.json$/, "")))
        .sort()
    : [];
  for (const f of extra) {
    console.log(`  · ${f} — not a harness this checkout owes a board; left alone`);
  }

  if (check) {
    if (stale > 0) {
      console.error(
        `\n${stale} default board(s) missing or stale. Every instantiated harness above the ` +
          `floor owes one — run \`bun run cat boards:default\` and commit the result.`,
      );
      process.exit(1);
    }
    console.log(`default boards are up to date — ${owed.length} harness(es): ${owed.join(", ")}`);
  } else {
    console.log(
      `${owed.length} harness(es) owe a board: ${owed.join(", ")}. ` +
        `${wrote} written, ${owed.length - wrote} already current. ` +
        `Each shows the WHOLE folio — a board with no filter is the total one (${BOARD_SCHEMA_TAG}).`,
    );
  }
}
