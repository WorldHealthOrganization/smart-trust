/**
 * Sessions that are waiting on a person, and have been for too long.
 *
 * Bean `rq8s`. The bean was opened saying *"a session blocked on the owner is
 * invisible"*. Re-measured on claiming, that is **wrong**, and the correction
 * is what this module exists for: the signal is already there, in two fields
 * `list_sessions` returns.
 *
 * | field | what it gives |
 * |---|---|
 * | `session_status: SESSION_STATUS_REQUIRES_ACTION` | a DISTINCT status — not a bucket heuristic — meaning a person must act |
 * | `task_summary` | the held question, in plain text |
 *
 * **Nothing ages them and nothing aggregates them.** Measured 2026-09-21: one
 * session had held *"Which PRs should I merge? I've reviewed none of the maths
 * in them."* for **113.4 hours** in `REQUIRES_ACTION`, and two more had failed
 * 15 and 16 days earlier carrying `unread: true` — output nobody had read.
 * Every one of those facts was one query away and nobody was querying.
 *
 * ## Why this is a module and not a gate
 *
 * **CI cannot fetch the input.** Probed 2026-09-21 from inside a session
 * container: no session credential in the environment,
 * `api.anthropic.com/v1/sessions` → **401**, `claude.ai/api/code/sessions` →
 * **403**. `list_sessions` is an MCP tool an AGENT holds, not an HTTP endpoint
 * a script can call — which is precisely why `sibling-sessions.ts` infers
 * sessions from commit trailers rather than asking.
 *
 * So the rules live here, pure and tested, and the fetch stays with whoever
 * can do it: an agent pipes the listing in. The same split as
 * the IRIS replica's `scripts/catalogue-baseline.ts` — the decisions are testable, the
 * I/O is at the edge. Presenting this as a gate would be worse than not
 * shipping it, because a gate that silently examines nothing reports a clean
 * run over everything, which is the `dh4f` defect this repository keeps
 * paying for.
 *
 * ## `bean-blocking`, one level up
 *
 * That skill requires a blocked BEAN to carry an **expiry**, because a block
 * with no expiry cannot be told from abandoned work. The identical defect runs
 * unchecked on SESSIONS, where the store already holds both the status and the
 * timestamp needed to compute one. This is that rule applied where it was
 * missing.
 *
 * @module folio-assistant/src/sessions/staleness
 */

/** `REQUIRES_ACTION` is the one status that means a PERSON must act. */
export const REQUIRES_ACTION = "SESSION_STATUS_REQUIRES_ACTION";

/**
 * Hours a session may sit in `REQUIRES_ACTION` before it is reported.
 *
 * **Basis:** `BEAN_QUIET_HOURS` in `test/health/checks.ts` is 72, set from
 * bean `fgnw` for the question *"is anybody on this RIGHT NOW"*. A session
 * waiting on a person asks the same question from the other side, so it takes
 * the same calibration rather than a number invented here. Three days is also
 * long enough that a weekend cannot produce a finding on its own.
 *
 * The measured case was **113.4 hours**, comfortably past it.
 */
export const REQUIRES_ACTION_HOURS = 72;

/**
 * Hours a FAILED session may carry unread output before it is reported.
 *
 * **Basis:** shorter than {@link REQUIRES_ACTION_HOURS} on purpose, and the
 * difference is not a tighter version of the same judgement. A session waiting
 * on a person may legitimately wait — the person is thinking. A session that
 * FAILED with output nobody has opened is not waiting on anything; it has
 * stopped, and the only question is whether anyone noticed. One working day
 * is the point past which "nobody noticed" is the better explanation.
 *
 * The two measured cases were **359.7 and 385.3 hours** — 15 and 16 days.
 */
export const FAILED_UNREAD_HOURS = 24;

/** The subset of a `list_sessions` row this module reads. */
export interface SessionRow {
  id?: string;
  title?: string;
  /** The precise status. `status_bucket` is a coarser roll-up. */
  session_status?: string;
  status_bucket?: string;
  /** ISO 8601. */
  updated_at?: string;
  /** The held question, where the session recorded one. */
  task_summary?: string;
  /** Output nobody has opened. */
  unread?: boolean;
  session_context?: { sources?: { git_repository?: { url?: string } }[] };
}

export type Reason = "requires-action" | "failed-unread" | "blocked-undeclared";

export interface Finding {
  id: string;
  title: string;
  repo: string;
  reason: Reason;
  idleHours: number;
  /** The held question, verbatim, where there is one. */
  question?: string;
}

/**
 * Findings, or **why the question could not be answered**.
 *
 * `state: "unknown"` is a THIRD state and never collapses to "nothing found".
 * The input comes from an external service, so a failed or absent listing is
 * the one outcome this must not render as clean — the rule
 * [`ci-health`](../../skills/process/process-core/ci-health.md) states as *"could not
 * check is never green"*.
 */
export type Report =
  | { state: "checked"; read: number; findings: Finding[] }
  | { state: "unknown"; because: string };

/** The repository a session is working, where it declares one. */
export function repoOf(s: SessionRow): string {
  const url = s.session_context?.sources?.[0]?.git_repository?.url;
  if (!url) return "unknown";
  return url.replace(/\.git$/, "").split("/").slice(-2).join("/");
}

function hoursBetween(now: Date, iso: string | undefined): number | undefined {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return undefined;
  return (now.getTime() - t) / 3_600_000;
}

/**
 * Which sessions have been waiting too long, newest finding last.
 *
 * A row whose `updated_at` is missing or unparseable is **skipped rather than
 * treated as zero**: an unreadable timestamp is not a fresh one, and rounding
 * it to "just updated" would hide exactly the abandoned session this looks
 * for.
 */
export function stale(rows: SessionRow[], now: Date, onlyRepo?: string): Finding[] {
  const out: Finding[] = [];
  for (const s of rows) {
    const repo = repoOf(s);
    if (onlyRepo !== undefined && repo !== onlyRepo) continue;
    const idle = hoursBetween(now, s.updated_at);
    if (idle === undefined) continue;

    const base = { id: s.id ?? "unknown", title: s.title ?? "(untitled)", repo, idleHours: idle };

    if (s.session_status === REQUIRES_ACTION && idle > REQUIRES_ACTION_HOURS) {
      out.push({ ...base, reason: "requires-action", question: s.task_summary || undefined });
      continue;
    }
    // A failed session is reported only when its output is UNREAD. A failure
    // somebody has already read is not this check's business -- they know.
    const failed = s.status_bucket === "SESSION_STATUS_BUCKET_FAILED";
    if (failed && s.unread === true && idle > FAILED_UNREAD_HOURS) {
      out.push({ ...base, reason: "failed-unread", question: s.task_summary || undefined });
      continue;
    }

    // THE THIRD STATE, and it is not a miss. A session whose coarse bucket
    // says BLOCKED while its precise `session_status` says IDLE has stopped
    // without declaring that a person must act, and without recording a
    // question. Whether it is waiting or abandoned CANNOT BE TOLD from the
    // listing -- so it is named rather than asserted, and never counted among
    // the sessions waiting on somebody.
    //
    // Dropping it silently is the alternative and it is the `dh4f` shape: a
    // reader would see a clean-looking report over a session that has been
    // stopped for days. Measured 2026-09-21: one, at 113.2 hours.
    if (s.status_bucket === "SESSION_STATUS_BUCKET_BLOCKED" && s.session_status !== REQUIRES_ACTION && idle > REQUIRES_ACTION_HOURS) {
      out.push({ ...base, reason: "blocked-undeclared", question: s.task_summary || undefined });
    }
  }
  return out.sort((a, b) => b.idleHours - a.idleHours);
}

/**
 * Parse a `list_sessions` payload, tolerating the shapes it actually comes in.
 *
 * The tool returns `{ ccr: { data: [...] } }`; a caller may equally hand over
 * the bare array or `{ sessions: [...] }`. Anything else is **`unknown`**,
 * never an empty result — a payload this cannot read is a question it did not
 * answer, and reporting "no stale sessions" over it would be a clean run over
 * nothing.
 */
export function readRows(text: string): { rows: SessionRow[] } | { because: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { because: `input is not JSON — ${e instanceof Error ? e.message.split("\n")[0] : String(e)}` };
  }
  const candidates: unknown[] = [
    parsed,
    (parsed as { sessions?: unknown } | null)?.sessions,
    (parsed as { data?: unknown } | null)?.data,
    (parsed as { ccr?: { data?: unknown } } | null)?.ccr?.data,
  ];
  for (const c of candidates) if (Array.isArray(c)) return { rows: c as SessionRow[] };
  return { because: "input has no session array — expected `[...]`, `{sessions}`, `{data}` or `{ccr:{data}}`" };
}

/** One line per finding, with the held question printed rather than counted. */
export function render(r: Report): string {
  if (r.state === "unknown") {
    return `Session staleness\n  ? COULD NOT DETERMINE — ${r.because}\n  This is NOT a pass. Nothing was examined.`;
  }
  if (r.read === 0) {
    return "Session staleness\n  ? EXAMINED NOTHING — the listing was empty. Not a pass.";
  }
  const out = [`Session staleness (${r.read} session(s) read)`];
  if (r.findings.length === 0) {
    out.push(`  ✓ no session waiting on a person past ${REQUIRES_ACTION_HOURS}h, and no unread failure`);
    return out.join("\n");
  }
  for (const f of r.findings) {
    const days = (f.idleHours / 24).toFixed(1);
    if (f.reason === "requires-action") {
      out.push(`  ✗ ${f.repo} — waiting on a person for ${f.idleHours.toFixed(1)}h (${days} days): ${f.title}`);
    } else if (f.reason === "failed-unread") {
      out.push(
        `  ✗ ${f.repo} — FAILED ${f.idleHours.toFixed(1)}h ago (${days} days) with output nobody has read: ${f.title}`,
      );
    } else {
      // Named, never asserted as waiting -- see `stale`.
      out.push(
        `  ? ${f.repo} — blocked ${f.idleHours.toFixed(1)}h (${days} days) but never declared it needs a person; ` +
          `waiting or abandoned CANNOT be told from the listing: ${f.title}`,
      );
    }
    // The question is the whole point. A count cannot be acted on; this can
    // often be answered in a sentence.
    if (f.question) out.push(`      asks: ${f.question}`);
    out.push(`      ${f.id}`);
  }
  return out.join("\n");
}
