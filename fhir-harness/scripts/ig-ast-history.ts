/**
 * An IG's AST VERSIONS, read off its cache branch, for a resource's History
 * view (owner, 2026-11-10, "A"; fhir-harness#329).
 *
 * @module fhir-harness/scripts/ig-ast-history
 * @covers none — a build step that lists cache commits; it judges no declared graph
 *
 * Since #326 each `ig-cache.sh seed` is a child of the branch's previous tip,
 * so the branch's history IS the list of ASTs the IG was built from. Each
 * seed's subject names the source commit it was compiled from
 * (`... | src <sha8>`). A release is a tag on the IG's repository; a tag whose
 * commit an AST was compiled from names that version.
 *
 * The site serves the list as `fhir-artifact-index/ast-history.json`
 * ({@link AST_HISTORY_FILE}), so the browser never calls the GitHub API (60
 * requests an hour without a sign-in). A thin page reads one version's
 * resource from raw.githubusercontent.com at that commit, after looking its
 * file up in that commit's `manifest.json` (a resource's file name carries
 * its content hash, so it changes between versions).
 *
 * Releases cut before #326 have no AST commit left on the branch: their AST is
 * in the release's `ast-data.zip`, which a browser cannot read (GitHub's
 * release downloads send no CORS header). They are listed by
 * `releases.json` without an `ast` and the History view does not offer them.
 *
 * Nothing here knows about any one IG (fhir-harness/AGENTS.md).
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

/** Where the site serves the versions, beside the artefact index. */
export const AST_HISTORY_FILE = "fhir-artifact-index/ast-history.json";
export const AST_HISTORY_TAG = "ig-ast-history/v1" as const;
/** How many seeds back the list goes. */
export const AST_HISTORY_DEPTH = 100;

export interface AstVersion {
  /** The cache branch commit holding this AST. */
  commit: string;
  /** The IG source commit it was compiled from, as the seed recorded it (8 or more hex digits). */
  src?: string;
  /** The seed's commit time, ISO 8601. */
  date: string;
  /** The IG's tags on that source commit: its releases. */
  tags?: string[];
}

export interface AstHistory {
  $schema: typeof AST_HISTORY_TAG;
  /** `owner/repo` the cache branch is on. */
  repository: string;
  /** Newest first: the first is the AST this site was built from. */
  versions: AstVersion[];
}

/** The source commit a seed subject names, or undefined (`ig-cache.sh` `seed_subject`). */
export function seedSource(subject: string): string | undefined {
  return /\|\s*src\s+([0-9a-f]{7,40})\s*$/.exec(subject)?.[1];
}

/** `git log --format=%H%x09%cI%x09%s` output, as versions, newest first. Lines that are not a seed are skipped. */
export function parseSeedLog(text: string): AstVersion[] {
  const out: AstVersion[] = [];
  for (const line of text.split("\n")) {
    const [commit, date, ...rest] = line.split("\t");
    if (!commit || !/^[0-9a-f]{40}$/.test(commit) || !date) continue;
    const subject = rest.join("\t");
    if (!/^AST\s/.test(subject)) continue;
    const src = seedSource(subject);
    out.push({ commit, date, ...(src ? { src } : {}) });
  }
  return out;
}

/** `git ls-remote --tags` output as sha → tag names; an annotated tag's peeled commit (`^{}`) is the one kept. */
export function tagsBySha(text: string): Map<string, string[]> {
  const direct = new Map<string, string>();
  const peeled = new Map<string, string>();
  for (const line of text.split("\n")) {
    const m = /^([0-9a-f]{40})\s+refs\/tags\/(.+?)(\^\{\})?$/.exec(line.trim());
    if (!m) continue;
    (m[3] ? peeled : direct).set(m[2]!, m[1]!);
  }
  const out = new Map<string, string[]>();
  for (const [tag, sha] of direct) {
    const at = peeled.get(tag) ?? sha;
    out.set(at, [...(out.get(at) ?? []), tag].sort());
  }
  return out;
}

/** Each version's tags: those on a commit its recorded source names (a prefix match on the recorded digits). */
export function withTags(versions: readonly AstVersion[], tags: Map<string, string[]>): AstVersion[] {
  return versions.map((v) => {
    if (!v.src) return v;
    const hit = [...tags].filter(([sha]) => sha.startsWith(v.src!)).flatMap(([, t]) => t);
    return hit.length ? { ...v, tags: [...new Set(hit)].sort() } : v;
  });
}

/**
 * The versions behind `commit` (the AST this site was built from), from the
 * IG checkout's `remote`: the commits only (`--filter=tree:0`), never their
 * files, then the IG's tags. Undefined when git cannot read them.
 */
export function readAstHistory(o: { ig: string; commit: string; repository: string; remote?: string; depth?: number }): AstHistory | undefined {
  const remote = o.remote ?? "origin";
  const git = (...a: string[]) => spawnSync("git", ["-C", o.ig, ...a], { encoding: "utf-8" });
  const ref = "refs/ig-ast-history";
  const f = git("fetch", "-q", "--filter=tree:0", `--depth=${o.depth ?? AST_HISTORY_DEPTH}`, remote, `+${o.commit}:${ref}`);
  if (f.status !== 0) return undefined;
  try {
    const log = git("log", "--format=%H%x09%cI%x09%s", ref);
    if (log.status !== 0) return undefined;
    const versions = parseSeedLog(log.stdout);
    if (!versions.length) return undefined;
    const t = git("ls-remote", "--tags", remote);
    return { $schema: AST_HISTORY_TAG, repository: o.repository, versions: withTags(versions, t.status === 0 ? tagsBySha(t.stdout) : new Map()) };
  } finally {
    git("update-ref", "-d", ref);
  }
}

/**
 * Each release's AST commit, for `releases.json` (#329 step 1): the newest
 * version whose recorded source is the commit the release's tag names.
 * Undefined for a release no seed was compiled from (before #326, or a build
 * that was not seeded).
 */
export function astCommitOfTag(history: Pick<AstHistory, "versions">, tag: string): string | undefined {
  return history.versions.find((v) => v.tags?.includes(tag))?.commit;
}

/**
 * `releases.json` with each release's {@link astCommitOfTag} recorded as
 * `ast.commit` (#329 step 1); a release with none keeps no `ast`. Returns how
 * many releases name one. The file is rewritten only when that changes it.
 */
export function annotateReleases(file: string, history: Pick<AstHistory, "versions">): number {
  const doc = JSON.parse(readFileSync(file, "utf-8")) as { releases?: Array<{ tag: string; ast?: { commit: string } }> };
  let n = 0;
  for (const r of doc.releases ?? []) {
    const commit = astCommitOfTag(history, r.tag);
    if (commit) {
      r.ast = { commit };
      n += 1;
    } else delete r.ast;
  }
  const text = `${JSON.stringify(doc, null, 2)}\n`;
  if (text !== readFileSync(file, "utf-8")) writeFileSync(file, text);
  return n;
}
