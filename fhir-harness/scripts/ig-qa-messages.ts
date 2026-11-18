#!/usr/bin/env bun
/**
 * ig-qa-messages.ts — the IG Publisher's full message list, `output/qa.xml`,
 * as the JSON the site's QA report draws in the Publisher's own layout.
 *
 * Owner, 2026-11-11: *"fhir qa.json needs to look like fhir ig output"*.
 * `qa.json` is only the Publisher's counts. Every message it reported is in
 * `qa.xml`, a Bundle of OperationOutcomes (one for the build's own messages,
 * then one per input file that has any), which the Publisher writes beside
 * `qa.html` and the site never reads. The AST build converts it here and
 * carries the result beside the AST, as it carries `qa.json`
 * (`ig-ast-build.sh`, `ig-cache.sh seed`, `ig-ast-refresh.yml`); the site
 * takes JSON only (`ig-render-jekyll`, contract 1).
 *
 * A build whose Publisher wrote no `qa.xml` still gets a file, one that says
 * so: an AST without one is the signal to rebuild it once, and a Publisher
 * that never writes one must not rebuild it every run.
 *
 *   bun run fhir-harness/scripts/ig-qa-messages.ts <qa.xml> <out.json>
 *
 * @module fhir-harness/scripts/ig-qa-messages
 * @covers none — it reshapes the Publisher's messages, and judges nothing
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export const QA_MESSAGES_SCHEMA = "ig-qa-messages/v1";
/** The file the AST carries and the site publishes beside `qa.json`. */
export const QA_MESSAGES_FILE = "qa-messages.json";

export interface QaMessage {
  severity: string;
  code?: string;
  text: string;
  /** The FHIRPath location, as the Publisher's "Path" column shows it. */
  path?: string;
  line?: number;
  col?: number;
  source?: string;
  messageId?: string;
}

export interface QaMessageGroup {
  /** The input file, as the Publisher states its path; absent for the build's own messages. */
  file?: string;
  messages: QaMessage[];
}

export interface QaMessages {
  $schema: typeof QA_MESSAGES_SCHEMA;
  /** Why there are no groups, when the Publisher wrote no `qa.xml`. */
  absent?: string;
  groups: QaMessageGroup[];
}

interface XNode {
  name: string;
  attrs: Record<string, string>;
  kids: XNode[];
}

const ENTITY: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };
const unescape = (s: string): string =>
  s.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (m, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENTITY[e] ?? m),
  );

/** A small XML reader: elements and attributes only, which is all FHIR XML's primitives use. Text, comments and declarations are skipped. */
export function parseXml(xml: string): XNode {
  const root: XNode = { name: "#root", attrs: {}, kids: [] };
  const stack: XNode[] = [root];
  const tag = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[?!][^>]*>|<\/([^\s>]+)\s*>|<([^\s/>]+)((?:\s+[^\s=]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  const attr = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  for (let m = tag.exec(xml); m; m = tag.exec(xml)) {
    if (m[1]) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    if (!m[2]) continue;
    const n: XNode = { name: m[2].replace(/^.*:/, ""), attrs: {}, kids: [] };
    for (let a = attr.exec(m[3] ?? ""); a; a = attr.exec(m[3] ?? "")) n.attrs[a[1]!.replace(/^.*:/, "")] = unescape(a[2] ?? a[3] ?? "");
    attr.lastIndex = 0;
    stack[stack.length - 1]!.kids.push(n);
    if (!m[4]) stack.push(n);
  }
  return root;
}

const kid = (n: XNode | undefined, name: string): XNode | undefined => n?.kids.find((k) => k.name === name);
const kids = (n: XNode | undefined, name: string): XNode[] => n?.kids.filter((k) => k.name === name) ?? [];
const val = (n: XNode | undefined): string | undefined => n?.attrs.value;
/** The value of the extension whose URL ends with `suffix`. */
function ext(n: XNode, suffix: string): string | undefined {
  for (const e of kids(n, "extension")) {
    if (!(e.attrs.url ?? "").endsWith(suffix)) continue;
    const v = e.kids.find((k) => k.name.startsWith("value"));
    if (v) return val(v);
  }
  return undefined;
}
const int = (s: string | undefined): number | undefined => (s !== undefined && /^-?\d+$/.test(s) ? Number(s) : undefined);

/** The Publisher's validation Bundle as groups of messages, in the Publisher's own order. */
export function qaMessagesFromXml(xml: string): QaMessages {
  const doc = parseXml(xml);
  const bundle = kid(doc, "Bundle");
  const groups: QaMessageGroup[] = [];
  for (const entry of kids(bundle, "entry")) {
    const oo = kid(kid(entry, "resource"), "OperationOutcome");
    if (!oo) continue;
    const file = ext(oo, "operationoutcome-file");
    const messages: QaMessage[] = kids(oo, "issue").map((i) => {
      const line = int(ext(i, "issue-line"));
      const col = int(ext(i, "issue-col"));
      const m: QaMessage = { severity: val(kid(i, "severity")) ?? "null", text: val(kid(kid(i, "details"), "text")) ?? val(kid(i, "diagnostics")) ?? "" };
      const code = val(kid(i, "code"));
      const path = val(kid(i, "expression")) ?? val(kid(i, "location"));
      const source = ext(i, "issue-source");
      const messageId = ext(i, "message-id");
      if (code) m.code = code;
      if (path) m.path = path;
      if (line !== undefined && line >= 0) m.line = line;
      if (col !== undefined && col >= 0) m.col = col;
      if (source) m.source = source;
      if (messageId) m.messageId = messageId;
      return m;
    });
    if (file === undefined && messages.length === 0) continue;
    groups.push(file === undefined ? { messages } : { file, messages });
  }
  return { $schema: QA_MESSAGES_SCHEMA, groups };
}

/** Read `qaXml` (or say it is missing) and write the JSON to `out`. */
export function writeQaMessages(qaXml: string, out: string): QaMessages {
  const r: QaMessages = existsSync(qaXml)
    ? qaMessagesFromXml(readFileSync(qaXml, "utf-8"))
    : { $schema: QA_MESSAGES_SCHEMA, absent: "the IG Publisher wrote no qa.xml in this build", groups: [] };
  writeFileSync(out, `${JSON.stringify(r)}\n`);
  return r;
}

if (import.meta.main) {
  const [qaXml, out] = process.argv.slice(2);
  if (!qaXml || !out) {
    console.error("usage: ig-qa-messages.ts <qa.xml> <out.json>");
    process.exit(2);
  }
  const r = writeQaMessages(qaXml, out);
  const n = r.groups.reduce((s, g) => s + g.messages.length, 0);
  console.log(`${out}: ${r.absent ?? `${n} message(s) in ${r.groups.length} group(s)`}`);
}
