/**
 * Record an IG repository's GitHub releases in its layer's
 * `fhir-artifact-index/releases.json` (`ig-releases/v1`): pointers to the
 * release's binary assets, never the bytes (bean `b8ip`, skill
 * `ig-binary-artefacts`).
 *
 *   bun run fhir-harness/scripts/ingest-ig-releases.ts --instance <dir> [--repo owner/repo] [--from releases.json] [--as-of <ISO time>]
 *
 * `--repo` defaults to the repository the layer's `menu.json` records the
 * IG source from, else the layer declaration's `repository`. `--from` reads
 * a saved GitHub API response instead of asking the API, for a run with no
 * network. Re-running rewrites the file: GitHub is the authority on what a
 * release carries, and this is a record of it on the day it was read.
 * `--as-of` records the releases as they stood at that time instead (those
 * published at or before it), stamped with its date: `ig-index:build` passes
 * the pinned commit's time, so the same pin writes the same file any day.
 *
 * @covers fhir-artifact-index
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { type GitHubRelease, releasesAsOf, releasesFromGitHub } from "../schemas/ig-releases.ts";
import { declarationPathIn } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";
import { indexReadPath, indexWritePath } from "./lib/ig-index-at.ts";

/** `owner/repo` from a GitHub URL or an `owner/repo` string. */
export function repoSlug(s: string): string | undefined {
  const m = /^(?:https?:\/\/github\.com\/)?([^/\s]+\/[^/\s#?]+?)(?:\.git)?\/?$/.exec(s.trim());
  return m?.[1];
}

/** Where a layer's IG source lives: its menu's recorded source, else its declaration. */
export function instanceRepo(root: string): string | undefined {
  const menu = indexReadPath(root, "menu.json");
  if (existsSync(menu)) {
    const of = (JSON.parse(readFileSync(menu, "utf-8")) as { source?: { of?: string } }).source?.of;
    if (of && repoSlug(of)) return repoSlug(of);
  }
  // The declaration is the file whose stem equals its own `name`, not
  // `<directory>.json`: a separated IG keeps its data under the DAK layer's directory name.
  const decl = declarationPathIn(root);
  if (decl !== undefined) {
    const r = (JSON.parse(readFileSync(decl, "utf-8")) as { repository?: string }).repository;
    if (r) return repoSlug(r);
  }
  return undefined;
}

async function fetchReleases(repo: string): Promise<GitHubRelease[]> {
  const out: GitHubRelease[] = [];
  for (let page = 1; ; page++) {
    const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=100&page=${page}`, { headers });
    if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${repo}'s releases`);
    const batch = (await res.json()) as GitHubRelease[];
    out.push(...batch);
    if (batch.length < 100) return out;
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (f: string) => {
    const i = args.indexOf(f);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const instance = opt("--instance");
  if (!instance) {
    console.error("usage: ingest-ig-releases.ts --instance <dir> [--repo owner/repo] [--from releases.json]");
    process.exit(2);
  }
  const root = resolve(instance);
  const repo = opt("--repo") ? repoSlug(opt("--repo")!) : instanceRepo(root);
  if (!repo) {
    console.error(`${instance}: no repository recorded (menu.json source or declaration) — pass --repo`);
    process.exit(2);
  }
  const list = opt("--from") ? (JSON.parse(readFileSync(opt("--from")!, "utf-8")) as GitHubRelease[]) : await fetchReleases(repo);
  const asOf = opt("--as-of");
  const rec = asOf ? releasesAsOf(repo, asOf, list) : releasesFromGitHub(repo, new Date().toISOString().slice(0, 10), list);
  // The layer's output root: build/layers/<instance>/ for a mounted layer (bean `sm8r` item 4).
  const at = indexWritePath(root, "releases.json");
  mkdirSync(dirname(at), { recursive: true });
  writeFileSync(at, `${JSON.stringify(rec, null, 2)}\n`);
  const assets = rec.releases.reduce((n, r) => n + r.assets.length, 0);
  console.log(`${repo}: ${rec.releases.length} release(s), ${assets} asset pointer(s) → ${at}`);
}
