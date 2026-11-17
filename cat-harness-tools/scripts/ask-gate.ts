#!/usr/bin/env bun
/**
 * @module scripts/ask-gate
 * @covers none — a Claude Code hook, not a graph writer
 *
 * The asking rule as a gate on decision cards, failing open.
 *
 * Reads the session transcript the hook is given, and refuses a
 * `request_decision` card unless a `post_message` written since the person's
 * last message names every option the card offers. (`ask-well.sh` only
 * reminds, and cannot see earlier messages.)
 *
 * It FAILS OPEN, since a misfiring blocking hook would leave the agent unable
 * to ask anything: any error, unreadable transcript or unexpected shape lets
 * the card through. Only a positive finding (the transcript was read, and the
 * options are missing from the prose) blocks.
 *
 * Exit 0 lets the call through. Exit 2 blocks it, and stderr tells the agent why.
 */
import { readFileSync } from "node:fs";

/** One transcript line, as far as this gate reads it. */
type Line = {
  type?: string;
  message?: { content?: unknown };
};

type ToolUse = { type: "tool_use"; name: string; input: Record<string, unknown> };

const isToolUse = (x: unknown): x is ToolUse =>
  typeof x === "object" && x !== null && (x as { type?: unknown }).type === "tool_use" &&
  typeof (x as { name?: unknown }).name === "string";

/**
 * A user line that is the person (or a wake) speaking, not a tool result
 * coming back. Tool results are user lines whose content is only
 * `tool_result` blocks.
 */
function isPrompt(line: Line): boolean {
  if (line.type !== "user") return false;
  const c = line.message?.content;
  if (typeof c === "string") return true;
  if (Array.isArray(c)) return c.some((b) => (b as { type?: unknown })?.type === "text");
  return false;
}

/** The text of every post_message written since the last prompt. */
export function proseSinceLastPrompt(lines: Line[]): string[] {
  const out: string[] = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!;
    if (isPrompt(line)) break;
    if (line.type !== "assistant") continue;
    const c = line.message?.content;
    if (!Array.isArray(c)) continue;
    for (const b of c) {
      if (isToolUse(b) && b.name.endsWith("__post_message") && typeof b.input.text === "string") {
        out.push(b.input.text);
      }
    }
  }
  return out;
}

/** How an option label must appear in the prose: its letter ("A." or "A)"), else the whole label. */
export function optionMarker(label: string): RegExp {
  const m = /^\s*([A-Z])[.)]/.exec(label);
  if (m) return new RegExp(`(^|[^A-Za-z0-9])${m[1]}[.)]`, "m");
  const esc = label.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(esc, "i");
}

export type Verdict = { allow: true } | { allow: false; reason: string };

/** The decision, given the card's options and the transcript. */
export function judge(options: unknown, lines: Line[]): Verdict {
  if (!Array.isArray(options)) return { allow: true };
  const labels = options
    .map((o) => (o as { label?: unknown })?.label)
    .filter((l): l is string => typeof l === "string" && l.trim() !== "");
  if (labels.length === 0) return { allow: true };
  const prose = proseSinceLastPrompt(lines).join("\n\n");
  if (prose.trim() === "") {
    return {
      allow: false,
      reason:
        "No written question since the person's last message. Post the FULL question first " +
        "(context, every option with its letter, pros and cons, your recommendation, what " +
        "happens if they say nothing), then this card with the same letters.",
    };
  }
  const missing = labels.filter((l) => !optionMarker(l).test(prose));
  if (missing.length > 0) {
    return {
      allow: false,
      reason:
        `The written question before this card does not name these options: ${missing
          .map((l) => JSON.stringify(l))
          .join(", ")}. Put every option, with the same letter, in the message first.`,
    };
  }
  return { allow: true };
}

function main(): number {
  let input: { tool_name?: unknown; tool_input?: { options?: unknown }; transcript_path?: unknown };
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return 0;
  }
  if (typeof input.tool_name !== "string" || !input.tool_name.endsWith("request_decision")) return 0;
  if (typeof input.transcript_path !== "string") return 0;
  let lines: Line[];
  try {
    lines = readFileSync(input.transcript_path, "utf8")
      .split("\n")
      .filter((l) => l.trim() !== "")
      .flatMap((l) => {
        try {
          return [JSON.parse(l) as Line];
        } catch {
          return [];
        }
      });
  } catch {
    return 0;
  }
  if (lines.length === 0) return 0;
  const v = judge(input.tool_input?.options, lines);
  if (v.allow) return 0;
  process.stderr.write(`ask-gate (interaction-modality §4.1, bean hajp): ${v.reason}\n`);
  return 2;
}

if (import.meta.main) {
  let code = 0;
  try {
    code = main();
  } catch {
    code = 0;
  }
  process.exit(code);
}
