/**
 * A change set's preview follows main (owner, 2026-11-02 07:32Z: "log
 * watcher should make sure all previews get updated if upstream changes on
 * main"; 07:34Z: "actually automatic (as the default mode)"). A preview is
 * built from its PR's head, so once main moves on, a PR that lacks main's
 * head shows a document main no longer is. By default (Config
 * PREVIEW_REFRESH `automatic`) the watcher runs this on every poll for every
 * open change set; with `on-feedback`, only in the agent pass for a change
 * set people acted on. People's feedback triggers it in either mode (new
 * Blue feedback, Ready for agent = Yes, or an ask, see `previewRequest`).
 * For each PR behind it merges main into the branch (a merge commit, never
 * a rebase, so nobody's checkout breaks), pushes, and lets the staging
 * build run.
 *
 * A PR is left alone when it is closed, or when its head is not in its own
 * repository (a fork: the watcher cannot push there). A conflict is not
 * resolved here: the watcher resolves it if both sides are mechanical
 * (generated files), and otherwise asks in the change set's feedback cell.
 *
 * It reads GitHub and writes nothing. Skill: `review-log-watch`
 * ("Previews follow main"). Process: `processes/content/review-log-watch.bpmn`.
 *
 *   bun tools/review-log-watch/previews.ts --prs <owner/repo#n,...>
 *   bun tools/review-log-watch/previews.ts --agent <Agent - Change Sets values.json>
 *   bun tools/review-log-watch/previews.ts request --text <a person's feedback>
 *
 * Exit 0: every open PR includes main's head. Exit 10: some are behind (or
 * conflict); the JSON lists them with the step to take.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { prKey, rowsOf } from "./lint.js";

export type PrFacts = {
  key: string;
  state: "open" | "closed";
  base: string;
  /** Commits on the base the head lacks (GitHub compare `behind_by`). */
  behind: number;
  /**
   * GitHub's mergeable_state, a hint only (bean fx5r: it can serve a stale
   * value for a long time). Only "dirty" is used, to name a likely conflict;
   * the merge of main into the branch is what settles it.
   */
  mergeable: string;
  fork: boolean;
};
export type PreviewStep = { key: string; behind: number; step: "merge-main" | "resolve-conflict" | "none"; why: string };

/** What to do for each PR, from its facts. */
export function previewSteps(prs: PrFacts[]): PreviewStep[] {
  return prs.filter(p => p.state === "open" && !p.fork).map(p => {
    if (p.mergeable === "dirty")
      return { key: p.key, behind: p.behind, step: "resolve-conflict", why: `conflicts with ${p.base}: merge ${p.base} in and resolve, or ask in the change set's feedback if a person must choose` };
    if (p.behind > 0)
      return { key: p.key, behind: p.behind, step: "merge-main", why: `${p.behind} commit(s) behind ${p.base}: merge ${p.base} into the branch, push, and let the preview rebuild` };
    return { key: p.key, behind: 0, step: "none", why: `includes ${p.base}'s head` };
  });
}

export type RefreshMode = "automatic" | "on-feedback";
/** The log's PREVIEW_REFRESH Config value; automatic unless it says on-feedback. */
export function refreshMode(value?: string | null): RefreshMode {
  return /on[- ]?feedback|manual|human/i.test(String(value ?? "")) ? "on-feedback" : "automatic";
}
/** Whether this poll checks a change set's previews: always in automatic mode, else only when people acted on it. */
export function shouldCheck(mode: RefreshMode, peopleActed: boolean): boolean {
  return mode === "automatic" || peopleActed;
}

/** Whether a person's feedback asks for the preview to be brought up to date with main. */
export function previewRequest(text: string): boolean {
  return /\b(update|refresh|rebuild|redo|regenerate)\b[^\n]*\b(preview|staging)\b|\b(preview|staging)\b[^\n]*\b(out of date|stale|behind|old)\b|\b(rebase|merge|catch up|bring)\b[^\n]*\b(on|with|from|up to date with|in)\s+main\b/i.test(String(text ?? ""));
}

const gh = (path: string) => JSON.parse(execFileSync("gh", ["api", path], { encoding: "utf8" }));

/** Read one PR's facts from GitHub (REST only). */
export function factsOf(key: string): PrFacts {
  const [repo, n] = key.split("#");
  const pr = gh(`repos/${repo}/pulls/${n}`);
  let behind = 0;
  if (pr.state === "open") {
    const cmp = gh(`repos/${repo}/compare/${encodeURIComponent(pr.base.ref)}...${pr.head.sha}`);
    behind = cmp.behind_by ?? 0;
  }
  return {
    key, state: pr.state, base: pr.base.ref, behind,
    // A hint only, possibly stale (bean fx5r); the merge itself settles a conflict.
    mergeable: pr.mergeable_state ?? "unknown",
    fork: pr.head?.repo?.full_name !== pr.base?.repo?.full_name,
  };
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (import.meta.main && process.argv[2] === "request") {
  console.log(JSON.stringify({ request: previewRequest(arg("text") ?? readFileSync(0, "utf8")) }));
  process.exit(0);
}
if (import.meta.main) {
  let keys: string[] = [];
  if (arg("prs")) keys = arg("prs")!.split(",").map(s => s.trim()).filter(Boolean);
  else if (arg("agent")) {
    const raw = JSON.parse(readFileSync(arg("agent")!, "utf8"));
    const values: string[][] = Array.isArray(raw) ? raw : raw.values ?? [];
    keys = rowsOf(values).flatMap(r => (r["Pull request (change set)"] ?? "").split(/\s+/)).map(prKey).filter((k): k is string => !!k);
  } else {
    console.error("usage: previews.ts --prs <owner/repo#n,...> | --agent <Agent - Change Sets values.json> | request --text <feedback>");
    process.exit(2);
  }
  const steps = previewSteps([...new Set(keys)].map(factsOf));
  const todo = steps.filter(s => s.step !== "none");
  console.log(JSON.stringify({ status: todo.length ? "behind" : "current", prs: steps }, null, 2));
  process.exit(todo.length ? 10 : 0);
}
