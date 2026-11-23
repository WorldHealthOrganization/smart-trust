#!/usr/bin/env bun
/**
 * The import test of `sample-import.bpmn` — `Task_ImportTest`, "the part only
 * this process does".
 *
 * Usage: `bun run folio-assistant-core/scripts/sample-import-check.ts <instance-root> <item-id>...`
 *
 * Bean `xlg2`. The diagram names four things an import can get wrong, and says
 * *"A check that could not run is a failure, not a pass."* Each is a function
 * of the landed sample and the store's own schemas, so it is checkable here
 * without the network:
 *
 *   1. **count** — every requested item is a node in the store, with at least
 *      one bitstream;
 *   2. **identifiers** — the descriptor's authoritative identifier survived:
 *      the upstream Handle an `ORIGINAL` bitstream was taken from appears among
 *      the item record's `dc.identifier.uri` values;
 *   3. **structure** — the node validates as `folio-catalogue-node/v1` and its
 *      record as `folio-dublin-core/v1`;
 *   4. **provenance** — every materialized bitstream names where it came from
 *      and carries a fixity digest, and the digest is RE-COMPUTED from the held
 *      bytes, because a recorded digest nobody re-checks is decoration.
 *
 * The store here is a `folio-catalogue/v1` directory (`nodes/`, `records/`),
 * which is what a catalogue layer (an IRIS mirror, say) declares. Nothing here names one.
 *
 * @module folio-assistant-core/scripts/sample-import-check
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { CatalogueNodeSchema, type CatalogueNode } from "../schemas/catalogue.js";
import { DublinCoreRecordSchema, dcValues, type DublinCoreRecord } from "../schemas/dublin-core.js";

export type CheckVerdict = "pass" | "fail" | "could-not-run";

export interface ImportCheck {
  name: "count" | "identifiers" | "structure" | "provenance";
  verdict: CheckVerdict;
  evidence: string[];
}

export interface ImportCheckResult {
  checks: ImportCheck[];
  /** True only when every check PASSED — `could-not-run` is a failure. */
  passed: boolean;
}

interface Loaded {
  id: string;
  raw: unknown;
  node?: CatalogueNode;
  record?: DublinCoreRecord;
  recordRaw?: unknown;
  recordError?: string;
}

/**
 * Parse, dropping top-level `_`-prefixed keys — this repository's comment
 * convention (`_comment`), stripped the same way by `check-catalogue.ts`
 * before it validates a record. The strict schemas would otherwise reject a
 * record for carrying its own explanation.
 */
function readJson(path: string): unknown {
  const raw = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const k of Object.keys(raw)) if (k.startsWith("_")) delete raw[k];
  }
  return raw;
}

/** Every catalogue node under `<instanceRoot>/catalogue/nodes`, by its `id`. */
function nodesById(instanceRoot: string): Map<string, unknown> {
  const dir = join(instanceRoot, "catalogue", "nodes");
  const out = new Map<string, unknown>();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const raw = readJson(join(dir, f)) as { id?: unknown };
    if (typeof raw.id === "string") out.set(raw.id, raw);
  }
  return out;
}

export function checkSampleImport(instanceRoot: string, itemIds: readonly string[]): ImportCheckResult {
  const root = resolve(instanceRoot);
  const all = nodesById(root);
  const loaded: Loaded[] = itemIds.map((id) => {
    const raw = all.get(id);
    const parsed = raw === undefined ? undefined : CatalogueNodeSchema.safeParse(raw);
    const l: Loaded = { id, raw, node: parsed?.success ? parsed.data : undefined };
    const ref = (raw as { metadataRef?: unknown } | undefined)?.metadataRef;
    if (typeof ref === "string") {
      const p = join(root, ref);
      if (!existsSync(p)) l.recordError = `metadataRef ${ref} does not resolve`;
      else {
        l.recordRaw = readJson(p);
        const r = DublinCoreRecordSchema.safeParse(l.recordRaw);
        if (r.success) l.record = r.data;
      }
    }
    return l;
  });

  // 1. count
  const count: ImportCheck = { name: "count", verdict: "pass", evidence: [] };
  const present = loaded.filter((l) => l.raw !== undefined);
  count.evidence.push(`${present.length} of ${itemIds.length} requested item(s) are nodes in the store`);
  for (const l of loaded) {
    if (l.raw === undefined) {
      count.verdict = "fail";
      count.evidence.push(`${l.id}: absent`);
      continue;
    }
    const n = ((l.raw as { bitstreams?: unknown[] }).bitstreams ?? []).length;
    count.evidence.push(`${l.id}: ${n} bitstream(s)`);
    if (n === 0) count.verdict = "fail";
  }
  if (itemIds.length === 0) {
    count.verdict = "could-not-run";
    count.evidence.push("no items were requested — nothing to count");
  }

  // 3. structure (before identifiers, which reads the parsed record)
  const structure: ImportCheck = { name: "structure", verdict: "pass", evidence: [] };
  for (const l of present) {
    const n = CatalogueNodeSchema.safeParse(l.raw);
    structure.evidence.push(`${l.id}: node ${n.success ? "validates" : `INVALID (${n.error.issues[0]?.message})`}`);
    if (!n.success) structure.verdict = "fail";
    if (l.recordError) {
      structure.verdict = "fail";
      structure.evidence.push(`${l.id}: ${l.recordError}`);
    } else if (l.recordRaw !== undefined) {
      const r = DublinCoreRecordSchema.safeParse(l.recordRaw);
      structure.evidence.push(`${l.id}: record ${r.success ? "validates" : `INVALID (${r.error.issues[0]?.message})`}`);
      if (!r.success) structure.verdict = "fail";
    } else {
      structure.verdict = "fail";
      structure.evidence.push(`${l.id}: no metadataRef, so no record to validate`);
    }
  }
  if (present.length === 0) structure.verdict = "could-not-run";

  // 2. identifiers
  const identifiers: ImportCheck = { name: "identifiers", verdict: "pass", evidence: [] };
  for (const l of present) {
    if (!l.node || !l.record) {
      identifiers.verdict = "could-not-run";
      identifiers.evidence.push(`${l.id}: node or record did not parse — identifiers cannot be compared`);
      continue;
    }
    const uris = dcValues(l.record, "identifier", "uri").map((v) => v.value);
    const upstreams = l.node.bitstreams
      .filter((b) => b.bundle === "ORIGINAL")
      .map((b) => (b.materialization?.provenance as { upstream?: string } | undefined)?.upstream)
      .filter((u): u is string => typeof u === "string");
    if (upstreams.length === 0) {
      identifiers.verdict = "could-not-run";
      identifiers.evidence.push(`${l.id}: no ORIGINAL bitstream names an upstream to compare`);
      continue;
    }
    for (const u of upstreams) {
      const ok = uris.includes(u);
      identifiers.evidence.push(`${l.id}: upstream ${u} ${ok ? "is" : "is NOT"} among dc.identifier.uri`);
      if (!ok && identifiers.verdict === "pass") identifiers.verdict = "fail";
    }
  }
  if (present.length === 0) identifiers.verdict = "could-not-run";

  // 4. provenance
  const provenance: ImportCheck = { name: "provenance", verdict: "pass", evidence: [] };
  const fail = (v: CheckVerdict) => {
    if (provenance.verdict === "pass" || (provenance.verdict === "could-not-run" && v === "fail")) provenance.verdict = v;
  };
  let materialized = 0;
  for (const l of present) {
    if (!l.node) {
      fail("could-not-run");
      provenance.evidence.push(`${l.id}: node did not parse`);
      continue;
    }
    for (const b of l.node.bitstreams) {
      const m = b.materialization;
      if (!m || m.state !== "materialized") continue;
      materialized++;
      const where = m.provenance ? Object.keys(m.provenance).join("+") : "";
      if (!where) {
        fail("fail");
        provenance.evidence.push(`${l.id} ${b.name}: no provenance`);
      }
      if (!m.fixity) {
        fail("fail");
        provenance.evidence.push(`${l.id} ${b.name}: no fixity`);
        continue;
      }
      const p = m.localPath ? join(root, m.localPath) : undefined;
      if (!p || !existsSync(p)) {
        fail("could-not-run");
        provenance.evidence.push(`${l.id} ${b.name}: held bytes not found at ${m.localPath ?? "(no localPath)"} — fixity not re-computed`);
        continue;
      }
      const got = createHash(m.fixity.algorithm).update(readFileSync(p)).digest("hex");
      const ok = got === m.fixity.digest;
      provenance.evidence.push(`${l.id} ${b.name}: ${where}; ${m.fixity.algorithm} re-computed ${ok ? "matches" : `MISMATCH (${got})`}`);
      if (!ok) fail("fail");
    }
  }
  if (materialized === 0) {
    fail("could-not-run");
    provenance.evidence.push("no materialized bitstream in the sample — nothing to check");
  }

  const checks = [count, identifiers, structure, provenance];
  return { checks, passed: checks.every((c) => c.verdict === "pass") };
}

export function describeImportCheck(r: ImportCheckResult): string {
  const lines = r.checks.flatMap((c) => [`${c.verdict === "pass" ? "✓" : "✗"} ${c.name}: ${c.verdict}`, ...c.evidence.map((e) => `    ${e}`)]);
  lines.push(r.passed ? "every check passed" : "NOT every check passed — a check that could not run is a failure");
  return lines.join("\n");
}

if (import.meta.main) {
  const [instanceRoot, ...ids] = process.argv.slice(2);
  if (!instanceRoot || ids.length === 0) {
    console.error("usage: sample-import-check.ts <instance-root> <item-id>...");
    process.exit(2);
  }
  const r = checkSampleImport(instanceRoot, ids);
  console.log(describeImportCheck(r));
  process.exit(r.passed ? 0 : 1);
}
