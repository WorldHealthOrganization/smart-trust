/**
 * Tests that `POST /api/feedback` populates real `TodoTags` (`roles`,
 * `processes`, `tasks`, `identities`, `references`) from the submitting
 * request context (bean `folio-assistant-c4rz`).
 */

import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { FeedbackStore } from "@litlfred/cat-harness-tools/src/core/feedback.js";
import type { ContentAdapter } from "@litlfred/cat-harness-tools/src/types.js";
import { handleFeedbackGet, handleFeedbackPost, type TaggedFeedbackItem } from "./feedback.js";

const dirs: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "feedback-route-c4rz-"));
  dirs.push(d);
  return d;
}

afterEach(() => {
  while (dirs.length) {
    rmSync(dirs.pop()!, { recursive: true, force: true });
  }
});

describe("POST /api/feedback tag producer (bean c4rz)", () => {
  test("populatesTodoTags", async () => {
    const store = new FeedbackStore(tmp());
    const url = new URL("http://localhost/api/feedback");
    const req = new Request(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-User": "Ada Lovelace",
        "X-Forwarded-Email": "ada@example.org",
      },
      body: JSON.stringify({
        itemId: "paper-1",
        rootName: "thm-main",
        targetLabel: "thm:main",
        summary: "Clarify hypothesis",
        comment: "Specify that X is Hausdorff.",
        priority: "high",
        assignee: "editor-agent",
        author: "Ada Lovelace",
        authorEmail: "ada@example.org",
        actor: "admin",
        identities: ["github:adalovelace"],
        roles: ["reviewer"],
        processes: ["Process_CRDM"],
        tasks: [{ process: "Process_CRDM", task: "A_Summary" }],
      }),
    });

    const res = await handleFeedbackPost(url, req, store, {} as ContentAdapter);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);

    const payload = (await res!.json()) as { ok: boolean; todo: TaggedFeedbackItem };
    expect(payload.ok).toBe(true);
    expect(payload.todo.targetLabel).toBe("thm:main");
    expect(payload.todo.tags).toEqual({
      roles: ["reviewer"],
      processes: ["Process_CRDM"],
      tasks: [{ process: "Process_CRDM", task: "A_Summary" }],
      identities: [
        {
          provider: "github",
          id: "adalovelace",
          displayName: "Ada Lovelace",
          actor: "admin",
        },
      ],
      references: [{ kind: "block", id: "thm:main" }],
      artefacts: [],
    });

    const getRes = handleFeedbackGet(
      new URL("http://localhost/api/feedback?itemId=paper-1&rootName=thm-main"),
      store,
    );
    expect(getRes).not.toBeNull();
    const stored = (await getRes!.json()) as TaggedFeedbackItem[];
    expect(stored).toHaveLength(1);
    expect(stored[0]?.tags?.roles).toEqual(["reviewer"]);
    expect(stored[0]?.tags?.tasks).toEqual([{ process: "Process_CRDM", task: "A_Summary" }]);
  });
});
