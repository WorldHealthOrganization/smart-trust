/**
 * Feedback store migration into the declared `todos/` graph, tag producer, and
 * `KgIndex` builder (bean `folio-assistant-c4rz`).
 *
 * Verifies the four deliverables of `folio-assistant-c4rz`:
 * 1. A folio's feedback store resolves to the declared `todo-feedback` node of
 *    its `todos/` graph, while keeping the legacy `.folio-feedback` directory
 *    readable through the transition.
 * 2. Feedback producers (`createFeedbackItem`, `FeedbackStore.create`,
 *    `buildFeedbackTags`) write real `TodoTags` (`roles`, `processes`, `tasks`,
 *    `identities`, `references`, `artefacts`).
 * 3. `readFolioContentConfig` and `initFolio` scaffold/resolve the declared
 *    `todos/feedback` layout.
 * 4. `buildKgIndex` reads declared `roles`, `processes`, `tasks` and `actors`
 *    while preserving the `undefined` ≠ empty contract (`not-checked` vs
 *    `dangling`).
 */

import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DEFAULT_TODO_GRAPH, TODO_GRAPH_FILE } from "../../../schemas/sdlc/todo-graph.js";
import { danglingTags, resolveTodoTags } from "../../../schemas/sdlc/todo.js";
import { readFolioContentConfig } from "../../content-adapter.js";
import {
  FeedbackStore,
  LEGACY_FEEDBACK_DIRNAME,
  buildFeedbackTags,
  buildKgIndex,
  createFeedbackItem,
  resolveDeclaredFeedbackDir,
} from "../feedback.js";

const dirs: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "feedback-c4rz-"));
  dirs.push(d);
  return d;
}

afterEach(() => {
  while (dirs.length) {
    rmSync(dirs.pop()!, { recursive: true, force: true });
  }
});

function writeTodosGraph(repoRoot: string): void {
  const todosDir = join(repoRoot, "todos");
  mkdirSync(join(todosDir, "feedback"), { recursive: true });
  writeFileSync(
    join(todosDir, TODO_GRAPH_FILE),
    JSON.stringify({ ...DEFAULT_TODO_GRAPH, name: "test-folio" }, null, 2),
    "utf-8",
  );
}

describe("FeedbackStore declared `todos/` node + `.folio-feedback` transition", () => {
  test("resolves the declared `todo-feedback` directory from `todos/todos.json`", () => {
    const repo = tmp();
    expect(resolveDeclaredFeedbackDir(repo)).toBeUndefined();
    writeTodosGraph(repo);
    expect(resolveDeclaredFeedbackDir(repo)).toBe(join(repo, "todos", "feedback"));
    expect(resolveDeclaredFeedbackDir(join(repo, "todos"))).toBe(join(repo, "todos", "feedback"));
  });

  test("writes to `todos/feedback` while still reading legacy `.folio-feedback` items", () => {
    const repo = tmp();
    writeTodosGraph(repo);

    // Seed legacy feedback in `.folio-feedback/paper-a/def-1.json` and `def-2.json`.
    const legacyBlockDir = join(repo, LEGACY_FEEDBACK_DIRNAME, "paper-a");
    mkdirSync(legacyBlockDir, { recursive: true });
    writeFileSync(
      join(legacyBlockDir, "def-1.json"),
      JSON.stringify([
        {
          id: "todo-legacy-1",
          summary: "Legacy note on def-1",
          comment: "From .folio-feedback",
          status: "open",
          priority: "medium",
          origin: "human",
          createdAt: "2026-09-01T00:00:00Z",
        },
      ]),
      "utf-8",
    );
    writeFileSync(
      join(legacyBlockDir, "def-2.json"),
      JSON.stringify([
        {
          id: "todo-legacy-2",
          summary: "Legacy note on def-2",
          comment: "Stays in .folio-feedback",
          status: "open",
          priority: "low",
          origin: "human",
          createdAt: "2026-09-01T00:00:00Z",
        },
      ]),
      "utf-8",
    );

    // Passing `.folio-feedback` on a folio with `todos/todos.json` promotes `todos/feedback`
    // to primary while keeping `.folio-feedback` as fallback.
    const store = new FeedbackStore(join(repo, LEGACY_FEEDBACK_DIRNAME));
    expect(store.dir).toBe(join(repo, "todos", "feedback"));
    expect(store.fallbackDirs).toContain(join(repo, LEGACY_FEEDBACK_DIRNAME));

    // Legacy items are readable before any migration write.
    expect(store.read("paper-a", "def-1").map((t) => t.id)).toEqual(["todo-legacy-1"]);
    expect(store.listAll().map((e) => e.todo.id)).toEqual(["todo-legacy-1", "todo-legacy-2"]);

    // Creating a new item on `def-1` writes to `todos/feedback/paper-a/def-1.json`,
    // carrying over the existing `def-1` item into the declared store.
    const created = store.create("paper-a", "def-1", {
      id: "todo-new-1",
      summary: "New tagged note",
      author: "alice",
      roles: ["reviewer"],
    });
    expect(created.tags?.roles).toEqual(["reviewer"]);
    expect(existsSync(join(repo, "todos", "feedback", "paper-a", "def-1.json"))).toBe(true);

    // `read` and `listAll` now read `def-1` from `todos/feedback` (without duplicating
    // the legacy copy) and still read `def-2` from `.folio-feedback`.
    expect(store.read("paper-a", "def-1").map((t) => t.id)).toEqual(["todo-legacy-1", "todo-new-1"]);
    expect(store.listAll().map((e) => e.todo.id)).toEqual(["todo-legacy-1", "todo-new-1", "todo-legacy-2"]);
  });

  test("readFolioContentConfig defaults feedbackDir to the declared `todo-feedback` node", () => {
    const repo = tmp();
    expect(readFolioContentConfig(repo).feedbackDir).toBe(join(repo, LEGACY_FEEDBACK_DIRNAME));
    writeTodosGraph(repo);
    expect(readFolioContentConfig(repo).feedbackDir).toBe(join(repo, "todos", "feedback"));
  });
});

describe("Feedback producer writes real `TodoTags`", () => {
  test("createFeedbackItem and buildFeedbackTags populate roles, processes, tasks, identities and references", () => {
    const item = createFeedbackItem({
      id: "todo-tagged-1",
      summary: "Check proof of Lemma 2",
      comment: "Step 3 assumes compactness.",
      author: "Ada Lovelace",
      authorEmail: "ada@example.org",
      identityProvider: "github",
      identities: ["github:adalovelace"],
      actor: "admin",
      roles: ["reviewer", "editor"],
      processes: ["Process_CRDM"],
      tasks: [{ process: "Process_CRDM", task: "A_Summary" }],
      targetLabel: "lem:compactness",
      artefacts: [{ kind: "pull-request", id: "42", provider: "github" }],
    });

    expect(item.tags).toEqual({
      roles: ["reviewer", "editor"],
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
      references: [{ kind: "block", id: "lem:compactness" }],
      artefacts: [{ kind: "pull-request", id: "42", provider: "github" }],
    });

    // Also qualifies email or handle when explicit `identities` is omitted.
    const fromEmail = buildFeedbackTags({
      author: "Grace Hopper",
      authorEmail: "grace@navy.mil",
      roles: ["author"],
    });
    expect(fromEmail.identities).toEqual([
      { provider: "email", id: "grace@navy.mil", displayName: "Grace Hopper" },
    ]);
    expect(fromEmail.roles).toEqual(["author"]);
  });
});

describe("buildKgIndex preserves `undefined` ≠ empty contract", () => {
  test("absent directories yield `undefined` axes so `resolveTodoTags` reports `not-checked`", () => {
    const emptyCheckout = tmp();
    const kg = buildKgIndex(emptyCheckout);

    expect(kg.roles).toBeUndefined();
    expect(kg.processes).toBeUndefined();
    expect(kg.tasks).toBeUndefined();
    expect(kg.actors).toBeUndefined();

    const tags = buildFeedbackTags({
      identities: ["github:octocat"],
      actor: "admin",
      roles: ["editor"],
      processes: ["Process_CRDM"],
      tasks: [{ process: "Process_CRDM", task: "A_Implement" }],
    });
    const resolved = resolveTodoTags(tags, kg);
    expect(resolved.map((r) => r.state)).toEqual([
      "not-checked",
      "not-checked",
      "not-checked",
      "not-checked",
    ]);
    expect(danglingTags(resolved)).toEqual([]);
  });

  test("present-but-empty directories yield empty Sets/Maps so `resolveTodoTags` reports `dangling`", () => {
    const repo = tmp();
    mkdirSync(join(repo, "scenarios", "actors"), { recursive: true });
    mkdirSync(join(repo, "processes"), { recursive: true });
    writeFileSync(
      join(repo, "scenarios", "roles.json"),
      JSON.stringify({ name: "empty-folio", roles: [] }),
      "utf-8",
    );

    const kg = buildKgIndex(repo);
    expect(kg.roles).toBeDefined();
    expect(kg.roles?.size).toBe(0);
    expect(kg.processes).toBeDefined();
    expect(kg.processes?.size).toBe(0);
    expect(kg.tasks).toBeDefined();
    expect(kg.tasks?.size).toBe(0);
    expect(kg.actors).toBeDefined();
    expect(kg.actors?.size).toBe(0);

    const tags = buildFeedbackTags({
      identities: ["github:octocat"],
      actor: "admin",
      roles: ["editor"],
      processes: ["Process_CRDM"],
      tasks: [{ process: "Process_CRDM", task: "A_Implement" }],
    });
    const resolved = resolveTodoTags(tags, kg);
    expect(resolved.map((r) => r.state)).toEqual([
      "dangling",
      "dangling",
      "dangling",
      "dangling",
    ]);
    expect(danglingTags(resolved)).toHaveLength(4);
  });

  test("populated roles, actors and BPMN processes/tasks resolve known tags and flag unknown ones", () => {
    const repo = tmp();
    mkdirSync(join(repo, "scenarios", "actors"), { recursive: true });
    mkdirSync(join(repo, "processes"), { recursive: true });

    writeFileSync(
      join(repo, "scenarios", "roles.json"),
      JSON.stringify({
        name: "test-folio",
        roles: [
          {
            id: "reviewer",
            title: "Reviewer",
            description: "Reviews content blocks.",
            actorKinds: ["person"],
            skills: [],
          },
        ],
      }),
      "utf-8",
    );

    writeFileSync(
      join(repo, "scenarios", "actors", "alice.json"),
      JSON.stringify({
        id: "alice",
        title: "Alice",
        kind: "person",
        roles: ["reviewer"],
      }),
      "utf-8",
    );

    writeFileSync(
      join(repo, "processes", "review.bpmn"),
      `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Defs_Review">
  <bpmn:process id="Process_Review" isExecutable="true">
    <bpmn:userTask id="A_Triage" name="Triage feedback" />
    <bpmn:serviceTask id="A_Verify" name="Verify block" />
  </bpmn:process>
</bpmn:definitions>`,
      "utf-8",
    );

    const kg = buildKgIndex(repo);
    expect([...(kg.roles ?? [])]).toEqual(["reviewer"]);
    expect([...(kg.actors ?? [])]).toEqual(["alice"]);
    expect([...(kg.processes ?? [])]).toEqual(["Process_Review"]);
    expect([...(kg.tasks?.get("Process_Review") ?? [])]).toEqual(["A_Triage", "A_Verify"]);

    const okTags = buildFeedbackTags({
      identities: ["github:alice"],
      actor: "alice",
      roles: ["reviewer"],
      processes: ["Process_Review"],
      tasks: [{ process: "Process_Review", task: "A_Triage" }],
    });
    const okResolved = resolveTodoTags(okTags, kg);
    expect(okResolved.every((r) => r.state === "resolved")).toBe(true);
    expect(danglingTags(okResolved)).toEqual([]);

    const badTags = buildFeedbackTags({
      identities: ["github:alice"],
      actor: "bob",
      roles: ["unknown-role"],
      processes: ["Process_Review"],
      tasks: [{ process: "Process_Review", task: "A_Missing" }],
    });
    const badResolved = resolveTodoTags(badTags, kg);
    expect(danglingTags(badResolved).map((d) => `${d.axis}:${d.ref}`)).toEqual([
      "role:unknown-role",
      "task:Process_Review▸A_Missing",
      "actor:bob",
    ]);
  });
});
