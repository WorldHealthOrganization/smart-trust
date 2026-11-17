/**
 * What a state machine tracks across a SESSION, as opposed to an instance.
 *
 * ## A session is not a process instance
 *
 * `workflow-state` answers **where one instance got to**: a token's position in
 * one diagram. A session **spans** processes — it starts before any instance,
 * may open several, switches between them, and outlives each; a session with
 * no instance open is the commonest state. So it is a separate record,
 * referencing instances rather than containing them.
 *
 * ## `actor` is required
 *
 * Every other field here can be derived by looking at the repository. WHO is
 * acting cannot: the machine keeping the session cannot infer it, the same way
 * the Logger cannot infer who wrote a log line (`bootstrap/skills/log-message.md`).
 * A sibling session needs to know who is answerable before it touches the same
 * bean.
 *
 * It is `actorRef` rather than an `ActorDefinition`: an agent may act without a
 * declared node under `cat-harness/scenarios/actors/` (the cold-start case).
 * The reference is resolved where one exists and is a bare name where it does
 * not — **stated, so a consumer knows which it is holding.**
 *
 * ## NOT a store
 *
 * This is the shape; nothing writes it yet, so no directory is declared (a
 * declared-but-absent directory would let a consumer scan nothing and report
 * a clean run). The `session-state` graph typology is registered ahead of its
 * directory, which is safe because nothing scans a kind.
 *
 * @module schemas/session-context
 * @graphNode schema
 */
import { z } from "zod";
import { ProcessElementIdSchema } from "../process/process-element-id.js";

/** The `$schema` tag a session record carries. Files declare what they are. */
export const SESSION_CONTEXT_SCHEMA_TAG = "folio-session-context/v1";

/**
 * Who is acting, and whether the repository knows them.
 *
 * Two fields rather than one string, because "an actor id that resolves" and
 * "a name nobody declared" are different facts and a consumer acts differently
 * on each — an audit can follow the first to a role and a permission set, and
 * can only quote the second.
 *
 * Collapsing them would make an undeclared actor indistinguishable from a
 * declared one whose node was deleted, which is the third-state failure this
 * repository keeps writing down.
 */
export const ActorRefSchema = z.object({
  /** The actor's id, or the best name available when none is declared. */
  id: z.string().min(1),
  /**
   * Does `id` resolve to a node under the actors graph?
   *
   * Required, and not inferred at read time: a reader resolving it themselves
   * gets a DIFFERENT answer than the writer did if the node was added or
   * removed in between, and the record is supposed to say what was true when
   * the session acted.
   */
  declared: z.boolean(),
});

export type ActorRef = z.infer<typeof ActorRefSchema>;

/** One process instance this session has open, by reference. */
export const OpenInstanceSchema = z.object({
  /** The instance id — the stem of a node in the bean graph's workflow-state. */
  instance: z.string().min(1),
  /** The BPMN process it walks. Named, so a reader need not open the instance. */
  process: ProcessElementIdSchema,
  /**
   * The node the session believes it is at.
   *
   * **Advisory, and the instance wins.** The instance is the authority on its
   * own token; this is the session's view of it, which can be stale by exactly
   * one step — the gap between a step completing and the session noticing. A
   * consumer that needs the truth reads the instance. Recorded anyway because
   * the commonest question ("what is this session doing") does not deserve a
   * second file read, and because a DISAGREEMENT between the two is itself
   * worth seeing.
   */
  atNode: z.string().min(1).optional(),
});

export const SessionContextSchema = z.object({
  $schema: z.literal(SESSION_CONTEXT_SCHEMA_TAG),
  /** Stable for the life of the session. */
  id: z.string().min(1),
  /** WHO is acting. See the module note — this is the field the record is for. */
  actor: ActorRefSchema,
  /** When the session began, as an ISO-8601 UTC instant. */
  startedAt: z.string().min(1),
  /** When this record was last written. */
  updatedAt: z.string().min(1),
  /**
   * Instances this session has open. EMPTY IS THE NORMAL STATE, not a gap:
   * an agent answering a question, reading, or deciding what to do next is in
   * no process at all, and `process-state` calls that idle rather than broken.
   */
  open: z.array(OpenInstanceSchema),
  /**
   * Beans this session has claimed.
   *
   * By reference, never copied. A claim ANNOUNCES rather than reserves until a
   * PR exists (`bean-coordination`), so the bean is the authority on its own
   * status and a status duplicated here would be free to contradict it.
   */
  claimed: z.array(z.string().min(1)),
  /**
   * What the session is waiting on, if anything.
   *
   * Free text on purpose: what a session waits for is a human answer, a CI
   * run, a sibling's PR — an open set no enum would survive. `since` is
   * separate and required alongside, because a wait with no start cannot be
   * told from an abandoned one, which is the argument `bean-blocking` makes
   * for an expiry.
   */
  waitingOn: z
    .object({
      what: z.string().min(1),
      since: z.string().min(1),
    })
    .optional(),
});

export type SessionContext = z.infer<typeof SessionContextSchema>;

/**
 * Parse a session record, or throw naming what is wrong.
 *
 * A session record is written by a machine that may be an LLM playing the part
 * (`3nfv`), so the shape cannot be assumed from the writer's care. Parsing at
 * the boundary is what makes a non-deterministic writer safe to read from.
 */
export function parseSessionContext(value: unknown): SessionContext {
  return SessionContextSchema.parse(value);
}
