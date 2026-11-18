/**
 * The Tools as an API: an OpenAPI 3.1 document and an MCP tool list per layer,
 * and the reference page that reads them.
 *
 * @module cat-harness-tools/scripts/tool-api
 * @graphNode none — projections of the `tools` graph; the Tool node's schema is `schemas/tools/tool.ts`
 *
 * ## Why
 *
 * Owner, 2026-11-12: *"what can we add to help make the skills more accessible
 * to both agents and humans used to reading more traditional API
 * documentation"*, and then *"go ahead with the OpenAPI generation and MCP tool
 * list"*. A Tool node already carries a typed contract — inputs and outputs
 * naming shared types by IRI — but only this harness's own readers could read
 * it. These are the same contracts in the two forms other tools read:
 *
 * - **`openapi.json`** — OpenAPI 3.1, one operation per Tool. Swagger UI,
 *   Redoc, client generators and API catalogues read it as they read any API.
 * - **`mcp-tools.json`** — the shape an MCP server's `tools/list` answers with,
 *   so an agent can see what a server offers, and each tool's input schema,
 *   without starting it.
 *
 * ## The OpenAPI paths are contracts, not endpoints
 *
 * No HTTP server serves `POST /tools/{id}`: a Tool is reached as its `invoke`
 * says — a command, an MCP tool, an in-process call. The document says so in
 * `info.description` and declares no `servers`, and each operation carries
 * `x-invoke` with the real way in. One operation per Tool, rather than one per
 * MCP call through `/mcp`, because OpenAPI keys an operation by path and
 * method, and every MCP call is the same `POST /mcp`.
 *
 * ## The MCP list is what the registrars register
 *
 * A Tool node names its MCP tool, sometimes as a pattern (`workflow_*`). The
 * served names and their real input schemas are read by calling the Tool's
 * registrar against a recording stub — what `capture-mcp-tools.ts` does for
 * the `mcp-contract` comparison — and the Zod shape each one registers is
 * rendered to JSON Schema. Where the registrar cannot be read, the entry is
 * built from the Tool's declared inputs, and says so (`_meta.source`).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

import { TOOL_TYPES, toolTypeNameOf, type ToolTypeName } from "../schemas/tools/tool-types.js";
import type { ToolDefinition } from "../schemas/tools/tool.js";

/** One MCP tool as `tools/list` answers with it, plus where it came from. */
export interface McpToolEntry {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  _meta: {
    /** The Tool node it belongs to. */
    tool: string;
    toolIri?: string;
    /** `registrar` when read from the registered Zod shape; `declared` when built from the Tool's inputs. */
    source: "registrar" | "declared";
  };
}

/** The module an `inProcess` arm names, found in the declaring layer or, failing that, any layer of the checkout. */
export function resolveModule(module: string, declaringRoot: string, roots: readonly string[]): string | undefined {
  for (const r of [declaringRoot, ...roots]) {
    const p = join(r, module);
    if (existsSync(p)) return p;
  }
  return undefined;
}

/** What a registrar registers: each `server.tool(…)` or `server.registerTool(…)` call, recorded. */
export async function captureRegistrar(moduleAbs: string, register?: string): Promise<{ name: string; description: string; inputSchema: Record<string, unknown> }[]> {
  // input-site: declared tool-registrars #029f9904 — the registrar module a Tool's inProcess arm names, resolved as resolveModule does
  const mod = (await import(moduleAbs)) as Record<string, unknown>;
  const fns = Object.entries(mod).filter(([k, v]) => typeof v === "function" && k.startsWith("register") && (register === undefined || k === register));
  const out: { name: string; description: string; inputSchema: Record<string, unknown> }[] = [];
  const schemaOf = (shape: unknown): Record<string, unknown> => {
    if (!shape || typeof shape !== "object") return { type: "object", properties: {} };
    try {
      const obj = shape instanceof z.ZodType ? shape : z.object(shape as z.ZodRawShape);
      const js = z.toJSONSchema(obj, { unrepresentable: "any", io: "input" }) as Record<string, unknown>;
      delete js.$schema;
      return js;
    } catch {
      return { type: "object", properties: Object.fromEntries(Object.keys(shape).map((k) => [k, {}])) };
    }
  };
  const stub = {
    tool(name: string, ...rest: unknown[]) {
      const description = typeof rest[0] === "string" ? rest[0] : "";
      const shape = typeof rest[0] === "string" ? rest[1] : rest[0];
      out.push({ name, description, inputSchema: schemaOf(typeof shape === "function" ? undefined : shape) });
    },
    registerTool(name: string, cfg: { description?: string; inputSchema?: unknown }) {
      out.push({ name, description: cfg?.description ?? "", inputSchema: schemaOf(cfg?.inputSchema) });
    },
    // A registrar may also register prompts or resources; they are not tools.
    prompt() {},
    resource() {},
    registerPrompt() {},
    registerResource() {},
  };
  for (const [, fn] of fns) (fn as (s: unknown, root?: string) => void)(stub, process.cwd());
  return out;
}

/** `workflow_*` as a test. */
const globTest = (pattern: string) => {
  const re = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
  return (s: string) => re.test(s);
};

/** A JSON Schema object for a Tool's declared inputs, with each port's type by `$ref` through `ref`. */
export function inputsSchema(t: ToolDefinition, ref: (iri: string) => Record<string, unknown>): Record<string, unknown> {
  const required = t.io.inputs.filter((p) => (p as { required?: boolean }).required !== false).map((p) => p.name);
  return {
    type: "object",
    properties: Object.fromEntries(t.io.inputs.map((p) => [p.name, { ...ref(p.schema), ...(p.description ? { description: p.description } : {}) }])),
    ...(required.length ? { required } : {}),
    additionalProperties: false,
  };
}

/** The same for its outputs; every declared output is present. */
export function outputsSchema(t: ToolDefinition, ref: (iri: string) => Record<string, unknown>): Record<string, unknown> {
  return {
    type: "object",
    properties: Object.fromEntries(t.io.outputs.map((p) => [p.name, { ...ref(p.schema), ...(p.description ? { description: p.description } : {}) }])),
  };
}

/** A port type's JSON Schema, from the Zod. */
export function toolTypeJsonSchema(name: ToolTypeName): Record<string, unknown> {
  try {
    const js = z.toJSONSchema(TOOL_TYPES[name] as z.ZodType, { unrepresentable: "any" }) as Record<string, unknown>;
    delete js.$schema;
    return js;
  } catch {
    return {};
  }
}

/** The MCP tool list for a set of Tools: every MCP arm, its served names read from the registrar where it can be. */
export async function mcpToolList(
  tools: readonly { def: ToolDefinition; root: string; iri?: string }[],
  roots: readonly string[],
): Promise<{ tools: McpToolEntry[]; problems: string[] }> {
  const out: McpToolEntry[] = [];
  const problems: string[] = [];
  const cache = new Map<string, Promise<Awaited<ReturnType<typeof captureRegistrar>>>>();
  const declaredRef = (iri: string) => {
    const n = toolTypeNameOf(iri);
    return n ? toolTypeJsonSchema(n) : {};
  };
  for (const { def, root, iri } of tools) {
    const mcp = def.invoke.mcp;
    if (!mcp) continue;
    const meta = (source: McpToolEntry["_meta"]["source"]) => ({ tool: def.id, ...(iri ? { toolIri: iri } : {}), source });
    let captured: Awaited<ReturnType<typeof captureRegistrar>> = [];
    const ip = def.invoke.inProcess;
    const abs = ip ? resolveModule(ip.module, root, roots) : undefined;
    if (ip && abs) {
      const key = `${abs}#${ip.register ?? ""}`;
      if (!cache.has(key)) cache.set(key, captureRegistrar(abs, ip.register));
      try {
        captured = (await cache.get(key)!).filter((c) => globTest(mcp.tool)(c.name));
      } catch (e) {
        problems.push(`${def.id}: ${ip.module} could not be read — ${(e as Error).message}`);
      }
    }
    if (captured.length) {
      for (const c of captured) out.push({ name: c.name, description: c.description || def.description, inputSchema: c.inputSchema, _meta: meta("registrar") });
    } else if (!mcp.tool.includes("*")) {
      out.push({ name: mcp.tool, description: def.description, inputSchema: inputsSchema(def, declaredRef), _meta: meta("declared") });
    } else {
      problems.push(`${def.id}: ${mcp.tool} names a pattern and no registrar was read, so its tools cannot be listed`);
    }
  }
  return { tools: out.sort((a, b) => a.name.localeCompare(b.name, "en")), problems };
}

/** What the OpenAPI document needs to know beyond the Tools themselves. */
export interface OpenApiContext {
  title: string;
  /** The harness/layer version, as declared. */
  version: string;
  description?: string;
  /** Each Tool's IRI and page URL (relative to the document), when known. */
  toolIri?: (id: string) => string | undefined;
  toolPage?: (id: string) => string | undefined;
  /** Each skill's declared I/O contracts. */
  skillContracts?: (skill: string) => { io: string; schema: Record<string, unknown> }[];
  /** The MCP tools each Tool serves, by Tool id. */
  mcpNames?: (id: string) => string[];
}

const componentName = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, "_");

/**
 * Move a JSON Schema into `components.schemas` under `name`, its own
 * `definitions` / `$defs` beside it as `<name>.<def>`, with every internal
 * `$ref` (`#`, `#/definitions/X`, `#/$defs/X`) rewritten to match. Embedded
 * as-is, a skill contract's `#/definitions/…` would resolve against the
 * OpenAPI document, where nothing is.
 */
export function hoistSchema(schema: Record<string, unknown>, name: string, into: Record<string, unknown>): void {
  const defs = { ...((schema.definitions ?? {}) as Record<string, unknown>), ...((schema.$defs ?? {}) as Record<string, unknown>) };
  const target = (ref: string): string | undefined => {
    if (ref === "#") return `#/components/schemas/${name}`;
    const m = /^#\/(?:definitions|\$defs)\/([^/]+)(\/.*)?$/.exec(ref);
    return m ? `#/components/schemas/${componentName(`${name}.${m[1]}`)}${m[2] ?? ""}` : undefined;
  };
  const rewrite = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(rewrite);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, k === "$ref" && typeof x === "string" ? (target(x) ?? x) : rewrite(x)]),
      );
    }
    return v;
  };
  const root = { ...schema };
  delete root.$schema;
  delete root.$id;
  delete root.definitions;
  delete root.$defs;
  into[name] ??= rewrite(root);
  for (const [k, d] of Object.entries(defs)) into[componentName(`${name}.${k}`)] ??= rewrite(d);
}

/** One OpenAPI 3.1 document for a set of Tools. */
export function openApiFor(tools: readonly ToolDefinition[], ctx: OpenApiContext): Record<string, unknown> {
  const schemas: Record<string, unknown> = {};
  const ref = (iri: string): Record<string, unknown> => {
    const n = toolTypeNameOf(iri);
    if (!n) return { description: `Typed by ${iri}` };
    if (!(n in schemas)) hoistSchema({ ...toolTypeJsonSchema(n), "x-iri": iri }, n, schemas);
    return { $ref: `#/components/schemas/${n}` };
  };
  const tags = new Map<string, string | undefined>();
  const paths: Record<string, unknown> = {};
  for (const t of [...tools].sort((a, b) => a.id.localeCompare(b.id, "en"))) {
    for (const s of t.satisfies) tags.set(String(s), undefined);
    // A skill's own contract, when it declares one, beside the Tool's.
    const skillRefs: Record<string, unknown> = {};
    for (const s of t.satisfies.map(String)) {
      for (const c of ctx.skillContracts?.(s) ?? []) {
        const name = componentName(`skill.${s}.${c.io}`);
        hoistSchema(c.schema, name, schemas);
        skillRefs[`${s}.${c.io}`] = { $ref: `#/components/schemas/${name}` };
      }
    }
    const page = ctx.toolPage?.(t.id);
    const iri = ctx.toolIri?.(t.id);
    const mcpNames = ctx.mcpNames?.(t.id) ?? [];
    paths[`/tools/${t.id}`] = {
      post: {
        operationId: t.id,
        summary: t.title,
        description: t.description,
        tags: t.satisfies.map(String),
        ...(page ? { externalDocs: { description: "The Tool's page", url: page } } : {}),
        ...(t.io.inputs.length
          ? {
              requestBody: {
                required: t.io.inputs.some((p) => (p as { required?: boolean }).required !== false),
                content: { "application/json": { schema: inputsSchema(t, ref) } },
              },
            }
          : {}),
        responses: {
          "200": {
            description: t.io.outputs.length ? "The Tool's declared outputs." : "The Tool declares no typed output.",
            ...(t.io.outputs.length ? { content: { "application/json": { schema: outputsSchema(t, ref) } } } : {}),
          },
        },
        "x-tool-iri": iri,
        "x-invoke": t.invoke,
        ...(mcpNames.length ? { "x-mcp-tools": mcpNames } : {}),
        "x-install": t.install,
        ...(t.requires ? { "x-requires": t.requires } : {}),
        "x-satisfies": t.satisfies,
        ...(Object.keys(skillRefs).length ? { "x-skill-contracts": skillRefs } : {}),
        ...(t.selection ? { "x-selection": t.selection } : {}),
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: ctx.title,
      version: ctx.version,
      description:
        (ctx.description ? `${ctx.description}\n\n` : "") +
        "The call contracts of the harness's Tools, one operation per Tool, generated from the Tool nodes " +
        "(`schemas/tools/tool.ts`) so standard API tooling can read them. **No HTTP server serves these " +
        "paths**: each Tool is reached as its `x-invoke` says — a command line, an MCP tool, or an in-process call. " +
        "Tags are the skills each Tool satisfies.",
    },
    servers: [],
    tags: [...tags.keys()].sort().map((name) => ({ name })),
    paths,
    components: { schemas: Object.fromEntries(Object.entries(schemas).sort(([a], [b]) => a.localeCompare(b, "en"))) },
  };
}

/** The API reference page for a layer: what the two documents are, and every operation and MCP tool, linked. */
export function apiReferencePage(o: {
  title: string;
  generatedFm: string;
  openapi: Record<string, unknown>;
  mcp: readonly McpToolEntry[];
  /** Relative hrefs from the page. */
  openapiHref: string;
  mcpHref: string;
  toolHref: (id: string) => string | undefined;
  upHref: string;
}): string {
  const cell = (v: string) => v.replace(/[\\|]/g, "\\$&").replace(/\r?\n/g, " ");
  const code = (s: string) => "`" + s.replace(/`/g, "ˋ") + "`";
  const link = (t: string, h?: string) => (h ? `[${t}](${h})` : t);
  const paths = (o.openapi.paths ?? {}) as Record<string, { post: Record<string, unknown> }>;
  const ops = Object.entries(paths).map(([p, v]) => ({ path: p, ...v.post }) as Record<string, unknown> & { path: string });
  const fields = (schema: unknown): string => {
    const s = (schema ?? {}) as { properties?: Record<string, { $ref?: string; type?: unknown }>; required?: string[] };
    const req = new Set(s.required ?? []);
    return (
      Object.entries(s.properties ?? {})
        .map(([k, v]) => `${code(k)}${req.has(k) ? "" : "?"}: ${v.$ref ? v.$ref.split("/").pop() : Array.isArray(v.type) ? v.type.join("|") : String(v.type ?? "any")}`)
        .join(", ") || "—"
    );
  };
  const b = [
    "---",
    `title: ${JSON.stringify(`API — ${o.title}`)}`,
    `description: ${JSON.stringify(`The Tools of ${o.title} as an OpenAPI document and an MCP tool list.`)}`,
    o.generatedFm,
    "render_with_liquid: false",
    "---",
    "",
    `The [Tools](${o.upHref}) of **${o.title}**, in the two forms other tools read:`,
    "",
    `- [${code("openapi.json")}](${o.openapiHref}) — OpenAPI ${String(o.openapi.openapi)}, one operation per Tool. Open it in Swagger UI or Redoc, or generate a client from it. The paths are the Tools' call contracts, not HTTP endpoints: each operation's \`x-invoke\` says how the Tool is really reached.`,
    `- [${code("mcp-tools.json")}](${o.mcpHref}) — the answer an MCP server gives to \`tools/list\`: each tool's name, description and input schema, read from the registrar that serves it.`,
    "",
    `## Operations (${ops.length})`,
    "",
    "| operation | summary | request | response | reached as |",
    "|---|---|---|---|---|",
    ...ops.map((op) => {
      const id = String(op.operationId);
      const rb = (op.requestBody as { content?: Record<string, { schema?: unknown }> } | undefined)?.content?.["application/json"]?.schema;
      const rs = ((op.responses as Record<string, { content?: Record<string, { schema?: unknown }> }>)["200"]?.content ?? {})["application/json"]?.schema;
      const inv = Object.keys((op["x-invoke"] ?? {}) as object).sort().join(", ");
      return `| <a id="${id}"></a>${link(`${code("POST")} ${code(op.path)}`, o.toolHref(id))} | ${cell(String(op.summary ?? ""))} | ${cell(fields(rb))} | ${cell(fields(rs))} | ${cell(inv)} |`;
    }),
    "",
    `## MCP tools (${o.mcp.length})`,
    "",
  ];
  if (o.mcp.length === 0) b.push("None of these Tools is reached over MCP.", "");
  else
    b.push(
      "| MCP tool | description | parameters | Tool | read from |",
      "|---|---|---|---|---|",
      ...o.mcp.map(
        (m) =>
          `| ${code(m.name)} | ${cell(m.description.length > 200 ? `${m.description.slice(0, 199)}…` : m.description)} | ${cell(fields(m.inputSchema))} | ${link(code(m._meta.tool), o.toolHref(m._meta.tool))} | ${m._meta.source} |`,
      ),
      "",
    );
  return b.join("\n").trimEnd() + "\n";
}
