/**
 * Load a content block by **importing** it, rather than scanning its
 * source text.
 *
 * A block's `.ts` is a module whose default export is the result of a
 * builder (`theorem({...})`), and the builder validates against the Zod
 * schema before returning. Importing therefore yields the block the rest
 * of the pipeline sees — right kind, right label, right `uses[]` — with
 * no parser to drift.
 *
 * ## Why the scanners existed, and why the reasons do not hold
 *
 * `conjectural-propagation-audit` carried this note above its regex:
 * *"Crude but sufficient parse … Avoid running TS — too slow + needs
 * deps."* Both halves were measured on a 300-block synthetic corpus:
 *
 *     regex scan      34 ms   151 blocks read, 149 SKIPPED
 *     module import  197 ms   263 blocks read,   0 skipped
 *
 * "Needs deps" is false — Bun imports TypeScript natively, and
 * `prune-transitive-deps` in this same tree already imported blocks to
 * read them. "Too slow" is 0.66 ms per block: about two seconds on a
 * corpus of three and a half thousand, for an audit.
 *
 * The 149 skipped is the real cost of the scan. Those audits matched
 * `export default (definition|theorem|…)` against a hand-written list of
 * twelve kinds, while `Block` has fifteen — `algorithm`, `proof` and
 * `table` were invisible to them. `schemas/types.ts` already documents
 * this exact drift costing ~13% of the qou corpus across five other
 * lists; these two were a sixth and seventh nobody had found. A `proof`
 * block being invisible to the *conjectural propagation* audit is the
 * sharp end of it: that audit exists to trace what rests on a conjecture.
 *
 * The scan also accepted labels the schema rejects. `label: "theorem:x"`
 * matches `/label:\s*"([^"]+)"/` happily; the builder refuses it, because
 * a theorem's label must start with `thm:`. A graph keyed on labels that
 * cannot exist is a graph of edges that cannot resolve.
 *
 * ## Failures are reported, never skipped
 *
 * A block that throws on import is a *finding*, not a file to pass over
 * silently — that is how a sweep reports clean by looking at nothing.
 * `loadBlocksUnder` separates the two outcomes it can legitimately have
 * (a block, or a file that is not a block manifest) from the one it
 * cannot swallow (a block that failed to load), and returns the failures
 * for the caller to surface.
 *
 * @module pipeline/block-module
 */

import { readdir } from "node:fs/promises";
import { writeFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname, basename } from "node:path";
import { ALL_BLOCK_KINDS } from "../schemas/content/block-kinds.ts";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";
import { evaluateJsonManifest, isJsonManifest } from "./json-manifest.ts";

/** A block as the pipeline sees it, plus where it came from. */
export interface LoadedBlock {
  kind: string;
  label: string;
  uses: string[];
  file: string;
  /** The validated block object, for callers needing more fields. */
  block: Record<string, unknown>;
}

/** A `.ts` that looked like a block manifest but would not load. */
export interface BlockLoadFailure {
  file: string;
  error: string;
}

// The BUILT-IN kinds. A contributed kind (a `dak` one, since bean `1335`) is
// loaded by the same import path, and admitted when the caller passes the
// contributed kinds; a kind outside every set it was given is a legitimate skip
// (a chapter manifest, a helper module) rather than a failure.
const KINDS = new Set<string>(ALL_BLOCK_KINDS);

/**
 * Import one `.ts` and return it as a block.
 *
 * `undefined` means "not a single-block manifest" — a chapter or paper
 * manifest, a helper module, a block kind outside the `Block` union.
 * That is a legitimate skip. A module that *throws* is not: it
 * propagates, so `loadBlocksUnder` can record it.
 */
export async function loadBlockModule(
  tsPath: string,
  contributedKinds?: ReadonlySet<string>,
): Promise<LoadedBlock | undefined> {
  // A `.json` manifest (bean `y9r6`) is data: evaluated, not imported.
  if (tsPath.endsWith(".json")) return asLoadedBlock(evaluateJsonManifest(tsPath), tsPath, contributedKinds);
  // input-site: traced #9589922f — a content block's manifest, loaded by path
  inputSiteReached("block-module: loadBlockModule loads a computed block file");
  const mod = (await import(tsPath)) as { default?: unknown };
  return asLoadedBlock(mod.default, tsPath, contributedKinds);
}

/**
 * The synchronous sibling of `loadBlockModule`.
 *
 * `walkBlocks` — the enumeration every QA tool runs on — is a synchronous
 * generator with fourteen production callers, so it could not `await` an
 * import. That is the only reason it still reads block identity out of source
 * text with a regex, and the reason `fsl7` sat open: *"repointing needs either
 * a sync loader or a restructure … A sync loader, which bullet 1 already names.
 * Still absent."*
 *
 * It is absent no longer. Bun's `require` loads a TypeScript ES module
 * synchronously, so a block's builder runs and its validated default export
 * comes back in one call, with no promise to await.
 *
 * ## Cost
 *
 * Measured over 300 generated block manifests plus 10 non-block helpers, cold:
 *
 *     regex readBlockManifest   16.0 ms    0.052 ms / file
 *     loadBlockModuleSync       67.1 ms    0.216 ms / file
 *
 * Four times the regex, and 0.76 s across a corpus of three and a half
 * thousand. Consistent with the 0.66 ms/block the async loader measured above.
 *
 * ## Runtime
 *
 * `require` of a `.ts` ES module is a **Bun** capability. Under a runtime that
 * cannot do it the call throws, which is the honest outcome: a caller must not
 * get silence and conclude the corpus is clean. Everything in
 * `pipeline` already runs under Bun.
 *
 * ## This does not decide which files to execute
 *
 * Importing a module runs it. `walkBlocks` recurses a content root and reads
 * every `.ts` beneath it, and a content tree holds more than block manifests —
 * `pipeline/qa-agent-drain-queue.ts` in this very repo starts a sweep
 * at import time. So the caller decides what is worth executing *before*
 * calling this, and `readBlockManifest`'s masked regex is exactly that gate:
 * cheap, and it already refuses a builder call written inside a string or a
 * comment (`#125`). Candidate detection stays textual; block *identity* comes
 * from here.
 */
export function loadBlockModuleSync(
  tsPath: string,
  contributedKinds?: ReadonlySet<string>,
): LoadedBlock | undefined {
  if (tsPath.endsWith(".json")) return asLoadedBlock(evaluateJsonManifest(tsPath), tsPath, contributedKinds);
  const mod = requireSync(tsPath) as { default?: unknown };
  return asLoadedBlock(mod.default, tsPath, contributedKinds);
}

/** `createRequire` is resolved once; building one per call is measurable. */
let cachedRequire: ((id: string) => unknown) | undefined;

function requireSync(tsPath: string): unknown {
  cachedRequire ??= createRequire(import.meta.url) as unknown as (id: string) => unknown;
  return cachedRequire(tsPath);
}

/**
 * Shared by both loaders, so "what counts as a block" cannot drift between the
 * sync and async paths — the drift this whole module exists to end.
 */
function asLoadedBlock(
  value: unknown,
  file: string,
  contributedKinds?: ReadonlySet<string>,
): LoadedBlock | undefined {
  const block = value as Record<string, unknown> | undefined;
  if (!block || typeof block !== "object") return undefined;
  const kind = block.kind;
  const label = block.label;
  if (typeof kind !== "string") return undefined;
  if (!KINDS.has(kind) && !contributedKinds?.has(kind)) return undefined;
  if (typeof label !== "string" || label.length === 0) return undefined;
  const rawUses = block.uses;
  return {
    kind,
    label,
    uses: Array.isArray(rawUses) ? rawUses.filter((u): u is string => typeof u === "string") : [],
    file,
    block,
  };
}

/**
 * Load every block in the immediate subdirectories of `root`.
 *
 * Mirrors the directory walk the two propagation audits already did —
 * `<root>/<chapter>/<block>.ts` — so this is a change of *how* a block
 * is read, not of which files are considered.
 */
export async function loadBlocksUnder(
  root: string,
  /**
   * Kinds a dependency contributes (a DAK base layer's DAK kinds, since bean
   * `1335`). Without them a contributed block — a persona, a user scenario,
   * a requirement — is silently not a block (litlfred/dth-hrh: 52 of 322).
   */
  contributedKinds?: ReadonlySet<string>,
): Promise<{ blocks: Map<string, LoadedBlock>; failures: BlockLoadFailure[] }> {
  const blocks = new Map<string, LoadedBlock>();
  const failures: BlockLoadFailure[] = [];

  const dirs = await readdir(root, { withFileTypes: true });
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const dirPath = join(root, d.name);
    for (const f of await readdir(dirPath)) {
      const path = join(dirPath, f);
      if (!f.endsWith(".ts") && !(f.endsWith(".json") && isJsonManifest(path))) continue;
      try {
        const b = await loadBlockModule(path, contributedKinds);
        if (b) blocks.set(b.label, b);
      } catch (e) {
        failures.push({ file: path, error: String(e).replace(/\s+/g, " ").slice(0, 300) });
      }
    }
  }
  return { blocks, failures };
}

/**
 * Print load failures and say what their presence means for the result.
 *
 * Returns true when there were any, so a caller can decide whether an
 * audit that could not read part of its corpus should still claim a
 * clean run.
 */
export function reportLoadFailures(failures: BlockLoadFailure[]): boolean {
  if (failures.length === 0) return false;
  console.warn(
    `\n  ⚠ ${failures.length} block${failures.length === 1 ? "" : "s"} failed to load. ` +
      `They were NOT audited — a clean result below does not cover them.`,
  );
  for (const f of failures) console.warn(`      ${f.file}\n        ${f.error}`);
  return true;
}

/**
 * Import the edited source and check it really says what was intended.
 *
 * Written to a sibling temp file rather than over the original: a fresh
 * path gets a fresh module (the loader caches by resolved path), and the
 * same directory keeps every relative import resolving as it would from
 * the real file. Nothing is overwritten until this returns ok.
 *
 * A block that no longer parses, no longer validates, or comes back with
 * a different `uses[]` than requested means the splice was wrong. So
 * does a changed `label` or `kind` — the signature of an edit that
 * landed in the wrong field.
 */
let probeSeq = 0;

export async function verifyEditedBlock(
  tsPath: string,
  newContent: string,
  expectedUses: string[],
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const dir = dirname(tsPath);
  const base = basename(tsPath, ".ts");
  // Unique per call. The loader caches by resolved path, so reusing one
  // probe path returns the FIRST edit's module for every later check —
  // verification that reports on something other than what it was given.
  const probe = join(dir, `.${base}.prune-verify.${process.pid}.${++probeSeq}.ts`);
  try {
    writeFileSync(probe, newContent);
    // input-site: traced #dd90738b — loads the block being edited; an editing path, not a check's
    inputSiteReached("block-module: verifyEditedBlock loads a computed module");
    const before = await import(tsPath);
    // input-site: traced #ec672866 — loads a probe written beside a block; an editing path, not a check's
    inputSiteReached("block-module: verifyEditedBlock loads a computed module");
    const after = await import(probe);
    const b = before.default as Record<string, unknown>;
    const a = after.default as Record<string, unknown>;
    if (!a || typeof a !== "object") return { ok: false, reason: "edited file has no block export" };
    if (a.label !== b.label) {
      return { ok: false, reason: `label changed: ${String(b.label)} -> ${String(a.label)}` };
    }
    if (a.kind !== b.kind) {
      return { ok: false, reason: `kind changed: ${String(b.kind)} -> ${String(a.kind)}` };
    }
    const got = Array.isArray(a.uses) ? (a.uses as string[]) : [];
    if (got.length !== expectedUses.length || got.some((u, i) => u !== expectedUses[i])) {
      return {
        ok: false,
        reason: `uses[] is ${JSON.stringify(got)} after the edit, expected ${JSON.stringify(expectedUses)}`,
      };
    }
    return { ok: true };
  } catch (e) {
    // A throw here is the schema or the parser rejecting the result —
    // exactly what must not reach disk.
    return { ok: false, reason: `edited file does not load: ${String(e).replace(/\s+/g, " ").slice(0, 240)}` };
  } finally {
    try {
      rmSync(probe, { force: true });
    } catch {
      /* best effort */
    }
  }
}
