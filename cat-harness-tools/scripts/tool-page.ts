/**
 * One page per Tool node — its IRI, its linked data, and everything the graph
 * knows about it, joined.
 *
 * @module cat-harness-tools/scripts/tool-page
 * @graphNode none — a renderer and the joins it needs; the Tool node's schema is `schemas/tools/tool.ts`
 *
 * ## Why a page per Tool
 *
 * Owner, 2026-11-12: *"each tool in a harness should have its own page … with
 * IRI and viewer"*, the row on the tools table linking to it, and the page
 * showing *"the associated skills and input and output schemas for those
 * skills … where it is linked to tasks and processes, and specific details of
 * how the tools are deployed, what comprises the tools"* — and whether it is
 * reached *"as an MCP service or callable from the CLI or a GitHub action"*.
 *
 * Until then a Tool was one row of a table, and its provenance was listed at
 * the bottom of that table because "a Tool has no page of its own". The Tool
 * already HAD an IRI (`toolIri`, bean `tdir`): `<dir of its layer's
 * document>/tools/<id>.jsonld`. The page names it, and is the human view of
 * that node.
 *
 * ## Every join is read, never restated
 *
 * - the IRI: `publishedIdentity` + `toolIri`, the same two calls `kg-export`
 *   makes, so the page and the published document cannot name two addresses;
 * - the skills: the skill documents the checkout holds, and each skill's
 *   declared I/O contract (`schemas/skills/<skill>/<io>.schema.json`);
 * - the port types: `TOOL_TYPES`, rendered to JSON Schema from the Zod;
 * - the processes: `processRows` (the processes viewer's own reader), joined on
 *   the skills each step names and on the Tool's `subprocesses`;
 * - the deployment: the Tool's `install` / `invoke` / `requires` / `remedies`,
 *   the script key its shell command names resolved against the layers'
 *   `package.json`, the MCP servers `.mcp.json` declares, and the GitHub
 *   workflows that run its command.
 *
 * A join that finds nothing says so, rather than dropping its section: "no
 * process names this skill" and "this page did not look" are different facts.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, posix, relative, resolve, sep } from "node:path";
import { instanceDirectoriesForGraph } from "../schemas/kg/cat-harness.ts";
import { z } from "zod";
import { parse as parseYaml } from "yaml";

import { TOOL_TYPES, toolTypeNameOf } from "../schemas/tools/tool-types.js";
import type { ToolDefinition } from "../schemas/tools/tool.js";
import type { McpToolEntry } from "./tool-api.ts";
import { contractFile, contractIdentity, skillContracts, type SkillContract } from "./skill-contracts.ts";
import { CLASS_DIAGRAM_STYLE, contractDiagramHtml } from "./class-diagram.ts";
import { readLockFile } from "../schemas/kg/repo-owner.ts";

/** A skill as a Tool page shows it. */
export interface SkillInfo {
  /** Repo-relative path of the skill document. */
  file: string;
  description?: string;
  /** `input` / `output` → the contract's repo-relative path and its JSON Schema. */
  io: { io: string; file: string; schema: Record<string, unknown> }[];
}

/** One process step that a Tool can carry out, or a process the Tool's own procedure is drawn as. */
export interface ProcessUse {
  process: string;
  processName: string;
  /** Relative href to the process page (`#step-…` for a step), when the processes viewer has one. */
  href?: string;
  step?: { id: string; name: string; lane: string };
  /** The skill the step names that this Tool satisfies; absent for a subprocess. */
  via?: string;
}

/** Where a workflow file mentions the Tool's command. */
export interface WorkflowUse {
  file: string;
  line: number;
  text: string;
  href?: string;
}

export interface ToolPageData {
  def: ToolDefinition;
  /** The layer that declares it. */
  instance: string;
  /** The Tool's IRI, and the layer document it is `partOf`. */
  iri?: string;
  docIri?: string;
  /** The type IRI of a Tool node. */
  typeIri: string;
  /** Repo-relative source of the definition, and its forge URL. */
  source?: { file: string; href?: string };
  skills: Map<string, SkillInfo | undefined>;
  /** skill → relative href to its published page, when it has one. */
  skillHref: (skill: string) => string | undefined;
  /** The page of another Tool, relative to this one. */
  toolHref: (id: string) => string | undefined;
  /** Tools satisfying a skill this one does, by skill. */
  siblings: Map<string, string[]>;
  /** Derived alternatives (`deriveAlternatives`): same signature, a shared skill. */
  alternatives: string[];
  processes: ProcessUse[];
  /** Whether the processes were read at all. */
  processesRead: boolean;
  /** The script key a `bun run cat <key>` command names, resolved. */
  script?: { key: string; command: string; declaredIn: string };
  /** Files the Tool is made of: definition, module, script, maintained sources; each with its role. */
  parts: { role: string; file: string; href?: string; exists: boolean }[];
  /** Relative imports of the in-process module, one hop. */
  moduleImports: { file: string; href?: string }[];
  /** `.mcp.json` servers in the checkout. */
  mcpServers: { name: string; command: string }[];
  /** The MCP tools it serves, as `tools/list` would list them. */
  mcpTools?: McpToolEntry[];
  /** Its operation in its layer's API documents. */
  api?: { reference: string; openapi: string; mcp: string };
  workflows: WorkflowUse[];
  qaHref?: string;
  qaVerdict?: string;
  provenance?: string;
}

const code = (s: string): string => "`" + s.replace(/`/g, "ˋ") + "`";
/** Escape a table cell. */
const cell = (v: string): string => v.replace(/[\\|]/g, "\\$&").replace(/\r?\n/g, " ");
const link = (text: string, href: string | undefined): string => (href ? `[${text}](${href})` : text);

/** A JSON Schema's properties as table rows: name, type, required, description. */
export function schemaRows(schema: Record<string, unknown>): string[] {
  const props = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
  const required = new Set((schema.required ?? []) as string[]);
  const typeOf = (p: Record<string, unknown>): string => {
    if (typeof p.$ref === "string") return p.$ref.split("/").pop()!;
    if (Array.isArray(p.enum)) return p.enum.map(String).join(" \\| ");
    if (p.type === "array") return `${typeOf((p.items ?? {}) as Record<string, unknown>)}[]`;
    if (Array.isArray(p.type)) return p.type.join(" \\| ");
    if (typeof p.type === "string") return p.type;
    if (Array.isArray(p.anyOf ?? p.oneOf)) return ((p.anyOf ?? p.oneOf) as Record<string, unknown>[]).map(typeOf).join(" \\| ");
    return "—";
  };
  return Object.entries(props).map(
    ([name, p]) => `| ${code(name)} | ${cell(typeOf(p))} | ${required.has(name) ? "yes" : ""} | ${cell(String(p.description ?? ""))} |`,
  );
}

/** A port type's JSON Schema, from the Zod in `TOOL_TYPES`; undefined for an IRI outside that vocabulary. */
export function portTypeSchema(iri: string): Record<string, unknown> | undefined {
  const name = toolTypeNameOf(iri);
  if (name === undefined) return undefined;
  try {
    return z.toJSONSchema(TOOL_TYPES[name] as z.ZodType, { unrepresentable: "any" }) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/** One line describing a port type's constraint: its description, enum, or pattern. */
function portTypeSummary(iri: string): string {
  const s = portTypeSchema(iri);
  if (!s) return "";
  const parts: string[] = [];
  if (typeof s.type === "string") parts.push(s.type);
  if (Array.isArray(s.enum)) parts.push(`one of ${s.enum.map((v) => code(String(v))).join(", ")}`);
  if (typeof s.pattern === "string") parts.push(`pattern ${code(s.pattern)}`);
  if (typeof s.format === "string") parts.push(`format ${code(s.format)}`);
  if (typeof s.description === "string") parts.push(s.description);
  return parts.join(" · ");
}

/** The Tool page, as Jekyll markdown with raw HTML where a table cannot hold it. */
export function toolPage(d: ToolPageData, generatedFm: string): string {
  const t = d.def;
  const b: string[] = [
    "---",
    `title: ${JSON.stringify(`${t.id} — Tool`)}`,
    `description: ${JSON.stringify(t.title)}`,
    // OUT OF THE SITE NAV, as every per-node page is (a skill's page in
    // gen-processes-viz.ts, a methodology's): the Tools table's row links it.
    // Without this every Tool was a top-level row of the rail's "Pages",
    // ahead of the site's own pages (owner, 2026-11-13).
    "nav_exclude: true",
    // The page is a RENDERING of the Tool; its JSON-LD is the asset (kg-viewer
    // §"The asset and its rendering are two resources"): head_custom.html
    // writes it as `rel=alternate type=application/ld+json`.
    ...(d.iri ? [`alternate_jsonld: ${JSON.stringify(d.iri)}`] : []),
    generatedFm,
    "render_with_liquid: false",
    "---",
    "",
  ];

  // THE LINKED DATA, in the page itself, so the human view and the node agree.
  const node: Record<string, unknown> = {
    // The layer document's own context, published once beside it (`kg-export`'s
    // `<stub>.context.jsonld`), so this node reads with the terms its document uses.
    ...(d.docIri ? { "@context": d.docIri.replace(/\.jsonld$/, ".context.jsonld") } : {}),
    ...(d.iri ? { "@id": d.iri } : {}),
    "@type": d.typeIri,
    ...(d.docIri ? { partOf: d.docIri } : {}),
    name: t.id,
    title: t.title,
    description: t.description,
    install: t.install,
    invoke: t.invoke,
    io: t.io,
    satisfies: t.satisfies,
    ...(t.requires ? { requirements: t.requires } : {}),
    ...(t.remedies ? { remedies: t.remedies } : {}),
    ...(t.maintains ? { maintains: t.maintains } : {}),
    ...(t.downstream ? { downstream: t.downstream } : {}),
    ...(t.renders ? { renders: t.renders } : {}),
    ...(t.subprocesses ? { subprocesses: t.subprocesses } : {}),
    ...(t.selection ? { selection: t.selection } : {}),
  };
  b.push(
    `<script type="application/ld+json">${JSON.stringify(node).replace(/</g, "\\u003c")}</script>`,
    "",
    // The class diagrams below share one stylesheet (scripts/class-diagram.ts).
    CLASS_DIAGRAM_STYLE,
    "",
    `# ${cell(t.title)}`,
    "",
    t.description,
    "",
    "| | |",
    "|---|---|",
    `| Tool | ${code(t.id)} |`,
    `| IRI | ${d.iri ? `[${code(d.iri)}](${d.iri})` : "**—** (its layer publishes no document)"} |`,
    ...(d.docIri ? [`| part of | [${code(d.docIri)}](${d.docIri}) |`] : []),
    `| type | [${code(d.typeIri)}](${d.typeIri}) |`,
    `| declared by | [${code(d.instance)}](../) |`,
    ...(d.source ? [`| source | ${link(code(d.source.file), d.source.href)} |`] : []),
    `| invoked | ${Object.keys(t.invoke).sort().map(code).join(" ")} |`,
    `| qa | ${d.qaHref ? `[${code(d.qaVerdict ?? "qa-reports")}](${d.qaHref})` : d.qaVerdict ? code(d.qaVerdict) : "**—**"} |`,
    "",
  );

  // ── SKILLS ────────────────────────────────────────────────────────────────
  b.push(
    "## Skills it satisfies",
    "",
    "A skill states the capability; this Tool is one way to exercise it. Each skill's declared input and output contract follows, where it has one.",
    "",
  );
  for (const s of t.satisfies) {
    const info = d.skills.get(s);
    b.push(`### ${link(code(s), d.skillHref(s))}`, "");
    if (!info) {
      b.push("No skill document in this checkout names it — a dangling `satisfies`.", "");
      continue;
    }
    if (info.description) b.push(info.description.trim(), "");
    b.push(`Source: ${code(info.file)}.`, "");
    const others = (d.siblings.get(s) ?? []).filter((x) => x !== t.id);
    if (others.length) b.push(`Also satisfied by: ${others.map((x) => link(code(x), d.toolHref(x))).join(", ")}.`, "");
    if (info.io.length === 0) {
      b.push("The skill declares no I/O contract (`schemas/skills/" + s + "/{input,output}.schema.json`).", "");
    }
    if (info.io.length) {
      // The contracts as one class diagram (bean `cat-tools-4xq6`): the skill
      // box points at each contract's root class, every class is the schemas
      // viewer's own drawing, and the skill box links to the skill's page.
      b.push(contractDiagramHtml({ name: s, source: "skill", ...(d.skillHref(s) ? { href: d.skillHref(s)! } : {}) }, info.io), "");
    }
    for (const c of info.io) {
      b.push(`**${c.io}** — ${code(c.file)}${typeof c.schema.$id === "string" ? `, ${code(c.schema.$id)}` : ""}`, "");
      const rows = schemaRows(c.schema);
      if (rows.length) b.push("| field | type | required | description |", "|---|---|---|---|", ...rows, "");
      else b.push("```json", JSON.stringify(c.schema, null, 2), "```", "");
    }
  }

  // ── ITS OWN I/O ──────────────────────────────────────────────────────────
  const port = (p: { name: string; schema: string; description?: string; required?: boolean }, dir: string): string =>
    `| ${dir} | ${code(p.name)} | [${code(p.schema.split(/[#/]/).filter(Boolean).pop() ?? p.schema)}](${p.schema}) | ${
      dir === "in" ? (p.required === false ? "" : "yes") : ""
    } | ${cell(p.description ?? "")} | ${cell(portTypeSummary(p.schema))} |`;
  b.push("## Inputs and outputs", "");
  if (t.io.inputs.length + t.io.outputs.length === 0) b.push("It declares no typed ports.", "");
  else
    b.push(
      "Each port names a shared type by IRI, so two Tools for one skill can be checked for interchangeability.",
      "",
      "| | port | type | required | description | constraint |",
      "|---|---|---|---|---|---|",
      ...t.io.inputs.map((p) => port(p as never, "in")),
      ...t.io.outputs.map((p) => port(p as never, "out")),
      "",
    );

  // ── PROCESSES ────────────────────────────────────────────────────────────
  b.push("## Processes and tasks", "");
  if (!d.processesRead) b.push("The process diagrams were not read for this build.", "");
  else if (d.processes.length === 0)
    b.push(`No process step names a skill this Tool satisfies${t.subprocesses?.length ? ", and its subprocesses resolve to no diagram" : ""}.`, "");
  else {
    const sub = d.processes.filter((p) => !p.via);
    const steps = d.processes.filter((p) => p.via);
    if (sub.length) {
      b.push("Its own procedure is drawn as:", "", ...sub.map((p) => `- ${link(cell(p.processName), p.href)} (${code(p.process)})`), "");
    }
    if (steps.length) {
      b.push(
        "Steps this Tool can carry out, because each names a skill it satisfies:",
        "",
        "| process | step | lane | via skill |",
        "|---|---|---|---|",
        ...steps.map(
          (p) => `| ${cell(p.processName)} | ${link(cell(p.step!.name || p.step!.id), p.href)} | ${cell(p.step!.lane)} | ${code(p.via!)} |`,
        ),
        "",
      );
    }
  }

  // ── DEPLOYMENT ───────────────────────────────────────────────────────────
  b.push("## How it is deployed and reached", "");
  const inv = t.invoke;
  const surfaces: string[] = [];
  if (inv.shell) {
    surfaces.push(
      `**Command line.** From the repository root: ${code(inv.shell)}.` +
        (d.script ? ` ${code(`cat ${d.script.key}`)} runs ${code(d.script.command)} (declared in ${code(d.script.declaredIn)}).` : ""),
    );
  }
  if (inv.mcp) {
    surfaces.push(
      `**MCP.** Served as ${code(inv.mcp.tool)}` +
        (d.mcpServers.length
          ? ` by ${d.mcpServers.map((s) => `${code(s.name)} (${code(s.command)})`).join(", ")}, the server${d.mcpServers.length > 1 ? "s" : ""} \`.mcp.json\` declares.`
          : "; this checkout declares no MCP server in `.mcp.json`."),
    );
  }
  if (inv.inProcess) {
    surfaces.push(
      `**In process.** ${code(inv.inProcess.module)}${inv.inProcess.register ? `, registered by ${code(inv.inProcess.register)}` : ""} — loaded by the harness directly, with no server.`,
    );
  }
  if (inv.container) surfaces.push(`**Container.** ${code(inv.container)}.`);
  if (inv.manual) surfaces.push("**Manual.** A person performs it by following the skill; there is no command.");
  surfaces.push(
    d.workflows.length
      ? `**GitHub Actions.** ${d.workflows.length} workflow line(s) run its command:`
      : "**GitHub Actions.** No workflow in this checkout runs its command.",
  );
  b.push(...surfaces.map((s) => `- ${s}`), "");
  if (d.workflows.length) {
    b.push("| workflow | line | |", "|---|---|---|", ...d.workflows.map((w) => `| ${link(code(w.file), w.href)} | ${w.line} | ${code(cell(w.text.trim()))} |`), "");
  }
  if (d.mcpTools?.length) {
    b.push(`The MCP tool${d.mcpTools.length > 1 ? "s it serves" : " it serves"}, as \`tools/list\` answers:`, "");
    for (const m of d.mcpTools) {
      b.push(`**${code(m.name)}** — ${m._meta.source === "registrar" ? "read from its registrar" : "built from the Tool's declared inputs"}.`, "");
      const rows = schemaRows(m.inputSchema);
      if (rows.length) {
        // The MCP input as a class diagram, the Tool box pointing at it and
        // linking to the layer's MCP tool list, where this entry is served.
        b.push(
          contractDiagramHtml({ name: t.id, source: "tool", ...(d.api ? { href: d.api.mcp } : {}) }, [
            { io: m.name, file: `mcp/${m.name}.input.schema.json`, schema: { title: `${m.name} input`, ...m.inputSchema } },
          ]),
          "",
        );
      }
      if (rows.length) b.push("| parameter | type | required | description |", "|---|---|---|---|", ...rows, "");
      else b.push("It takes no parameters.", "");
    }
  }
  if (d.api) {
    b.push(
      `As an API: [its operation](${d.api.reference}) in the [OpenAPI document](${d.api.openapi}) and the [MCP tool list](${d.api.mcp}) of its layer.`,
      "",
    );
  }
  const inst = Object.entries(t.install).map(([k, v]) => (v === true ? code(k) : `${code(k)}: ${code(String(v))}`));
  b.push("| | |", "|---|---|", `| install | ${inst.join(", ") || "—"} |`);
  if (t.requires) {
    const r = t.requires;
    if (r.runtime?.length) b.push(`| runtime | ${r.runtime.map(code).join(", ")} |`);
    if (r.os?.length) b.push(`| os | ${r.os.map(code).join(", ")} |`);
    if (r.network !== undefined) b.push(`| network | ${r.network ? "yes" : "no"} |`);
  }
  b.push("");
  if (t.remedies?.length) {
    b.push(
      "When a host it reaches is refused:",
      "",
      "| host / error | remedy |",
      "|---|---|",
      ...t.remedies.map((r) => {
        const o = r as Record<string, unknown>;
        const what = String(o.host ?? o.error ?? "—");
        const rest = Object.entries(o)
          .filter(([k]) => k !== "host" && k !== "error")
          .map(([k, v]) => (k === "tool" && typeof v === "string" ? `tool ${link(code(v), d.toolHref(v))}` : `${k}: ${cell(typeof v === "string" ? v : JSON.stringify(v))}`))
          .join("; ");
        return `| ${code(what)} | ${rest} |`;
      }),
      "",
    );
  }
  if (t.selection) {
    b.push(
      "| when to choose it | |",
      "|---|---|",
      `| when | ${cell(t.selection.when)} |`,
      `| limits | ${cell(t.selection.limits)} |`,
      `| cost | ${cell(t.selection.cost)} |`,
      "",
    );
  }
  if (d.alternatives.length) b.push(`Alternatives (same signature, a shared skill): ${d.alternatives.map((x) => link(code(x), d.toolHref(x))).join(", ")}.`, "");

  // ── WHAT IT IS MADE OF ───────────────────────────────────────────────────
  b.push("## What it is made of", "");
  // No parts, no table: kramdown prints a header-only table as a paragraph.
  if (d.parts.length === 0) b.push("Its definition names no file it is made of.", "");
  else
    b.push(
      "| role | file | |",
      "|---|---|---|",
      ...d.parts.map((p) => `| ${p.role} | ${link(code(p.file), p.href)} | ${p.exists ? "" : "not in this checkout"} |`),
      "",
    );
  if (d.moduleImports.length) {
    b.push("Its module imports, one hop:", "", ...d.moduleImports.map((m) => `- ${link(code(m.file), m.href)}`), "");
  }
  if (t.maintains?.length) {
    b.push(
      "It is authoritative for:",
      "",
      "| artefact | from |",
      "|---|---|",
      ...t.maintains.map((m) => `| ${code(String((m as { artefact: unknown }).artefact))} | ${code(String((m as { source: unknown }).source))} |`),
      "",
    );
  }
  if (t.downstream) b.push("It keeps a downstream output current:", "", "```json", JSON.stringify(t.downstream, null, 2), "```", "");
  if (t.renders?.length) b.push(`It draws the viewer for the graph typolog${t.renders.length > 1 ? "ies" : "y"} ${t.renders.map(code).join(", ")}.`, "");

  // ── LINKED DATA ──────────────────────────────────────────────────────────
  b.push(
    "## Linked data",
    "",
    d.iri
      ? `The Tool is published as its own JSON-LD document at its IRI, [${code(d.iri)}](${d.iri}), \`partOf\` its layer's document. The node below is the definition this page was drawn from, and is embedded in the page as \`application/ld+json\`.`
      : "Its layer publishes no document, so the Tool has no dereferenceable IRI. The node below is the definition this page was drawn from.",
    "",
    "```json",
    JSON.stringify(node, null, 2),
    "```",
    "",
  );

  if (d.provenance) b.push("## Provenance", "", d.provenance.trimEnd(), "");
  return b.join("\n").trimEnd() + "\n";
}

// ── The joins ────────────────────────────────────────────────────────────────

/** Each `<skill>.md` under `dirs`, by name, with its front-matter description. */
export function skillDocuments(dirs: readonly string[], repo: string): Map<string, { file: string; description?: string }> {
  const out = new Map<string, { file: string; description?: string }>();
  const walk = (dir: string, depth = 0): void => {
    if (depth > 5) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (e.name.endsWith(".md")) {
        const name = e.name.replace(/\.md$/, "");
        if (out.has(name)) continue;
        let description: string | undefined;
        try {
          const m = /^---\n([\s\S]*?)\n---/.exec(readFileSync(p, "utf-8"));
          const fm = m ? (parseYaml(m[1]!) as Record<string, unknown> | null) : null;
          if (fm && typeof fm.description === "string") description = fm.description;
        } catch {
          // Unparseable front matter: the skill is still found, with no description.
        }
        out.set(name, { file: relative(repo, p).split(sep).join("/"), ...(description ? { description } : {}) });
      }
    }
  };
  for (const d of dirs) walk(d);
  return out;
}

/** Each root's skills' declared contracts, read once per root. */
const contractsByRoot = new Map<string, Map<string, SkillContract>>();

/**
 * A skill's declared I/O contracts, in any layer.
 *
 * First through the skill's own `input:`/`output:` refs (#1168 B3b), which
 * find a contract wherever its layer keeps it — the root `schemas/skills/` or
 * a subgraph's (bean `cat-tools-st4q`). A skill naming none falls back to
 * `<schemas graph>/skills/<skill>/<io>.schema.json`, as before.
 */
export function skillIoContracts(skill: string, roots: readonly string[], repo: string): SkillInfo["io"] {
  for (const r of roots) {
    let byName = contractsByRoot.get(r);
    if (byName === undefined) contractsByRoot.set(r, (byName = skillContracts(r)));
    const c = byName.get(skill);
    if (c === undefined) continue;
    const out: SkillInfo["io"] = [];
    for (const key of ["input", "output"] as const) {
      const ref = c[key];
      const f = ref === undefined ? undefined : contractFile(c.instanceRoot, ref);
      if (f === undefined || !existsSync(f)) continue;
      try {
        out.push({ io: contractIdentity(ref!, skill, key).io, file: relative(repo, f).split(sep).join("/"), schema: JSON.parse(readFileSync(f, "utf-8")) });
      } catch {
        // An unreadable contract is `check:schemas`' finding; it is left out here.
      }
    }
    if (out.length > 0) return out.sort((a, b) => a.io.localeCompare(b.io));
  }
  // Each layer's declared `schemas` graphs, not a `schemas/` found by name.
  // declared-path-literal: `skills/<skill>/` is the I/O-contract folder INSIDE a schemas graph, that graph's own convention — not the `skills` graph.
  for (const dir of roots.flatMap((r) => instanceDirectoriesForGraph(r, "schemas")).map((d) => join(d, "skills", skill))) {
    if (!existsSync(dir)) continue;
    const out: SkillInfo["io"] = [];
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".schema.json")).sort()) {
      try {
        out.push({ io: f.replace(/\.schema\.json$/, ""), file: relative(repo, join(dir, f)).split(sep).join("/"), schema: JSON.parse(readFileSync(join(dir, f), "utf-8")) });
      } catch {
        // An unreadable contract is `check:schemas`' finding; it is left out here.
      }
    }
    return out;
  }
  return [];
}

/** A file's URL on its forge, at the pinned commit when it is in a remote-mounted layer. */
export function forgeHrefFor(repo: string, fallbackWeb?: string): (file: string) => string | undefined {
  let mounts: { harness: string; repository: string; ref: string }[] = [];
  try {
    mounts = readLockFile<{ mounts?: typeof mounts }>(join(repo, "index.lock.json")).mounts ?? [];
  } catch {
    // No lock: nothing is remote-mounted, so every file is the checkout's own.
  }
  return (file) => {
    const [head, ...rest] = file.split("/");
    const m = mounts.find((x) => x.harness === head);
    if (m) return `https://github.com/${m.repository}/blob/${m.ref}/${rest.join("/")}`;
    return fallbackWeb ? `${fallbackWeb}/blob/HEAD/${file}` : undefined;
  };
}

/** `bun run cat <key>` → the command its layers' `package.json` declare for the key. */
export function resolveScriptKey(shell: string, roots: readonly string[], repo: string): ToolPageData["script"] {
  const m = /\bbun run cat ([A-Za-z0-9:_.-]+)/.exec(shell);
  if (!m) return undefined;
  const key = m[1]!;
  for (const r of roots) {
    const pkg = join(r, "package.json");
    if (!existsSync(pkg)) continue;
    try {
      const j = JSON.parse(readFileSync(pkg, "utf-8")) as { scripts?: Record<string, string>; checkoutScripts?: Record<string, string> };
      const command = j.checkoutScripts?.[key] ?? j.scripts?.[key];
      if (command) return { key, command, declaredIn: relative(repo, pkg).split(sep).join("/") };
    } catch {
      // Unparseable package.json: try the next layer.
    }
  }
  return undefined;
}

/** Repo-relative script paths a command names (`*.ts`, `*.js`, `*.py`, `*.sh`). */
export function scriptPaths(command: string): string[] {
  return [...new Set([...command.matchAll(/(?:^|\s)((?:\.\/)?[\w@./-]+\.(?:ts|js|mjs|py|sh))\b/g)].map((x) => x[1]!.replace(/^\.\//, "")))];
}

/** One hop of relative imports from a module, repo-relative. */
export function relativeImports(abs: string, repo: string): string[] {
  let text: string;
  try {
    text = readFileSync(abs, "utf-8");
  } catch {
    return [];
  }
  const out = new Set<string>();
  for (const m of text.matchAll(/(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g)) {
    let p = resolve(dirname(abs), m[1]!);
    if (!existsSync(p) && p.endsWith(".js") && existsSync(p.replace(/\.js$/, ".ts"))) p = p.replace(/\.js$/, ".ts");
    if (existsSync(p)) out.add(relative(repo, p).split(sep).join("/"));
  }
  return [...out].sort();
}

/** Every line of a GitHub workflow in the checkout that runs `needle`. */
export function workflowUses(repo: string, roots: readonly string[], needles: readonly string[], href: (f: string) => string | undefined): WorkflowUse[] {
  if (needles.length === 0) return [];
  const out: WorkflowUse[] = [];
  const seen = new Set<string>();
  for (const r of [repo, ...roots]) {
    const dir = join(r, ".github", "workflows");
    if (!existsSync(dir) || seen.has(resolve(dir))) continue;
    seen.add(resolve(dir));
    for (const f of readdirSync(dir).filter((x) => /\.ya?ml$/.test(x)).sort()) {
      const file = relative(repo, join(dir, f)).split(sep).join("/");
      readFileSync(join(dir, f), "utf-8")
        .split("\n")
        .forEach((line, i) => {
          if (line.trimStart().startsWith("#")) return;
          if (needles.some((n) => new RegExp(`(^|[\\s"'/])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[\\s"'])`).test(line))) {
            out.push({ file, line: i + 1, text: line, href: href(file) && `${href(file)}#L${i + 1}` });
          }
        });
    }
  }
  return out;
}

/** What to look for in a workflow: the script key, and each script the command names. */
export function workflowNeedles(t: ToolDefinition, script: ToolPageData["script"]): string[] {
  if (!t.invoke.shell) return [];
  const n = new Set<string>();
  if (script) {
    n.add(`cat ${script.key}`);
    n.add(`run ${script.key}`);
    for (const p of scriptPaths(script.command)) n.add(p);
  }
  for (const p of scriptPaths(t.invoke.shell)) n.add(p);
  return [...n];
}

/** The MCP servers a checkout's `.mcp.json` declares. */
export function mcpServersOf(repo: string): ToolPageData["mcpServers"] {
  try {
    const j = JSON.parse(readFileSync(join(repo, ".mcp.json"), "utf-8")) as { mcpServers?: Record<string, { command?: string; args?: string[]; url?: string }> };
    return Object.entries(j.mcpServers ?? {}).map(([name, s]) => ({ name, command: s.url ?? [s.command, ...(s.args ?? [])].filter(Boolean).join(" ") }));
  } catch {
    return [];
  }
}

/** A posix-relative href from one site page's directory to another's. */
export function pageHref(fromPage: string, toPage: string): string {
  const r = posix.relative(posix.dirname(fromPage), toPage);
  return r.endsWith("index.md") ? r.slice(0, -"index.md".length) || "./" : r;
}

/**
 * A skill page's "Input and output" section: the skill's declared contracts as
 * one class diagram, the same drawing a Tool page shows for that skill, plus a
 * link to each contract file. Empty when the skill declares none, so a page
 * without contracts gains no empty heading.
 */
export function skillContractSectionMd(
  skill: string,
  roots: readonly string[],
  repo: string,
  fileHref: (file: string) => string | undefined = () => undefined,
): string[] {
  const io = skillIoContracts(skill, roots, repo);
  if (io.length === 0) return [];
  const docs = io.map((c) => {
    const href = fileHref(c.file);
    return { ...c, ...(href ? { href } : {}) };
  });
  return [
    "",
    "## Input and output contracts",
    "",
    "What this skill takes and gives, as a class diagram drawn from its JSON Schema contracts by the schemas viewer's own renderer. Each box links to its definition; each type to its specification.",
    "",
    CLASS_DIAGRAM_STYLE,
    "",
    contractDiagramHtml({ name: skill, source: "skill" }, docs),
    "",
    ...docs.map((c) => `- **${c.io}**: ${c.href ? `[\`${c.file}\`](${c.href})` : `\`${c.file}\``}`),
    "",
  ];
}
