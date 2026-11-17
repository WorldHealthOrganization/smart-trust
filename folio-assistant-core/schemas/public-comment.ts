/**
 * A comment returned during a PUBLIC REVIEW of a frozen, line-numbered draft:
 * a row of a comment matrix, an online-form response, a passage of a
 * narrative letter, or a GitHub comment from a review-committee member.
 * Bean `v26p`, issue #197.
 *
 * @module folio-assistant-core/schemas/public-comment
 * @graphNode schema
 *
 * ## One Finding store, two intake routes
 *
 * `review-comment.ts` is the in-flight route: a reviewer tags a pull-request
 * comment with a block label, against the CURRENT folio. This is the other
 * route, and the two differ in the one way that matters:
 *
 * - a review comment names a block LABEL, so its anchor is given;
 * - a public comment cites the REVIEW VERSION: "§3.4.5, p.22, l.618–624",
 *   "Table 3.1", or nothing at all. Its anchor has to be RESOLVED, through the
 *   page/line map `docx-to-folio.ts` writes (`folio-review-anchors/v1`), and
 *   it can fail to resolve.
 *
 * So the citation is kept exactly as the reviewer wrote it, and the anchor is
 * a separate, revisable judgement with its method and confidence. A comment
 * whose anchor cannot be resolved is `unplaced`, never dropped: a reviewer's
 * words are kept (the same rule `review-comment.ts` applies to orphans).
 *
 * Both are todo kinds (`nodeKind` over `TodoNodeKind`), so the board, the heat
 * map and anything else that reads todos reads these without knowing them.
 *
 * ## The lifecycle, and who moves it
 *
 * Owner, issue #197: *"show all comments that are on a page, at a line
 * number, re-assign a comment to a more appropriate place, triage a comment,
 * assign a comment to another collaborator"*, and for smart-ra (2026-10-04) a
 * REVIEW COMMITTEE that recommends, and an EDITOR who decides.
 *
 *     received ─triage→ triaged ─assign→ assigned ─recommend→ recommended
 *         │                │                 │                    │
 *         └──────────── decide (editor) ─────┴────────────────────┘
 *                               ↓
 *                            decided ─edit→ editing ─incorporate→ incorporated   (accepted*)
 *
 * `edit` is the AUTHOR's step, human or agentic (owner, 2026-10-04: *"include
 * in process author edits (agentic or human) once feedback/comment has been
 * dispensed"*): the decision is made, and someone now makes the change on a
 * feature branch. It names that branch, so the comment shows where its change
 * is being made while it is made.
 *
 * plus `duplicate` and `withdrawn` from any open state. Every move is a task
 * in `public-comment.bpmn` or its change phase, `public-comment-change.bpmn`,
 * and {@link transition} refuses any other, for the
 * reason `review-comment.ts` gives: a status is what the dashboard counts, and
 * a comment closed outside the process would count as adjudicated when no one
 * in a review lane decided anything.
 *
 * `reassign` (move the anchor) and `recommend` (a second recommendation) do
 * not change status when repeated; they are recorded in `history` all the
 * same, so an anchor's every move is visible.
 *
 * ## The decision codes
 *
 * Owner, 2026-10-04: the five of a WHO public consultation. Anything but
 * `accepted` REQUIRES a reason, because "not accepted" with no reason is the
 * one answer a public commenter is owed an explanation for.
 *
 * ## Privacy
 *
 * A folio's repository is usually public. The reviewer's EMAIL is never
 * stored. Their NAME is stored only when they answered the matrix's
 * acknowledgement question "Yes"; otherwise only organisation and country,
 * and a stable pseudonymous `id` (a hash), so their comments can still be
 * grouped. The original spreadsheet, which does hold the email, belongs in
 * the private intake store, not in the folio (see the `public-comment` skill).
 */
import { createHash } from "node:crypto";
import { z } from "zod";

import { nodeKind } from "@litlfred/cat-harness-tools/schemas/kg/node-kind.js";
import { RenderedImpactSchema } from "@litlfred/cat-harness-tools/schemas/ui/rendered-impact.js";
import { TodoNodeKind } from "@litlfred/cat-harness-tools/schemas/sdlc/todo.js";

export const PUBLIC_COMMENT_SCHEMA = "public-comment/1.0.0" as const;

export const PUBLIC_COMMENT_STATUSES = [
  "received",
  "triaged",
  "assigned",
  "recommended",
  "decided",
  "editing",
  "incorporated",
  "duplicate",
  "withdrawn",
] as const;
export type PublicCommentStatus = (typeof PUBLIC_COMMENT_STATUSES)[number];

/** Not yet decided: still needs the review to act. */
export const OPEN_STATUSES: readonly PublicCommentStatus[] = ["received", "triaged", "assigned", "recommended"];
/** Decided to change the document, and the change has not landed yet. */
export const IN_EDIT_STATUSES: readonly PublicCommentStatus[] = ["editing"];

/** The comment matrix's three types (its Instructions tab defines them). */
export const PUBLIC_COMMENT_TYPES = ["general", "technical", "editorial"] as const;
export type PublicCommentType = (typeof PUBLIC_COMMENT_TYPES)[number];

/** Owner-ruled, 2026-10-04. */
export const DECISION_CODES = ["accepted", "accepted-modified", "not-accepted", "noted", "deferred"] as const;
export type DecisionCode = (typeof DECISION_CODES)[number];
export const DECISION_LABELS: Record<DecisionCode, string> = {
  accepted: "Accepted",
  "accepted-modified": "Accepted with modification",
  "not-accepted": "Not accepted",
  noted: "Noted, no change needed",
  deferred: "Deferred to a future version",
};
/** Decisions that change the document, so the comment is not done until the change lands. */
export const CHANGING_DECISIONS: readonly DecisionCode[] = ["accepted", "accepted-modified"];

export const INTAKE_CHANNELS = ["comment-matrix", "online-form", "narrative", "github", "manual"] as const;

export const ANCHOR_METHODS = [
  "page-line", // page and line(s) of the review PDF
  "page", // a page with no usable line: the page's first block, preferring the cited section
  "caption", // "Table 3.1" / "Figure 2.2"
  "section", // only a section number resolved
  "quote", // a quotation in the comment found in the text
  "manual", // a person set it (reassign)
  "unplaced", // nothing resolved: kept, shown, waiting for triage
] as const;
export type AnchorMethod = (typeof ANCHOR_METHODS)[number];

// ── Transitions ──────────────────────────────────────────────────

export interface ProcessTask {
  process: string;
  task: string;
}
export interface PublicCommentTransition {
  name: string;
  from: readonly (PublicCommentStatus | null)[];
  to: PublicCommentStatus | "same";
  by: ProcessTask & { file: string };
}

const P = { file: "public-comment.bpmn", process: "Process_PublicComment" } as const;
/** The change phase, drawn on its own page and called from Process_PublicComment. */
const C = { file: "public-comment-change.bpmn", process: "Process_PublicCommentChange" } as const;
const OPEN = OPEN_STATUSES;

/** Every move there is. A test holds each `task` to one that exists in the diagram. */
export const PUBLIC_COMMENT_TRANSITIONS: readonly PublicCommentTransition[] = [
  { name: "ingest", from: [null], to: "received", by: { ...P, task: "Task_Ingest" } },
  { name: "triage", from: ["received", "triaged"], to: "triaged", by: { ...P, task: "Task_Triage" } },
  { name: "reassign", from: [...OPEN, "decided"], to: "same", by: { ...P, task: "Task_Triage" } },
  { name: "assign", from: ["triaged", "assigned", "recommended"], to: "assigned", by: { ...P, task: "Task_Assign" } },
  { name: "recommend", from: ["assigned", "recommended"], to: "recommended", by: { ...P, task: "Task_CommitteeRecommends" } },
  { name: "decide", from: [...OPEN], to: "decided", by: { ...P, task: "Task_EditorDecides" } },
  // From editing and incorporated too: a decision that was never an
  // editor's (the master log's status, imported as one until 2026-10-07)
  // is taken back wherever it got to. The history keeps every step.
  { name: "reopen", from: ["decided", "editing", "incorporated"], to: "triaged", by: { ...P, task: "Task_EditorDecides" } },
  { name: "edit", from: ["decided", "editing"], to: "editing", by: { ...C, task: "Task_AuthorEdits" } },
  { name: "incorporate", from: ["decided", "editing"], to: "incorporated", by: { ...C, task: "Task_Incorporate" } },
  { name: "duplicate", from: [...OPEN], to: "duplicate", by: { ...P, task: "Task_Triage" } },
  { name: "withdraw", from: [...OPEN], to: "withdrawn", by: { ...P, task: "Task_Withdraw" } },
];

// ── Schema ───────────────────────────────────────────────────────

/** As the reviewer wrote it. Never rewritten; the anchor is the judgement. */
export const CitationSchema = z.object({
  section: z.string().optional(),
  page: z.string().optional(),
  lines: z.string().optional(),
  /** "Table 3.1" / "Figure 2.2" as parsed from the line or comment. */
  caption: z.string().optional(),
  /** The cell or phrase exactly as given. */
  raw: z.string().optional(),
});
export type Citation = z.infer<typeof CitationSchema>;

export const AnchorSchema = z.object({
  /** A block or section label in the folio; null when unplaced. */
  targetLabel: z.string().min(1).nullable(),
  method: z.enum(ANCHOR_METHODS),
  confidence: z.enum(["high", "medium", "low"]),
  /** Other plausible targets, for triage to choose between. */
  candidates: z.array(z.string()).default([]),
  /** Why, in a sentence a triager can check. */
  note: z.string().optional(),
});
export type Anchor = z.infer<typeof AnchorSchema>;

export const SourceSchema = z.object({
  channel: z.enum(INTAKE_CHANNELS),
  /** The intake batch: a file name, a form export, a letter. */
  batch: z.string().min(1),
  /** sha256 of the intake file, so a re-import is recognised. */
  sha256: z.string().optional(),
  sheet: z.string().optional(),
  row: z.number().int().positive().optional(),
  /**
   * The log's OWN number for the row ("No."), within its sheet. A review log
   * is re-sent as it is worked, so a later copy is a different file with the
   * same rows: this, with the sheet and the series, is what recognises them.
   */
  entry: z.string().optional(),
  /** The log this row belongs to, across the copies of it that are re-sent. */
  series: z.string().optional(),
  /** For a narrative: which passage of the letter this comment is. */
  segment: z.number().int().nonnegative().optional(),
  /** For a GitHub comment: its URL. */
  url: z.string().url().optional(),
  receivedAt: z.string().optional(),
});

export const ReviewerSchema = z.object({
  /** Stable pseudonym: a hash of the normalised email or name. */
  id: z.string().min(1),
  /** Only when `acknowledge` is true. */
  name: z.string().optional(),
  organisation: z.string().optional(),
  country: z.string().optional(),
  acknowledge: z.boolean().optional(),
  github: z.string().optional(),
});

export const RecommendationSchema = z.object({
  /** GitHub login of the committee member. */
  by: z.string().min(1),
  role: z.string().min(1).default("review-committee-member"),
  code: z.enum(DECISION_CODES),
  rationale: z.string().default(""),
  /** The issue or PR comment it was given in. */
  url: z.string().url().optional(),
  at: z.string().min(1),
});

export const ChangeSetRefSchema = z.object({
  branch: z.string().min(1),
  pr: z.number().int().positive().optional(),
  /** The staging preview of the change set. */
  stagingUrl: z.string().url().optional(),
  /** Before/after deep links to the comment's anchor. */
  before: z.string().url().optional(),
  after: z.string().url().optional(),
});

export const DecisionSchema = z.object({
  code: z.enum(DECISION_CODES),
  reason: z.string().default(""),
  by: z.string().min(1),
  at: z.string().min(1),
  /** Where the change is made, for a decision that changes the document. */
  changeSet: ChangeSetRefSchema.optional(),
});

export const HistoryEntrySchema = z.object({
  at: z.string().min(1),
  transition: z.string().min(1),
  by: z.string().min(1),
  task: z.string().min(1),
  note: z.string().optional(),
});

export const PublicFieldsSchema = z.object({
  /** "PC-0042": the number a committee and a commenter refer to. */
  ref: z.string().regex(/^PC-\d{4,}$/),
  source: SourceSchema,
  reviewer: ReviewerSchema,
  citation: CitationSchema,
  anchor: AnchorSchema,
  type: z.enum(PUBLIC_COMMENT_TYPES).optional(),
  /** The comment as written. */
  text: z.string().min(1),
  suggestedRevision: z.string().optional(),
  /**
   * Categorisations the intake log carried, keyed by its column header and
   * kept verbatim: a theme, a stakeholder type, a review question, a priority,
   * a committee routing. Read, never re-coded, so a log can grow a column
   * without a schema change.
   */
  labels: z.record(z.string(), z.string()).optional(),
  assignees: z.array(z.string()).default([]),
  recommendations: z.array(RecommendationSchema).default([]),
  decision: DecisionSchema.optional(),
  duplicateOf: z.string().optional(),
  /** GitHub issue holding this comment's discussion, once one is opened. */
  discussion: z.string().url().optional(),
  history: z.array(HistoryEntrySchema).default([]),
});
export type PublicFields = z.infer<typeof PublicFieldsSchema>;

export const PublicCommentKind = nodeKind(
  PUBLIC_COMMENT_SCHEMA,
  [TodoNodeKind],
  {
    /** The anchor's target, mirrored for todo readers; null when unplaced. */
    targetLabel: z.string().min(1).nullable(),
    status: z.enum(PUBLIC_COMMENT_STATUSES),
    public: PublicFieldsSchema,
  },
  { overrides: ["targetLabel", "status"] },
);

export const PublicCommentSchema = PublicCommentKind.schema.superRefine((c, ctx) => {
  const d = c.public.decision;
  if ((c.status === "decided" || c.status === "editing" || c.status === "incorporated") && !d) {
    ctx.addIssue({ code: "custom", path: ["public", "decision"], message: `a ${c.status} comment carries the editor's decision` });
  }
  if (d && d.code !== "accepted" && !d.reason.trim()) {
    ctx.addIssue({ code: "custom", path: ["public", "decision", "reason"], message: `"${DECISION_LABELS[d.code]}" needs a reason` });
  }
  if ((c.status === "incorporated" || c.status === "editing") && d && !CHANGING_DECISIONS.includes(d.code)) {
    ctx.addIssue({ code: "custom", path: ["status"], message: `only an accepted comment is ${c.status}; this one is ${d.code}` });
  }
  if (c.status === "editing" && !d?.changeSet?.branch) {
    ctx.addIssue({ code: "custom", path: ["public", "decision", "changeSet"], message: "a comment being edited names the branch the edit is on" });
  }
  if (c.status === "duplicate" && !c.public.duplicateOf) {
    ctx.addIssue({ code: "custom", path: ["public", "duplicateOf"], message: "a duplicate names the comment it duplicates" });
  }
  if (c.targetLabel !== c.public.anchor.targetLabel) {
    ctx.addIssue({ code: "custom", path: ["targetLabel"], message: "targetLabel mirrors public.anchor.targetLabel" });
  }
});
export type PublicComment = z.infer<typeof PublicCommentSchema>;

// ── Moving a comment ─────────────────────────────────────────────

export interface TransitionInput {
  by: string;
  at: string;
  note?: string;
  anchor?: Anchor;
  assignees?: string[];
  /** `at` defaults to the transition's. */
  recommendation?: Omit<z.input<typeof RecommendationSchema>, "at"> & { at?: string };
  /** `at` and `by` default to the transition's. */
  decision?: Omit<z.input<typeof DecisionSchema>, "at" | "by"> & { at?: string; by?: string };
  type?: PublicCommentType;
  priority?: string;
  duplicateOf?: string;
  changeSet?: z.input<typeof ChangeSetRefSchema>;
}

/**
 * Apply the named transition. Throws unless `PUBLIC_COMMENT_TRANSITIONS`
 * holds it from the comment's current status, and the result validates.
 */
export function transition(c: PublicComment, name: string, input: TransitionInput): PublicComment {
  const t = PUBLIC_COMMENT_TRANSITIONS.find((x) => x.name === name);
  if (!t) throw new Error(`no public-comment transition named \`${name}\``);
  if (!t.from.includes(c.status)) {
    const allowed = PUBLIC_COMMENT_TRANSITIONS.filter((x) => x.from.includes(c.status)).map((x) => x.name);
    throw new Error(`${c.public.ref}: cannot ${name} from ${c.status}. From ${c.status}: ${allowed.join(", ") || "nothing — it is closed"}.`);
  }
  const pub: PublicFields = { ...c.public, history: [...c.public.history] };
  let priority = c.priority;
  switch (name) {
    case "triage":
      if (input.type) pub.type = input.type;
      if (input.priority) priority = input.priority;
      if (input.anchor) pub.anchor = input.anchor;
      break;
    case "reassign":
      if (!input.anchor) throw new Error(`${pub.ref}: reassign needs the new anchor`);
      pub.anchor = { ...input.anchor, method: "manual" };
      break;
    case "assign":
      if (!input.assignees?.length) throw new Error(`${pub.ref}: assign needs at least one assignee`);
      pub.assignees = [...new Set(input.assignees)];
      break;
    case "recommend":
      if (!input.recommendation) throw new Error(`${pub.ref}: recommend needs the recommendation`);
      pub.recommendations = [
        // One live recommendation per committee member: a later one replaces theirs.
        ...pub.recommendations.filter((r) => r.by !== input.recommendation!.by),
        RecommendationSchema.parse({ ...input.recommendation, at: input.recommendation.at ?? input.at }),
      ];
      break;
    case "decide":
      if (!input.decision) throw new Error(`${pub.ref}: decide needs the decision`);
      pub.decision = DecisionSchema.parse({ ...input.decision, at: input.decision.at ?? input.at, by: input.decision.by ?? input.by });
      break;
    case "reopen":
      pub.decision = undefined;
      break;
    case "edit":
      if (!pub.decision) throw new Error(`${pub.ref}: nothing decided to edit`);
      if (!input.changeSet?.branch) throw new Error(`${pub.ref}: edit names the feature branch the change is made on`);
      pub.decision = { ...pub.decision, changeSet: ChangeSetRefSchema.parse({ ...pub.decision.changeSet, ...input.changeSet }) };
      if (input.assignees?.length) pub.assignees = [...new Set(input.assignees)];
      break;
    case "incorporate":
      if (!pub.decision) throw new Error(`${pub.ref}: nothing decided to incorporate`);
      if (!input.changeSet && !pub.decision.changeSet) throw new Error(`${pub.ref}: incorporate names the change set`);
      pub.decision = { ...pub.decision, ...(input.changeSet ? { changeSet: ChangeSetRefSchema.parse({ ...pub.decision.changeSet, ...input.changeSet }) } : {}) };
      break;
    case "duplicate":
      if (!input.duplicateOf) throw new Error(`${pub.ref}: duplicate names the comment it duplicates`);
      pub.duplicateOf = input.duplicateOf;
      break;
  }
  pub.history.push({ at: input.at, transition: name, by: input.by, task: `${t.by.process}#${t.by.task}`, ...(input.note ? { note: input.note } : {}) });
  return PublicCommentSchema.parse({
    ...c,
    priority,
    status: t.to === "same" ? c.status : t.to,
    targetLabel: pub.anchor.targetLabel,
    public: pub,
  });
}

// ── Citations ────────────────────────────────────────────────────

/** "618–624", "618-24", "l. 618", "618, 620–622" → [[618,624]] etc. */
export function parseLines(s: string | undefined): Array<[number, number]> {
  if (!s) return [];
  const out: Array<[number, number]> = [];
  for (const m of s.replace(/[–—]/g, "-").matchAll(/(\d{1,5})\s*(?:-\s*(\d{1,5}))?/g)) {
    const a = Number(m[1]);
    let b = m[2] ? Number(m[2]) : a;
    // "618-24" means 618–624.
    if (m[2] && m[2].length < m[1].length) b = Number(m[1].slice(0, m[1].length - m[2].length) + m[2]);
    if (b >= a && b - a < 2000) out.push([a, b]);
  }
  return out;
}

/** A table or figure reference anywhere in a cell or comment: "Table 3.1", "Fig. 2.2", "Figure A.1". */
export function parseCaptionRef(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const m = /\b(Table|Tab\.|Figure|Fig\.?)\s*([A-Z]?\.?\d+(?:\.\d+)*|[A-Z])\b/i.exec(s);
  if (!m) return undefined;
  return `${/^tab/i.test(m[1]) ? "Table" : "Figure"} ${m[2]}`;
}

/** "§3.4.5", "Section 3.4.5", "3.4.5." → "3.4.5". "Appendix C" → "C". */
export function parseSection(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const app = /appendix\s+([A-Z])\b/i.exec(s);
  if (app) return app[1].toUpperCase();
  const m = /((?:[A-Z]\.)?\d+(?:\.\d+)*)/.exec(s);
  return m ? m[1].replace(/\.$/, "") : undefined;
}

export const reviewerId = (key: string) =>
  `r-${createHash("sha256").update(key.trim().toLowerCase()).digest("hex").slice(0, 10)}`;

export const formatRef = (n: number) => `PC-${String(n).padStart(4, "0")}`;

// ── Change-sets (issue #2183) ────────────────────────────────────

export const CHANGE_SET_SCHEMA = "changeset/1.0.0" as const;

/** The fixed TWG review committees (DPI-H §4/§10), most specific first: the tie-break order. */
export const TWG_GROUPS = [
  "Metadata registries",
  "Supply chain",
  "Financial systems",
  "Clinical",
  "WHO",
  "Core architects",
  "Editorial",
  "No",
] as const;
export type TwgGroup = (typeof TWG_GROUPS)[number];

/** An agent wrote it; anything else is a person's override. */
export const isAgent = (by: string) => /(^|-)agent$|^claude/i.test(by);

/**
 * One manual re-route of a change-set to another committee (bean `se3i`,
 * issue #197). `Task_RerouteChangeSet` in `public-comment.bpmn` is a
 * person-only `userTask`, so `who` is never an agent.
 */
export const ChangeSetCommitteeMoveSchema = z.object({
  who: z.string().min(1),
  when: z.string().min(1),
  from: z.enum(TWG_GROUPS).nullable(),
  to: z.enum(TWG_GROUPS),
  why: z.string().min(1),
  /** The GitHub comment or issue it came from, when moved on GitHub. */
  url: z.string().url().optional(),
});
export type ChangeSetCommitteeMove = z.infer<typeof ChangeSetCommitteeMoveSchema>;

/**
 * Where a change-set is. `proposed`: drafted, nobody has engaged, so it has no
 * issue. `discussing`: it has a primary issue. `editing`: a PR names it.
 * `incorporated`: that PR merged. `merged`: folded into another change-set
 * (`mergedInto`). `closed`: decided to need no change.
 */
export const CHANGE_SET_STATUSES = ["proposed", "discussing", "editing", "incorporated", "merged", "closed"] as const;
export type ChangeSetStatus = (typeof CHANGE_SET_STATUSES)[number];

export const ChangeSetHistorySchema = z.object({
  at: z.string().min(1),
  by: z.string().min(1),
  what: z.string().min(1),
  /** The GitHub comment, issue or PR it came from. */
  url: z.string().url().optional(),
});

/**
 * One change to a folio (issue #2183; made general, issue #971, bean `bnjs`).
 *
 * Born answering a group of public comments, and still that in a
 * public-comment folio; since 2026-10-06 it is the Change Set for ANY folio
 * change (owner: "generalize/apply concept from Ref Arch"). A change that
 * answers no comment has empty `refs`. It applies to the MATERIALISED folio,
 * never to the `library/` source it was materialised from.
 *
 * THIS FILE IS THE ONLY RECORD of a change-set: its title, requirements,
 * members, status and issues. A comment's change-sets are DERIVED from these
 * files, and an issue body's change-set section is RENDERED from one, so
 * neither can disagree with it for longer than one workflow run. Only the
 * folio's public-comment workflow writes it; people ask for changes with
 * `cs-*` commands on its issue.
 *
 * Every change-set people have engaged with has exactly ONE primary `issue`,
 * where the record is rendered and the requirements are agreed. Any number of
 * other issues may discuss it (`issues`), because people are disorganised and
 * that is fine: each is linked and pointed at the primary one.
 */
const ChangeSetFields = {
  /** "CS-001". */
  id: z.string().regex(/^CS-\d{3,}$/),
  title: z.string().min(1),
  /** What the change should do, in the editor's terms: the issue's requirements. */
  requirements: z.string().min(1),
  /**
   * The comments it answers, if any. A comment may be in more than one
   * change-set. Empty for a change that answers no public comment.
   */
  refs: z.array(z.string().regex(/^PC-\d{4,}$/)).default([]),
  /** The section or block the change is mainly about, for ordering. */
  anchor: z.string().optional(),
  status: z.enum(CHANGE_SET_STATUSES).default("proposed"),
  /** The primary issue: where the change-set is rendered and its requirements agreed. */
  issue: z.number().int().positive().optional(),
  /** Every issue that discusses it, the primary one included. */
  issues: z.array(z.number().int().positive()).default([]),
  /** The PR making the change. */
  pr: z.object({ number: z.number().int().positive(), branch: z.string().min(1) }).optional(),
  /** For `merged`: the change-set it was folded into. */
  mergedInto: z.string().regex(/^CS-\d{3,}$/).optional(),
  /**
   * The review committee (TWG sub-group) a person routed this change-set to by
   * hand (bean `se3i`, issue #197), overriding the plurality rolled up from its
   * comments. Stored on the change-set record so re-ingesting comments never
   * resets it.
   */
  committee: z.enum(TWG_GROUPS).optional(),
  /** Every manual committee re-route (`who`, `when`, `from`, `to`, `why`), oldest first. */
  committeeMoves: z.array(ChangeSetCommitteeMoveSchema).default([]),
  proposedBy: z.string().min(1),
  proposedAt: z.string().min(1),
  history: z.array(ChangeSetHistorySchema).default([]),
  /**
   * What the change does to each rendered site: one `rendered-impact/v1` per
   * renderer that builds the folio, cone-predicted when the PR opens and
   * checked against a build diff (skill `rendered-impact`). Review approves
   * against these lists. Absent until a PR exists.
   */
  rendered: z.array(RenderedImpactSchema).optional(),
};

/**
 * The change-set as a NODE KIND (issue #2195), found through the
 * `public-comments` typology's family of its tag. No parents — a change-set
 * groups public comments; it is not itself a comment or a todo. Its `$schema`
 * is generated from the versioned id, so the schema below has ONE source.
 */
export const ChangeSetKind = nodeKind(CHANGE_SET_SCHEMA, [], ChangeSetFields);
export const ChangeSetSchema = ChangeSetKind.schema.superRefine((cs, ctx) => {
  const last = cs.committeeMoves.at(-1);
  if (cs.committee && !last) {
    ctx.addIssue({ code: "custom", path: ["committeeMoves"], message: "a manually routed change-set records the move (who, when, from, to, why)" });
  }
  if (last && cs.committee !== last.to) {
    ctx.addIssue({ code: "custom", path: ["committee"], message: `committee must match the latest move's destination (${last.to})` });
  }
  cs.committeeMoves.forEach((m, i) => {
    if (!m.why.trim()) {
      ctx.addIssue({ code: "custom", path: ["committeeMoves", i, "why"], message: "moving a change-set to another committee needs a reason" });
    }
    if (isAgent(m.who)) {
      ctx.addIssue({ code: "custom", path: ["committeeMoves", i, "who"], message: "re-routing a change-set to another committee is a person-only step; agents cannot make the move" });
    }
  });
});
export type ChangeSet = z.infer<typeof ChangeSetSchema>;

// ── Review logs (issue #682) ─────────────────────────────────────

export const REVIEW_LOG_SCHEMA = "review-log/1.0.0" as const;

/**
 * Who fills a column, read from the colour of its header: blue = a person
 * (the reviewers, the committee), orange = an Editor, green = the agent,
 * grey = the review sheet's script. The import writes only `human` cells.
 */
export const REVIEW_LOG_COLUMN_ROLES = ["human", "editor", "agent", "script"] as const;
export type ReviewLogColumnRole = (typeof REVIEW_LOG_COLUMN_ROLES)[number];

export const ReviewLogColumnSchema = z.object({
  header: z.string(),
  /** Absent when the header carries no role colour. */
  role: z.enum(REVIEW_LOG_COLUMN_ROLES).optional(),
});

export const ReviewLogTabSchema = z.object({
  name: z.string().min(1),
  /** 1-based row of the column headers (a tab may open with an instructions row). */
  headerRow: z.number().int().positive(),
  rows: z.number().int().nonnegative(),
  columns: z.array(ReviewLogColumnSchema),
});

/**
 * One review log (a Google Sheet) of the document, as a NODE beside its
 * comments and change-sets (owner, 2026-11-08: "part of the KG of a working
 * doc - where its issue log(s) are"). Its workbook, `file`, sits beside it and
 * is overwritten each night the log changed: git history is the history, so
 * there is no list of snapshots (owner, same day). The workbook is .xlsx, a
 * file a person opens in Excel, Google Sheets or Numbers, never a custom JSON.
 */
export const ReviewLogKind = nodeKind(REVIEW_LOG_SCHEMA, [], {
  /** The log's id within the document (`dpi-h-master`); also its file names. */
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  title: z.string().min(1),
  /** The Google Sheets id. */
  sheetId: z.string().min(1),
  url: z.string().url(),
  /** The document under review (`dpi-h-ra`). */
  document: z.string().min(1),
  /** A master log of public comments, or a contributor (drafting) log. */
  role: z.enum(["master", "contributor"]),
  /** The workbook, relative to the repository root. */
  file: z.string().regex(/\.xlsx$/),
  /** SHA-256 of `file` as last written. */
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  /** When `file` last changed (ISO 8601). */
  archivedAt: z.string().min(1),
  tabs: z.array(ReviewLogTabSchema).min(1),
  /**
   * What was left out of the workbook so that no reviewer's contact details
   * reach the repository: the columns blanked, and how many email addresses
   * were removed from other cells.
   */
  redacted: z.object({ columns: z.array(z.string()).default([]), emails: z.number().int().nonnegative().default(0) }),
});
export const ReviewLogSchema = ReviewLogKind.schema;
export type ReviewLog = z.infer<typeof ReviewLogSchema>;
