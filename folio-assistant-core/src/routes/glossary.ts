/**
 * Folio Assistant — Glossary curator API routes.
 *
 * Powers `/folio/glossary-curator.html`. Lets the author pick the
 * canonical `:defterm` site for each unowned glossary slug.
 *
 *   GET  /api/glossary/candidates?paper=<dir>   → CandidatesReport JSON
 *   GET  /api/glossary/curation?paper=<dir>     → current decisions JSON
 *   POST /api/glossary/curation                  → save decisions (collaborator+)
 *
 * The candidates JSON is regenerated on every GET (cheap walk; ~1s on a
 * typical paper). Decisions are persisted to
 * `<repo>/content/<paper>/glossary-curation.json`. A separate apply
 * script (`bun run cat-harness-tools/pipeline/apply-glossary-curation.ts`) writes the
 * `defines: [...]` fields into the chosen blocks' `.ts` files.
 *
 * @module folio-assistant/routes/glossary
 */

import { folioDir } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";

import { allows, forbidden } from "@litlfred/cat-harness-tools/src/core/rbac.js";
import { log } from "@litlfred/cat-harness-tools/src/core/logging.js";
import type { MountedRoute, RouteDeps } from "@litlfred/cat-harness-tools/src/route-groups.js";

const CORS = { "Access-Control-Allow-Origin": "*" };

interface GlossaryRoutesConfig {
  /** Repo root directory. */
  repoRoot: string;
}

function paperDir(repoRoot: string, paper: string): string {
  // Sanitize: only allow simple slug-like names. Do not echo the
  // raw input back in the error to avoid log-injection.
  if (!/^[a-z0-9][a-z0-9-]*$/.test(paper)) {
    throw new Error("invalid paper name format");
  }
  return join(folioDir(repoRoot),  paper);
}

// ── GET handlers ────────────────────────────────────────────────

export async function handleGlossaryGet(
  url: URL,
  config: GlossaryRoutesConfig,
): Promise<Response | null> {
  const path = url.pathname;

  if (path === "/api/glossary/candidates") {
    const paper = url.searchParams.get("paper") ?? "";
    if (!paper) {
      return Response.json({ error: "missing paper param" }, { status: 400, headers: CORS });
    }
    try {
      const dir = paperDir(config.repoRoot, paper);
      // Lazy-load to avoid pulling the content schema at server start.
      const mod = await import(
        resolve(config.repoRoot, "content/pipeline/glossary-candidates.ts")
      );
      const report = await mod.proposeCandidates(dir);
      return Response.json(report, { headers: CORS });
    } catch (e) {
      log("glossary", `candidates error: ${e}`);
      return Response.json({ error: String(e) }, { status: 500, headers: CORS });
    }
  }

  if (path === "/api/glossary/curation") {
    const paper = url.searchParams.get("paper") ?? "";
    if (!paper) {
      return Response.json({ error: "missing paper param" }, { status: 400, headers: CORS });
    }
    try {
      const dir = paperDir(config.repoRoot, paper);
      const f = join(dir, "glossary-curation.json");
      if (!existsSync(f)) {
        return Response.json({ decisions: [] }, { headers: CORS });
      }
      return Response.json(JSON.parse(readFileSync(f, "utf-8")), { headers: CORS });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500, headers: CORS });
    }
  }

  return null;
}

// ── POST handlers ───────────────────────────────────────────────

export async function handleGlossaryPost(
  url: URL,
  req: Request,
  config: GlossaryRoutesConfig,
): Promise<Response | null> {
  const path = url.pathname;

  if (path === "/api/glossary/curation" && req.method === "POST") {
    if (!allows(req, "content-authoring")) {
      return forbidden("saving glossary curation", "content-authoring");
    }
    try {
      const body = (await req.json()) as {
        paper: string;
        decisions: { slug: string; ownerBlock: string; tsPath: string }[];
      };
      if (!body.paper || !Array.isArray(body.decisions)) {
        return Response.json({ error: "bad payload" }, { status: 400, headers: CORS });
      }
      const dir = paperDir(config.repoRoot, body.paper);
      const f = join(dir, "glossary-curation.json");
      const payload = {
        updated: new Date().toISOString(),
        decisions: body.decisions,
      };
      writeFileSync(f, JSON.stringify(payload, null, 2) + "\n");
      log(
        "glossary",
        `saved curation: paper=${body.paper}`,
        `decisions=${body.decisions.length}`,
      );
      return Response.json({ ok: true, count: body.decisions.length }, { headers: CORS });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500, headers: CORS });
    }
  }

  return null;
}

// ── Mount ────────────────────────────────────────────────────────

/** Mount factory read by the route declaration in `src/server.ts`. */
export function mountGlossaryRoutes(deps: RouteDeps): MountedRoute {
  const config = { repoRoot: deps.repoRoot };
  return {
    get: (url) => handleGlossaryGet(url, config),
    post: (url, req) => handleGlossaryPost(url, req, config),
  };
}
