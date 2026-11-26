/**
 * ig-markdown-qa.ts — does an IG's markdown draw as markdown on its pages?
 *
 * Owner, 2026-11-11: the FamilyPhone actor page showed `**Persona**` and
 * `- ` list markers as text (fhir-harness#374), and asked for the QA report
 * to scan for markdown that renders wrongly.
 *
 * The artefact pages draw an IG's markdown fields in the browser, through
 * `description()` in `templates/ig-pages/ig-artifact.js`, so the built HTML
 * holds none of it and a scan of the HTML would see nothing. This check runs
 * that same function, with a small DOM stand-in, over every markdown field
 * the pages draw, and reports the markup that comes out as plain text.
 *
 * @module fhir-harness/scripts/ig-markdown-qa
 * @covers none — it judges how pages draw markdown, not a declared graph
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * The FHIR markdown fields the artefact pages draw through `description()`,
 * and `valueMarkdown`: an R5 resource carried in R4 (an ActorDefinition as
 * `Basic`) keeps its description there.
 */
export const MARKDOWN_FIELDS = ["description", "definition", "comment", "requirements", "valueMarkdown"] as const;

/** Markup that should have been drawn, and how to spot it left in the text. */
export const LEFTOVERS: { name: string; re: RegExp }[] = [
  { name: "bold", re: /\*\*\S(?:[^*]*?\S)?\*\*|__\S(?:[^_]*?\S)?__/ },
  { name: "list marker", re: /(?:^|\n)[ \t]{0,3}(?:[-*+]|\d{1,9}[.)])[ \t]+\S/ },
  // "(" then a drawn link is two links, "[Reference]([Patient])", not one left as text.
  { name: "link", re: /\[[^\]\n]+\]\((?!\[)[^)\s]+\)/ },
  { name: "image", re: /!\[/ },
  { name: "code", re: /`[^`\n]+`/ },
  { name: "heading", re: /(?:^|\n)#{1,6}[ \t]+\S/ },
  { name: "table", re: /(?:^|\n)[ \t]*\|[^\n]*\|[ \t]*\n[ \t]*\|?[ \t]*:?-{3,}/ },
  // Only real HTML elements: `<data set>` in a description is a placeholder, not a tag.
  { name: "HTML tag", re: /<\/?(?:a|b|i|u|s|em|strong|p|div|span|ul|ol|li|table|thead|tbody|tr|td|th|code|pre|h[1-6]|sub|sup|img|blockquote|hr)(?:\s[^<>]*)?\/?>/i },
];

type Node = { tag: string; kids: (Node | string)[]; append(...k: (Node | string)[]): void };

/** `description()` from the page renderer, run against a DOM stand-in. */
export function pageMarkdownDrawer(renderer?: string): (text: string) => Node {
  const src = renderer ?? readFileSync(join(import.meta.dir, "templates", "ig-pages", "ig-artifact.js"), "utf8");
  const from = src.indexOf("function breaks(");
  const to = src.indexOf("function stats(");
  if (from < 0 || to < from) throw new Error("ig-artifact.js: description() not found between breaks() and stats()");
  const mk = (tag: string, _cls?: string, text?: string): Node => {
    const n: Node = { tag, kids: text === undefined || text === null ? [] : [String(text)], append(...k) { n.kids.push(...k); } };
    return Object.assign(n, { tagName: tag.toUpperCase() });
  };
  const link = (_href: string, text: string) => mk("a", undefined, text);
  return new Function("el", "link", "indexView", "document", `${src.slice(from, to)}; return description;`)(mk, link, false, {
    createDocumentFragment: () => mk("#frag"),
  }) as (text: string) => Node;
}

/** The text a reader sees, block by block; code spans are left out, since markup there is meant. */
function visibleBlocks(root: Node): string[] {
  // A drawn link is shown as "[text]", so a "!" left just before one (an image drawn as a link) reads "![".
  const text = (n: Node | string): string =>
    typeof n === "string" ? n : n.tag === "code" ? "" : n.tag === "a" ? `[${n.kids.map(text).join("")}]` : n.kids.map(text).join("");
  return root.kids.flatMap((k) => (typeof k === "string" ? [k] : k.tag === "ul" || k.tag === "ol" ? k.kids.map(text) : [text(k)]));
}

/** The markup names left as text when `md` is drawn. */
export function leftoverMarkup(md: string, draw: (t: string) => Node): string[] {
  const found = new Set<string>();
  for (const block of visibleBlocks(draw(md))) for (const l of LEFTOVERS) if (l.re.test(block)) found.add(l.name);
  return [...found];
}

export interface MarkdownFinding {
  /** `<resourceType>/<id>`. */
  resource: string;
  /** Where in the resource, e.g. `description` or `snapshot.element[3].comment`. */
  path: string;
  /** What was left as text. */
  markup: string[];
  /** The start of the field, for finding it. */
  excerpt: string;
}

function walk(v: unknown, path: string, out: { path: string; text: string }[]): void {
  if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`, out));
  else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (k === "text" || k === "content") continue; // narrative XHTML and attachments are not markdown fields
      const p = path ? `${path}.${k}` : k;
      if (typeof x === "string" && (MARKDOWN_FIELDS as readonly string[]).includes(k)) out.push({ path: p, text: x });
      else walk(x, p, out);
    }
  }
}

/** Every markdown field of one resource whose drawing leaves markup as text. */
export function scanResource(res: Record<string, unknown>, draw: (t: string) => Node): MarkdownFinding[] {
  const fields: { path: string; text: string }[] = [];
  walk(res, "", fields);
  const id = `${String(res.resourceType ?? "?")}/${String(res.id ?? "?")}`;
  return fields.flatMap(({ path, text }) => {
    const markup = leftoverMarkup(text, draw);
    return markup.length ? [{ resource: id, path, markup, excerpt: text.replace(/\s+/g, " ").slice(0, 80) }] : [];
  });
}

/** Every resource JSON under `dir` (an AST directory or a resources folder). */
export function scanDir(dir: string, draw = pageMarkdownDrawer()): { scanned: number; findings: MarkdownFinding[] } {
  const findings: MarkdownFinding[] = [];
  let scanned = 0;
  if (!existsSync(dir)) return { scanned, findings };
  const visit = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) visit(p);
      else if (f.endsWith(".json")) {
        let res: unknown;
        try {
          res = JSON.parse(readFileSync(p, "utf8"));
        } catch {
          continue;
        }
        if (!res || typeof res !== "object" || typeof (res as Record<string, unknown>).resourceType !== "string") continue;
        scanned++;
        findings.push(...scanResource(res as Record<string, unknown>, draw));
      }
    }
  };
  visit(dir);
  return { scanned, findings };
}

/** The QA page's section, as Markdown lines. */
export function markdownQaMarkdown(r: { scanned: number; findings: MarkdownFinding[] } | undefined, o: { limit?: number } = {}): string[] {
  const lines = ["### Markdown rendering", ""];
  if (!r) return [...lines, "This build held no resources to scan.", ""];
  // A backslash first, so a field ending in "\" cannot escape the cell's closing pipe.
  const cell = (s: string) => s.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/`/g, "'");
  lines.push(
    `Each markdown field the artefact pages draw (${MARKDOWN_FIELDS.map((f) => `\`${f}\``).join(", ")}), drawn by the pages' own renderer, checked for markup left as plain text. ${r.scanned} resource(s) scanned.`,
    "",
  );
  if (!r.findings.length) return [...lines, "**Findings:** none.", ""];
  const limit = o.limit ?? 200;
  lines.push(`**Findings:** ${r.findings.length} field(s) show markup as text.`, "", "| resource | field | left as text | starts with |", "|---|---|---|---|");
  for (const f of r.findings.slice(0, limit)) lines.push(`| \`${f.resource}\` | \`${f.path}\` | ${f.markup.join(", ")} | ${cell(f.excerpt)} |`);
  if (r.findings.length > limit) lines.push("", `…and ${r.findings.length - limit} more.`);
  lines.push("");
  return lines;
}

if (import.meta.main) {
  const dir = process.argv[2];
  if (!dir) {
    console.error("usage: ig-markdown-qa.ts <ast or resources dir>");
    process.exit(2);
  }
  const r = scanDir(dir);
  for (const f of r.findings) console.log(`${f.resource}\t${f.path}\t${f.markup.join(",")}\t${f.excerpt}`);
  console.error(`${r.scanned} resource(s), ${r.findings.length} finding(s) under ${relative(process.cwd(), dir) || "."}`);
}
