/**
 * Folio Assistant — Feedback API routes (generic).
 *
 * GET  /api/feedback?itemId=X&rootName=Y → todos for one block
 * GET  /api/feedback/all?status=open     → all todos
 * POST /api/feedback                     → create todo
 * POST /api/feedback/update              → update priority/status
 * POST /api/feedback/delete              → delete (collaborator+)
 * POST /api/feedback/triage              → AI triage
 *
 * @module folio-assistant/routes/feedback
 */

import {
  FeedbackStore, INVALID_ENUM, parseTodoPriority, parseTodoStatus,
  TODO_PRIORITIES, TODO_STATUSES,
} from "@litlfred/cat-harness-tools/src/core/feedback.js";
import {
  EMPTY_NOTE_TAGS,
  NoteTagsSchema,
  type ArtefactRef,
  type ExternalIdentity,
  type KgRef,
  type NoteTags,
  type TaskRef,
} from "@litlfred/cat-harness-tools/schemas/kg/carried-note.js";
import type { FeedbackItem } from "@litlfred/cat-harness-tools/schemas/types.js";
import type { ContentAdapter } from "@litlfred/cat-harness-tools/src/types.js";
import { getUserName, getUserEmail, allows, forbidden } from "@litlfred/cat-harness-tools/src/core/rbac.js";
import { log } from "@litlfred/cat-harness-tools/src/core/logging.js";
import type { MountedRoute, RouteDeps } from "@litlfred/cat-harness-tools/src/route-groups.js";

const CORS = { "Access-Control-Allow-Origin": "*" };

export type TaggedFeedbackItem = FeedbackItem & { tags?: NoteTags };

function parseIdentityEntry(
  entry: string | ExternalIdentity,
  actor?: string,
  displayName?: string,
): ExternalIdentity | undefined {
  const validDisplay = displayName && displayName !== "anonymous" ? displayName : undefined;
  if (typeof entry !== "string") {
    return {
      ...entry,
      ...(entry.displayName === undefined && validDisplay ? { displayName: validDisplay } : {}),
      ...(entry.actor === undefined && actor ? { actor } : {}),
    };
  }
  const idx = entry.indexOf(":");
  if (idx <= 0 || idx === entry.length - 1) return undefined;
  return {
    provider: entry.slice(0, idx),
    id: entry.slice(idx + 1),
    ...(validDisplay ? { displayName: validDisplay } : {}),
    ...(actor ? { actor } : {}),
  };
}

function buildSubmissionTags(input: {
  author?: string;
  authorEmail?: string;
  actor?: string;
  identities?: ReadonlyArray<string | ExternalIdentity>;
  roles?: readonly string[];
  processes?: readonly string[];
  tasks?: readonly TaskRef[];
  targetLabel?: string;
  references?: readonly KgRef[];
  artefacts?: readonly ArtefactRef[];
}): NoteTags {
  const identities: ExternalIdentity[] = [];
  for (const raw of input.identities ?? []) {
    const parsed = parseIdentityEntry(raw, input.actor, input.author);
    if (parsed) identities.push(parsed);
  }
  if (identities.length === 0) {
    const cleanAuthor = input.author?.trim();
    const cleanEmail = input.authorEmail?.trim();
    const fromColon =
      cleanAuthor && cleanAuthor !== "anonymous"
        ? parseIdentityEntry(cleanAuthor, input.actor)
        : undefined;
    if (fromColon) {
      identities.push(fromColon);
    } else if (cleanEmail) {
      identities.push({
        provider: "email",
        id: cleanEmail,
        ...(cleanAuthor && cleanAuthor !== "anonymous" ? { displayName: cleanAuthor } : {}),
        ...(input.actor ? { actor: input.actor } : {}),
      });
    } else if (cleanAuthor && cleanAuthor !== "anonymous") {
      identities.push({
        provider: "github",
        id: cleanAuthor,
        displayName: cleanAuthor,
        ...(input.actor ? { actor: input.actor } : {}),
      });
    }
  }

  const references: KgRef[] = [...(input.references ?? [])];
  if (input.targetLabel && !references.some((r) => r.kind === "block" && r.id === input.targetLabel)) {
    references.push({ kind: "block", id: input.targetLabel });
  }

  return NoteTagsSchema.parse({
    ...EMPTY_NOTE_TAGS,
    roles: [...(input.roles ?? [])],
    processes: [...(input.processes ?? [])],
    tasks: [...(input.tasks ?? [])],
    identities,
    references,
    artefacts: [...(input.artefacts ?? [])],
  });
}

export function handleFeedbackGet(url: URL, feedbackStore: FeedbackStore): Response | null {
  const path = url.pathname;

  if (path === "/api/feedback/all") {
    const status = url.searchParams.get("status") || undefined;
    return Response.json(feedbackStore.listAll(status));
  }

  if (path === "/api/feedback") {
    const itemId = url.searchParams.get("itemId") || url.searchParams.get("paperId");
    const rootName = url.searchParams.get("rootName");
    if (itemId && rootName) {
      return Response.json(feedbackStore.read(itemId, rootName));
    }
    return null; // POST handled separately
  }

  return null;
}

export async function handleFeedbackPost(
  url: URL,
  req: Request,
  feedbackStore: FeedbackStore,
  adapter: ContentAdapter,
): Promise<Response | null> {
  const path = url.pathname;

  // ── Create feedback ──────────────────────────────────────────
  if (path === "/api/feedback" && req.method === "POST") {
    try {
      const body = (await req.json()) as {
        itemId?: string;
        paperId?: string;
        rootName: string;
        summary: string;
        comment: string;
        priority: string;
        assignee: string;
        author?: string;
        authorEmail?: string;
        targetLabel?: string;
        actor?: string;
        identities?: Array<string | ExternalIdentity>;
        roles?: string[];
        processes?: string[];
        tasks?: TaskRef[];
        references?: KgRef[];
        artefacts?: ArtefactRef[];
      };
      const itemId = body.itemId || body.paperId || "";

      const priority = parseTodoPriority(body.priority || undefined);
      if (priority === INVALID_ENUM) {
        return Response.json({
          error: `Invalid priority: must be one of ${TODO_PRIORITIES.join("|")}`,
        }, { status: 400 });
      }

      const reqUser = getUserName(req);
      const author = reqUser && reqUser !== "anonymous" ? reqUser : (body.author || reqUser);
      const authorEmail = getUserEmail(req) || body.authorEmail || "";
      const targetLabel = body.targetLabel || body.rootName;
      const tags = buildSubmissionTags({
        author,
        authorEmail,
        actor: body.actor,
        identities: body.identities,
        roles: body.roles,
        processes: body.processes,
        tasks: body.tasks,
        targetLabel,
        references: body.references,
        artefacts: body.artefacts,
      });

      const todo: TaggedFeedbackItem = {
        id: FeedbackStore.makeId(),
        summary: body.summary,
        comment: body.comment,
        status: "open",
        priority: priority ?? "medium",
        origin: "human",
        targetLabel,
        author,
        authorEmail,
        assignee: body.assignee || "editor-agent",
        createdAt: new Date().toISOString(),
        tags,
      };

      const todos = feedbackStore.read(itemId, body.rootName);
      todos.push(todo);
      feedbackStore.write(itemId, body.rootName, todos);
      log("feedback", `created: ${itemId}/${body.rootName}`, `id=${todo.id}`);

      return Response.json({ ok: true, todo });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }

  // ── Update feedback ──────────────────────────────────────────
  if (path === "/api/feedback/update") {
    try {
      const body = (await req.json()) as {
        itemId?: string;
        paperId?: string;
        rootName: string;
        todoId: string;
        priority?: string;
        status?: string;
      };
      const itemId = body.itemId || body.paperId || "";
      // Both arrive off the wire as bare strings and were written through
      // unchecked; see `parseTodoPriority` on what that cost.
      const priority = parseTodoPriority(body.priority);
      const status = parseTodoStatus(body.status);
      if (priority === INVALID_ENUM || status === INVALID_ENUM) {
        return Response.json({
          error: `Invalid update: priority must be one of ${TODO_PRIORITIES.join("|")}, ` +
            `status one of ${TODO_STATUSES.join("|")}`,
        }, { status: 400 });
      }
      const todos = feedbackStore.read(itemId, body.rootName);
      const idx = todos.findIndex((t) => t.id === body.todoId);
      if (idx < 0) return Response.json({ error: "Todo not found" }, { status: 404 });
      if (priority !== undefined) todos[idx].priority = priority;
      if (status !== undefined) todos[idx].status = status;
      feedbackStore.write(itemId, body.rootName, todos);
      return Response.json({ ok: true, todo: todos[idx] });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }

  // ── Delete feedback (collaborator+) ──────────────────────────
  if (path === "/api/feedback/delete") {
    if (!allows(req, "review-comments")) {
      return forbidden("deleting feedback", "review-comments");
    }
    try {
      const body = (await req.json()) as {
        itemId?: string;
        paperId?: string;
        rootName: string;
        todoId: string;
      };
      const itemId = body.itemId || body.paperId || "";
      const todos = feedbackStore.read(itemId, body.rootName);
      const idx = todos.findIndex((t) => t.id === body.todoId);
      if (idx < 0) return Response.json({ error: "Todo not found" }, { status: 404 });
      todos.splice(idx, 1);
      feedbackStore.write(itemId, body.rootName, todos);
      return Response.json({ ok: true });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }

  // ── AI triage ────────────────────────────────────────────────
  if (path === "/api/feedback/triage") {
    try {
      const body = (await req.json()) as {
        itemId?: string;
        paperId?: string;
        rootName: string;
        todoId: string;
      };
      const itemId = body.itemId || body.paperId || "";
      const todos = feedbackStore.read(itemId, body.rootName);
      const todo = todos.find((t) => t.id === body.todoId);
      if (!todo) return Response.json({ error: "Todo not found" }, { status: 404 });

      const doc = await adapter.getDocument(itemId);
      const blk = doc?.blocksByName?.get(body.rootName);
      const blockContent = blk?.md || "";
      const blockKind = blk?.kind || "";

      const triage = await adapter.triageFeedback(todo, blockContent, blockKind, itemId, body.rootName);
      return Response.json(triage, { headers: CORS });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }

  return null;
}

// ── Mount ────────────────────────────────────────────────────────

/**
 * Mount factory read by the route declaration in `src/server.ts`.
 *
 * **The casts belong here, not in the loader.** This module is in the layer
 * that owns `FeedbackStore` and `ContentAdapter`, so naming them costs
 * nothing; naming them in `src/route-groups.ts` would put the content model
 * back into the harness, which is the import the declaration exists to remove.
 *
 * The declaration lists `feedbackStore` under `needs`, so the loader has
 * already refused to call this with the service absent — which is why the cast
 * is safe rather than hopeful.
 */
export function mountFeedbackRoutes(deps: RouteDeps): MountedRoute {
  const store = deps.services.feedbackStore as FeedbackStore;
  const adapter = deps.adapter as ContentAdapter;
  return {
    get: (url) => handleFeedbackGet(url, store),
    post: (url, req) => handleFeedbackPost(url, req, store, adapter),
  };
}
