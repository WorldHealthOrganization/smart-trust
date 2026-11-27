#!/usr/bin/env bun
/**
 * The harness's own minimal folio renderer: a folio, rendered as the list of
 * files it holds (bean `folio-assistant-ohx6`).
 *
 * @module cat-harness/folio-render/file-list
 *
 * ```sh
 * bun run cat-harness/folio-render/file-list.ts           # write folio/index.md
 * bun run cat-harness/folio-render/file-list.ts --check   # exit 1 when it is stale
 * ```
 *
 * ## The owner's ruling, 2026-10-10
 *
 * cat-harness **carries its own minimal renderer**, and what it renders is a
 * **list of files**: the folio as a file listing. The same list is the 'list'
 * view of the full folio viewer (cat-harness-tools `gen-folio-viz.ts`), "so the
 * two show the same thing at two levels of polish". One function,
 * {@link folioFileList}, answers "which files", and both read it. A second
 * listing in the viewer would be free to disagree with this one.
 *
 * ## Why this does not contradict "cat-harness is not self-documenting"
 *
 * `schemas/kg/folio-graph-typology.ts` keeps the just-the-docs PIPELINE in core.
 * This depends on none of it. It writes one markdown page with just-the-docs
 * front matter, which core's pipeline (or any Jekyll site) can serve, and
 * which reads as a plain file listing on GitHub without it. A layer that
 * hands its dependents the folio kind can now render a folio itself, at the
 * smallest useful level, as the ruling asks.
 *
 * ## What is listed
 *
 * Every file under the folio directory, recursively, sorted, with its size,
 * except:
 * - the page this writes (`index.md`), which would list itself;
 * - dot-files.
 *
 * ## Why it sits BESIDE the folio, not inside it
 *
 * It was `folio/render/` for a day. `check:layout-norms` refuses a declared
 * directory nested inside another declared one in cat-harness, and the
 * `folio` kind has no `declarationFile` to declare it from within, so the
 * renderer is a top-level `folio-render/` and finds the folio through the
 * declaration (lane A, 2026-10-12, blocking the re-pin #2529).
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// ── The declaration, read as data ───────────────────────────────────────────
//
// This helper lives in cat-harness, and cat-harness imports nothing above
// bootstrap — the schema code it once used moved up a layer (bean `8lcl`).
// It needs only the layer's title and the directory declared for
// the `folio` graph, so it reads the declaration JSON itself.

interface Declared {
  name?: string;
  title?: string;
  directories?: Array<{ path?: string; graphTypologies?: string[] }>;
}

/** The layer root this module sits in: the directory above `folio-render/`. */
const INSTANCE_ROOT = resolve(import.meta.dir, "..");

function readOwnDeclaration(root: string): Declared | undefined {
  for (const name of readdirSync(root)) {
    if (!name.endsWith(".json")) continue;
    try {
      const d = JSON.parse(readFileSync(join(root, name), "utf-8")) as Declared & { $schema?: string };
      if (Array.isArray(d.directories) && typeof d.name === "string" && name === `${d.name}.json`) return d;
    } catch {
      // not a declaration
    }
  }
  return undefined;
}

function folioDirectoryOf(root: string, decl: Declared | undefined): string | undefined {
  const dir = decl?.directories?.find((d) => d.graphTypologies?.includes("folio") && typeof d.path === "string");
  return dir ? join(root, dir.path!.replace(/\/$/, "")) : undefined;
}

/** The page {@link renderFolioPage} writes, relative to the folio directory. */
export const FOLIO_PAGE = "index.md";

export interface FolioFile {
  /** Path relative to the folio directory, `/`-separated. */
  path: string;
  bytes: number;
}

/** Every file a folio directory holds, as {@link FolioFile}s, sorted by path. */
export function folioFileList(folioDir: string): FolioFile[] {
  const root = resolve(folioDir);
  const out: FolioFile[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      if (name.startsWith(".")) continue;
      const abs = join(dir, name);
      const rel = relative(root, abs).split("\\").join("/");
      const st = statSync(abs);
      if (st.isDirectory()) walk(abs); else if (st.isFile() && rel !== FOLIO_PAGE) out.push({ path: rel, bytes: st.size });
    }
  };
  if (existsSync(root)) walk(root);
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** `1234` → `1.2 KB`. */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let v = n / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v.toFixed(1)} ${units[u]}`;
}

const escCell = (s: string) => s.replace(/\|/g, "\\|");

/**
 * The page: just-the-docs front matter, what a folio is, and the file list.
 * Pure. The links are relative, so the page works on GitHub and on a site
 * alike.
 */
export function renderFolioPage(instanceTitle: string, files: readonly FolioFile[]): string {
  const rows = files.map((f) => `| [\`${escCell(f.path)}\`](${f.path.split("/").map(encodeURIComponent).join("/")}) | ${formatBytes(f.bytes)} |`);
  return [
    "---",
    "layout: default",
    `title: ${JSON.stringify(`${instanceTitle} — folio`)}`,
    "---",
    "<!-- Generated by folio-render/file-list.ts from the files in this directory. Do not edit; change the files and regenerate. -->",
    "",
    `# ${instanceTitle} — folio`,
    "",
    "A **folio** is an instance's authored content: the part of the knowledge",
    "graph that is rendered to a website, as opposed to its skills, schemas,",
    "processes and tools. A folio is declared by a directory holding a `folio`",
    "graph in the instance's declaration.",
    "",
    "This page is the harness's minimal rendering of it: the folio as the list",
    "of files it holds. The full folio viewer shows the same list as its 'list'",
    "view.",
    "",
    files.length === 0 ? "_This folio holds no files._" : `${files.length} file${files.length === 1 ? "" : "s"}:`,
    "",
    ...(files.length === 0 ? [] : ["| file | size |", "|---|---|", ...rows]),
    "",
  ].join("\n");
}

function main(argv: string[]): number {
  // The folio is found through the layer's declaration, not by counting
  // `..` from where this module happens to sit.
  const root = INSTANCE_ROOT;
  const decl = readOwnDeclaration(root);
  const folioDir = folioDirectoryOf(root, decl);
  if (folioDir === undefined) {
    console.error(`no folio directory is declared by ${root}`);
    return 2;
  }
  const page = renderFolioPage(decl?.title ?? decl?.name ?? "folio", folioFileList(folioDir));
  const out = join(folioDir, FOLIO_PAGE);
  if (argv.includes("--check")) {
    const have = existsSync(out) ? readFileSync(out, "utf-8") : "";
    if (have !== page) {
      console.error(`stale: folio/${FOLIO_PAGE} — run folio-render/file-list.ts`);
      return 1;
    }
    console.log(`current: folio/${FOLIO_PAGE}`);
    return 0;
  }
  writeFileSync(out, page);
  console.log(`wrote folio/${FOLIO_PAGE}`);
  return 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
