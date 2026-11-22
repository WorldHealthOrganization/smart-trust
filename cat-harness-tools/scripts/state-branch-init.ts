#!/usr/bin/env bun
/**
 * state-branch-init — a layer CREATES the state branches it declares, at
 * initialization, seeded empty with the standard layout.
 *
 * @module scripts/state-branch-init
 * @covers beans
 * @covers todos
 *
 * Reached through `bun run cat state:seed --init` (all the root layer's
 * declared state branches, or one with `--id`), and called by the paths that
 * initialize a layer: `state:mount` (so the session-start hook and the first
 * `mount:remote` / `mount:lock` run through it), and `folio_init` /
 * `init-folio.ts` once the new repository's `main` is on its remote.
 *
 * ## Why (owner, 2026-11-17)
 *
 * A layer declares branch-kept state in `<instance>.json` (`beans`, `todos`,
 * `fsh-guts`, … with `source: { kind: "branch", branch: "cat/<instance>/<id>" }`),
 * and until now nothing created those branches: the scaffold printed a shell
 * command and `state:seed` only REFRESHES a seed that exists. dth-pc declared
 * `cat/dth-pc/beans` and `cat/dth-pc/todos` and never had them, so every layer
 * that mounts dth-pc failed `check:declared-dirs`, `check:declaration-resolution`
 * and `graph:declaration-resolution` over a branch nobody had made.
 *
 * ## What it will and will not create
 *
 * - **Only the layer's own.** A location is the root layer's when the
 *   checkout's ROOT declaration names it and it is read from the checkout's
 *   own `origin`: no `repository` (a remote-mounted dependency's state lives
 *   in that dependency's repository) and no `unownedBy` (a repository-scope
 *   graph a mounted layer declares for every checkout). A dependency's missing
 *   branch is never created from here; {@link dependencyRemedy} names the
 *   command to run in that repository instead.
 * - **Only when it is missing.** `ls-remote` decides. A branch that exists,
 *   or that appears between the look and the push (a sibling session doing the
 *   same), is `exists` and untouched. The push is without `-f`, so the
 *   server's ref lock settles the race.
 * - **Never onto an empty remote.** The first branch pushed to an empty
 *   GitHub repository becomes its default branch. A remote carrying no branch
 *   outside `cat/` is `refused`, naming the step that puts `main` there first.
 * - **Only where the token can push.** A rejected push is `denied`, with one
 *   actionable line ({@link initRemedy}); the caller reports it once, rather
 *   than leaving three downstream gates to fail over the missing branch.
 *
 * ## The standard layout
 *
 * The same `state-manifest/v1` root `manifest.json` (`authoritative: true`:
 * a new branch has no `main` copy, so it is the store from its first commit)
 * and README that `state:seed` and `branch-store` verify on every read, plus
 * the graph's own starting files: `beans.json` and `defs/` for beans,
 * `todos.json` and its three inner directories for todos, `retired/` for
 * fsh-guts, and a `.gitkeep` for any other declared graph. One list, shared
 * with the scaffold (`init-folio.ts`), so a branch created here and one a new
 * layer starts with are the same files.
 */
import { spawnSync } from "node:child_process";
import { relative, resolve } from "node:path";

import { readDeclaration, resolveDirectories } from "../schemas/kg/cat-harness.ts";
import { BranchStore, branchPathOf, MANIFEST_FILE, MANIFEST_SCHEMA, tipLocations, type BranchStoreOptions, type TipLocation } from "./branch-store.ts";

/** The command a person runs to create a layer's own declared state branches. */
export const INIT_COMMAND = "bun run cat state:seed --init";

// ── The standard layout ─────────────────────────────────────────────────────

/**
 * The todo graph's declaration, `todos/todos.json`: people's outstanding
 * items, and FEEDBACK raised against a block (bean `423d`). `feedback`
 * (`todo-feedback`) is where a review-process task commits a reviewer's
 * comment when it decides it; `verdicts` (`review-verdicts`) is where the
 * review coordinator commits per-block verdicts (bean `px0t`). Declared from
 * the start, or the first recorded decision on a new layer stops with
 * "declares no directory of graph typology todo-feedback". No `defaultTheme`:
 * a layer's theme is its own to choose.
 */
export function todosGraph(slug: string): string {
  return (
    JSON.stringify(
      {
        name: slug,
        directories: [
          {
            id: "items",
            path: "items",
            graphTypologies: ["todo-items"],
            description: "One Markdown file per todo, carrying `$schema: todo/1.0.0` in its front matter: a person's outstanding item.",
          },
          {
            id: "feedback",
            path: "feedback",
            graphTypologies: ["todo-feedback"],
            description:
              "Todos raised against a specific block. Review comments land here as `review-comment/1.0.0` JSON, committed on the edit-set's feature branch by the review-process task that decided them (the `review-comments` skill).",
          },
          {
            id: "verdicts",
            path: "verdicts",
            graphTypologies: ["review-verdicts"],
            description:
              "Reviewers' per-block verdicts, one `folio-review-verdict/v1` JSON each, pinned to the block's hash and committed on the edit-set's feature branch by the review coordinator (`folio-review-coverage --commit`).",
          },
        ],
      },
      null,
      2,
    ) + "\n"
  );
}

/** The bean graph's declaration, `beans/beans.json` — the shape `schemas/sdlc/bean-graph.ts` reads. */
export function beansGraph(slug: string): string {
  return (
    JSON.stringify(
      {
        name: slug,
        directories: [
          {
            id: "defs",
            path: "defs",
            graphTypologies: ["bean-defs"],
            description: "Work items — one Markdown file each, in the layout the `beans` CLI reads (`.beans.yml`).",
          },
        ],
      },
      null,
      2,
    ) + "\n"
  );
}

/**
 * The files a state graph starts with, under its declared `path` — in the
 * checkout for a `directory` source, on the branch for a `branch` one.
 */
export function stateGraphFiles(slug: string, id: string, path: string): Record<string, string> {
  // Composed from the graph's OWN path, never spelled whole.
  const at = (rel: string): string => `${path.replace(/^\/+|\/+$/g, "")}/${rel}`;
  // `beans.json` is the bean graph's own declaration, and it is not optional
  // once the graph is on a branch: `beans:claim` reads it FROM THE BRANCH to
  // find the `bean-defs` directory and refuses to guess.
  if (id === "beans") return { [at("beans.json")]: beansGraph(slug), [at("defs/.gitkeep")]: "" };
  // `retired/` is where a cutover's deposit lands (`state-seed.ts`).
  if (id === "fsh-guts") return { [at("retired/.gitkeep")]: "" };
  if (id === "todos") {
    return {
      [at("todos.json")]: todosGraph(slug),
      [at("items/.gitkeep")]: "",
      [at("feedback/.gitkeep")]: "",
      [at("verdicts/.gitkeep")]: "",
    };
  }
  // Any other declared graph: present and empty, so the mount lays down the
  // declared directory and `check:declared-dirs` finds it.
  return { [at(".gitkeep")]: "" };
}

/** The whole branch: root `manifest.json` and README, and the graph's files. */
export function stateBranchFiles(branch: string, id: string, path: string, slug: string): Record<string, string> {
  const graphPath = path.replace(/^\/+|\/+$/g, "");
  const manifest =
    JSON.stringify(
      {
        $schema: MANIFEST_SCHEMA,
        authoritative: true,
        subgraph: id,
        keyedBy: "tip",
        graphs: [{ path: graphPath }],
        note: `The ${id} subgraph of this layer, kept off main from its first commit; created by the layer's initialization (\`${INIT_COMMAND}\`).`,
      },
      null,
      2,
    ) + "\n";
  const readme =
    `# ${branch}\n\nThe \`${id}\` state subgraph of this repository's layer, kept OFF \`main\`. ` +
    `Paths mirror the checkout; \`${MANIFEST_FILE}\` is what makes this a state branch. ` +
    `Never merge it. Mount it with \`state:mount\`; write it with \`state:push\`.\n`;
  return { [MANIFEST_FILE]: manifest, "README.md": readme, ...stateGraphFiles(slug, id, graphPath) };
}

/**
 * The same branch as a shell command, for a reader with no Bun at hand (the
 * scaffold's note when it could not create the branch itself). Content
 * travels base64-encoded so no quoting in it can break the command; a
 * throwaway index keeps the checkout's own index untouched.
 */
export function stateSeedCommand(branch: string, files: Record<string, string>): string {
  const b64 = (t: string) => Buffer.from(t, "utf-8").toString("base64");
  const adds = Object.entries(files).map(
    ([path, text]) => `  git update-index --add --cacheinfo "100644,$(printf %s '${b64(text)}' | base64 -d | git hash-object -w --stdin),${path}"`,
  );
  return [
    "(",
    "  set -e",
    '  export GIT_INDEX_FILE="$(mktemp -u)"',
    ...adds,
    `  git push origin "$(git commit-tree "$(git write-tree)" -m 'Seed ${branch}')":refs/heads/${branch}`,
    '  rm -f "$GIT_INDEX_FILE"',
    ")",
  ].join("\n");
}

// ── Creating one branch ─────────────────────────────────────────────────────

export type CreateState = "created" | "exists" | "denied" | "refused" | "unknown" | "would-create";

export interface CreateResult {
  state: CreateState;
  branch: string;
  reason: string;
  commit?: string;
}

export interface CreateOptions {
  repoRoot: string;
  /** Passed to `BranchStore.open`: remote, private store directory, log. */
  store?: BranchStoreOptions;
  dryRun?: boolean;
}

/** A push refusal that a token with more rights would get past. */
const DENIED = /\b40[13]\b|permission|denied|not allowed|authentication failed|could not read username|unauthori[sz]ed|forbidden|protected branch|pre-receive hook declined/i;

/**
 * Create `branch` on the checkout's remote holding `files`, unless it is
 * there. Never throws for an expected state.
 */
export function createStateBranch(branch: string, files: Record<string, string>, opts: CreateOptions): CreateResult {
  let store: BranchStore;
  try {
    store = BranchStore.open(branch, { log: () => {}, ...opts.store, repoRoot: opts.repoRoot });
  } catch (e) {
    return { state: "unknown", branch, reason: (e as Error).message };
  }
  const heads = store.git(["ls-remote", "--heads", "origin"]);
  if (heads.status !== 0) return { state: "unknown", branch, reason: `ls-remote failed: ${heads.stderr.trim()}` };
  const names = heads.stdout
    .toString()
    .split("\n")
    .map((l) => l.split("\t")[1]?.trim().replace(/^refs\/heads\//, ""))
    .filter((b): b is string => Boolean(b));
  if (names.includes(branch)) return { state: "exists", branch, reason: `${branch} is already on the remote` };
  if (!names.some((n) => !n.startsWith("cat/"))) {
    return {
      state: "refused",
      branch,
      reason:
        `the remote carries no branch outside cat/, so ${branch} would become its default branch; ` +
        `push \`main\` first (\`bun run cat-harness-tools/scripts/seed-main-if-remote-empty.ts\`), then \`${INIT_COMMAND}\``,
    };
  }
  if (opts.dryRun) return { state: "would-create", branch, reason: `${branch} is missing and would be created` };

  let tree: string | undefined;
  for (const [path, text] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    const sha = store.hashBlob(text);
    tree = store.setPath(tree, path.split("/"), { mode: "100644", type: "blob", sha, name: "" });
  }
  // --no-gpg-sign: the branch is written as the state bot, not as whoever runs this.
  const commit = store.must(["commit-tree", "--no-gpg-sign", tree ?? store.mktree([]), "-m", `Seed ${branch} (layer initialization)`]).trim();
  // NO -f, and a ref that does not exist yet: if a sibling created it first,
  // this push is rejected and the branch is theirs.
  const push = store.git(["-c", "pack.useSparse=false", "push", "-q", "origin", `${commit}:refs/heads/${branch}`]);
  if (push.status === 0) return { state: "created", branch, reason: `created ${branch} at ${commit.slice(0, 12)}`, commit };
  const err = push.stderr.trim();
  const again = store.git(["ls-remote", "--heads", "origin", `refs/heads/${branch}`]);
  if (again.status === 0 && again.stdout.toString().trim() !== "") return { state: "exists", branch, reason: `${branch} appeared on the remote while this ran; left as it is` };
  if (DENIED.test(err)) return { state: "denied", branch, reason: `this token cannot push to the remote (${firstLine(err)})` };
  return { state: "unknown", branch, reason: `push failed: ${firstLine(err)}` };
}

function firstLine(s: string): string {
  return s.split("\n").find((l) => l.trim() !== "")?.trim() ?? "no output";
}

// ── The layer's own declared branches ───────────────────────────────────────

/**
 * The tip-keyed locations the checkout's ROOT layer declares and keeps on its
 * own `origin`. A mounted dependency's graphs (`repository`), and a
 * repository-scope graph only a mounted layer declares (`unownedBy`), are not
 * the root's to create.
 */
export function ownStateLocations(repoRoot: string, locations: readonly TipLocation[] = tipLocations(repoRoot)): TipLocation[] {
  const root = resolve(repoRoot);
  const declared = new Set(
    resolveDirectories([{ name: "(local)", root, own: true }]).map((d) => relative(root, d.absPath).split("\\").join("/").replace(/\/+$/, "")),
  );
  return locations.filter((l) => l.keyedBy === "tip" && l.repository === undefined && l.unownedBy === undefined && declared.has(l.path));
}

/** The name a seeded graph's own declaration carries: the root layer's name, else the instance segment of the branch. */
export function layerSlug(repoRoot: string, branch: string): string {
  try {
    const name = readDeclaration(repoRoot)?.name;
    if (name) return name;
  } catch {
    // An unreadable declaration is check:declared-dirs' finding; the branch name still says whose it is.
  }
  return /^cat\/([^/]+)\//.exec(branch)?.[1] ?? "layer";
}

/** Create one own location's branch, if it is missing. */
export function initLocation(loc: TipLocation, opts: CreateOptions): CreateResult {
  const path = branchPathOf(loc);
  return createStateBranch(loc.branch, stateBranchFiles(loc.branch, loc.id, path, layerSlug(opts.repoRoot, loc.branch)), opts);
}

export interface InitResult {
  /** One per own declared state branch, in declaration order. */
  branches: Array<CreateResult & { id: string }>;
}

/** Every own declared state branch, created where missing (or only one, by id). */
export function initDeclaredStateBranches(opts: CreateOptions & { id?: string }): InitResult {
  const own = ownStateLocations(opts.repoRoot).filter((l) => opts.id === undefined || l.id === opts.id || l.key === opts.id);
  return { branches: own.map((l) => ({ id: l.key ?? l.id, ...initLocation(l, opts) })) };
}

/** The line a caller prints when the branch could not be created here. */
export function initRemedy(r: Pick<CreateResult, "state" | "branch" | "reason">): string {
  if (r.state === "denied") return `${r.branch} is declared and missing, and ${r.reason}: run \`${INIT_COMMAND}\` with a token that can push to this repository`;
  return `${r.branch} is declared and missing, and was not created (${r.reason}); run \`${INIT_COMMAND}\``;
}

/** The line for a MOUNTED layer's missing branch: never created from here. */
export function dependencyRemedy(loc: Pick<TipLocation, "branch" | "repository" | "instance">): string {
  const where = loc.repository ? `\`${loc.repository}\`` : "the layer that declares it";
  return (
    `${where} declares ${loc.branch} but does not carry it. A layer creates its own state branches at initialization; ` +
    `in a checkout of ${where}, run \`${INIT_COMMAND}\` (this checkout never creates another layer's branch)`
  );
}

/** Exit codes: 0 created or present · 1 denied (a push this token may not make) · 4 could not determine · 5 refused. */
export function initExitCode(r: InitResult): number {
  const s = r.branches.map((b) => b.state);
  if (s.includes("refused")) return 5;
  if (s.includes("unknown")) return 4;
  if (s.includes("denied")) return 1;
  return 0;
}

export function initReport(r: InitResult): string {
  if (r.branches.length === 0) return "state:seed --init: this layer declares no state branch kept at a tip; nothing to create";
  const L = ["## Declared state branches", "", "| graph | branch | state | detail |", "|---|---|---|---|"];
  for (const b of r.branches) L.push(`| \`${b.id}\` | \`${b.branch}\` | ${b.state} | ${b.reason} |`);
  const bad = r.branches.filter((b) => b.state === "denied" || b.state === "unknown" || b.state === "refused");
  if (bad.length) L.push("", ...bad.map((b) => `🛑 ${initRemedy(b)}`));
  return L.join("\n");
}

/** Whether `state:mount` should create a missing own branch: on unless `CAT_STATE_INIT=0`. */
export function initEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CAT_STATE_INIT !== "0";
}

/** Whether the checkout has an `origin` at all: a fresh `git init` has nowhere to create a branch. */
export function hasOrigin(repoRoot: string): boolean {
  return spawnSync("git", ["remote", "get-url", "origin"], { cwd: repoRoot, encoding: "utf-8" }).status === 0;
}
