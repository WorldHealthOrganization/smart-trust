#!/usr/bin/env bun
/**
 * public-comment-changesets — CHANGE-SETS for a public review: the record,
 * the GitHub issues that discuss each one, and the PRs that make the change
 * (issue #2183). Skill: `public-comment` §"Change-sets". Process:
 * `public-comment.bpmn`, Task_ProposeChangeSets and Task_GroupChangeSets.
 *
 * ## One record, everything else derived
 *
 * `<store>/changesets/CS-012.json` is the ONLY place a change-set's title,
 * requirements, members, status and issues are kept. A comment's change-sets
 * are derived from those files (`membership`), and an issue's change-set
 * section is rendered from one (`renderSection`), so neither can disagree with
 * the record for longer than one workflow run. The folio's public-comment
 * workflow is the only writer, one run at a time.
 *
 * ## Issues: none until somebody engages, then one primary and any number linked
 *
 * An agent proposes change-sets with no issue (`proposed`). The first time a
 * person engages with one, it gets its PRIMARY issue, where the record is
 * rendered and the requirements are agreed:
 *
 * - the dashboard's Discuss button opens the `change-set` issue form with
 *   `cs: CS-012`, and that issue is adopted;
 * - a recommendation or decision on one of its comments, from any thread or
 *   from the CLI, opens one (the nightly `reconcile` catches the CLI);
 * - a mention of it, or of one of its comments, in any issue opens one;
 * - a PR that names it opens one.
 *
 * People are disorganised, so any number of OTHER issues may discuss a
 * change-set too. Each is linked (`issues`), listed on the primary issue, and
 * pointed at it; nobody's own issue is rewritten.
 *
 * ## Commands, in a comment on an issue (committee and editor)
 *
 *   cs: CS-012                   which change-set, where the thread discusses several
 *   cs-add: PC-0311, PC-0312     add comments
 *   cs-remove: PC-0107           remove a comment
 *   cs-title: …                  rename
 *   cs-requirements: …           replace the requirements (the lines that follow)
 *   cs-committee: <TWG> — <why>  re-route to another committee, with a reason (person-only)
 *   cs-merge: CS-087             fold CS-087 into this change-set
 *   cs-split: PC-0311, PC-0312 as New title
 *   cs-close: reason             no change is needed
 *   cs-new: Title  (with pc: …)  a new change-set from these comments
 *
 * ## The CLI
 *
 *   seed [--out f.json]          comments in no change-set yet, bucketed by section
 *   propose --file p.json        record an agent's proposals ([{title, requirements, refs, anchor?}])
 *   add --title T --requirements R --refs PC-1,PC-2 [--anchor L]
 *   list                         every change-set, its status and issue
 *   body <CS-012>                its rendered issue section
 *   adopt <CS-012> --issue N     make an existing issue its primary one
 *   reroute <CS-012> --to <TWG> --why "reason" --by <login>
 *                                move a change-set to another committee (person-only)
 *   reopen <CS-012> --note "why"  back to discussing (closed or incorporated)
 *   check                        the records agree with each other (CI; no network)
 *   reconcile [--dry-run]        every issue agrees with its record (GITHUB_TOKEN)
 *   github --event e.json [--dry-run]   one issue, comment or PR event (the workflow)
 *   install [--assistant folio-assistant] [--force]
 *                                write the issue forms and the two workflows into the
 *                                folio's .github/, from templates/public-comment/
 *
 * Every command accepts `--repo <folio root>` and `--store <dir>`. Network
 * calls use `GITHUB_TOKEN` and `GITHUB_REPOSITORY` (or `repo` in config.json);
 * without them, or with `--dry-run`, the actions are printed, not taken.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { dashboardPageRoute } from "./public-comment-route.js";
import { changeSetRouting, commentRouting, type RoutingFile, TWG_GROUPS, twgGroup, type TwgGroup } from "./public-comment-routing.js";
import { documentPageDir } from "./document-site-route.js";
import {
  CHANGE_SET_SCHEMA,
  CHANGING_DECISIONS,
  ChangeSetSchema,
  type ChangeSet,
  type ChangeSetStatus,
  DECISION_CODES,
  formatRef,
  isAgent,
  OPEN_STATUSES,
  type PublicComment,
  transition,
} from "../schemas/public-comment.js";
import { applyTag, isCommittee, isEditor, parseGithubTag, Store, tagRefusal } from "./public-comment.js";

// ── The record ───────────────────────────────────────────────────

const dirOf = (store: Store) => join(store.dir, "changesets");
export const csId = (n: number) => `CS-${String(n).padStart(3, "0")}`;
const LIVE = (cs: ChangeSet) => cs.status !== "merged";

/** The statuses a reopened issue, or `reopen`, moves back to `discussing`. */
const REOPENABLE: readonly ChangeSetStatus[] = ["closed", "incorporated"];

/** Settled: no other PR may link it (bean 6xdf). The same set `reopen` undoes. */
const SETTLED = REOPENABLE;

export function changeSets(store: Store): ChangeSet[] {
  const d = dirOf(store);
  if (!existsSync(d)) return [];
  return readdirSync(d)
    .filter((f) => /^CS-\d+\.json$/.test(f))
    .sort()
    .map((f) => ChangeSetSchema.parse(JSON.parse(readFileSync(join(d, f), "utf-8"))));
}

export function getChangeSet(store: Store, id: string): ChangeSet {
  const p = join(dirOf(store), `${id}.json`);
  if (!existsSync(p)) throw new Error(`no change-set ${id}`);
  return ChangeSetSchema.parse(JSON.parse(readFileSync(p, "utf-8")));
}

export function saveChangeSet(store: Store, cs: ChangeSet): void {
  mkdirSync(dirOf(store), { recursive: true });
  writeFileSync(join(dirOf(store), `${cs.id}.json`), JSON.stringify(ChangeSetSchema.parse(cs), null, 2) + "\n");
}

const noted = (cs: ChangeSet, by: string, at: string, what: string, url?: string): ChangeSet => ({
  ...cs,
  history: [...cs.history, { at, by, what, ...(url ? { url } : {}) }],
});

/** The change-sets each comment is in: DERIVED from the records, never stored on the comment. */
export function membership(store: Store, all = changeSets(store)): Map<string, ChangeSet[]> {
  const m = new Map<string, ChangeSet[]>();
  for (const cs of all.filter(LIVE)) for (const r of cs.refs) (m.get(r) ?? m.set(r, []).get(r)!).push(cs);
  return m;
}

/** Where a comment sits, as the section a reader would look for: "4.3", "C · Client Registry", or "whole document". */
export function bucketOf(c: PublicComment, store: Store): { key: string; title: string } {
  const label = c.public.anchor.targetLabel;
  if (!label) return { key: "whole-document", title: "About the whole document" };
  const a = store.anchors();
  const secs = new Map(a.sections.map((s) => [s.label, s]));
  const block = a.blocks.find((b) => b.label === label);
  const path = block ? block.sections : [label];
  // The deepest NUMBERED section at most two levels down (4.3, not 4.3.2.1),
  // or an appendix component by its title: the unit a change-set usually spans.
  let best: { key: string; title: string } | undefined;
  for (const l of path) {
    const s = secs.get(l);
    if (!s) continue;
    if (s.number && s.number.split(".").length <= 2) best = { key: s.number, title: s.title };
    else if (!s.number && best && /^[A-Z]$/.test(best.key)) best = { key: `${best.key} · ${s.title}`, title: s.title };
  }
  if (best) return best;
  const ch = a.chapters.find((x) => x.label === label || x.dir === block?.chapter);
  return { key: ch?.dir ?? label, title: ch?.title ?? label };
}

/**
 * The agent's input: every open or decided comment in no change-set yet, in
 * buckets by section. A bucket is not a change-set: one section's comments
 * usually ask for several different changes, and one change sometimes spans
 * sections.
 */
export function seed(store: Store) {
  const taken = membership(store);
  const buckets = new Map<string, { key: string; title: string; comments: unknown[] }>();
  for (const c of store.all()) {
    if (!OPEN_STATUSES.includes(c.status) && c.status !== "decided") continue;
    if (taken.has(c.public.ref)) continue;
    const b = bucketOf(c, store);
    const entry = buckets.get(b.key) ?? { ...b, comments: [] };
    entry.comments.push({
      ref: c.public.ref,
      target: c.public.anchor.targetLabel,
      type: c.public.type,
      text: c.public.text,
      ...(c.public.suggestedRevision ? { suggested: c.public.suggestedRevision } : {}),
      ...(c.public.labels ? { labels: c.public.labels } : {}),
      ...(c.public.decision ? { decision: c.public.decision.code } : {}),
    });
    buckets.set(b.key, entry);
  }
  return [...buckets.values()].sort((x, y) => x.key.localeCompare(y.key, undefined, { numeric: true }));
}

export function addChangeSet(store: Store, p: { title: string; requirements: string; refs: string[]; anchor?: string; by: string; at: string; url?: string }): ChangeSet {
  const known = new Set(store.all().map((c) => c.public.ref));
  const unknown = p.refs.filter((r) => !known.has(r));
  if (unknown.length) throw new Error(`not comments in the store: ${unknown.join(", ")}`);
  if (!p.refs.length) throw new Error("a change-set needs at least one comment");
  const n = changeSets(store).reduce((m, cs) => Math.max(m, Number(cs.id.slice(3))), 0) + 1;
  const cs: ChangeSet = noted(
    {
      $schema: CHANGE_SET_SCHEMA,
      id: csId(n),
      title: p.title,
      requirements: p.requirements,
      refs: [...new Set(p.refs)],
      ...(p.anchor ? { anchor: p.anchor } : {}),
      status: "proposed",
      issues: [],
      committeeMoves: [],
      proposedBy: p.by,
      proposedAt: p.at,
      history: [],
    },
    p.by,
    p.at,
    `proposed with ${p.refs.length} comment(s)`,
    p.url,
  );
  saveChangeSet(store, cs);
  return cs;
}

/** The plurality committee rolled up from `refs` in `store` (before any manual override). */
export function derivedCommitteeOf(store: Store, refs: string[]): TwgGroup | null {
  const rf = join(store.dir, "routing.json");
  const routing = existsSync(rf) ? (JSON.parse(readFileSync(rf, "utf-8")) as RoutingFile) : undefined;
  const byRef = new Map(store.all().map((c) => [c.public.ref, commentRouting(c.public.labels, routing?.routings[c.public.ref])]));
  return changeSetRouting(refs, byRef).derived ?? null;
}

/**
 * Re-route a change-set to another review committee by hand (`Task_RerouteChangeSet`,
 * bean `se3i`, issue #197). Person-only: agents cannot make the move on their own.
 */
export function rerouteChangeSet(
  store: Store,
  csOrId: ChangeSet | string,
  p: { to: string; why: string; by: string; at: string; url?: string },
): ChangeSet {
  const who = p.by.trim();
  if (!who || isAgent(who)) {
    throw new Error("re-routing a change-set to another committee is a person-only step (Task_RerouteChangeSet); agents cannot make the move");
  }
  const group = twgGroup(p.to);
  if (!group) {
    throw new Error(`"${p.to}" is not a TWG committee; choose one of: ${TWG_GROUPS.join(", ")}`);
  }
  const why = p.why.trim();
  if (!why) {
    throw new Error("moving a change-set to another committee needs a reason");
  }
  const cs = typeof csOrId === "string" ? getChangeSet(store, csOrId) : csOrId;
  const from = cs.committee ?? derivedCommitteeOf(store, cs.refs);
  const move = { who, when: p.at, from, to: group, why, ...(p.url ? { url: p.url } : {}) };
  const next = noted(
    { ...cs, committee: group, committeeMoves: [...(cs.committeeMoves ?? []), move] },
    who,
    p.at,
    `rerouted committee ${from ?? "not routed"} → ${group}: ${why}`,
    p.url,
  );
  saveChangeSet(store, next);
  return next;
}

// ── The issue section ────────────────────────────────────────────

export const sectionStart = (id: string) => `<!-- public-comment-changeset ${id} -->`;
export const SECTION_END = "<!-- end public-comment-changeset -->";
const SECTION_RE = /<!-- public-comment-changeset (CS-\d+) -->[\s\S]*?<!-- end public-comment-changeset -->/;

export const issueTitle = (cs: ChangeSet) => `${cs.id}: ${cs.title}`;

const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const cell = (s: string) => s.replace(/\|/g, "\\|");

/** The URL that opens the Discuss form for a change-set, prefilled. */
export function discussUrl(repo: string, cs: Pick<ChangeSet, "id" | "title">): string {
  const q = new URLSearchParams({ template: "change-set.yml", title: issueTitle(cs as ChangeSet), cs: cs.id });
  return `https://github.com/${repo}/issues/new?${q}`;
}

/**
 * The change-set's section of its primary issue, rendered from the record.
 * Each comment's excerpt is clipped to keep the body under GitHub's
 * 65,536-character limit; the full text is one click away on the dashboard.
 */
export function renderSection(cs: ChangeSet, store: Store): string {
  const cfg = store.config();
  const site = (cfg.site ?? "").replace(/\/$/, "");
  const dash = `${site}/${dashboardPageRoute(store.repo, cfg.document)}/`;
  const byRef = new Map(store.all().map((c) => [c.public.ref, c]));
  const rows = cs.refs.map((ref) => {
    const c = byRef.get(ref);
    if (!c) return `| ${ref} | | (not in the store) | | |`;
    const label = c.public.anchor.targetLabel;
    const where = label ? (site ? `[${cell(clip(c.public.citation.raw || label, 40))}](${site}/${documentPageDir(cfg.document)}/#${label})` : cell(label)) : "whole document";
    const refLink = site ? `[${ref}](${dash}#${ref})` : ref;
    const state = c.public.decision ? `${c.status}: **${c.public.decision.code}**` : c.status;
    return `| ${refLink} | ${where} | ${state} | ${cell(clip(c.public.text, 200))} | ${cell(clip(c.public.suggestedRevision ?? "", 140))} |`;
  });
  const others = cs.issues.filter((n) => n !== cs.issue);
  const moves = cs.committeeMoves ?? [];
  return [
    sectionStart(cs.id),
    `> **Change-set ${cs.id}** · ${cs.status}${cs.committee ? ` · **${cs.committee}**` : ""} · ${cs.refs.length} comment(s)${site ? ` · [dashboard](${dash}#${cs.id})` : ""}`,
    "> This section is written from the change-set's record, so an edit to it here is replaced. Change it with the commands below; discuss it anywhere in this issue.",
    "",
    "### Requirements",
    "",
    cs.requirements,
    "",
    ...(cs.committee
      ? [
          "### Committee",
          "",
          `**${cs.committee}**`,
          ...(moves.length
            ? [
                "",
                ...moves.map((m) => `- ${m.from ?? "not routed"} → **${m.to}** by @${m.who} (${m.when.slice(0, 10)}): ${m.why}`),
              ]
            : []),
          "",
        ]
      : []),
    `### Comments (${cs.refs.length})`,
    "",
    `pc: ${cs.refs.join(", ")}`,
    "",
    "| Ref | Where | Status | Comment | Suggested revision |",
    "|---|---|---|---|---|",
    ...rows,
    "",
    ...(others.length ? ["### Also discussed in", "", others.map((n) => `#${n}`).join(", "), ""] : []),
    ...(cs.pr ? ["### Pull request", "", `#${cs.pr.number} (\`${cs.pr.branch}\`): preview, review and approve the change there.`, ""] : []),
    "<details><summary>How to work on this change-set</summary>",
    "",
    "- **Agree the requirements** in this thread.",
    "- **Recommend or decide** all its comments at once: a comment `decide: accepted` (or `recommend: …`), then the reason. Name some with `pc: PC-0042` first. Codes: " + DECISION_CODES.join(", ") + ".",
    "- **Change it** (committee and editor), in a comment: `cs-add: PC-…`, `cs-remove: PC-…`, `cs-title: …`, `cs-requirements:` and the new text on the lines below, `cs-committee: <TWG> — <reason>`, `cs-merge: CS-…`, `cs-split: PC-…, PC-… as New title`, `cs-close: reason`.",
    "- **Make the change** on a branch, in a PR whose body says `Closes #<this issue>`. Its staging preview is where the change is reviewed and approved.",
    "",
    "</details>",
    SECTION_END,
  ].join("\n");
}

/** Put `section` into `body`, replacing the change-set section it already has, or at the top. */
export function spliceBody(body: string | null | undefined, section: string): string {
  const b = (body ?? "").replace(/\r\n/g, "\n");
  if (SECTION_RE.test(b)) return b.replace(SECTION_RE, () => section);
  return b.trim() ? `${section}\n\n---\n\n${b.trim()}` : section;
}

/** The change-set section of a body, and the rest of it. */
export function splitBody(body: string | null | undefined): { id?: string; section?: string; rest: string } {
  const b = (body ?? "").replace(/\r\n/g, "\n");
  const m = SECTION_RE.exec(b);
  return m ? { id: m[1], section: m[0], rest: (b.slice(0, m.index) + b.slice(m.index + m[0].length)).trim() } : { rest: b };
}

// ── Issue forms ──────────────────────────────────────────────────

/**
 * The issue forms' field labels (`templates/public-comment/ISSUE_TEMPLATE/`),
 * mapped to the tag lines they stand for. A form renders as `### Label` and
 * the value; reading it as the same lines a person would type means one parser
 * for both.
 */
export const FORM_FIELDS: Record<string, "cs" | "pc" | "verb" | "code" | "title" | "requirements" | "text"> = {
  "change-set": "cs",
  comments: "pc",
  "recommend or decide": "verb",
  decision: "code",
  title: "title",
  requirements: "requirements",
  reason: "text",
  discussion: "text",
};

export function formFields(body: string): Partial<Record<(typeof FORM_FIELDS)[string], string>> | undefined {
  const out: Partial<Record<(typeof FORM_FIELDS)[string], string>> = {};
  let found = false;
  for (const m of body.replace(/\r\n/g, "\n").matchAll(/^###\s+(.+?)\s*\n([\s\S]*?)(?=^###\s|$(?![\s\S]))/gm)) {
    const key = FORM_FIELDS[m[1]!.toLowerCase().replace(/[?:]$/, "")];
    if (!key) continue;
    const v = m[2]!.trim();
    found = true;
    if (v && v !== "_No response_") out[key] = v;
  }
  return found ? out : undefined;
}

/** A body as the tag and command lines it stands for: a form's fields, or the body itself. */
export function canonicalText(body: string): string {
  const f = formFields(body);
  if (!f) return body;
  if (f.title) return [`cs-new: ${f.title}`, `pc: ${f.pc ?? ""}`, "cs-requirements:", f.requirements ?? "(to be agreed)", "", f.text ?? ""].join("\n");
  const lines: string[] = [];
  if (f.cs) lines.push(`cs: ${f.cs}`);
  if (f.pc) lines.push(`pc: ${f.pc}`);
  if (f.verb && f.code) lines.push(`${f.verb.toLowerCase().startsWith("dec") ? "decide" : "recommend"}: ${f.code}`);
  return [...lines, "", f.text ?? ""].join("\n");
}

// ── Commands ─────────────────────────────────────────────────────

export interface Command {
  cmd: "add" | "remove" | "title" | "requirements" | "committee" | "merge" | "split" | "close" | "new";
  arg: string;
}

const CMD_RE = /^\s*cs-(add|remove|title|requirements|committee|merge|split|close|new):\s*(.*)$/i;
const TAG_LINE_RE = /^\s*(cs|pc|recommend|decide):\s*/i;

function splitCommitteeLine(line: string): { to: string; why: string } {
  const m = /^(.+?)(?:\s+(?:[—–|]|--+|-)\s+|:\s+|\s+because\s+)(.+)$/i.exec(line);
  if (m) return { to: m[1]!.trim(), why: m[2]!.trim() };
  return { to: line.trim(), why: "" };
}

export function splitCommitteeArg(raw: string): { to: string; why: string } {
  const trimmed = raw.trim();
  const nl = trimmed.indexOf("\n");
  if (nl >= 0) {
    const first = trimmed.slice(0, nl).trim();
    const rest = trimmed.slice(nl + 1).trim();
    const inline = splitCommitteeLine(first);
    return { to: inline.to, why: [inline.why, rest].filter(Boolean).join("\n").trim() };
  }
  return splitCommitteeLine(trimmed);
}

export function parseCommands(text: string): Command[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: Command[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = CMD_RE.exec(lines[i]!);
    if (!m) continue;
    const cmd = m[1]!.toLowerCase() as Command["cmd"];
    let arg = m[2]!.trim();
    if (cmd === "requirements") {
      // The requirements are the rest of the line and every line after it, up
      // to the next command.
      const more: string[] = [];
      while (i + 1 < lines.length && !CMD_RE.test(lines[i + 1]!)) more.push(lines[++i]!);
      arg = [arg, ...more].join("\n").trim();
    } else if (cmd === "committee" && !splitCommitteeLine(arg).why) {
      // When the reason is written on the lines after `cs-committee: <TWG>`,
      // collect them up to the next command or tag line.
      const more: string[] = [];
      while (i + 1 < lines.length && !CMD_RE.test(lines[i + 1]!) && !TAG_LINE_RE.test(lines[i + 1]!)) more.push(lines[++i]!);
      if (more.join("\n").trim()) arg = [arg, ...more].join("\n").trim();
    }
    out.push({ cmd, arg });
  }
  return out;
}

const refsIn = (s: string) => [...new Set([...s.matchAll(/\bPC-?\s*(\d+)\b/gi)].map((m) => formatRef(Number(m[1]))))];
const csIn = (s: string) => [...new Set([...s.matchAll(/\bCS-?(\d+)\b/gi)].map((m) => csId(Number(m[1]))))];

/**
 * The change-sets a PR body links, by keyword only: `Closes CS-236`,
 * `fixes CS-12`, `resolves CS-7`, or a `cs: CS-236, CS-237` line. A PR that
 * merely MENTIONS an id in prose links nothing (bean 6xdf: smart-ra#24, a pin
 * bump whose body named CS-236 and CS-237, re-linked both).
 */
export function linkedChangeSets(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+CS-?(\d+)\b/gi)) out.add(csId(Number(m[1])));
  for (const m of body.matchAll(/^\s*cs:\s*(.+)$/gim)) for (const id of csIn(m[1]!)) out.add(id);
  return [...out];
}

/** The issues a PR body closes: `Closes #12`, `fixes #3`, `resolves #7`. */
export function closedIssues(body: string): number[] {
  return [...new Set([...body.matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)\b/gi)].map((m) => Number(m[1])))];
}

// ── GitHub events ────────────────────────────────────────────────

/**
 * What a run asks GitHub to do. The handler decides; `executeActions` does,
 * so the deciding is testable without a network, and a dry run prints it.
 */
export type GithubAction =
  | { kind: "create"; cs: string; notes: string[] }
  | { kind: "render"; cs: string }
  | { kind: "comment"; issue: number; body: string }
  | { kind: "state"; issue: number; state: "open" | "closed"; reason?: "completed" | "not_planned" };

export interface Outcome {
  log: string[];
  actions: GithubAction[];
  /** The thread the event happened in, for the reply. */
  thread?: number;
}

/** At most this many change-sets get a new issue from a MENTION alone; past it the reply lists them instead. */
export const MENTION_OPEN_LIMIT = 5;

interface Ctx {
  store: Store;
  login: string;
  association?: string;
  url: string;
  at: string;
  out: Outcome;
  all: ChangeSet[];
  creating: Set<string>;
}

const live = (x: Ctx) => x.all.filter(LIVE);
const find = (x: Ctx, id: string) => x.all.find((c) => c.id === id);
const put = (x: Ctx, cs: ChangeSet) => {
  saveChangeSet(x.store, cs);
  x.all = [...x.all.filter((c) => c.id !== cs.id), cs];
  return cs;
};
/** Follow `mergedInto` to the change-set that is live now. */
const current = (x: Ctx, id: string): ChangeSet | undefined => {
  let cs = find(x, id);
  for (let i = 0; cs && cs.status === "merged" && cs.mergedInto && i < 20; i++) cs = find(x, cs.mergedInto);
  return cs && LIVE(cs) ? cs : undefined;
};
const primaryOf = (x: Ctx, n: number) => live(x).find((c) => c.issue === n);
/** The change-set a thread is about: its primary one, or the only one it is linked to, or its PR's. */
const contextOf = (x: Ctx, n: number): ChangeSet | undefined => {
  const p = primaryOf(x, n);
  if (p) return p;
  const linked = live(x).filter((c) => c.issues.includes(n) || c.pr?.number === n);
  return linked.length === 1 ? linked[0] : undefined;
};
const render = (x: Ctx, cs: ChangeSet) => {
  if (cs.issue && !x.out.actions.some((a) => a.kind === "render" && a.cs === cs.id)) x.out.actions.push({ kind: "render", cs: cs.id });
};
/** The change-set has been engaged with: give it a primary issue if it has none. */
const engage = (x: Ctx, cs: ChangeSet, why: string) => {
  if (cs.issue) return render(x, cs);
  const pending = x.out.actions.find((a): a is Extract<GithubAction, { kind: "create" }> => a.kind === "create" && a.cs === cs.id);
  if (pending) pending.notes.push(why);
  else {
    x.creating.add(cs.id);
    x.out.actions.push({ kind: "create", cs: cs.id, notes: [why] });
  }
};
const adopt = (x: Ctx, cs: ChangeSet, n: number, why: string): ChangeSet => {
  const next = put(x, noted({ ...cs, issue: n, issues: [...new Set([...cs.issues, n])].sort((a, b) => a - b), status: cs.status === "proposed" ? "discussing" : cs.status }, x.login, x.at, why, x.url));
  x.out.log.push(`✓ ${cs.id}: discussed in #${n}`);
  render(x, next);
  return next;
};
const committee = (x: Ctx) => {
  const cfg = x.store.config();
  return isEditor(cfg, x.login, x.association) || isCommittee(cfg, x.login, x.association);
};

/** The commands in one comment or issue body, applied to `target` unless they name another. */
function applyCommands(x: Ctx, cmds: Command[], text: string, n: number, opts: { isBody: boolean }) {
  if (!cmds.length) return;
  if (!committee(x)) {
    x.out.log.push(`✗ ${x.login} is not on the committee, so \`cs-${cmds[0]!.cmd}\` changed nothing (anyone may discuss; the committee changes the record)`);
    return;
  }
  const named = /^\s*cs:\s*(.*)$/im.exec(text)?.[1];
  let target = named ? current(x, csIn(named)[0] ?? "") : contextOf(x, n);
  const known = new Set(x.store.all().map((c) => c.public.ref));
  const check = (refs: string[]) => {
    const bad = refs.filter((r) => !known.has(r));
    if (bad.length) x.out.log.push(`✗ not comments in the store: ${bad.join(", ")}`);
    return refs.filter((r) => known.has(r));
  };
  for (const c of cmds) {
    if (c.cmd === "new") {
      const refs = check(refsIn(/^\s*pc:\s*(.*)$/im.exec(text)?.[1] ?? ""));
      if (!refs.length) {
        x.out.log.push("✗ `cs-new` needs the comments on a `pc:` line");
        continue;
      }
      const req = cmds.find((k) => k.cmd === "requirements")?.arg || "(to be agreed)";
      let cs = addChangeSet(x.store, { title: c.arg || "Untitled change-set", requirements: req, refs, by: x.login, at: x.at, url: x.url });
      x.all.push(cs);
      x.out.log.push(`✓ ${cs.id}: new change-set, ${refs.length} comment(s)`);
      if (opts.isBody && !primaryOf(x, n)) cs = adopt(x, cs, n, `opened as its issue`);
      else engage(x, cs, `It was proposed by @${x.login} in ${x.url}.`);
      target = cs;
      continue;
    }
    if (!target) {
      x.out.log.push(`✗ \`cs-${c.cmd}\`: this thread is not one change-set's; name it with a \`cs: CS-012\` line`);
      continue;
    }
    let cs = target;
    const by = x.login;
    switch (c.cmd) {
      case "add": {
        const refs = check(refsIn(c.arg)).filter((r) => !cs.refs.includes(r));
        if (!refs.length) break;
        cs = noted({ ...cs, refs: [...cs.refs, ...refs] }, by, x.at, `added ${refs.join(", ")}`, x.url);
        x.out.log.push(`✓ ${cs.id}: added ${refs.join(", ")}`);
        break;
      }
      case "remove": {
        const refs = refsIn(c.arg).filter((r) => cs.refs.includes(r));
        if (!refs.length) break;
        cs = noted({ ...cs, refs: cs.refs.filter((r) => !refs.includes(r)) }, by, x.at, `removed ${refs.join(", ")}`, x.url);
        x.out.log.push(`✓ ${cs.id}: removed ${refs.join(", ")}${cs.refs.length ? "" : " (it holds no comment now; `cs-close` it or add some)"}`);
        break;
      }
      case "title":
        if (!c.arg) break;
        cs = noted({ ...cs, title: c.arg }, by, x.at, `renamed "${c.arg}"`, x.url);
        x.out.log.push(`✓ ${cs.id}: renamed`);
        break;
      case "requirements":
        if (cmds.some((k) => k.cmd === "new")) break;
        if (!c.arg) break;
        cs = noted({ ...cs, requirements: c.arg }, by, x.at, "requirements replaced", x.url);
        x.out.log.push(`✓ ${cs.id}: requirements replaced`);
        break;
      case "committee": {
        if (isAgent(by)) {
          x.out.log.push("✗ `cs-committee`: re-routing a change-set to another committee is a person-only step (Task_RerouteChangeSet); agents cannot make the move");
          break;
        }
        const { to, why } = splitCommitteeArg(c.arg);
        const group = twgGroup(to);
        if (!group) {
          x.out.log.push(`✗ \`cs-committee\`: "${to}" is not a TWG committee (choose one of: ${TWG_GROUPS.join(", ")})`);
          break;
        }
        if (!why) {
          x.out.log.push(`✗ \`cs-committee\`: moving ${cs.id} to ${group} needs a reason (e.g. \`cs-committee: ${group} — why\`)`);
          break;
        }
        const from = cs.committee ?? derivedCommitteeOf(x.store, cs.refs);
        const move = { who: by, when: x.at, from, to: group, why, ...(x.url ? { url: x.url } : {}) };
        cs = noted(
          { ...cs, committee: group, committeeMoves: [...(cs.committeeMoves ?? []), move] },
          by,
          x.at,
          `rerouted committee ${from ?? "not routed"} → ${group}: ${why}`,
          x.url,
        );
        x.out.log.push(`✓ ${cs.id}: committee ${from ?? "not routed"} → ${group} (${why})`);
        break;
      }
      case "merge": {
        for (const id of csIn(c.arg)) {
          const src = current(x, id);
          if (!src || src.id === cs.id) {
            x.out.log.push(`✗ ${id}: not a live change-set to merge`);
            continue;
          }
          cs = noted({ ...cs, refs: [...new Set([...cs.refs, ...src.refs])], issues: [...new Set([...cs.issues, ...src.issues])].sort((a, b) => a - b) }, by, x.at, `merged ${src.id} in`, x.url);
          // Its primary issue: adopted when this change-set has none, else closed with a pointer.
          if (!cs.issue && src.issue) cs = { ...cs, issue: src.issue, status: cs.status === "proposed" ? "discussing" : cs.status };
          else if (src.issue) {
            x.out.actions.push({ kind: "comment", issue: src.issue, body: `${src.id} was merged into ${cs.id}${cs.issue ? `, discussed in #${cs.issue}` : ""}. This issue stays linked to it.` });
            x.out.actions.push({ kind: "state", issue: src.issue, state: "closed", reason: "not_planned" });
          }
          put(x, noted({ ...src, status: "merged", mergedInto: cs.id, ...(src.issue === cs.issue ? { issue: undefined } : {}) }, by, x.at, `merged into ${cs.id}`, x.url));
          x.out.log.push(`✓ ${src.id} merged into ${cs.id}`);
        }
        break;
      }
      case "split": {
        const m = /^(.*?)\s+as\s+(.+)$/i.exec(c.arg);
        const refs = refsIn(m?.[1] ?? c.arg).filter((r) => cs.refs.includes(r));
        if (!refs.length) {
          x.out.log.push(`✗ \`cs-split\`: name comments of ${cs.id}, then \`as\` and the new title`);
          break;
        }
        cs = noted({ ...cs, refs: cs.refs.filter((r) => !refs.includes(r)) }, by, x.at, `split ${refs.join(", ")} out`, x.url);
        put(x, cs);
        const fresh = addChangeSet(x.store, { title: m?.[2]?.trim() || `Split from ${cs.id}`, requirements: `Split from ${cs.id}.\n\n${cs.requirements}`, refs, by, at: x.at, url: x.url });
        x.all.push(fresh);
        engage(x, fresh, `It was split from ${cs.id} by @${by} in ${x.url}.`);
        x.out.log.push(`✓ ${fresh.id}: split from ${cs.id} with ${refs.join(", ")}`);
        break;
      }
      case "close":
        if (cs.status === "editing") {
          x.out.log.push(`✗ ${cs.id}: PR #${cs.pr?.number} is making this change; close that first`);
          break;
        }
        cs = noted({ ...cs, status: "closed" }, by, x.at, `closed: ${c.arg || "no change needed"}`, x.url);
        if (cs.issue) x.out.actions.push({ kind: "state", issue: cs.issue, state: "closed", reason: "not_planned" });
        x.out.log.push(`✓ ${cs.id}: closed`);
        break;
    }
    target = put(x, cs);
    render(x, target);
  }
}

/** A recommend/decide tag, resolved against the change-sets. */
function applyTagIn(x: Ctx, text: string, n: number) {
  const tag = parseGithubTag(text);
  if (tag === null) return;
  if ("error" in tag) {
    x.out.log.push(`✗ ${tag.error}`);
    return;
  }
  const no = tagRefusal(x.store.config(), tag.verb, x.login, x.association);
  if (no) {
    x.out.log.push(`✗ ${no}`);
    return;
  }
  const refs = new Set(tag.refs);
  for (const id of tag.changeSets) {
    const cs = current(x, id);
    if (cs) cs.refs.forEach((r) => refs.add(r));
    else x.out.log.push(`✗ ${id}: no such change-set`);
  }
  for (const i of tag.issues) {
    const css = live(x).filter((c) => c.issues.includes(i) || c.issue === i);
    if (!css.length) x.out.log.push(`✗ #${i}: discusses no change-set`);
    css.forEach((c) => c.refs.forEach((r) => refs.add(r)));
  }
  if (!refs.size) {
    const cs = contextOf(x, n);
    if (!cs) {
      x.out.log.push("✗ the tag names no comment, and this thread is not one change-set's: add `pc: PC-0042` or `cs: CS-012`");
      return;
    }
    cs.refs.forEach((r) => refs.add(r));
  }
  const r = applyTag(x.store, tag, [...refs], x);
  for (const ref of r.applied) x.out.log.push(`✓ ${ref}: ${tag.verb === "decide" ? "decided" : "recommended"} ${tag.code}`);
  for (const e of r.refused) x.out.log.push(`✗ ${e}`);
  if (!r.applied.length) return;
  const m = membership(x.store, x.all);
  const touched = new Map<string, ChangeSet>();
  for (const ref of r.applied) for (const cs of m.get(ref) ?? []) touched.set(cs.id, cs);
  for (const cs of touched.values()) engage(x, cs, `@${x.login} ${tag.verb === "decide" ? "decided" : "recommended"} **${tag.code}** on ${cs.refs.filter((ref) => r.applied.includes(ref)).join(", ")} in ${x.url}:\n\n> ${tag.text.replace(/\n/g, "\n> ") || "(no reason given)"}`);
}

/** Every change-set a text mentions, directly or through one of its comments, is linked to issue `n`. */
function linkMentions(x: Ctx, text: string, n: number) {
  const m = membership(x.store, x.all);
  const ids = new Set<string>();
  for (const id of csIn(text)) {
    const cs = current(x, id);
    if (cs) ids.add(cs.id);
  }
  for (const ref of refsIn(text)) for (const cs of m.get(ref) ?? []) ids.add(cs.id);
  const linked: string[] = [];
  const toOpen: ChangeSet[] = [];
  for (const id of ids) {
    let cs = find(x, id)!;
    if (!cs.issues.includes(n)) {
      cs = put(x, noted({ ...cs, issues: [...cs.issues, n].sort((a, b) => a - b) }, x.login, x.at, `discussed in #${n}`, x.url));
      linked.push(cs.id);
      render(x, cs);
    }
    if (!cs.issue && !x.creating.has(cs.id)) toOpen.push(cs);
  }
  if (toOpen.length > MENTION_OPEN_LIMIT) {
    const repo = x.store.config().repo;
    x.out.log.push(
      `· ${toOpen.length} change-sets mentioned here have no issue yet, too many to open from one mention. Discuss one to open it:\n` +
        toOpen.map((c) => `  - ${c.id} ${c.title}${repo ? ` — [discuss](${discussUrl(repo, c)})` : ""}`).join("\n"),
    );
  } else for (const cs of toOpen) engage(x, cs, `It was raised in #${n} by @${x.login}: ${x.url}`);
  if (linked.length) x.out.log.push(`✓ #${n} linked to ${linked.map((id) => { const cs = find(x, id)!; return cs.issue && cs.issue !== n ? `${id} (discussed mainly in #${cs.issue})` : id; }).join(", ")}`);
}

/** Text written in issue `n`: a body (opened or edited) or a comment. */
function onText(x: Ctx, raw: string, n: number, opts: { isBody: boolean; isPr: boolean }) {
  const text = canonicalText(raw);
  // A Discuss form, or a body that opens with `cs: CS-012`: this issue is that change-set's.
  const named = opts.isBody ? /^\s*cs:\s*(CS-?\d+)\s*$/im.exec(text)?.[1] : undefined;
  if (named && !opts.isPr) {
    const cs = current(x, csIn(named)[0]!);
    if (!cs) x.out.log.push(`✗ ${named}: no such change-set`);
    else if (!cs.issue && !primaryOf(x, n)) adopt(x, cs, n, `#${n} opened as its issue`);
    else if (cs.issue && cs.issue !== n) x.out.log.push(`· ${cs.id} is discussed mainly in #${cs.issue}; this issue is linked to it, and what is recorded here counts`);
  }
  applyCommands(x, parseCommands(text), text, n, opts);
  applyTagIn(x, text, n);
  if (!opts.isPr) linkMentions(x, text, n);
}

/** The PR that makes a change-set's change: editing on open, incorporated on merge. */
function onPullRequest(x: Ctx, pr: { number: number; body: string; branch: string; merged: boolean; closed: boolean }) {
  const closes = closedIssues(pr.body);
  const ids = new Set<string>();
  for (const cs of live(x)) if (cs.issues.some((i) => closes.includes(i)) || (cs.issue && closes.includes(cs.issue))) ids.add(cs.id);
  for (const id of linkedChangeSets(pr.body)) {
    const cs = current(x, id);
    if (cs) ids.add(cs.id);
  }
  // A SETTLED change-set (incorporated, or closed) belongs to the PR that
  // settled it; another PR naming it re-links nothing (bean 6xdf). Reopening
  // its issue is how it becomes open to a new PR.
  for (const id of [...ids]) {
    const cs = find(x, id)!;
    if (SETTLED.includes(cs.status) && cs.pr?.number !== pr.number) {
      ids.delete(id);
      x.out.log.push(`· ${id}: ${cs.status}${cs.pr ? ` by PR #${cs.pr.number}` : ""}; PR #${pr.number} does not re-link it`);
    }
  }
  for (const id of ids) {
    let cs = find(x, id)!;
    if (pr.closed && !pr.merged) {
      if (cs.pr?.number !== pr.number) continue;
      cs = put(x, noted({ ...cs, pr: undefined, status: cs.status === "editing" ? "discussing" : cs.status }, x.login, x.at, `PR #${pr.number} closed without merging`, x.url));
      x.out.log.push(`✓ ${cs.id}: PR #${pr.number} closed unmerged; back to discussing`);
      render(x, cs);
      continue;
    }
    const changeSet = { branch: pr.branch, pr: pr.number };
    for (const ref of cs.refs) {
      let c = x.store.get(ref);
      const code = c.public.decision?.code;
      if (!code || !CHANGING_DECISIONS.includes(code)) {
        if (c.status !== "decided" && c.status !== "incorporated") x.out.log.push(`· ${ref}: not decided yet (${c.status})`);
        continue;
      }
      try {
        if (pr.merged) {
          if (c.status === "incorporated") continue;
          c = transition(c, "incorporate", { by: x.login, at: x.at, changeSet, note: `merged in PR #${pr.number}` });
        } else {
          if (c.status === "editing" && c.public.decision?.changeSet?.pr === pr.number) continue;
          c = transition(c, "edit", { by: x.login, at: x.at, changeSet, note: `PR #${pr.number}, ${cs.id}` });
        }
        x.store.save(c);
        x.out.log.push(`✓ ${ref}: ${pr.merged ? "incorporated" : "editing"} (PR #${pr.number})`);
      } catch (e) {
        x.out.log.push(`✗ ${ref}: ${(e as Error).message}`);
      }
    }
    // A merge settles the change-set only when every comment in it is settled
    // (decided, incorporated, duplicate or withdrawn). Before this, a merge
    // marked the whole set incorporated and closed its issue while most of
    // its comments were still undecided: CS-236 and CS-237 in smart-ra, 13 of
    // 15 comments `received` (D-1 of the 2026-10-06 walkthrough, bean uphx).
    const unsettled = cs.refs.filter((r) => { const st = x.store.get(r).status; return OPEN_STATUSES.includes(st) || st === "editing"; });
    const settled = unsettled.length === 0;
    if (pr.merged && !settled) x.out.log.push(`· ${cs.id}: PR #${pr.number} merged, but ${unsettled.length} of ${cs.refs.length} comment(s) are not decided; the change-set stays open`);
    const status: ChangeSetStatus = pr.merged
      ? settled ? "incorporated" : cs.status === "proposed" ? "discussing" : cs.status === "editing" ? "discussing" : cs.status
      : cs.status === "proposed" || cs.status === "discussing" ? "editing" : cs.status;
    if (cs.status !== status || cs.pr?.number !== pr.number) {
      cs = put(x, noted({ ...cs, pr: { number: pr.number, branch: pr.branch }, status }, x.login, x.at, pr.merged ? `PR #${pr.number} merged` : `PR #${pr.number} is making the change`, x.url));
      x.out.log.push(`✓ ${cs.id}: ${status} (PR #${pr.number})`);
    }
    engage(x, cs, `PR #${pr.number} is making this change.`);
    if (pr.merged && settled && cs.issue) x.out.actions.push({ kind: "state", issue: cs.issue, state: "closed", reason: "completed" });
  }
}

/** A primary issue closed or reopened by hand. */
function onIssueState(x: Ctx, n: number, action: "closed" | "reopened") {
  const cs = primaryOf(x, n);
  if (!cs) return;
  if (action === "reopened") {
    // A person reopening the issue says the change-set is not done, whether
    // it was closed or marked incorporated. Only `closed` moved back until
    // 2026-10-07, so reopening smart-ra #10 and #11 left CS-236 and CS-237
    // `incorporated` with their comments undecided (owner: "nothing has been
    // decided/incorporated").
    if (REOPENABLE.includes(cs.status)) {
      render(x, put(x, noted({ ...cs, status: "discussing" }, x.login, x.at, "reopened", x.url)));
      x.out.log.push(`✓ ${cs.id}: discussing again`);
    }
    return;
  }
  if (cs.status !== "discussing" && cs.status !== "proposed") return;
  const pending = cs.refs.map((r) => x.store.get(r)).filter((c) => !c.public.decision || CHANGING_DECISIONS.includes(c.public.decision.code));
  if (!pending.length) {
    render(x, put(x, noted({ ...cs, status: "closed" }, x.login, x.at, "closed: every comment decided without a change", x.url)));
    x.out.log.push(`✓ ${cs.id}: closed; no comment in it needs a change`);
    return;
  }
  x.out.actions.push({ kind: "state", issue: n, state: "open" });
  x.out.log.push(
    `✗ ${cs.id} still has ${pending.length} comment(s) undecided or accepted (${pending.slice(0, 10).map((c) => c.public.ref).join(", ")}${pending.length > 10 ? ", …" : ""}), so this issue was reopened. ` +
      "Decide them, make the change in a PR that closes this issue, or `cs-close: reason` if the change-set itself is not needed.",
  );
}

/**
 * One GitHub event, as the workflow's event file holds it. Saves the records
 * and returns what to tell GitHub; `executeActions` tells it.
 */
interface GhUser {
  login?: string;
  type?: string;
}
/** The fields of a GitHub event file this module reads; everything else is ignored. */
export interface GithubEvent {
  action?: string;
  sender?: GhUser;
  changes?: { body?: { from?: string } } & Record<string, unknown>;
  comment?: { body?: string; user?: GhUser; author_association?: string; html_url: string; created_at?: string; updated_at?: string };
  review?: unknown;
  issue?: { number: number; body?: string | null; user?: GhUser; author_association?: string; html_url: string; updated_at?: string; pull_request?: unknown };
  pull_request?: { number: number; body?: string | null; user?: GhUser; author_association?: string; html_url?: string; head?: { ref?: string }; merged?: boolean; state?: string };
}

export function handleGithubEvent(store: Store, ev: GithubEvent, now: string): Outcome {
  const out: Outcome = { log: [], actions: [] };
  if (ev?.sender?.type === "Bot") return out;
  const base = { store, at: now, out, all: changeSets(store), creating: new Set<string>() };
  if (ev.pull_request && !ev.comment && !ev.review) {
    const pr = ev.pull_request;
    const merged = Boolean(pr.merged);
    const closed = pr.state === "closed";
    out.thread = pr.number;
    if (ev.action === "edited" && ev.changes && !("body" in ev.changes)) return out;
    // Who is judged. A merge is the merger's act, and merging already needs
    // write access, so it is allowed and recorded under the merger. A PR
    // closed unmerged only undoes links this PR already holds. Anything else
    // (opened, edited, reopened, synchronize) links change-sets named in the
    // PR body and moves their comments, so it needs the PR AUTHOR to be on the
    // committee or an editor, judged by the author's own login and
    // association: the same standing comments and issue tags need.
    const author = pr.user?.login ?? "";
    const x: Ctx = merged
      ? { ...base, login: ev.sender?.login || author || "github", url: pr.html_url ?? `#${pr.number}` }
      : { ...base, login: author, association: pr.author_association, url: pr.html_url ?? `#${pr.number}` };
    if (!merged && !closed && !committee(x)) {
      out.log.push(`✗ PR #${pr.number}: ${author || "its author"} is not on the committee or an editor, so it links no change-set (a committee member can open the PR, or link it from the change-set's issue)`);
      return out;
    }
    onPullRequest(x, { number: pr.number, body: pr.body ?? "", branch: pr.head?.ref ?? "", merged, closed });
    return out;
  }
  if (ev.issue && ev.comment) {
    const c = ev.comment;
    const x: Ctx = { ...base, login: c.user?.login ?? "", association: c.author_association, url: c.html_url, at: c.updated_at ?? c.created_at ?? now };
    out.thread = ev.issue.number;
    onText(x, c.body ?? "", ev.issue.number, { isBody: false, isPr: Boolean(ev.issue.pull_request) });
    return out;
  }
  if (ev.issue) {
    const is = ev.issue;
    const n = is.number;
    out.thread = n;
    if (ev.action === "closed" || ev.action === "reopened") {
      // Recorded under who closed or reopened it; no role is judged here.
      onIssueState({ ...base, login: ev.sender?.login ?? is.user?.login ?? "", url: is.html_url, at: is.updated_at ?? now }, n, ev.action);
      return out;
    }
    // The login and the association are the same person's: the issue author's.
    // An edit by anyone else is judged by nobody's standing, so its text
    // records nothing (the change-set section is still restored below).
    const author = is.user?.login ?? "";
    const editor = ev.sender?.login ?? author;
    const byOther = ev.action === "edited" && editor !== author;
    const x: Ctx = { ...base, login: author, association: is.author_association, url: is.html_url, at: is.updated_at ?? now };
    const now_ = splitBody(is.body);
    if (ev.action === "edited") {
      if (ev.changes && !("body" in ev.changes)) return out;
      const before = splitBody(ev.changes?.body?.from);
      if (now_.section !== before.section && now_.id) {
        const cs = primaryOf(x, n);
        if (cs) {
          render(x, cs);
          out.log.push(`✗ the change-set section of this issue is written from ${cs.id}'s record, so the edit to it was replaced. Use \`cs-add\`, \`cs-remove\`, \`cs-title\` or \`cs-requirements\` in a comment instead; anything below the section is yours to edit.`);
        }
      }
      // Only what is NEW in the body counts: a tag already recorded is not recorded twice.
      if (now_.rest.trim() === before.rest.trim()) return out;
      if (byOther) {
        out.log.push(`✗ #${n} was edited by ${editor || "someone"}, not its author ${author || "(unknown)"}, so the edit records nothing; write tags and commands in a comment instead`);
        return out;
      }
    }
    // The body's own text, without the rendered section (which names every member).
    // An edit is a person's text and never re-adopts or re-runs commands.
    onText(x, now_.rest, n, { isBody: ev.action === "opened", isPr: false });
    return out;
  }
  return out;
}

// ── Doing it ─────────────────────────────────────────────────────

export interface GithubApi {
  createIssue(title: string, body: string, labels: string[]): Promise<number>;
  getIssue(n: number): Promise<{ body: string | null; state: string }>;
  updateIssue(n: number, patch: { body?: string; state?: "open" | "closed"; state_reason?: string }): Promise<void>;
  comment(n: number, body: string): Promise<void>;
}

export function restApi(repo: string, token: string): GithubApi {
  const call = async (method: string, path: string, body?: unknown) => {
    const r = await fetch(`https://api.github.com/repos/${repo}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    return r.status === 204 ? undefined : r.json();
  };
  return {
    async createIssue(title, body, labels) {
      try {
        return ((await call("POST", "/issues", { title, body, labels })) as { number: number }).number;
      } catch {
        // A label the repository does not have, or may not create: open it without.
        return ((await call("POST", "/issues", { title, body })) as { number: number }).number;
      }
    },
    async getIssue(n) {
      return (await call("GET", `/issues/${n}`)) as { body: string | null; state: string };
    },
    async updateIssue(n, patch) {
      await call("PATCH", `/issues/${n}`, patch);
    },
    async comment(n, body) {
      await call("POST", `/issues/${n}/comments`, { body });
    },
  };
}

/** Tell GitHub, in order. A created issue is recorded as its change-set's primary one at once. */
export async function executeActions(store: Store, actions: GithubAction[], api: GithubApi, by: string, now: string): Promise<string[]> {
  const log: string[] = [];
  for (const a of actions) {
    try {
      if (a.kind === "create") {
        let cs = getChangeSet(store, a.cs);
        if (cs.issue) continue;
        const n = await api.createIssue(issueTitle(cs), renderSection({ ...cs, status: "discussing" }, store), ["change-set"]);
        cs = noted({ ...cs, issue: n, issues: [...new Set([...cs.issues, n])].sort((p, q) => p - q), status: cs.status === "proposed" ? "discussing" : cs.status }, by, now, `issue #${n} opened`);
        saveChangeSet(store, cs);
        for (const note of a.notes) await api.comment(n, `Opened because somebody engaged with ${cs.id}. ${note}`);
        log.push(`✓ ${cs.id}: opened #${n}`);
      } else if (a.kind === "render") {
        const cs = getChangeSet(store, a.cs);
        if (!cs.issue) continue;
        const is = await api.getIssue(cs.issue);
        const body = spliceBody(is.body, renderSection(cs, store));
        if (body !== (is.body ?? "").replace(/\r\n/g, "\n")) await api.updateIssue(cs.issue, { body });
      } else if (a.kind === "comment") await api.comment(a.issue, a.body);
      else await api.updateIssue(a.issue, { state: a.state, ...(a.reason ? { state_reason: a.reason } : {}) });
    } catch (e) {
      log.push(`✗ ${a.kind} ${"cs" in a ? a.cs : `#${a.issue}`}: ${(e as Error).message}`);
    }
  }
  return log;
}

function apiFor(store: Store): GithubApi | undefined {
  const repo = process.env.GITHUB_REPOSITORY ?? store.config().repo;
  const token = process.env.GITHUB_TOKEN;
  return repo && token ? restApi(repo, token) : undefined;
}

/** `github --event`: handle, do, and answer on the thread. Exported for `public-comment.ts github`. */
export async function githubCommand(store: Store, eventFile: string, o: { dryRun?: boolean; now: string }) {
  const ev = JSON.parse(readFileSync(eventFile, "utf-8")) as GithubEvent;
  const out = handleGithubEvent(store, ev, o.now);
  const api = o.dryRun ? undefined : apiFor(store);
  const by = ev?.sender?.login ?? "github";
  const log = api ? [...out.log, ...(await executeActions(store, out.actions, api, by, o.now))] : out.log;
  for (const l of log) console.error(l);
  if (!api) {
    if (out.actions.length) console.log(JSON.stringify(out.actions, null, 1));
    return;
  }
  const said = log.filter((l) => /^[✓✗·]/.test(l));
  if (out.thread && said.length) await api.comment(out.thread, "Public-comment record:\n\n" + said.map((l) => `- ${l}`).join("\n")).catch(() => {});
}

// ── Keeping it honest ────────────────────────────────────────────

/**
 * Do the records agree with each other? No network, so CI can run it on every
 * PR. Errors are contradictions; warnings are work the reconcile will do.
 */
export function checkChangeSets(store: Store): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const d = dirOf(store);
  const all: ChangeSet[] = [];
  if (existsSync(d))
    for (const f of readdirSync(d).filter((f) => f.endsWith(".json")).sort()) {
      const r = ChangeSetSchema.safeParse(JSON.parse(readFileSync(join(d, f), "utf-8")));
      if (!r.success) errors.push(`${f}: ${r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
      else if (`${r.data.id}.json` !== f) errors.push(`${f}: holds ${r.data.id}`);
      else all.push(r.data);
    }
  const comments = new Map(store.all().map((c) => [c.public.ref, c]));
  const byId = new Map(all.map((c) => [c.id, c]));
  const primaries = new Map<number, string>();
  for (const cs of all) {
    const unknown = cs.refs.filter((r) => !comments.has(r));
    if (unknown.length) errors.push(`${cs.id}: not comments in the store: ${unknown.join(", ")}`);
    if (cs.status === "merged") {
      let t = cs.mergedInto ? byId.get(cs.mergedInto) : undefined;
      for (let i = 0; t && t.status === "merged" && i < 20; i++) t = t.mergedInto ? byId.get(t.mergedInto) : undefined;
      if (!t || t.status === "merged") errors.push(`${cs.id}: merged, but into no live change-set (${cs.mergedInto ?? "none named"})`);
      continue;
    }
    if (!cs.refs.length && cs.status !== "closed") errors.push(`${cs.id}: holds no comment; close it or add some`);
    if (cs.issue) {
      if (!cs.issues.includes(cs.issue)) errors.push(`${cs.id}: primary issue #${cs.issue} is not among its issues`);
      const other = primaries.get(cs.issue);
      if (other) errors.push(`${cs.id}: #${cs.issue} is already ${other}'s primary issue`);
      primaries.set(cs.issue, cs.id);
    }
    if (cs.status === "proposed" && cs.issue) errors.push(`${cs.id}: proposed, yet has issue #${cs.issue}`);
    if (cs.status !== "proposed" && !cs.issue) errors.push(`${cs.id}: ${cs.status}, yet has no issue`);
    if ((cs.status === "editing" || cs.status === "incorporated") && !cs.pr) errors.push(`${cs.id}: ${cs.status}, yet names no PR`);
    const engaged = cs.refs.filter((r) => comments.get(r)?.public.recommendations.length || comments.get(r)?.public.decision);
    if (cs.status === "proposed" && engaged.length) warnings.push(`${cs.id}: ${engaged.length} comment(s) recommended or decided, but no issue yet (the reconcile opens one)`);
    if (cs.status === "incorporated") {
      const left = cs.refs.filter((r) => {
        const c = comments.get(r);
        return c?.public.decision && CHANGING_DECISIONS.includes(c.public.decision.code) && c.status !== "incorporated";
      });
      if (left.length) warnings.push(`${cs.id}: incorporated, but ${left.join(", ")} not`);
    }
  }
  return { errors, warnings };
}

/**
 * The actions that make every issue agree with its record: each primary
 * issue's section re-rendered and its open/closed state set, and an issue
 * opened for every change-set somebody engaged with that has none.
 */
export function reconcilePlan(store: Store): GithubAction[] {
  const actions: GithubAction[] = [];
  const comments = new Map(store.all().map((c) => [c.public.ref, c]));
  for (const cs of changeSets(store)) {
    if (cs.status === "merged") continue;
    if (cs.issue) {
      actions.push({ kind: "render", cs: cs.id });
      actions.push({ kind: "state", issue: cs.issue, state: cs.status === "closed" || cs.status === "incorporated" ? "closed" : "open", ...(cs.status === "closed" ? { reason: "not_planned" as const } : cs.status === "incorporated" ? { reason: "completed" as const } : {}) });
      continue;
    }
    const engaged = cs.refs.filter((r) => comments.get(r)?.public.recommendations.length || comments.get(r)?.public.decision);
    if (engaged.length) actions.push({ kind: "create", cs: cs.id, notes: [`${engaged.join(", ")} ${engaged.length > 1 ? "were" : "was"} recommended or decided outside GitHub, so the nightly reconcile opened this issue.`] });
  }
  return actions;
}

/** For a state action: only patch when the issue is not already in that state. */
async function reconcile(store: Store, api: GithubApi, by: string, now: string): Promise<string[]> {
  const plan = reconcilePlan(store);
  const states: GithubAction[] = [];
  for (const a of plan.filter((a): a is Extract<GithubAction, { kind: "state" }> => a.kind === "state")) {
    const is = await api.getIssue(a.issue).catch(() => undefined);
    if (is && is.state !== a.state) states.push(a);
  }
  return executeActions(store, [...plan.filter((a) => a.kind !== "state"), ...states], api, by, now);
}

// ── Installing it in a folio ─────────────────────────────────────

/**
 * The issue forms and workflows a folio running a public review needs. Not a
 * content profile, so `folio_init` does not write them: a folio opts in.
 */
export const TEMPLATE_DIR = fileURLToPath(new URL("../templates/public-comment/github", import.meta.url));

export function installTemplates(repo: string, o: { assistant: string; force?: boolean }): { written: string[]; kept: string[] } {
  const walk = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
  const written: string[] = [];
  const kept: string[] = [];
  for (const src of walk(TEMPLATE_DIR)) {
    const rel = relative(TEMPLATE_DIR, src);
    const dest = join(repo, ".github", rel);
    if (existsSync(dest) && !o.force) {
      kept.push(rel);
      continue;
    }
    const text = readFileSync(src, "utf-8").replace(/\{\{(\w+)\}\}/g, (whole, name: string) => {
      if (name !== "assistant") throw new Error(`${rel}: unknown placeholder ${whole}`);
      return o.assistant;
    });
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, text);
    written.push(rel);
  }
  return { written, kept };
}

if (import.meta.main) {
  const [cmd, ...args] = process.argv.slice(2);
  const opt = (n: string) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const flag = (n: string) => args.includes(`--${n}`);
  const positional = args.find((a, i) => !a.startsWith("--") && (i === 0 || !args[i - 1]!.startsWith("--")));
  const store = Store.open(resolve(opt("repo") ?? process.cwd()), opt("store"));
  const at = new Date().toISOString();
  const by = opt("by") ?? process.env.GITHUB_ACTOR ?? "agent";
  try {
    switch (cmd) {
      case "seed": {
        const out = JSON.stringify(seed(store), null, 1);
        if (opt("out")) writeFileSync(resolve(opt("out")!), out + "\n");
        else console.log(out);
        break;
      }
      case "propose": {
        const file = opt("file");
        if (!file) throw new Error("propose --file proposals.json");
        const ps = JSON.parse(readFileSync(resolve(file), "utf-8")) as Array<{ title: string; requirements: string; refs: string[]; anchor?: string }>;
        for (const p of ps) addChangeSet(store, { ...p, by, at });
        console.error(`✓ ${ps.length} change-set(s) proposed`);
        break;
      }
      case "add": {
        const title = opt("title"), requirements = opt("requirements"), refs = opt("refs");
        if (!title || !requirements || !refs) throw new Error("add --title T --requirements R --refs PC-0001,PC-0002 [--anchor label] [--by who]");
        const cs = addChangeSet(store, { title, requirements, refs: refs.split(/[,\s]+/).filter(Boolean), ...(opt("anchor") ? { anchor: opt("anchor")! } : {}), by, at });
        console.error(`✓ ${cs.id}: ${cs.refs.length} comment(s), "${cs.title}"`);
        break;
      }
      case "list":
        for (const cs of changeSets(store)) console.log(`${cs.id}  ${cs.status.padEnd(12)} ${cs.issue ? `#${cs.issue}`.padEnd(6) : "—".padEnd(6)} ${String(cs.refs.length).padStart(3)}  ${cs.title}`);
        break;
      case "body": {
        console.log(renderSection(getChangeSet(store, positional ?? ""), store));
        break;
      }
      case "adopt":
      case "link": {
        const n = Number(opt("issue"));
        if (!positional || !n) throw new Error("adopt <CS-012> --issue N");
        const cs = getChangeSet(store, positional);
        saveChangeSet(store, noted({ ...cs, issue: n, issues: [...new Set([...cs.issues, n])].sort((a, b) => a - b), status: cs.status === "proposed" ? "discussing" : cs.status }, by, at, `#${n} adopted as its issue`));
        console.error(`✓ ${positional} → #${n}`);
        break;
      }
      case "reopen": {
        // The same move as reopening its issue, for when that event has
        // already been handled under the old rule.
        if (!positional) throw new Error('reopen <CS-012> --by <login> [--note "why"]');
        const cs = getChangeSet(store, positional);
        if (!REOPENABLE.includes(cs.status)) throw new Error(`${cs.id} is ${cs.status}; only ${REOPENABLE.join(" or ")} reopens`);
        saveChangeSet(store, noted({ ...cs, status: "discussing" }, by, at, opt("note") ?? "reopened"));
        console.error(`✓ ${cs.id}: discussing again`);
        break;
      }
      case "reroute":
      case "committee": {
        const to = opt("to") ?? opt("committee");
        const why = opt("why") ?? opt("reason") ?? opt("note");
        const who = opt("by") ?? process.env.GITHUB_ACTOR ?? "";
        if (!positional || !to) throw new Error('reroute <CS-012> --to <committee> --why "reason" --by <login>');
        const cs = rerouteChangeSet(store, positional, { to, why: why ?? "", by: who, at });
        const last = cs.committeeMoves.at(-1)!;
        console.error(`✓ ${cs.id}: committee ${last.from ?? "not routed"} → ${last.to} (${last.why})`);
        break;
      }
      case "check": {
        const r = checkChangeSets(store);
        for (const w of r.warnings) console.error(`· ${w}`);
        for (const e of r.errors) console.error(`✗ ${e}`);
        console.error(`${changeSets(store).length} change-set(s): ${r.errors.length} error(s), ${r.warnings.length} warning(s)`);
        if (r.errors.length) process.exit(1);
        break;
      }
      case "reconcile": {
        const api = flag("dry-run") ? undefined : apiFor(store);
        if (!api) {
          console.log(JSON.stringify(reconcilePlan(store), null, 1));
          break;
        }
        for (const l of await reconcile(store, api, by, at)) console.error(l);
        break;
      }
      case "install": {
        const r = installTemplates(resolve(opt("repo") ?? process.cwd()), { assistant: opt("assistant") ?? "folio-assistant", force: flag("force") });
        for (const f of r.written) console.error(`✓ .github/${f}`);
        for (const f of r.kept) console.error(`· .github/${f} exists; kept (--force replaces it)`);
        break;
      }
      case "github":
        await githubCommand(store, resolve(opt("event") ?? ""), { dryRun: flag("dry-run"), now: at });
        break;
      default:
        throw new Error(`unknown command "${cmd}". seed | propose | add | list | body | adopt | check | reconcile | github | install — see the module docblock.`);
    }
  } catch (e) {
    console.error(`✗ ${(e as Error).message}`);
    process.exit(1);
  }
}
