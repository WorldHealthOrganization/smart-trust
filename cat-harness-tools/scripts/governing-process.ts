/**
 * Resolve a directory's DECLARED governing process to the diagram that draws it.
 *
 * A directory names its process in `coverage.process`
 * ({@link SubgraphCoverageSchema}); this module turns that name into the
 * `.bpmn` source, the rendered SVG, and the call activities the diagram hands
 * off to. `subgraph-readmes` passes the result to the Liquid template, and
 * `check-subgraph-coverage` uses the same resolution so the page and the axis
 * cannot disagree about whether a declaration points at anything.
 *
 * ## It resolves a NAME, never a path
 *
 * `coverage.visualiser` and `coverage.serialisations` hold repository-relative
 * PATHS. This holds a diagram's basename: `workflowDirs` finds every
 * layer's `processes/` from its declaration, and `render-bpmn` names its
 * output after the basename.
 *
 * ## Three states
 *
 * - **not declared** — the caller never asks; a directory owes no process.
 * - **declared, no diagram of that name** — `undetermined`, with a reason.
 * - **declared, diagram found, no rendered SVG** — still `undetermined`, with
 *   a different reason, so a missing render never looks like a directory that
 *   declared nothing.
 *
 * @module scripts/governing-process
 * @covers cat-harness
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

import {
  findInstanceRoot,
  layerRootsIn,
  siteDirFor,
} from "../schemas/kg/cat-harness.js";
import { workflowFiles } from "./known-skills.js";
import { GLOBAL_TASK_ELEMENT, isGlobalTasksFile } from "../src/workflow/process-model.js";

/** One call activity the high-level diagram hands off to. */
export interface SubProcess {
  /** The `callActivity`'s id, as the diagram spells it. */
  id: string;
  /** Its name, whitespace collapsed — BPMN labels carry hard line breaks. */
  name: string;
  /** The skill its `<bootstrap.processes:skill ref>` names, when it carries one. */
  skill?: string;
  /** The called process id (`calledElement`). */
  calls: string;
  /** The called diagram, repository-relative; absent when nothing declares that process. */
  bpmn?: string;
  /** Its rendered SVG, repository-relative; absent when it has not been rendered. */
  svg?: string;
}

/** A declared process, resolved as far as the corpus allows. */
export interface GoverningProcess {
  /** The name as DECLARED, echoed back whatever else resolved. */
  name: string;
  /** The `<bpmn:process name>`, when the diagram was found. */
  title?: string;
  /** The diagram, repository-relative. */
  bpmn?: string;
  /** The rendered SVG, repository-relative. */
  svg?: string;
  /**
   * How the process STARTS — the names of its start events, and whether the
   * first element is an event rather than a task.
   *
   * Read from the element TYPE, not from the label. It is what lets a page
   * state the diagram's boundary — everything before the event is outside it —
   * without any consumer reading the event's prose and guessing.
   */
  startEvents: string[];
  /** The call activities, in document order. */
  subprocesses: SubProcess[];
  /** Why nothing, or not all, of the above resolved. Absent when it all did. */
  undetermined?: string;
}

interface Diagram {
  /** Absolute path to the `.bpmn`. */
  file: string;
  /** Process ids it defines. */
  processIds: string[];
}

/** Every `.bpmn` in the repository, keyed by basename and by process id. */
export interface ProcessIndex {
  byName: Map<string, Diagram>;
  byProcessId: Map<string, Diagram>;
  repoRoot: string;
  /** The site `workflows/` directories a render could have written into. */
  svgDirs: string[];
  /**
   * Every global task id any layer declares. A call to one is a step the
   * layer shares, not a sub-process, so it is left out of `subprocesses`.
   */
  globalTaskIds?: Set<string>;
}

/**
 * Build the index once per run.
 *
 * Every layer in the repository, not this one — `render-bpmn` renders every
 * layer's diagrams into one output directory (bean `oqdr`), so a resolver
 * that looked at one layer would report a diagram as missing that is drawn
 * on the site.
 */
export function processIndex(repoRoot: string): ProcessIndex {
  const byName = new Map<string, Diagram>();
  const byProcessId = new Map<string, Diagram>();
  const svgDirs: string[] = [];
  const globalTaskIds = new Set<string>();
  for (const inst of layerRootsIn(repoRoot)) {
    let site: string | undefined;
    try {
      site = siteDirFor(inst);
    } catch {
      site = undefined; // an unreadable declaration is readDeclaration's finding, not this one
    }
    // declared-path-literal: `render-bpmn`'s own output path within a site
    // root, which it composes the same way. The site root itself is declared.
    if (site !== undefined) svgDirs.push(join(inst, site, "assets/img/workflows"));
    for (const file of workflowFiles(inst)) {
      if (!file.endsWith(".bpmn")) continue;
      const xml = readFileSync(file, "utf-8");
      for (const g of xml.matchAll(new RegExp(GLOBAL_TASK_ELEMENT.source, "g"))) globalTaskIds.add(g[1]!);
      if (isGlobalTasksFile(xml)) continue;
      const name = basename(file, ".bpmn");
      if (byName.has(name)) continue; // render-bpmn refuses a clash outright; here the first wins
      const processIds = [...xml.matchAll(/<bpmn:process\s+id="([^"]+)"/g)].map((m) => m[1]!);
      const d: Diagram = { file, processIds };
      byName.set(name, d);
      for (const id of processIds) if (!byProcessId.has(id)) byProcessId.set(id, d);
    }
  }
  return { byName, byProcessId, repoRoot, svgDirs, globalTaskIds };
}

/**
 * Where a diagram's rendered SVG is, or `undefined`.
 *
 * Two places a render can land, in the order `render-bpmn` writes them: beside
 * the source (only for a layer exempt from `workflow-visualiser`, which
 * has no site of its own), and in a site's `assets/img/workflows/`. The
 * owning layer's site is tried first so a diagram is attributed to its own
 * layer where both hold one.
 */
export function renderedSvg(idx: ProcessIndex, file: string): string | undefined {
  const name = basename(file, ".bpmn");
  const beside = join(dirname(file), `${name}.svg`);
  const own = findInstanceRoot(dirname(file));
  const ordered = [
    beside,
    ...idx.svgDirs
      .slice()
      .sort((a, b) => Number(own !== undefined && b.startsWith(own)) - Number(own !== undefined && a.startsWith(own)))
      .map((d) => join(d, `${name}.svg`)),
  ];
  return ordered.find((p) => existsSync(p));
}

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Unescape an attribute value: the five named XML entities, and numeric
 * character references.
 *
 * The numeric ones are not a nicety. A BPMN label's line breaks are written
 * as literal newlines by bpmn.io and as `&#10;` by other editors, and a
 * reader of the second spelling would see `First step&#10;[skill]` printed
 * into a markdown table cell.
 */
const unxml = (s: string) =>
  s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

const attr = (tag: string, name: string): string | undefined => {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? unxml(m[1]!) : undefined;
};

/**
 * Resolve one declared process name against the index.
 *
 * Never throws and never returns `undefined` for a declared name: a caller
 * that asked has a declaration to account for, and handing it nothing would
 * let the answer "we could not tell" be printed as "there is none".
 */
export function resolveProcess(idx: ProcessIndex, name: string): GoverningProcess {
  const rel = (p: string) => relative(idx.repoRoot, p).split("\\").join("/");
  const d = idx.byName.get(name);
  if (d === undefined) {
    return {
      name,
      startEvents: [],
      subprocesses: [],
      undetermined:
        `no diagram named \`${name}.bpmn\` is declared by any instance in this repository, ` +
        `so the process it names could not be found`,
    };
  }
  const xml = readFileSync(d.file, "utf-8");
  const title = attr(/<bpmn:process\b[^>]*>/.exec(xml)?.[0] ?? "", "name");
  const startEvents = [...xml.matchAll(/<bpmn:startEvent\b([^>]*)>/g)]
    .map((m) => attr(m[1]!, "name"))
    .filter((x): x is string => x !== undefined)
    .map(collapse);

  const subprocesses: SubProcess[] = [];
  // Each `callActivity` with its own element body, so the `<…:skill ref>`
  // inside is read from THIS activity rather than from the next one in the
  // file — and the SELF-CLOSING spelling is handled, which a single
  // `<a>…</a>` pattern would have skipped silently. Every call activity in
  // this repository carries children today; a diagram authored in another
  // tool need not, and a step dropped from the table looks exactly like a
  // step the diagram does not have.
  const open = /<bpmn:callActivity\b([^>]*?)(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = open.exec(xml)) !== null) {
    const head = m[1]!;
    let body = "";
    if (m[2] !== "/") {
      const close = xml.indexOf("</bpmn:callActivity>", open.lastIndex);
      body = close === -1 ? "" : xml.slice(open.lastIndex, close);
    }
    const id = attr(head, "id");
    const calls = attr(head, "calledElement");
    if (id === undefined || calls === undefined) continue;
    const called = idx.byProcessId.get(calls);
    if (called === undefined && idx.globalTaskIds?.has(calls)) continue;
    const skill = /:skill\s+ref="([^"]+)"/.exec(body)?.[1];
    const svg = called ? renderedSvg(idx, called.file) : undefined;
    subprocesses.push({
      id,
      name: collapse(attr(head, "name") ?? id),
      ...(skill !== undefined ? { skill } : {}),
      calls,
      ...(called !== undefined ? { bpmn: rel(called.file) } : {}),
      ...(svg !== undefined ? { svg: rel(svg) } : {}),
    });
  }

  const svg = renderedSvg(idx, d.file);
  return {
    name,
    ...(title !== undefined ? { title } : {}),
    bpmn: rel(d.file),
    ...(svg !== undefined ? { svg: rel(svg) } : {}),
    startEvents,
    subprocesses,
    ...(svg === undefined
      ? {
          undetermined:
            `\`${rel(d.file)}\` is declared but its rendered SVG is not in this checkout, ` +
            `so the diagram cannot be shown — run \`bun run cat render:bpmn\``,
        }
      : {}),
  };
}

/**
 * The template's view of a resolved process: every path rewritten relative to
 * the directory whose README will hold it, so the links work on GitHub and on
 * the site without a consumer composing anything.
 */
export function forDirectory(p: GoverningProcess, repoRoot: string, dirAbs: string) {
  const from = (r: string | undefined) =>
    r === undefined ? "" : relative(resolve(dirAbs), resolve(repoRoot, r)).split("\\").join("/");
  // A subprocess row is a markdown TABLE cell, and a BPMN label may hold a
  // pipe. `subgraph-readmes` escapes its own file rows the same way; doing it
  // here rather than in the template keeps the one rule in one place, and a
  // template has no filter for it.
  const cell = (t: string) => t.replace(/[\\|]/g, "\\$&");
  return {
    name: p.name,
    title: p.title ?? "",
    bpmn: from(p.bpmn),
    svg: from(p.svg),
    startEvents: p.startEvents,
    subprocesses: p.subprocesses.map((s) => ({
      id: s.id,
      name: cell(s.name),
      skill: s.skill ?? "",
      calls: cell(s.calls),
      bpmn: from(s.bpmn),
      svg: from(s.svg),
    })),
    undetermined: p.undetermined ?? "",
  };
}
