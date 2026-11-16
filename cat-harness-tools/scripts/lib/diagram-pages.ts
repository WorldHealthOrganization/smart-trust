/**
 * Where each process's DIAGRAM page is, for the "diagram" link on its subject
 * pages — litlfred/cat-harness-tools#638, the owner's 3a of 2026-10-23: a
 * call-activity click opens the called process's data page, and the data page
 * links to the diagram.
 *
 * @module scripts/lib/diagram-pages
 *
 * The diagram page is the one `processes:viz` writes for each diagram,
 * `<stem>.md` beside the processes index (served as `<stem>.html`). Its stem is
 * the diagram file's basename, the same one the process's `depiction` SVG is
 * named by, so the page is found from `depiction` and never guessed: a process
 * with no published picture gets no link, and neither does one whose page
 * `processes:viz` did not write.
 */
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { baseDocsDir } from "../compose-docs.ts";
import { visualiserSitePath } from "../viewer-declarations.ts";
import { HARNESS_ROOT } from "./roots.ts";

/** The processes visualiser's Tool, as `gen-processes-viz.ts` names it. */
const VIEWER_TOOL = "processes-viewer";
const DEPICTION = /^(.*)\/assets\/img\/workflows\/([^/]+)\.svg$/;

type Node = Record<string, unknown>;

/**
 * Process IRI → its diagram page URL, for every process in `published` whose
 * page exists. Empty when the processes visualiser is not declared here.
 */
export function diagramPages(published: Record<string, unknown>, repo = resolve(dirname(HARNESS_ROOT))): Map<string, string> {
  const pages = new Map<string, string>();
  let route: string;
  let docsDir: string;
  try {
    route = dirname(visualiserSitePath(join(repo, "cat-harness"), VIEWER_TOOL).rel);
    docsDir = baseDocsDir(repo);
  } catch {
    return pages;
  }
  for (const n of (published["@graph"] ?? []) as Node[]) {
    if (typeof n.depiction !== "string") continue;
    const m = DEPICTION.exec(n.depiction);
    if (m === null) continue;
    const [, base, stem] = m;
    if (!existsSync(join(docsDir, route, `${stem}.md`))) continue;
    pages.set(String(n["@id"]), `${base}/${route}/${stem}.html`);
  }
  return pages;
}

/**
 * The process a subject belongs to: itself for `process/P`, and `process/P`
 * for its steps and lanes (`process/P/node/T`, `process/P/lane/L`). `stem` is
 * the subject's path under its document; `undefined` when it is no process's.
 */
export function owningProcess(id: string, stem: string): string | undefined {
  const parts = stem.split("/");
  if (parts[0] !== "process" || parts.length < 2 || !id.endsWith(stem)) return undefined;
  return id.slice(0, id.length - stem.length) + parts.slice(0, 2).join("/");
}
