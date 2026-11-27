/**
 * Folio Assistant — Branch management API routes (generic).
 *
 * GET  /api/branches     → { current, branches[] }
 * GET  /api/branch       → { branch }
 * GET  /api/git/status   → { dirty, branch, changes[] }
 * POST /api/git/checkout → switch branches with dirty-state handling
 *
 * @module folio-assistant/routes/branches
 */

import type { GitHelper } from "../core/git.js";
import { log, logDebug } from "../core/logging.js";
import { spawnSync } from "child_process";
import type { MountedRoute, RouteDeps } from "../route-groups.js";
import { refuseBranchName, refuseCheckoutRequest } from "../core/http-guard.js";

/** Read-only GETs only. The checkout POST sends no CORS header (see core/http-guard.ts). */
const CORS = { "Access-Control-Allow-Origin": "*" };

export function handleBranchGet(url: URL, gitHelper: GitHelper): Response | null {
  const path = url.pathname;

  if (path === "/api/branches") {
    gitHelper.fetchOrigin();
    const branches = gitHelper.listBranches();
    log("git", `branches: ${branches.length} total, HEAD=${gitHelper.currentBranch()}`);
    return Response.json(
      { current: gitHelper.currentBranch(), branches },
      { headers: { "Cache-Control": "no-cache", ...CORS } },
    );
  }

  if (path === "/api/branch") {
    return Response.json(
      { branch: gitHelper.currentBranch() },
      { headers: { "Cache-Control": "no-cache", ...CORS } },
    );
  }

  if (path === "/api/git/status") {
    try {
      const r = spawnSync("git", ["status", "--porcelain"], {
        cwd: gitHelper["repoRoot"],
        stdio: "pipe",
      });
      const output = r.stdout.toString().trim();
      const changes = output ? output.split("\n").map((l: string) => l.trim()).filter(Boolean) : [];
      logDebug("git", `status: branch=${gitHelper.currentBranch()} dirty=${changes.length > 0}`);
      return Response.json(
        { branch: gitHelper.currentBranch(), dirty: changes.length > 0, changes },
        { headers: { "Cache-Control": "no-cache", ...CORS } },
      );
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500, headers: CORS });
    }
  }

  return null;
}

export async function handleBranchPost(url: URL, req: Request, gitHelper: GitHelper): Promise<Response | null> {
  if (url.pathname !== "/api/git/checkout") return null;

  // Authorised and JSON-only: this route rewrites the working tree.
  const refused = refuseCheckoutRequest(req);
  if (refused) return refused;

  try {
    const body = (await req.json()) as {
      branch: unknown;
      action?: "switch" | "stash" | "commit" | "discard";
    };
    const badBranch = refuseBranchName(body.branch);
    if (badBranch) return badBranch;
    const targetBranch = body.branch as string;
    const action = body.action || "switch";
    const fromBranch = gitHelper.currentBranch();
    const repoRoot = gitHelper["repoRoot"];
    log("git", `checkout: ${fromBranch} → ${targetBranch}`, `action=${action}`);

    // Check if dirty
    const st = spawnSync("git", ["status", "--porcelain"], { cwd: repoRoot, stdio: "pipe" });
    const dirty = st.stdout.toString().trim().length > 0;

    if (dirty) {
      if (action === "stash") {
        const stash = spawnSync("git", ["stash", "push", "-m", `folio-auto-stash-${fromBranch}`], {
          cwd: repoRoot,
          stdio: "pipe",
        });
        if (stash.status !== 0) {
          return Response.json(
            { error: `Stash failed: ${stash.stderr.toString()}` },
            { status: 500 },
          );
        }
      } else if (action === "commit") {
        spawnSync("git", ["add", "-A"], { cwd: repoRoot, stdio: "pipe" });
        const commit = spawnSync("git", ["commit", "-m", "Folio: auto-save before branch switch"], {
          cwd: repoRoot,
          stdio: "pipe",
        });
        if (commit.status !== 0) {
          return Response.json(
            { error: `Commit failed: ${commit.stderr.toString()}` },
            { status: 500 },
          );
        }
      } else if (action === "discard") {
        spawnSync("git", ["checkout", "--", "."], { cwd: repoRoot, stdio: "pipe" });
        spawnSync("git", ["clean", "-fd"], { cwd: repoRoot, stdio: "pipe" });
      } else {
        return Response.json(
          {
            error: "dirty",
            message: "Working tree has uncommitted changes",
            branch: fromBranch,
            changes: st.stdout.toString().trim().split("\n").filter(Boolean),
          },
          { status: 409 },
        );
      }
    }

    const co = spawnSync("git", ["checkout", targetBranch, "--"], { cwd: repoRoot, stdio: "pipe" });
    if (co.status !== 0) {
      return Response.json(
        { error: `Checkout failed: ${co.stderr.toString()}` },
        { status: 500 },
      );
    }

    log("git", `checkout: ok — now on ${gitHelper.currentBranch()}`);
    return Response.json({ ok: true, branch: gitHelper.currentBranch() });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

// ── Mount ────────────────────────────────────────────────────────

/**
 * Mount factory read by the route declaration in `src/server.ts`.
 *
 * `gitHelper` is the harness's own service, so this cast crosses no layer —
 * branches are declared for uniformity, not because they were part of the
 * boundary problem. Having ONE dispatch list is the point: a route mounted a
 * second way is a route nobody reviews alongside the others.
 */
export function mountBranchRoutes(deps: RouteDeps): MountedRoute {
  const git = deps.services.gitHelper as GitHelper;
  return {
    get: (url) => handleBranchGet(url, git),
    post: (url, req) => handleBranchPost(url, req, git),
  };
}
