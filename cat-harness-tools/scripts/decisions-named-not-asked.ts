#!/usr/bin/env bun
/**
 * A turn that NAMES open decisions without their terms — the unguarded path.
 *
 * `interaction-modality` §4.1 requires every handed-over decision to carry
 * its options, pros, cons, recommendation and downstream impact, and forbids
 * a bare list of option names. The skill, `ask-well.sh` (on `PreToolUse` of
 * `AskUserQuestion`) and `decision-request.ts` all fire only when the agent
 * chooses to ask; a closing paragraph that lists what is "still yours"
 * touches no tool. This is the fourth layer, on `Stop`, where that paragraph
 * has just been written.
 *
 * It reminds and does not block: a misfiring blocking hook would leave the
 * agent unable even to report that the gate is broken, and this one reads
 * prose.
 *
 * The trigger is the conjunction, not any part alone (reporting finished
 * work legitimately names many ids):
 *
 *   an outstanding-marker  ("still yours", "unanswered", "waiting on you", …)
 *   AND >= 2 identifiers   (4-char bean ids, `#1234`, task refs)
 *   AND no comparison      (no pro/con table, no "(Recommended)", no
 *                           "if you say nothing")
 *
 * The detector is exported so its tests can use real turns as fixtures.
 *
 * @module scripts/decisions-named-not-asked
 */

/** Phrases that mark an item as the READER's to decide, rather than reported. */
const OUTSTANDING = [
  "still yours",
  "still open",
  "all theirs",
  "outstanding",
  "unanswered",
  "waiting on you",
  "needs you",
  "your call",
  "awaits",
  "awaiting an owner",
  "yours to settle",
  "yours now",
  "for you to",
  "pending your",
];

/**
 * Structure that means the terms ARE present, so the paragraph is an ask.
 *
 * Deliberately generous: a false negative here costs a missed reminder, a false
 * positive costs noise on a turn that did the right thing, and noise is what
 * makes a reminder ignored.
 */
const COMPARED = [
  "(recommended)",
  "if you say nothing",
  "default if you say nothing",
  "| pro |",
  "| downstream |",
  "reversibility",
  "pros/cons",
  "what differs",
];

/** A bean id (four lowercase alphanumerics in backticks) or an issue/PR ref. */
const ID = /`[a-z0-9]{4}`|#\d{2,5}\b|\btask #\d+/g;

export interface Finding {
  /** The paragraph that named decisions without their terms. */
  readonly paragraph: string;
  /** Which outstanding-marker matched. */
  readonly marker: string;
  /** The identifiers named in it. */
  readonly ids: readonly string[];
}

/**
 * Paragraphs that hand decisions over without their terms.
 *
 * Splits on blank lines rather than sentences: the shape is a closing
 * PARAGRAPH, and a sentence split would miss "Still yours:" followed by a list
 * on the next line.
 */
export function findNamedNotAsked(message: string): Finding[] {
  const out: Finding[] = [];
  for (const para of message.split(/\n\s*\n/)) {
    const low = para.toLowerCase();
    const marker = OUTSTANDING.find((m) => low.includes(m));
    if (marker === undefined) continue;
    if (COMPARED.some((c) => low.includes(c))) continue;
    const ids = [...new Set(para.match(ID) ?? [])];
    if (ids.length < 2) continue;
    out.push({ paragraph: para.trim(), marker, ids });
  }
  return out;
}

/** The reminder. Printed, never enforced — see the docblock. */
export function reminder(findings: readonly Finding[]): string {
  const f = findings[0]!;
  return [
    "",
    "── interaction-modality §4.1 — you NAMED decisions without their terms ───────",
    "",
    `  ${findings.length} paragraph(s) in this turn hand a decision to the reader`,
    `  with no way to answer it. The first names ${f.ids.length}: ${f.ids.join(", ")}`,
    `  after "${f.marker}".`,
    "",
    "  §\"More than one decision pending\": ask ONE in full, give a COUNT for the",
    "  rest. NEVER a list of names without their costs — that is the teaser the",
    "  rule forbids, and it is worse than silence because it invites an answer",
    "  the reader cannot form.",
    "",
    "  There is no \"just listing what's open\" exemption. A wrap-up that names a",
    "  decision has handed it over, whatever the framing sentence says.",
    "",
    "  For the one you ask: what DIFFERS by the answer, every id glossed, the",
    "  options compared on does / pro / con / DOWNSTREAM / reversibility, your",
    "  recommendation marked, and what happens if they say nothing.",
    "",
    "  More than two options? Build a DecisionRequest and `renderDecision` it,",
    "  and put the record on the bean under `## Options` (bean `hajp`).",
    "",
    "  Full rule: cat-harness/skills/conduct/conduct-core/interaction-modality.md §4.1",
    "──────────────────────────────────────────────────────────────────────────────",
    "",
  ].join("\n");
}

/**
 * Read the `Stop` hook payload and report.
 *
 * Exits 0 whatever it finds. The hook's value is that the notice lands in the
 * transcript next to the paragraph that earned it; turning it into a refusal
 * would trade that for the failure mode `hajp` already rejected.
 */
async function main(): Promise<number> {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;

  let transcriptPath: string | undefined;
  try {
    transcriptPath = (JSON.parse(raw) as { transcript_path?: string }).transcript_path;
  } catch {
    // No payload, or not JSON. Nothing to read; say nothing rather than guess.
    return 0;
  }
  if (transcriptPath === undefined) return 0;

  const { readFileSync, existsSync } = await import("node:fs");
  if (!existsSync(transcriptPath)) return 0;

  // The last assistant text in the transcript is the turn that just ended.
  let last = "";
  for (const line of readFileSync(transcriptPath, "utf8").split("\n")) {
    if (line.trim() === "") continue;
    try {
      const e = JSON.parse(line) as {
        type?: string;
        message?: { role?: string; content?: unknown };
      };
      if (e.type !== "assistant" && e.message?.role !== "assistant") continue;
      const c = e.message?.content;
      if (typeof c === "string") last = c;
      else if (Array.isArray(c)) {
        const text = c
          .filter((b): b is { type: string; text: string } => (b as { type?: string }).type === "text")
          .map((b) => b.text)
          .join("\n");
        if (text !== "") last = text;
      }
    } catch {
      // A malformed line is not a reason to abandon the rest of the transcript.
    }
  }

  const findings = findNamedNotAsked(last);
  if (findings.length > 0) process.stderr.write(reminder(findings));
  return 0;
}

if (import.meta.main) process.exit(await main());
