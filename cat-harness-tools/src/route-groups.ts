/**
 * Mount a declared set of HTTP routes, wherever they are declared.
 *
 * @module src/route-groups
 *
 * ## The defect this exists for
 *
 * `src/server.ts` named five route modules directly:
 *
 * ```ts
 * import { handleFeedbackGet, handleFeedbackPost } from "./routes/feedback.js";
 * import { handleRelevanceGet, handleRelevancePost } from "./routes/relevance.js";
 * ```
 *
 * Three of those five are **content** handlers — a folio's feedback items, a
 * folio's bibliography relevance — sitting under `src/`, which the partition
 * claims for the harness by subdirectory. So they import `FeedbackItem`,
 * `TodoItem*` and `bib-verification` from core, and the harness depends on the
 * content model it is supposed to sit underneath.
 *
 * **Reclassifying them does not fix it, and this was measured rather than
 * assumed.** `bun run cat check:partition` on `d26a96fd`: leaving them in the
 * harness gives 10 wrong-direction edges; moving all three to core gives
 * **11**, because `src/server.ts`, `src/index.ts` and `src/routes/chat.ts`
 * then cross the line to *mount* them. Five new edges replace four. They are
 * content handlers mounted by a harness composition root, so whichever side
 * holds them, the mounting crosses.
 *
 * What removes the edge is the composition root not NAMING them. The module
 * specifier is a variable, read from the declaration — the same device as
 * `qa-checker-discovery`, `render-discovery` and `tool-groups`, and the same
 * reason it is not a loophole: `repo-partition` counts a literal
 * `import("./x")` as an edge and a variable one as none, and the edge
 * disappears exactly when the target stops being hardcoded.
 *
 * ## `ContributionRegistry` is not the mechanism here
 *
 * It looks like it should be, and it is not: `schemas/content/contributions.ts` is
 * read **only for dependencies** — "a root folio's own `contributes` is
 * ignored, because the root already is everything it would contribute". The
 * root's own checkers go through `qa-checker-discovery` and its own renderers
 * through `render-discovery`. Its own routes go through here, for symmetry
 * with those two rather than with the dependency path.
 *
 * ## Order is part of the declaration
 *
 * Route dispatch is first-match-wins, so {@link mountDeclaredRoutes} returns
 * routes in DECLARATION order and the server tries them in that order. This
 * is the one way a route table differs from a tool table, where registration
 * order is immaterial. Reordering the list changes behaviour; that is why the
 * order lives in one visible list instead of in the sequence of `if` blocks it
 * replaced.
 *
 * ## The deps are opaque on purpose
 *
 * {@link RouteDeps.adapter} and every entry of {@link RouteDeps.services} are
 * `unknown`. A route module casts what it needs to its own type, because the
 * layer that OWNS a type is the right place to name it — and typing them here
 * would put `ContentAdapter` and `FeedbackStore` back into the harness, which
 * is the import this module exists to remove. Same rule as
 * `schemas/content/contributions.ts` carrying MCP registrars as
 * `(server: unknown) => void`.
 *
 * ## Three outcomes, never two
 *
 * A declared module that is absent is **skipped and reported** — after the
 * split a harness-only checkout legitimately has no content layer and must
 * still start. A module that is present and fails to load is a different state
 * with the opposite remedy (fix it vs install that layer), so it is never
 * folded into the first. Neither is silent: a server that quietly starts
 * without its feedback routes looks identical to one where they are broken,
 * and the operator finds out from a 404 rather than from the boot log.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { resolveImplementingPath } from "../schemas/kg/harness-config.js";

/** Which repository layer a route will live in after the split. */
export type RouteLayer = "core" | "sci" | "harness";

/**
 * What the server hands a route module when it mounts.
 *
 * Deliberately narrow: a path, an opaque adapter, and a bag of opaque
 * services. Anything richer would have to name a type, and naming a content
 * type here is the edge this module removes.
 */
export interface RouteDeps {
  /** The folio repository root. */
  repoRoot: string;
  /**
   * The active `ContentAdapter`. Opaque here — the route module that needs it
   * casts it, because that module is in the layer that owns the type.
   */
  adapter: unknown;
  /**
   * Services the server owns, by name: `gitHelper`, `feedbackStore`.
   *
   * A named bag rather than typed fields, for the same reason `adapter` is
   * `unknown`. A missing service is `undefined`, and a route that requires one
   * must check — see {@link RouteDeclaration.requires}, which is what makes an
   * absent service legible at boot instead of at the first request.
   */
  services: Readonly<Record<string, unknown>>;
}

/**
 * What a route module's mount factory returns.
 *
 * Both handlers return `null` for "not my URL", which is what makes the
 * server's chain a chain. A `Response` ends dispatch.
 */
export interface MountedRoute {
  /** `req` is the request itself, for a route that must read a header (an `Origin`). */
  get?: (url: URL, req?: Request) => Promise<Response | null> | Response | null;
  post?: (url: URL, req: Request) => Promise<Response | null> | Response | null;
}

export interface RouteDeclaration {
  /** Stable id, used in the boot report and in the dispatch trace. */
  id: string;
  /** Repo-relative module. Resolved by VARIABLE path, so this file imports none. */
  module: string;
  /** The exported factory, called with {@link RouteDeps}. */
  mount: string;
  /**
   * The layer that owns it. Not consulted at runtime — a declaration is not a
   * gate — but it is what makes the boundary reviewable in one place instead
   * of inferable from five import lines.
   */
  layer: RouteLayer;
  /**
   * Service names from {@link RouteDeps.services} this route cannot work
   * without.
   *
   * Checked BEFORE the factory is called, so a missing service is reported as
   * a skip with a name in it rather than as a `TypeError` from inside a
   * handler on some later request.
   */
  needs?: readonly string[];
  /** What it needs on the machine, for the operator reading a skip. */
  requires?: string;
}

/** What happened to one declared route. */
export type RouteOutcome =
  | { id: string; state: "mounted" }
  | { id: string; state: "absent"; layer: RouteLayer; detail: string }
  | { id: string; state: "failed"; detail: string };

export interface RouteMountResult {
  /** The mounted routes, in DECLARATION order. Dispatch depends on it. */
  routes: MountedRoute[];
  /** One per declaration, mounted or not. The caller reports these. */
  outcomes: RouteOutcome[];
}

/**
 * Resolve and mount every declared route.
 *
 * Does not print, so a test can assert on outcomes rather than on stderr —
 * same contract as `registerDeclaredToolGroups`.
 */
export async function mountDeclaredRoutes(
  declarations: readonly RouteDeclaration[],
  /**
   * The DECLARING layer's root. A module is looked up there first and
   * then in the one layer that implements it, so a content route that
   * lives with its content package (owner, 2026-10-04: feedback, glossary
   * and relevance moved up with their content) is found without its path
   * being written here. Same rule as `registerDeclaredToolGroups`.
   */
  root: string,
  deps: RouteDeps,
): Promise<RouteMountResult> {
  const routes: MountedRoute[] = [];
  const outcomes: RouteOutcome[] = [];

  for (const d of declarations) {
    const where = resolveImplementingPath(root, d.module);
    if (where.state === "ambiguous") {
      outcomes.push({
        id: d.id,
        state: "failed",
        detail: `${d.module} is held by more than one implementing instance (${where.candidates.map((c) => c.name).join(", ")}); a declared module must name one file`,
      });
      continue;
    }
    const abs = join(where.state === "found" ? where.root : root, d.module);
    if (!existsSync(abs)) {
      outcomes.push({
        id: d.id,
        state: "absent",
        layer: d.layer,
        detail:
          `${d.module} is not present in this checkout` +
          (d.requires ? ` (it needs ${d.requires})` : "") +
          `; its routes are not served`,
      });
      continue;
    }

    const missing = (d.needs ?? []).filter((n) => deps.services[n] === undefined);
    if (missing.length > 0) {
      // Not `absent`: the module is here and the SERVER did not supply what it
      // asked for. Reported at boot, with the names, rather than surfacing as
      // a TypeError inside a handler on some later request.
      outcomes.push({
        id: d.id,
        state: "failed",
        detail: `${d.module} needs service(s) the server did not provide: ${missing.join(", ")}`,
      });
      continue;
    }

    try {
      // VARIABLE specifier — the target comes from the declaration, so this
      // module names none of the route modules and depends on none of them.
      const mod = (await import(abs)) as Record<string, unknown>;
      const factory = mod[d.mount];
      if (typeof factory !== "function") {
        outcomes.push({ id: d.id, state: "failed", detail: `${d.module} exports no ${d.mount}()` });
        continue;
      }
      const mounted = (factory as (deps: RouteDeps) => MountedRoute)(deps);
      if (!mounted || (mounted.get === undefined && mounted.post === undefined)) {
        // A factory that returns nothing servable is a defect, not an empty
        // route: it would silently remove a URL space the operator believes is
        // mounted, which is the failure mode this whole module is about.
        outcomes.push({
          id: d.id,
          state: "failed",
          detail: `${d.module}#${d.mount}() returned no get or post handler`,
        });
        continue;
      }
      routes.push(mounted);
      outcomes.push({ id: d.id, state: "mounted" });
    } catch (e) {
      // NOT reported as `absent`. The module is there and broken, and the
      // remedy — fix it — is the opposite of "install that layer".
      outcomes.push({
        id: d.id,
        state: "failed",
        detail: `${d.module} failed to mount: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  return { routes, outcomes };
}

/** Try each mounted route in order; the first non-null `Response` wins. */
export async function dispatchGet(routes: readonly MountedRoute[], url: URL, req?: Request): Promise<Response | null> {
  for (const r of routes) {
    const res = await r.get?.(url, req);
    if (res) return res;
  }
  return null;
}

/** As {@link dispatchGet}, for POST. */
export async function dispatchPost(
  routes: readonly MountedRoute[],
  url: URL,
  req: Request,
): Promise<Response | null> {
  for (const r of routes) {
    const res = await r.post?.(url, req);
    if (res) return res;
  }
  return null;
}
