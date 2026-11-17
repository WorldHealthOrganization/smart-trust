/**
 * **A bean's history**, for the git Tools: every change to the bean, oldest
 * first, from `git log` on its file merged with the steps of every workflow
 * instance that names it (owner, 2026-11-02, cat-harness#991 Q-BSD-4 A:
 * derived, nothing migrated).
 *
 * Two halves:
 *
 * - {@link historyFrom} — pure. The bean's versions in order, and the
 *   instances, become {@link HistoryEvent}s. Every Tool that keeps versions
 *   can use it; a server Tool that stores events as rows need not.
 * - {@link GitReader} — where the versions come from. {@link branchReader}
 *   reads the store's branch (the beans live there after the cutover);
 *   {@link checkoutReader} reads a checkout that still keeps `beans/` itself.
 *
 * A file absent from a commit that follows one where it was present is
 * `removed` — the contract says a bean is never deleted, so the history says
 * when it was, rather than ending quietly.
 *
 * @module folio-assistant/workflow/work-plan-store-history
 */
import { spawnSync } from "node:child_process";
import { inputSiteReached } from "../../schemas/sdlc/input-trace.ts";
import type { BranchStore } from "../../scripts/branch-store.ts";
import { parseBeanText, walk, type BeanFields, type HistoryEvent, type InstanceLike } from "./work-plan-store.ts";

/** The bean's file as one commit left it. `text` undefined: the file is not there in that commit. */
export interface BeanVersion {
  commit: string;
  at: string;
  by: string;
  text?: string;
  /** The file sat in `archive/` in this commit. */
  archived: boolean;
}

/** Commits that touched any of `paths`, oldest first, and a file's text at one commit. */
export interface GitReader {
  log(paths: readonly string[]): Array<{ commit: string; at: string; by: string }>;
  show(commit: string, path: string): string | undefined;
}

/** Where a bean file can be, live or archived: `<dir>/<file>` and `<dir>/archive/<file>`. */
export function beanPathVariants(path: string): string[] {
  const parts = path.split("/");
  const file = parts.pop()!;
  if (parts.at(-1) === "archive") parts.pop();
  const dir = parts.join("/");
  const pre = dir ? `${dir}/` : "";
  return [`${pre}${file}`, `${pre}archive/${file}`];
}

/** The bean's versions, oldest first, read through `reader` from its live and archived paths. */
export function beanVersions(reader: GitReader, path: string): BeanVersion[] {
  const [live, archived] = beanPathVariants(path) as [string, string];
  return reader.log([live, archived]).map((c) => {
    const a = reader.show(c.commit, archived);
    const text = a ?? reader.show(c.commit, live);
    return { ...c, ...(text !== undefined ? { text } : {}), archived: a !== undefined };
  });
}

const FIELDS = ["title", "type", "parent", "blockedBy", "tags"] as const;

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** The first line of what a body gained, trimmed for a timeline. */
function appended(before: string, after: string): string | undefined {
  const b = before.trimEnd();
  if (!after.startsWith(b) || after.trimEnd() === b) return undefined;
  const added = after.slice(b.length).trim();
  const line = added.split("\n").find((l) => l.trim()) ?? added;
  return line.length > 200 ? `${line.slice(0, 199)}…` : line;
}

/**
 * Every change, oldest first: the bean's own versions, then each step of an
 * instance that names (or carries) the bean, merged by time. At the same
 * moment a bean change sorts before an instance step.
 */
export function historyFrom(beanId: string, versions: readonly BeanVersion[], instances: Iterable<InstanceLike>): HistoryEvent[] {
  const out: Array<HistoryEvent & { order: number }> = [];
  let prev: (BeanFields & { archived: boolean }) | undefined;
  let seen = false;
  for (const v of versions) {
    const cur = v.text === undefined ? undefined : parseBeanText(v.text, beanId);
    const push = (kind: HistoryEvent["kind"], what: string): void => {
      out.push({ at: v.at, by: v.by, kind, what, order: 0 });
    };
    if (!cur) {
      if (prev) push("removed", "the bean's file was removed");
      prev = undefined;
      continue;
    }
    if (!prev) {
      push("created", seen ? `restored: ${cur.title}` : `created: ${cur.title} (${cur.status})`);
    } else {
      if (cur.status !== prev.status) {
        push(cur.status === "in-progress" ? "claimed" : "status-changed", `${prev.status} → ${cur.status}`);
      }
      const changed = FIELDS.filter((f) => !same(cur[f], prev![f]));
      if (changed.length) push("changed", changed.join(", "));
      const note = appended(prev.body, cur.body);
      if (note !== undefined) push("noted", note);
      else if (cur.body !== prev.body) push("changed", "body");
      if (v.archived !== prev.archived) push(v.archived ? "archived" : "unarchived", v.archived ? `archived (${cur.status})` : "brought back from the archive");
    }
    seen = true;
    prev = { ...cur, archived: v.archived };
  }

  for (const top of instances) {
    for (const { s, beans, id } of walk(top, new Set(), top.id)) {
      if (!beans.has(beanId)) continue;
      for (const h of s.history ?? []) {
        if (!h.at || !h.node) continue;
        out.push({
          at: h.at,
          by: h.actor ?? "workflow",
          kind: "step-reached",
          what: `${s.processId}: ${h.node}${h.outcome ? ` → ${h.outcome}` : ""}`,
          instance: id,
          node: h.node,
          order: 1,
        });
      }
    }
  }

  return out
    .map((e, i) => ({ e, i }))
    .sort((x, y) => Date.parse(x.e.at) - Date.parse(y.e.at) || x.e.order - y.e.order || x.i - y.i)
    .map(({ e: { order: _o, ...e } }) => e);
}

// ---------------------------------------------------------------------------
// Readers.

function parseLog(out: string): Array<{ commit: string; at: string; by: string }> {
  return out
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [commit, at, by] = l.split("\x1f");
      return { commit: commit!, at: at!, by: by! };
    });
}

const LOG_FORMAT = "--format=%H%x1f%aI%x1f%an";

/**
 * The store's branch, with its whole history: the store's own reads fetch the
 * tip alone (`--depth=1`), so this fetches every commit, blobs included, under
 * a private ref. A work-plan branch is small text, and one fetch costs less
 * than one round trip per version when a site build reads every bean's history.
 */
export function branchReader(s: BranchStore): GitReader {
  const tip = s.fetchTip();
  if (tip.state !== "ok") {
    throw new Error(`cannot read the history of ${tip.branch}: ${tip.state === "absent" ? "the branch does not exist" : tip.reason}`);
  }
  const ref = s.privateRef("history");
  const shallow = s.git(["rev-parse", "--is-shallow-repository"]).stdout.toString().trim() === "true";
  s.must(["fetch", "-q", "--no-tags", ...(shallow ? ["--unshallow"] : []), "origin", `+refs/heads/${tip.branch}:${ref}`]);
  return {
    log: (paths) => parseLog(s.must(["log", "--reverse", LOG_FORMAT, ref, "--", ...paths])),
    show: (commit, path) => {
      const r = s.git(["rev-parse", "--verify", "--quiet", `${commit}:${path}`]);
      if (r.status !== 0) return undefined;
      const sha = r.stdout.toString().trim();
      const tree = s.must(["rev-parse", `${commit}^{tree}`]).trim();
      if (!s.ensureBlobs(tree, [sha])) throw new Error(`could not fetch ${path} at ${commit.slice(0, 12)}`);
      return s.blobText(sha);
    },
  };
}

/** A checkout that keeps `beans/` in its own history (before the cutover). Paths are repository-relative. */
export function checkoutReader(repoRoot: string): GitReader {
  const git = (args: string[]): { status: number; out: string } => {
    // input-site: traced #41eea77d — git history of the checkout, read for a bean's history
    inputSiteReached("work-plan history: checkout git");
    const r = spawnSync("git", ["-C", repoRoot, ...args], { encoding: "utf8", maxBuffer: 1 << 28 });
    return { status: r.status ?? 128, out: r.stdout ?? "" };
  };
  if (git(["rev-parse", "--git-dir"]).status !== 0) throw new Error(`${repoRoot} is not a git checkout, so the bean's history cannot be read`);
  return {
    log: (paths) => {
      const r = git(["log", "--reverse", LOG_FORMAT, "HEAD", "--", ...paths]);
      if (r.status !== 0) throw new Error(`git log in ${repoRoot} failed`);
      return parseLog(r.out);
    },
    show: (commit, path) => {
      const r = git(["show", `${commit}:${path}`]);
      return r.status === 0 ? r.out : undefined;
    },
  };
}
