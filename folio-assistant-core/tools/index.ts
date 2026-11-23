/**
 * folio-assistant-core's Tool nodes — the `tools` graph for the content layer.
 *
 * @module folio-assistant-core/tools
 * @graphNode tool
 *
 * Reached by the harness through tool auto-discovery (`cat-harness/tools/
 * discover.ts`, bean `p0za`), never by an import: the harness may not import
 * core (`check:partition`), and a Tool node is a declaration read at load.
 *
 * ## `folio-changeset` — bean `jwox`, epic `q4jm`
 *
 * The ChangeSet is content vocabulary (what changed in a folio, block by
 * block), so its schema and computation live in `schemas/changeset.ts`, and
 * the Tool that exposes it lives here beside them rather than in the harness.
 * It is invoked as a shell command, so declaring it copies no code.
 *
 * ## `dublin-core-render` — bean `7eak`
 *
 * Dublin Core is content vocabulary (`schemas/dublin-core.ts`), and the
 * harness may not import it, so the renderer and its Tool live here. The
 * owner asked for it *"in rendering ppiple as skill and tool"*.
 *
 * ## `folio-review-comments` — bean `423d`, epic `q4jm`
 *
 * A pull request's tagged conversation comments, ingested into
 * `review-comment/1.0.0` todos and written as `review-comments.json`. A
 * Tool, and governed by the `review-comments` skill, on the owner's ruling
 * *"make sure it is a Skill/Tool so process can be modified later"*: the
 * staging workflow only calls it.
 *
 * ## `tabular-csv`, `tabular-xlsx` — bean `eief`, moved here by `cat-tools-1wre`
 *
 * The CSV and workbook extractors behind the `tabular-metadata` skill. They
 * were declared in cat-harness as stubs until they existed; tabular metadata
 * is content vocabulary, so the working declarations live with the code.
 *
 * ## `block-actions` — bean `uphx`, REQ-17
 *
 * [edit] and [feedback] on every block of a document: the owner asked for it
 * as common core functionality (2026-10-06), so the document build draws the
 * links and this Tool hands them to an agent.
 *
 * ## `review-sheet-sync` — owner, 2026-10-30
 *
 * Builds the Google Apps Script that keeps a public-comment review sheet's
 * links and joins current, from the folio's `sheet-sync.json`, its review
 * anchors and the draft's line map. Asked for *"in Tools … part of skills and
 * processes"*, reusable for any document's public comment; the skill is
 * `public-comment`, "The review sheet's Apps Script".
 *
 * ## `review-log-watch` — owner, 2026-11-01 (Q-WATCH1 B)
 *
 * The mechanical check a review-log watcher runs on every poll: has anything
 * people set on the sheet, or any open issue, changed since the last poll?
 * Only then does the agent work. Skill `review-log-watch`, process
 * `processes/content/review-log-watch.bpmn`.
 *
 * ## One Tool per folder — bean `tdir`
 *
 * Each Tool is declared in `<id>/<id>.ts` beside this file, with its scripts
 * and tests when they are its alone; this file only loads the folders
 * (`toolsFromFolders`, which holds the folder = file = id convention).
 */
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { ToolDefinition } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";
import { toolsFromFolders } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";

export function tools(baseUrl?: string): ToolDefinition[] {
  return toolsFromFolders(dirname(fileURLToPath(import.meta.url)), baseUrl ?? "");
}
