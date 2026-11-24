/**
 * A feedback issue (from a site's 📣 link and the shared issue form,
 * `templates/issue-forms/block-feedback.yml`) as a Contributor Feedback row
 * of a drafting review sheet. The agent's sheet sync uses it: each new
 * feedback issue becomes one row, and that issue is the row's change-set
 * issue. Plain-body issues (a folio without the form) parse too.
 *
 * Skill: `review-sheet-script`, "Feedback from the site".
 */
import { bareName, buildToc } from "./build-review-sheet-script.js";

export type Feedback = {
  content?: string; section?: string; block?: string; url?: string; source?: string;
  type?: string; comment?: string; proposed?: string;
};

/** GitHub renders a form as `### <label>` then the value; an empty field is `_No response_`. */
const LABELS: Record<string, keyof Feedback> = {
  content: "content", section: "section", block: "block", "on the site": "url", source: "source",
  type: "type", comment: "comment", "proposed change": "proposed",
};

export function parseFeedbackIssue(body: string): Feedback {
  const out: Feedback = {};
  const set = (label: string, value: string) => {
    const k = LABELS[label.trim().toLowerCase()];
    const v = value.trim().replace(/^`(.*)`$/, "$1");
    if (k && v && v !== "_No response_" && !/^general \| technical \| editorial$/i.test(v)) out[k] = v;
  };
  if (/^###\s/m.test(body)) {
    for (const part of body.split(/^###\s+/m).slice(1)) {
      const nl = part.indexOf("\n");
      set(nl < 0 ? part : part.slice(0, nl), nl < 0 ? "" : part.slice(nl + 1));
    }
    return out;
  }
  // Plain body: "**Label:** value" lines, then free text under Comment / Proposed change.
  const re = /^\*\*([^*]+):\*\*[ \t]*(.*)$/gm;
  const hits = [...body.matchAll(re)];
  hits.forEach((m, i) => {
    const end = i + 1 < hits.length ? hits[i + 1].index! : body.length;
    const rest = body.slice(m.index! + m[0].length, end);
    set(m[1], (m[2] + rest).trim());
  });
  return out;
}

type Anchors = Parameters<typeof buildToc>[0] & { blocks?: { label: string; sections: string[] }[] };

export type FeedbackRow = { title: string; sections: string; feedback: string; issue: string };

/**
 * The sheet row for a feedback issue: Sections is the TOC entry of the
 * block's section (by the block's anchor, else by the section's name), Title
 * a draft from the section and the comment's first sentence (people may
 * rewrite it: Title is theirs), Contributor Feedback "@login (Type): comment".
 */
export function feedbackRow(issue: { body: string; url: string; login: string }, anchors: Anchors): FeedbackRow {
  const f = parseFeedbackIssue(issue.body);
  const toc = buildToc(anchors);
  const byAnchor = new Map(toc.map(([n, a]) => [a, n]));
  const sec = f.block ? anchors.blocks?.find((b) => b.label === f.block)?.sections[0] : undefined;
  const name = (sec && byAnchor.get(sec)) ?? toc.find(([n]) => f.section && bareName(n) === f.section.replace(/,/g, ";"))?.[0] ?? "";
  const first = (f.comment ?? "").split(/(?<=[.!?])\s|\n/)[0].trim();
  const short = first.length > 80 ? first.slice(0, 79).trimEnd() + "…" : first;
  // `name` is the dropdown value, marked under its chapter; the title takes it bare.
  const where = bareName(name) || f.section || "";
  return {
    title: [where, short].filter(Boolean).join(": "),
    sections: name,
    feedback: `@${issue.login}${f.type ? ` (${f.type})` : ""}: ${f.comment ?? ""}${f.proposed ? `\nProposed: ${f.proposed}` : ""}`,
    issue: issue.url,
  };
}

/** The Apps Script's hashOf (djb2, base 36), so the agent and the sheet agree on a basis. */
export function hashOf(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/**
 * What an agent proposal (`Feedback (agent)`, or `Change Set
 * Feedback (agent)` on Review Change Sets) was written against: a hash of the
 * row's blue cells, by header, the same hash the Apps Script's basisOf takes.
 * Drafting: Title, Selected Sections and every person's Contributor Feedback
 * column (`exact` Title and Selected Sections, `prefix` Contributor Feedback).
 * Public comment: `exact` Title and TWG (CS), `prefix` Committee Feedback (the columns were Architect Feedback until 2026-10-31; the script reads both),
 * and `grey` PC_BASIS_GREY (a "2:" basis, which also covers the joined grey
 * content).
 * The agent keeps it in the Agent tab's `Feedback basis (change set)`. While
 * the row's basis differs, the script marks the proposal stale; the agent's
 * next sync proposes again and writes the new basis. Picks are compared bare,
 * so the script's repair of a tree mark is no change. Empty cells are left
 * out, so a new empty column (another reviewer's initials) changes no row's
 * basis; the script still accepts a basis written the older way.
 */
export function feedbackBasis(header: string[], row: string[], exact = ["Title", "Selected Sections"], prefix = "Contributor Feedback", grey?: string[]): string {
  if (grey) exact = exact.concat(grey);
  const parts: string[] = [];
  header.forEach((h, i) => {
    let v = String(row[i] ?? "").trim();
    if (h === "Selected Sections") v = v.split(",").map(bareName).filter(Boolean).join(",");
    if ((exact.includes(h) || ((h === prefix || h.startsWith(`${prefix} (`)) && h !== `${prefix} (agent)`)) && v) parts.push(`${h}=${v}`);
  });
  return (grey ? "2:" : "") + hashOf(parts.join("\n"));
}

/**
 * The grey content columns a public-comment proposal also rests on, the
 * script's basisGrey with the default headers. Pass them as `grey` to write a
 * "2:" basis, which also goes stale when the comments a change set joins
 * change (owner, 2026-10-31).
 */
export const PC_BASIS_GREY = ["Sections", "Pages", "Public Comments", "Suggested Revisions", "PC Committee Feedback", "Dispositions", "TWG (PCs)"];
