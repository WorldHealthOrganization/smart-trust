/**
 * Screen a hand-over before a model reads it: a sub-agent's report, a
 * delegated prompt, a tool result, or a comment from a person who is not the
 * session's principal. Rules H3, H5 and H9 of
 * `skills/conduct/security/zero-trust-handover.md`; the logic is
 * `cat-harness-tools/src/core/handover-screen.ts`.
 *
 * Usage:
 *   bun run cat handover:screen --schema <schema.json> <payload.json>
 *   bun run cat handover:screen --text <file>      # one free-text field, read as DATA
 *
 * The schema is `{ "fields": { "<name>": <spec> }, "strict"?: bool }`, where a
 * spec is `"control"`, `"data"`, or `{ "role": ..., "pattern"?: "<regex>",
 * "oneOf"?: [...] }` to constrain the VALUE.
 *
 * Exit status is the verdict, so a caller can branch without parsing:
 *   0 clean · 1 refused · 3 quarantined · 2 could not determine (bad input).
 * "Could not determine" is never clean. The verdict is printed as JSON, and
 * the payload is never rewritten. The JSON carries a `meaning` line, because
 * the state `clean` is a name kept for compatibility and NOT a clearance: it
 * means no pattern fired, and a paraphrased injection fires none (H5).
 *
 * @graphNode tool
 * @covers none — it judges a payload handed to it, not a declared graph typology
 */
import { readFileSync } from "node:fs";

import { screenHandover, type HandoverSchema, type ScreenVerdict } from "../src/core/handover-screen.ts";

export const SCREEN_EXIT = { clean: 0, refused: 1, undetermined: 2, quarantined: 3 } as const;

/** What each state means, printed with the verdict. `clean` says what it is not. */
export const SCREEN_MEANING: Record<ScreenVerdict["state"], string> = {
  clean: "no pattern fired (not a clearance)",
  quarantined: "a data field carries text shaped like an instruction; kept unchanged, pass it on fenced",
  refused: "a control field failed the screen or its constraint, or a field is undeclared; do not pass it on",
};

function print(v: ScreenVerdict): { code: number; out: string } {
  return { code: SCREEN_EXIT[v.state], out: JSON.stringify({ meaning: SCREEN_MEANING[v.state], ...v }, null, 2) };
}

function specsAreValid(fields: Record<string, unknown>): boolean {
  return Object.values(fields).every((s) => {
    if (s === "control" || s === "data") return true;
    if (s === null || typeof s !== "object") return false;
    const c = s as { role?: unknown; pattern?: unknown; oneOf?: unknown };
    return (
      (c.role === "control" || c.role === "data") &&
      (c.pattern === undefined || typeof c.pattern === "string") &&
      (c.oneOf === undefined || (Array.isArray(c.oneOf) && c.oneOf.every((o) => typeof o === "string")))
    );
  });
}

function arg(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

export function run(argv: string[]): { code: number; out: string } {
  try {
    const text = arg(argv, "--text");
    if (text !== undefined) {
      return print(screenHandover({ text: readFileSync(text, "utf-8") }, { fields: { text: "data" } }));
    }
    const schemaPath = arg(argv, "--schema");
    const payloadPath = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--schema").pop();
    if (!schemaPath || !payloadPath) {
      return { code: SCREEN_EXIT.undetermined, out: "usage: handover:screen --schema <schema.json> <payload.json> | --text <file>" };
    }
    const schema = JSON.parse(readFileSync(schemaPath, "utf-8")) as HandoverSchema;
    if (!schema || typeof schema.fields !== "object" || schema.fields === null) {
      return { code: SCREEN_EXIT.undetermined, out: "the schema declares no `fields`: nothing can be judged against it" };
    }
    if (!specsAreValid(schema.fields as Record<string, unknown>)) {
      return {
        code: SCREEN_EXIT.undetermined,
        out: 'a field spec is neither "control", "data" nor { role, pattern?: string, oneOf?: string[] }',
      };
    }
    return print(screenHandover(JSON.parse(readFileSync(payloadPath, "utf-8")), schema));
  } catch (e) {
    return { code: SCREEN_EXIT.undetermined, out: `could not determine: ${String(e).split("\n")[0]}` };
  }
}

if (import.meta.main) {
  const { code, out } = run(process.argv.slice(2));
  console.log(out);
  process.exit(code);
}
