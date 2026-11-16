/**
 * `GET /api/work-plan/beans-processed` — the beans-by-process rows, read now
 * from the local store, for the all-beans page's 5-second refresh
 * (cat-harness#991 proposal §4.9; owner, 2026-11-03: "5 sec refresh is local
 * mcp bean store. on ghpages, refresh makes no sense").
 *
 * Local only, and read only:
 *
 * - It answers a request addressed to `localhost`, `127.0.0.1` or `::1`, and
 *   refuses any other host with 403: the work plan is not served to a network.
 * - Cross-origin reads are allowed from a localhost origin only (a site
 *   preview on another local port); never `*`, unlike the server's other GETs.
 * - No store operation that writes is reachable from it.
 *
 * The beans come through the work-plan store the deployment names
 * (`workPlanStoreFor`, Q-BSD-2 A); the layers from the checkout's
 * `workflows/`. The rows carry no drawing or page links: the page keeps the
 * ones it was built with and replaces only what moves.
 *
 * @module folio-assistant/routes/work-plan
 */
import { basename } from "node:path";
import { readDeclaration } from "../../schemas/kg/cat-harness.ts";
import type { BeanNode } from "../../scripts/beans.ts";
import { processedBeansRows, unplacedBeans } from "../../scripts/processed-beans.ts";
import type { MountedRoute, RouteDeps } from "../route-groups.js";
import { listInstances } from "../workflow/store.ts";
import { workPlanStoreFor } from "../workflow/work-plan-store-select.ts";
import type { BeanFields } from "../workflow/work-plan-store.ts";

export const BEANS_PROCESSED_PATH = "/api/work-plan/beans-processed";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** A localhost origin may read; any other origin gets no CORS header at all. */
function corsFor(req: Request | undefined): Record<string, string> {
  const origin = req?.headers.get("origin");
  if (!origin) return {};
  try {
    return LOCAL_HOSTS.has(new URL(origin).hostname) ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};
  } catch {
    return {};
  }
}

/** A store bean as the rows read it. Only the fields the page shows are filled. */
function asBeanNode(b: BeanFields): BeanNode {
  return {
    id: b.id,
    file: "",
    title: b.title,
    status: b.status,
    type: b.type,
    priority: "",
    parent: b.parent ?? "",
    blocking: [],
    createdAt: "",
    updatedAt: "",
    body: b.body,
  } as BeanNode;
}

/** The payload, read now. Throws when the store or the layers cannot be read. */
export function beansProcessedNow(repoRoot: string, env: Readonly<Record<string, string | undefined>>, now: Date) {
  const { store, tool, deployment } = workPlanStoreFor(repoRoot, env);
  const beans = [...store.list({}), ...store.list({ archived: true })].map(asBeanNode);
  const rows = processedBeansRows({
    instances: listInstances(repoRoot),
    beans,
    now,
    diagrams: new Map(),
    drawingFor: () => undefined,
    instanceHref: () => undefined,
  });
  return {
    store: readDeclaration(repoRoot)?.name ?? basename(repoRoot),
    tool,
    ...(deployment ? { deployment } : {}),
    at: now.toISOString(),
    rows,
    unplaced: unplacedBeans(beans, rows),
  };
}

export function handleWorkPlanGet(url: URL, repoRoot: string, env: Readonly<Record<string, string | undefined>>, req?: Request): Response | null {
  if (url.pathname !== BEANS_PROCESSED_PATH) return null;
  const cors = corsFor(req);
  if (!LOCAL_HOSTS.has(url.hostname)) {
    return Response.json({ error: "the work plan is served to localhost only" }, { status: 403 });
  }
  try {
    // input-site: inert #9ba4d449 — the moment of the answer; a live route, never a check's input
    const now = new Date();
    return Response.json(beansProcessedNow(repoRoot, env, now), { headers: { "Cache-Control": "no-store", ...cors } });
  } catch (e) {
    // Could not read is not "empty": the page keeps what it has and says why.
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 503, headers: { "Cache-Control": "no-store", ...cors } });
  }
}

export function mountWorkPlanRoutes(deps: RouteDeps): MountedRoute {
  return {
    // input-site: env CAT_DEPLOYMENT #98ae0e5a — names the checkout's deployment description, which chooses the store
    get: (url, req) => handleWorkPlanGet(url, deps.repoRoot, process.env, req),
  };
}
