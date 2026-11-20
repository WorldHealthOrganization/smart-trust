#!/usr/bin/env bun
/**
 * Render the harness object model as PlantUML, with every class's attributes
 * DERIVED from the JSON Schema behind it.
 *
 * Five packages — schema, scenario, process, state, test — and the classes in
 * them. Nothing inside a class box is transcribed: each box is read from a
 * schema, and the stereotype names which one:
 *
 * - `«json: X»` — a JSON Schema generated from the Zod schema `X` in
 *   `schemas/` (`toJsonSchema` in `schemas/kg/to-json-schema.ts`, Zod 4's native
 *   converter — the route every generator here takes).
 * - `«ext: …»` — a schema this repository does not own: the WHO SMART DAK's
 *   own JSON Schema for User Story (read from a DAK base layer), the beans CLI's
 *   GraphQL schema for Bean, OMG BPMN 2.0 for Process.
 *
 * Relationships are declared below, but each one names the schema path that
 * carries it and the generator REFUSES to write if that path is not in the
 * derived schema — so an edge cannot outlive the field it was drawn from. The
 * edges that live somewhere other than a JSON Schema (the BPMN extension
 * attributes `folio:role`, `folio:skill` and `folio:bean`, and a skill's
 * `input:` and `output:` front matter) are drawn dashed and say where.
 *
 * Every arrow runs from the dependent to the general node: a Task REALISES
 * the Skill it implements (UML realisation, `..|>`), a Voice and a User Story
 * point at their Role, and a Test Run points at the Skill it tests and at the
 * contracts its cases are checked against.
 *
 * Every class names its glossary term, and the generator REFUSES to write if
 * the rendered glossary page has no entry for it.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/gen-object-model-uml.ts           # write
 *   bun run cat-harness-tools/scripts/gen-object-model-uml.ts --check   # stale?
 *
 * `--check` needs the `beans` CLI for the Bean class; without it the result is
 * "could not check" (exit 2), never a pass.
 *
 * @module scripts/gen-object-model-uml
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { overlayDirs, overlayPath } from "./lib/layer-output.ts";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import type { z } from "zod";

import { toJsonSchema } from "../schemas/kg/to-json-schema.js";

import { ActorDefSchema, RoleDefSchema } from "../schemas/process/role-graph.js";
import { UserStorySchema } from "../schemas/process/user-story.js";
import { SkillDefinitionSchema } from "../schemas/kg/skill-package.js";
import { TaskRefSchema } from "../schemas/kg/carried-note.js";
import { TodoNodeSchema } from "../schemas/sdlc/todo.js";
import { TestRunSchema } from "../schemas/sdlc/test-run.js";
import { KgQaReportSchema } from "../schemas/sdlc/kg-qa.js";
import { ExternalSchemaSchema } from "../schemas/kg/external-schema.js";
import { VoiceProfileSchema } from "../schemas/content/voices.js";
import { instanceDirectoryForGraph, readDeclaration, siteDir } from "../schemas/kg/cat-harness.js";
import { readUmlPalette } from "./uml-palette.js";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { contentLayerInstance } from "../schemas/kg/graph-typology-registry.js";
import { PAGE_LOCALE, declaredPageRoute, declaredRoute } from "./viewer-declarations.ts";

const HARNESS = resolve(HARNESS_ROOT);
/** Colours from `uml.css`, the one place they are declared. */
const PALETTE = readUmlPalette(HARNESS);
/**
 * In THIS layer's declared `uml` directory, beside the per-sub-graph
 * diagrams `gen-uml-overview.ts` writes under `uml/overview/`.
 */
const OUT = join(
  // declared-path-literal: the conventional fallback when no declaration names the directory
  instanceDirectoryForGraph(HARNESS, "uml") ?? join(HARNESS, "uml"),
  "harness-object-model.puml",
);
const BPMN_RECORD = join(
  instanceDirectoryForGraph(HARNESS, "external-schema") ?? join(HARNESS, "external-schemas"),
  "omg-bpmn-2.0.json",
);
/**
 * The rendered glossary page, whose `<dt id>` entries are the anchors a class
 * links to. Read from the PAGE rather than from the glossary documents: the
 * page is this layer's own output, while the documents sit in
 * the content core, which cat-harness does not depend on.
 */
const OWN = readDeclaration(HARNESS);
if (!OWN) throw new Error(`${HARNESS} declares no instance — no site to find the glossary page in`);
// The page sits at the ROUTE the content core declares for its glossary visualiser
// (its declaration's `visualisers`, computed by `visualiserRoute`), inside this
// harness's site: cat-harness f999d7f6 moved it from `glossary/` to that route, and the
// bare `/glossary/` is now only its declared alias. Read from the sibling mount when it is
// there; the fallback is the route core declares today, the same one glossary-page.ts uses.
// Under the page locale since 2026-10-16 (owner, "c"), `en/<harness>/<visualiser>`,
// like every other visualiser's page; the page is read at its old address too
// until the site holding it is regenerated, and the link always goes to the new one.
// The layer that owns the glossary is the one declaring the `core` layer's
// kinds — `glossary` among them — read from where they were declared, not
// spelt here (folio-assistant#2598). With no content layer composed there is
// no glossary page to link, and the bare alias stands in.
const CONTENT = contentLayerInstance();
const CORE_ROOT = CONTENT?.root ?? resolve(HARNESS, "..");
const GLOSSARY_FALLBACK = CONTENT ? `${CONTENT.name}/glossary` : "glossary";
const GLOSSARY_ROUTE = (CONTENT && declaredPageRoute(CORE_ROOT, "glossary-page")) ?? `${PAGE_LOCALE}/${GLOSSARY_FALLBACK}`;
const GLOSSARY_LEGACY_ROUTE = (CONTENT && declaredRoute(CORE_ROOT, "glossary-page")) ?? GLOSSARY_FALLBACK;
const glossaryPageAt = (route: string): string => join(HARNESS, siteDir(OWN), ...route.split("/"), "index.md");
// Found through the layer output overlay (sm8r): `glossary:page` writes a
// mounted site's pages at the output root (core 4b6c738), so the path under
// the mount is the logical name and `overlayPath` is where the bytes are.
const GLOSSARY_PAGE = [GLOSSARY_ROUTE, GLOSSARY_LEGACY_ROUTE].map(glossaryPageAt).find((p) => existsSync(overlayPath(p))) ?? glossaryPageAt(GLOSSARY_ROUTE);
/** The glossary page whose `<dt id>` anchors every class must reach — written at publish, so a test can ask whether it is there. */
export const glossaryPage = (): string => GLOSSARY_PAGE;
/**
 * Where a term's entry is: on the page of the layer that owns its scheme,
 * `<route>/instance/<instance>/` (the content core, owner 2026-10-15: the
 * authored terms left the glossary index for one page per owning layer).
 * The layer is the anchor's first segment, `<instance>--<scheme>--<id>`.
 */
export function termPageRoute(term: string): string {
  return `${GLOSSARY_ROUTE}/instance/${term.split("--", 1)[0]}/`;
}

// ── JSON Schema, reduced to what a class box shows ────────────────────────

type Json = Record<string, unknown>;

interface Attr {
  name: string;
  type: string;
  mult: string;
}

function typeOf(s: Json): string {
  if (s.const !== undefined) return JSON.stringify(s.const);
  if (Array.isArray(s.enum)) {
    const vals = (s.enum as unknown[]).map(String);
    return vals.length <= 8 ? vals.join(" | ") : `enum(${vals.length})`;
  }
  const alts = (s.anyOf ?? s.oneOf) as Json[] | undefined;
  if (alts) return [...new Set(alts.map(typeOf))].join(" | ");
  if (s.type === "array") {
    const inner = typeOf((s.items ?? {}) as Json);
    return inner.includes(" | ") ? `list<${inner}>` : `${inner}[]`;
  }
  if (s.type === "object" && s.additionalProperties && !s.properties) {
    return `map<${typeOf(s.additionalProperties as Json)}>`;
  }
  if (Array.isArray(s.type)) return (s.type as string[]).join(" | ");
  if (typeof s.type === "string") return s.format ? `${s.type}<${s.format}>` : s.type;
  return "any";
}

function multOf(s: Json, required: boolean): string {
  if (s.type === "array") {
    const min = (s.minItems as number | undefined) ?? 0;
    return min > 0 ? `[${min}..*]` : "[0..*]";
  }
  return required ? "[1]" : "[0..1]";
}

/**
 * Properties as attributes. A nested object is flattened ONE level with a
 * dotted name — `tags.roles` — because that is how the relationship paths
 * below address it, and a second level is detail a class box cannot carry.
 */
function attrsOf(schema: Json, prefix = "", depth = 0): Attr[] {
  const props = (schema.properties ?? {}) as Record<string, Json>;
  const req = new Set((schema.required ?? []) as string[]);
  const out: Attr[] = [];
  for (const [name, s] of Object.entries(props)) {
    const full = prefix + name;
    if (depth === 0 && s.type === "object" && s.properties) {
      out.push(...attrsOf(s, `${full}.`, 1));
      continue;
    }
    const items = s.type === "array" ? ((s.items ?? {}) as Json) : undefined;
    const t = items?.type === "object" && items.properties
      ? `{${Object.keys(items.properties as Json).join(", ")}}[]`
      : typeOf(s);
    out.push({ name: full, type: t, mult: multOf(s, req.has(name)) });
  }
  return out;
}

function fromZod(schema: z.ZodType): Json {
  return toJsonSchema(schema) as Json;
}

function readJson(path: string): Json {
  return JSON.parse(readFileSync(path, "utf8")) as Json;
}

// ── The beans CLI's own schema ────────────────────────────────────────────

/** Scalar fields of `type Bean` from `beans graphql --schema`, or null. */
function beanAttrs(): Attr[] | null {
  const r = spawnSync("beans", ["graphql", "--schema"], { encoding: "utf8" });
  if (r.status !== 0 || !r.stdout) return null;
  const body = /type Bean \{([\s\S]*?)\n\}/.exec(r.stdout)?.[1];
  if (!body) return null;
  const out: Attr[] = [];
  for (const m of body.matchAll(/^\s*(\w+)(\([^)]*\))?:\s*([\w[\]!]+)\s*$/gm)) {
    const [, name, args, gql] = m;
    if (args) continue; // resolved traversals, not stored fields
    const list = gql.startsWith("[");
    const base = gql.replace(/[[\]!]/g, "");
    if (base === "Bean") continue; // `parent` — the resolved form of parentId
    out.push({
      name,
      type: list ? `${base}[]` : base,
      mult: list ? "[0..*]" : gql.endsWith("!") ? "[1]" : "[0..1]",
    });
  }
  return out;
}

// ── The model ─────────────────────────────────────────────────────────────

interface ClassDef {
  id: string;
  title: string;
  pkg: "scenario" | "process" | "state" | "schema" | "test";
  source: string; // the stereotype
  attrs: Attr[];
  /** The glossary entry defining it: the `<dt id>` on the glossary page. */
  term: string;
  note?: string;
}

interface Edge {
  from: string;
  to: string;
  /** Attribute of `from` that carries it — asserted, unless `via` is set. */
  path?: string;
  /** For an edge no JSON Schema carries: where it is declared instead. */
  via?: string;
  label: string;
  mult?: string;
  /** `realises`: UML realisation, the dependent implements the general node. */
  kind?: "realises";
}

function build(beans: Attr[] | null): { classes: ClassDef[]; edges: Edge[] } {
  const bpmn = readJson(BPMN_RECORD);
  const terms = ((bpmn.terms ?? []) as Json[]).map((t) => String(t.term).replace(/^bpmn:/, ""));
  const taskTerms = terms.filter((t) => /task|callActivity/i.test(t));
  const processTerms = terms.filter((t) => /^(process|laneSet|lane|sequenceFlow|startEvent|endEvent|exclusiveGateway|parallelGateway)$/.test(t));

  const classes: ClassDef[] = [
    { id: "Actor", title: "Actor", pkg: "scenario", source: "json: ActorDefSchema", attrs: attrsOf(fromZod(ActorDefSchema)), term: "cat-harness--platform--actor" },
    { id: "Role", title: "Role", pkg: "scenario", source: "json: RoleDefSchema", attrs: attrsOf(fromZod(RoleDefSchema)), term: "cat-harness--platform--role" },
    {
      id: "Skill", title: "Skill", pkg: "scenario", source: "json: SkillDefinitionSchema", attrs: attrsOf(fromZod(SkillDefinitionSchema)),
      term: "bootstrap--terms--skill",
    },
    {
      id: "Voice", title: "Voice", pkg: "scenario", source: "json: VoiceProfileSchema", attrs: attrsOf(fromZod(VoiceProfileSchema)),
      term: "cat-harness--platform--voice",
    },
    {
      id: "UserStory", title: "User Story", pkg: "scenario", source: "json: UserStorySchema",
      attrs: attrsOf(fromZod(UserStorySchema)), term: "cat-harness--platform--user-story",
      note: "As a <role> I want <want> so that <soThat>.\nscenarios/stories.json; the role names none.\nSMART DAK's SGUserStory is the external shape.",
    },
    {
      id: "Process", title: "Process", pkg: "process",
      source: `ext: ${String(bpmn.authority)} BPMN ${String(bpmn.version)}`,
      attrs: processTerms.map((t) => ({ name: `bpmn:${t}`, type: "element", mult: "" })),
      term: "bootstrap--terms--process",
      note: "XSD, not JSON Schema: the elements\nlisted are the operative terms pinned\nin external-schemas/omg-bpmn-2.0.json.",
    },
    {
      id: "Task", title: "Task", pkg: "process", source: "json: TaskRefSchema",
      attrs: [
        ...attrsOf(fromZod(TaskRefSchema)),
        ...taskTerms.map((t) => ({ name: `bpmn:${t}`, type: "element", mult: "" })),
      ],
      term: "bootstrap--terms--task",
    },
    { id: "Todo", title: "Todo", pkg: "state", source: "json: TodoNodeSchema", attrs: attrsOf(fromZod(TodoNodeSchema)), term: "cat-harness--platform--todo" },
    {
      id: "Bean", title: "Bean", pkg: "state", source: "ext: beans GraphQL type Bean",
      attrs: beans ?? [], term: "cat-harness--platform--bean",
      note: beans ? undefined : "could not determine: the beans CLI\nwas not on PATH when this was generated",
    },
    {
      id: "JsonSchema", title: "JSON Schema", pkg: "schema", source: "draft-07",
      attrs: [
        { name: "$schema", type: "string<uri>", mult: "[1]" },
        { name: "properties", type: "schema", mult: "[0..*]" },
      ],
      term: "cat-harness--platform--json-schema",
    },
    {
      id: "ExternalSchema", title: "External Schema", pkg: "schema", source: "json: ExternalSchemaSchema", attrs: attrsOf(fromZod(ExternalSchemaSchema)),
      term: "cat-harness--platform--external-schema",
    },
    { id: "TestRun", title: "Test Run", pkg: "test", source: "json: TestRunSchema", attrs: attrsOf(fromZod(TestRunSchema)), term: "cat-harness--platform--test-run" },
    {
      id: "KgQaReport", title: "KG QA Report", pkg: "test", source: "json: KgQaReportSchema", attrs: attrsOf(fromZod(KgQaReportSchema)),
      term: "cat-harness--platform--kg-qa-report",
    },
  ];

  const edges: Edge[] = [
    { from: "Actor", to: "Role", path: "roles", label: "takes on", mult: "0..*" },
    { from: "Role", to: "Role", path: "inherits", label: "inherits", mult: "0..*" },
    { from: "Role", to: "Skill", path: "skills", label: "carries", mult: "0..*" },
    { from: "Voice", to: "Role", path: "activeIn.roles", label: "written for", mult: "0..*" },
    { from: "UserStory", to: "Role", path: "role.role", label: "as a", mult: "1" },
    { from: "Skill", to: "JsonSchema", via: "front matter input:", label: "input", mult: "0..1" },
    { from: "Skill", to: "JsonSchema", via: "front matter output:", label: "output", mult: "0..1" },
    { from: "Task", to: "Process", path: "process", label: "in", mult: "1" },
    { from: "Task", to: "Role", via: "folio:role ref on the lane", label: "in lane of", mult: "1" },
    { from: "Task", to: "Skill", via: "folio:skill ref", label: "implements", mult: "1", kind: "realises" },
    { from: "Task", to: "Bean", via: "folio:bean op", label: "bean op", mult: "0..1" },
    { from: "Todo", to: "Role", path: "tags.roles", label: "tags", mult: "0..*" },
    { from: "Todo", to: "Process", path: "tags.processes", label: "tags", mult: "0..*" },
    { from: "Todo", to: "Task", path: "tags.tasks", label: "tags", mult: "0..*" },
    { from: "Todo", to: "Actor", path: "tags.identities", label: "identities[].actor", mult: "0..*" },
    { from: "Bean", to: "Bean", path: "parentId", label: "parent", mult: "0..1" },
    { from: "Bean", to: "Bean", path: "blockingIds", label: "blocks", mult: "0..*" },
    { from: "TestRun", to: "Skill", path: "skill", label: "tests", mult: "1" },
    { from: "TestRun", to: "JsonSchema", path: "cases", label: "checked against the skill's input and output", mult: "0..2" },
    { from: "JsonSchema", to: "ExternalSchema", via: "$ref", label: "conformsTo", mult: "0..*" },
    { from: "KgQaReport", to: "Role", path: "subject.kind", label: "audits", mult: "1" },
    { from: "KgQaReport", to: "Process", path: "subject.kind", label: "audits", mult: "1" },
    { from: "KgQaReport", to: "Skill", path: "subject.kind", label: "audits", mult: "1" },
  ];
  return { classes, edges };
}

/** Every `path` edge must name an attribute the derived schema has. */
function assertEdges(classes: ClassDef[], edges: Edge[]): string[] {
  const byId = new Map(classes.map((c) => [c.id, c]));
  const problems: string[] = [];
  for (const e of edges) {
    const from = byId.get(e.from);
    if (!from || !byId.has(e.to)) {
      problems.push(`${e.from} → ${e.to}: unknown class`);
      continue;
    }
    if (!e.path) continue;
    if (from.id === "Bean" && from.attrs.length === 0) continue; // undetermined, said in its note
    if (!from.attrs.some((a) => a.name === e.path)) {
      problems.push(`${e.from} → ${e.to}: ${e.path} is not in ${from.source}`);
    }
  }
  return problems;
}

/**
 * The `<dt id>` anchors each at the page it is on — the index and every
 * layer's authored page — or null if there is no glossary page. An anchor
 * counts only on the page {@link termPageRoute} links to, so a class cannot
 * pass on an entry its link does not reach.
 */
function glossaryAnchors(): Set<string> | null {
  if (!existsSync(overlayPath(GLOSSARY_PAGE))) return null;
  // The per-layer pages, read through the overlay: the output-root twin and
  // the mount are listed together and a page is read from wherever it is.
  const instanceDir = join(dirname(GLOSSARY_PAGE), "instance");
  const names = new Set(
    overlayDirs(instanceDir).flatMap((d) =>
      readdirSync(d, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name),
    ),
  );
  const pages = [...names]
    .map((name) => [name, overlayPath(join(instanceDir, name, "index.md"))] as const)
    .filter(([, at]) => existsSync(at))
    .map(([name, at]) => [name, readFileSync(at, "utf8")] as const);
  return new Set(
    pages.flatMap(([instance, page]) =>
      [...page.matchAll(/<dt id="([^"]+)"/g)].map((m) => m[1]!).filter((id) => id.split("--", 1)[0] === instance),
    ),
  );
}

/**
 * Every class must name a glossary entry the page carries. No page at all is
 * "could not determine", said as a problem rather than passed.
 */
export function assertTerms(classes: readonly { id: string; term: string }[], anchors: Set<string> | null): string[] {
  if (!anchors) return [`could not determine: no glossary page at ${GLOSSARY_PAGE}`];
  return classes.filter((c) => !anchors.has(c.term)).map((c) => `${c.id}: no glossary entry ${c.term}`);
}

/** A class's glossary link from the SVG, which sits at `assets/img/uml/`. */
function termHref(term: string): string {
  return `../../../${termPageRoute(term)}#${term}`;
}

/**
 * The glossary links as a page line, because the SVG is shown as an `<img>`
 * and an image's own links are not clickable. Jekyll resolves the base.
 */
export function glossaryLinksMd(): string {
  const { classes } = build(null);
  const kept = classes.filter((c) => !STATE_CLASSES.has(c.id));
  return "**Definitions:** " + kept
    .map((c) => `[${c.title}]({{ '/${termPageRoute(c.term)}' | relative_url }}#${c.term})`)
    .join(" · ");
}

// ── PlantUML ──────────────────────────────────────────────────────────────

/** The five families, in drawing order. Their colours are `uml.css`'s. */
const PKG = ["scenario", "process", "state", "schema", "test"] as const;

function esc(s: string): string {
  return s.replace(/"/g, "'");
}

interface RenderOpts {
  name: string;
  title: string;
  pkgs: readonly (typeof PKG)[number][];
  /** Who writes the file, for its header. */
  writer: string;
}

const FULL: RenderOpts = {
  name: "harness-object-model",
  title: "Harness object model — attributes derived from JSON Schema",
  pkgs: PKG,
  writer: "cat-harness-tools/scripts/gen-object-model-uml.ts",
};

function render(classes: ClassDef[], edges: Edge[], opts: RenderOpts = FULL): string {
  const L: string[] = [
    `' GENERATED by ${opts.writer} — do not edit.`,
    "' Class attributes are derived from each model's JSON Schema; the",
    "' stereotype names which. Regenerate after changing any schema it reads.",
    `@startuml ${opts.name}`,
    "' ELK routes edges around class boxes; dot and smetana draw through them.",
    "!pragma layout elk",
    "skinparam nodesep 60",
    "skinparam ranksep 80",
    "!theme plain",
    "skinparam classAttributeIconSize 0",
    "skinparam shadowing false",
    "skinparam packageStyle rectangle",
    "skinparam stereotypeCBackgroundColor #FDFDFB",
    "hide empty methods",
    "",
    `title ${opts.title}`,
    "",
  ];
  for (const pkg of opts.pkgs) {
    L.push(`package ${pkg} {`);
    for (const c of classes.filter((x) => x.pkg === pkg)) {
      L.push(`  class "${c.title}" as ${c.id} <<${esc(c.source)}>> [[${termHref(c.term)}]] ${PALETTE.family[pkg] ?? ""} {`);
      for (const a of c.attrs) {
        // PlantUML reads a member with `(` as a method, as `enum(16)` would be.
        const line = `${a.name}${a.mult ? ` ${a.mult}` : ""} : ${esc(a.type)}`;
        L.push(`    ${line.includes("(") ? "{field} " : ""}${line}`);
      }
      L.push("  }");
    }
    L.push("}");
    L.push("");
  }
  for (const c of classes.filter((x) => x.note)) {
    L.push(`note bottom of ${c.id}`);
    L.push(...c.note!.split("\n").map((l) => `  ${l}`));
    L.push("end note");
  }
  L.push("");
  for (const e of edges) {
    const arrow = e.kind === "realises" ? "..|>" : e.via ? "..>" : "-->";
    const carried = e.via ? `«${e.via}»` : e.path === e.label ? undefined : e.path;
    const m = e.mult ? ` "${e.mult}"` : "";
    L.push(`${e.from} ${arrow}${m} ${e.to} : ${esc(e.label)}${carried ? `\\n${esc(carried)}` : ""}`);
  }
  L.push("");
  for (const pkg of opts.pkgs) if (pkg !== "schema") L.push(`${pkg} ..> schema : <<conformsTo>>`);
  L.push("@enduml");
  return L.join("\n") + "\n";
}

// ── The schemas view ──────────────────────────────────────────────────────

/** The classes the schemas view leaves out. */
const STATE_CLASSES = new Set(["Bean", "Todo"]);

/**
 * The object model WITHOUT the state package: Schema, Task, Role, User
 * Story, Process, Skill and Test, plus Actor, which User Story reaches Role
 * through. Owner, 2026-09-23: "i just want UML (with themes) showing schemas
 * of schema, task, role, user scenario, process, skill, task, test", and
 * then "your 7 plus Actor".
 *
 * Dropping Bean also drops the one class read from the beans CLI, so this
 * view is derivable anywhere and CAN be a CI gate, which the full model
 * cannot. `gen-uml-overview.ts` writes it and puts it at the top of the UML
 * overview page.
 */
export function schemasViewPuml(writer: string): string {
  const { classes, edges } = build(null);
  const kept = classes.filter((c) => !STATE_CLASSES.has(c.id));
  const keptEdges = edges.filter((e) => !STATE_CLASSES.has(e.from) && !STATE_CLASSES.has(e.to));
  const problems = [...assertEdges(kept, keptEdges), ...assertTerms(kept, glossaryAnchors())];
  if (problems.length) throw new Error("Relationships not carried by their schema, or classes without a definition:\n  " + problems.join("\n  "));
  return render(kept, keptEdges, {
    name: "harness-schemas",
    title: "Harness schemas — attributes derived from JSON Schema",
    pkgs: PKG.filter((p) => p !== "state"),
    writer,
  });
}

// ── main ──────────────────────────────────────────────────────────────────

// Guarded: an import must write nothing. `declared-directory-resolves.test.ts`
// imports every module that resolves a declared directory, and an unguarded
// run rewrote the generated files on import (in CI, where the output differs).
function main(): void {
  const check = process.argv.includes("--check");
  const beans = beanAttrs();
  const { classes, edges } = build(beans);
  const problems = [...assertEdges(classes, edges), ...assertTerms(classes, glossaryAnchors())];
  if (problems.length) {
    console.error("Relationships not carried by their schema, or classes without a definition:\n  " + problems.join("\n  "));
    process.exit(1);
  }
  const text = render(classes, edges);

  if (check) {
    if (!beans) {
      console.error("could not check: the beans CLI is not on PATH, so the Bean class cannot be derived");
      process.exit(2);
    }
    const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
    if (current !== text) {
      console.error(`${OUT} is stale — run: bun run cat-harness-tools/scripts/gen-object-model-uml.ts`);
      process.exit(1);
    }
    console.log("harness-object-model.puml is current");
  } else {
    writeFileSync(OUT, text);
    console.log(`wrote ${OUT} (${classes.length} classes, ${edges.length} relationships)`);
  }
}

if (import.meta.main) main();
