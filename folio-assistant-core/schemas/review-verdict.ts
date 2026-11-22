/**
 * A reviewer's VERDICT on one version of one block: "I read this, and here is
 * my judgement". Bean `px0t`, epic `q4jm`.
 *
 * @module folio-assistant-core/schemas/review-verdict
 * @graphNode schema
 *
 * ## Why this exists
 *
 * `content-change-review.bpmn`'s coverage gate (`GW_Covered`) asks whether
 * every changed block has been reviewed. Review COMMENTS cannot answer that:
 * a block with no comments may be unread or may be fine, and a block whose
 * comments are all resolved has had its questions answered, not its content
 * judged. Only a record of the judgement answers it.
 *
 * ## The write channel: a tagged PR comment (owner, 2026-09-23)
 *
 * Asked how a reviewer records one, the owner chose option 1: the same
 * channel as a review comment, so nothing new has to be learned or installed.
 *
 * ```
 * block: prose:dose prose:schedule
 * verdict: ok
 * role: clinical-sme
 * ```
 *
 * - `verdict: ok`: read, no objection.
 * - `verdict: changes`: read, and it needs changing. The reasons are review
 *   COMMENTS (kind `defect` or `suggestion`); the verdict only says the block
 *   was read.
 * - `waive: <reason>`: the block needs no review, for example a pure rename.
 *   The reason is required, and is kept.
 *
 * `block:` may name several labels, so a reviewer finishing a slice can say
 * so in one comment. One verdict is recorded per label.
 *
 * ## Pages and inputs: what no block reaches (bean `bnjs`)
 *
 * A rendered page that no changed block reaches has no block to give a
 * verdict on: a page changed by a manifest or a media file, the comment
 * pages, every page of a FHIR IG. Neither has an input a renderer could not
 * place. The same tag takes them:
 *
 * ```
 * page: en/dpi-h-ra/index.html ast/artifact/PlanDefinition-X.html
 * verdict: ok
 * ```
 *
 * ```
 * input: sushi-config.yaml
 * waive: only the version string changed
 * ```
 *
 * `page:` names a path in the staging build's `rendered-impact.json` (or a
 * page the build measured and the prediction missed); `input:` names one of
 * its undetermined inputs. Each is pinned to that file's `hash` there, the
 * blobs of the inputs that reach it, so it counts only while those inputs
 * stay as they were reviewed. `block:`, `page:` and `input:` may be combined.
 *
 * **A comment is either a verdict or a review comment, never both.** A tag
 * carrying `kind:` as well as `verdict:` or `waive:` is refused, so one
 * comment cannot be counted twice under two meanings.
 *
 * ## A verdict is pinned to the block's HASH
 *
 * A verdict on the version a reviewer read says nothing about the version
 * that replaced it. {@link computeCoverage} counts a verdict only when its
 * `blockHash` equals the block's current hash. So an edit after review
 * reopens exactly the blocks it touched, and no others.
 *
 * ## Not a todo
 *
 * A review comment is a todo (it asks for something). A verdict asks for
 * nothing; it records that something happened. So it is a plain node in
 * its own declared directory, of graph typology `review-verdicts`, and not a
 * kind whose parent is the todo.
 */
import { z } from "zod";

export const REVIEW_VERDICT_SCHEMA = "folio-review-verdict/v1" as const;

/** `waived` is written `waive: <reason>` in the tag; the other two are written `verdict: <value>`. */
export const REVIEW_VERDICTS = ["ok", "changes", "waived"] as const;
export type ReviewVerdictValue = (typeof REVIEW_VERDICTS)[number];

/** What a verdict is ON: a block (by label), a rendered page or an undetermined input (by path). */
export const VERDICT_TARGETS = ["block", "page", "input"] as const;
export type VerdictTarget = (typeof VERDICT_TARGETS)[number];

export const ReviewVerdictSchema = z
  .object({
    $schema: z.literal(REVIEW_VERDICT_SCHEMA),
    /** `verdict-pr<n>-c<comment id>-<label>`: derived, so a re-run finds it rather than adding one. */
    id: z.string().min(1),
    /** A block's label, or a page's or an input's path, as `target` says. */
    targetLabel: z.string().min(1),
    /** Absent on verdicts written before pages could be reviewed: those are all on blocks. */
    target: z.enum(VERDICT_TARGETS).default("block"),
    verdict: z.enum(REVIEW_VERDICTS),
    /** Required for `waived`: why this block needs no review. */
    reason: z.string().min(1).optional(),
    /** The block's content hash (a page's or input's pin) when the verdict was given. It counts only while current. */
    blockHash: z.string().min(1),
    /** GitHub login. */
    reviewer: z.string().min(1),
    /** The lane they reviewed in: a role id from `roles.json`. */
    role: z.string().min(1),
    repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
    pr: z.number().int().positive(),
    commentId: z.number().int().positive(),
    commentUrl: z.string().url(),
    /** The head commit the verdict was ingested against. */
    commit: z.string().min(1),
    at: z.string().min(1),
  })
  .superRefine((v, ctx) => {
    if (v.verdict === "waived" && !v.reason) {
      ctx.addIssue({ code: "custom", path: ["reason"], message: "a waived block says why it needs no review" });
    }
  });
export type ReviewVerdict = z.infer<typeof ReviewVerdictSchema>;

export const reviewVerdictId = (pr: number, commentId: number, label: string) => `verdict-pr${pr}-c${commentId}-${label}`;

// ── The tag ──────────────────────────────────────────────────────

export interface VerdictTag {
  blocks: string[];
  pages: string[];
  inputs: string[];
  verdict: ReviewVerdictValue;
  reason?: string;
  role: string;
}

/**
 * Read a verdict tag. `null` when the comment is not a verdict (no `verdict:`
 * and no `waive:` line), so ordinary conversation and review comments pass
 * through untouched. The header is the leading `key: value` lines, as for a
 * review comment.
 */
export function parseVerdictTag(body: string): VerdictTag | { error: string } | null {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const header: Record<string, string> = {};
  let i = 0;
  while (i < lines.length && lines[i]!.trim() === "") i++;
  for (; i < lines.length; i++) {
    const m = /^\s*(block|page|input|kind|role|verdict|waive):\s*(.*?)\s*$/i.exec(lines[i]!);
    if (!m) break;
    header[m[1]!.toLowerCase()] = m[2]!;
  }
  if (!("verdict" in header) && !("waive" in header)) return null;
  if ("kind" in header) {
    return { error: "a comment is a verdict or a review comment, not both: drop `kind:`, or drop `verdict:`/`waive:`" };
  }
  if ("verdict" in header && "waive" in header) return { error: "give `verdict:` or `waive:`, not both" };
  const list = (k: string) => (header[k] ?? "").split(/[\s,]+/).filter(Boolean);
  const [blocks, pages, inputs] = [list("block"), list("page"), list("input")];
  if (!blocks.length && !pages.length && !inputs.length) {
    return { error: "a verdict names what it is on: `block:` (labels), `page:` (rendered paths) or `input:` (input paths)" };
  }
  const role = header.role ?? "reviewer";
  if (!/^[a-z][a-z0-9-]*$/.test(role)) return { error: `\`role: ${role}\` is not a role id` };
  if ("waive" in header) {
    if (!header.waive) return { error: "`waive:` needs the reason the block needs no review" };
    return { blocks, pages, inputs, verdict: "waived", reason: header.waive, role };
  }
  const v = header.verdict!.toLowerCase();
  if (v !== "ok" && v !== "changes") return { error: `\`verdict: ${header.verdict}\` is not one of ok, changes (to waive, write \`waive: <reason>\`)` };
  return { blocks, pages, inputs, verdict: v, role };
}

// ── Ingestion ────────────────────────────────────────────────────

export interface VerdictIngestResult {
  created: ReviewVerdict[];
  unchanged: string[];
  /** Said, not dropped, so the reviewer can fix it. */
  malformed: Array<{ commentId: number; url: string; error: string }>;
}

/**
 * Ingest a PR's verdict comments. A label the head does not carry is
 * malformed rather than recorded: unlike a comment, a verdict on a block that
 * is not there has nothing to be about. Idempotent on the derived id.
 */
export function ingestVerdicts(input: {
  repo: string;
  pr: number;
  commit: string;
  comments: ReadonlyArray<{ id: number; body: string; user: string; createdAt: string; url: string }>;
  existing: readonly Pick<ReviewVerdict, "id">[];
  blocks: ReadonlyMap<string, string>;
  /** Page path -> pin, from the build's rendered impact (and its measured misses). Absent: no page can be reviewed. */
  pages?: ReadonlyMap<string, string>;
  /** Undetermined input path -> pin. Absent: no input can be reviewed. */
  inputs?: ReadonlyMap<string, string>;
}): VerdictIngestResult {
  const have = new Set(input.existing.map((v) => v.id));
  const out: VerdictIngestResult = { created: [], unchanged: [], malformed: [] };
  for (const c of input.comments) {
    const tag = parseVerdictTag(c.body);
    if (tag === null) continue;
    if ("error" in tag) {
      out.malformed.push({ commentId: c.id, url: c.url, error: tag.error });
      continue;
    }
    const targets: Array<[VerdictTarget, string, string | undefined, string]> = [
      ...tag.blocks.map((l): [VerdictTarget, string, string | undefined, string] => [
        "block", l, input.blocks.get(l), `no block \`${l}\` in the head, so there is nothing for a verdict to be on`]),
      ...tag.pages.map((p): [VerdictTarget, string, string | undefined, string] => [
        "page", p, input.pages?.get(p),
        input.pages ? `no page \`${p}\` in this build's rendered impact, or it carries no pin` : "this build published no rendered impact, so no page can be reviewed"]),
      ...tag.inputs.map((p): [VerdictTarget, string, string | undefined, string] => [
        "input", p, input.inputs?.get(p),
        input.inputs ? `\`${p}\` is not an undetermined input of this build's rendered impact` : "this build published no rendered impact, so no input can be reviewed"]),
    ];
    for (const [target, label, hash, missing] of targets) {
      if (!hash) {
        out.malformed.push({ commentId: c.id, url: c.url, error: missing });
        continue;
      }
      const id = reviewVerdictId(input.pr, c.id, target === "block" ? label : `${target}:${label}`);
      if (have.has(id)) {
        out.unchanged.push(id);
        continue;
      }
      have.add(id);
      out.created.push(
        ReviewVerdictSchema.parse({
          $schema: REVIEW_VERDICT_SCHEMA,
          id,
          targetLabel: label,
          target,
          verdict: tag.verdict,
          ...(tag.reason ? { reason: tag.reason } : {}),
          blockHash: hash,
          reviewer: c.user,
          role: tag.role,
          repo: input.repo,
          pr: input.pr,
          commentId: c.id,
          commentUrl: c.url,
          commit: input.commit,
          at: c.createdAt,
        }),
      );
    }
  }
  return out;
}

// ── Coverage: the gate's facts ───────────────────────────────────

/** Whether the rendered half was COMPUTED: a count that was not is never read as 0. */
export type RenderedStatus = "known" | "absent";
/** `not-base`: the before side was built from another commit, so its diff is not this change's. */
export type MeasuredStatus = "known" | "absent" | "not-base";

export interface Coverage {
  /** `GW_Covered`'s fact: changed blocks with no CURRENT verdict. */
  uncoveredBlocks: number;
  /** `GW_Covered`'s fact: review comments of kind `defect` still open or addressed. */
  openDefects: number;
  /** The changed blocks that need review, in ChangeSet order. */
  changed: string[];
  /** Of those, the ones with no current verdict. */
  uncovered: string[];
  /** Verdicts on an OLDER version of what they are on, which therefore do not count. */
  stale: string[];
  /** Whether a rendered impact was given; when `absent` the three lists below are empty because UNKNOWN. */
  rendered: RenderedStatus;
  /** Rendered pages (and data files) on the review list that nobody has reviewed at their current pin. */
  unreviewedPages: string[];
  /** Inputs no renderer could place, with neither a current verdict nor a waiver. */
  undeterminedInputs: string[];
  /** Whether the build was measured against its base. */
  measured: MeasuredStatus;
  /** Pages the build measured and the prediction missed, not reviewed since. Counted only when `measured` is `known`. */
  missedPages: string[];
}

/** The rendered half of coverage, from the build's published files (`rendered-impact.ts`). */
export interface RenderedFacts {
  /** The predicted files and undetermined inputs, every renderer's, each pinned. */
  files: ReadonlyArray<{ path: string; role: string; hash?: string; anchors?: readonly string[] }>;
  undetermined: ReadonlyArray<{ input: string; hash?: string }>;
  /** The build's measurement, when it was measured. */
  measured?: { status: "known" | "not-base"; missed: ReadonlyArray<{ path: string; role: string; hash?: string }> };
}

/**
 * Count what the gate reads. A changed block (`added` or `changed` in the
 * ChangeSet) is covered when at least one verdict on it carries the block's
 * CURRENT hash. Removed blocks need no verdict: there is nothing left to read,
 * and the removal is judged where the section around it is.
 *
 * With `rendered`, the pages the change alters are counted too (bean
 * `bnjs`). A page or data file on the review list is reviewed when:
 *
 * - it has a current PAGE verdict (its pin unchanged since); or
 * - every block anchored on it has a current block verdict, which is the
 *   page's review done block by block; or
 * - it is a data file sharing its pin with a reviewed page: the same inputs
 *   reached both (an artefact page and the resource it loads, a document and
 *   its image), so one look covers both.
 *
 * An undetermined input is reviewed by a current `input:` verdict or waiver.
 * A missed page (measured, not predicted) needs a page verdict at its
 * measured pin; it is counted only when the measurement was against the base.
 */
export function computeCoverage(input: {
  changes: ReadonlyArray<{ change: string; label: string }>;
  blocks: ReadonlyMap<string, string>;
  verdicts: ReadonlyArray<Pick<ReviewVerdict, "id" | "targetLabel" | "blockHash"> & { target?: VerdictTarget }>;
  comments: ReadonlyArray<{ status: string; review: { kind: string } }>;
  rendered?: RenderedFacts;
}): Coverage {
  const changed = input.changes.filter((c) => c.change === "added" || c.change === "changed").map((c) => c.label);
  const current = new Set<string>();
  const stale: string[] = [];
  // Page and input verdicts are judged against the rendered pins below.
  const onPins: Array<{ id: string; key: string; hash: string }> = [];
  for (const v of input.verdicts) {
    const target = v.target ?? "block";
    if (target !== "block") onPins.push({ id: v.id, key: `${target}:${v.targetLabel}`, hash: v.blockHash });
    else if (input.blocks.get(v.targetLabel) === v.blockHash) current.add(v.targetLabel);
    else stale.push(v.id);
  }
  const uncovered = changed.filter((l) => !current.has(l));
  const openDefects = input.comments.filter((c) => c.review.kind === "defect" && (c.status === "open" || c.status === "addressed")).length;
  const blockHalf = { uncoveredBlocks: uncovered.length, openDefects, changed, uncovered };

  const r = input.rendered;
  if (!r) {
    stale.push(...onPins.map((p) => p.id));
    return { ...blockHalf, stale, rendered: "absent", unreviewedPages: [], undeterminedInputs: [], measured: "absent", missedPages: [] };
  }
  const pins = new Map<string, string>();
  for (const f of r.files) if (f.hash) pins.set(`page:${f.path}`, f.hash);
  for (const f of r.measured?.missed ?? []) if (f.hash) pins.set(`page:${f.path}`, f.hash);
  for (const u of r.undetermined) if (u.hash) pins.set(`input:${u.input}`, u.hash);
  const reviewed = new Set<string>();
  for (const p of onPins) {
    if (pins.get(p.key) === p.hash) reviewed.add(p.key);
    else stale.push(p.id);
  }
  const pageReviewed = (f: RenderedFacts["files"][number]) =>
    reviewed.has(`page:${f.path}`) || (!!f.anchors?.length && f.anchors.every((a) => current.has(a)));
  const listed = r.files.filter((f) => f.role !== "index");
  const reviewedPins = new Set(listed.filter((f) => f.role === "content" && f.hash && pageReviewed(f)).map((f) => f.hash!));
  const unreviewedPages = listed
    .filter((f) => !pageReviewed(f) && !(f.role === "data" && f.hash && reviewedPins.has(f.hash)))
    .map((f) => f.path)
    .sort();
  const undeterminedInputs = r.undetermined.filter((u) => !reviewed.has(`input:${u.input}`)).map((u) => u.input).sort();
  const m = r.measured;
  const missedPages =
    m?.status === "known" ? m.missed.filter((f) => f.role !== "index" && !reviewed.has(`page:${f.path}`)).map((f) => f.path).sort() : [];
  return { ...blockHalf, stale, rendered: "known", unreviewedPages, undeterminedInputs, measured: m ? m.status : "absent", missedPages };
}
