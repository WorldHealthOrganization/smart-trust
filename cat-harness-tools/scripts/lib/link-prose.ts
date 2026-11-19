/**
 * Link the process ids and skill names in authored BPMN prose.
 *
 * Owner, 2026-10-31, on the public-comment page: *"why things like … the
 * same process as any content change (Process_ContentChangeReview) … Skill:
 * public-comment. not linked? … need QA to check for that too"*.
 * Documentation is written by hand, so the references in it were plain text.
 * They are linked where the page is generated, so no author writes a
 * relative URL that breaks when a page moves:
 *
 * - a process id (`Process_…`), bare or in backticks, that a loaded diagram
 *   declares, links to that diagram's page;
 * - a skill name in backticks, or listed after `Skill:` / `Skills:`, that has
 *   an instruction page, links to it.
 *
 * Text already inside a Markdown link is left alone. A process id, or a name
 * listed after `Skill:`, that cannot be linked is returned in `unlinked`:
 * that is the QA half, a reference to something that does not exist is a
 * finding rather than silent plain text. A backticked kebab word that is not
 * a skill is left as code and not reported; it may be any identifier.
 *
 * @module scripts/lib/link-prose
 */

const KEBAB = "[a-z0-9]+(?:-[a-z0-9]+)*";
const LINK = /(\[[^\]]*\]\([^)]*\))/;

export interface LinkedProse {
  text: string;
  /** `Process_…` ids and `skill:<name>` entries that could not be linked. */
  unlinked: string[];
}

export function linkProse(
  text: string,
  processHref: (id: string) => string | undefined,
  skillHref: (name: string) => string | undefined,
): LinkedProse {
  const unlinked = new Set<string>();
  const skillLink = (n: string, h: string): string => `[\`${n}\`](${h})`;

  const pass = (t: string, f: (t: string) => string): string =>
    t.split(LINK).map((x, i) => (i % 2 ? x : f(x))).join("");

  let out = text;
  // `Skill: a, b and c` — the names listed after the label.
  out = pass(out, (t) =>
    t.replace(
      new RegExp(`\\b(Skills?:[ \\t]*)((?:\`?${KEBAB}\`?(?:[ \\t]*(?:,|\\band\\b)[ \\t]*)?)+)`, "g"),
      (_m, label: string, list: string) =>
        label +
        list.replace(new RegExp(`\`?(${KEBAB})\`?`, "g"), (raw: string, n: string) => {
          if (n === "and") return raw;
          const h = skillHref(n);
          if (!h) {
            unlinked.add(`skill:${n}`);
            return raw;
          }
          return skillLink(n, h);
        }),
    ),
  );
  // Process ids, in backticks or bare.
  out = pass(out, (t) =>
    t.replace(/(`?)\b(Process_[A-Za-z0-9_]+)\b\1/g, (raw: string, tick: string, id: string) => {
      const h = processHref(id);
      if (!h) {
        unlinked.add(id);
        return raw;
      }
      return tick ? `[\`${id}\`](${h})` : `[${id}](${h})`;
    }),
  );
  // Any other backticked name that is a skill.
  out = pass(out, (t) =>
    t.replace(new RegExp(`\`(${KEBAB})\``, "g"), (raw: string, n: string) => {
      const h = skillHref(n);
      return h ? skillLink(n, h) : raw;
    }),
  );
  return { text: out, unlinked: [...unlinked] };
}

/**
 * Escape `<` and `>` in authored prose outside code spans, so Markdown shows
 * them as text.
 *
 * Owner, 2026-10-31, on the public-comment-release page: "misrendering". The
 * documentation said "a permanent PC/&lt;version&gt; site"; the BPMN entity
 * decodes to `<version>`, which kramdown read as an HTML element, so every
 * link after it on the page printed as raw `[text](url)`. Authored BPMN text
 * is prose, never HTML, so a bracket in it is always a character.
 */
export function escapeAngles(text: string): string {
  return text
    .split(/(`+[^`]*`+)/)
    .map((x, i) => (i % 2 ? x : x.replace(/</g, "&lt;").replace(/>/g, "&gt;")))
    .join("");
}
