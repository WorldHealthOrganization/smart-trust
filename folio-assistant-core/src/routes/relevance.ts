/**
 * Folio Assistant — source-relevance API routes.
 *
 * Presents the source ledger (`schemas/bib-attestations.ts`: the attestation
 * store's `bib-verification` family, or `<folio>/bib-qa-verifications.json`
 * before migration) to the
 * author: what has been uploaded, whether it bears on the folio, which of
 * its results are usable, whether it is already cited, and what to do next.
 *
 *   GET  /api/relevance/ledger?verdict=&status=&cited=  → triaged rows
 *   GET  /api/relevance/queue                            → untriaged rows
 *   GET  /api/relevance/summary                          → counts for a dashboard
 *   POST /api/relevance/adjudicate                       → accept/revise a verdict
 *
 * ## The join happens here
 *
 * The ledger stores no bibliographic metadata — only a reference `id`.  These
 * handlers read the folio's bibliography (its per-entry files and `references.ts`,
 * through cat-harness-tools `reference-entries.ts`) and join title/authors/year
 * onto each row at request time.  That is the whole point of the split: one
 * writer for metadata, many readers.  Do not cache the joined shape back into
 * the ledger.
 *
 * ## Adjudication
 *
 * A relevance verdict produced by an agent is a claim.  `POST
 * /api/relevance/adjudicate` is how a human accepts, revises, or rejects it,
 * writing `human_adjudicated` alongside — never overwriting — the agent's
 * `assessed_by`.  Both survive, so the dashboard can distinguish "an agent
 * thinks this is core" from "the author agrees".
 *
 * @module folio-assistant/routes/relevance
 */

import { existsSync } from "fs";

import { readSourceLedger, writeSourceLedger } from "@litlfred/cat-harness-tools/schemas/library/bib-attestations.js";
import { join } from "path";

import { allows, forbidden, principalOf } from "@litlfred/cat-harness-tools/src/core/rbac.js";
import { log } from "@litlfred/cat-harness-tools/src/core/logging.js";
import { authorNames, entryUrl, issuedYear, referenceEntries, stringField } from "@litlfred/cat-harness-tools/pipeline/reference-entries.ts";
import type { MountedRoute, RouteDeps } from "@litlfred/cat-harness-tools/src/route-groups.js";
import type {
  LedgerEntry,
  RelevanceVerdict,
  SourceLedger,
} from "@litlfred/cat-harness-tools/schemas/library/bib-verification.js";

const CORS = { "Access-Control-Allow-Origin": "*" };

interface RelevanceRoutesConfig {
  /** Repo root directory. */
  repoRoot: string;
}

/** Bibliographic facts, read from references.ts and joined onto a row. */
interface RefFacts {
  title: string | null;
  authors: string | null;
  year: string | null;
  url: string | null;
}

/** The ONE reader of the source ledger: the attestation store, or the legacy file before migration. */
function readLedger(repoRoot: string): SourceLedger {
  const read = readSourceLedger(repoRoot);
  log("relevance", read.note);
  return read.ledger;
}

/**
 * The facts the ledger deliberately does not store, from the folio's
 * bibliography: its per-entry files and any `ref({…})` left in
 * `references.ts`, read through cat-harness-tools `reference-entries.ts`
 * (qou keeps one file per entry since bean qou-l7pj). Read, never executed:
 * the route needs four strings per entry, not the validated CSL objects.
 */
export function readRefFacts(repoRoot: string): Map<string, RefFacts> {
  const out = new Map<string, RefFacts>();
  for (const e of referenceEntries(repoRoot)) {
    const names = authorNames(e);
    const authors = names.length ? (names.length > 3 ? `${names[0]} et al.` : names.join(", ")) : null;
    out.set(e.id, {
      title: stringField(e, "title") ?? null,
      authors,
      year: issuedYear(e) ?? null,
      url: entryUrl(e) ?? null,
    });
  }
  return out;
}

/** A ledger row plus the reference facts joined in for display. */
function decorate(e: LedgerEntry, facts: Map<string, RefFacts>, repoRoot: string) {
  const file = e.source?.kind === "upload" ? e.source.file : null;
  const ref = e.id ? (facts.get(e.id) ?? null) : null;
  return {
    ...e,
    /** Joined at read time from references.ts — never stored in the ledger. */
    reference: ref,
    /** True when the row cites a local document that is not in the repo. */
    sourceMissing: file ? !existsSync(join(repoRoot, file)) : false,
    /** True when the document backs no reference yet. */
    orphan: e.id === null,
  };
}

// ── GET ──────────────────────────────────────────────────────────

export async function handleRelevanceGet(
  url: URL,
  config: RelevanceRoutesConfig,
): Promise<Response | null> {
  const path = url.pathname;
  if (!path.startsWith("/api/relevance/")) return null;

  const ledger = readLedger(config.repoRoot);
  const facts = readRefFacts(config.repoRoot);

  if (path === "/api/relevance/summary") {
    const byVerdict: Record<string, number> = {};
    let triaged = 0;
    let orphans = 0;
    let missing = 0;
    let openActions = 0;
    for (const e of ledger.entries) {
      if (e.id === null) orphans++;
      if (e.source?.kind === "upload" && !existsSync(join(config.repoRoot, e.source.file))) {
        missing++;
      }
      if (!e.relevance) continue;
      triaged++;
      byVerdict[e.relevance.verdict] = (byVerdict[e.relevance.verdict] ?? 0) + 1;
      openActions += e.relevance.proposedActions.filter((a) => a.action !== "no-action").length;
    }
    return Response.json(
      {
        total: ledger.entries.length,
        triaged,
        untriaged: ledger.entries.length - triaged,
        orphans,
        sourceMissing: missing,
        openActions,
        byVerdict,
      },
      { headers: CORS },
    );
  }

  if (path === "/api/relevance/queue") {
    // What the author has not looked at yet.  Uploaded documents first:
    // an external row with no local copy cannot be read here anyway.
    const rows = ledger.entries
      .filter((e) => !e.relevance)
      .sort((a, b) => Number(b.source?.kind === "upload") - Number(a.source?.kind === "upload"))
      .map((e) => decorate(e, facts, config.repoRoot));
    return Response.json({ count: rows.length, entries: rows }, { headers: CORS });
  }

  if (path === "/api/relevance/ledger") {
    const verdict = url.searchParams.get("verdict");
    const status = url.searchParams.get("status");
    const cited = url.searchParams.get("cited");

    let rows = ledger.entries.filter((e) => e.relevance);
    if (verdict) rows = rows.filter((e) => e.relevance?.verdict === verdict);
    if (status) rows = rows.filter((e) => e.status === status);
    if (cited === "false") rows = rows.filter((e) => e.id === null);
    if (cited === "true") rows = rows.filter((e) => e.id !== null);

    // Most actionable first: core before supporting, and within a verdict,
    // the rows carrying the most outstanding proposals.
    const rank: Record<RelevanceVerdict, number> = {
      core: 0,
      supporting: 1,
      undetermined: 2,
      tangential: 3,
      "not-relevant": 4,
    };
    rows.sort((a, b) => {
      const d = rank[a.relevance!.verdict] - rank[b.relevance!.verdict];
      if (d !== 0) return d;
      return b.relevance!.proposedActions.length - a.relevance!.proposedActions.length;
    });

    return Response.json(
      {
        count: rows.length,
        entries: rows.map((e) => decorate(e, facts, config.repoRoot)),
      },
      { headers: CORS },
    );
  }

  return null;
}

// ── POST ─────────────────────────────────────────────────────────

interface AdjudicatePayload {
  /** Upload path, or reference id for an external row. */
  key: string;
  /** Accept the agent's verdict, or replace it. */
  verdict?: RelevanceVerdict;
  who: string;
  note?: string;
}

export async function handleRelevancePost(
  req: Request,
  url: URL,
  config: RelevanceRoutesConfig,
): Promise<Response | null> {
  if (url.pathname !== "/api/relevance/adjudicate") return null;

  if (!allows(req, "adjudication")) {
    return forbidden("adjudicating a relevance verdict", "adjudication");
  }

  let payload: AdjudicatePayload;
  try {
    payload = (await req.json()) as AdjudicatePayload;
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400, headers: CORS });
  }
  if (!payload?.key || !payload?.who) {
    return Response.json({ error: "key and who are required" }, { status: 400, headers: CORS });
  }

  const ledger = readLedger(config.repoRoot);
  const entry = ledger.entries.find(
    (e) => (e.source?.kind === "upload" ? e.source.file : e.id) === payload.key,
  );
  if (!entry) {
    return Response.json({ error: "no such ledger row" }, { status: 404, headers: CORS });
  }
  if (!entry.relevance) {
    return Response.json(
      { error: "row has no relevance assessment to adjudicate" },
      { status: 409, headers: CORS },
    );
  }

  // The agent's claim is preserved: a human decision is recorded alongside
  // `assessed_by`, never in place of it.
  if (payload.verdict) entry.relevance.verdict = payload.verdict;
  entry.relevance.human_adjudicated = {
    who: payload.who,
    at: new Date().toISOString(),
    ...(payload.note ? { note: payload.note } : {}),
  };

  // Written back to where it was read from; the store write is verified by reading back.
  writeSourceLedger(config.repoRoot, ledger);
  log("relevance", `adjudicated ${payload.key} by ${principalOf(req).actor}`);

  return Response.json({ ok: true, entry }, { headers: CORS });
}

// ── Mount ────────────────────────────────────────────────────────

/**
 * Mount factory read by the route declaration in `src/server.ts`.
 *
 * Note the argument order: `handleRelevancePost` takes `(req, url, config)`
 * while every other POST handler here takes `(url, req, ...)`. The factory is
 * where that inconsistency stops — the loader sees one shape.
 */
export function mountRelevanceRoutes(deps: RouteDeps): MountedRoute {
  const config = { repoRoot: deps.repoRoot };
  return {
    get: (url) => handleRelevanceGet(url, config),
    post: (url, req) => handleRelevancePost(req, url, config),
  };
}
