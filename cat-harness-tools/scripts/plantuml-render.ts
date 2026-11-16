/**
 * Rendering machinery shared by every generator that draws a graph with
 * PlantUML: portrait and landscape views, the hash stamp, the pinned jar, one
 * JVM for all diagrams, and the page figure with its Portrait / Landscape
 * switch. It implements rules 5, 6, 8 and 9 of the `graph-rendering` skill
 * (`skills/kg/graph-management/graph-rendering.md`).
 *
 * @module scripts/plantuml-render
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";

import { HARNESS_ROOT } from "./lib/roots.ts";
import { loadToolReleases, releaseArtefactPath, toolReleaseDirs } from "./tool-releases.ts";

/** A PlantUML / Mermaid / HTML id: no hyphen, dot, slash or space. */
export function safeId(s: string): string {
  return s.replace(/[^A-Za-z0-9_]/g, "_");
}

// ── Portrait and landscape ────────────────────────────────────────────────
//
// Owner, 2026-09-23: "can we have portrait and landscape views?". Every
// diagram is rendered twice. The committed `.puml` is the portrait view;
// the landscape view is DERIVED from it by `landscapeOf`, so the two cannot
// say different things, and it is not committed as a second source.
//
// ELK lays every graph out top to bottom and ignores `left to right
// direction` and arrow hints (measured: identical output). So landscape is
// made two ways, by what the diagram is:
//
// - a grid of unconnected packages (an overview): ELK again, more columns;
// - anything with edges between classes: Graphviz, left to right, with
//   straight-segment (polyline) edges and wide spacing.

export type Orientation = "portrait" | "landscape";

const GRID_MARK = "' grid:";

/** Hidden links folding `pkgs` into rows: few columns for portrait, many for landscape. */
export function gridLinks(pkgs: string[], o: Orientation): string[] {
  const n = pkgs.length;
  const cols = Math.max(1, Math.ceil(o === "portrait" ? Math.sqrt(n / 2) : Math.sqrt(n * 2)));
  const L = [`${GRID_MARK} ${o}, ${cols} column(s) — ${pkgs.join(" ")}`];
  for (let i = 0; i + cols < n; i++) L.push(`${pkgs[i]} -[hidden]down- ${pkgs[i + cols]}`);
  return L;
}

/** The landscape view of a portrait `.puml`. */
export function landscapeOf(text: string): string {
  const lines = text.split("\n");
  const at = lines.findIndex((l) => l.startsWith(GRID_MARK));
  if (at >= 0) {
    const pkgs = lines[at].split(" — ")[1]!.split(" ");
    const rest = lines.filter((l, i) => i < at || (i > at && !l.includes(" -[hidden]down- ")));
    const end = rest.lastIndexOf("@enduml");
    rest.splice(end, 0, ...gridLinks(pkgs, "landscape"));
    return rest.join("\n");
  }
  // Polyline, not ortho: Graphviz's orthogonal router places edge labels away
  // from their edges and ran lines through boxes (owner, 2026-09-23: "make
  // wider, its messy"). Wider spacing is what makes room for the labels; the
  // portrait view's own nodesep/ranksep, tuned for ELK, are dropped.
  return lines
    .filter((l) => l.trim() !== "!pragma layout elk" && !/^skinparam (nodesep|ranksep)\b/.test(l.trim()))
    .flatMap((l) =>
      l.startsWith("@startuml")
        ? [l, "left to right direction", "skinparam linetype polyline", "skinparam nodesep 70", "skinparam ranksep 160"]
        : [l],
    )
    .join("\n");
}

// ── Page figure ───────────────────────────────────────────────────────────

/**
 * Both views of one diagram, with a Portrait / Landscape switch. Radio
 * buttons and CSS (`uml.css`, `.fa-uml-views`), no script: the switch works
 * before docs-ui.js loads and without it. Each view is its own
 * `bpmn-figure`, so each gets the BPMN zoom and full-width controls.
 *
 * With `interactive`, a third choice, **Interactive**: the same model as
 * Graphviz DOT, laid out in the reader's browser by `assets/js/kg-graph.js`
 * (skill `kg-subgraph-layout`), with draggable nodes. Portrait stays the
 * default, so a page without script still shows its picture; the
 * interactive view's own text says it needs script and links the DOT.
 */
export function views(svg: string, alt: string, interactive?: { dot: string; label: string }): string[] {
  const id = safeId(svg.replace(/^.*\/uml\//, "").replace(/\.svg$/, ""));
  const pick = (o: Orientation | "interactive", label: string, checked: boolean) =>
    `    <input type="radio" name="fa-uml-${id}" id="fa-uml-${id}-${o}" class="fa-uml-pick-${o}"${checked ? " checked" : ""}><label for="fa-uml-${id}-${o}">${label}</label>`;
  const fig = (o: Orientation, src: string) => [
    `  <figure class="bpmn-figure fa-uml-${o}">`,
    `    <img src="{{ '${src}' | relative_url }}" alt="${alt} ${o === "portrait" ? "Portrait" : "Landscape"} layout.">`,
    "  </figure>",
  ];
  const live = interactive
    ? [
        // `fa-figure-scope`: docs-ui.js leaves this alone; the viewer has its own pan and zoom.
        `  <div class="kg-graph fa-uml-interactive fa-figure-scope" id="kg-${id}" data-dot-src="{{ '${interactive.dot}' | relative_url }}" data-label="${interactive.label.replace(/"/g, "&quot;")}">`,
        `    <p class="kg-graph-status">The interactive view lays this diagram out in your browser with Graphviz, and needs JavaScript. Without it, pick Portrait or Landscape, or read <a href="{{ '${interactive.dot}' | relative_url }}">the DOT source</a>.</p>`,
        "  </div>",
      ]
    : [];
  return [
    `<div class="fa-uml-views">`,
    `  <fieldset class="fa-uml-view-pick">`,
    "    <legend>Layout</legend>",
    pick("portrait", "Portrait", true),
    pick("landscape", "Landscape", false),
    ...(interactive ? [pick("interactive", "Interactive", false)] : []),
    "  </fieldset>",
    ...fig("portrait", svg),
    ...fig("landscape", svg.replace(/\.svg$/, ".landscape.svg")),
    ...live,
    "</div>",
    ...(interactive ? [`<script type="module" src="{{ '/assets/js/kg-graph.js' | relative_url }}"></script>`] : []),
  ];
}

// ── PlantUML → SVG ────────────────────────────────────────────────────────
//
// The SVG is rendered from the `.puml` and STAMPED with that source's hash.
// `--check` compares stamps and so needs no Java: font metrics differ between
// machines, so comparing the SVG bytes would fail on a runner that renders the
// same source a pixel differently, while a stamp says the one thing that
// matters: this picture was drawn from the current source.

export const PLANTUML = {
  version: "1.2026.10",
  url: "https://repo1.maven.org/maven2/net/sourceforge/plantuml/plantuml/1.2026.10/plantuml-1.2026.10.jar",
  sha256: "71972b58fe9208a78bbed614c806042b8404ca5f24022581d986bd9a1cc9463e",
};

/**
 * Look up the declared `plantuml` tool-release record in the directories that
 * declare the `tool-release` typology (`toolReleaseDirs`: `root`'s own and its
 * dependencies', read from their declarations, never a directory name written
 * here), falling back to {@link PLANTUML} when none is reachable.
 */
export async function resolvePlantumlRelease(root: string = HARNESS_ROOT): Promise<{
  version: string;
  url: string;
  sha256: string;
  cachedPath?: string;
}> {
  try {
    const loaded = loadToolReleases(await toolReleaseDirs(root), root);
    const rel = loaded.releases.find((r) => r.release.name === "plantuml")?.release;
    if (rel && rel.source.type === "url") {
      const artefact = releaseArtefactPath(rel);
      return {
        version: rel.version,
        url: rel.source.url,
        sha256: rel.digest.digest,
        ...(artefact ? { cachedPath: artefact } : {}),
      };
    }
  } catch {
    // Fall back to the pinned constant when no declaration is readable from here.
  }
  return PLANTUML;
}

export const sha256 = (text: string | Buffer) => createHash("sha256").update(text).digest("hex");
const STAMP = /<!-- puml-sha256: ([0-9a-f]{64}) -->/;

/** The source hash an SVG was stamped with, or null if it has none or is missing. */
export function svgStamp(svgPath: string): string | null {
  if (!existsSync(svgPath)) return null;
  return STAMP.exec(readFileSync(svgPath, "utf8"))?.[1] ?? null;
}

/** The pinned PlantUML jar: `PLANTUML_JAR`, else the tool-releases cache or a verified download into the user cache. */
async function plantumlJar(): Promise<string | null> {
  if (process.env.PLANTUML_JAR) return process.env.PLANTUML_JAR;
  const resolved = await resolvePlantumlRelease();
  if (resolved.cachedPath && existsSync(resolved.cachedPath) && sha256(readFileSync(resolved.cachedPath)) === resolved.sha256) {
    return resolved.cachedPath;
  }
  const jar = join(homedir(), ".cache", "folio-assistant", `plantuml-${PLANTUML.version}.jar`);
  if (existsSync(jar)) return jar;
  const res = await fetch(PLANTUML.url).catch(() => null);
  if (!res?.ok) return null;
  const bytes = Buffer.from(await res.arrayBuffer());
  if (sha256(bytes) !== PLANTUML.sha256) throw new Error(`${PLANTUML.url}: sha256 mismatch, refusing to run it`);
  mkdirSync(dirname(jar), { recursive: true });
  writeFileSync(jar, bytes);
  return jar;
}

export interface RenderJob {
  /** The committed `.puml` this view is drawn from. */
  source: string;
  text: string;
  svg: string;
}

/** Both views of one `.puml`: the file itself, and {@link landscapeOf} it. */
export function bothViews(source: string, text: string, svg: string): RenderJob[] {
  return [
    { source, text, svg },
    { source, text: landscapeOf(text), svg: svg.replace(/\.svg$/, ".landscape.svg") },
  ];
}

/** The jobs whose SVG is missing or stamped from other source. */
export function staleJobs(jobs: RenderJob[]): RenderJob[] {
  return jobs.filter((j) => svgStamp(j.svg) !== sha256(j.text));
}

/**
 * Render every job whose SVG is stale, in ONE JVM (a start per diagram costs
 * ~1.5 s, and there are ~100). Each source is copied under a numbered name
 * because PlantUML names its output after `@startuml <name>`, not after the
 * file.
 */
export async function renderSvgs(
  jobs: RenderJob[],
  who: { repo: string; generator: string },
): Promise<{ rendered: number; skipped: string | null }> {
  const todo = staleJobs(jobs);
  if (todo.length === 0) return { rendered: 0, skipped: null };
  const java = await (async (): Promise<string> => {
    try {
      const loaded = loadToolReleases(await toolReleaseDirs(HARNESS_ROOT), HARNESS_ROOT);
      const rel = loaded.releases.find((r) => r.release.name === "plantuml")?.release;
      const major = (rel?.runtimes ?? []).map((r) => /^temurin-jre@(\d+)\./.exec(r.release)?.[1]).find(Boolean);
      if (major) {
        for (const suffix of ["X64", "ARM64"]) {
          const home = process.env[`JAVA_HOME_${major}_${suffix}`];
          if (home && existsSync(join(home, "bin", "java"))) return join(home, "bin", "java");
        }
      }
    } catch {
      // Fall back to `java` on PATH when no runtime declaration is readable.
    }
    return "java";
  })();
  if (spawnSync(java, ["-version"]).status !== 0) return { rendered: 0, skipped: "no java on PATH" };
  const jar = await plantumlJar();
  if (!jar) return { rendered: 0, skipped: `could not fetch ${PLANTUML.url}` };

  const work = mkdtempSync(join(tmpdir(), "uml-svg-"));
  try {
    const inputs = todo.map(({ text }, i) => {
      const f = join(work, `u${i}.puml`);
      writeFileSync(f, text.replace(/^@startuml .*$/m, `@startuml u${i}`));
      return f;
    });
    const run = spawnSync(java, ["-jar", jar, "-charset", "UTF-8", "-tsvg", "-o", work, ...inputs], { encoding: "utf8" });
    if (run.status !== 0) throw new Error(`PlantUML failed (${run.status}): ${run.stderr}`);
    todo.forEach(({ source: p, text, svg: target }, i) => {
      const out = join(work, `u${i}.svg`);
      if (!existsSync(out)) throw new Error(`PlantUML wrote nothing for ${relative(who.repo, target)}`);
      // After the root element's opening tag: a comment before an XML
      // declaration is not well-formed, and docs-ui.js parses this file.
      const svg = readFileSync(out, "utf8").replace(
        /(<svg\b[^>]*>)/,
        `$1<!-- GENERATED from ${relative(who.repo, p)}${target.endsWith(".landscape.svg") ? " (landscape view, landscapeOf)" : ""} by ${who.generator} (PlantUML ${PLANTUML.version}) --><!-- puml-sha256: ${sha256(text)} -->`,
      );
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, svg);
    });
    return { rendered: todo.length, skipped: null };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
