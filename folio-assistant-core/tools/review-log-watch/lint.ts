/**
 * Check a drafting review log's agent feedback against the fixed layout, the
 * row's Selected Sections, and the Agent tab's pull request states against
 * GitHub.
 *
 * Owner, 2026-11-01: "these feedback are not at all clear what agent asking
 * contributors to respond about". Q-FBK-1 A: a fixed cell layout (the ask
 * first), and a check the watcher runs on each poll so a cell that breaks it,
 * or a row whose pull request merged or closed while the sheet still says
 * open, is fixed by the watcher instead of found by a person.
 *
 * It writes nothing: it prints the problems, and the watcher fixes them.
 * Skill: `review-log-watch` ("Lint each poll") and `review-sheet-script`
 * ("The agent's feedback cell").
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

/** Lines the sheet script owns at the top of the cell: stale mark, ⏳ status, ↳ sub-lines. */
const SCRIPT_LINE = /^(⚠ Stale|⏳ |↳ )/;
const ASK = /^Decision needed\b[^\n]*:/;
const OPTION = /^\s*([A-H])[.)]\s+\S/;
/** Lines the agent writes, without the script's own. */
export function agentLines(text: string): string[] {
  const lines = String(text ?? "").split("\n");
  while (lines.length && SCRIPT_LINE.test(lines[0])) lines.shift();
  while (lines.length && !lines[0].trim()) lines.shift();
  return lines;
}

/** At most this many lines from the agent; a row shows about 10 (owner, 2026-10-31). */
export const MAX_LINES = 10;

/**
 * What is wrong with one Feedback (agent) cell, against the layout in the
 * `review-sheet-script` skill. `status` is the change set's Agentic status.
 */
export function feedbackProblems(text: string, status = ""): string[] {
  const body = agentLines(text);
  const out: string[] = [];
  if (!body.join("").trim()) return out;
  const askAt = body.findIndex(l => ASK.test(l));
  const needs = /needs (human|you)/i.test(status);
  if (needs && askAt < 0) out.push('Agentic status is Needs human, but the cell has no "Decision needed:" question. Write the question, or clear the status.');
  if (!needs && askAt >= 0) out.push('The cell asks a "Decision needed:" question, but Agentic status is not Needs human, so the Needs you filter misses it.');
  if (askAt > 0) out.push('"Decision needed:" must be the first thing the agent writes in the cell, so the ask is not buried.');
  if (askAt >= 0) {
    const block: string[] = [];
    for (let i = askAt + 1; i < body.length && body[i].trim(); i++) block.push(body[i]);
    const opts = block.filter(l => OPTION.test(l));
    if (opts.length < 2) out.push("The question has fewer than two lettered options (A., B., ...).");
    else if (opts.filter(l => /\(recommended\)/i.test(l)).length !== 1) out.push('Exactly one option must say "(recommended)".');
    if (!block.some(l => /answer in|ready for agent/i.test(l))) out.push('The question does not say where to answer ("Answer in your feedback column, then an Editor sets Ready for agent to Yes.").');
  }
  if (body.some(l => /^Decided\b/.test(l))) out.push("Decision history (\"Decided ...\") belongs in Disposition (agent), not in the feedback.");
  if (body.some(l => /\*\*[^*]+\*\*/.test(l))) out.push("Markdown ** does not render in Sheets; the script bolds tags itself.");
  if (body.some(l => /^(Step \d|Already done|Done:)/.test(l))) out.push('History lines ("Step n", "Already done", "Done:") do not belong here: say only what stands now.');
  const n = body.filter(l => l.trim()).length;
  if (n > MAX_LINES) out.push(`The cell has ${n} lines; keep it to ${MAX_LINES} so the row shows it whole.`);
  return out;
}

export type PrState = { state: "open" | "closed"; merged: boolean; files?: string[] };

/** The chapter number a section name sits in: "4.1 Scope" and "Ch 4 Why" are 4; unnumbered (Annex, Preface) is undefined. */
export function chapterOfSection(name: string): number | undefined {
  const m = /^\s*(?:ch(?:apter)?\.?\s*)?(\d+)(?:[.\s]|$)/i.exec(String(name).replace(/^[\s\u2800]+/, ""));
  return m ? Number(m[1]) : undefined;
}
/** The chapter number a changed file sits in, from a `ch4/`, `chapter-04/` or `ch04-...` path segment. */
export function chapterOfFile(path: string): number | undefined {
  const m = /(?:^|\/)ch(?:apter)?[-_]?0*(\d+)(?:\/|[-_.])/i.exec(path);
  return m ? Number(m[1]) : undefined;
}

/**
 * The row's Selected Sections bound the agent's work (owner, 2026-11-01:
 * "agents did not make use of selected sections. that should be controlled
 * better with skills/tools"; Q-FBK-3 A). A row with feedback but no section
 * must ask which; a PR that changes a chapter no selected section is in must
 * say so on an "Outside the selected sections:" line.
 */
export function sectionProblems(sections: string, feedback: string, prUrls: string[], states: Record<string, PrState>): string[] {
  const picked = String(sections ?? "").split(",").map(x => x.trim()).filter(Boolean);
  const body = agentLines(feedback).join("\n");
  const out: string[] = [];
  if (!picked.length) {
    if (body.trim() && !/^Decision needed\b[^\n]*:[^\n]*section/im.test(body))
      out.push('No Selected Sections: ask which sections in a "Decision needed:" question, or fill them in from the issue.');
    return out;
  }
  const chapters = picked.map(chapterOfSection);
  if (chapters.some(c => c === undefined)) return out;
  const declared = /^Outside the selected sections:/m.test(body);
  for (const url of prUrls) {
    const k = prKey(url);
    const files = (k && states[k]?.files) || [];
    const outside = [...new Set(files.map(chapterOfFile).filter((c): c is number => c !== undefined && !chapters.includes(c)))];
    if (outside.length && !declared)
      out.push(`${k} changes chapter ${outside.join(", ")}, outside the selected sections (${picked.join(", ")}); keep to them, or say so on an "Outside the selected sections:" line.`);
  }
  return out;
}

/** `owner/repo#n` from a pull request URL. */
export function prKey(url: string): string | undefined {
  const m = /github\.com\/([^/\s]+\/[^/\s]+)\/pull\/(\d+)/.exec(url);
  return m ? `${m[1]}#${m[2]}` : undefined;
}

/**
 * Where the Agent tab's status disagrees with GitHub. A merged PR recorded as
 * open (CS-001: "dth-hrh#61 open" after it merged and was being reverted) is
 * the case this catches. Statuses that already say what happened (merged,
 * reverted, split, committee) are left alone.
 */
export function prStateProblems(status: string, prUrls: string[], states: Record<string, PrState>): string[] {
  const out: string[] = [];
  const said = /merged|revert|split|committee|withdrawn|closed/i.test(status);
  for (const url of prUrls) {
    const k = prKey(url);
    const s = k ? states[k] : undefined;
    if (!k || !s) continue;
    if (s.merged && !said) out.push(`${k} is merged on GitHub, but the status says "${status || "(blank)"}".`);
    else if (s.state === "closed" && !s.merged && !said) out.push(`${k} is closed without merging on GitHub, but the status says "${status || "(blank)"}".`);
    else if (s.state === "open" && /\bmerged\b/i.test(status) && !/revert/i.test(status)) out.push(`${k} is still open on GitHub, but the status says "${status}".`);
  }
  return out;
}

/** Rows of a tab as header → cell, from the Sheets `values` array (header found by its first cell). */
export function rowsOf(values: string[][], first = "Change-set"): Record<string, string>[] {
  const h = values.findIndex(r => String(r[0] ?? "").trim() === first);
  if (h < 0) return [];
  const head = values[h].map(c => String(c ?? "").trim());
  return values.slice(h + 1).map(r => Object.fromEntries(head.map((c, i) => [c, String(r[i] ?? "")])));
}

export type Lint = { cs: string; problems: string[] };

export function lint(feedback: string[][], agent: string[][], states: Record<string, PrState>): Lint[] {
  const statusOf: Record<string, string> = {};
  const prsOf: Record<string, string[]> = {};
  for (const r of rowsOf(agent)) {
    const cs = r["Change-set"].trim();
    if (!cs) continue;
    statusOf[cs] = r["Agentic status"] ?? "";
    prsOf[cs] = (r["Pull request (change set)"] ?? "").split(/\s+/).filter(u => prKey(u));
  }
  const out: Lint[] = [];
  for (const r of rowsOf(feedback)) {
    const cs = r["Change-set"].trim();
    if (!cs) continue;
    const problems = [
      ...feedbackProblems(r["Feedback (agent)"] ?? "", statusOf[cs] ?? ""),
      ...prStateProblems(statusOf[cs] ?? "", prsOf[cs] ?? [], states),
      ...sectionProblems(r["Selected Sections"] ?? "", r["Feedback (agent)"] ?? "", prsOf[cs] ?? [], states),
    ];
    if (problems.length) out.push({ cs, problems });
  }
  return out;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const valuesOf = (p: string): string[][] => { const raw = JSON.parse(readFileSync(p, "utf8")); return Array.isArray(raw) ? raw : raw.values ?? []; };

if (import.meta.main) {
  const fb = arg("feedback"), ag = arg("agent");
  if (!fb || !ag) {
    console.error("usage: lint.ts --feedback contributor-feedback.json --agent agent.json [--prs states.json]");
    process.exit(2);
  }
  const feedback = valuesOf(fb), agent = valuesOf(ag);
  const states: Record<string, PrState> = arg("prs") ? JSON.parse(readFileSync(arg("prs")!, "utf8")) : {};
  if (!arg("prs")) {
    const keys = new Set(rowsOf(agent).flatMap(r => (r["Pull request (change set)"] ?? "").split(/\s+/)).map(prKey).filter(Boolean) as string[]);
    for (const k of keys) {
      const [repo, n] = k.split("#");
      const pr = JSON.parse(execFileSync("gh", ["api", `repos/${repo}/pulls/${n}`], { encoding: "utf8" }));
      const files = pr.state === "open" ? (JSON.parse(execFileSync("gh", ["api", "--paginate", `repos/${repo}/pulls/${n}/files?per_page=100`, "--jq", "[.[].filename]"], { encoding: "utf8" }).trim().replace(/\]\s*\[/g, ",")) as string[]) : [];
      states[k] = { state: pr.state, merged: !!pr.merged, files };
    }
  }
  const result = lint(feedback, agent, states);
  console.log(JSON.stringify({ status: result.length ? "problems" : "clean", rows: result }, null, 2));
  process.exit(result.length ? 10 : 0);
}
