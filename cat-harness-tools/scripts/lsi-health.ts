/**
 * The LSI indexes as repository HEALTH: which declared prose graphs need an
 * index and lack a fresh one, and what each stored index found.
 *
 * @module cat-harness-tools/scripts/lsi-health
 *
 * This was the body of the LSI viewer page until cat-harness#1144. The owner
 * (2026-11-08): the page was a health report, and a health report belongs in
 * the existing repository health report (`bun run cat health`); the page
 * itself became the Indexing evidence page (`gen-lsi-viz.ts`). So the reads
 * moved here unchanged, and `test/health/checks.ts` draws the `lsi-indexes`
 * check from {@link lsiHealthEvidence}.
 *
 * ## The checkout first, then the store by ref, and a miss is never an answer
 *
 * Bean `oq1j` (arc `3fva`, reader `R14`). With `test/results/lsi/` in the
 * checkout the indexes are read from there. Without it, they are on the
 * `qa-reports` branch, and {@link readIndexes} reads them by ref through
 * `qa-store`, together with the run records the freshness verdict needs.
 * Anything but a hit is returned AS the answer: an absent directory must not
 * read as "no index is missing".
 *
 * It does not recompute the indexes, as `lsi:skills:check` does: freshness is
 * a question about the store, and recomputing an index would make it fresh by
 * construction.
 */
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import {
  CHECKOUT_SOURCE,
  graphVerdict,
  INDEX_DIR,
  indexesInCheckout,
  proseGraphs,
  RUN_RECORD_DIR,
  sourceFromFiles,
  type IndexSource,
  type LsiSidecar,
} from "./lsi.ts";
import { readQaTree } from "./qa-store.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { overlayDirs } from "./lib/layer-output.ts";

const REPO = resolve(dirname(HARNESS_ROOT));
// declared-path-literal: the LSI run records under cat-harness's `qa` graph. cat-harness-tools reads cat-harness's directory here; 70lx moved this code up a layer and kept the path, which is now an implementer reading the layer below it (downward). Resolving it through cat-harness's declaration is the follow-up; counted, not hidden.
const RESULTS = join(REPO, "cat-harness/test/results/lsi");

function walkSidecars(dir: string, out: string[]): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkSidecars(p, out);
    else if (e.name.endsWith(".lsi.json")) out.push(p);
  }
  return out;
}

/**
 * Every index in the checkout, named by its path in the layer: the union of
 * the layer output root and the layer's own directory (bean `cat-tools-sm8r`,
 * item 4). `CHECKOUT_SOURCE` reads each through the same overlay.
 */
function sidecars(): string[] {
  const out = new Set<string>();
  for (const d of overlayDirs(RESULTS)) for (const f of walkSidecars(d, [])) out.add(join(RESULTS, relative(d, f)));
  return [...out].sort();
}

/** The stored indexes, and where they came from — or why they could not be read. */
export type IndexesRead =
  | { state: "hit"; from: string; files: string[]; src: IndexSource }
  | { state: "miss" | "corrupt" | "unknown"; reason: string };

export function readIndexes(ref = "main"): IndexesRead {
  if (indexesInCheckout()) return { state: "hit", from: "the checkout", files: sidecars(), src: CHECKOUT_SOURCE };
  const tree = readQaTree(ref, INDEX_DIR);
  if (tree.state !== "hit") return { state: tree.state, reason: `${INDEX_DIR}/ is not in the checkout, and the qa-reports branch at ${ref}: ${tree.reason}` };
  // The run records are optional on the branch as on disk: none is a
  // `not-run` verdict, which is never green. A corrupt or unknown read is
  // not "none", so it stops the read.
  const runs = readQaTree(ref, RUN_RECORD_DIR);
  if (runs.state === "corrupt" || runs.state === "unknown") return { state: runs.state, reason: `run records at ${ref}: ${runs.reason}` };
  const files = new Map([...tree.files, ...(runs.state === "hit" ? runs.files : [])]);
  return {
    state: "hit",
    from: `qa-reports ${tree.key}`,
    files: [...tree.files.keys()].filter((p) => p.endsWith(".lsi.json")).map((p) => join(REPO, p)).sort(),
    src: sourceFromFiles(files),
  };
}

/** One declared prose graph's verdict: does it need an index, and is the stored one fresh? */
export interface LsiGraphHealth {
  /** `<instance>/<graph id>`. */
  graph: string;
  result: "pass" | "fail" | "n/a";
  detail: string;
  /** The command that builds this graph's index. */
  command: string;
}

/** What one stored index found. Every finding is a proposal a person reads (method `lsi`). */
export interface LsiIndexFindings {
  graph: string;
  narrowDimensions: number;
  nearDuplicates: number;
  /** The sidecar, relative to the repository root. */
  sidecar: string;
}

export interface LsiHealthEvidence {
  /** Where the stored indexes were read from. */
  from: string;
  graphs: LsiGraphHealth[];
  indexes: LsiIndexFindings[];
}

/** Every declared prose graph's verdict and every stored index's findings, from one read. */
export function lsiHealthEvidence(read: Extract<IndexesRead, { state: "hit" }>): LsiHealthEvidence {
  const graphs = proseGraphs().map((t) => {
    const v = graphVerdict(t, read.src);
    return { graph: `${t.instance}/${t.id}`, result: v.result, detail: v.detail, command: `bun run cat lsi index --instance ${t.instance} --graph ${t.id}` };
  });
  const indexes = read.files.map((f) => {
    const rel = relative(REPO, f).split("\\").join("/");
    const s = JSON.parse(read.src.read(rel)!) as LsiSidecar;
    return {
      graph: `${s.instance}/${s.graph}`,
      narrowDimensions: s.findings.narrowDimensions.length,
      nearDuplicates: s.findings.nearDuplicates.length,
      sidecar: rel,
    };
  });
  return { from: read.from, graphs, indexes };
}
