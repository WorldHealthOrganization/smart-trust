#!/usr/bin/env bun
/**
 * The OUTPUT of rendering a Knowledge Graph to GitHub Pages: the status of the
 * push, and one message that carries the deployed commit and the QA result.
 *
 * @module bootstrap-tools/scripts/pages-status
 * @covers code
 *
 * The last step of `processes/render-kg-to-github-pages.bpmn` (skill
 * `render-kg-to-github-pages`): ONE answer a caller can act on, whether the
 * push landed. It runs nothing new: it stages with
 * `stageSite` (the QA of what was pushed), asks the publication root URL and
 * each document address with `httpAnswer` (the QA of what is served), and
 * names the commit.
 *
 * ## Three states, never two
 *
 * - `pushed` — the staged tree has no problem, the root URL answers, its
 *   README page (`README.html`) answers, and every document address answers;
 * - `not-pushed` — something checked and failed: a staging problem (so
 *   nothing should have been pushed), the root URL or a document address
 *   answering 404;
 * - `could-not-determine` — nothing failed, but an answer came back about the
 *   way HERE rather than about the site (403, 407, 5xx, no network). Never
 *   rendered as `pushed`: a check that could not look is not a pass.
 *
 * ## The message
 *
 * One line a caller can post as it stands — on a pull request, in a log, to
 * the person who asked:
 *
 * `pushed 1a2b3c4 to https://owner.github.io/repo/ — QA: staged ok (120 files, 7 documents); root 200; README.html 200; documents 7/7 answer`
 *
 * The commit is the one the site was built from: `--sha`, or the root's
 * `HEAD`. A site here is served from the `gh-pages` BRANCH, so pass the
 * commit on that branch — the answer to "which bytes are live".
 *
 * Exit status: 0 `pushed`, 1 `not-pushed`, 3 `could-not-determine`, 2 no
 * declaration and no `--url` — there is no address to ask.
 *
 * Usage: bun run bootstrap-tools/scripts/pages-status.ts --root <instance> [--url <publication root>] [--sha <commit>] [--subgraph <id>]… [--offline] [--json]
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readKnowledgeGraphDeclaration } from "../schemas/declaration.ts";
import { httpAnswer, offlineProbe, ownerRepo, realProbe, type Probe, type StepState } from "./init.ts";
import { publishedDocuments, stageSite, subgraphSelection } from "./site.ts";

export type PushStatus = "pushed" | "not-pushed" | "could-not-determine";

export interface PagesStatus {
  status: PushStatus;
  /** Always `github-pages`: the CDN this tool pushes to. */
  target: "github-pages";
  /** The publication root URL asked. */
  url: string;
  /** The commit the live bytes were built from, when known. */
  sha?: string;
  qa: {
    staged: { state: StepState; files: number; documents: number; problems: string[] };
    root: { state: StepState; http?: number };
    /** The README page, `<root>README.html`, where the README lands (owner, 2026-10-01). */
    readme: { state: StepState; http?: number };
    documents: { answering: number; total: number; missing: string[]; unchecked: string[] };
  };
  /** One line, postable as it stands. */
  message: string;
}

/** The publication root URL: `--url`, else the declaration's `iriBase`, else its Pages address. */
export function publicationRoot(decl: Record<string, unknown> | undefined, url?: string): string | undefined {
  const pick = url ?? (typeof decl?.["iriBase"] === "string" ? (decl["iriBase"] as string) : undefined);
  if (pick) return pick.replace(/\/?$/, "/");
  const o = ownerRepo(decl?.["repository"]);
  return o ? `https://${o.owner.toLowerCase()}.github.io/${o.repo}/` : undefined;
}

/** Combine the three QA answers into the push's status. A failure outranks an unknown; an unknown outranks a pass. */
export function pushStatus(states: readonly StepState[]): PushStatus {
  if (states.includes("not-done")) return "not-pushed";
  if (states.includes("could-not-determine")) return "could-not-determine";
  return "pushed";
}

export async function pagesStatus(
  root: string,
  opts: { url?: string; sha?: string; probe?: Probe; subgraphs?: readonly string[] } = {},
): Promise<PagesStatus | undefined> {
  const decl = readKnowledgeGraphDeclaration(root) as Record<string, unknown> | undefined;
  const url = publicationRoot(decl, opts.url);
  if (!url) return undefined;
  const probe = opts.probe ?? realProbe;

  const keep = subgraphSelection((decl ?? {}) as { directories?: { id: string; path: string }[] }, opts.subgraphs).keep ?? (() => true);
  const docs = publishedDocuments(root).filter((d) => !d.source || keep(d.source));

  // QA of what is pushed: stage it where nothing is kept, and keep the problems.
  const tmp = mkdtempSync(join(tmpdir(), "pages-status-"));
  let staged: PagesStatus["qa"]["staged"];
  try {
    const r = stageSite(root, tmp, { subgraphs: opts.subgraphs });
    staged = { state: r.problems.length ? "not-done" : "done", files: r.written.length, documents: docs.length, problems: r.problems };
  } catch (e) {
    staged = { state: "not-done", files: 0, documents: 0, problems: [(e as Error).message] };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  // QA of what is served: the root, then each document at its own address.
  const http = await probe.httpStatus(url);
  const rootState = httpAnswer(http);
  const readmeHttp = await probe.httpStatus(`${url}README.html`);
  const readmeState = httpAnswer(readmeHttp);
  const answers = await Promise.all(docs.map(async (d) => ({ iri: d.iri, state: httpAnswer(await probe.httpStatus(d.iri)) })));
  const documents = {
    answering: answers.filter((a) => a.state === "done").length,
    total: answers.length,
    missing: answers.filter((a) => a.state === "not-done").map((a) => a.iri),
    unchecked: answers.filter((a) => a.state === "could-not-determine").map((a) => a.iri),
  };
  const docState: StepState = documents.missing.length ? "not-done" : documents.unchecked.length ? "could-not-determine" : "done";

  let sha = opts.sha;
  if (!sha) {
    const g = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf-8" });
    if (g.status === 0) sha = g.stdout.trim();
  }
  const status = pushStatus([staged.state, rootState, readmeState, docState]);
  const word = { done: "ok", "not-done": "FAILED", "could-not-determine": "could not tell", stated: "stated" } as const;
  const message =
    `${status} ${sha ? sha.slice(0, 7) : "(commit unknown)"} to ${url} — QA: ` +
    `staged ${word[staged.state]} (${staged.files} files, ${staged.documents} documents${staged.problems.length ? `; ${staged.problems.join("; ")}` : ""}); ` +
    `root ${http ?? "unreachable"}; README.html ${readmeHttp ?? "unreachable"}; documents ${documents.answering}/${documents.total} answer` +
    (documents.missing.length ? `; missing: ${documents.missing.join(", ")}` : "") +
    (documents.unchecked.length ? `; ${documents.unchecked.length} could not be checked from here` : "");
  return { status, target: "github-pages", url, sha, qa: { staged, root: { state: rootState, http }, readme: { state: readmeState, http: readmeHttp }, documents }, message };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const arg = (f: string) => {
    const i = args.indexOf(f);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const root = arg("--root") ?? ".";
  const subgraphs = args.flatMap((a, i) => (a === "--subgraph" && args[i + 1] ? [args[i + 1]!] : []));
  const r = await pagesStatus(root, {
    url: arg("--url"),
    sha: arg("--sha"),
    subgraphs,
    probe: args.includes("--offline") ? offlineProbe : realProbe,
  });
  if (!r) {
    console.error(`✗ ${root}: no declaration naming an iriBase or a repository, and no --url — there is no publication root to ask.`);
    process.exit(2);
  }
  console.log(args.includes("--json") ? JSON.stringify(r, null, 2) : r.message);
  process.exit(r.status === "pushed" ? 0 : r.status === "not-pushed" ? 1 : 3);
}
