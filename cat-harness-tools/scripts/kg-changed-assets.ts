#!/usr/bin/env bun
/**
 * The CHANGED ASSETS a staging preview's knowledge graph carries: every node
 * the branch adds, changes or removes against the graph `main` publishes, each
 * with the deep links that let a reviewer open it on both sides. The staging
 * links (cat-harness `schemas/sdlc/staging.ts`, `StagingComparison`) say which
 * PAGES changed; this says which GRAPH NODES did.
 *
 * ## What it writes
 *
 * Into each PREVIEW document under `--site`, where the deploy writes it (one with a `canonicalDocument`
 * that is not its own `@id`), three root fields declared in `kg-export.ts`
 * `buildContext` and glossed in cat-harness `schemas/content/vocabulary.ts`:
 *
 * - `changedAssetsComparedWith`: main's document it was compared with;
 * - `changedAssets`: one record per node that differs, in `@id` order —
 *   `change` (`added` / `changed` / `removed`, the rendered-impact contract's
 *   words), `kind` (the node's type), `title`, `before` (the node on main),
 *   `after` (the node in the preview), `source` (its file, repo-relative), and
 *   `pages`: `StagingPageComparison` rows (`title`, `before`, `after`) for the
 *   rendered pages its source file maps to;
 * - `changedAssetsUnavailable`, INSTEAD of the two above, when main's document
 *   could not be read. Could-not-determine is never "nothing changed": an
 *   empty `changedAssets` means the graphs were compared and agree.
 *
 * A layer that declares its own `canonicalUrl` (the DAK base layer, the FHIR IG harness)
 * is exported with no `--base-url` (`instance-exports.ts`), so its staged
 * document is not a preview and is skipped, said in the log: it has no
 * staging identity to link a node to.
 *
 * ## Matching, and what counts as a change
 *
 * A preview mints every `@id` under its staging base (`--base-url`), so the
 * two documents never share an IRI. Each preview node is rewritten into main's
 * base — the rewrite `alternateOf` already states per node — and the
 * preview-only `alternateOf` is dropped; a node is `changed` when what is left
 * differs from main's node with the same `@id`, keys order-insensitive.
 *
 * ## Pages: the rendered-impact mapping, never a guessed URL
 *
 * A node's source file is mapped to pages by the docs site's renderer,
 * `docsRenderedImpact` (`docs-rendered-impact.ts`) — the same answer a
 * Change Set's rendered-impact list gives. A page row's `after` is the
 * preview's base plus the rendered path, present when the node and the page
 * both exist on the branch; `before` is main's base plus the rendered path the
 * node's source on MAIN maps to, present unless the node is new. A source the
 * renderer cannot map one by one (outside the composed tree, carried by the
 * staging cone) gets `pagesUnknown` with the renderer's reason, never an empty
 * `pages`.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/kg-changed-assets.ts --site ./_site [--main <dir>]
 *
 * `--main` is a directory holding main's published site — at least its
 * `*.jsonld` documents, at their published paths (e.g. extracted from the
 * `gh-pages` ref, `branches/` excluded). Without it, or when a document is not
 * in it, each preview document says why in `changedAssetsUnavailable`.
 *
 * Exit: 0 written (a third state included — it is written down, and warned);
 * 1 a document could not be read or written, or its `@context` does not
 * declare the fields; 2 usage.
 *
 * @module scripts/kg-changed-assets
 */
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { reviewList, type RenderedImpact } from "../schemas/ui/rendered-impact.ts";
import { StagingPageComparisonSchema, type StagingPageComparison } from "../schemas/sdlc/staging.ts";
import { coneByFile, docsMounts, docsRenderedImpact, indexSite } from "./docs-rendered-impact.ts";
import type { ConeDecision } from "./staging-cone.ts";

type Node = Record<string, unknown>;

/** A JSON-LD export as this script reads it: the root fields it needs, and the graph. */
export interface GraphDoc {
  "@id": string;
  "@context"?: Record<string, unknown>;
  "@graph": Node[];
  canonicalDocument?: string;
  sourceCommit?: string;
  [k: string]: unknown;
}

export const ASSET_CHANGES = ["added", "changed", "removed"] as const;
export type AssetChange = (typeof ASSET_CHANGES)[number];

/** One node that differs between the preview and main. */
export interface ChangedAsset {
  change: AssetChange;
  /** The node's type without its namespace; absent on a tombstone, which has none. */
  kind?: string;
  title?: string;
  /** The node in main's document. Absent when the branch adds it. */
  before?: string;
  /** The node in the preview's document. Absent when the branch removes it. */
  after?: string;
  /** The file the node was read from, repository-relative. */
  source?: string;
  /** The rendered pages its source maps to — `StagingPageComparison` rows. */
  pages?: StagingPageComparison[];
  /** Why its pages are not mapped one by one, when they are not. */
  pagesUnknown?: string;
}

/** The root fields this script writes — declared in `kg-export.ts` `buildContext`. */
export const CHANGED_ASSETS_FIELDS = ["changedAssets", "changedAssetsComparedWith", "changedAssetsUnavailable"] as const;

/** The two publication bases a preview document relates, without trailing slash. */
export interface Bases {
  staging: string;
  main: string;
}

/**
 * The bases a preview document was minted under, read off its own `@id` and
 * `canonicalDocument` — both end in `docPath`. A string is why they cannot be.
 */
export function basesOf(doc: GraphDoc, docPath: string): Bases | string {
  const canonical = doc.canonicalDocument;
  if (typeof canonical !== "string") return "the document names no canonicalDocument, so it is not a preview";
  if (canonical === doc["@id"]) return "the document is its own canonical document, so it is not a preview";
  const tail = `/${docPath}`;
  if (!doc["@id"].endsWith(tail) || !canonical.endsWith(tail)) {
    return `neither ${doc["@id"]} nor ${canonical} can be read as a base plus ${docPath}`;
  }
  return { staging: doc["@id"].slice(0, -tail.length), main: canonical.slice(0, -tail.length) };
}

/** A value with every IRI under the staging base rewritten under main's. */
export function rebase(v: unknown, b: Bases): unknown {
  if (typeof v === "string") return v === b.staging ? b.main : v.split(`${b.staging}/`).join(`${b.main}/`);
  if (Array.isArray(v)) return v.map((x) => rebase(x, b));
  if (v !== null && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, rebase(x, b)]));
  return v;
}

/** Preview-only, by construction: `kg-export` writes it on a preview node and never on main's. */
const PREVIEW_ONLY = new Set(["alternateOf"]);

/** Key-order-insensitive serialisation, so a reordered object is not a change. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v !== null && typeof v === "object") {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((v as Node)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

function comparable(n: Node): string {
  return stable(Object.fromEntries(Object.entries(n).filter(([k]) => !PREVIEW_ONLY.has(k))));
}

/** One node that differs, before any page is mapped. */
export interface NodeChange {
  change: AssetChange;
  /** The node's `@id` in main's base. */
  id: string;
  staged?: Node;
  main?: Node;
}

/** The nodes that differ, in `@id` order. Pure. */
export function diffGraphs(staged: GraphDoc, main: GraphDoc, b: Bases): NodeChange[] {
  const ours = new Map<string, Node>();
  for (const n of staged["@graph"]) {
    const r = rebase(n, b) as Node;
    ours.set(String(r["@id"]), r);
  }
  const theirs = new Map<string, Node>();
  for (const n of main["@graph"]) theirs.set(String(n["@id"]), n);
  const out: NodeChange[] = [];
  for (const id of [...new Set([...ours.keys(), ...theirs.keys()])].sort()) {
    const s = ours.get(id);
    const m = theirs.get(id);
    if (s && !m) out.push({ change: "added", id, staged: s });
    else if (m && !s) out.push({ change: "removed", id, main: m });
    else if (s && m && comparable(s) !== comparable(m)) out.push({ change: "changed", id, staged: s, main: m });
  }
  return out;
}

/** The keys a node names its file under, in `kg-export`'s own order (`stampSubgraph`). */
const PATH_KEYS = ["instructionsPath", "module", "sourcePath", "path"] as const;

/** The node's file, relative to the layer it was exported from; undefined when it names none. */
export function nodePath(n: Node | undefined): string | undefined {
  if (n === undefined) return undefined;
  for (const k of PATH_KEYS) {
    const v = n[k];
    if (typeof v === "string" && v.length > 0) return v.replace(/\\/g, "/");
  }
  return undefined;
}

const kindOf = (n: Node): string | undefined => {
  const t = Array.isArray(n["@type"]) ? n["@type"][0] : n["@type"];
  return typeof t === "string" ? t.split(/[#/]/).pop() : undefined;
};

const titleOf = (n: Node): string | undefined => {
  for (const k of ["title", "prefLabel", "name"]) {
    const v = n[k];
    if (typeof v === "string" && v !== "") return v;
  }
  return undefined;
};

export interface AssetOptions {
  /** A node path (instance-relative) as a repository-relative file. */
  repoPath: (p: string) => string;
  /** The renderer's answer for a set of repository-relative files. */
  render: (files: string[]) => RenderedImpact;
}

/**
 * The records written into the preview document. `before`/`after` of the node
 * itself are its `@id` on each side: dereferenceable into the two published
 * documents, and the preview's `after` is exactly the node's own `@id` there.
 */
export function changedAssets(changes: readonly NodeChange[], b: Bases, o: AssetOptions): ChangedAsset[] {
  const toStaging = (id: string) => (id === b.main ? b.staging : id.split(`${b.main}/`).join(`${b.staging}/`));
  const after = new Map<NodeChange, string>();
  const before = new Map<NodeChange, string>();
  for (const c of changes) {
    const a = nodePath(c.staged);
    const m = nodePath(c.main);
    if (a !== undefined) after.set(c, o.repoPath(a));
    if (m !== undefined) before.set(c, o.repoPath(m));
  }
  const files = [...new Set([...after.values(), ...before.values()])].sort();
  const impact = files.length ? o.render(files) : undefined;
  const pagesOf = (file: string) => (impact ? reviewList(impact).filter((f) => f.via[0] === file) : []);
  const unknownOf = (file: string) => impact?.undetermined.find((u) => u.input === file)?.reason;

  return changes.map((c) => {
    const node = (c.staged ?? c.main)!;
    const aFile = after.get(c);
    const bFile = before.get(c);
    const rows = new Map<string, StagingPageComparison>();
    if (aFile !== undefined) {
      for (const f of pagesOf(aFile)) {
        if (f.change === "removed") continue;
        rows.set(f.path, { title: f.path, after: `${b.staging}/${f.path}` });
      }
    }
    if (bFile !== undefined && c.change !== "added") {
      for (const f of pagesOf(bFile)) rows.set(f.path, { ...(rows.get(f.path) ?? { title: f.path }), before: `${b.main}/${f.path}` });
    }
    const pages = [...rows.values()].sort((x, y) => x.title.localeCompare(y.title)).map((p) => StagingPageComparisonSchema.parse(p));
    const unknown = [aFile, bFile].map((f) => (f === undefined ? undefined : unknownOf(f))).find((r) => r !== undefined);
    const kind = kindOf(node);
    const title = titleOf(node);
    const source = aFile ?? bFile;
    return {
      change: c.change,
      ...(kind !== undefined ? { kind } : {}),
      ...(title !== undefined ? { title } : {}),
      ...(c.change !== "added" ? { before: c.id } : {}),
      ...(c.change !== "removed" ? { after: toStaging(c.id) } : {}),
      ...(source !== undefined ? { source } : {}),
      ...(pages.length ? { pages } : {}),
      ...(unknown !== undefined ? { pagesUnknown: unknown } : {}),
    };
  });
}

/** Main's document for a preview, or why it cannot be used. */
export function readMain(mainDir: string | undefined, docPath: string, canonical: string): GraphDoc | string {
  if (mainDir === undefined) return "no published main site was given to compare against";
  if (!existsSync(mainDir) || !statSync(mainDir).isDirectory()) return `the main site directory ${mainDir} could not be read`;
  const file = join(mainDir, docPath);
  if (!existsSync(file)) return `main's site has no ${docPath} — the document is new on this branch, or main has not published it`;
  let doc: GraphDoc;
  try {
    doc = JSON.parse(readFileSync(file, "utf-8")) as GraphDoc;
  } catch (e) {
    return `main's ${docPath} is not JSON: ${(e as Error).message}`;
  }
  if (!Array.isArray(doc["@graph"])) return `main's ${docPath} has no @graph`;
  if (doc["@id"] !== canonical) return `main's ${docPath} is ${String(doc["@id"])}, not the canonical document ${canonical}`;
  return doc;
}

/** The root fields to write, as one of the two states. Pure. */
export function changedAssetsFields(
  staged: GraphDoc,
  main: GraphDoc | string,
  b: Bases,
  o: AssetOptions,
): { changedAssetsComparedWith: string; changedAssets: ChangedAsset[] } | { changedAssetsUnavailable: string } {
  if (typeof main === "string") return { changedAssetsUnavailable: main };
  return { changedAssetsComparedWith: main["@id"], changedAssets: changedAssets(diffGraphs(staged, main, b), b, o) };
}

/** Fields the document's own `@context` does not declare — written anyway, a processor would drop them. */
export function undeclaredFields(doc: GraphDoc): string[] {
  const ctx = doc["@context"] ?? {};
  return CHANGED_ASSETS_FIELDS.filter((k) => !(k in ctx));
}

/** The docs site's renderer over this repository, with the cone read once, lazily. */
export function docsRenderer(repo: string): (files: string[]) => RenderedImpact {
  const mounts = docsMounts(repo);
  let cone: ((f: string) => ConeDecision[]) | undefined;
  const coneOf = (f: string): ConeDecision[] => {
    try {
      cone ??= coneByFile(repo);
      return cone(f);
    } catch (e) {
      // Could not read the cone: carried, so the page is UNKNOWN rather than absent.
      return [{ node: "the staging cone", path: "", carry: true, why: `it could not be read: ${(e as Error).message.split("\n")[0]}` }];
    }
  };
  const read = (f: string) => {
    const p = join(repo, f);
    return existsSync(p) && statSync(p).isFile() ? readFileSync(p, "utf-8") : undefined;
  };
  // No site index: an include or data file then reads as able to change any
  // page (`scope: all`) — the renderer's own safe answer, never "no page".
  return (changed) => docsRenderedImpact({ changed, mounts, read, index: () => indexSite([]), coneOf });
}

function flag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const site = flag(argv, "--site");
  if (site === undefined) {
    console.error("usage: kg-changed-assets.ts --site <built site> [--main <main's published site>]");
    process.exit(2);
  }
  const mainDir = flag(argv, "--main");
  // Dynamic: `kg-export` is the exporter's whole import graph, needed only to
  // name where each layer's document is published (`exportIdentity`).
  const { exportIdentity } = await import("./kg-export.ts");
  const { HARNESS_ROOT } = await import("./lib/roots.ts");
  const { instanceDocPath, instanceExportPlan } = await import("./instance-exports.ts");
  const { repoRootFor } = await import("../schemas/kg/cat-harness.js");
  const repo = resolve(repoRootFor(HARNESS_ROOT));
  const render = docsRenderer(repo);

  // Where the deploy writes each document: the host's at its `docPath`
  // (`feature-staging.yml`), every other layer's at `<name>/<stub>.jsonld`
  // (`instanceDocPath`, from the same plan `instance-exports.ts` exports by).
  const docs: { at: string; instanceDir: string }[] = [{ at: exportIdentity({}).docPath, instanceDir: HARNESS_ROOT }];
  for (const p of instanceExportPlan(repo)) docs.push({ at: instanceDocPath(p), instanceDir: resolve(repo, p.path) });

  let failed = 0;
  for (const { at, instanceDir } of docs) {
    const file = join(site, at);
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf-8");
    let doc: GraphDoc;
    try {
      doc = JSON.parse(text) as GraphDoc;
    } catch (e) {
      failed++;
      console.error(`  ✗ ${at}: not JSON — ${(e as Error).message}`);
      continue;
    }
    const b = basesOf(doc, at);
    if (typeof b === "string") {
      console.log(`  · ${at}: skipped — ${b}`);
      continue;
    }
    const missing = undeclaredFields(doc);
    if (missing.length) {
      failed++;
      console.error(`  ✗ ${at}: its @context does not declare ${missing.join(", ")} — exported by an older kg-export`);
      continue;
    }
    const fields = changedAssetsFields(doc, readMain(mainDir, at, doc.canonicalDocument!), b, {
      repoPath: (p) => relative(repo, resolve(instanceDir, p)).split("\\").join("/"),
      render,
    });
    const out = JSON.stringify({ ...doc, ...fields }, null, 2) + "\n";
    writeFileSync(file, out);
    // The `.json` alias is a byte copy of the document; keep it one.
    const alias = file.replace(/\.jsonld$/, ".json");
    if (alias !== file && existsSync(alias) && readFileSync(alias, "utf-8") === text) writeFileSync(alias, out);
    if ("changedAssetsUnavailable" in fields) {
      console.log(`::warning title=changed assets::${at}: no changed-assets list — ${fields.changedAssetsUnavailable}`);
    } else {
      const n = (c: AssetChange) => fields.changedAssets.filter((a) => a.change === c).length;
      console.log(`  ✓ ${at}: ${n("added")} added, ${n("changed")} changed, ${n("removed")} removed against ${fields.changedAssetsComparedWith}`);
    }
  }
  process.exit(failed ? 1 : 0);
}
