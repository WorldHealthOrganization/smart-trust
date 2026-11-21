/**
 * Folio Assistant — Generic HTTP/MCP server skeleton.
 *
 * Handles all content-agnostic routes (auth, feedback, branches, chat, static files)
 * and delegates content-specific requests to the active ContentAdapter.
 *
 * @module folio-assistant/server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { existsSync, readFileSync } from "fs";
import { join, extname, resolve } from "path";

import type { ContentAdapter } from "./types.js";
import { GitHelper } from "./core/git.js";
import { log, logDebug } from "./core/logging.js";
import { bindHostname, refuseMcp, trustedRequest } from "./core/gateway-trust.js";
import { registerServedToolGroups } from "./tool-groups.js";
import { registerSkillPrompts } from "./tools/skill-prompts.js";
import {
  dispatchGet, dispatchPost, mountDeclaredRoutes,
  type MountedRoute, type RouteDeclaration,
} from "./route-groups.js";

/** Where this server's declared route modules resolve from. */
const PLATFORM_ROOT = resolve(import.meta.dir, "..");

/**
 * The HTTP routes this server serves, IN DISPATCH ORDER.
 *
 * Declared rather than imported, for the reason the tool groups are not imported:
 * three of these five are CORE's — a folio's feedback items, its glossary
 * candidates, its bibliography relevance — and the harness is the base
 * repository, so it may not import them.
 *
 * **Reclassifying them without this table makes the count worse, measured.**
 * `bun run cat check:partition` on `d26a96fd`: the three content routes in the
 * harness give 10 wrong-direction edges; moved to core they give 11, because
 * `src/server.ts`, `src/index.ts` and `src/routes/chat.ts` then cross the line
 * to MOUNT them. They are content handlers mounted by a harness composition
 * root, so whichever side holds them the mounting crosses — unless the root
 * stops naming them, which is what this list does.
 *
 * **Order is behaviour here, unlike the tool groups.** Dispatch is
 * first-match-wins, so this list reproduces the sequence of `if` blocks it
 * replaced exactly: branches, feedback, glossary, relevance, then chat. `chat`
 * is POST-only and therefore simply absent from GET dispatch, which is how the
 * two chains had different lengths before and still do.
 *
 * The adapter's own `handleGet`/`handlePost` still run LAST, after this list.
 * They are not declared here because the adapter is passed in at construction
 * rather than resolved from a path — a different mechanism for a different
 * question ("which content type is this?" rather than "which layer is
 * installed?").
 */
export const SERVER_ROUTES: readonly RouteDeclaration[] = [
  { id: "branches",  module: "src/routes/branches.ts",  mount: "mountBranchRoutes",    layer: "harness", needs: ["gitHelper"] },
  { id: "feedback",  module: "src/routes/feedback.ts",  mount: "mountFeedbackRoutes",  layer: "core",    needs: ["feedbackStore"] },
  { id: "glossary",  module: "src/routes/glossary.ts",  mount: "mountGlossaryRoutes",  layer: "core" },
  { id: "relevance", module: "src/routes/relevance.ts", mount: "mountRelevanceRoutes", layer: "core" },
  { id: "work-plan", module: "src/routes/work-plan.ts", mount: "mountWorkPlanRoutes",  layer: "harness" },
  { id: "chat",      module: "src/routes/chat.ts",      mount: "mountChatRoutes",      layer: "harness" },
];

// ── MIME types for static serving ────────────────────────────────

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

function serveFile(path: string): Response | null {
  if (!existsSync(path)) return null;
  return new Response(readFileSync(path), {
    headers: {
      "Content-Type": MIME[extname(path)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// ── Server configuration ─────────────────────────────────────────

export interface FolioServerConfig {
  /** Root directory of the content repo. */
  repoRoot: string;
  /** Directory for feedback storage (gitignored). */
  feedbackDir: string;
  /** Directory for the assistant UI static files. */
  assistantDir: string;
  /** Content adapter layer. */
  adapter: ContentAdapter;
  /** Server name for MCP protocol. */
  serverName?: string;
  /** Viewer HTTP port (stdio mode). Read from lean-mcp.config.json. */
  viewerPort?: number;
}

// ── Main server class ────────────────────────────────────────────

export class FolioServer {
  private mcpServer: McpServer;
  private gitHelper: GitHelper;
  private adapter: ContentAdapter;
  private config: FolioServerConfig;

  constructor(config: FolioServerConfig) {
    this.config = config;
    this.adapter = config.adapter;
    this.gitHelper = new GitHelper(config.repoRoot);

    this.mcpServer = new McpServer(
      {
        name: config.serverName || "folio-assistant",
        version: "0.1.0",
      },
      { capabilities: { tools: {} } },
    );

    // Wrap server.tool with logging
    const origTool = this.mcpServer.tool.bind(this.mcpServer);
    this.mcpServer.tool = function (...args: Parameters<typeof origTool>) {
      const toolName = args[0] as string;
      // Typed as the SDK's own callback slot rather than widened to
      // `Function`: the cast belongs on the ASSIGNMENT below (the slot is a
      // union of overload shapes), not on the CALL, where throwing the
      // signature away also threw away the return type.
      type ToolSlot = (typeof args)[number];
      const handler = args[args.length - 1] as (...a: unknown[]) => Promise<unknown>;
      args[args.length - 1] = (async (...handlerArgs: unknown[]) => {
        const start = Date.now();
        log("mcp", `→ ${toolName}`, JSON.stringify(handlerArgs[0] || {}).slice(0, 120));
        try {
          const result = await handler(...handlerArgs);
          log("mcp", `← ${toolName}`, `ok (${Date.now() - start}ms)`);
          return result;
        } catch (e) {
          log("mcp", `✗ ${toolName}`, `error: ${e instanceof Error ? e.message : String(e)} (${Date.now() - start}ms)`);
          throw e;
        }
      }) as ToolSlot;
      return origTool(...args);
    } as typeof origTool;

    // Declared rather than imported, for the same reason the MCP server's are:
    // `translation` is CORE's, and the harness is the base repository — it may
    // not import core.
    //
    // Started here and awaited by `startStdio`/`startHttp` rather than run in
    // the constructor, because resolving a declared module is asynchronous and
    // a constructor is not. Kicking it off here keeps it overlapping with the
    // rest of construction; awaiting it before serving is what guarantees no
    // request arrives before the tools are registered.
    // Tool groups and routes resolve in parallel: neither reads the other's
    // result, and both must be done before a request is served.
    this.ready = Promise.all([
      this.registerToolGroups(config.repoRoot),
      this.mountRoutes(config.repoRoot),
    ]).then(() => undefined);

    // The person-facing half of the skills: each `user_invocable` one as an
    // MCP PROMPT. Not a Tool node — bean `j6t3`, the owner's "keep tools and
    // skills separate!" — so it is registered here rather than read from the
    // tools graph, and for every layer, content or none.
    registerSkillPrompts(this.mcpServer);

    // Register adapter-specific MCP tools
    if (this.adapter.registerMcpTools) {
      this.adapter.registerMcpTools(this.mcpServer);
    }
  }

  /** Expose internals for the adapter. */
  getGitHelper(): GitHelper {
    return this.gitHelper;
  }

  // ── GET request handler ──────────────────────────────────────

  private async handleGet(url: URL, req?: Request): Promise<Response | null> {
    const path = url.pathname;

    // Folio SPA
    if (path === "/folio" || path === "/folio/" || path === "/folio/index.html") {
      return serveFile(join(this.config.assistantDir, "index.html"));
    }
    if (path.startsWith("/folio/")) {
      return serveFile(join(this.config.assistantDir, path.slice("/folio/".length)));
    }

    // Declared routes, in declaration order (see SERVER_ROUTES).
    const routed = await dispatchGet(this.routes, url, req);
    if (routed) return routed;

    // Content adapter routes
    const adapterRes = await this.adapter.handleGet(url);
    if (adapterRes) return adapterRes;

    return null;
  }

  // ── POST request handler ─────────────────────────────────────

  private async handlePost(url: URL, req: Request): Promise<Response | null> {
    // Declared routes, in declaration order (see SERVER_ROUTES).
    const routed = await dispatchPost(this.routes, url, req);
    if (routed) return routed;

    // Content adapter routes
    const adapterRes = await this.adapter.handlePost(url, req);
    if (adapterRes) return adapterRes;

    return null;
  }

  // ── HTTP request dispatcher ──────────────────────────────────

  async handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const start = Date.now();
    logDebug("http", `${req.method} ${url.pathname}`);

    // Health check
    if (url.pathname === "/health") {
      return Response.json({ status: "ok", version: "0.1.0", adapter: this.adapter.type });
    }

    // Root → redirect to folio
    if (url.pathname === "/" || url.pathname === "") {
      const port = url.port ? `:${url.port}` : "";
      return Response.redirect(`${url.protocol}//${url.hostname}${port}/folio/`, 302);
    }

    // POST/DELETE
    if (req.method === "POST" || req.method === "DELETE") {
      const postRes = await this.handlePost(url, req);
      if (postRes) {
        logDebug("http", `${req.method} ${url.pathname}`, `→ ${postRes.status} (${Date.now() - start}ms)`);
        return postRes;
      }
    }

    // GET
    const getRes = await this.handleGet(url, req);
    if (getRes) {
      logDebug("http", `${req.method} ${url.pathname}`, `→ ${getRes.status} (${Date.now() - start}ms)`);
      return getRes;
    }

    logDebug("http", `${req.method} ${url.pathname}`, `→ 404 (${Date.now() - start}ms)`);
    return new Response("Not found", { status: 404 });
  }

  // ── Start methods ────────────────────────────────────────────

  /**
   * Resolves once every declared tool group and route has been mounted or
   * reported. Awaited by `startStdio`/`startHttp` BEFORE `Bun.serve`, which is
   * what guarantees no request reaches an unmounted route.
   */
  private readonly ready: Promise<void>;

  /** Mounted routes, in declaration order. Empty until {@link ready}. */
  private routes: MountedRoute[] = [];

  private async mountRoutes(repoRoot: string): Promise<void> {
    const { routes, outcomes } = await mountDeclaredRoutes(SERVER_ROUTES, PLATFORM_ROOT, {
      repoRoot,
      adapter: this.adapter,
      // The feedback store comes FROM the adapter, which owns it: it is
      // per-folio content state, and a harness server constructing one was
      // the wrong-direction dependency this change removes. An adapter
      // without a feedback surface returns `undefined`, and the `needs` on
      // the declaration turns that into a named skip at boot.
      services: { gitHelper: this.gitHelper, feedbackStore: this.adapter.getFeedbackStore?.() },
    });
    this.routes = routes;
    for (const o of outcomes) {
      // Same three-state reporting as the tool groups, and for the same
      // reason: a server quietly starting without its feedback routes looks
      // identical to one where they are broken, and the operator finds out
      // from a 404 instead of from the boot log.
      if (o.state === "absent") log("init", `\u2212 route ${o.id}`, `${o.layer} layer: ${o.detail}`);
      else if (o.state === "failed") log("init", `\u2717 route ${o.id}`, o.detail);
    }
  }

  private async registerToolGroups(repoRoot: string): Promise<void> {
    // Every Tool node in the folio's dependency tree, the harness's always —
    // read from the declared `tools` graphs, not listed here (bean `zmdo`;
    // owner 2026-10-05, bean riit 3c: the viewer server uses the same rule).
    // Each group resolves from the layer that declares it.
    const { outcomes, failures } = await registerServedToolGroups(this.mcpServer, repoRoot, [repoRoot]);
    for (const f of failures) log("init", "\u2717 tools graph", f);
    for (const o of outcomes) {
      // An absent group is skipped and REPORTED: a server quietly starting
      // without its translation tools looks identical to one where they are
      // broken. A present-but-broken one is a different state again, because
      // the remedy is opposite — fix the module, not install the layer.
      if (o.state === "absent") log("init", `\u2212 ${o.id}`, `${o.layer} layer: ${o.detail}`);
      else if (o.state === "failed") log("init", `\u2717 ${o.id}`, o.detail);
    }
  }

  async startStdio(): Promise<void> {
    await this.ready;
    const transport = new StdioServerTransport();
    await this.mcpServer.connect(transport);

    const viewerPort = parseInt(process.env.VIEWER_PORT || String(this.config.viewerPort ?? 3200), 10);
    const hostname = bindHostname();
    Bun.serve({
      port: viewerPort,
      hostname,
      fetch: async (req) => this.handleRequest(trustedRequest(req, hostname)),
    });

    log("init", `MCP server started (stdio, repo: ${this.config.repoRoot})`);
    log("init", `Folio: http://localhost:${viewerPort}/folio/`);
  }

  async startHttp(): Promise<void> {
    await this.ready;
    const port = parseInt(process.env.MCP_PORT || "8080", 10);
    // Use the Web-Standard transport (Request/Response), not the Node
    // Express/http one: Bun.serve's `fetch` speaks the fetch API, and this
    // transport's `handleRequest(req: Request): Promise<Response>` matches it
    // directly. The Node `StreamableHTTPServerTransport` expects
    // `(IncomingMessage, ServerResponse)` and returns `void`, which is
    // incompatible with Bun.serve.
    const { WebStandardStreamableHTTPServerTransport } = await import(
      "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
    );

    // Stateful mode (one transport, reused across requests, session-routed via
    // the Mcp-Session-Id header) — matches the SDK's canonical single-transport
    // usage. A *stateless* transport (sessionIdGenerator: undefined) MAY NOT be
    // reused: since SDK 1.26 it throws "Stateless transport cannot be reused
    // across requests" on the 2nd call (guards against JSON-RPC id collisions /
    // response misrouting), which would break every request after the first
    // because this transport is connected once at startup and shared by Bun.serve.
    const httpTransport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });
    await this.mcpServer.connect(httpTransport);

    const hostname = bindHostname();
    Bun.serve({
      port,
      hostname,
      fetch: async (req) => {
        const url = new URL(req.url);
        if (url.pathname === "/mcp") {
          // Only the auth-gateway's requests reach the tools (see core/gateway-trust.ts).
          return refuseMcp(req, hostname) ?? httpTransport.handleRequest(req);
        }
        return this.handleRequest(trustedRequest(req, hostname));
      },
    });

    log("init", `Folio assistant started (HTTP :${port}, repo: ${this.config.repoRoot})`);
    log("init", `MCP: http://localhost:${port}/mcp`);
    log("init", `Folio: http://localhost:${port}/folio/`);
  }
}
