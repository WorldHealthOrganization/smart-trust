/**
 * CSL-JSON → BibTeX, as pure functions: no registry, no ledger, no I/O.
 *
 * Split out of `export-bibtex.ts` (bean folio-assistant-63q4), which is a
 * script: importing it reads the source ledger, needs the folio's reference
 * registry and writes `references.bib`. A bibliography viewer exporting one
 * subgraph's or one asset's references needs the formatting and none of that.
 * `export-bibtex.ts` now formats through this module, and its output is
 * unchanged.
 *
 * @module cat-harness-tools/pipeline/bibtex-format
 */
import type { Data as CSLData, Person as CSLPerson } from "csl-json";

// ── CSL type → BibTeX entry type mapping ────────────────────────

export const TYPE_MAP: Record<string, string> = {
  "article-journal": "article",
  "article-magazine": "article",
  "article-newspaper": "article",
  "article": "article",
  "book": "book",
  "chapter": "incollection",
  "paper-conference": "inproceedings",
  "thesis": "phdthesis",
  "report": "techreport",
  "dataset": "misc",
  "webpage": "misc",
  "manuscript": "unpublished",
  "patent": "misc",
  "personal_communication": "misc",
};

// ── Formatting helpers ──────────────────────────────────────────

/** Convert Unicode to BibTeX-safe LaTeX. */
export function texEscape(s: string): string {
  return s
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    // Common accented characters → LaTeX
    .replace(/\u00e9/g, "{\\'{e}}")       // é
    .replace(/\u00c9/g, "{\\'{E}}")       // É
    .replace(/\u00e8/g, "{\\`{e}}")       // è
    .replace(/\u00ea/g, "{\\^{e}}")       // ê
    .replace(/\u00eb/g, '{\\"e}')         // ë
    .replace(/\u00e0/g, "{\\`{a}}")       // à
    .replace(/\u00e1/g, "{\\'{a}}")       // á
    .replace(/\u00e2/g, "{\\^{a}}")       // â
    .replace(/\u00e4/g, '{\\"a}')         // ä
    .replace(/\u00f6/g, '{\\"o}')         // ö
    .replace(/\u00fc/g, '{\\"u}')         // ü
    .replace(/\u00dc/g, '{\\"U}')         // Ü
    .replace(/\u00f4/g, "{\\^{o}}")       // ô
    .replace(/\u0142/g, "{\\l}")          // ł
    .replace(/\u012b/g, "{\\={\\i}}")     // ī
    .replace(/\u012d/g, "{\\u{\\i}}")     // ĭ  (breve i)
    .replace(/\u012f/g, "{\\k{i}}")       // į
    .replace(/\u0131/g, "{\\i}")          // ı  (dotless i)
    // Kreĭn-specific
    .replace(/\u012c/g, "{\\u{I}}")       // Ĭ
    .replace(/\u012a/g, "{\\={I}}")       // Ī
    .replace(/\u0306/g, "{\\u{}}")        // combining breve
    // German
    .replace(/\u00df/g, "{\\ss}")         // ß
    ;
}

/** Format a CSL person as BibTeX author string. */
export function formatPerson(p: CSLPerson): string {
  if (p.literal) return texEscape(p.literal);
  const parts: string[] = [];
  if (p["non-dropping-particle"]) parts.push(texEscape(p["non-dropping-particle"]));
  if (p.family) parts.push(texEscape(p.family));
  const family = parts.join(" ");
  const given = p.given ? texEscape(p.given) : "";
  if (p.suffix) return `${family}, ${texEscape(p.suffix)}, ${given}`;
  return given ? `${family}, ${given}` : family;
}

/** Format a CSL date as BibTeX year string. */
export function formatYear(entry: CSLData): string | undefined {
  const issued = entry.issued;
  if (!issued) return undefined;
  if ("date-parts" in issued && issued["date-parts"]?.[0]) {
    return String(issued["date-parts"][0][0]);
  }
  if ("raw" in issued && issued.raw) {
    const m = issued.raw.match(/\d{4}/);
    return m ? m[0] : issued.raw;
  }
  if ("literal" in issued && issued.literal) return issued.literal;
  return undefined;
}

/** Wrap title in double braces to preserve casing. */
export function braceTitle(title: string): string {
  return `{${texEscape(title)}}`;
}

// ── Main export ─────────────────────────────────────────────────

/**
 * One CSL-JSON item as a BibTeX entry. Pure: `annotation`, when given, is
 * written as the `annotation` field (export-bibtex passes the verification
 * marker from the source ledger).
 */
export function cslToBibtex(entry: CSLData, annotation?: string | null): string {
  const bibType = TYPE_MAP[entry.type] || "misc";
  const fields: [string, string][] = [];

  // Author
  if (entry.author?.length) {
    fields.push(["author", entry.author.map(formatPerson).join(" and ")]);
  }

  // Editor
  if (entry.editor?.length) {
    fields.push(["editor", entry.editor.map(formatPerson).join(" and ")]);
  }

  // Title
  if (entry.title) {
    fields.push(["title", braceTitle(entry.title)]);
  }

  // Journal / booktitle / container
  if (entry["container-title"]) {
    const field = bibType === "incollection" || bibType === "inproceedings"
      ? "booktitle" : "journal";
    fields.push([field, texEscape(entry["container-title"])]);
  }

  // Year
  const year = formatYear(entry);
  if (year) fields.push(["year", year]);

  // Volume, number, pages
  if (entry.volume != null) fields.push(["volume", String(entry.volume)]);
  if (entry.issue != null) fields.push(["number", String(entry.issue)]);
  if (entry.page) fields.push(["pages", entry.page.replace(/-/g, "--")]);

  // Publisher
  if (entry.publisher) fields.push(["publisher", texEscape(entry.publisher)]);

  // Series / collection
  if (entry["collection-title"]) fields.push(["series", texEscape(entry["collection-title"])]);
  if (entry["collection-number"] != null) fields.push(["number", String(entry["collection-number"])]);

  // Edition
  if (entry.edition != null) {
    const ed = String(entry.edition);
    fields.push(["edition", ed.match(/^\d+$/) ? ordinal(Number(ed)) : ed]);
  }

  // Identifiers
  if (entry.DOI) fields.push(["doi", entry.DOI]);
  if (entry.URL) fields.push(["url", entry.URL]);
  if (entry.ISBN) fields.push(["isbn", entry.ISBN]);
  if (entry.ISSN) fields.push(["issn", entry.ISSN]);

  // Thesis-specific
  if (bibType === "phdthesis" && entry.publisher) {
    // publisher is school for theses
    const schoolIdx = fields.findIndex(([k]) => k === "publisher");
    if (schoolIdx >= 0) {
      fields[schoolIdx] = ["school", fields[schoolIdx][1]];
    }
  }

  // Genre (for theses)
  // (BibTeX phdthesis type implies this, skip unless mastersthesis)

  // Note
  if (entry.note) fields.push(["note", texEscape(entry.note)]);

  // Verification annotation (added 2026-05-19) — bibLaTeX renders
  // this as a small marker on each bib entry in the rendered PDF;
  // pandoc/CSL HTML output can also surface it via the `annote`
  // CSL field. The marker tells readers whether the citation was
  // verified by a human / agent against the source.
  if (annotation) {
    fields.push(["annotation", texEscape(annotation)]);
  }

  // Howpublished for misc
  if (bibType === "misc" && entry.publisher && !fields.some(([k]) => k === "publisher")) {
    fields.push(["howpublished", texEscape(entry.publisher)]);
  }

  // Format output
  const maxKeyLen = Math.max(...fields.map(([k]) => k.length));
  const body = fields
    .map(([k, v]) => `  ${k.padEnd(maxKeyLen)} = {${v}},`)
    .join("\n");

  return `@${bibType}{${entry.id},\n${body}\n}`;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
