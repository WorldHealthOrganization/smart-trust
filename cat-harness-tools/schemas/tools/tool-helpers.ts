/**
 * Helpers the harness's Tool folders share. Not a Tool, and declares none: a
 * Tool is one folder, `<id>/<id>.json`, loaded through `toolsFromFolders`.
 *
 * @graphNode none — helpers the Tool folders share; no schema
 * @module schemas/tools/tool-helpers
 */
import { existsSync, readFileSync } from "node:fs";
import { harnessRoot } from "../harness-root.js";
import { declarationPathIn } from "../kg/cat-harness.js";
import type { ToolDefinition } from "./tool.js";
import type { TypeIri } from "./tool-folders.js";

// The LAYER root — where `cat-harness.json` lives. Found, not walked to:
// this file is no longer inside the harness (bean `8lcl`).
export function decl(): { canonicalUrl?: string; stub?: string; name?: string } {
  const root = harnessRoot();
  if (!root) return {};
  const p = declarationPathIn(root);
  if (!p || !existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as ReturnType<typeof decl>;
  } catch {
    return {};
  }
}

/** The declared publication base, or a local placeholder when none is set. */
export function base(): string {
  return decl().canonicalUrl ?? "";
}

/**
 * This layer's artefact stub, read from the declaration.
 *
 * NEVER written in. `<stub>.schema.json` is one of the artefacts declared
 * below, and a layer that renames itself — the `folio-assistant` /
 * `cat-harness` question still open at the time of writing — must not have to
 * edit a Tool node for the declaration to stay true.
 */
export function stub(): string {
  const d = decl();
  return d.stub ?? d.name ?? "instance";
}

// ── The served MCP surface ──────────────────────────────────────────────────
//
// What was `tools/mcp.ts`'s header, kept with the two helpers it explains.
/**
 * The Tool nodes for the twenty tools this layer already serves over MCP.
 *
 * ## Why these exist as nodes at all
 *
 * Before this file, the MCP surface was a fact about `src/server.ts` and
 * nothing else: twenty `server.tool(name, description, shape, handler)` calls
 * whose contract lived in TypeScript closures. Nothing could ask which skill a
 * served tool implements, nothing could check that two mechanisms for one skill
 * agree about their inputs, and `mcp-contract`'s equivalence check had only one
 * side of the comparison. A Tool node is the other side.
 *
 * ## How the contracts here were obtained
 *
 * **Read from the registrars, not from the source text.** `bun run cat mcp:capture`
 * mounts each `register*` export against a capture object and reads the real
 * Zod shapes, which is how the required/optional split and every enum's member
 * list below were established. The first attempt regex-scanned the source and
 * produced parameter names lifted out of description prose — `skill_fetch`
 * appeared to take `Examples` and `Local`. A contract that agrees with nothing
 * is worse than no contract, because the next check trusts it.
 *
 * Re-run `bun run cat mcp:capture` after changing a registrar, and bring this file
 * with it. `scripts/check-tools.ts` catches a type reference that does not
 * resolve; it cannot catch a port this file forgot, which is what that command
 * is for.
 *
 * ## Why `inProcess` and not `mcp` alone
 *
 * `ToolDefinitionSchema` refuses a Tool whose only invocation is `invoke.mcp`,
 * because such a Tool is not runnable by the harness that defines it and
 * projecting it would emit a server proxying itself. Every tool here is a
 * function in this repository, so `inProcess` names the module and `mcp` names
 * the served alias beside it — the served name is a fact worth recording, not
 * the only way in.
 *
 * ## Ids are hyphenated; MCP names are not
 *
 * `ToolId` is `^[a-z][a-z0-9-]*$`, and the MCP names use underscores. Rather
 * than widen the id pattern to accommodate one serving convention, the id is
 * the hyphenated form and `invoke.mcp.tool` carries the exact served name. The
 * mapping is therefore written down once per tool instead of being a rule a
 * reader has to know — the owner's standing preference against a consumer
 * having to manipulate a string to follow a link.
 */

/** Every MCP tool here is a TypeScript function in this repository. */
export const inProcess = (module: string, mcpName: string) => ({
  inProcess: { module },
  mcp: { tool: mcpName },
});

/** Nothing to fetch: the code ships with the harness. */
export const bundled = { none: true } as const;

// ── The viewer generators ───────────────────────────────────────────────────
//
// What was `tools/viewers.ts`'s header, kept with the shape every viewer Tool
// shares. Each viewer is its own folder; this is the one place its common
// ports are written.
/**
 * The viewer generators as Tool nodes — each says which graph typologies it renders
 * (#1168 B7a, bean `w91p`).
 *
 * Until then a directory named its viewer page (`coverage.visualiser`): the
 * directory pointing at what depends on it. The owner chose (2026-09-24,
 * *"viz scripts become Tools"*) that the renderer declares what it renders,
 * which is data-modelling step 8 — the dependent holds the pointer.
 *
 * `renders` names KINDS, not pages. Each generator places one page per
 * declared directory of its kind, so which pages exist is a function of the
 * declarations and the Tool; restating it here would be a second list.
 *
 * `scripts/tests/viewer-tools.test.ts` grounds each declaration against the
 * corpus: every directory that declares a viewer today has a Tool rendering
 * one of its kinds, and every rendered kind is declared somewhere.
 *
 * ## `renders` is what a Tool CAN draw; the harness declares what it DOES
 *
 * Since 2026-10-09 (owner: *"Need harness to declare visualizer is
 * renderedBy"*) a visualiser is declared by the harness, in its
 * `<instance>.json` `visualisers`, naming one of these Tools as `renderedBy`.
 * The page's URL comes from that declaration (`<base>/<harness>/<id>/`), and
 * `check:visualiser-routes` checks every kind a visualiser covers is one its
 * Tool lists here — so `renders` stays, as the capability the declaration is
 * checked against rather than as a way to find pages.
 *
 * **`staging-graph-viewer` names nothing unpublished.** Tool nodes are
 * published in the tools graph, and the owner's rule is that no published
 * artefact mentions fsh-guts (`UNPUBLISHED_GRAPH_TYPOLOGIES`, and the export
 * tests that grep for the string). So its id, description and command — the
 * `staging-graph:viz` alias of `fsh-guts:viz` — say only "staging graph", and
 * it declares no `renders`: naming the kind would be the edge. It exists so
 * cat-harness's staging-only `fsh-guts` visualiser has a Tool to be
 * `renderedBy`, which is what the owner asked for by name; the gate does not
 * ask an unpublished kind of a Tool's `renders`.
 *
 * ## `site` — where a writer puts its pages when asked
 *
 * Every viewer here takes a `site` input (`--site <dir>`): a repository's
 * own site build runs the writer of every visualiser its checkout declares
 * into the site it is building, at the same declared route (owner,
 * 2026-10-15: *"a harness should combine its library/ (or whatever) sites of
 * it and all its dependencies and use the url path pattern"*). The input is
 * declared, not assumed: the runner
 * (`cat-harness-tools/scripts/visualiser-writers.ts`) passes a site only to a
 * Tool whose `site` input says how.
 */
export interface Viewer {
  id: string;
  title: string;
  description: string;
  script: string;
  renders?: string[];
}

/** One viewer generator as a Tool node; the folder passes it to `defineTool`. */
export function viewerTool(t: TypeIri, v: Viewer): ToolDefinition {
  return {
    id: v.id,
    title: v.title,
    description: v.description,
    install: { none: true },
    invoke: { shell: `bun run cat ${v.script}` },
    io: {
      inputs: [
        { name: "check", schema: t("Flag"), required: false, arg: { flag: "--check" }, description: "Fail if a page is stale, instead of writing." },
        { name: "site", schema: t("RepoPath"), required: false, arg: { flag: "--site" }, description: "A site being built: write the pages at their declared route under it instead of under the harness's own site directory. A repository's own site build passes it (the tools layer's `visualiser-writers.ts`), since its harness docs are a pinned mount." },
      ],
      outputs: [{ name: "pages", schema: t("RepoPath"), description: "The viewer pages, under the published site directory." }],
    },
    satisfies: ["graph-rendering"],
    ...(v.renders ? { renders: v.renders } : {}),
    requires: { runtime: ["bun"], network: false },
  };
}
