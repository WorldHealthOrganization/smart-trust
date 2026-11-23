/**
 * Folio Assistant — refusals shared by the mutating HTTP routes.
 *
 * Both servers (`src/server.ts` and `adapters/mcp-server/server.ts`) serve
 * `/api/git/checkout` and `/api/chat`, so the checks live here, once.
 *
 * - A mutating route reads only `application/json`. A cross-origin page can
 *   send `text/plain` with no preflight; it cannot send `application/json`
 *   without one, and these routes answer no preflight.
 * - These routes send no `Access-Control-Allow-Origin`: the viewer calls them
 *   from its own origin.
 * - Each names the ODRL action it needs (`cat-harness/policies/http-gateway.jsonld`).
 *
 * @module folio-assistant/core/http-guard
 */

import { allows, forbidden } from "./rbac.js";

/** Switching, stashing, committing or discarding the working tree is authoring. */
export const CHECKOUT_ACTION = "content-authoring";
/** Chat spends the server's API key; it needs a granted action, not the anonymous floor. */
export const CHAT_ACTION = "review-comments";
/** Chat in `edit` mode proposes content changes. */
export const CHAT_EDIT_ACTION = "content-authoring";

/** 415 unless the body is declared as JSON. */
export function requireJson(req: Request): Response | null {
  const type = (req.headers.get("content-type") || "").split(";")[0]!.trim().toLowerCase();
  if (type === "application/json") return null;
  return Response.json({ error: "Content-Type must be application/json" }, { status: 415 });
}

/** The refusal for a `/api/git/checkout` request before its body is read, or `null`. */
export function refuseCheckoutRequest(req: Request): Response | null {
  return requireJson(req)
    ?? (allows(req, CHECKOUT_ACTION) ? null : forbidden("switching branches", CHECKOUT_ACTION));
}

/**
 * The refusal for a branch name, or `null`. A name starting with `-` would be
 * read by git as an option, so it is refused, not escaped.
 */
export function refuseBranchName(branch: unknown): Response | null {
  if (typeof branch !== "string" || branch.length === 0 || branch.startsWith("-")) {
    return Response.json({ error: "Invalid branch name" }, { status: 400 });
  }
  return null;
}

/** The refusal for a `/api/chat` request before its body is read, or `null`. */
export function refuseChatRequest(req: Request): Response | null {
  return requireJson(req)
    ?? (allows(req, CHAT_ACTION) ? null : forbidden("chat", CHAT_ACTION));
}

/** The refusal for the chat `mode` this request asks for, or `null`. */
export function refuseChatMode(req: Request, mode: string): Response | null {
  if (mode !== "read" && mode !== "edit" && mode !== "status") {
    return Response.json({ error: "Invalid mode" }, { status: 400 });
  }
  if (mode === "edit" && !allows(req, CHAT_EDIT_ACTION)) {
    return forbidden("chat in edit mode", CHAT_EDIT_ACTION);
  }
  return null;
}
