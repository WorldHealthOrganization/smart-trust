/**
 * Folio Assistant — Core types and ContentAdapter interface.
 *
 * Content adapters implement this interface to plug any content type
 * (papers, guidelines, documentation, etc.) into the folio platform.
 *
 * @module folio-assistant/types
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// ── Role-based access control ────────────────────────────────────

export type UserRole = "viewer" | "collaborator" | "owner";

export const ROLE_LEVELS: Record<UserRole, number> = {
  viewer: 1,
  collaborator: 2,
  owner: 3,
};

// ── The content model and the content half of an adapter ─────────

// Defined in `./content-types.ts` (bean `w2gr`, step 1) and re-exported so
// every existing importer of this module keeps working unchanged.
import type { ContentSource } from "./content-types.js";
export type { BlockDiff, BranchCharacterization, ChapterDetail, ContentOutline, ContentSource, DocumentDiff, FolioItem, MacroDef, OutlineChapter, OutlineSection, ResolvedBlock, ResolvedChapter, ResolvedDocument, ResolvedSection, SectionStub, TodoRef, TriageResult } from "./content-types.js";

/**
 * ContentAdapter — the interface each content type must implement.
 *
 * The folio server delegates all content-specific operations to adapters.
 * Generic operations (auth, feedback CRUD, git, branch management) are
 * handled by the core server.
 */
export interface ContentAdapter extends ContentSource {
  // ── Chat ─────────────────────────────────────────────────────

  /** Get chat tools for the embedded assistant. */
  getChatTools(): unknown[];

  /** Execute a chat tool call. Returns JSON string result. */
  executeChatTool(name: string, input: Record<string, unknown>, context?: Record<string, unknown>): Promise<string>;

  /** Get the system prompt for the chat assistant. */
  getChatSystemPrompt(mode: string, userRole: UserRole, userName: string, context?: Record<string, unknown>): string;

  // ── Content-specific routes ──────────────────────────────────

  /** Handle content-specific GET requests. Returns Response or null. */
  handleGet(url: URL): Promise<Response | null>;

  /** Handle content-specific POST requests. Returns Response or null. */
  handlePost(url: URL, req: Request): Promise<Response | null>;

  // ── Optional extensions ──────────────────────────────────────

  /** Register content-specific MCP tools on the server. */
  /**
   * Register the adapter's MCP tools.
   *
   * `unknown` until now, so the one implementation took `any` and every
   * `register*Tools(server)` call inside it went unchecked. The only caller
   * (`FolioServer`) has always passed its `McpServer`, and every callee has
   * always required one.
   */
  registerMcpTools?(server: McpServer): void;
}

// ── Server config ────────────────────────────────────────────────

export interface HarnessConfig {
  subscriptions: Array<{
    repo: string;
    type: string;
    branch?: string;
    label?: string;
    visibility?: "private" | "public";
  }>;
  domain?: string;
  auth?: {
    github?: { enabled: boolean };
    google?: { enabled: boolean; viewersWhitelist?: string };
  };
}
