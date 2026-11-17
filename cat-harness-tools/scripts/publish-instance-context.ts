#!/usr/bin/env bun
/**
 * Build ONE layer's JSON-LD `@context` and publish it to that layer's
 * own GitHub Pages, at `<iriBase>ns/context/v1.jsonld` — or, for a layer
 * whose `ns` is a document (bootstrap's `ns.jsonld`), BESIDE it at
 * `<iriBase>ns.context.v1.jsonld` (`contextPathFor` in
 * `gen-instance-contexts.ts`). The path is the build's `path`, and
 * `publish --path` takes it, so the workflow never spells it.
 *
 * Each layer's context is published by its own repository, through one
 * reusable workflow (`.github/workflows/layer-publish-context.yml`), and
 * placeholder `gh-pages` branches are created so Pages can be switched on.
 *
 * ## Two subcommands, so the network half is testable on its own
 *
 * `build` runs `gen-instance-contexts`'s generator over the whole index (the
 * flattened `needs` tables need every ancestor present) and judges ONLY the
 * named layer: another layer's unresolved prefix is that layer's
 * repository's finding, and must not stop this one publishing. It writes the
 * context to `--out` and the outcome to `--report` (JSON) and exits:
 *
 *   0  built, or SKIPPED with a reason, printed as a warning (no `iriBase`, or no `.jsonld`
 *      documents — nothing to publish under, or nothing to publish);
 *   1  the layer's own findings (an unresolved or conflicting prefix, a
 *      malformed `jsonldPrefixes`), each named.
 *
 * `publish` puts that one file on the repository's `gh-pages` through the
 * GitHub REST API with the workflow's `GITHUB_TOKEN`:
 *
 *   - `gh-pages` present: `GET` the file; identical content is `unchanged`
 *     and nothing is written; otherwise one `PUT` to the contents API. It
 *     writes ONE path, so the rest of `gh-pages` (an IG build, a docs site)
 *     is left exactly as it was. The one delete: when a FILE sits where the
 *     path needs a directory (a hash-IRI vocabulary at `v0/ns`, left behind
 *     when its namespace became the slash IRI `v0/ns/`), and that file is a
 *     JSON document, it is removed so `v0/ns/index.*` can be written.
 *   - `gh-pages` absent: an ORPHAN branch holding `.nojekyll`, the context
 *     and a placeholder `index.html` (the same text `pages-bootstrap
 *     --provision` writes), made with the git-data API (tree, commit with no
 *     parent, ref). A ref created meanwhile by someone else is not
 *     overwritten: the 422 falls through to the update path.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/publish-instance-context.ts build --root fa --instance cat-harness --out ctx.jsonld [--report r.json]
 *   bun run cat-harness-tools/scripts/publish-instance-context.ts build --root . --instance dth-hrh --site <site source dir>
 *   GITHUB_TOKEN=… bun run cat-harness-tools/scripts/publish-instance-context.ts publish --repo litlfred/cat-harness --file ctx.jsonld [--sha <commit>]
 *
 * @module scripts/publish-instance-context
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { findDeclarationFile } from "../schemas/kg/cat-harness.js";

import { findings, generateInstanceContexts, INSTANCE_CONTEXT_PATH, NS_DOCUMENT_CONTEXT_PATH, readInstanceDecls, type GenerateOptions } from "./gen-instance-contexts.ts";
import { PLACEHOLDER_HTML } from "./pages-bootstrap.ts";
import { buildVocabulary, instancesPublishingNs } from "./ns-export.ts";

export const PAGES_BRANCH = "gh-pages";

export type BuildOutcome =
  | { kind: "built"; instance: string; iriBase: string; url: string; path: string; documents: number; bound: string[]; context: string }
  | { kind: "skipped"; instance: string; reason: string }
  | { kind: "failed"; instance: string; problems: string[] };

/** The declared `iriBase`, read as data, or `undefined`. */
function iriBaseOf(root: string): string | undefined {
  const file = findDeclarationFile(root);
  if (file === undefined) return undefined;
  try {
    const v = (JSON.parse(readFileSync(join(root, file), "utf-8")) as { iriBase?: unknown }).iriBase;
    return typeof v === "string" && v.length > 0 ? v : undefined;
  } catch {
    return undefined;
  }
}

/** `<iriBase><path>` (by default `ns/context/v1.jsonld`), with exactly one slash between. */
export function contextUrl(iriBase: string, path: string = INSTANCE_CONTEXT_PATH): string {
  return `${iriBase.replace(/\/+$/, "")}/${path}`;
}

/**
 * Build `instance`'s context over the index at `repoRoot`, judging only that
 * layer. Never throws for a finding; a broken `needs` graph (the
 * generator's throw) is reported as `failed`.
 */
export function buildOne(repoRoot: string, instance: string, options: GenerateOptions = {}): BuildOutcome {
  const root = resolve(repoRoot);
  const decl = readInstanceDecls(root).find((d) => d.name === instance);
  if (decl === undefined) return { kind: "failed", instance, problems: [`no instance named \`${instance}\` under ${root}`] };
  const iriBase = iriBaseOf(decl.root);
  if (iriBase === undefined) {
    return { kind: "skipped", instance, reason: `${instance} declares no iriBase, so it has no address to publish a context under` };
  }
  let result;
  try {
    result = generateInstanceContexts(root, options);
  } catch (e) {
    return { kind: "failed", instance, problems: [e instanceof Error ? e.message : String(e)] };
  }
  const report = result.reports.find((r) => r.instance === instance);
  if (report === undefined) return { kind: "failed", instance, problems: [`the generator reported no \`${instance}\``] };
  // Only this layer's findings. Drift is not one: what is on disk is
  // irrelevant to a context being built for publishing.
  const { problems } = findings({ reports: [report], unowned: [] });
  if (problems.length > 0) return { kind: "failed", instance, problems };
  if (report.expected === undefined) {
    return { kind: "skipped", instance, reason: `${instance} has no .jsonld documents, so its context would bind nothing` };
  }
  return {
    kind: "built",
    instance,
    iriBase,
    url: contextUrl(iriBase, decl.contextPath),
    path: decl.contextPath,
    documents: report.documents,
    bound: report.bound.map((b) => b.prefix),
    context: report.expected,
  };
}

// ── vocabulary ───────────────────────────────────────────────────

/**
 * The layer's own VOCABULARY, served where its term IRIs point.
 *
 * Owner, 2026-10-15 ("2 Serve vocab at own iriBase"): a term IRI is
 * `<iriBase>v<major>/ns/Term` (`cat-harness/schemas/kg/namespaces.ts`; slash
 * form since cat-harness-tools#1378, Q-SLASH-1 A), so the document
 * `<iriBase>v<major>/ns/` has to exist on the layer's own Pages or
 * every term it mints answers 404 — which was the state of two layers,
 * cat-harness one of them, when this was written (no `0.1.0/` on either
 * gh-pages).
 *
 * The path is read off the vocabulary's own `@id`, never composed here: the
 * document says where it lives, and a second spelling of that address is the
 * drift this repository keeps paying for. It must sit under the layer's
 * `iriBase`, and must not be a directory the context sits in, nor the
 * context itself: with the default context path `ns` is the DIRECTORY holding
 * `ns/context/v1.jsonld`, and a static host cannot serve both
 * (folio-assistant#2560 is the same clash on the aggregate site). A layer
 * whose `ns` is a document has its context beside it (D1), so `ns` is free.
 *
 * A slash namespace (`…/ns/`) is a DIRECTORY, because every term below it is
 * a path of its own: the document is its index, `index.html` (what Pages
 * serves for `…/ns/`, carrying the vocabulary as an embedded JSON-LD script),
 * `index.jsonld` and `index.json`. Clean break (owner, 2026-11-02): no copy
 * is kept at the old extensionless `ns` path.
 *
 * A hash-form `@id` (a layer not yet on the slash rule) is still
 * published three times: extensionless because the IRI is, `.jsonld` for the
 * canonical extension, `.json` because Pages sends no correct Content-Type
 * for `.jsonld`.
 */
export type VocabularyOutcome =
  | { kind: "built"; instance: string; iriBase: string; url: string; paths: string[]; terms: number; content: string; html: string }
  | { kind: "skipped"; instance: string; reason: string }
  | { kind: "failed"; instance: string; problems: string[] };

export function buildVocabularyOne(repoRoot: string, instance: string): VocabularyOutcome {
  const root = resolve(repoRoot);
  const decl = readInstanceDecls(root).find((d) => d.name === instance);
  if (decl === undefined) return { kind: "failed", instance, problems: [`no instance named \`${instance}\` under ${root}`] };
  const iriBase = iriBaseOf(decl.root);
  if (iriBase === undefined) return { kind: "skipped", instance, reason: `${instance} declares no iriBase, so its vocabulary has no address` };
  const owners = new Set(["bootstrap", ...instancesPublishingNs(root)]);
  if (!owners.has(instance)) return { kind: "skipped", instance, reason: `${instance} mints no terms of its own, so it has no vocabulary to publish` };
  let built;
  try {
    built = buildVocabulary(root, instance, true);
  } catch (e) {
    return { kind: "failed", instance, problems: [e instanceof Error ? e.message : String(e)] };
  }
  const { doc, report } = built;
  const problems = [
    ...report.undefinedTerms.map((t) => `minted term with no definition: ${t}`),
    ...report.doublyDefined.map((t) => `term defined twice: ${t}`),
  ];
  if (problems.length > 0) return { kind: "failed", instance, problems };
  const id = (doc as { "@id"?: unknown })["@id"];
  const where = vocabularyPaths(id, iriBase, decl.contextPath);
  if ("problem" in where) return { kind: "failed", instance, problems: [`${instance}: ${where.problem}`] };
  return {
    kind: "built",
    instance,
    iriBase,
    url: String(id),
    paths: where.paths,
    terms: report.defined.length,
    content: `${JSON.stringify(doc, null, 2)}\n`,
    html: vocabularyHtml(instance, String(id), doc),
  };
}

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The page Pages serves at a slash namespace's own address: the term list a
 * person reads, and the whole vocabulary as `application/ld+json` for an
 * agent (a static host cannot negotiate content type, so one page carries both).
 */
export function vocabularyHtml(instance: string, id: string, doc: unknown): string {
  const graph = ((doc as { "@graph"?: unknown[] })["@graph"] ?? []) as Array<Record<string, unknown>>;
  const rows = graph
    .filter((n) => typeof n["@id"] === "string")
    .map((n) => {
      const label = String(n["label"] ?? n["prefLabel"] ?? n["@id"]);
      const def = n["definition"] ?? n["comment"];
      return `<li><code>${escHtml(String(n["@id"]))}</code> ${escHtml(label)}${def === undefined ? "" : ` — ${escHtml(String(def))}`}</li>`;
    })
    .join("\n");
  // `</` cannot appear inside the script element, so it is escaped in the JSON.
  const json = JSON.stringify(doc, null, 2).replace(/<\//g, "<\\/");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(instance)} vocabulary</title>
<link rel="alternate" type="application/ld+json" href="index.jsonld">
<script type="application/ld+json">
${json}
</script>
</head>
<body>
<h1>${escHtml(instance)} vocabulary</h1>
<p>Namespace <code>${escHtml(id)}</code>. Machine-readable: <a href="index.jsonld">index.jsonld</a>.</p>
<ul>
${rows}
</ul>
</body>
</html>
`;
}

/**
 * Where a vocabulary whose `@id` is `id` is served on the Pages at `iriBase`:
 * the three paths, or why it cannot be. `contextPath` is where the layer's
 * context is published (instance-relative): a vocabulary path in the
 * directory it sits in, or at its own path, collides with it.
 */
export function vocabularyPaths(id: unknown, iriBase: string, contextPath: string = INSTANCE_CONTEXT_PATH): { paths: string[] } | { problem: string } {
  const base = `${iriBase.replace(/\/+$/, "")}/`;
  if (typeof id !== "string" || !id.startsWith(base)) {
    return { problem: `the vocabulary's @id ${String(id)} is not under the iriBase ${base}, so that Pages site cannot serve it` };
  }
  const rel = id.slice(base.length).replace(/[#/]+$/, "");
  // The directory the context sits in (`ns/` by default), or none when it sits
  // at the root beside a namespace document (D1).
  const top = contextPath.includes("/") ? contextPath.split("/")[0]! : undefined;
  if (rel === "" || (top !== undefined && (rel === top || rel.startsWith(`${top}/`)))) {
    return { problem: `the vocabulary's @id ${id} would be served at \`${rel || "/"}\`, which collides with the context directory ${top ?? ""}/` };
  }
  const paths = id.endsWith("/") ? [`${rel}/index.html`, `${rel}/index.jsonld`, `${rel}/index.json`] : [rel, `${rel}.jsonld`, `${rel}.json`];
  if (paths.includes(contextPath)) {
    return { problem: `the vocabulary's @id ${id} would be served at \`${contextPath}\`, which is where the context is published` };
  }
  return { paths };
}

// ── publish ──────────────────────────────────────────────────────

/** The few REST calls `publish` makes; injected so a test reaches no network. */
export type ApiRequest = (method: "GET" | "PUT" | "POST" | "DELETE", path: string, body?: unknown) => Promise<{ status: number; json: unknown }>;

export function githubApi(token: string, base = process.env.GITHUB_API_URL ?? "https://api.github.com"): ApiRequest {
  return async (method, path, body) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: unknown = undefined;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = text;
    }
    return { status: res.status, json };
  };
}

export interface PublishOptions {
  /** `owner/name`. */
  repo: string;
  /** Path on the branch. */
  path: string;
  content: string;
  /** The commit the context was built from, named in the commit message. */
  sha?: string;
  branch?: string;
}

export type PublishOutcome =
  | { kind: "unchanged"; detail: string }
  | { kind: "updated"; detail: string }
  | { kind: "created-branch"; commit: string; detail: string }
  | { kind: "failed"; detail: string };

const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");
const b64 = (s: string) => Buffer.from(s, "utf-8").toString("base64");
const fromB64 = (s: string) => Buffer.from(s.replace(/\n/g, ""), "base64").toString("utf-8");

function messageFor(o: PublishOptions): string {
  return `publish ${o.path}${o.sha ? ` from ${o.sha.slice(0, 12)}` : ""} (layer-publish-context)`;
}

function errorOf(r: { status: number; json: unknown }): string {
  const m = (r.json as { message?: unknown } | undefined)?.message;
  return `HTTP ${r.status}${typeof m === "string" ? `: ${m}` : ""}`;
}

/** An orphan branch holding `files`, made with the git-data API. `undefined` when the ref already existed. */
async function createOrphanBranch(api: ApiRequest, repo: string, branch: string, files: Record<string, string>, message: string): Promise<string | undefined> {
  const tree = await api("POST", `/repos/${repo}/git/trees`, {
    tree: Object.entries(files).map(([path, content]) => ({ path, mode: "100644", type: "blob", content })),
  });
  if (tree.status !== 201) throw new Error(`create tree: ${errorOf(tree)}`);
  const commit = await api("POST", `/repos/${repo}/git/commits`, { message, tree: (tree.json as { sha: string }).sha, parents: [] });
  if (commit.status !== 201) throw new Error(`create commit: ${errorOf(commit)}`);
  const sha = (commit.json as { sha: string }).sha;
  const ref = await api("POST", `/repos/${repo}/git/refs`, { ref: `refs/heads/${branch}`, sha });
  if (ref.status === 201) return sha;
  // 422: "Reference already exists" — created meanwhile. Never overwritten.
  if (ref.status === 422) return undefined;
  throw new Error(`create ref: ${errorOf(ref)}`);
}

/** GitHub's 409 when a file sits where the path needs a directory. */
const FILE_BLOCKS_DIRECTORY = /a file exists where you.re trying to create a subdirectory/i;

/**
 * Remove the file that sits where `path` needs a directory, when it is a JSON
 * document (a vocabulary or context this workflow published at a hash IRI).
 * Anything else is left alone and reported. Returns the removed path.
 */
async function removeBlockingFile(api: ApiRequest, o: PublishOptions, branch: string): Promise<{ removed: string } | { problem: string }> {
  const parts = o.path.split("/");
  for (let i = 1; i < parts.length; i++) {
    const p = parts.slice(0, i).join("/");
    const cur = await api("GET", `/repos/${o.repo}/contents/${enc(p)}?ref=${encodeURIComponent(branch)}`);
    if (cur.status === 404 || Array.isArray(cur.json)) continue;
    if (cur.status !== 200) return { problem: `read ${branch}:${p}: ${errorOf(cur)}` };
    const f = cur.json as { sha: string; content?: string; encoding?: string };
    let json = false;
    try {
      json = f.encoding === "base64" && typeof f.content === "string" && typeof JSON.parse(fromB64(f.content)) === "object";
    } catch {
      json = false;
    }
    if (!json) return { problem: `${branch}:${p} is a file where ${o.path} needs a directory, and it is not a JSON document, so it is left for a person` };
    const del = await api("DELETE", `/repos/${o.repo}/contents/${enc(p)}`, {
      message: `remove ${p}: ${p}/ is now a directory (slash IRI) (layer-publish-context)`,
      sha: f.sha,
      branch,
    });
    if (del.status !== 200) return { problem: `remove ${branch}:${p}: ${errorOf(del)}` };
    return { removed: p };
  }
  return { problem: `no file found above ${o.path} on ${branch}` };
}

/** Put one file on `gh-pages`, creating the branch when it is absent. Deletes only a JSON file that blocks the path as a directory. */
export async function publishFile(api: ApiRequest, o: PublishOptions): Promise<PublishOutcome> {
  const branch = o.branch ?? PAGES_BRANCH;
  const message = messageFor(o);
  try {
    const b = await api("GET", `/repos/${o.repo}/branches/${encodeURIComponent(branch)}`);
    if (b.status === 404) {
      const files = { ".nojekyll": "", "index.html": PLACEHOLDER_HTML, [o.path]: o.content };
      const commit = await createOrphanBranch(api, o.repo, branch, files, message);
      if (commit !== undefined) {
        return { kind: "created-branch", commit, detail: `${branch} was absent: created it (${commit.slice(0, 7)}) holding .nojekyll, index.html and ${o.path}` };
      }
    } else if (b.status !== 200) {
      return { kind: "failed", detail: `could not tell whether ${branch} exists: ${errorOf(b)}` };
    }
    // Two attempts: a 409 means the branch moved between the read and the write.
    // A 409 for a file blocking the directory is not an attempt: the file is removed once, then the write retried.
    let removed: string | undefined;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const cur = await api("GET", `/repos/${o.repo}/contents/${enc(o.path)}?ref=${encodeURIComponent(branch)}`);
      let sha: string | undefined;
      if (cur.status === 200) {
        const f = cur.json as { sha: string; content?: string; encoding?: string };
        if (f.encoding === "base64" && typeof f.content === "string" && fromB64(f.content) === o.content) {
          return { kind: "unchanged", detail: `${branch}:${o.path} already holds this context; nothing written` };
        }
        sha = f.sha;
      } else if (cur.status !== 404) {
        return { kind: "failed", detail: `read ${branch}:${o.path}: ${errorOf(cur)}` };
      }
      const put = await api("PUT", `/repos/${o.repo}/contents/${enc(o.path)}`, {
        message,
        content: b64(o.content),
        branch,
        ...(sha ? { sha } : {}),
      });
      if (put.status === 200 || put.status === 201) {
        return { kind: "updated", detail: `${sha ? "updated" : "added"} ${branch}:${o.path}${removed ? ` (removed the file ${removed} that stood where its directory goes)` : ""}` };
      }
      if (put.status === 409 && !removed && FILE_BLOCKS_DIRECTORY.test(errorOf(put))) {
        const r = await removeBlockingFile(api, o, branch);
        if ("problem" in r) return { kind: "failed", detail: `write ${branch}:${o.path}: ${errorOf(put)}; ${r.problem}` };
        removed = r.removed;
        attempt--;
        continue;
      }
      if (put.status !== 409 || attempt === 2) return { kind: "failed", detail: `write ${branch}:${o.path}: ${errorOf(put)}` };
    }
    return { kind: "failed", detail: "unreachable" };
  } catch (e) {
    return { kind: "failed", detail: e instanceof Error ? e.message : String(e) };
  }
}

// ── CLI ──────────────────────────────────────────────────────────

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
}

async function main(argv: readonly string[]): Promise<number> {
  const [cmd] = argv;
  if (cmd === "build") {
    const instance = arg(argv, "--instance");
    const out = arg(argv, "--out");
    // `--site <dir>`: write the context INTO a site being built, at the path
    // it is served at (`<dir>/<path>`). A repository whose site an agent
    // builds and publishes whole (`stage-local.ts`, smart-ra and dth-hrh)
    // carries its context as one of the site's source steps, so the context
    // is published with the site rather than by a separate workflow.
    const site = arg(argv, "--site");
    if (!instance || (!out && !site)) {
      console.error("usage: publish-instance-context.ts build --root <index> --instance <name> (--out <file> | --site <dir>) [--report <file>]");
      return 2;
    }
    const outcome = buildOne(arg(argv, "--root") ?? ".", instance);
    const reportFile = arg(argv, "--report");
    if (reportFile) {
      const { context: _c, ...rest } = outcome as BuildOutcome & { context?: string };
      writeFileSync(reportFile, `${JSON.stringify(rest, null, 2)}\n`);
    }
    if (outcome.kind === "skipped") {
      // A warning, not a notice: the caller's run is green either way, and a
      // notice let a layer with nothing to publish look published
      // (aai-programme, 2026-10-20). The reason says what to add.
      console.log(`::warning::${outcome.reason}; nothing was published`);
      return 0;
    }
    if (outcome.kind === "failed") {
      for (const p of outcome.problems) console.error(`::error::${p}`);
      return 1;
    }
    const file = out ?? join(site!, outcome.path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, outcome.context);
    console.log(`built ${outcome.instance}'s context: ${outcome.documents} document(s), binds ${outcome.bound.join(" ") || "nothing"}; to be served at ${outcome.url}`);
    return 0;
  }
  if (cmd === "vocab") {
    const instance = arg(argv, "--instance");
    const outDir = arg(argv, "--out-dir");
    if (!instance || !outDir) {
      console.error("usage: publish-instance-context.ts vocab --root <index> --instance <name> --out-dir <dir>");
      return 2;
    }
    const outcome = buildVocabularyOne(arg(argv, "--root") ?? ".", instance);
    if (outcome.kind === "skipped") {
      console.log(`::notice::${outcome.reason}; no vocabulary to publish`);
      return 0;
    }
    if (outcome.kind === "failed") {
      for (const p of outcome.problems) console.error(`::error::${p}`);
      return 1;
    }
    for (const p of outcome.paths) {
      const dest = join(outDir, p);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, p.endsWith(".html") ? outcome.html : outcome.content);
    }
    // The list the workflow publishes, one path per line, so it never restates them.
    writeFileSync(join(outDir, ".paths"), `${outcome.paths.join("\n")}\n`);
    console.log(`built ${outcome.instance}'s vocabulary: ${outcome.terms} term(s); to be served at ${outcome.url} (${outcome.paths.join(", ")})`);
    return 0;
  }
  if (cmd === "publish") {
    const repo = arg(argv, "--repo");
    const file = arg(argv, "--file");
    const token = process.env.GITHUB_TOKEN;
    if (!repo || !file || !token) {
      console.error(`usage: GITHUB_TOKEN=… publish-instance-context.ts publish --repo <owner/name> --file <context> [--sha <commit>] [--path ${INSTANCE_CONTEXT_PATH}|${NS_DOCUMENT_CONTEXT_PATH}]`);
      return 2;
    }
    if (!existsSync(file)) {
      console.error(`::error::${file} does not exist: run build first`);
      return 2;
    }
    const outcome = await publishFile(githubApi(token), {
      repo,
      path: arg(argv, "--path") ?? INSTANCE_CONTEXT_PATH,
      content: readFileSync(file, "utf-8"),
      sha: arg(argv, "--sha"),
    });
    if (outcome.kind === "failed") {
      console.error(`::error::${outcome.detail}`);
      return 1;
    }
    console.log(`${outcome.kind}: ${outcome.detail}`);
    return 0;
  }
  console.error("usage: publish-instance-context.ts build|vocab|publish …");
  return 2;
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
