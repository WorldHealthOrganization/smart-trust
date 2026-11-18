/**
 * The agent activity log — what an agent did, when, and in which process.
 *
 * An agent adds an entry whenever it starts or ends a task or has a log
 * message. Entries live under `fsh-guts/logs/`. `fsh-guts` is a kind kept out
 * of every published graph, so a log cannot leak into the folio's linked data
 * however verbose it gets.
 *
 * ## Persistence is OFF by default, and that is not the same as "no log"
 *
 * The default is **write locally, ignored by git**: the agent can read back
 * what it wrote this session, and nothing reaches the data store until a
 * workflow or the config asks for it.
 *
 * The state must be reported, never assumed, so the agent never believes it
 * has an audit trail it lacks: `LogCapture` is a three-valued answer rather
 * than a boolean.
 *
 * Each file carries `$schema`, so a log entry is identified by what it
 * declares, not by its directory.
 *
 * @module schemas/log-entry
 * @graphNode schema
 */

import { join } from "node:path";

import { z } from "zod";

import { BeanIdSchema } from "../tools/tool-types.ts";
import { ProcessElementIdSchema } from "../process/process-element-id.ts";
import { fshGutsDirectories } from "../kg/fsh-guts.ts";

/** The `$schema` tag every log entry carries, per the declare-yourself rule. */
export const LOG_ENTRY_SCHEMA_ID = "folio-log/v1";

/** The node within the trashcan that holds logs. NOT a path — see {@link logDirs}. */
export const LOG_NODE = "logs";

/**
 * Where logs live, for every `fsh-guts` directory the layer declares.
 *
 * **Composed, never spelled.** This schema owns the NODE name (`logs`); the
 * declaration owns where the trashcan is. Writing `fsh-guts/logs` as a literal
 * would be the `dh4f` defect one level down: a layer that puts its
 * trashcan elsewhere gets a writer that creates a second one beside it and a
 * reader that reports a clean run over the real one.
 *
 * A LIST, and callers must not quietly take the first — same contract
 * `kgRoots` carries and for the same reason. An unreadable declaration yields
 * nothing rather than a guess.
 */
export function logDirs(root: string): string[] {
  // The shared resolution (bean 9c7h). Logs are git-ignored local scratch,
  // so they stay in the WORKING TREE's trashcan when the committed contents
  // move to `cat/cat-harness/fsh-guts`.
  return fshGutsDirectories(root).map((d) => join(d.absPath, LOG_NODE));
}

/**
 * The conventional location, for a caller with no root to resolve against.
 *
 * declared-path-literal: the convention fallback. `logDirs` is the declared
 * answer and every writer uses it; this exists because the `.gitignore` entry
 * and the not-published tests name a path rather than resolving one, and a
 * repository's own ignore file cannot read a declaration.
 */
export const LOG_DIR = "fsh-guts/logs";

/**
 * What happened.
 *
 * `task-start` and `task-end` are the two the owner named explicitly;
 * `message` is the free entry an agent writes mid-task. `error` is separate
 * from `message` because a reader filtering a long log wants failures without
 * reading prose, and a severity field would be a second spelling of the same
 * fact.
 */
export const LOG_EVENTS = ["task-start", "task-end", "message", "error"] as const;
export type LogEvent = (typeof LOG_EVENTS)[number];

/**
 * Whether this entry is destined for the git data store — and the third
 * state, which is the point.
 *
 * - `off` — the default. Written locally, ignored by git.
 * - `on` — explicitly enabled, for this workflow or by config.
 * - `unknown` — **the capture setting could not be determined.**
 *
 * `unknown` exists for the same reason `ci-health` never renders "could not
 * check" as green and `renderingMediaType` returns `undefined` rather than a
 * guess. An agent that cannot tell whether its audit trail is being kept must
 * say so; recording `off` in that case would be asserting a fact nobody
 * established, and recording `on` would promise an audit trail that may not
 * exist.
 */
export const LOG_CAPTURE = ["off", "on", "unknown"] as const;
export type LogCapture = (typeof LOG_CAPTURE)[number];

/**
 * What a log entry can POINT AT.
 *
 * Owner, 2026-09-19: *"log should be rich schema including references to
 * discussion/chats, cmn execution logs, etc."*
 *
 * **The `etc.` is the specification, not a trailing-off.** A closed list would
 * be wrong within a week: the interesting thing to reference is whatever the
 * work touched, and nobody can enumerate that in advance. So `kind` is an
 * OPEN string with these as the known values, checked by a lint rather than
 * by the parser — a new kind must not require a schema change, a release and
 * a migration before an agent can record what it actually did.
 *
 * That openness is the same call `folio-fsh-guts/v1`'s `kind` makes, and for
 * the same reason: the trashcan does not get to be fussy about what is thrown
 * into it, and neither does a log.
 *
 * (`cmn` was read as **command**. There is no CMMN in this codebase — the
 * process standards here are BPMN and DMN — and "execution logs" pairs with a
 * command. If CMMN was meant, it arrives as `kind: "case"` with no schema
 * change, which is exactly what the open list is for.)
 */
export const LOG_REF_KINDS = [
  /** A chat thread, a GitHub discussion, an agent session transcript. */
  "discussion",
  /** One comment on an issue or a pull request. */
  "comment",
  "issue",
  "pull-request",
  "commit",
  /** A command that was run — see {@link LogExecutionSchema} for its detail. */
  "command",
  /** A running BPMN instance under the workflow store. */
  "workflow",
  /** A file, a rendering, a QA sidecar — anything the entry is ABOUT. */
  "artefact",
] as const;
export type LogRefKind = (typeof LOG_REF_KINDS)[number] | (string & {});

export const LogReferenceSchema = z.object({
  /** Open by design — see {@link LOG_REF_KINDS}. */
  kind: z.string().min(1),
  /**
   * Where the thing IS: a URL, a repo-relative path, an instance id.
   *
   * Required, and that is the whole value of a reference. A `kind` with no
   * `ref` records that something of that sort was involved and gives a reader
   * no way to reach it — which is the "abandonment or accident" ambiguity
   * `movedFrom` exists to prevent, in a different store.
   */
  ref: z.string().min(1),
  /** Human-readable, for a reader skimming rather than dereferencing. */
  title: z.string().min(1).optional(),
  /** When the referenced thing happened, if that differs from the entry. */
  at: z.string().datetime().optional(),
});
export type LogReference = z.infer<typeof LogReferenceSchema>;

/**
 * A command execution, which has structure a URL does not.
 *
 * Given its own shape rather than being squeezed into a reference because an
 * exit code is the single most-filtered field in any execution log, and
 * `ref: "exit 1"` is not a field anyone can query.
 *
 * ## Output is REFERENCED, never inlined, and that is a safety property
 *
 * `outputRef` points at where stdout/stderr went; there is no field to paste
 * them into. Command output is the most likely place for a token, a key or a
 * connection string to appear, and `capture: "on"` puts an entry in git in a
 * repository that may be public. A schema that offered an `output: string`
 * would be inviting exactly the leak the skill's "what not to log" section
 * warns about — and a warning is weaker than an absent field.
 *
 * The same caution applies to `command` itself, which is why it says so here:
 * a command line carries its own arguments, and `--token=…` is a command line.
 */
export const LogExecutionSchema = z.object({
  /** The command as run. NEVER include a secret in an argument. */
  command: z.string().min(1),
  /** Argv, when the caller has it structured and does not want re-parsing. */
  argv: z.array(z.string()).optional(),
  /** Exit status. `undefined` means it did not finish, which is not `0`. */
  exitCode: z.number().int().optional(),
  durationMs: z.number().nonnegative().optional(),
  /** Working directory, relative to the layer root. */
  cwd: z.string().min(1).optional(),
  /** WHERE the output went. There is deliberately no field for the output. */
  outputRef: z.string().min(1).optional(),
});
export type LogExecution = z.infer<typeof LogExecutionSchema>;

export const LogEntrySchema = z.object({
  $schema: z.literal(LOG_ENTRY_SCHEMA_ID),
  /** Stable id, so an entry can be emptied individually. */
  id: z.string().min(1),
  at: z.string().datetime(),
  event: z.enum(LOG_EVENTS),
  /** One line. The detail goes in `detail`, so a log stays skimmable. */
  summary: z.string().min(1),
  detail: z.string().optional(),

  // ── Who and where ──────────────────────────────────────────────
  /** The actor id from `cat-harness/scenarios/actors/`, where one is known. */
  actor: z.string().min(1).optional(),
  /**
   * The role the actor was acting AS — a BPMN swimlane, per the role model.
   *
   * Optional and meant to be: an agent writes log lines outside any process,
   * and inventing a lane for those would be the fake-reference failure
   * `activity-names-skill` exists to prevent.
   */
  role: z.string().min(1).optional(),
  /** BPMN process id, when the entry was written inside one. */
  process: ProcessElementIdSchema.optional(),
  /** The activity/step id within that process. */
  task: z.string().min(1).optional(),
  /** The bean this work is claimed against, where there is one. A typed id (#1168 B8). */
  bean: BeanIdSchema.optional(),

  // ── Provenance ─────────────────────────────────────────────────
  /** Session identifier, so one run's entries can be emptied together. */
  session: z.string().min(1).optional(),
  /** Git ref the work was on. */
  branch: z.string().min(1).optional(),

  // ── What this entry points at ──────────────────────────────────
  /**
   * Everything the entry references — a chat, an issue, a commit, a file.
   *
   * A LIST rather than a handful of named fields (`issue`, `pr`, `commitSha`)
   * because the set is open and because one entry routinely touches several
   * of the same kind: a step that answers three review threads has three
   * comments to point at, and three fields named `comment1..3` is where that
   * design ends up.
   */
  references: z.array(LogReferenceSchema).optional(),
  /**
   * Command-execution detail, when this entry IS one.
   *
   * Beside `references` rather than inside it: an exit code and a duration are
   * queryable facts about what happened, not a pointer to somewhere else. An
   * entry may carry both — the execution here, and a `command` reference from
   * another entry that caused it.
   */
  execution: LogExecutionSchema.optional(),

  /** Whether this entry is kept in git. Never defaulted silently. */
  capture: z.enum(LOG_CAPTURE),
});

export type LogEntry = z.infer<typeof LogEntrySchema>;

/**
 * Read a capture setting from whatever the caller managed to resolve.
 *
 * **Absent is `unknown`, never `off`.** They are different claims: `off`
 * says somebody decided not to keep this, `unknown` says nobody could tell.
 * Collapsing them would make a misconfigured layer indistinguishable from
 * a deliberately quiet one, and the first is a bug while the second is a
 * choice.
 */
export function resolveCapture(declared: unknown): LogCapture {
  if (declared === true || declared === "on") return "on";
  if (declared === false || declared === "off") return "off";
  return "unknown";
}

/**
 * Is this entry allowed to persist to the git data store?
 *
 * Only an explicit `on`. `unknown` does NOT persist — when the setting cannot
 * be determined, the safe reading is the default, and the default is off.
 * Persisting on `unknown` would commit an audit trail nobody asked for, which
 * is the failure mode with the worse consequences of the two.
 */
export function shouldPersist(capture: LogCapture): boolean {
  return capture === "on";
}
