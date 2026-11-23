/**
 * The one YAML front-matter reader for this repository's self-declaring files.
 *
 * Several node kinds here declare themselves in front matter — memory entries
 * (`folio-memory/v1`), fsh-guts nodes (`folio-fsh-guts/v1`), beans, skills.
 * This is the reader they share, so there is one parser, not several that
 * disagree.
 *
 * ## What it deliberately does NOT do
 *
 * It is not a YAML implementation and must not become one. It reads scalars,
 * `- ` lists, and folded/literal block scalars (e.g. `summary: >-`), because
 * that is what the corpus uses. Anything richer — anchors, flow mappings,
 * nested maps — should make a caller reach for a real parser rather than make
 * this grow: a half-YAML fails on the document nobody tested.
 *
 * @module schemas/front-matter
 * @graphNode schema
 */

/** A front matter block: scalars and lists of scalars. */
export type FrontMatter = Record<string, string | string[]>;

function stripQuotes(v: string): string {
  return /^"(.*)"$/.test(v) ? v.slice(1, -1).replace(/\\"/g, '"') : v;
}

/**
 * Split a document into its front matter and the body after it.
 *
 * A document with no front matter yields an empty map and the whole text as
 * body — NOT an error. A file that does not declare itself is a fact for the
 * caller to act on (`isSkillMd` and the log sweep both do), and throwing here
 * would make "undeclared" indistinguishable from "malformed".
 */
export function parseFrontMatter(text: string): { fm: FrontMatter; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!m) return { fm: {}, body: text };

  const fm: FrontMatter = {};
  const lines = m[1]!.split("\n");
  let key = "";

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;

    const kv = /^([A-Za-z$][\w$-]*):\s*(.*)$/.exec(line);
    if (kv) {
      key = kv[1]!;
      const v = kv[2]!.trim();

      // A block scalar: `>` and `>-` fold newlines to spaces, `|` and `|-`
      // keep them. The chomping indicator only governs the TRAILING newline,
      // which is stripped here either way — nothing in this corpus depends on
      // a trailing blank line surviving, and pretending to honour a
      // distinction that is never exercised is how a parser acquires
      // behaviour nobody has tested.
      const block = /^([|>])([-+]?)$/.exec(v);
      if (block) {
        const fold = block[1] === ">";
        const collected: string[] = [];
        let j = i + 1;
        for (; j < lines.length; j += 1) {
          const next = lines[j]!;
          // A blank line belongs to the block; a non-indented, non-blank line
          // ends it. Indentation is "more than zero" rather than a measured
          // indent, because every block in this corpus is at one level and
          // guessing the parent indent is where a small parser goes wrong.
          if (next.trim() === "") {
            collected.push("");
            continue;
          }
          if (!/^\s/.test(next)) break;
          collected.push(next.replace(/^\s+/, ""));
        }
        i = j - 1;
        while (collected.length && collected[collected.length - 1] === "") collected.pop();
        fm[key] = fold ? collected.join(" ").replace(/\s+/g, " ").trim() : collected.join("\n");
        continue;
      }

      fm[key] = v === "" ? [] : stripQuotes(v);
      continue;
    }

    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item && key) {
      const list = Array.isArray(fm[key]) ? (fm[key] as string[]) : [];
      list.push(stripQuotes(item[1]!.trim()));
      fm[key] = list;
    }
  }

  return { fm, body: text.slice(m[0].length) };
}

/** A scalar field, or undefined when absent or a list. */
export function scalar(fm: FrontMatter, key: string): string | undefined {
  const v = fm[key];
  return typeof v === "string" && v !== "" ? v : undefined;
}

/** A list field. A single scalar counts as a one-element list. */
export function list(fm: FrontMatter, key: string): string[] {
  const v = fm[key];
  if (Array.isArray(v)) return v;
  return typeof v === "string" && v !== "" ? [v] : [];
}

/**
 * A front-matter list of MAPPINGS — `- kind: agent` with `  id: x` on the
 * lines under it — which {@link parseFrontMatter} deliberately does not model
 * (its items are scalars). Read by key, on demand, so the scalar parser's
 * type stays what its eleven callers rely on.
 *
 * The shape todos already use for `references` and `artefacts` (#1168 B10a,
 * owner 2026-09-30: memory's `agents:` became `references`, "like todos").
 * A mapping needs colon-SPACE, YAML's own rule: `- github:litlfred` is a
 * scalar, not `{github: "litlfred"}`.
 */
export function mappingList(text: string, key: string): Record<string, string>[] {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!m) return [];
  const out: Record<string, string>[] = [];
  let inKey = false;
  for (const line of m[1]!.split("\n")) {
    const top = /^([A-Za-z$][\w$-]*):/.exec(line);
    if (top) {
      inKey = top[1] === key;
      continue;
    }
    if (!inKey) continue;
    const item = /^\s*-\s+([A-Za-z][\w-]*):[ \t]+(.*)$/.exec(line);
    if (item) {
      out.push({ [item[1]!]: stripQuotes(item[2]!.trim()) });
      continue;
    }
    const cont = /^\s+([A-Za-z][\w-]*):[ \t]+(.*)$/.exec(line);
    if (cont && out.length > 0) out[out.length - 1]![cont[1]!] = stripQuotes(cont[2]!.trim());
  }
  return out;
}
