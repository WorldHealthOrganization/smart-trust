/**
 * Choose and construct a folio's content adapter, from its own config.
 *
 * @module src/content-adapter
 *
 * ## Why this is a function and not the top of `index.ts`
 *
 * Two MCP servers serve a folio: this layer's (`src/index.ts`) and the
 * viewer server in `adapters/mcp-server/`. Both must serve the same tools
 * (owner, 2026-10-05, bean riit 3c), and a content adapter's
 * `registerMcpTools` is half of that set. The selection lived inline in
 * `index.ts`, so the viewer server could not ask for it and served a forked
 * copy of six tool modules instead. One function, two callers.
 *
 * The behaviour is unchanged from the inline version: a declared
 * `adapterModule` first, then the built-in adapter for the declared content
 * type, then — with nothing installed above the harness — the generic tools
 * only, said out loud (bean `zmdo`).
 */
import { resolve } from "path";
import { existsSync, readFileSync } from "fs";

import { resolveBuiltinAdapter } from "./builtin-adapters.js";
import { LEGACY_FEEDBACK_DIRNAME, resolveDeclaredFeedbackDir } from "./core/feedback.js";
import type { GitHelper } from "./core/git.js";
import { log } from "./core/logging.js";
import { readEffectiveConfig } from "../schemas/kg/harness-config.ts";
import { NoContentAdapter } from "./no-content-adapter.js";
import type { ContentAdapter } from "./types.js";

export interface FolioContentConfig {
  adapterType: string;
  adapterModule?: string;
  /** Whether the config NAMED a content type, rather than `adapterType` defaulting. */
  contentDeclared: boolean;
  feedbackDir: string;
  viewerPort?: number;
}

/** Read the layer's own `<name>.config.json`, with the defaults that stand when there is none. */
export function readFolioContentConfig(repoRoot: string): FolioContentConfig {
  const declaredFeedback = resolveDeclaredFeedbackDir(repoRoot);
  const out: FolioContentConfig = {
    adapterType: "paper",
    contentDeclared: false,
    feedbackDir: declaredFeedback ?? resolve(repoRoot, LEGACY_FEEDBACK_DIRNAME),
  };

  // The layer's own config, INDEX FIRST (bean `ymvt`): its
  // `index.config.json` entry, else `<name>.config.json` as a legacy fallback
  // (reported). `absent` with no `from` = nothing declares a layer here,
  // so there is no config to prefer and the defaults above stand.
  const eff = readEffectiveConfig(repoRoot);
  if (eff.state === "ok") {
    const config = eff.config as {
      contentType?: string;
      adapter?: string;
      adapterModule?: string;
      feedbackDir?: string;
      viewer?: { port?: number };
    };
    out.adapterType = config.contentType || config.adapter || "paper";
    out.contentDeclared = Boolean(config.contentType || config.adapter);
    out.adapterModule = config.adapterModule;
    if (config.feedbackDir) {
      out.feedbackDir =
        config.feedbackDir === LEGACY_FEEDBACK_DIRNAME && declaredFeedback
          ? declaredFeedback
          : resolve(repoRoot, config.feedbackDir);
    }
    if (config.viewer?.port) out.viewerPort = config.viewer.port;
    // NAME THE SOURCE ACTUALLY READ. A hardcoded `harness.config.json` here
    // once told an operator to look at a file that does not exist.
    log("init", `Loaded ${eff.from}${eff.via === "file" ? " (legacy: move it inline into index.config.json)" : ""}: adapter=${out.adapterType}`);
  } else if (eff.state === "unreadable") {
    log("init", `Failed to read ${eff.from}: ${eff.why}`);
  }

  // Fallback: lean-mcp.config.json for viewer_port
  if (!out.viewerPort) {
    const mcpConfigPath = resolve(repoRoot, "lean-mcp.config.json");
    if (existsSync(mcpConfigPath)) {
      try {
        const mcpConfig = JSON.parse(readFileSync(mcpConfigPath, "utf-8"));
        if (mcpConfig.viewer_port) out.viewerPort = mcpConfig.viewer_port;
      } catch { /* ignore */ }
    }
  }
  return out;
}

/**
 * Construct the content adapter `config` names.
 *
 * `document` is the base content type and `paper` the specialization that adds
 * Lean and TeX. `paper` remains the fallback because every folio predating the
 * document type declares `contentType: "paper"` or nothing at all, and the
 * paper adapter is a superset: falling back the other way would silently drop
 * `lean_build` from a folio whose config omits `contentType` — which is why a
 * fallback that DOES go that way (the science layer is not installed) says so.
 */
export async function createContentAdapter(
  repoRoot: string,
  gitHelper: GitHelper,
  config: FolioContentConfig = readFolioContentConfig(repoRoot),
): Promise<ContentAdapter> {
  const builtin = async (): Promise<ContentAdapter> => {
    const r = await resolveBuiltinAdapter(config.adapterType);
    if (r.fallbackReason) log("init", r.fallbackReason);
    const adapter = new (r.ctor as new (...a: never[]) => ContentAdapter)(
      repoRoot as never, gitHelper as never, config.feedbackDir as never,
    );
    log("init", `Using ${r.used.contentType} adapter (repo: ${repoRoot})`);
    return adapter;
  };

  if (config.adapterModule) {
    // Dynamic adapter loading — content repo provides its own adapter
    try {
      const modulePath = resolve(repoRoot, config.adapterModule);
      const mod = await import(modulePath);
      const AdapterClass = mod.default || mod[Object.keys(mod).find((k) => k.includes("Adapter")) || ""];
      const adapter = new AdapterClass(repoRoot, gitHelper, config.feedbackDir) as ContentAdapter;
      log("init", `Using custom adapter from ${config.adapterModule} (repo: ${repoRoot})`);
      return adapter;
    } catch (e) {
      log("init", `Failed to load adapter from ${config.adapterModule}: ${e}`);
      log("init", `Falling back to a built-in adapter`);
      return builtin();
    }
  }

  try {
    return await builtin();
  } catch (e) {
    // No adapter installed at all — `cat-harness` with nothing above it. The
    // server starts with the generic tools only, and says so (owner,
    // 2026-10-04, bean `zmdo`).
    const asked = config.contentDeclared
      ? `contentType "${config.adapterType}" was asked for and`
      : "this instance declares no content type, and";
    log("init", `NO CONTENT ADAPTER — serving the generic tools only: ${asked} ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
    return new NoContentAdapter(repoRoot);
  }
}
