#!/usr/bin/env bun
/**
 * Node-view coverage: for each node a declared directory holds, does it have
 * an IRI, its JSON-LD, a view page and a row on its folder page?
 *
 * ```sh
 * bun run cat node-views:report -- --site _site [--site-url https://…/]   # a built site
 * bun run cat node-views:report -- --base https://litlfred.github.io/who-iris/   # a live site
 * bun run cat node-views:judge -- --base <url> --against main             # the author's check
 * ```
 *
 * Owner, 2026-11-13 (card A): the report the node-kind view audit proposed
 * (§4), and every listed node kind owes pages, with no waivers, so themes,
 * voices, translation sources, code, QA and software libraries read `missing`
 * until they are built.
 *
 * ## A QA report, not a gate
 *
 * `node-views:report` writes `node-view-coverage/v1`, one file per layer, to
 * `<layer qa home>/node-views/<layer>.node-views.qa.json` (`test/results/`, a
 * working copy published to `qa-reports` by `qa:publish`), and ALWAYS exits 0,
 * as `render:bpmn:check` does since 2026-11-13. It is in no `index-gates.json`
 * and not always-green.
 *
 * `node-views:judge` (`--check`) writes nothing and uses `JUDGEMENT_EXIT`: 0
 * when nothing is new; 1 when a finding (a node `missing` something, a dead
 * link) is NEW against the baseline (`--against <ref>` on `qa-reports`, or the
 * working copy); 2 when the run could not ask (no `--site`/`--base`, no layer,
 * an unreadable declaration) or erred. A missing baseline is UNKNOWN and not
 * gated (proposal §2.3), as everywhere else.
 *
 * ## Inputs
 *
 * The declarations (`checkoutDirectories`), the visualisers and their routes
 * (`declaredVisualisers`, `visualiserRoute`), a node census per kind
 * (`lib/node-view-coverage.ts` `CENSUS_RULES`), the IRIs of each layer's
 * export built IN MEMORY (`buildExport`, as `jsonld:site:check` does), and a
 * built site (`--site`) or a live base (`--base`). Folder pages are read with
 * their data files, so rows drawn by JavaScript count.
 *
 * Flags: `--root <checkout>` (default: cwd) · `--instance <dir>` (one layer) ·
 * `--site <dir>` with `--site-url <url>` (what the dir is served as) ·
 * `--base <url>` · `--network` (with `--site`: fetch off-site IRIs) ·
 * `--out <dir>` (write every layer's file here instead of its qa home) ·
 * `--probe-limit <n>` (per row, default 2000) · `--concurrency <n>` ·
 * `--locale <l>` (default `en`) · `--summary <file>` (write the Markdown table).
 *
 * @module scripts/node-view-coverage
 * @covers none — it measures a built site's views of every declared directory (one row per layer × directory × kind), not any one graph's content
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import { checkoutDirectories } from "../schemas/kg/harness-config.ts";
import { layerRootsIn } from "../schemas/kg/instance-roots.ts";
import { kgQaHomeFor, readDeclaration } from "../schemas/kg/cat-harness.ts";
import { ROUTE_SEGMENT, visualiserRoute } from "../schemas/kg/visualiser-route.ts";
import {
  NODE_VIEW_COVERAGE_SCHEMA,
  NodeViewCoverageSchema,
  type CoverageRow,
  type NodeViewCoverage,
} from "../schemas/sdlc/node-view-coverage.ts";
import { declaredVisualisers, type DeclaredVisualiser } from "./viewer-declarations.ts";
import {
  SUMMARY_HEAD,
  attachIris,
  censusFiles,
  censusRuleFor,
  coverRow,
  dirFetcher,
  exportIdOf,
  exportNodesOf,
  exportPathOf,
  findingsOf,
  httpFetcher,
  summaryLine,
  type ExportNode,
  type Fetcher,
  type NodeCandidate,
} from "./lib/node-view-coverage.ts";
import { againstOrUsage, judgeSidecarTree, judgeUsage, judging, JUDGEMENT_EXIT, withoutAgainst } from "./qa-results.ts";

/** Kinds that hold no nodes of their own: the layer itself, and generated sub-trees. */
const NOT_NODE_KINDS = new Set(["cat-harness", "auto-docs", "cache"]);

/** Waivers by ruling. Owner, 2026-11-13: none — every listed node kind gets pages. */
export const WAIVERS: Readonly<Record<string, { reason: string; ruling: string }>> = {};

export interface Options {
  root: string;
  instance?: string;
  siteDir?: string;
  siteUrl?: string;
  base?: string;
  network?: boolean;
  probeLimit?: number;
  concurrency?: number;
  locale?: string;
  /** For tests: each layer's export graph, or a reason it could not be built. */
  exportOf?: (layerRoot: string) => Promise<ExportNode[] | { unknown: string }>;
  /** For tests: the network. */
  http?: Fetcher;
  now?: string;
}

/** Each layer's export graph, built in memory and writing nothing. */
async function buildGraph(layerRoot: string): Promise<ExportNode[] | { unknown: string }> {
  try {
    const { buildExport } = await import("./kg-export.ts");
    const data = await buildExport({ instanceRoot: layerRoot, provenance: false });
    return data["@graph"] as unknown as ExportNode[];
  } catch (e) {
    return { unknown: `the export did not build: ${(e as Error).message.split("\n")[0]}` };
  }
}

/** The visualiser that draws a directory's kind, if one is declared. */
export function visualiserFor(vs: readonly DeclaredVisualiser[], dirId: string, kind: string): DeclaredVisualiser | undefined {
  return (
    vs.find((v) => ((v.coversKinds ?? []) as readonly string[]).includes(kind)) ??
    vs.find((v) => ((v.covers ?? []) as readonly string[]).includes(dirId))
  );
}

/** The folder page routes of a directory's kind, canonical first. */
export function folderRoutes(v: DeclaredVisualiser, layer: string, dirId: string, kind: string, locale: string): string[] {
  const under = (v.subgraphUnder as Record<string, string> | undefined)?.[kind];
  const sub =
    v.subgraphs === "instance" ? (under ? `${under}/${layer}` : layer) : v.subgraphs === "directory" ? (under ? `${under}/${dirId}` : dirId) : undefined;
  const parts = { harness: v.harness, visualiser: v.id, ...(sub && sub.split("/").every((s) => ROUTE_SEGMENT.test(s.toLowerCase())) ? { subgraph: sub } : {}) };
  try {
    return [visualiserRoute({ ...parts, locale }), visualiserRoute(parts)];
  } catch {
    return [];
  }
}

/** Run the report. Returns one document per layer. */
export async function report(o: Options): Promise<{ docs: NodeViewCoverage[]; layerRoots: Map<string, string>; undetermined?: string }> {
  const root = resolve(o.root);
  const locale = o.locale ?? "en";
  const limit = o.probeLimit ?? 2000;
  const http = o.http ?? (o.base || o.network ? httpFetcher(o.concurrency ?? 16) : undefined);
  let siteUrl = o.base ?? o.siteUrl ?? "https://site.invalid/";
  siteUrl = siteUrl.replace(/\/*$/, "/");
  const fetcher: Fetcher | undefined = o.siteDir ? dirFetcher(resolve(o.siteDir), siteUrl, o.network ? http : undefined) : o.base ? http : undefined;
  const iriFetcher: Fetcher | undefined = o.siteDir ? fetcher : http;

  const roots = layerRootsIn(root);
  const nameOf = new Map<string, string>();
  for (const r of roots) {
    try {
      const n = readDeclaration(r)?.name;
      if (n) nameOf.set(r, n);
    } catch {
      // unreadable: its directories resolve to nothing, and check:harness-dirs reports it
    }
  }
  if (nameOf.size === 0) return { docs: [], layerRoots: new Map(), undetermined: `no readable layer declaration under ${root}` };
  const ownerOf = (abs: string): string | undefined => {
    let best: string | undefined;
    for (const r of nameOf.keys()) if ((abs === r || abs.startsWith(r + sep)) && (best === undefined || r.length > best.length)) best = r;
    return best;
  };
  const only = o.instance ? resolve(root, o.instance) : undefined;

  let dirs: ReturnType<typeof checkoutDirectories>;
  try {
    dirs = checkoutDirectories(root);
  } catch (e) {
    return { docs: [], layerRoots: new Map(), undetermined: `declarations do not resolve: ${(e as Error).message}` };
  }
  const vs = declaredVisualisers(root);
  const graphs = new Map<string, ExportNode[] | { unknown: string }>();
  const rowsBy = new Map<string, CoverageRow[]>();

  for (const d of dirs) {
    const layerRoot = ownerOf(d.absPath);
    if (layerRoot === undefined || (only && layerRoot !== only)) continue;
    const layer = nameOf.get(layerRoot)!;
    const relPath = d.path.replace(/^\.\//, "");
    // The narrowest path wins: a directory another declaration of this layer holds is that one's.
    const claimed = dirs
      .filter((x) => x !== d && x.absPath !== d.absPath && x.absPath.startsWith(d.absPath.replace(/\/*$/, "/")) && ownerOf(x.absPath) === layerRoot)
      .map((x) => x.absPath.replace(/\/+$/, ""));
    for (const kind of d.graphTypologies as readonly string[]) {
      if (NOT_NODE_KINDS.has(kind)) continue;
      const v = visualiserFor(vs, d.id, kind);
      const waiver = WAIVERS[kind];
      const viewer: CoverageRow["viewer"] = waiver
        ? { state: "waived", ...waiver }
        : v
          ? { state: "declared", id: `${v.harness}/${v.id}` }
          : { state: "none", reason: "no declared visualiser covers this kind" };
      const folderUrls = v && !waiver ? folderRoutes(v, layer, d.id, kind, locale).map((r) => siteUrl + r) : [];

      if (!graphs.has(layerRoot)) graphs.set(layerRoot, await (o.exportOf ?? buildGraph)(layerRoot));
      const g = graphs.get(layerRoot)!;
      const exported = Array.isArray(g) ? exportNodesOf(g, { id: d.id, path: relPath }, kind) : [];

      let nodes: NodeCandidate[] | { unknown: string };
      let census: string;
      const rule = censusRuleFor(kind);
      if (!existsSync(d.absPath)) {
        nodes = { unknown: `${relPath} is not in this checkout (kept on a branch, or not committed)` };
        census = "unknown";
      } else if (rule.exportFirst && exported.length > 0) {
        nodes = exported.map((n) => {
          const p = exportPathOf(n);
          return { id: exportIdOf(n), iri: n["@id"], ...(p ? { path: p } : {}) };
        });
        census = "export";
      } else {
        nodes = attachIris(censusFiles(d.absPath, layerRoot, rule, claimed), exported);
        census = rule.rule === "entries" ? `entries${rule.holds ? ` holding ${rule.holds}` : ""}` : `files ${rule.suffixes!.join(" ")}`;
      }
      const row = await coverRow({
        layer,
        directory: { id: d.id, path: relPath },
        kind,
        nodes,
        census,
        ...(Array.isArray(g) ? {} : { iriUnknown: g.unknown }),
        viewer,
        folderUrls,
        siteUrl,
        ...(v ? { vis: v.id } : {}),
        ...(fetcher ? { fetcher } : {}),
        ...(iriFetcher ? { iriFetcher } : {}),
        probeLimit: limit,
      });
      rowsBy.set(layer, [...(rowsBy.get(layer) ?? []), row]);
    }
  }

  const layerRoots = new Map<string, string>();
  for (const [r, n] of nameOf) layerRoots.set(n, r);
  const docs: NodeViewCoverage[] = [...rowsBy].map(([layer, rows]) => {
    const all = rows.flatMap((r) => r.nodes);
    const doc: NodeViewCoverage = {
      $schema: NODE_VIEW_COVERAGE_SCHEMA,
      layer,
      site: o.siteDir ? { kind: "dir", at: o.siteUrl ?? relative(root, resolve(o.siteDir)) } : o.base ? { kind: "url", at: siteUrl } : { kind: "none" },
      generatedAt: o.now ?? new Date().toISOString(),
      totals: {
        rows: rows.length,
        nodes: rows.some((r) => r.declared === "unknown") ? "unknown" : all.length,
        ok: all.filter((n) => n.verdict === "ok").length,
        missing: all.filter((n) => n.verdict === "missing").length,
        unknown: all.filter((n) => n.verdict === "unknown").length,
        deadLinks: rows.reduce((s, r) => s + r.deadLinks.length, 0),
      },
      rows,
    };
    return NodeViewCoverageSchema.parse(doc);
  });
  return {
    docs,
    layerRoots,
    ...(!fetcher ? { undetermined: "no built site (--site) or live base (--base): pages, rows and links were not read" } : {}),
  };
}

/** Where a layer's report is written: `<out>/` or its declared qa home, under `node-views/`. */
export function sidecarPath(layerRoot: string, layer: string, out?: string): string {
  const home = out ? resolve(out) : join(kgQaHomeFor(layerRoot).root, "node-views");
  return join(home, `${layer}.node-views.qa.json`);
}

const FLAGS = [
  "--root", "--instance", "--site", "--site-url", "--base", "--network", "--out",
  "--probe-limit", "--concurrency", "--locale", "--summary", "--against",
];

if (import.meta.main) {
  const GATE = "node-views:judge";
  const argv = process.argv.slice(2);
  const judge = judging(argv);
  const arg = (f: string): string | undefined => {
    const i = argv.indexOf(f);
    return i >= 0 ? argv[i + 1] : argv.find((a) => a.startsWith(`${f}=`))?.slice(f.length + 1);
  };
  let exit = 0;
  try {
    if (judge) {
      const u = judgeUsage(GATE, withoutAgainst(argv), FLAGS);
      if (u !== undefined) process.exit(u);
    }
    const { against, exit: bad } = judge ? againstOrUsage(GATE, argv) : { against: undefined, exit: undefined };
    if (bad !== undefined) process.exit(bad);
    const o: Options = {
      root: arg("--root") ?? process.cwd(),
      instance: arg("--instance"),
      siteDir: arg("--site"),
      siteUrl: arg("--site-url"),
      base: arg("--base"),
      network: argv.includes("--network"),
      probeLimit: arg("--probe-limit") ? Number(arg("--probe-limit")) : undefined,
      concurrency: arg("--concurrency") ? Number(arg("--concurrency")) : undefined,
      locale: arg("--locale"),
    };
    const { docs, layerRoots, undetermined } = await report(o);
    const lines = [SUMMARY_HEAD, ...docs.flatMap((d) => d.rows.map(summaryLine))];
    console.log(lines.join("\n"));
    if (arg("--summary")) writeFileSync(arg("--summary")!, lines.join("\n") + "\n");
    for (const d of docs) {
      const t = d.totals;
      console.log(`  ${d.layer}: ${t.rows} row(s), ${t.nodes} node(s): ${t.ok} ok, ${t.missing} missing, ${t.unknown} unknown; ${t.deadLinks} dead link(s)`);
    }
    if (undetermined) console.log(`  ? UNKNOWN — ${undetermined}`);
    const fresh = docs.map((d) => ({ doc: d, path: sidecarPath(layerRoots.get(d.layer)!, d.layer, arg("--out")) }));
    if (judge) {
      const v = judgeSidecarTree({
        gate: GATE,
        fresh: fresh.map((f) => ({ path: f.path, findings: findingsOf(f.doc.rows) })),
        findingsOf: (text) => {
          const p = NodeViewCoverageSchema.safeParse(JSON.parse(text));
          return p.success ? findingsOf(p.data.rows) : undefined;
        },
        mode: "new",
        against,
        ...(undetermined || docs.length === 0 ? { undetermined: undetermined ?? "no layer reported" } : {}),
        label: (p) => relative(resolve(o.root), p),
      });
      exit = v.exit;
    } else {
      for (const f of fresh) {
        mkdirSync(dirname(f.path), { recursive: true });
        writeFileSync(f.path, JSON.stringify(f.doc, null, 2) + "\n");
        console.log(`  ✓ ${relative(resolve(o.root), f.path)}`);
      }
      console.log("node-views:report — a QA report, not a gate: exit 0 whatever it found.");
    }
  } catch (e) {
    console.error(`node-view-coverage: ${(e as Error).stack ?? e}`);
    // The report never fails a build; the judge says it could not ask.
    exit = judge ? JUDGEMENT_EXIT.error : 0;
  }
  process.exit(exit);
}
