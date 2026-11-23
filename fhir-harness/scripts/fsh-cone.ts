#!/usr/bin/env bun
/**
 * Dependency cones over a FHIR Shorthand tank, at **source** level.
 *
 * The FSH analogue of `content-graph.ts`'s `cone()`: what does a
 * change to one artefact invalidate (its **forward** cone, the dependents), and
 * what is the smallest checkout that still compiles it (its **backward** cone,
 * the dependencies). Both questions drive the incremental IG build proposed in
 * `docs/proposals/ig-incremental-build.md` — the forward cone is what a rebuild
 * has to re-validate and re-render, the backward cone is the restricted
 * checkout SUSHI needs.
 *
 * ## Why source level
 *
 * SUSHI compiles a tank as one unit, and the publisher's own dependency
 * tracking (its experimental `-rapido` mode) is per *file* and lives inside the
 * publisher. Neither can be asked "what depends on X?" before a build runs. The
 * `.fsh` and `.cql` files can — and a restricted checkout has to be computed
 * before anything is compiled, so source level is the level that matters.
 *
 * ## Nodes and edges
 *
 * Every FSH entity (`Profile`, `Extension`, `Logical`, `Resource`, `ValueSet`,
 * `CodeSystem`, `Instance`, `Mapping`, `RuleSet`, `Invariant`) is a node keyed
 * by its declared name; its `Id:` and canonical URL (the `canonical:` of
 * `sushi-config.yaml` + `/<ResourceType>/<id>`) are registered as aliases so
 * URL-form references resolve, and `Alias: $x = url` lines are honoured. Each
 * CQL library under `input/cql` is a node too.
 *
 * Edge `u → v` means "u depends on v", from: `Parent:`, `InstanceOf:`,
 * `insert v`, `from v` (bindings and includes), `Canonical(v)`, `Reference(v)`,
 * `obeys v`, `codes from system v` / `valueset v`, canonical assignments
 * (`* library = …`, `* ^baseDefinition = …`, …), `$alias#code` code-system
 * use, CQL `include v`, and a `Library` instance whose `Id` matches a CQL
 * library's name (the cql-to-FHIR convention).
 *
 * `insert` is counted as a dependency on purpose: SUSHI expands a RuleSet at
 * compile time, so a RuleSet change does invalidate every user. References
 * into dependency packages are **not** edges — a change there is a toolchain
 * change and re-keys the whole cache rather than propagating along the graph.
 *
 * ## Reach of the numbers
 *
 * This is the authored dependency graph, not the publisher's. It does not see
 * rendering-time coupling (every page carries the menu and the TOC), which is
 * exactly why the proposal keeps the meta-index a separate step. Treat a cone
 * from here as the lower bound on what a rebuild must touch, never as proof
 * that nothing else changed.
 *
 * Usage:
 *   bun run fhir-harness/scripts/fsh-cone.ts <ig-root> [--top N] [--csv out.csv]
 *   bun run fhir-harness/scripts/fsh-cone.ts <ig-root> --changed input/fsh/a.fsh,input/cql/B.cql
 *   bun run fhir-harness/scripts/fsh-cone.ts <ig-root> --history 400
 *
 * `--changed` prints the forward cone of everything declared in those files
 * (what to rebuild) and the backward cone as files (what to check out).
 * `--history N` replays the graph over the last N commits of the IG's own git
 * history and reports what an incremental build would have rebuilt per commit.
 *
 * @module fhir-harness/scripts/fsh-cone
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve as resolvePath } from "node:path";

import { igReadScope, type IgReadScope } from "./ig-read-scope.ts";

export type FshKind =
  | "Profile"
  | "Extension"
  | "Logical"
  | "Resource"
  | "ValueSet"
  | "CodeSystem"
  | "Instance"
  | "Mapping"
  | "RuleSet"
  | "Invariant"
  | "CQL";

/** The FHIR resource type an FSH keyword's canonical URL is built from. */
const KIND_TO_TYPE: Partial<Record<FshKind, string>> = {
  Profile: "StructureDefinition",
  Extension: "StructureDefinition",
  Logical: "StructureDefinition",
  Resource: "StructureDefinition",
  ValueSet: "ValueSet",
  CodeSystem: "CodeSystem",
};

/**
 * Resource types an `Instance` is commonly a canonical of. An instance's
 * `InstanceOf:` (when it names a base type rather than a local profile) is added
 * to this list per instance, so `Canonical(x)` written as a URL resolves.
 */
const CANONICAL_INSTANCE_TYPES = [
  "PlanDefinition", "Library", "Measure", "Questionnaire", "ActivityDefinition",
  "ConceptMap", "StructureMap", "ValueSet", "CodeSystem", "ImplementationGuide",
  "CapabilityStatement", "OperationDefinition", "SearchParameter", "NamingSystem",
  "ExampleScenario", "Requirements", "ActorDefinition",
];

export interface FshNode {
  /** Declared name — the node key. */
  name: string;
  kind: FshKind;
  /** `Id:` for FSH entities; the library name for CQL. */
  id?: string;
  /** Path relative to the IG root. */
  file: string;
  /** Names of the nodes this one depends on. */
  deps: Set<string>;
}

export interface FshGraph {
  root: string;
  canonical: string;
  nodes: Map<string, FshNode>;
  /** Reverse adjacency: node → the nodes that depend on it. */
  dependents: Map<string, Set<string>>;
  /** How many edges each syntactic form contributed — a sanity check on the parser. */
  edgeKinds: Map<string, number>;
  fshFiles: number;
  cqlFiles: number;
  /**
   * Alias file → the files whose declarations USE one of its aliases by name.
   * An alias is not a node, so it has no edges; but a changed alias URL changes
   * every resource that writes it, including code uses (`$SCT#123`) that make
   * no dependency edge at all. `fileUsers` folds this in (review on #1708).
   */
  aliasUsers: Map<string, Set<string>>;
  /**
   * All parsed blocks, including those whose node was overwritten by a
   * later declaration with the same name but a different kind (e.g.,
   * `CodeSystem: Domains` overwritten by `ValueSet: Domains`). `fileResources`
   * needs these to produce a complete forward map.
   */
  allBlocks: Block[];
}

/** The files with `ext` under `rel` that `scope` declares; none when it reaches nothing there. */
function declaredUnder(scope: IgReadScope, rel: string, ext: string): string[] {
  if (!scope.reaches(rel)) return [];
  return walkDir(join(scope.root, rel), ext).filter((f) => scope.declares(relative(scope.root, f)));
}

function walkDir(dir: string, ext: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir).sort()) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walkDir(p, ext, out);
    else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}

// The name stops at `(` so a parameterised `RuleSet: Name(p1, p2)` is the node
// `Name` — which is what `insert Name(a, b)` refers to. The parameter list is
// captured separately, for the expansion described on {@link expandInsert}.
const DECL_RE = /^(Profile|Extension|Logical|Resource|ValueSet|CodeSystem|Instance|Mapping|RuleSet|Invariant):\s*([^\s(]+)(?:\s*\(([^)]*)\))?/;
const ALIAS_RE = /^Alias:\s*(\$?\S+)\s*=\s*(\S+)/;

export interface Block {
  node: FshNode;
  lines: string[];
  instanceOf?: string;
  /** Declared parameter names, for a `RuleSet: Name(a, b)`. */
  params: string[];
}

/** An `insert R(...)` call site: the RuleSet name and its positional arguments. */
const INSERT_CALL_RE = /^\s*\*?\s*insert\s+([A-Za-z0-9_-]+)\s*\(([\s\S]*)\)\s*$/;

/**
 * Split an `insert` argument list at TOP-LEVEL commas only.
 *
 * FSH arguments carry commas inside `[[…]]` multi-line strings, inside quoted
 * strings and inside nested parentheses, and a naive `split(",")` mis-aligns
 * every parameter after the first such argument — which substitutes the wrong
 * token into a canonical and invents an edge to a node that was never
 * referenced. A WRONG edge is worse here than a missing one: a missing edge
 * makes a rebuild too large, a wrong one makes it wrong.
 */
export function splitInsertArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let brackets = 0;
  let quoted = false;
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (s.startsWith("[[", i)) { brackets++; cur += "[["; i++; continue; }
    if (s.startsWith("]]", i)) { brackets--; cur += "]]"; i++; continue; }
    if (c === '"') quoted = !quoted;
    if (!quoted && brackets === 0) {
      if (c === "(") depth++;
      else if (c === ")") depth--;
      else if (c === "," && depth === 0) { out.push(cur.trim()); cur = ""; continue; }
    }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Strip an argument's `[[…]]` or `"…"` wrapper — the value is what substitutes. */
function unwrapArg(a: string): string {
  return a.replace(/^\[\[([\s\S]*)\]\]$/, "$1").replace(/^"([\s\S]*)"$/, "$1").trim();
}

/**
 * Substitute a RuleSet's positional arguments into its body — what SUSHI does
 * before the Publisher ever sees a resource.
 *
 * ## Why this is not optional
 *
 * Measured on an ingested IG (bean `f4gj`): every PlanDefinition and every
 * Measure writes its dependency on its logic Library **inside** a parameterised
 * RuleSet — `* library = Canonical({library}Logic)` in `PlanDefMain(library,
 * version)`, and a string-URL form in `MeasureProportionBasic` reached through
 * a second level. Read literally, the token is `{library}Logic`, which resolves
 * to nothing, so the edge was attributed to the RuleSet and 179 of the IG's 458
 * logic artefacts reached no logic artefact at all.
 *
 * ## What it does NOT do, and why that is stated rather than hidden
 *
 * This is positional `{param}` → argument substitution and nothing more. It is
 * **not** SUSHI. It does not evaluate soft indexing (`[+]`, `[=]`), does not
 * apply a RuleSet's own defaults, and does not know which of SUSHI's
 * context-sensitive rules would have applied. An edge it derives is therefore a
 * claim about the SOURCE, not about the compiled resource — the same standing
 * this whole module has, and the reason its header says a cone is a lower
 * bound.
 *
 * Expansion is depth-limited because a RuleSet may insert another (measured:
 * `MeasureProportion` → `MeasureProportionBasic`), and a cycle would otherwise
 * not terminate.
 */
function expandInsert(
  lines: string[],
  rulesets: Map<string, Block>,
  depth = 0,
): string[] {
  if (depth > MAX_INSERT_DEPTH) return [];
  const out: string[] = [];
  for (const line of lines) {
    const m = line.match(INSERT_CALL_RE);
    if (!m) continue;
    const rs = rulesets.get(m[1]);
    if (!rs || rs.params.length === 0) continue;
    const args = splitInsertArgs(m[2]).map(unwrapArg);
    const body = rs.lines.map((l) => {
      let r = l;
      rs.params.forEach((param, i) => {
        r = r.split(`{${param}}`).join(args[i] ?? "");
      });
      return r;
    });
    // A substituted line may itself be an `insert` with a forwarded parameter.
    out.push(...body, ...expandInsert(body, rulesets, depth + 1));
  }
  return out;
}

/** A RuleSet inserting a RuleSet is normal; a cycle is not. Measured max: 2. */
const MAX_INSERT_DEPTH = 6;

/**
 * Join an `insert` whose argument list runs over several lines into one.
 *
 * FSH allows a `[[…]]` argument to span lines, and an ingested IG uses it
 * heavily (bean `f4gj`) — `insert PlanDefCommunicationRequestAction([[…]], [[…]])` runs to a
 * dozen. Scanning such a call line-by-line sees an unbalanced fragment and
 * matches no parameters at all.
 */
function joinInsertCalls(lines: string[]): string[] {
  const out: string[] = [];
  let buf = "";
  for (const line of lines) {
    const t = buf ? `${buf} ${line.trim()}` : line;
    if (/\binsert\s+[A-Za-z0-9_-]+\s*\(/.test(t)) {
      const open = (t.match(/\(/g) ?? []).length;
      const close = (t.match(/\)/g) ?? []).length;
      if (open > close) { buf = t; continue; }
    }
    buf = "";
    out.push(t);
  }
  if (buf) out.push(buf);
  return out;
}

/** Build the graph from an IG root (the directory holding `sushi-config.yaml`). */
export function buildFshGraph(root: string): FshGraph {
  // Only what the repository's `contentTypes.ig.include` declares is read;
  // an IG that declares no section is read as before, with one warning.
  const scope = igReadScope(root);
  const cfgPath = join(root, "sushi-config.yaml");
  const cfg = scope.declares("sushi-config.yaml") && existsSync(cfgPath) ? readFileSync(cfgPath, "utf8") : "";
  const canonical = (cfg.match(/^canonical:\s*(\S+)/m)?.[1] ?? "").replace(/\/$/, "");

  const nodes = new Map<string, FshNode>();
  const alias = new Map<string, string>();
  const fshAliases = new Map<string, string>();
  const aliasFile = new Map<string, string>();
  const edgeKinds = new Map<string, number>();

  // Pass 1 — declarations and aliases.
  const fshFiles = declaredUnder(scope, "input/fsh", ".fsh");
  const blocks: Block[] = [];
  for (const file of fshFiles) {
    let current: Block | undefined;
    // Inside a `Title:` / `Description:` value that runs over several lines
    // (`"""…"""`). That value is prose, never a rule, and the edge patterns are
    // not anchored, so scanning it found rules in the words: measured on an
    // ingested IG (bean `c65n`), "ValueSet <NAME> for …" in a
    // ValueSet's Description matched `valueset NAME` and made the value set a
    // dependent of the PlanDefinition. Blanked rather than dropped, so a
    // block's line count is unchanged.
    let inMetaText = false;
    for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
      if (inMetaText) {
        if (raw.includes('"""')) inMetaText = false;
        if (current) current.lines.push("");
        continue;
      }
      const meta = raw.match(/^(?:Title|Description):\s*(.*)$/);
      if (meta && current) {
        const v = meta[1];
        inMetaText = v.startsWith('"""') && !v.slice(3).includes('"""');
        current.lines.push("");
        continue;
      }
      // Strip `//` comments — but only a `//` at line start or after whitespace,
      // or every `http://…` canonical on the line is cut to `http:`.
      const line = raw.replace(/(^|\s)\/\/.*$/, "$1");
      const a = line.match(ALIAS_RE);
      if (a) {
        fshAliases.set(a[1], a[2]);
        aliasFile.set(a[1], relative(root, file));
        continue;
      }
      const d = line.match(DECL_RE);
      if (d) {
        const node: FshNode = { name: d[2], kind: d[1] as FshKind, file: relative(root, file), deps: new Set() };
        nodes.set(node.name, node);
        current = { node, lines: [], params: (d[3] ?? "").split(",").map((x) => x.trim()).filter(Boolean) };
        blocks.push(current);
        continue;
      }
      if (!current) continue;
      current.lines.push(line);
      const idm = line.match(/^Id:\s*(\S+)/);
      if (idm) current.node.id = idm[1];
      const iom = line.match(/^InstanceOf:\s*(\S+)/);
      if (iom) current.instanceOf = iom[1];
    }
  }

  for (const { node, instanceOf } of blocks) {
    alias.set(node.name, node.name);
    if (!node.id) continue;
    alias.set(node.id, node.name);
    if (!canonical) continue;
    const type = KIND_TO_TYPE[node.kind];
    if (type) alias.set(`${canonical}/${type}/${node.id}`, node.name);
    if (node.kind === "Instance") {
      const types = new Set(CANONICAL_INSTANCE_TYPES);
      if (instanceOf && !nodes.has(instanceOf)) types.add(instanceOf);
      for (const t of types) alias.set(`${canonical}/${t}/${node.id}`, node.name);
    }
  }

  // CQL libraries.
  const cqlFiles = declaredUnder(scope, "input/cql", ".cql");
  const cqlByName = new Map<string, string>();
  for (const file of cqlFiles) {
    const text = readFileSync(file, "utf8");
    const lm = text.match(/^\s*library\s+"?([A-Za-z0-9_]+)"?/m);
    if (!lm) continue;
    const name = `cql:${lm[1]}`;
    const node: FshNode = { name, kind: "CQL", id: lm[1], file: relative(root, file), deps: new Set() };
    nodes.set(name, node);
    alias.set(name, name);
    cqlByName.set(lm[1], name);
    for (const inc of text.matchAll(/^\s*include\s+"?([A-Za-z0-9_]+)"?/gm)) {
      node.deps.add(`cql:${inc[1]}`);
      bump(edgeKinds, "cql include");
    }
  }
  // SUSHI defaults an Instance's id to its NAME when no `Id:` is declared, so
  // the id to match on is `node.id ?? node.name`. Guarding on `node.id` alone
  // made this whole edge kind dead on the IG it was written for: measured on
  // an ingested IG 2026-09-23 (bean `f4gj`), ALL 279 Library instances
  // omit `Id:` and ALL 279 names match a CQL library, so the edge fired 0
  // times and was absent from `edgeKinds` entirely. Every Library's only
  // dependency was the shared `LogicLibrary` RuleSet it inserts — one target
  // for 279 artefacts, which cannot distinguish any of them.
  for (const node of nodes.values()) {
    const instanceId = node.id ?? node.name;
    if (node.kind === "Instance" && cqlByName.has(instanceId)) {
      node.deps.add(cqlByName.get(instanceId)!);
      bump(edgeKinds, "Library ↔ cql (by name)");
    }
  }
  // A CQL `include` of a library that has no file is an external library; drop it.
  for (const node of nodes.values()) {
    for (const d of [...node.deps]) if (!nodes.has(d)) node.deps.delete(d);
  }

  const resolveRef = (token: string): string | undefined => {
    let t = token.trim().replace(/^"|"$/g, "").split("|")[0];
    if (fshAliases.has(t)) t = fshAliases.get(t)!;
    if (alias.has(t)) return alias.get(t);
    const m = t.match(/([A-Z][A-Za-z]+)\/([A-Za-z0-9.\-]+)$/);
    if (m && alias.has(m[2])) return alias.get(m[2]);
    return undefined;
  };
  const addDep = (node: FshNode, token: string, kind: string): void => {
    const target = resolveRef(token);
    if (target && target !== node.name) {
      node.deps.add(target);
      bump(edgeKinds, kind);
    }
  };

  // Pass 2 — edges. Every pattern captures the referenced token as `ref`.
  const NAME = String.raw`(?<ref>\$?[A-Za-z0-9_\-.:/]+)`;
  // `* action[0].definitionCanonical = …`, `* ^baseDefinition = …`, `* library = …`:
  // any element path ending in a canonical-valued property, assigned a URL, a
  // name or a `Canonical()` (the latter is also caught by its own pattern).
  const CANONICAL_PROPS = "baseDefinition|library|url|definitionCanonical|instantiatesCanonical|instantiatesUri|resource|profile|targetProfile|valueSet|answerValueSet|source|target|sourceCanonical|targetCanonical|derivedFrom|supplements";
  const patterns: Array<[RegExp, string]> = [
    [/^Parent:\s*(?<ref>\S+)/g, "Parent"],
    [/^InstanceOf:\s*(?<ref>\S+)/g, "InstanceOf"],
    [/\binsert\s+(?<ref>[A-Za-z0-9_\-]+)/g, "insert"],
    [new RegExp(String.raw`\bfrom\s+${NAME}`, "g"), "from (binding / include)"],
    [/\bCanonical\(\s*(?<ref>[^)|]+)(?:\|[^)]*)?\)/g, "Canonical()"],
    [new RegExp(String.raw`\bsystem\s+${NAME}`, "g"), "codes from system"],
    [new RegExp(String.raw`\bvalueset\s+${NAME}`, "gi"), "codes from valueset"],
    [new RegExp(String.raw`^\*\s*(?:[A-Za-z0-9_\-+\[\]=.^ ]*?[.\^\s])?(?:${CANONICAL_PROPS})\s*=\s*"?(?<ref>[^"\s()]+)"?`, "g"), "canonical assignment"],
    [/(?<ref>\$[A-Za-z0-9_\-]+)#/g, "code system ($alias#code)"],
  ];
  const scanLine = (node: FshNode, line: string, insertKind?: string): void => {
    for (const [re, kind] of patterns) {
      // The `insert` pattern names the RuleSet itself. Inside an EXPANDED body
      // that edge belongs to whoever inserted it and has already been recorded
      // at the call site, so re-recording it here would attribute a RuleSet's
      // own `insert` to the artefact and inflate `edgeKinds`.
      if (insertKind && kind === "insert") continue;
      for (const m of line.matchAll(re)) {
        const ref = m.groups?.ref;
        if (ref) addDep(node, ref, insertKind ?? kind);
      }
    }
    for (const m of line.matchAll(/\bReference\(\s*([^)]+)\)/g)) {
      for (const part of m[1].split(/\s+or\s+/)) addDep(node, part, insertKind ?? "Reference()");
    }
    for (const m of line.matchAll(/\bobeys\s+([A-Za-z0-9_\-]+(?:\s*,\s*[A-Za-z0-9_\-]+)*)/g)) {
      for (const inv of m[1].split(/\s*,\s*/)) addDep(node, inv, insertKind ?? "obeys");
    }
  };

  const rulesets = new Map(blocks.filter((b) => b.node.kind === "RuleSet").map((b) => [b.node.name, b]));
  for (const { node, lines } of blocks) {
    const joined = joinInsertCalls(lines);
    for (const line of joined) scanLine(node, line);
    // ...then again over the RuleSet bodies this block inserts, with the call's
    // arguments substituted. Edges found there are the INSERTING artefact's:
    // SUSHI expands a RuleSet into its user at compile time, so a canonical
    // written `Canonical({library}Logic)` is that artefact's dependency, not
    // the RuleSet's. Tagged separately so the two can always be told apart.
    for (const line of expandInsert(joined, rulesets)) {
      scanLine(node, line, "insert (parameter expanded)");
    }
  }

  const dependents = new Map<string, Set<string>>();
  for (const node of nodes.values()) {
    for (const d of node.deps) {
      if (!dependents.has(d)) dependents.set(d, new Set());
      dependents.get(d)!.add(node.name);
    }
  }
  // Alias use, by name, in any declaration's body. Matched as a whole token so
  // `$SCT` does not match `$SCTX`; aliases need not start with `$`.
  const aliasUsers = new Map<string, Set<string>>();
  const escape = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const aliasRes = [...aliasFile.keys()].map((n) => [n, new RegExp(`(^|[^A-Za-z0-9_$-])${escape(n)}(?![A-Za-z0-9_-])`)] as const);
  for (const b of blocks) {
    for (const [name, re] of aliasRes) {
      const declaredIn = aliasFile.get(name)!;
      if (declaredIn === b.node.file) continue;
      if (b.lines.some((l) => re.test(l))) {
        if (!aliasUsers.has(declaredIn)) aliasUsers.set(declaredIn, new Set());
        aliasUsers.get(declaredIn)!.add(b.node.file);
      }
    }
  }
  return { root, canonical, nodes, dependents, edgeKinds, fshFiles: fshFiles.length, cqlFiles: cqlFiles.length, aliasUsers, allBlocks: blocks };
}

function bump(m: Map<string, number>, k: string): void {
  m.set(k, (m.get(k) ?? 0) + 1);
}

function closure(start: Iterable<string>, next: (n: string) => Iterable<string>): Set<string> {
  const seen = new Set<string>();
  const stack = [...start];
  const roots = new Set(stack);
  while (stack.length) {
    const x = stack.pop()!;
    for (const y of next(x)) {
      if (!seen.has(y)) {
        seen.add(y);
        stack.push(y);
      }
    }
  }
  for (const r of roots) seen.delete(r);
  return seen;
}

/** Transitive dependents of `names` — what a change to them invalidates. Excludes the roots. */
export function forwardCone(g: FshGraph, names: string | Iterable<string>): Set<string> {
  const start = typeof names === "string" ? [names] : names;
  return closure(start, (n) => g.dependents.get(n) ?? []);
}

/** Transitive dependencies of `names` — the restricted checkout. Excludes the roots. */
export function backwardCone(g: FshGraph, names: string | Iterable<string>): Set<string> {
  const start = typeof names === "string" ? [names] : names;
  return closure(start, (n) => g.nodes.get(n)?.deps ?? []);
}

/** The source files (relative to the root) that declare `names`. */
export function filesOf(g: FshGraph, names: Iterable<string>): Set<string> {
  const files = new Set<string>();
  for (const n of names) {
    const node = g.nodes.get(n);
    if (node) files.add(node.file);
  }
  return files;
}

/** Nodes declared in the given files (paths relative to the root, or absolute). */
export function nodesInFiles(g: FshGraph, files: Iterable<string>): Set<string> {
  const rel = new Set([...files].map((f) => (f.startsWith("/") ? relative(g.root, f) : f)));
  const out = new Set<string>();
  for (const node of g.nodes.values()) if (rel.has(node.file)) out.add(node.name);
  return out;
}

/**
 * File-level users: for each source file, the OTHER files declaring a node
 * that depends directly on a node the file declares, or that USES an alias the
 * file declares (aliases are not nodes; see `FshGraph.aliasUsers`). Written as
 * `fsh-file-users/v1` for the IG AST's incremental plan (`ast-export`'s
 * `AstPlanCli -fsh-users`), which cannot otherwise tell what a changed
 * RuleSet- or Alias-only file reaches: such a file declares no resource,
 * so the AST holds nothing for it (bean `a9tx`).
 *
 * Direct users only. The plan follows users of users itself, and the AST's
 * own dependency edges carry the cone from there.
 */
export function fileUsers(g: FshGraph): Record<string, string[]> {
  const out = new Map<string, Set<string>>();
  for (const node of g.nodes.values()) {
    for (const d of g.dependents.get(node.name) ?? []) {
      const user = g.nodes.get(d)?.file;
      if (!user || user === node.file) continue;
      if (!out.has(node.file)) out.set(node.file, new Set());
      out.get(node.file)!.add(user);
    }
  }
  for (const [file, users] of g.aliasUsers) {
    if (!out.has(file)) out.set(file, new Set());
    for (const u of users) out.get(file)!.add(u);
  }
  return Object.fromEntries([...out].sort(([a], [b]) => a.localeCompare(b)).map(([f, us]) => [f, [...us].sort()]));
}

/**
 * File-level resource declarations: for each source file, the FHIR resource
 * keys (`<canonical>` or `<Type>/<id>`) the file produces. This is the FORWARD
 * map that `fileUsers` does not supply — `fileUsers` tells you who depends on a
 * file, this tells you what the file itself produces.
 *
 * `AstPlanCli` needs this to map a changed FSH file to the AST resources it
 * must rebuild. Without it, a file that declares a resource but has no
 * dependents triggers a full-build fallback — the planner knows the file
 * changed but cannot tell WHICH resource was affected (bean `a9tx`, measured
 * 2026-10-01 on an ingested IG: a one-resource `.fsh` file → full build).
 *
 * Emitted alongside `fsh-file-users/v1` as `fsh-file-resources/v1`.
 */
export function fileResources(g: FshGraph): Record<string, string[]> {
  const out = new Map<string, string[]>();
  for (const block of g.allBlocks) {
    const node = block.node;
    // RuleSets, Invariants, Mappings, and CQL libraries are not FHIR resources
    const rt = KIND_TO_TYPE[node.kind];
    if (!rt && node.kind !== "Instance") continue;
    // Build the resource key: canonical URL or Instance/id
    const id = node.id ?? node.name;
    let key: string;
    if (rt) {
      // Conformance resource: canonical URL
      key = `${g.canonical}/${rt}/${id}`;
    } else {
      // Instance: Type/id
      key = `Instance/${id}`;
    }
    if (!out.has(node.file)) out.set(node.file, []);
    out.get(node.file)!.push(key);
  }
  return Object.fromEntries([...out].sort(([a], [b]) => a.localeCompare(b)).map(([f, rs]) => [f, rs.sort()]));
}

export interface ConeSizes {
  forward: Map<string, number>;
  backward: Map<string, number>;
  /** Backward cone measured in source files, the node's own file included. */
  backwardFiles: Map<string, number>;
}

export function coneSizes(g: FshGraph): ConeSizes {
  const forward = new Map<string, number>();
  const backward = new Map<string, number>();
  const backwardFiles = new Map<string, number>();
  for (const node of g.nodes.values()) {
    forward.set(node.name, forwardCone(g, node.name).size);
    const b = backwardCone(g, node.name);
    backward.set(node.name, b.size);
    backwardFiles.set(node.name, filesOf(g, [node.name, ...b]).size);
  }
  return { forward, backward, backwardFiles };
}

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

/** The human-readable report the proposal's §3.3 tables were taken from. */
export function report(g: FshGraph, top = 15): string {
  const sizes = coneSizes(g);
  const N = g.nodes.size;
  const sortedVals = (m: Map<string, number>) => [...m.values()].sort((a, b) => a - b);
  const fs = sortedVals(sizes.forward);
  const bs = sortedVals(sizes.backward);
  const bf = sortedVals(sizes.backwardFiles);
  const totalFiles = new Set([...g.nodes.values()].map((n) => n.file)).size;
  const totalEdges = [...g.nodes.values()].reduce((a, n) => a + n.deps.size, 0);
  const byKind = new Map<string, number>();
  for (const n of g.nodes.values()) bump(byKind, n.kind);
  const q = quantile;
  const pad = (v: number, w = 5) => String(v).padStart(w);
  const lines: string[] = [];
  lines.push(`IG: ${g.canonical || "(no canonical in sushi-config.yaml)"}`);
  lines.push(`nodes: ${N} in ${totalFiles} source files (${g.fshFiles} .fsh, ${g.cqlFiles} .cql)  internal edges: ${totalEdges}`);
  lines.push(`by kind: ${[...byKind.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t}=${n}`).join(" ")}`);
  lines.push("");
  lines.push(`FORWARD cone (dependents — what a change invalidates), over ${N} nodes:`);
  lines.push(`  zero-dependents: ${fs.filter((x) => x === 0).length}  median ${q(fs, 0.5)}  p75 ${q(fs, 0.75)}  p90 ${q(fs, 0.9)}  p99 ${q(fs, 0.99)}  max ${fs[fs.length - 1] ?? 0}`);
  lines.push("BACKWARD cone (dependencies — the restricted checkout to rebuild it):");
  lines.push(`  zero-deps: ${bs.filter((x) => x === 0).length}  median ${q(bs, 0.5)}  p75 ${q(bs, 0.75)}  p90 ${q(bs, 0.9)}  p99 ${q(bs, 0.99)}  max ${bs[bs.length - 1] ?? 0}`);
  lines.push(`  as source FILES (incl. own): median ${q(bf, 0.5)}  p90 ${q(bf, 0.9)}  max ${bf[bf.length - 1] ?? 0}  of ${totalFiles}`);
  lines.push("");
  lines.push(`Top ${top} by forward cone (a change here rebuilds the most):`);
  for (const [k, n] of [...sizes.forward.entries()].sort((a, b) => b[1] - a[1]).slice(0, top)) {
    const node = g.nodes.get(k)!;
    lines.push(`  ${pad(n)}  ${node.kind.padEnd(10)} ${k}  (${node.file})`);
  }
  lines.push("");
  lines.push(`Top ${top} by backward cone (needs the most to rebuild):`);
  for (const [k, n] of [...sizes.backward.entries()].sort((a, b) => b[1] - a[1]).slice(0, top)) {
    const node = g.nodes.get(k)!;
    lines.push(`  ${pad(n)}  ${node.kind.padEnd(10)} ${k}  files=${sizes.backwardFiles.get(k)}`);
  }
  lines.push("");
  lines.push("Edge kinds:");
  for (const [k, n] of [...g.edgeKinds.entries()].sort((a, b) => b[1] - a[1])) lines.push(`  ${pad(n)}  ${k}`);
  lines.push("");
  lines.push("Forward cone by kind (median / p90 / max):");
  const byKindSizes = new Map<string, number[]>();
  for (const n of g.nodes.values()) {
    if (!byKindSizes.has(n.kind)) byKindSizes.set(n.kind, []);
    byKindSizes.get(n.kind)!.push(sizes.forward.get(n.name)!);
  }
  for (const [t, arr] of [...byKindSizes.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const s = arr.sort((a, b) => a - b);
    lines.push(`  ${t.padEnd(12)} n=${pad(s.length, 4)}  median ${pad(q(s, 0.5), 4)}  p90 ${pad(q(s, 0.9), 4)}  max ${pad(s[s.length - 1], 4)}`);
  }
  return lines.join("\n");
}

/** CSV of every node with its cone sizes, for spreadsheets and diffs between commits. */
export function toCsv(g: FshGraph): string {
  const sizes = coneSizes(g);
  const rows = [...g.nodes.values()].map(
    (n) => `${n.name},${n.kind},${n.file},${sizes.forward.get(n.name)},${sizes.backward.get(n.name)},${sizes.backwardFiles.get(n.name)}`,
  );
  return "name,kind,file,forward,backward,backward_files\n" + rows.join("\n") + "\n";
}

/** What a set of changed files means for a rebuild: the nodes, what they invalidate, what to check out. */
export function changeImpact(g: FshGraph, changedFiles: Iterable<string>) {
  const changed = nodesInFiles(g, changedFiles);
  const rebuild = new Set([...changed, ...forwardCone(g, changed)]);
  const checkout = filesOf(g, [...rebuild, ...backwardCone(g, rebuild)]);
  return { changed, rebuild, checkout };
}

export interface CommitImpact {
  sha: string;
  date: string;
  /** Files the commit touched under `input/fsh` or `input/cql`. */
  sourceFiles: number;
  /** Nodes those files declare — at the graph's HEAD, not at the commit. */
  changed: number;
  rebuild: number;
  checkout: number;
}

/**
 * Replay the graph over the IG's own history: for each of the last `maxCount`
 * commits that touches `input/fsh` or `input/cql`, what would an incremental
 * build have rebuilt?
 *
 * The graph is the one at HEAD, applied to each commit's changed-file list. A
 * file renamed or deleted since declares nothing at HEAD and scores zero; the
 * report keeps those commits separate rather than averaging them in. Commits
 * without a reachable parent (the root, or the boundary of a shallow clone) are
 * skipped, as are commits that touch no source file.
 */
export function historyImpact(g: FshGraph, maxCount = 400): CommitImpact[] {
  const git = (...args: string[]): string =>
    execFileSync("git", args, { cwd: g.root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  const shas = git("rev-list", `--max-count=${maxCount}`, "HEAD").split("\n").filter(Boolean);
  const rows: CommitImpact[] = [];
  for (const sha of shas) {
    let names: string;
    try {
      names = git("diff-tree", "--no-commit-id", "-r", "--name-only", `${sha}^`, sha);
    } catch {
      continue;
    }
    const src = names.split("\n").filter((f) => /^input\/(fsh|cql)\//.test(f));
    if (src.length === 0) continue;
    const impact = changeImpact(g, src);
    rows.push({
      sha: sha.slice(0, 8),
      date: git("show", "-s", "--format=%ad", "--date=short", sha),
      sourceFiles: src.length,
      changed: impact.changed.size,
      rebuild: impact.rebuild.size,
      checkout: impact.checkout.size,
    });
  }
  return rows;
}

/** The per-commit summary behind the proposal's §3.5. */
export function historyReport(g: FshGraph, rows: CommitImpact[], inspected?: number): string {
  const N = g.nodes.size;
  const files = new Set([...g.nodes.values()].map((n) => n.file)).size;
  const q = quantile;
  const all = rows.map((r) => r.rebuild).sort((a, b) => a - b);
  const resolving = rows.filter((r) => r.rebuild > 0);
  const nz = resolving.map((r) => r.rebuild).sort((a, b) => a - b);
  const co = rows.map((r) => r.checkout).sort((a, b) => a - b);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const pct = (x: number) => (N ? ((100 * x) / N).toFixed(1) : "0.0");
  const lines: string[] = [];
  lines.push(`commits touching input/fsh or input/cql: ${rows.length}${inspected !== undefined ? ` of ${inspected} inspected` : ""}  (graph = HEAD, applied to each commit's changed files)`);
  if (rows.length) {
    lines.push(`window: ${rows[rows.length - 1].date} .. ${rows[0].date}`);
    lines.push(`rebuild per commit (nodes, incl. changed): median ${q(all, 0.5)}  p75 ${q(all, 0.75)}  p90 ${q(all, 0.9)}  max ${all[all.length - 1]}  of ${N}`);
    lines.push(`  mean ${mean(all).toFixed(1)} nodes = ${pct(mean(all))} % of the IG per commit`);
    lines.push(`zero-rebuild commits (files that declare nothing at HEAD — renamed or deleted since): ${rows.length - resolving.length}`);
    if (nz.length) {
      lines.push(`excluding them (${nz.length}): median ${q(nz, 0.5)}  p75 ${q(nz, 0.75)}  p90 ${q(nz, 0.9)}  max ${nz[nz.length - 1]}  mean ${mean(nz).toFixed(1)} = ${pct(mean(nz))} %`);
      lines.push(`  <= 10 nodes: ${nz.filter((x) => x <= 10).length}   <= 50: ${nz.filter((x) => x <= 50).length}   > 200: ${nz.filter((x) => x > 200).length}`);
    }
    lines.push(`checkout per commit (files): median ${q(co, 0.5)}  p90 ${q(co, 0.9)}  max ${co[co.length - 1]}  of ${files}`);
    lines.push("");
    lines.push("largest by rebuild cone:");
    for (const r of [...rows].sort((a, b) => b.rebuild - a.rebuild).slice(0, 8)) {
      lines.push(`  ${r.sha} ${r.date}  source-files=${String(r.sourceFiles).padStart(3)}  changed=${String(r.changed).padStart(3)}  rebuild=${String(r.rebuild).padStart(4)}  checkout=${String(r.checkout).padStart(4)}`);
    }
  }
  return lines.join("\n");
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const root = args.find((a) => !a.startsWith("--"));
  if (!root) {
    console.error("usage: bun run fhir-harness/scripts/fsh-cone.ts <ig-root> [--top N] [--csv out.csv] [--changed f1,f2,…] [--file-users out.json] [--file-resources out.json]");
    process.exit(2);
  }
  const opt = (name: string): string | undefined => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const g = buildFshGraph(resolvePath(root));
  const changed = opt("--changed");
  const history = opt("--history");
  if (history) {
    const n = Number(history);
    console.log(historyReport(g, historyImpact(g, n), n));
  } else if (changed) {
    const impact = changeImpact(g, changed.split(","));
    console.log(`changed nodes (${impact.changed.size}): ${[...impact.changed].sort().join(", ") || "(none declared in those files)"}`);
    console.log(`rebuild — forward cone incl. changed (${impact.rebuild.size}):`);
    for (const n of [...impact.rebuild].sort()) console.log(`  ${g.nodes.get(n)!.kind.padEnd(10)} ${n}`);
    console.log(`checkout — files needed to compile them (${impact.checkout.size}):`);
    for (const f of [...impact.checkout].sort()) console.log(`  ${f}`);
  } else {
    console.log(report(g, Number(opt("--top") ?? 15)));
  }
  const csv = opt("--csv");
  if (csv) {
    writeFileSync(csv, toCsv(g));
    console.log(`\nwrote ${csv}`);
  }
  const fu = opt("--file-users");
  if (fu) {
    writeFileSync(fu, JSON.stringify({ $schema: "fsh-file-users/v1", root: g.root, users: fileUsers(g) }, null, 2) + "\n");
    console.log(`\nwrote ${fu}`);
  }
  const fr = opt("--file-resources");
  if (fr) {
    writeFileSync(fr, JSON.stringify({ $schema: "fsh-file-resources/v1", root: g.root, resources: fileResources(g) }, null, 2) + "\n");
    console.log(`\nwrote ${fr}`);
  }
}
