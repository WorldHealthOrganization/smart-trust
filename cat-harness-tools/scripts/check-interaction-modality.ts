#!/usr/bin/env bun
/**
 * check-interaction-modality.ts — Audit session transcripts (`list_events` JSON
 * or JSONL) and sibling/subagent briefs for compliance with
 * `cat-harness/skills/conduct/conduct-core/interaction-modality.md` and
 * `cat-harness/skills/conduct/conduct-core/hand-back-to-discussion.md`.
 *
 * Work item: folio-assistant-55ka
 *
 * Two checks:
 * 1. Assistant turns in a transcript (`list_events` / JSONL / Stop hook):
 *    flags any assistant turn that asks the owner a question or parks an
 *    owner decision in prose without calling a tappable card tool
 *    (`AskUserQuestion`, `request_decision`, `ask_question`, `post_widget`)
 *    in the same turn (or returning a structured `hand-back-to-discussion`
 *    payload to a coordinating parent).
 * 2. Sibling briefs and subagent prompts (`create_session`, `Agent`,
 *    `invoke_subagent`, `Task`, or task-dispatch `send_message` calls, plus
 *    standalone brief files): verifies that every brief carries the
 *    `interaction-modality` rule (or `hand-back-to-discussion`) so spawned
 *    children do not default to asking the owner in prose without a card.
 */

import { existsSync, readFileSync } from "node:fs";

export const CARD_TOOL_BASE_NAMES = [
  "AskUserQuestion",
  "ask_question",
  "request_decision",
  "post_widget",
] as const;

export const CHILD_SPAWN_TOOL_BASE_NAMES = [
  "create_session",
  "Agent",
  "invoke_subagent",
  "Task",
  "send_message",
] as const;

export interface ProseQuestionFinding {
  turnIndex: number;
  kind: "trailing-question" | "uncarded-owner-ask";
  excerpt: string;
  reason: string;
}

export interface BriefModalityResult {
  ok: boolean;
  hasModalityRef: boolean;
  hasHandBackRef: boolean;
  hasCardRequirement: boolean;
  hasFramingRule: boolean;
  reason?: string;
}

export interface BriefModalityFinding {
  turnIndex: number;
  toolName: string;
  excerpt: string;
  reason: string;
}

export interface TranscriptAuditResult {
  ok: boolean;
  turnCount: number;
  proseQuestions: ProseQuestionFinding[];
  briefsMissingModality: BriefModalityFinding[];
}

export interface NormalizedToolCall {
  name: string;
  input: Record<string, unknown>;
}

export interface NormalizedAssistantTurn {
  turnIndex: number;
  texts: string[];
  toolCalls: NormalizedToolCall[];
}

/**
 * Match a tool name against a list of canonical base names, allowing MCP
 * prefixes (`mcp__server__ToolName`) or namespace separators (`:`, `/`, `.`).
 */
export function matchesToolBaseName(
  toolName: string,
  baseNames: readonly string[],
): string | undefined {
  const trimmed = toolName.trim();
  for (const base of baseNames) {
    if (trimmed === base) return base;
    if (
      trimmed.endsWith(`__${base}`) ||
      trimmed.endsWith(`:${base}`) ||
      trimmed.endsWith(`/${base}`) ||
      trimmed.endsWith(`.${base}`)
    ) {
      return base;
    }
  }
  return undefined;
}

export function isCardToolName(toolName: string): boolean {
  return matchesToolBaseName(toolName, CARD_TOOL_BASE_NAMES) !== undefined;
}

/**
 * Strip fenced code blocks and markdown blockquotes so quoted examples or code
 * comments do not trigger prose question detection.
 */
export function stripCodeAndQuotes(markdown: string): string {
  const withoutFences = markdown.replace(/```[\s\S]*?```/g, "");
  return withoutFences
    .split("\n")
    .filter((line) => !/^\s*>/.test(line))
    .join("\n")
    .replace(/`[^`\n]+`/g, (match) => " ".repeat(match.length));
}

/**
 * Detect whether an assistant message is a structured `hand-back-to-discussion`
 * payload (JSON with `decision`, `question`, `options`, `recommended`,
 * `default_on_silence`) returned by a subagent or sibling to its coordinator.
 */
export function hasHandBackToDiscussionPayload(markdown: string): boolean {
  if (
    markdown.includes('"default_on_silence"') &&
    markdown.includes('"recommended"') &&
    markdown.includes('"options"') &&
    markdown.includes('"question"')
  ) {
    return true;
  }
  return false;
}

const DIRECT_OWNER_QUESTION_RE =
  /\b(?:would you|should (?:i|we)|do you (?:want|prefer|agree|approve)|which (?:option|approach|route|one|way|of these)|shall (?:i|we)|can you (?:confirm|approve|allow|choose|pick|let me know)|could you (?:confirm|approve|allow|choose|pick)|may i\b|want me to\b|how should (?:i|we)|where should (?:i|we|a\b|the\b)|please (?:choose|pick|select|confirm))\b/i;

const OPTION_LIST_BEFORE_QUESTION_RE =
  /(?:^|\n)\s*(?:(?:\([1-4A-Da-d]\)|[1-4A-Da-d][.)])\s+\S+[\s\S]{0,400}){2,}/;

const UNCARDED_OWNER_ASK_PATTERNS: Array<{
  pattern: RegExp;
  reason: string;
}> = [
  {
    pattern: /(?:^|\n)\s*#{1,6}\s*open questions? for the owner\b/i,
    reason: "Section heading 'Open question(s) for the owner' written in prose without a card tool call",
  },
  {
    pattern: /\bopen (?:policy point |questions? |decisions? )?for the owner\s*:/i,
    reason: "'Open ... for the owner:' written in prose without a card tool call",
  },
  {
    pattern: /\bowner decision pending\s*:/i,
    reason: "'Owner decision pending:' recorded in prose without a card tool call",
  },
  {
    pattern: /\bawaiting owner decision\b/i,
    reason: "'Awaiting owner decision' in prose without a card tool call",
  },
  {
    pattern: /\bneed(?:s)? an owner call\b/i,
    reason: "'Needs an owner call' in prose without a card tool call",
  },
  {
    pattern: /\bthe owner must allow it\b/i,
    reason: "Permission blocker ('the owner must allow it') left in prose without a card tool call",
  },
  {
    pattern: /\basked (?:the )?owner\s*(?:[.;]|:\s*\([1-4a-d]\))/i,
    reason: "'Asked (the) owner' in prose without a card tool call",
  },
];

/**
 * Inspect the prose of a single assistant turn (assuming no card tool was
 * called in that turn) and return a finding if it asks the owner a question or
 * leaves an un-carded owner decision in prose.
 */
export function detectProseOwnerQuestion(
  turnText: string,
  turnIndex = 0,
): ProseQuestionFinding | undefined {
  if (!turnText.trim()) return undefined;
  if (hasHandBackToDiscussionPayload(turnText)) return undefined;

  const cleaned = stripCodeAndQuotes(turnText).trim();
  if (!cleaned) return undefined;

  // 1. Check explicit un-carded owner-ask patterns from the 2026-11-05 incident
  for (const { pattern, reason } of UNCARDED_OWNER_ASK_PATTERNS) {
    const match = pattern.exec(turnText);
    if (match) {
      // Ignore if the same line explicitly documents a card that was presented
      const lineStart = turnText.lastIndexOf("\n", match.index) + 1;
      const lineEnd = turnText.indexOf("\n", match.index);
      const line = turnText
        .slice(lineStart, lineEnd === -1 ? undefined : lineEnd)
        .trim();
      if (/\b(?:card|AskUserQuestion|request_decision|ask_question)\b/i.test(line)) {
        continue;
      }
      return {
        turnIndex,
        kind: "uncarded-owner-ask",
        excerpt: line.slice(0, 200),
        reason,
      };
    }
  }

  // 2. Check whether the turn ends with a question directed at the owner/user
  const paragraphs = cleaned
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return undefined;

  const lastParagraph = paragraphs[paragraphs.length - 1]!;
  const tailWindow = paragraphs.slice(-3).join("\n\n");

  if (/\?\s*["')*\]]*\s*$/.test(lastParagraph)) {
    const hasDirectCue = DIRECT_OWNER_QUESTION_RE.test(lastParagraph);
    const hasOptionList = OPTION_LIST_BEFORE_QUESTION_RE.test(tailWindow);
    if (hasDirectCue || hasOptionList) {
      const lastLine = lastParagraph.split("\n").pop()?.trim() ?? lastParagraph;
      return {
        turnIndex,
        kind: "trailing-question",
        excerpt: lastLine.slice(0, 200),
        reason:
          "Assistant turn ends with an owner-directed question in prose but makes no AskUserQuestion / request_decision / ask_question / post_widget tool call",
      };
    }
  }

  return undefined;
}

/**
 * Verify that a sibling brief or subagent prompt includes the
 * `interaction-modality` rule (or `hand-back-to-discussion`).
 */
export function checkBriefModality(briefText: string): BriefModalityResult {
  const hasModalityRef = /\binteraction-modality\b/i.test(briefText);
  const hasHandBackRef = /\bhand-back-to-discussion\b/i.test(briefText);
  const hasCardRequirement =
    /\b(?:AskUserQuestion|request_decision|ask_question|post_widget|tappable card)\b/i.test(
      briefText,
    ) && /\b(?:never\s+(?:ask\s+)?(?:in\s+)?prose(?:\s+alone)?|without\s+a\s+card|chat\s+first)\b/i.test(briefText);
  const hasFramingRule =
    /\b(?:recommended|default[_\s-]on[_\s-]silence|≤\s*4|at\s+most\s+(?:4|four))\b/i.test(
      briefText,
    );

  const ok =
    hasModalityRef ||
    hasHandBackRef ||
    (hasCardRequirement && hasFramingRule);

  if (ok) {
    return {
      ok: true,
      hasModalityRef,
      hasHandBackRef,
      hasCardRequirement,
      hasFramingRule,
    };
  }

  return {
    ok: false,
    hasModalityRef,
    hasHandBackRef,
    hasCardRequirement,
    hasFramingRule,
    reason:
      "Brief does not carry the `interaction-modality` (or `hand-back-to-discussion`) contract: must name `interaction-modality` / `hand-back-to-discussion` or state both the card tool requirement (`AskUserQuestion` / `request_decision` / `ask_question` / `post_widget`, never prose alone) and the framing rules (≤ 4 options, recommended first, default on silence).",
  };
}

/**
 * Determine whether a `send_message` call is a task/sibling brief (rather than
 * a status report or a `hand-back-to-discussion` reply back to a parent).
 */
export function isTaskBriefMessage(messageText: string): boolean {
  if (hasHandBackToDiscussionPayload(messageText)) return false;
  if (/###\s*⟦(?:PROGRESS|DONE)⟧/.test(messageText)) return false;
  if (
    /\b(?:Do bean|Assigned Work Item|Done-when|Opening brief|PROGRESS REPORTING CONTRACT|Your lane|Task Overview)\b/i.test(
      messageText,
    )
  ) {
    return true;
  }
  return false;
}

function extractBriefTextFromToolInput(
  baseToolName: string,
  input: Record<string, unknown>,
): string | undefined {
  const candidateKeys = [
    "prompt",
    "Prompt",
    "initial_prompt",
    "message",
    "Message",
    "description",
    "task",
  ];
  for (const key of candidateKeys) {
    const val = input[key];
    if (typeof val === "string" && val.trim().length > 0) {
      if (baseToolName === "send_message" && !isTaskBriefMessage(val)) {
        return undefined;
      }
      return val;
    }
  }
  return undefined;
}

/**
 * Parse raw transcript events (from `list_events` JSON array, `{ events: [...] }`,
 * or JSONL lines from Claude Code / Antigravity transcripts) into normalized
 * assistant turns grouped between user prompts.
 */
export function normalizeTranscriptTurns(
  rawEvents: unknown[],
): NormalizedAssistantTurn[] {
  const turns: NormalizedAssistantTurn[] = [];
  let current: NormalizedAssistantTurn | undefined;

  const ensureCurrent = (): NormalizedAssistantTurn => {
    if (!current) {
      current = {
        turnIndex: turns.length,
        texts: [],
        toolCalls: [],
      };
      turns.push(current);
    }
    return current;
  };

  for (const raw of rawEvents) {
    if (!raw || typeof raw !== "object") continue;
    const ev = raw as Record<string, unknown>;
    const evType = typeof ev.type === "string" ? ev.type : "";
    const msg =
      ev.message && typeof ev.message === "object"
        ? (ev.message as Record<string, unknown>)
        : undefined;
    const role =
      typeof ev.role === "string"
        ? ev.role
        : typeof msg?.role === "string"
          ? msg.role
          : "";

    // User turn boundary (ignore pure tool_result wrappers so consecutive
    // assistant steps within one user turn stay grouped together)
    if (
      evType === "user" ||
      evType === "human" ||
      evType === "USER_INPUT" ||
      role === "user" ||
      role === "human"
    ) {
      const content = msg?.content ?? ev.content;
      const isOnlyToolResult =
        Array.isArray(content) &&
        content.length > 0 &&
        content.every(
          (c) =>
            c &&
            typeof c === "object" &&
            (c as Record<string, unknown>).type === "tool_result",
        );
      if (!isOnlyToolResult) {
        current = undefined;
      }
      continue;
    }

    const isAssistantEvent =
      evType === "assistant" ||
      evType === "PLANNER_RESPONSE" ||
      role === "assistant" ||
      evType === "tool_use";

    if (!isAssistantEvent) continue;

    const turn = ensureCurrent();

    // Extract text and tool_use blocks from `message.content` or `content`
    const contentSource = msg?.content ?? ev.content;
    if (typeof contentSource === "string" && contentSource.trim()) {
      turn.texts.push(contentSource);
    } else if (Array.isArray(contentSource)) {
      for (const block of contentSource) {
        if (!block || typeof block !== "object") continue;
        const b = block as Record<string, unknown>;
        if (b.type === "text" && typeof b.text === "string" && b.text.trim()) {
          turn.texts.push(b.text);
        } else if (b.type === "tool_use" && typeof b.name === "string") {
          turn.toolCalls.push({
            name: b.name,
            input:
              b.input && typeof b.input === "object"
                ? (b.input as Record<string, unknown>)
                : {},
          });
        }
      }
    }

    // Extract top-level `tool_use` event
    if (evType === "tool_use" && typeof ev.name === "string") {
      turn.toolCalls.push({
        name: ev.name,
        input:
          ev.input && typeof ev.input === "object"
            ? (ev.input as Record<string, unknown>)
            : {},
      });
    }

    // Extract Antigravity `tool_calls` array
    if (Array.isArray(ev.tool_calls)) {
      for (const tc of ev.tool_calls) {
        if (!tc || typeof tc !== "object") continue;
        const call = tc as Record<string, unknown>;
        const name =
          typeof call.name === "string"
            ? call.name
            : typeof call.tool_name === "string"
              ? call.tool_name
              : undefined;
        if (!name) continue;
        const rawArgs = call.arguments ?? call.args ?? call.input;
        let input: Record<string, unknown> = {};
        if (rawArgs && typeof rawArgs === "object") {
          input = rawArgs as Record<string, unknown>;
        } else if (typeof rawArgs === "string") {
          try {
            const parsed = JSON.parse(rawArgs);
            if (parsed && typeof parsed === "object") input = parsed;
          } catch {
            // ignore non-JSON args
          }
        }
        turn.toolCalls.push({ name, input });
      }
    }
  }

  return turns;
}

/**
 * Audit an array of transcript events (`list_events` items or JSONL objects) for:
 * 1. Assistant turns that ask the owner in prose without a card tool call.
 * 2. Child-spawning tool calls whose brief omits `interaction-modality`.
 */
export function auditTranscriptEvents(
  rawEvents: unknown[],
): TranscriptAuditResult {
  const turns = normalizeTranscriptTurns(rawEvents);
  const proseQuestions: ProseQuestionFinding[] = [];
  const briefsMissingModality: BriefModalityFinding[] = [];

  for (const turn of turns) {
    const calledCardTool = turn.toolCalls.some((tc) => isCardToolName(tc.name));
    if (!calledCardTool && turn.texts.length > 0) {
      const combinedText = turn.texts.join("\n\n");
      const finding = detectProseOwnerQuestion(combinedText, turn.turnIndex);
      if (finding) {
        proseQuestions.push(finding);
      }
    }

    for (const tc of turn.toolCalls) {
      const baseSpawn = matchesToolBaseName(
        tc.name,
        CHILD_SPAWN_TOOL_BASE_NAMES,
      );
      if (!baseSpawn) continue;
      const briefText = extractBriefTextFromToolInput(baseSpawn, tc.input);
      if (!briefText) continue;
      const check = checkBriefModality(briefText);
      if (!check.ok) {
        briefsMissingModality.push({
          turnIndex: turn.turnIndex,
          toolName: tc.name,
          excerpt: briefText.replace(/\s+/g, " ").trim().slice(0, 180),
          reason: check.reason ?? "Missing interaction-modality in brief",
        });
      }
    }
  }

  return {
    ok: proseQuestions.length === 0 && briefsMissingModality.length === 0,
    turnCount: turns.length,
    proseQuestions,
    briefsMissingModality,
  };
}

/**
 * Parse a transcript file (either a JSON array / `{ events: [...] }` from
 * `list_events` or newline-delimited JSONL).
 */
export function parseTranscriptText(rawText: string): unknown[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) return parsed;
      if (
        parsed &&
        typeof parsed === "object" &&
        Array.isArray((parsed as Record<string, unknown>).events)
      ) {
        return (parsed as { events: unknown[] }).events;
      }
    } catch {
      // Fall through to line-by-line JSONL parsing
    }
  }
  const events: unknown[] = [];
  for (const line of trimmed.split("\n")) {
    const l = line.trim();
    if (!l) continue;
    try {
      events.push(JSON.parse(l));
    } catch {
      // Ignore malformed lines
    }
  }
  return events;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  let transcriptPath: string | undefined;
  let briefPath: string | undefined;
  let jsonOut = false;
  let hookMode = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--transcript" && args[i + 1]) {
      transcriptPath = args[++i];
    } else if (a === "--brief" && args[i + 1]) {
      briefPath = args[++i];
    } else if (a === "--json") {
      jsonOut = true;
    } else if (a === "--hook") {
      hookMode = true;
    }
  }

  // If invoked as a Stop hook with no explicit path, read `{ transcript_path }` from stdin
  if (!transcriptPath && !briefPath && (hookMode || !process.stdin.isTTY)) {
    try {
      const stdinText = readFileSync(0, "utf-8").trim();
      if (stdinText) {
        const payload = JSON.parse(stdinText) as Record<string, unknown>;
        if (typeof payload.transcript_path === "string") {
          transcriptPath = payload.transcript_path;
          hookMode = true;
        }
      }
    } catch {
      // ignore empty/non-JSON stdin
    }
  }

  if (briefPath) {
    if (!existsSync(briefPath)) {
      console.error(`File not found: ${briefPath}`);
      process.exit(2);
    }
    const briefText = readFileSync(briefPath, "utf-8");
    const result = checkBriefModality(briefText);
    if (jsonOut) {
      console.log(JSON.stringify(result, null, 2));
    } else if (!result.ok) {
      console.error(`✗ ${briefPath}: ${result.reason}`);
    } else {
      console.log(`✓ ${briefPath}: carries interaction-modality contract`);
    }
    process.exit(result.ok ? 0 : 1);
  }

  if (transcriptPath) {
    if (!existsSync(transcriptPath)) {
      if (hookMode) process.exit(0);
      console.error(`Transcript not found: ${transcriptPath}`);
      process.exit(2);
    }
    const events = parseTranscriptText(readFileSync(transcriptPath, "utf-8"));
    const audit = auditTranscriptEvents(events);
    if (jsonOut) {
      console.log(JSON.stringify(audit, null, 2));
    } else if (!audit.ok) {
      for (const q of audit.proseQuestions) {
        console.error(
          `✗ [turn ${q.turnIndex}] ${q.kind}: ${q.reason}\n  excerpt: ${q.excerpt}`,
        );
      }
      for (const b of audit.briefsMissingModality) {
        console.error(
          `✗ [turn ${b.turnIndex}] ${b.toolName}: ${b.reason}\n  excerpt: ${b.excerpt}`,
        );
      }
    } else if (!hookMode) {
      console.log(
        `✓ ${transcriptPath}: ${audit.turnCount} assistant turn(s) checked, 0 prose questions without card, 0 briefs missing interaction-modality`,
      );
    }
    process.exit(hookMode ? 0 : audit.ok ? 0 : 1);
  }

  console.error(
    "Usage: bun scripts/check-interaction-modality.ts [--transcript <path>] [--brief <path>] [--hook] [--json]",
  );
  process.exit(2);
}
