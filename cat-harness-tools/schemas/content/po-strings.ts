/**
 * A minimal gettext reader: `(msgctxt, msgid) → msgstr` for one `.po` file.
 * Enough for the short UI strings the translation graph holds beside the
 * prose catalogues — block-kind headings — and a LEAF (filesystem only), so
 * `schemas/content/translation.ts` can read them without importing the
 * content pipeline's injector.
 *
 * Handles continuation lines and the C escapes gettext writes (`\"`, `\\`,
 * `\n`, `\t`). Plural forms and fuzzy flags are not read: an entry marked
 * fuzzy is still returned, because no catalogue it reads uses them.
 *
 * @module cat-harness/schemas/po-strings
 * @graphNode none — a parser for .po catalogue strings; no schema
 */
import { readFileSync } from "node:fs";

function unquote(line: string): string {
  const m = /^"(.*)"\s*$/.exec(line.trim());
  if (!m) return "";
  return m[1].replace(/\\(["\\nt])/g, (_, c: string) => (c === "n" ? "\n" : c === "t" ? "\t" : c));
}

/** The key a context and an id map to. */
export function poKey(msgctxt: string | undefined, msgid: string): string {
  return `${msgctxt ?? ""}\u0004${msgid}`;
}

/** Every translated entry in `text`, keyed by {@link poKey}. Empty `msgstr`s are left out — untranslated, not blank. */
export function parsePoStrings(text: string): Map<string, string> {
  const out = new Map<string, string>();
  let ctx: string | undefined;
  let id: string | undefined;
  let str: string | undefined;
  let field: "ctx" | "id" | "str" | undefined;
  const flush = () => {
    if (id !== undefined && id !== "" && str) out.set(poKey(ctx, id), str);
    ctx = id = str = field = undefined;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) {
      if (line === "" && str !== undefined) flush();
      continue;
    }
    const kw = /^(msgctxt|msgid|msgstr)\s+(".*")$/.exec(line);
    if (kw) {
      if (kw[1] === "msgctxt" || (kw[1] === "msgid" && str !== undefined)) {
        if (str !== undefined) flush();
      }
      field = kw[1] === "msgctxt" ? "ctx" : kw[1] === "msgid" ? "id" : "str";
      const v = unquote(kw[2]);
      if (field === "ctx") ctx = v;
      else if (field === "id") id = v;
      else str = v;
    } else if (line.startsWith('"') && field) {
      const v = unquote(line);
      if (field === "ctx") ctx = (ctx ?? "") + v;
      else if (field === "id") id = (id ?? "") + v;
      else str = (str ?? "") + v;
    }
  }
  flush();
  return out;
}

/** {@link parsePoStrings} over a file; a missing or unreadable file is an empty map. */
export function readPoStrings(file: string): Map<string, string> {
  try {
    return parsePoStrings(readFileSync(file, "utf-8"));
  } catch {
    return new Map();
  }
}
