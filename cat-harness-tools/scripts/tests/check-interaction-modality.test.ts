import { describe, expect, test } from "bun:test";
import {
  auditTranscriptEvents,
  checkBriefModality,
  detectProseOwnerQuestion,
  isCardToolName,
  parseTranscriptText,
} from "../check-interaction-modality.ts";

describe("check-interaction-modality — card tool recognition", () => {
  test("recognises canonical and MCP-prefixed card tools", () => {
    expect(isCardToolName("AskUserQuestion")).toBe(true);
    expect(isCardToolName("ask_question")).toBe(true);
    expect(isCardToolName("request_decision")).toBe(true);
    expect(isCardToolName("post_widget")).toBe(true);
    expect(isCardToolName("mcp__harness__request_decision")).toBe(true);
    expect(isCardToolName("mcp__claude__AskUserQuestion")).toBe(true);
    expect(isCardToolName("Read")).toBe(false);
    expect(isCardToolName("create_session")).toBe(false);
  });
});

describe("check-interaction-modality — 2026-11-05 incident fixtures (prose questions without card)", () => {
  test("fires on every 2026-11-05 prose-only owner question from bean 55ka", () => {
    const incidentTurns: Array<{ id: string; text: string }> = [
      {
        id: "drnh (session_01VQDpPfGantMCt7AV4LCCK2, 12:56Z)",
        text: "Spawned 5 helpers (stalled-pickup-2026-11-05 A–E). Open for the owner: whether cat-harness-file checks run only in the committing repo (exit-78 counts as a new failure).",
      },
      {
        id: "rpc6 (session_01VQDpPcVohXoCeZb3TEMGfp, 12:58:17Z)",
        text: "Blocked: add_repo for smart-ra and smart-immunizations was refused by the permission check in this session, so no site repo is reachable yet; asked the owner.",
      },
      {
        id: "f1nc (session_01VQDpPg681u1Pt3MCpbmx8J, 12:59Z)",
        text: "Step 1 blocked: add_repo for litlfred/cat-harness-tools (push) was refused by the session permission classifier, so tools#1479 cannot be read or merged from here. Asked owner.",
      },
      {
        id: "exrp (session_01VQDpPfeNxqnLV7Dcpo1Uo1, 13:00Z)",
        text: "Blocked: add_repo for litlfred/cat-harness-tools and litlfred/cat-harness (push) was denied by the session permission classifier. Awaiting owner decision.",
      },
      {
        id: "2lfx (session_01VQDpPfwYbADcuuX2ZBXvqn, 13:40Z)",
        text: "Open: audit-coverage regeneration (3A) — the 're-pin session' it was handed to is not identifiable; asked owner.",
      },
      {
        id: "70hd turn 1 (session_01VQDpPbqnwyoWW5d3Rc1vEk, 13:40Z)",
        text: "Fix written and tested; not yet pushed: this session's add_repo for litlfred/cat-harness-tools (push) was refused by the permission classifier, so the owner must allow it.",
      },
      {
        id: "70hd turn 2 (session_01VQDpPbqnwyoWW5d3Rc1vEk, 14:40Z)",
        text: "Open: generator --check halves need an owner call.",
      },
      {
        id: "xxow (session_01VQDpPfQjS6Ah9hRnot9HUp, 16:09Z)",
        text: "Explained on #103; asked owner: (1) narrow pin c938217+#645, (2) also move cat-harness pin (re-pin train), (3) hold.",
      },
      {
        id: "akiq (session_01VQDpPfJKxVERPVKKWBTY8z, 11:35:43Z)",
        text: "### Completed\n\n- Built drawing generator.\n\n## Open questions for the owner\n\n1. Where should a layer's drawing live?\n2. Should a layer with no site of its own still commit drawings?",
      },
      {
        id: "ay33 (CI speed: prepared image, 11:55:31Z)",
        text: "Workflow drafted and tested. Owner decision pending: whether the GHCR package goes public or jobs get `packages: read`.",
      },
      {
        id: "asq1 (session_01VQDpPejdhwKpDJHfgEBPTk, 13:24:22Z)",
        text: "Open policy point for the owner: the retired-word rule now applies to newly written work-plan prose; it can be dropped with a one-line change.",
      },
    ];

    for (const sample of incidentTurns) {
      const finding = detectProseOwnerQuestion(sample.text, 0);
      expect(finding, `expected finding for ${sample.id}`).toBeDefined();
    }
  });

  test("fires on an assistant turn ending in a direct question or option list with no card call", () => {
    const directQuestionTurn = [
      {
        type: "user",
        message: { role: "user", content: "Check the re-pin status." },
      },
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            {
              type: "text",
              text: "We can either (1) narrow-pin c938217 only or (2) move the cat-harness pin as well.\n\nWhich option would you like me to take?",
            },
          ],
        },
      },
    ];

    const audit = auditTranscriptEvents(directQuestionTurn);
    expect(audit.ok).toBe(false);
    expect(audit.proseQuestions).toHaveLength(1);
    expect(audit.proseQuestions[0]!.kind).toBe("trailing-question");
  });

  test("passes (anti-vacuity pair) when the same question turn also calls AskUserQuestion / ask_question", () => {
    const compliantTurn = [
      {
        type: "user",
        message: { role: "user", content: "Check the re-pin status." },
      },
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            {
              type: "text",
              text: "**Context.** Pinning `c938217` alone isolates the fix.\n\n1. **(Recommended) Narrow-pin c938217** — lowest blast radius.\n2. **Move cat-harness pin too** — picks up 4 unrelated commits.\n\nDefault on silence: Option 1.\n\nWhich option should we take?",
            },
            {
              type: "tool_use",
              name: "AskUserQuestion",
              input: {
                questions: [
                  {
                    question: "Which pin strategy should we use?",
                    options: [
                      "(Recommended) 1. Narrow-pin c938217",
                      "2. Move cat-harness pin too",
                    ],
                  },
                ],
              },
            },
          ],
        },
      },
    ];

    const audit = auditTranscriptEvents(compliantTurn);
    expect(audit.ok).toBe(true);
    expect(audit.proseQuestions).toHaveLength(0);
  });

  test("passes when a subagent returns a structured hand-back-to-discussion JSON block", () => {
    const handBackTurn = [
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: `Here is the decision for the coordinator:\n\n\`\`\`json\n{\n  "decision": "Q-PIN-1",\n  "question": "Should we narrow-pin c938217 or move the full cat-harness pin?",\n  "context": "Moving the full pin pulls in 4 unreviewed commits.",\n  "options": [\n    { "id": "A", "label": "Narrow-pin c938217", "pros": "Isolated", "cons": "Needs follow-up", "downstream": "dth-hrh only", "reversibility": "easy" }\n  ],\n  "recommended": "A",\n  "why_recommended": "Smallest diff",\n  "default_on_silence": "A"\n}\n\`\`\``,
        },
      },
    ];

    const audit = auditTranscriptEvents(handBackTurn);
    expect(audit.ok).toBe(true);
    expect(audit.proseQuestions).toHaveLength(0);
  });

  test("does not false-positive on ordinary progress turns or historical card citations", () => {
    const ordinaryTurns = [
      {
        type: "assistant",
        message: {
          role: "assistant",
          content:
            "Owner allowed push (card 'Tools push', option 1: merge on green). Pushed branch and opened PR #1500.",
        },
      },
    ];

    const audit = auditTranscriptEvents(ordinaryTurns);
    expect(audit.ok).toBe(true);
    expect(audit.proseQuestions).toHaveLength(0);
  });
});

describe("check-interaction-modality — sibling brief and subagent prompt check", () => {
  test("flags a child brief that omits interaction-modality", () => {
    const thinBrief =
      "Do bean folio-assistant-rpc6 on branch feat/rpc6 of repo litlfred/smart-ra. Re-pin the submodules and open a PR.";
    const res = checkBriefModality(thinBrief);
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("interaction-modality");
  });

  test("accepts a brief that names interaction-modality or hand-back-to-discussion, or spells out the card + framing rules", () => {
    const briefWithSkillRef =
      "Do bean folio-assistant-rpc6. Follow `interaction-modality`: full question in chat first (≤ 4 options, recommended first, default on silence) then `AskUserQuestion` card; never ask in prose alone. Pass `interaction-modality` on to any subagent you spawn.";
    expect(checkBriefModality(briefWithSkillRef).ok).toBe(true);

    const briefWithHandBack =
      "Assigned Work Item: folio-assistant-55ka. Return any owner question to the coordinator in `hand-back-to-discussion` format.";
    expect(checkBriefModality(briefWithHandBack).ok).toBe(true);
  });

  test("audits create_session and invoke_subagent calls in a transcript", () => {
    const jsonl = [
      JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              name: "mcp__claude-code-remote__create_session",
              input: {
                prompt:
                  "Do bean folio-assistant-rpc6. Re-pin smart-ra and open a PR.",
              },
            },
            {
              type: "tool_use",
              name: "invoke_subagent",
              input: {
                TypeName: "self",
                Role: "Worker Lane 1",
                Prompt:
                  "Do bean folio-assistant-55ka. Follow `interaction-modality` (or return questions in `hand-back-to-discussion` format) and pass it on to any child you spawn.",
              },
            },
          ],
        },
      }),
    ].join("\n");

    const events = parseTranscriptText(jsonl);
    const audit = auditTranscriptEvents(events);
    expect(audit.ok).toBe(false);
    expect(audit.briefsMissingModality).toHaveLength(1);
    expect(audit.briefsMissingModality[0]!.toolName).toBe(
      "mcp__claude-code-remote__create_session",
    );
  });
});
