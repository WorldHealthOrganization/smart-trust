/**
 * Folio Assistant — Streaming chat route (generic).
 *
 * POST /api/chat { messages[], context?, mode? }
 * Returns SSE stream. Delegates tool definitions and execution to the adapter.
 *
 * @module folio-assistant/routes/chat
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ContentAdapter } from "../types.js";
import { getUserRole, getUserName } from "../core/rbac.js";
import { log, logDebug } from "../core/logging.js";
import { guardUntrusted } from "../core/handover-screen.js";
import type { MountedRoute, RouteDeps } from "../route-groups.js";
import { refuseChatMode, refuseChatRequest } from "../core/http-guard.js";

// Lives in `core/anthropic.ts` (bean `w2gr`, step 2) so the content half of an
// adapter can reach it without importing this route; re-exported for the
// importers this module already had.
import { getAnthropic } from "../core/anthropic.js";
export { getAnthropic };

export async function handleChatPost(
  url: URL,
  req: Request,
  adapter: ContentAdapter,
): Promise<Response | null> {
  if (url.pathname !== "/api/chat") return null;

  // Chat spends the server's API key: authorised, JSON-only, same-origin.
  const refused = refuseChatRequest(req);
  if (refused) return refused;

  try {
    const body = (await req.json()) as {
      messages: Array<{ role: string; content: string }>;
      context?: Record<string, unknown>;
      mode?: "read" | "edit" | "status";
    };

    const mode = body.mode || "read";
    const badMode = refuseChatMode(req, mode);
    if (badMode) return badMode;

    const client = getAnthropic();
    if (!client) {
      return Response.json(
        { error: "ANTHROPIC_API_KEY not set. Chat requires an API key." },
        { status: 503 },
      );
    }

    const userRole = getUserRole(req);
    const userName = getUserName(req);

    const chatTools = adapter.getChatTools() as Anthropic.Tool[];
    const systemPrompt = adapter.getChatSystemPrompt(mode, userRole, userName, body.context);

    const apiMessages: Anthropic.MessageParam[] = body.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const encoder = new TextEncoder();
    const sseHeaders = {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    };

    const readable = new ReadableStream({
      async start(controller) {
        const send = (obj: Record<string, unknown>) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

        try {
          let toolRounds = 0;
          const MAX_TOOL_ROUNDS = 3;

          while (toolRounds < MAX_TOOL_ROUNDS) {
            send({ status: toolRounds === 0 ? "thinking..." : `looking up data (step ${toolRounds + 1})...` });

            const response = await client.messages.create({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 1500,
              system: systemPrompt,
              tools: chatTools,
              messages: apiMessages,
            });

            // Predicate form: `Array.filter` narrows the element type only
            // when the callback is a type guard, which is why the `.map`s
            // below had to reopen each block to reach fields the SDK declares.
            const toolUses = response.content.filter(
              (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
            );
            if (toolUses.length === 0) {
              const textBlocks = response.content.filter(
                (b): b is Anthropic.TextBlock => b.type === "text",
              );
              const fullText = textBlocks.map((b) => b.text).join("");
              const chunkSize = 20;
              for (let i = 0; i < fullText.length; i += chunkSize) {
                send({ text: fullText.slice(i, i + chunkSize) });
              }
              send({});
              controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
              logDebug("chat", `complete (${toolRounds} tool rounds, ${fullText.length} chars)`);
              controller.close();
              return;
            }

            const toolNames = toolUses.map((t) => t.name);
            logDebug("chat:tools", `round ${toolRounds + 1}: ${toolUses.length} calls`, toolNames.join(", "));
            send({ status: toolNames.join(", ") + "..." });

            apiMessages.push({ role: "assistant", content: response.content });

            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const tu of toolUses) {
              const toolUseBlock = tu as Anthropic.ToolUseBlock;
              const result = await adapter.executeChatTool(
                toolUseBlock.name,
                toolUseBlock.input as Record<string, unknown>,
                body.context,
              );
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUseBlock.id,
                // A tool result carries corpus and commenter text: data, never instruction (H5, H9; bean `cztn`).
                content: guardUntrusted(result, `tool ${toolUseBlock.name}`),
              });
            }
            apiMessages.push({ role: "user", content: toolResults });
            toolRounds++;
          }

          // Exhausted tool rounds — final streaming call
          send({ status: "composing response..." });
          const stream = await client.messages.stream({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1500,
            system: systemPrompt,
            messages: apiMessages,
          });

          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              send({ text: event.delta.text });
            }
          }
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (e) {
          log("chat", "stream error", String(e));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(e) })}\n\n`));
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, { headers: sseHeaders });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

// ── Mount ────────────────────────────────────────────────────────

/**
 * Mount factory read by the route declaration in `src/server.ts`.
 *
 * POST only: chat has no GET surface, and {@link MountedRoute} leaves `get`
 * optional rather than making every route supply a handler that returns
 * `null`. An absent handler and one that never matches look the same to the
 * dispatcher, and only one of them is honest about what this route serves.
 *
 * It needs no `feedbackStore`. `handleChatPost` took one as `_feedbackStore`
 * and never read it — a dead parameter that, once `src/core/feedback.ts`
 * became core, was a wrong-direction import bought with nothing.
 */
export function mountChatRoutes(deps: RouteDeps): MountedRoute {
  const adapter = deps.adapter as ContentAdapter;
  return { post: (url, req) => handleChatPost(url, req, adapter) };
}
