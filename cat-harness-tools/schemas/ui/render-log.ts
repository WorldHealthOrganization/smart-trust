/**
 * The render log — what was published to the publish branch, when, and why:
 * each staging rendering added or deleted, logged on the publish branch.
 *
 * @module schemas/render-log
 * @graphNode schema
 *
 * ## A SPECIALISATION of `folio-log/v1`, not a second logger
 *
 * `schemas/sdlc/log-entry.ts` already answers "what does an entry look like":
 * `id`, `at`, `summary`, `detail`, `references`, and a three-state `capture`.
 * A render entry IS a log entry, with a rendering event and a rendering
 * subject. It is a different store:
 *
 * | | activity log (`folio-log/v1`) | render log (this) |
 * |---|---|---|
 * | subject | what an AGENT did | what was PUBLISHED |
 * | store | `fsh-guts/logs/`, in the repo | the publish branch itself |
 * | published | **no** | **yes** |
 *
 * It lives on the publish branch because it describes what is ON that
 * branch: a record of a deleted artefact is useful only where the absence can
 * be seen.
 *
 * ## Append-only
 *
 * An entry is never rewritten, and a removal is a NEW entry, so `removed`
 * does not delete the `rendered` entry that precedes it; "what happened to
 * `branches/x`" is answered by reading forward.
 *
 * ## What is NOT here
 *
 * No size, no liveness: those belong to the health sweep, which reports and
 * never acts. A log entry records an EVENT at the moment it happened.
 */

import { z } from "zod";

import { LOG_CAPTURE, LogReferenceSchema } from "../sdlc/log-entry.ts";
import { ProcessElementIdSchema } from "../process/process-element-id.ts";

/** The `$schema` every render-log entry carries. */
export const RENDER_LOG_SCHEMA_ID = "folio-render-log/v1";

/**
 * Where the log lives on the publish branch.
 *
 * At the root rather than under `branches/`, and that is load-bearing: the
 * cleanup runs `rm -rf "branches/$SLUG"`, and a branch named to collide with a
 * directory under `branches/` slugifies to exactly that name — verified, git
 * permits such a ref. A store outside `branches/` is unreachable by that
 * command whatever the slug says, which is a structural guarantee rather than
 * a guard somebody has to remember to write.
 */
export const RENDER_LOG_DIR = "_render-log";

/**
 * What happened to a rendered artefact.
 *
 * Deliberately NOT `LOG_EVENTS` from the activity log. Those are
 * `task-start | task-end | message | error` — an agent's verbs. These are a
 * publication's verbs, and forcing one vocabulary to carry both would make
 * `message` mean "a preview appeared", which is how an enum stops being
 * readable.
 *
 * - `rendered` — published, or re-published over itself. A re-deploy is a
 *   rendering, so it gets its own entry: "when was this last built" is a
 *   question the log should answer without anybody diffing commits.
 * - `removed` — taken down. Never erases the `rendered` entries before it.
 * - `restored` — carried across a full-replace deploy by `restore-staging`.
 *   Its own event rather than a second `rendered`, because "somebody pushed
 *   this branch" and "an unrelated merge nearly deleted it" are different
 *   facts, and bean `plj1` is what happens when the second is invisible.
 * - `retained` — a removal was CONSIDERED and refused, with the reason. The
 *   one that makes the log worth reading: a preview that is still here
 *   because a liveness signal fired leaves no trace otherwise, and the next
 *   person asking "why is this still up" has nothing to read.
 */
export const RENDER_EVENTS = ["rendered", "removed", "restored", "retained"] as const;
export type RenderEvent = (typeof RENDER_EVENTS)[number];

/**
 * What kind of thing was rendered.
 *
 * OPEN, like `folio-fsh-guts/v1`'s `kind` and for the same reason: the
 * publish branch already carries more than previews — the main site, the
 * blueprint, the KG exports — and a closed enum would put a schema change
 * between somebody and logging what they just published.
 */
export const RENDER_SUBJECT_KINDS = ["staging-preview", "site", "export"] as const;
export type RenderSubjectKind = (typeof RENDER_SUBJECT_KINDS)[number] | (string & {});

/**
 * How to READ this entry's prose — declared, never sniffed.
 *
 * Owner, 2026-09-20: *"keep ingestion schema general. log is string of text,
 * optional markdown. string by convention may have formatting declared on it."*
 *
 * So the prose fields stay plain `string` and are NOT narrowed; what was missing
 * is the second half of that sentence. A string carries its formatting as a
 * DECLARATION beside it, and absent means plain text.
 *
 * Why declared rather than detected: a reason like `"refused because the *only*
 * liveness signal was stale"` contains markdown emphasis it does not mean, and a
 * sniffer would render `*only*` as italics in a log entry nobody wrote as
 * markdown. Every other store here makes the same call — `beans`, the workflow
 * instances and `fsh-guts` all identify themselves from inside the file rather
 * than being guessed at. "Extension is a coincidence; a declaration inside the
 * file is the contract."
 *
 * OPEN like {@link RENDER_SUBJECT_KINDS}, not closed like {@link RENDER_EVENTS}:
 * a renderer this log does not know about should not need a schema change before
 * anybody can log what they published.
 */
export const RENDER_TEXT_FORMATS = ["text", "markdown"] as const;
export type RenderTextFormat = (typeof RENDER_TEXT_FORMATS)[number] | (string & {});

/** The artefact an entry is about. */
export const RenderSubjectSchema = z.object({
  kind: z.string().min(1),
  /**
   * The path on the publish branch — `branches/<slug>`, or `/` for the site.
   *
   * A single safe path, checked by {@link isSafeRenderPath}. The log is
   * written by the same jobs that run `rm -rf` on paths built from a branch
   * name, so a path that could escape its directory must not reach a file
   * whose whole purpose is to be trusted later.
   */
  path: z.string().min(1),
  /** The staging slug, where the subject has one. */
  slug: z.string().min(1).optional(),
});
export type RenderSubject = z.infer<typeof RenderSubjectSchema>;

/**
 * Is this a single, safe path segment sequence — no escape, no absolute?
 *
 * Bean `fuzm`: the staging slug sanitiser CAN emit `..` (input `..` gives
 * output `..`), and is safe only because git rejects every ref name
 * containing `..`. That invariant holds for a slug taken from a ref and
 * **does not hold** for one taken from a dispatch input — and
 * `cleanup-dispatch` takes exactly that. So this checks the VALUE rather than
 * trusting its provenance.
 */
export function isSafeRenderPath(path: string): boolean {
  if (path === "/") return true;
  if (path.startsWith("/") || path.includes("\\")) return false;
  const segments = path.split("/");
  return segments.length > 0 && segments.every((s) => s !== "" && s !== "." && s !== "..");
}

export const RenderLogEntrySchema = z.object({
  $schema: z.literal(RENDER_LOG_SCHEMA_ID),
  /** Stable id, so one entry can be pointed at from elsewhere. */
  id: z.string().min(1),
  at: z.string().datetime(),
  event: z.enum(RENDER_EVENTS),
  subject: RenderSubjectSchema,
  /** One line, so a long log stays skimmable. Detail goes in `detail`. */
  summary: z.string().min(1),
  detail: z.string().optional(),

  /**
   * The declared format of `summary`, `detail` and `reason` — see
   * {@link RENDER_TEXT_FORMATS}.
   *
   * ONE declaration for all three rather than one each, because they are one
   * author's prose about one event: a summary in markdown with a plain-text
   * reason beside it is a distinction nobody writing a log entry wants to make,
   * and three fields would invite two of them to disagree.
   *
   * Optional, and absent means `text`. A reader must not treat absence as
   * unknown-and-therefore-markdown: an entry written before this field existed is
   * plain text, which is what it was.
   */
  format: z.string().min(1).optional(),

  /**
   * WHY, for the events where a reason is the whole content.
   *
   * Required on `removed` and `retained` by {@link readRenderLogEntry} rather
   * than by the schema, because this schema also CLASSIFIES: a refinement
   * that rejected a reasonless removal would not flag it, it would classify
   * it as not-an-entry and drop it from the log silently. Same call
   * `fsh-guts.ts` makes about `movedFrom`, and for the same reason.
   */
  reason: z.string().min(1).optional(),

  // ── Provenance, same spellings as `folio-log/v1` ───────────────
  /** Branch the render came from. */
  branch: z.string().min(1).optional(),
  /** Commit the artefact was built from. */
  commit: z.string().min(1).optional(),
  /** The workflow run that wrote this, so a reader can open the log. */
  run: z.string().min(1).optional(),
  /** BPMN process element id — `Process_RenderLog` — when written inside one. */
  process: ProcessElementIdSchema.optional(),
  /** The activity within that process. */
  task: z.string().min(1).optional(),

  /** Everything this entry points at: a PR, an issue, a commit, a run. */
  references: z.array(LogReferenceSchema).optional(),

  /** Whether this entry is kept. Never defaulted silently. */
  capture: z.enum(LOG_CAPTURE),
});
export type RenderLogEntry = z.infer<typeof RenderLogEntrySchema>;

/** Events for which a `reason` is required rather than merely useful. */
export const EVENTS_REQUIRING_REASON: readonly RenderEvent[] = ["removed", "retained"];

/**
 * Parse one entry, or a reason it is not one.
 *
 * A reason rather than a bare `undefined`, matching `readFshGutsNode` and
 * `readStagingPreview`: "not an entry of this log" and "an entry that will
 * not parse" want different responses, and the second must never be reported
 * as a clean skip.
 */
export function readRenderLogEntry(
  raw: unknown,
): { entry: RenderLogEntry } | { entry?: undefined; reason: string } {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { reason: "is not a JSON object, so it declares nothing" };
  }
  const declared = (raw as { $schema?: unknown }).$schema;
  if (declared !== RENDER_LOG_SCHEMA_ID) {
    return {
      reason:
        typeof declared === "string"
          ? `declares itself \`${declared}\`, which is not ${RENDER_LOG_SCHEMA_ID}`
          : `declares no $schema, so it is not an entry of this log`,
    };
  }
  const parsed = RenderLogEntrySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      reason: `declares ${RENDER_LOG_SCHEMA_ID} but does not satisfy it: ${parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"} ${i.message}`)
        .join("; ")}`,
    };
  }
  const e = parsed.data;
  if (EVENTS_REQUIRING_REASON.includes(e.event) && (e.reason ?? "").trim() === "") {
    return {
      reason:
        `is a \`${e.event}\` entry with no reason. An entry saying an artefact went ` +
        `and not why is the ambiguity this log exists to prevent — the same rule ` +
        `\`retireStagingPreview\` enforces and that the never-delete discipline turns on`,
    };
  }
  if (!isSafeRenderPath(e.subject.path)) {
    return {
      reason:
        `subject.path \`${e.subject.path}\` is not a safe path. See bean \`fuzm\`: a slug ` +
        `can escape its directory when it comes from a dispatch input rather than a git ref`,
    };
  }
  return { entry: e };
}

/**
 * The log file an entry belongs in — one per UTC day.
 *
 * Per day rather than one growing file, and not per entry. One file is a
 * rewrite on every append, which loses the append-only property the moment
 * two jobs publish at once — and the publish branch has six writers. One file
 * per entry makes "what happened this week" a directory walk. A day is the
 * granularity a person asks in.
 */
export function renderLogPath(at: string): string {
  const day = at.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error(`render-log: \`${at}\` is not an ISO-8601 timestamp, so it names no log file`);
  }
  return `${RENDER_LOG_DIR}/${day}.jsonl`;
}

/** Serialise one entry as a JSONL line. */
export function serializeRenderLogEntry(entry: RenderLogEntry): string {
  return `${JSON.stringify(RenderLogEntrySchema.parse(entry))}\n`;
}

/**
 * Read a whole JSONL log, keeping the entries and REPORTING the rest.
 *
 * A malformed line never stops the read: a log is append-only and written by
 * several jobs, so one bad line must not make the rest unreadable. But it is
 * reported rather than skipped, because a reader counting entries needs to
 * know the count is short.
 */
export function readRenderLog(text: string): {
  entries: RenderLogEntry[];
  skipped: { line: number; reason: string }[];
} {
  const entries: RenderLogEntry[] = [];
  const skipped: { line: number; reason: string }[] = [];
  text.split("\n").forEach((raw, i) => {
    if (raw.trim() === "") return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      skipped.push({ line: i + 1, reason: `is not JSON: ${e instanceof Error ? e.message : String(e)}` });
      return;
    }
    const r = readRenderLogEntry(parsed);
    if (r.entry === undefined) skipped.push({ line: i + 1, reason: r.reason });
    else entries.push(r.entry);
  });
  return { entries, skipped };
}
