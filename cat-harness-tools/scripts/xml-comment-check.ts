/**
 * Refuse a `.bpmn` or `.dmn` whose comments are not well-formed XML.
 *
 * XML 1.0 §2.5 defines a comment as
 *
 *     '<!--' ((Char - '-') | ('-' (Char - '-')))* '-->'
 *
 * — so the body may not contain `--`, and may not end with `-` (a double
 * hyphen typed for an em dash, or a quoted CLI flag, breaks it).
 * `bpmn-moddle` and `dmn-moddle` parse such files happily, so `kg:audit` and
 * `render:bpmn` stay green, but a conformant parser (bpmn.io, Camunda Modeler,
 * Python's expat) cannot open them.
 *
 * ## Why this is hand-written rather than delegated to a parser
 *
 * The two XML parsers already in this repo's dependencies BOTH accept the
 * invalid comment: `fast-xml-parser`'s `XMLValidator.validate()` returns
 * `true` for `<root><!-- a -- b --></root>`, and the moddles are the other.
 *
 * So the rule is implemented directly, and **this checks the comment
 * production and nothing else.** It is not a well-formedness check: the
 * moddles catch most other invalid XML by failing to load, and `kg:audit`
 * records such a file as `unknown` rather than as a pass.
 *
 * ## Scanning, not regexing
 *
 * `/<!--.*?-->/` mis-reports the trailing-hyphen case (`<!-- a --->`). The
 * scan below takes the same first-`-->` boundary a parser does, deliberately,
 * and then tests the body against the production.
 *
 * ## What it reads
 *
 * Every `.bpmn` and `.dmn` under a directory the layer declares as
 * `processes`, and every `.bpmn` of a declared `business-processes` directory
 * (`businessProcessFiles`, without folio blocks): the registry names this
 * check as what grades the second kind, whose diagrams nothing runs and so
 * no engine gate reads.
 *
 * Usage:  bun run cat-harness-tools/scripts/xml-comment-check.ts
 * Exits 1 and names every offending file, line and text.
 *
 * @covers processes, business-processes
 */
import { readdirSync, readFileSync, statSync } from "node:fs";

import { businessProcessFiles, workflowDirs, corpusScopeFor } from "./known-skills.js";
import { join, relative, resolve } from "node:path";
import { HARNESS_ROOT } from "./lib/roots.ts";

export interface CommentFinding {
  file: string;
  line: number;
  detail: string;
}

/**
 * Every comment-production violation in one document.
 *
 * `label` is used only in the finding, so a caller can report a path of its
 * own choosing without this module knowing about the repository layout.
 */
export function checkXmlComments(xml: string, label: string): CommentFinding[] {
  const out: CommentFinding[] = [];
  const lineOf = (i: number) => xml.slice(0, i).split("\n").length;

  let i = 0;
  for (;;) {
    const open = xml.indexOf("<!--", i);
    if (open < 0) break;
    const close = xml.indexOf("-->", open + 4);
    if (close < 0) {
      out.push({ file: label, line: lineOf(open), detail: "comment is never closed." });
      break;
    }
    const body = xml.slice(open + 4, close);

    if (body.includes("--")) {
      // Name the offending line rather than the comment's first line: these
      // comments run to thirty lines and "line 2" sends the reader to a header.
      const rel = body.split("\n").findIndex((l) => l.includes("--"));
      const text = body.split("\n")[rel]!.trim();
      out.push({
        file: label,
        line: lineOf(open) + rel,
        detail: `comment body contains "--", which XML 1.0 §2.5 forbids: ${text}`,
      });
    } else if (body.endsWith("-")) {
      out.push({
        file: label,
        line: lineOf(close),
        detail: `comment body ends with "-", so it closes with "--->", which XML 1.0 §2.5 forbids.`,
      });
    }
    i = close + 3;
  }
  return out;
}

/** Every `.bpmn` and `.dmn` under `dir`, recursively. */
export function xmlSourcesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...xmlSourcesUnder(p));
    else if (p.endsWith(".bpmn") || p.endsWith(".dmn")) out.push(p);
  }
  return out;
}

/**
 * The diagrams this check reads under one layer root: every `.bpmn` and
 * `.dmn` of its declared `processes` directories, and every `.bpmn` of its
 * declared `business-processes` directories (folio blocks excluded: a block
 * carries its own drawing and is graded with its folio). Sorted, no repeats.
 */
export function xmlCommentFiles(root: string): { dirs: string[]; files: string[] } {
  // Every directory the layer DECLARES as holding processes, not the
  // literal `processes`. A topical layout puts them in several.
  const dirs = workflowDirs(root, corpusScopeFor(root));
  const files = new Set(dirs.flatMap((d) => xmlSourcesUnder(d)));
  for (const f of businessProcessFiles(root, { folio: false })) files.add(f);
  return { dirs, files: [...files].sort() };
}

if (import.meta.main) {
  const root = resolve(HARNESS_ROOT);
  const { dirs, files } = xmlCommentFiles(root);

  // An empty corpus is not a pass. Renaming `processes/` would
  // otherwise turn this gate into a silent success over nothing, which is the
  // same "reported clean over what it never read" defect it exists to catch.
  if (files.length === 0) {
    const where = dirs.length > 0 ? dirs.join(", ") : "(no declared workflow directory)";
    console.error(`No .bpmn or .dmn sources found under ${where} — refusing to report a clean run.`);
    process.exit(2);
  }

  const findings = files.flatMap((f) =>
    checkXmlComments(readFileSync(f, "utf8"), relative(root, f)),
  );

  if (findings.length === 0) {
    console.log(`XML comments well-formed in ${files.length} diagram(s).`);
    process.exit(0);
  }
  console.error(`${findings.length} malformed XML comment(s):\n`);
  for (const f of findings) console.error(`  ${f.file}:${f.line}  ${f.detail}`);
  console.error(
    `\nA conformant XML parser rejects these files, though bpmn-moddle and\n` +
      `fast-xml-parser both accept them. Use an em dash for a dash, and reword\n` +
      `a quoted CLI flag rather than writing "--" inside a comment.`,
  );
  process.exit(1);
}
