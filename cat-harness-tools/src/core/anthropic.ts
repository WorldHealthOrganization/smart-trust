/**
 * The process's one Anthropic client, or `null` when no key is configured.
 *
 * Moved out of `routes/chat.ts` (bean `w2gr`, step 2). That route is server
 * code and moves to `cat-harness-tools`; the content half of an adapter —
 * `characterizeChanges` and `triageFeedback` — calls this too, and the owner
 * ruled on 2026-10-01 that the content core does not depend on
 * `cat-harness-tools`. A lazily built SDK client is neither, so it stays here
 * beside `git.ts` and `feedback.ts`, and `routes/chat.ts` re-exports it.
 *
 * @module folio-assistant/core/anthropic
 */

import Anthropic from "@anthropic-ai/sdk";

let anthropic: Anthropic | null = null;

export function getAnthropic(): Anthropic | null {
  if (anthropic) return anthropic;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  anthropic = new Anthropic({ apiKey: key });
  return anthropic;
}
