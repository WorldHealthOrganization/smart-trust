#!/usr/bin/env bun
/**
 * The integrated QA page of ONE checkout, as a standalone page in that
 * checkout's own published site.
 *
 * `qa-page.ts` draws the integrated QA page (one section per QA axis) for
 * every instance the platform's docs site mounts. A folio that is not an
 * instance of the platform's index (qou consumes the platform; it is not in
 * its lock) gets no page there, so this draws the SAME panel —
 * {@link qaIntegratedPanel}, unchanged — into the folio's own site:
 *
 * ```
 * <out>/index.html   the panel and its script; the results are read in the
 *                    browser from the checkout's qa-reports branch, at HEAD
 * ```
 *
 * Every input is read, none is written in: the instance's `name`, its
 * directory whose `graphTypologies` holds `qa` (its `path` and
 * `storage.branch`), its `qa` declaration (validated with
 * {@link QaDeclarationSchema}), the repository from the checkout's `origin`,
 * and the commit from its HEAD. The page then reads
 * `main/<HEAD>/manifest.json` from that branch and, on a 404, the newest
 * `main` entry labelled as another commit's, exactly as on the platform's site.
 *
 * No navbar: a folio's publish rails standalone pages
 * (`rail-standalone-pages.ts --foreign-site`).
 *
 * Usage:
 *   bun run scripts/qa-page-standalone.ts --repo <checkout> --out <site>/qa [--declaration <file>]
 *
 * Exit: 0 written; 2 the declaration names no qa directory kept on a branch,
 * or the checkout's origin or HEAD cannot be read (no page, said why).
 *
 * @module scripts/qa-page-standalone
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { QaDeclarationSchema, type QaDeclaration } from "../schemas/sdlc/qa-axis.ts";
import { qaIntegratedPanel, qaLiveSourceOf } from "./qa-page.ts";

function arg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** `owner/name` from a remote URL: https, ssh, or a proxied `.../git/<owner>/<repo>`. */
export function repositoryOf(remote: string): string | undefined {
  const m = /[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(remote.trim());
  return m ? `${m[1]}/${m[2]}` : undefined;
}

/** The `<name>.json` at the checkout root whose `name` is its own stem and which declares `directories`. */
export function findDeclaration(repo: string): string | undefined {
  for (const f of readdirSync(repo).filter((n) => n.endsWith(".json")).sort()) {
    try {
      const d = JSON.parse(readFileSync(join(repo, f), "utf8"));
      if (d && d.name === f.slice(0, -5) && Array.isArray(d.directories)) return join(repo, f);
    } catch {
      /* not a declaration */
    }
  }
  return undefined;
}

interface Dir {
  path: string;
  graphTypologies?: string[];
  storage?: { branch?: string };
}

export function standaloneQaPage(opts: { name: string; repository: string; ref: string; dir: Dir; qa?: QaDeclaration }): string | undefined {
  const src = qaLiveSourceOf(
    { name: opts.name, path: opts.dir.path, storage: opts.dir.storage?.branch } as Parameters<typeof qaLiveSourceOf>[0],
    { repository: opts.repository, ref: opts.ref },
  );
  if (!src) return undefined;
  const title = `QA: ${opts.name}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
body { margin: 0; padding: 1rem 1.5rem 3rem; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: Canvas; color: CanvasText; }
h1 { font-size: 1.5rem; margin: .5rem 0 .25rem; }
.sv-h2 { font-size: 1.15rem; margin: 1.2rem 0 .4rem; }
.sv-sub { font-size: .9rem; opacity: .8; }
table { border-collapse: collapse; } th, td { text-align: left; padding: .25rem .5rem; border-bottom: 1px solid rgba(127,127,127,.3); }
</style>
</head>
<body>
<h1>${esc(title)}</h1>
<p class="sv-sub">Every QA axis this instance publishes, read from its <code>${esc(src.branch)}</code> branch for commit <code>${esc(opts.ref.slice(0, 7))}</code>.</p>
${qaIntegratedPanel(src, { decl: opts.qa })}
</body>
</html>
`;
}

function git(repo: string, args: string[]): string | undefined {
  const r = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : undefined;
}

function main(): number {
  const repo = resolve(arg("repo") ?? process.cwd());
  const out = arg("out");
  if (!out) {
    console.error("qa-page-standalone: --out <dir> is required");
    return 2;
  }
  const declPath = arg("declaration") ?? findDeclaration(repo);
  if (!declPath || !existsSync(declPath)) {
    console.error(`qa-page-standalone: no instance declaration in ${repo}; pass --declaration`);
    return 2;
  }
  const decl = JSON.parse(readFileSync(declPath, "utf8")) as { name: string; directories: Dir[]; qa?: unknown };
  const dir = decl.directories.find((d) => d.graphTypologies?.includes("qa"));
  if (!dir?.storage?.branch) {
    console.error(`qa-page-standalone: ${declPath} declares no qa directory kept on a branch; no page`);
    return 2;
  }
  let qa: QaDeclaration | undefined;
  if (decl.qa !== undefined) {
    const r = QaDeclarationSchema.safeParse(decl.qa);
    if (!r.success) {
      console.error(`qa-page-standalone: ${declPath} \`qa\` does not parse: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
      return 2;
    }
    qa = r.data;
  }
  const remote = git(repo, ["remote", "get-url", "origin"]);
  const repository = remote ? repositoryOf(remote) : undefined;
  const ref = git(repo, ["rev-parse", "HEAD"]);
  if (!repository || !ref) {
    console.error(`qa-page-standalone: cannot read ${repo}'s origin or HEAD; no page`);
    return 2;
  }
  const html = standaloneQaPage({ name: decl.name, repository, ref, dir, qa });
  if (!html) {
    console.error(`qa-page-standalone: ${repository}@${ref} with branch ${dir.storage.branch} is not a readable source; no page`);
    return 2;
  }
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "index.html"), html);
  console.log(`qa-page-standalone: ${join(out, "index.html")} (${repository}@${ref.slice(0, 7)}, ${dir.storage.branch}, ${qa?.writers?.length ?? 0} declared writer(s))`);
  return 0;
}

if (import.meta.main) process.exit(main());
