/**
 * A todo's KG tags resolve, dangle, or are not checked — and the third is
 * never reported as either of the first two.
 *
 * The negative cases carry the weight. A resolver that returned "resolved" for
 * everything it could not check would pass a happy-path test and give a folio
 * a clean tag report over a graph it never read.
 *
 * @module schemas/todo.test
 */
import { describe, expect, test } from "bun:test";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";

import { TodoItemSchema } from "./constraints.ts";
import {
  TodoTagsSchema,
  TodoNodeSchema,
  TaskRefSchema,
  ExternalIdentitySchema,
  resolveTodoTags,
  danglingTags,
  TODO_SCHEMA_TAG,
  type KgIndex,
} from "./sdlc/todo.ts";
import { readTodoFiles, todoDefaultTheme } from "../scripts/todos.js";
import { buildKgIndex } from "../src/core/feedback.js";
import { readDeclaration } from "./kg/cat-harness.js";
import { resolveThemeBackdrop } from "./ui/theme.js";
import { themeById } from "./ui/themes.js";

const KG: KgIndex = {
  roles: new Set(["editor", "author"]),
  processes: new Set(["Process_CRDM"]),
  tasks: new Map([["Process_CRDM", new Set(["A_Implement", "A_Summary"])]]),
  actors: new Set(["admin"]),
};

const tags = (o: Partial<Record<string, unknown>> = {}) =>
  TodoTagsSchema.parse({ roles: [], processes: [], tasks: [], identities: [], references: [], ...o });

describe("tag shapes", () => {
  test("a task reference is a PAIR, never a bare id", () => {
    // A BPMN activity id is unique only within its process. Accepting a bare
    // string would make the tag un-addressable the moment two diagrams share
    // an activity name.
    expect(() => TaskRefSchema.parse({ task: "A_Implement" })).toThrow();
    expect(TaskRefSchema.parse({ process: "Process_CRDM", task: "A_Implement" })).toBeTruthy();
  });

  test("an identity is provider-qualified", () => {
    // `litlfred` is not an identity; `github:litlfred` is.
    expect(() => ExternalIdentitySchema.parse({ id: "litlfred" })).toThrow();
    expect(ExternalIdentitySchema.parse({ provider: "github", id: "litlfred" })).toBeTruthy();
  });

  test("the actor link is optional — an outside person is still a person", () => {
    const i = ExternalIdentitySchema.parse({ provider: "github", id: "drive-by" });
    expect(i.actor).toBeUndefined();
  });

  test("every tag axis defaults to an empty array", () => {
    // `artefacts` joined the shape when the tags were lifted into
    // `schemas/kg/carried-note.ts` and shared with agent memory: an issue, a PR
    // or a commit is neither a graph node nor a person, so neither existing
    // axis could hold one. Asserted as the whole object rather than per key —
    // a new axis SHOULD break this test, because a consumer reading the shape
    // needs to know it grew.
    const t = TodoTagsSchema.parse({});
    expect(t).toEqual({
      roles: [],
      processes: [],
      tasks: [],
      identities: [],
      references: [],
      artefacts: [],
    });
  });

  test("several people can be tagged on ONE todo", () => {
    // A question for two reviewers is one item. Splitting it would lose that
    // they are being asked the same thing.
    const t = TodoTagsSchema.parse({
      identities: [
        { provider: "github", id: "a" },
        { provider: "github", id: "b" },
      ],
    });
    expect(t.identities).toHaveLength(2);
  });

  test("references point at a declared node kind, and an undeclared one is refused", () => {
    // Closed since #1168 B9c (owner, 2026-09-30: "Enum anyway"): a typo in
    // `kind` used to parse and name nothing. The cost — a downstream kind must
    // be added to KG_NODE_KINDS first — is taken deliberately.
    const t = TodoTagsSchema.parse({
      references: [{ kind: "skill", id: "todo-review" }, { kind: "bean", id: "x", note: "why" }],
    });
    expect(t.references).toHaveLength(2);
    expect(t.references[1].note).toBe("why");
    expect(TodoTagsSchema.safeParse({ references: [{ kind: "some-future-kind", id: "x" }] }).success).toBe(false);
  });

  test("a todo file declares what it is", () => {
    // Same convention as the workflow instances: telling a directory's
    // contents apart by extension is a coincidence of the layout, not a
    // contract. A declaration inside the file is the contract.
    expect(() =>
      TodoNodeSchema.parse({
        id: "t1", summary: "s", status: "open", priority: "high",
        origin: "human", createdAt: "2026-09-18T00:00:00Z",
      }),
    ).toThrow();
    const ok = TodoNodeSchema.parse({
      $schema: TODO_SCHEMA_TAG,
      id: "t1", summary: "s", status: "open", priority: "high",
      origin: "human", createdAt: "2026-09-18T00:00:00Z",
    });
    expect(ok.tags.roles).toEqual([]);
  });
});

describe("resolution against the knowledge graph", () => {
  test("a known role, process and task all resolve", () => {
    const r = resolveTodoTags(
      tags({ roles: ["editor"], processes: ["Process_CRDM"], tasks: [{ process: "Process_CRDM", task: "A_Implement" }] }),
      KG,
    );
    expect(r.every((x) => x.state === "resolved")).toBe(true);
    expect(danglingTags(r)).toEqual([]);
  });

  test("an unknown role dangles", () => {
    const r = resolveTodoTags(tags({ roles: ["no-such-role"] }), KG);
    expect(r[0].state).toBe("dangling");
  });

  test("a task in a process the index does not know DANGLES, not not-checked", () => {
    // The index was read and does not contain that process — a real finding.
    const r = resolveTodoTags(tags({ tasks: [{ process: "Process_Ghost", task: "A_X" }] }), KG);
    expect(r[0].state).toBe("dangling");
  });

  test("a task that is not an activity of its named process dangles", () => {
    const r = resolveTodoTags(tags({ tasks: [{ process: "Process_CRDM", task: "A_Nope" }] }), KG);
    expect(r[0].state).toBe("dangling");
  });

  test("the task ref names its process, so the finding is actionable", () => {
    const r = resolveTodoTags(tags({ tasks: [{ process: "Process_CRDM", task: "A_Nope" }] }), KG);
    expect(r[0].ref).toContain("Process_CRDM");
    expect(r[0].ref).toContain("A_Nope");
  });
});

describe("not-checked is a third state and never collapses", () => {
  test("an unreadable role index reports not-checked, NOT dangling", () => {
    // A shallow checkout with no `skills/` must not produce a wall of false
    // dangling findings — that is how a check gets switched off.
    const r = resolveTodoTags(tags({ roles: ["editor", "ghost"] }), {});
    expect(r.map((x) => x.state)).toEqual(["not-checked", "not-checked"]);
    expect(danglingTags(r)).toEqual([]);
  });

  test("an unreadable task index reports not-checked", () => {
    const r = resolveTodoTags(tags({ tasks: [{ process: "P", task: "T" }] }), { roles: new Set() });
    expect(r[0].state).toBe("not-checked");
  });

  test("an EMPTY index is a determined empty, so its tags dangle", () => {
    // `new Set()` means "read it, nothing there". `undefined` means "could not
    // read". Conflating them loses the only distinction that matters.
    const r = resolveTodoTags(tags({ roles: ["editor"] }), { roles: new Set() });
    expect(r[0].state).toBe("dangling");
  });

  test("an UNLINKED identity is not checked and not dangling", () => {
    // Somebody outside the actor registry is a real person, not a broken
    // reference. Only a linked identity is checkable at all.
    const r = resolveTodoTags(
      tags({ identities: [{ provider: "github", id: "drive-by" }] }),
      KG,
    );
    expect(r).toEqual([]);
  });

  test("a LINKED identity naming an unknown actor dangles", () => {
    const r = resolveTodoTags(
      tags({ identities: [{ provider: "github", id: "x", actor: "no-such-actor" }] }),
      KG,
    );
    expect(r[0]).toEqual({ axis: "actor", ref: "no-such-actor", state: "dangling" });
  });

  test("buildKgIndex reads the live harness roles, processes, tasks and actors, and returns undefined for absent directories (bean c4rz)", () => {
    const live = buildKgIndex(HARNESS_ROOT);
    expect(live.roles).toBeDefined();
    expect((live.roles?.size ?? 0) > 0).toBe(true);
    expect(live.processes).toBeDefined();
    expect((live.processes?.size ?? 0) > 0).toBe(true);
    expect(live.tasks).toBeDefined();
    expect((live.tasks?.size ?? 0) > 0).toBe(true);
    expect(live.actors).toBeDefined();
    expect((live.actors?.size ?? 0) > 0).toBe(true);

    const missing = buildKgIndex("/nonexistent-c4rz-checkout-dir");
    expect(missing.roles).toBeUndefined();
    expect(missing.processes).toBeUndefined();
    expect(missing.tasks).toBeUndefined();
    expect(missing.actors).toBeUndefined();
    const unchecked = resolveTodoTags(
      tags({ roles: ["editor"], processes: ["Process_CRDM"], tasks: [{ process: "Process_CRDM", task: "A_Implement" }] }),
      missing,
    );
    expect(unchecked.every((x) => x.state === "not-checked")).toBe(true);
  });
});

describe("a todo's theme — declared, defaulted, and never guessed", () => {
  /**
   * Bean `5y4b`, the owner: *"todos need grump cat themeing based on content
   * too. used jugement"*.
   *
   * The judgement is the work, and three things follow from it being a
   * judgement rather than a rule:
   *
   * 1. It is **declared data**, not a keyword match on the summary at render
   *    time — a rule nobody can see, review or override, which changes
   *    silently when somebody rewords a todo.
   * 2. The **default makes no claim**. A wrong theme is worse than no theme: a
   *    plain card says nothing, while a card themed `operations` says *"this
   *    is operations work"* about a todo that may be nothing of the sort. The
   *    layer's own theme says only "this belongs to this folio".
   * 3. A theme id that resolves to nothing is a **finding**, not a flat card.
   *    The author asked for something and got nothing, and on the page that
   *    failure is invisible.
   */
  const todos = readTodoFiles();

  test("the store declares a default, and it is a real theme", () => {
    const id = todoDefaultTheme();
    expect(id).toBeDefined();
    expect(themeById(id!)?.id).toBe(id!);
  });

  test("every theme a todo names exists", () => {
    // The guard that matters, run over the real corpus rather than a fixture.
    const bad = todos
      .map(({ todo }) => todo.theme)
      .filter((t): t is string => t !== undefined)
      .filter((t) => themeById(t) === undefined);
    expect(bad).toEqual([]);
  });

  test("every theme a todo names can actually BACK a sticky", () => {
    // A theme with no card crop cannot carry a backdrop, so assigning one is
    // a choice that renders as nothing. `resolveThemeBackdrop` refuses a
    // partial set wholesale, so this is complete-or-none rather than a count.
    const decl = readDeclaration(HARNESS_ROOT);
    for (const { todo } of todos) {
      if (todo.theme === undefined) continue;
      const art = resolveThemeBackdrop(themeById(todo.theme)!, decl?.images);
      expect({ id: todo.id, theme: todo.theme, missing: art.missing }).toEqual({
        id: todo.id,
        theme: todo.theme,
        missing: [],
      });
    }
  });

  test("a todo's OWN theme is kept unresolved — the default is applied later", () => {
    // "The author chose grumpy-cat" and "nobody chose" must stay
    // distinguishable to a reviewer reading the file, so the parser does not
    // fold the default in. Every todo in this store has been assigned one by
    // judgement, so the property is asserted on a parsed fixture instead.
    const parsed = TodoNodeSchema.safeParse({
      id: "x",
      summary: "s",
      comment: "",
      createdAt: "2026-09-20",
      status: "open",
      priority: "medium",
      origin: "agent",
      tags: { roles: [], processes: [], tasks: [], identities: [], references: [], artefacts: [] },
      $schema: "todo/1.0.0",
    });
    expect(parsed.success && parsed.data.theme).toBeUndefined();
  });

  test("a theme id that is not kebab-case is refused", () => {
    const bad = TodoNodeSchema.safeParse({
      id: "x",
      summary: "s",
      comment: "",
      createdAt: "2026-09-20",
      status: "open",
      priority: "medium",
      origin: "agent",
      theme: "Grumpy Cat",
      tags: { roles: [], processes: [], tasks: [], identities: [], references: [], artefacts: [] },
      $schema: "todo/1.0.0",
    });
    expect(bad.success).toBe(false);
  });
});

describe("a todo declares its theme rather than having one inferred (bean `5y4b`)", () => {
  const base = {
    id: "t1",
    summary: "s",
    comment: "",
    status: "open" as const,
    priority: "medium" as const,
    origin: "agent" as const,
    createdAt: "2026-09-20T00:00:00Z",
  };

  test("the field is OPTIONAL — absent means the instance's own theme", () => {
    // The default is inherited, not guessed. A wrong theme is worse than no
    // theme: a plain card says nothing, while a card themed `operations`
    // asserts the todo is operations work.
    const r = TodoItemSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.theme).toBeUndefined();
  });

  test("a declared theme survives the parse", () => {
    const r = TodoItemSchema.safeParse({ ...base, theme: "library" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.theme).toBe("library");
  });

  test("an unknown theme PARSES — it is a rendering finding, not a parse error", () => {
    // Deliberately an open string, like `GraphNodeDirectorySchema.graphTypologies`.
    // Closing the enum would mean building it at module load and importing the
    // theme table into the CONTENT model, giving every consumer of a todo a
    // dependency on the palette.
    expect(TodoItemSchema.safeParse({ ...base, theme: "no-such-theme" }).success).toBe(true);
  });

  test("an empty theme is refused — absent and blank are different claims", () => {
    // Absent means "inherit"; empty string would mean "a theme was chosen and
    // it is nothing", which no renderer can act on.
    expect(TodoItemSchema.safeParse({ ...base, theme: "" }).success).toBe(false);
  });
});
