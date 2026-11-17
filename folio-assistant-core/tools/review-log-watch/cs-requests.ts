/**
 * Change sets are made by people (owner, 2026-11-02 07:07Z: "the making of CS
 * is human controlled. keep process similar to how Author/Contributors can
 * make new issues. also new PCs can come in that need to be triaged (into a
 * existing open CS, new CS) and have suggested committees"; Q-CS-1 C). A
 * person asks for a change set in one of three ways, and the watcher finds
 * each on its poll:
 *
 * 1. a row on Review Change Sets with only a Title (the sheet script gives it
 *    the id; the watcher records it on Agent - Change Sets);
 * 2. a `change-set` issue from `templates/issue-forms/change-set.yml`
 *    (`fromIssue`);
 * 3. a feedback cell that says so, e.g. "this CS needs to be split" (owner,
 *    07:17Z, "part of agentic watch") (`csRequest`).
 *
 * A request from 2 or 3 is answered with a proposal in the agent's feedback
 * cell (a "Decision needed:" question, lettered options, one recommended);
 * the watcher makes the change sets only once an Editor sets Ready for agent
 * to Yes. New public comments are triaged with `triage`: an open change set
 * whose sections they share, or a new one, with the committees (TWGs) of
 * that change set's comments. The agent writes the suggestion; a person's
 * Change Set (human) or TWG (human) always wins.
 *
 * It writes nothing. Skill: `review-log-watch` ("Change sets people make").
 * Process: `collab/processes/content/public-comment-change.bpmn`.
 */
import { readFileSync } from "node:fs";

export type CsKind = "new" | "split" | "merge" | "move";
export type CsRequest = { kind: CsKind; changeSets: string[]; comments: string[]; title?: string; committee?: string; details?: string };

const csIds = (t: string) => [...new Set((String(t).toUpperCase().match(/\bCS[- ]?\d+\b/g) || []).map(x => "CS-" + x.replace(/\D/g, "").padStart(3, "0")))];
const nos = (t: string) => [...new Set((String(t).match(/(?:No\.?|#|PC[- ]?)\s*(\d+)(?:\s*(?:,|and|to|–|-)\s*(\d+))*/gi) || []).flatMap(m => m.match(/\d+/g) || []))];

/**
 * Whether a person's feedback asks to split, merge, move or make a change
 * set. Only the person's words count: a cell's script and agent lines are
 * not passed in.
 */
export function csRequest(text: string): CsRequest | null {
  const t = String(text ?? "");
  const cs = String.raw`(?:\bCS\b|change[- ]?sets?|this set)`;
  const kinds: [CsKind, RegExp][] = [
    ["split", new RegExp(String.raw`\bsplit\b[^\n]*${cs}|${cs}[^\n]*\b(split|break (it )?up|separate)`, "i")],
    ["merge", new RegExp(String.raw`\b(merge|combine|join)\b[^\n]*${cs}|${cs}[^\n]*\b(merge|combine)`, "i")],
    ["move", new RegExp(String.raw`\bmove\b[^\n]*(\bto\b|\binto\b)[^\n]*${cs}|belongs? (in|to)[^\n]*${cs}`, "i")],
    ["new", new RegExp(String.raw`\b(new|own|separate)\s+${cs}|needs? (its|a) own ${cs}`, "i")],
  ];
  for (const [kind, re] of kinds) if (re.test(t)) return { kind, changeSets: csIds(t), comments: nos(t) };
  return null;
}

/** The fields of a `change-set` issue form, read from the issue body GitHub writes ("### Label" then the value). */
export function fromIssue(body: string): CsRequest | null {
  const field: Record<string, string> = {};
  const parts = String(body ?? "").split(/^###\s+/m).slice(1);
  for (const p of parts) {
    const [head, ...rest] = p.split("\n");
    const v = rest.join("\n").trim();
    field[head.trim().toLowerCase()] = v === "_No response_" ? "" : v;
  }
  const kindText = field["what do you need?"] ?? "";
  if (!kindText) return null;
  const kind: CsKind = /split/i.test(kindText) ? "split" : /merge/i.test(kindText) ? "merge" : /move/i.test(kindText) ? "move" : "new";
  return {
    kind,
    title: field["title"] || undefined,
    changeSets: csIds(field["change sets"] ?? ""),
    comments: (field["comments"] ?? "").match(/\d+/g) ?? [],
    committee: field["committee (twg)"] || undefined,
    details: field["details"] || undefined,
  };
}

export type OpenCs = { id: string; title?: string; sections: string[]; twgs: string[]; status?: string };
export type Suggestion = { cs: string; why: string; twgs: string[] };

const norm = (s: string) => String(s).toLowerCase().replace(/^[\s⠀]+/, "").replace(/\s+/g, " ").trim();
const DONE = /merged|completed|closed|withdrawn|reverted/i;

/**
 * Where a new comment should go: the open change sets that share most of its
 * sections, best first, and "new" when none does. A section matches its
 * chapter ("4.1 Scope" is in "4 Why"), so a comment on a subsection finds the
 * chapter's change set. The committees are those of the change set's
 * comments; for "new", the comment's own TWG (agent).
 */
export function triage(sections: string[], open: OpenCs[], ownTwg: string[] = []): Suggestion[] {
  const chap = (s: string) => (/^(\d+)/.exec(norm(s)) || [])[1];
  const want = sections.map(norm).filter(Boolean);
  const scored = open.filter(c => !DONE.test(c.status ?? "")).map(c => {
    const have = c.sections.map(norm);
    const exact = want.filter(w => have.includes(w));
    const near = want.filter(w => !have.includes(w) && chap(w) && have.some(h => chap(h) === chap(w)));
    return { c, exact, near, score: exact.length * 2 + near.length };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score || a.c.id.localeCompare(b.c.id));
  const out: Suggestion[] = scored.slice(0, 3).map(x => ({
    cs: x.c.id,
    why: x.exact.length ? `shares ${x.exact.join(", ")}` : `same chapter as ${x.near.join(", ")}`,
    twgs: x.c.twgs,
  }));
  out.push({ cs: "new", why: scored.length ? "or a change set of its own" : "no open change set covers its sections", twgs: ownTwg });
  return out;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (import.meta.main) {
  const [cmd] = process.argv.slice(2);
  if (cmd === "request") {
    console.log(JSON.stringify(csRequest(arg("text") ?? readFileSync(0, "utf8"))));
  } else if (cmd === "issue") {
    console.log(JSON.stringify(fromIssue(readFileSync(arg("body") ?? 0, "utf8"))));
  } else if (cmd === "triage") {
    const input = JSON.parse(readFileSync(arg("input") ?? 0, "utf8")) as { sections: string[]; open: OpenCs[]; twg?: string[] };
    console.log(JSON.stringify(triage(input.sections, input.open, input.twg ?? []), null, 2));
  } else {
    console.error("usage: cs-requests.ts request --text <feedback> | issue --body <file> | triage --input <json>");
    process.exit(2);
  }
}
