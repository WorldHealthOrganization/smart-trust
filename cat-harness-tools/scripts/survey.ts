#!/usr/bin/env bun
/**
 * Publish a survey of a commit window, and ask what a later session still owes.
 *
 * A published sweep lets the next session read it instead of re-deriving it.
 * The window's two edge commits are recorded, so staleness is DECIDABLE
 * rather than guessed.
 *
 * ```sh
 * bun run cat survey:owed                     # what is NOT covered, against origin/main
 * bun run cat survey:publish --from <sha> --axis beans="…" --axis ci="…"
 * ```
 *
 * ## `survey:owed` answers in three states
 *
 * - **no survey** — nothing published; the full window is yours. Not an error.
 * - **covered** — `to` is at or ahead of the branch tip; read the survey.
 * - **a delta** — `to..origin/main`, the commits published surveys do not
 *   cover. Normally a handful. Survey THOSE.
 *
 * ## An unreachable `to` is COULD NOT DETERMINE, never "covered"
 *
 * If the recorded upper edge is not an ancestor of the branch tip — history
 * rewritten, the survey taken on a different branch, the object gone — then
 * the delta cannot be computed and the survey says nothing about today. It is
 * reported as unusable and the caller surveys the whole window; a sibling
 * must never skip the sweep on a survey of a history that no longer exists.
 * The falsification test plants exactly that.
 *
 * @module folio-assistant/scripts/survey
 * @covers session-survey
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { BEAN_GRAPH_FILE, DEFAULT_BEAN_GRAPH_ROOT, parseBeanGraph } from "../schemas/sdlc/bean-graph.ts";
import {
  SESSION_SURVEY_TAG,
  SessionSurveySchema,
  type SessionSurvey,
} from "../schemas/sdlc/session-survey.ts";
import { ancestorOr, isAncestor } from "./git-ancestry.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { dirname } from "node:path";

export const ROOT = resolve(dirname(HARNESS_ROOT));

function git(args: readonly string[], cwd = ROOT): { ok: boolean; out: string } {
  const r = spawnSync("git", args, { cwd, encoding: "utf-8" });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}

/**
 * Where surveys live — the declared `surveys` node of the bean graph.
 *
 * Every path segment comes from a declaration rather than a literal:
 * `DEFAULT_BEAN_GRAPH_ROOT` and `BEAN_GRAPH_FILE` are the graph's own constants,
 * and the leaf is the node's `path`. Writing `beans/surveys` here would be a
 * second answer to a question the graph already answers, which is what
 * `check:declared-paths` exists to refuse — and it did refuse the first draft
 * of this function.
 */
export function surveyDir(root = ROOT): string {
  const graphRoot = join(root, DEFAULT_BEAN_GRAPH_ROOT);
  const graph = parseBeanGraph(JSON.parse(readFileSync(join(graphRoot, BEAN_GRAPH_FILE), "utf-8")));
  const node = graph.directories.find((d) => d.id === "surveys");
  if (!node) throw new Error("bean graph declares no `surveys` node — bean `6ptx`");
  return join(graphRoot, node.path);
}

/** Every published survey, newest window last. Empty is a determined empty. */
export function readSurveys(root = ROOT): SessionSurvey[] {
  const dir = surveyDir(root);
  if (!existsSync(dir)) return [];
  const out: SessionSurvey[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith(".json")) continue;
    const raw = JSON.parse(readFileSync(join(dir, name), "utf-8")) as unknown;
    // A file that does not declare itself is not a survey. Extension is a
    // coincidence; the `$schema` tag is the contract.
    if ((raw as { $schema?: string }).$schema !== SESSION_SURVEY_TAG) continue;
    out.push(SessionSurveySchema.parse(raw));
  }
  return out;
}

/** What a session still owes, given what has been published. */
export type Owed =
  | { kind: "no-survey"; tip: string }
  | { kind: "covered"; survey: SessionSurvey; tip: string }
  | { kind: "delta"; survey: SessionSurvey; from: string; tip: string; commits: number }
  | { kind: "unusable"; survey: SessionSurvey; why: string; tip: string };

/**
 * The uncovered window against `ref`.
 *
 * Picks the survey whose `to` is FURTHEST ALONG rather than the most recent by
 * timestamp: a survey taken later of an older window covers less, and dates do
 * not order commits. Only surveys whose `to` is an ancestor of the tip are
 * candidates, so a rewritten history cannot win the comparison.
 */
export function owed(ref = "origin/main", root = ROOT): Owed {
  const tip = git(["rev-parse", ref], root);
  if (!tip.ok) throw new Error(`cannot resolve ${ref}: ${tip.out}`);
  const head = tip.out;

  const surveys = readSurveys(root);
  if (surveys.length === 0) return { kind: "no-survey", tip: head };

  // NOT `git(...).ok`. A non-zero exit is two facts, not one: on a shallow
  // clone a missing commit exits 128, so a survey whose upper edge IS an
  // ancestor reads as unreachable — and `owed` then reports the window
  // unsurveyed. `isAncestor` deepens before answering and says so when it
  // still cannot tell.
  const judged = surveys.map((s) => ({ s, anc: isAncestor(root, s.to, head) }));
  const reachable = judged.filter((j) => j.anc.known && j.anc.ancestor).map((j) => j.s);
  const unknown = judged.filter((j) => !j.anc.known);

  if (reachable.length === 0) {
    const s = surveys[surveys.length - 1]!;
    // The old `why` named two causes and guessed between them. A third was
    // missing and is the common one here, so it is stated rather than implied —
    // and only when it actually applies, because telling somebody their
    // history was rewritten when the checkout was merely shallow sends them to
    // the wrong place.
    const why =
      unknown.length > 0
        ? `no published survey's upper edge could be shown to be an ancestor of ${ref}, and ` +
          `${unknown.length} of ${surveys.length} could not be evaluated at all ` +
          `(${unknown[0]!.anc.known === false ? unknown[0]!.anc.reason : ""}). ` +
          `A shallow checkout cannot answer this; deepen it before concluding the surveys are unusable.`
        : `no published survey's upper edge is an ancestor of ${ref}. The history was ` +
          `rewritten, or they were taken on another branch. Survey the whole window.`;
    return { kind: "unusable", survey: s, tip: head, why };
  }

  // Furthest along = the one every other reachable survey's `to` precedes.
  // `unknown` keeps the incumbent: this is a tie-break among surveys already
  // proven reachable, so an unanswerable comparison must not promote `b`.
  const best = reachable.reduce((a, b) => (ancestorOr(isAncestor(root, a.to, b.to), false) ? b : a));
  if (best.to === head) return { kind: "covered", survey: best, tip: head };

  const count = git(["rev-list", "--count", `${best.to}..${head}`], root);
  return {
    kind: "delta",
    survey: best,
    from: best.to,
    tip: head,
    commits: count.ok ? Number(count.out) : Number.NaN,
  };
}

/** `--axis name=finding`, repeatable. `name=!reason` records NOT covered. */
function axesFrom(argv: readonly string[]): SessionSurvey["axes"] {
  const out: SessionSurvey["axes"] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== "--axis") continue;
    const v = argv[i + 1] ?? "";
    const eq = v.indexOf("=");
    if (eq <= 0) continue;
    const axis = v.slice(0, eq);
    const rest = v.slice(eq + 1);
    const skipped = rest.startsWith("!");
    out.push({ axis, covered: !skipped, finding: skipped ? rest.slice(1) : rest });
  }
  return out;
}

function flag(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : undefined;
}

function publish(argv: readonly string[]): number {
  const ref = flag(argv, "--ref") ?? "origin/main";
  const tip = git(["rev-parse", ref]);
  if (!tip.ok) {
    console.error(`::error::survey: cannot resolve ${ref} — COULD NOT DETERMINE.`);
    return 2;
  }
  const fromArg = flag(argv, "--from");
  if (!fromArg) {
    console.error("::error::survey: --from <sha> is required. It is the window's lower edge.");
    return 1;
  }
  const from = git(["rev-parse", fromArg]);
  if (!from.ok) {
    console.error(`::error::survey: cannot resolve --from ${fromArg}.`);
    return 1;
  }
  const axes = axesFrom(argv);
  if (axes.length === 0) {
    console.error(
      "::error::survey: at least one --axis name=finding is required.\n" +
        "A survey that covered nothing is not a survey. Use name=!reason to record an axis " +
        "you deliberately did NOT look at — that is a real answer and a reader needs it.",
    );
    return 1;
  }
  const count = git(["rev-list", "--count", `${from.out}..${tip.out}`]);
  const survey: SessionSurvey = {
    $schema: SESSION_SURVEY_TAG,
    from: from.out,
    to: tip.out,
    branch: ref,
    takenAt: new Date().toISOString(),
    by: flag(argv, "--by") ?? "unknown",
    commits: count.ok ? Number(count.out) : 0,
    axes,
  };
  SessionSurveySchema.parse(survey);
  const dir = surveyDir();
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${survey.to.slice(0, 12)}.json`);
  writeFileSync(file, `${JSON.stringify(survey, null, 2)}\n`);
  console.log(`survey published: ${survey.commits} commit(s), ${axes.length} axis(es) -> ${file}`);
  return 0;
}

function report(): number {
  const o = owed();
  switch (o.kind) {
    case "no-survey":
      console.log("survey: none published — the whole window is yours. (A determined empty.)");
      return 0;
    case "unusable":
      console.log(`survey: UNUSABLE — ${o.why}`);
      return 0;
    case "covered":
      console.log(
        `survey: COVERED to ${o.tip.slice(0, 12)} by ${o.survey.by} (${o.survey.takenAt}).\n` +
          `  Read it instead of re-deriving: ${o.survey.commits} commit(s), ` +
          `${o.survey.axes.length} axis(es).`,
      );
      for (const a of o.survey.axes) {
        console.log(`  ${a.covered ? "·" : "✗"} ${a.axis}: ${a.finding}`);
      }
      return 0;
    case "delta":
      console.log(
        `survey: ${o.commits} commit(s) NOT covered — ${o.from.slice(0, 12)}..${o.tip.slice(0, 12)}.\n` +
          `  A survey by ${o.survey.by} covers everything before that. Survey only the delta.`,
      );
      return 0;
  }
}

function main(): number {
  const argv = process.argv.slice(2);
  return argv.includes("--publish") ? publish(argv) : report();
}

if (import.meta.main) process.exit(main());
