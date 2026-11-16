/**
 * The work-plan store's conformance suite: the contract's operations, held to
 * its responsibilities, against any Tool.
 *
 * The contract is `work-plan-store` in cat-harness
 * (`work-plan/skills/work-plan/work-plan-store.md`): operations every Tool must
 * provide, and seven responsibilities "each something a test can check
 * against any Tool". This file is those checks, written against
 * {@link StoreUnderTest} and nothing else, so a second Tool (a beans server,
 * an MCP service, a run-scoped store) passes or fails the same tests the git
 * branch does (cat-harness#991, step 2).
 *
 * The operations are `WorkPlanStore` (`src/workflow/work-plan-store.ts`,
 * step 3); {@link StoreUnderTest} is its name here.
 *
 * `history`, `positions` and `beansAt` are optional on the type. A Tool that
 * does not yet provide one gets a `todo` naming the step that adds it, never a
 * pass: an operation nobody implemented has not met its guarantee.
 *
 * @module scripts/tests/sdlc/work-plan-store-conformance
 */
import { describe, expect, test } from "bun:test";

import { BeanStatusSchema } from "../../../schemas/tools/tool-types.ts";

import type { MemoryEntry } from "../../../schemas/kg/memory-record.ts";
import type { BeanFields, BeanFilter, Got, InstanceLike, WorkPlanStore } from "../../../src/workflow/work-plan-store.ts";

export type { BeanChange, BeanFields, BeanFilter, Got, Refusal } from "../../../src/workflow/work-plan-store.ts";

/** The contract's operations, as this suite calls them. */
export type StoreUnderTest = WorkPlanStore;

/**
 * A Tool under test. `fresh` returns two writers on ONE new, empty store, so
 * the race responsibility is two real writers and not one writer twice.
 */
export interface ToolUnderTest {
  name: string;
  fresh(): {
    a: StoreUnderTest;
    b: StoreUnderTest;
    /** Write a workflow instance into the store, as the engine does when a process starts or moves. */
    seedInstance(s: InstanceLike & { source: string; subject: string; startedAt: string; arrivals: Record<string, string[]>; history: Array<{ at: string; node?: string; actor?: string }> }): void;
    /**
     * Make the writes so far part of the store's history, where the Tool
     * records history only on a later step (the mount: a push). Absent when
     * every write is already history.
     */
    settle?(): void;
  };
  /** Per-test budget, for Tools whose operations are real I/O. */
  timeoutMs?: number;
}

const bean = (id: string, extra: Partial<BeanFields> = {}): BeanFields => ({
  id,
  title: `bean ${id}`,
  status: "todo",
  type: "task",
  body: "The first paragraph.\n",
  ...extra,
});

function hit(g: Got): { bean: BeanFields; version: string } {
  if (g.state !== "hit") throw new Error("expected a bean, got none");
  return g;
}

function created(r: ReturnType<StoreUnderTest["create"]>): string {
  if (r.state !== "created") throw new Error(`create refused: ${r.why} — ${r.detail}`);
  return r.version;
}

/** The fields a reader compares: what was written, minus the Tool's own bookkeeping. */
const fields = (b: BeanFields): BeanFields => ({
  id: b.id,
  title: b.title,
  status: b.status,
  type: b.type,
  ...(b.parent ? { parent: b.parent } : {}),
  ...(b.blockedBy?.length ? { blockedBy: [...b.blockedBy] } : {}),
  ...(b.tags?.length ? { tags: [...b.tags] } : {}),
  body: b.body,
});

export function workPlanStoreConformance(tool: ToolUnderTest): void {
  const t = tool.timeoutMs;

  describe(`work-plan store conformance — ${tool.name}`, () => {
    describe("1. give back what was written", () => {
      test("get after create returns the bean written", () => {
        const { a } = tool.fresh();
        const b = bean("fx-aaaa", { parent: undefined, tags: ["area:store"] });
        created(a.create(b));
        expect(fields(hit(a.get("fx-aaaa")).bean)).toEqual(fields(b));
      }, t);

      test("get after update returns the change, and the rest unchanged", () => {
        const { a } = tool.fresh();
        const v = created(a.create(bean("fx-aaaa")));
        const r = a.update("fx-aaaa", { status: "in-progress", title: "renamed" }, v);
        expect(r.state).toBe("updated");
        expect(fields(hit(a.get("fx-aaaa")).bean)).toEqual(fields(bean("fx-aaaa", { status: "in-progress", title: "renamed" })));
      }, t);

      test("an unknown id is none, not an error and not another bean", () => {
        const { a } = tool.fresh();
        created(a.create(bean("fx-aaaa")));
        expect(a.get("fx-zzzz").state).toBe("none");
      }, t);

      test("a short id resolves to exactly one bean, or to none when it is ambiguous", () => {
        const { a } = tool.fresh();
        created(a.create(bean("fx-aaaa")));
        expect(hit(a.get("aaaa")).bean.id).toBe("fx-aaaa");
        created(a.create(bean("fy-aaaa")));
        expect(a.get("aaaa").state).toBe("none");
      }, t);

      test("list filters by status, type, tag and parent", () => {
        const { a } = tool.fresh();
        created(a.create(bean("fx-aaaa", { type: "epic" })));
        created(a.create(bean("fx-bbbb", { parent: "fx-aaaa", tags: ["area:store"] })));
        created(a.create(bean("fx-cccc", { parent: "fx-aaaa", status: "completed" })));
        const ids = (f: BeanFilter): string[] => a.list(f).map((b) => b.id).sort();
        expect(ids({})).toEqual(["fx-aaaa", "fx-bbbb", "fx-cccc"]);
        expect(ids({ status: "completed" })).toEqual(["fx-cccc"]);
        expect(ids({ type: "epic" })).toEqual(["fx-aaaa"]);
        expect(ids({ tag: "area:store" })).toEqual(["fx-bbbb"]);
        expect(ids({ parent: "fx-aaaa" })).toEqual(["fx-bbbb", "fx-cccc"]);
      }, t);
    });

    describe("2. keep ids unique", () => {
      test("create with a taken id is refused, and the first bean stands", () => {
        const { a } = tool.fresh();
        created(a.create(bean("fx-aaaa")));
        const r = a.create(bean("fx-aaaa", { title: "an impostor" }));
        expect(r).toMatchObject({ state: "refused", why: "exists" });
        expect(hit(a.get("fx-aaaa")).bean.title).toBe("bean fx-aaaa");
      }, t);

      test("two writers creating one id at once: one lands, the other is refused", () => {
        const { a, b } = tool.fresh();
        const ra = a.create(bean("fx-aaaa", { title: "from a" }));
        const rb = b.create(bean("fx-aaaa", { title: "from b" }));
        expect([ra.state, rb.state]).toEqual(["created", "refused"]);
        expect(hit(b.get("fx-aaaa")).bean.title).toBe("from a");
      }, t);
    });

    describe("3. keep links whole", () => {
      test("create naming a parent that does not exist is refused", () => {
        const { a } = tool.fresh();
        expect(a.create(bean("fx-aaaa", { parent: "fx-gone" }))).toMatchObject({ state: "refused", why: "dangling-link" });
        expect(a.get("fx-aaaa").state).toBe("none");
      }, t);

      test("update to a blocked_by that does not exist is refused", () => {
        const { a } = tool.fresh();
        const v = created(a.create(bean("fx-aaaa")));
        expect(a.update("fx-aaaa", { blockedBy: ["fx-gone"] }, v)).toMatchObject({ state: "refused", why: "dangling-link" });
      }, t);

      test("links to beans that exist land", () => {
        const { a } = tool.fresh();
        created(a.create(bean("fx-aaaa")));
        const v = created(a.create(bean("fx-bbbb", { parent: "fx-aaaa" })));
        expect(a.update("fx-bbbb", { blockedBy: ["fx-aaaa"] }, v).state).toBe("updated");
        expect(hit(a.get("fx-bbbb")).bean.blockedBy).toEqual(["fx-aaaa"]);
      }, t);
    });

    describe("4. keep the lists closed", () => {
      test("a status outside the schema's list is refused, on create and on update", () => {
        const { a } = tool.fresh();
        expect(a.create(bean("fx-aaaa", { status: "almost-done" }))).toMatchObject({ state: "refused", why: "closed-list" });
        const v = created(a.create(bean("fx-bbbb")));
        expect(a.update("fx-bbbb", { status: "almost-done" }, v)).toMatchObject({ state: "refused", why: "closed-list" });
        expect(hit(a.get("fx-bbbb")).bean.status).toBe("todo");
      }, t);

      test("every status the schema declares is accepted", () => {
        const { a } = tool.fresh();
        let v = created(a.create(bean("fx-aaaa")));
        for (const s of BeanStatusSchema.options) {
          const r = a.update("fx-aaaa", { status: s }, v);
          if (r.state !== "updated") throw new Error(`status ${s} refused: ${JSON.stringify(r)}`);
          v = r.version;
        }
      }, t);

      // The contract says type is a closed list too, but the bean schema
      // declares `type` as a bare string and no closed list of types exists
      // anywhere to test against. Reported on cat-harness#991 rather than
      // invented here.
      test.todo("a type outside the schema's list is refused — the schema declares no list of types yet", () => {});
    });

    describe("5. lose nothing to a race", () => {
      test("an update with a stale ifMatch is refused; a retry on the current version lands; both changes stand", () => {
        const { a, b } = tool.fresh();
        const v0 = created(a.create(bean("fx-aaaa")));

        // Both read the same version.
        expect(hit(b.get("fx-aaaa")).version).toBe(v0);

        expect(a.update("fx-aaaa", { status: "in-progress" }, v0).state).toBe("updated");
        expect(b.update("fx-aaaa", { title: "b's title" }, v0)).toMatchObject({ state: "refused", why: "stale" });

        const fresh = hit(b.get("fx-aaaa"));
        expect(fresh.bean.status).toBe("in-progress");
        expect(b.update("fx-aaaa", { title: "b's title" }, fresh.version).state).toBe("updated");

        const end = hit(a.get("fx-aaaa")).bean;
        expect(end.status).toBe("in-progress");
        expect(end.title).toBe("b's title");
      }, t);

      test("two writers' notes both land, in the order they were written", () => {
        const { a, b } = tool.fresh();
        created(a.create(bean("fx-aaaa")));
        expect(a.note("fx-aaaa", "first, from a", "writer-a").state).toBe("noted");
        expect(b.note("fx-aaaa", "second, from b", "writer-b").state).toBe("noted");
        const body = hit(a.get("fx-aaaa")).bean.body;
        expect(body.indexOf("first, from a")).toBeGreaterThan(-1);
        expect(body.indexOf("second, from b")).toBeGreaterThan(body.indexOf("first, from a"));
      }, t);

      test("a note never rewrites what was there before it", () => {
        const { a } = tool.fresh();
        created(a.create(bean("fx-aaaa")));
        a.note("fx-aaaa", "one", "w");
        const before = hit(a.get("fx-aaaa")).bean.body.trimEnd();
        a.note("fx-aaaa", "two", "w");
        expect(hit(a.get("fx-aaaa")).bean.body.startsWith(before)).toBe(true);
      }, t);

      test("a note on an unknown id is none, and creates nothing", () => {
        const { a } = tool.fresh();
        expect(a.note("fx-zzzz", "x", "w").state).toBe("none");
        expect(a.list()).toEqual([]);
      }, t);
    });

    describe("archiving is a field set by update (Q-BSD-7 B)", () => {
      test("an archived bean is still found by get, and left out of list unless asked for", () => {
        const { a } = tool.fresh();
        const v = created(a.create(bean("fx-aaaa", { status: "completed" })));
        created(a.create(bean("fx-bbbb")));
        expect(a.update("fx-aaaa", { archived: true }, v).state).toBe("updated");
        const got = hit(a.get("fx-aaaa"));
        expect(got.bean.archived).toBe(true);
        expect(got.bean.status).toBe("completed");
        expect(a.list().map((b) => b.id)).toEqual(["fx-bbbb"]);
        expect(a.list({ archived: true }).map((b) => b.id)).toEqual(["fx-aaaa"]);
      }, t);

      test("archiving a bean that is not completed or scrapped is refused, and it stays where it was", () => {
        const { a } = tool.fresh();
        const v = created(a.create(bean("fx-aaaa", { status: "in-progress" })));
        expect(a.update("fx-aaaa", { archived: true }, v)).toMatchObject({ state: "refused", why: "not-terminal" });
        expect(hit(a.get("fx-aaaa")).bean.archived).toBeUndefined();
        expect(a.list().map((b) => b.id)).toEqual(["fx-aaaa"]);
      }, t);

      test("an archived bean can be brought back", () => {
        const { a } = tool.fresh();
        const v = created(a.create(bean("fx-aaaa", { status: "scrapped" })));
        const r = a.update("fx-aaaa", { archived: true }, v);
        if (r.state !== "updated") throw new Error(JSON.stringify(r));
        expect(a.update("fx-aaaa", { archived: false }, r.version).state).toBe("updated");
        expect(a.list().map((b) => b.id)).toEqual(["fx-aaaa"]);
      }, t);
    });

    describe("6. keep the history (Q-BSD-4 A: the bean's versions, merged with the instances' steps)", () => {
      test("every change, oldest first, each with who made it and what kind it was", () => {
        const { a, settle } = tool.fresh();
        const v = created(a.create(bean("fx-aaaa")));
        settle?.();
        const r = a.update("fx-aaaa", { status: "in-progress" }, v);
        settle?.();
        if (r.state !== "updated") throw new Error(JSON.stringify(r));
        a.note("fx-aaaa", "first finding", "writer-a");
        settle?.();
        const h = a.history("fx-aaaa");
        expect(h.map((e) => e.kind)).toEqual(["created", "claimed", "noted"]);
        expect(h[1]!.what).toBe("todo → in-progress");
        expect(h[2]!.what).toContain("first finding");
        const ats = h.map((e) => Date.parse(e.at));
        expect([...ats].sort((x, y) => x - y)).toEqual(ats);
        for (const e of h) expect(e.by.length).toBeGreaterThan(0);
      }, t);

      test("archiving is in the history, and the bean's history survives the move", () => {
        const { a, settle } = tool.fresh();
        const v = created(a.create(bean("fx-aaaa", { status: "completed" })));
        settle?.();
        expect(a.update("fx-aaaa", { archived: true }, v).state).toBe("updated");
        settle?.();
        expect(a.history("fx-aaaa").map((e) => e.kind)).toEqual(["created", "archived"]);
      }, t);

      test("the steps of an instance naming the bean are in it, with the instance, the step and who took it", () => {
        const { a, seedInstance, settle } = tool.fresh();
        created(a.create(bean("fx-aaaa")));
        seedInstance({
          id: "ccr--a",
          processId: "code-change-review",
          // declared-path-literal: a fixture instance's `source`, written into a temporary store and never read as a file
          source: "processes/code-change-review.bpmn",
          subject: "a",
          bean: "fx-aaaa",
          tokens: ["Task_Merge"],
          arrivals: {},
          history: [
            { at: "2026-11-02T10:00:00Z", node: "Start" },
            { at: "2026-11-02T10:05:00Z", node: "Task_Review", actor: "reviewer-agent" },
          ],
          status: "running",
          startedAt: "2026-11-02T10:00:00Z",
          updatedAt: "2026-11-02T10:05:00Z",
        });
        settle?.();
        const steps = a.history("fx-aaaa").filter((e) => e.kind === "step-reached");
        expect(steps.map((e) => [e.instance, e.node, e.by])).toEqual([
          ["ccr--a", "Start", "workflow"],
          ["ccr--a", "Task_Review", "reviewer-agent"],
        ]);
      }, t);

      test("an id the store does not hold has no history", () => {
        const { a } = tool.fresh();
        expect(a.history("fx-zzzz")).toEqual([]);
      }, t);
    });

    describe("7. know where a bean is (Q-BSD-1 B: read from the instances)", () => {
      const at = "2026-11-02T10:00:00Z";
      const inst = (id: string, extra: Partial<Pick<InstanceLike, "bean" | "carriedBeans" | "tokens" | "status" | "children">> = {}) => ({
        id,
        processId: "code-change-review",
        // declared-path-literal: a fixture instance's `source`, written into a temporary store and never read as a file
        source: "processes/code-change-review.bpmn",
        subject: id,
        tokens: ["Task_Review"],
        arrivals: {},
        history: [{ at, node: "Start" }],
        status: "running",
        startedAt: at,
        updatedAt: at,
        ...extra,
      });

      test("a bean no instance names has no position, and is at no step", () => {
        const { a } = tool.fresh();
        created(a.create(bean("fx-aaaa")));
        expect(a.positions("fx-aaaa")).toEqual([]);
        expect(a.beansAt("code-change-review")).toEqual([]);
      }, t);

      test("a bean an instance names is at that instance's tokens, and nowhere else", () => {
        const { a, seedInstance } = tool.fresh();
        created(a.create(bean("fx-aaaa")));
        created(a.create(bean("fx-bbbb")));
        seedInstance(inst("ccr--a", { bean: "fx-aaaa", carriedBeans: ["fx-bbbb"] }));
        expect(a.positions("fx-aaaa")).toEqual([
          { process: "code-change-review", instance: "ccr--a", nodes: ["Task_Review"], status: "running", lastMoved: at },
        ]);
        expect(a.positions("fx-bbbb").map((p) => p.instance)).toEqual(["ccr--a"]);
        expect(a.beansAt("code-change-review", "Task_Review")).toEqual(["fx-aaaa", "fx-bbbb"]);
        expect(a.beansAt("code-change-review", "Task_Merge")).toEqual([]);
        expect(a.beansAt("merge-train")).toEqual([]);
      }, t);

      test("a bean travels into the phase its instance calls", () => {
        const { a, seedInstance } = tool.fresh();
        created(a.create(bean("fx-aaaa")));
        seedInstance(inst("ccr--a", {
          bean: "fx-aaaa",
          tokens: ["Call_Close"],
          children: { Call_Close: { id: "bean-close--a", processId: "bean-close", tokens: ["Close_Complete"], status: "running", updatedAt: at } },
        }));
        expect(a.positions("fx-aaaa").map((p) => [p.process, p.instance, p.nodes])).toEqual([
          ["code-change-review", "ccr--a", ["Call_Close"]],
          ["bean-close", "ccr--a/Call_Close", ["Close_Complete"]],
        ]);
        expect(a.beansAt("bean-close", "Close_Complete")).toEqual(["fx-aaaa"]);
      }, t);

      test("a finished instance keeps the bean's position, but the bean is no longer in the process", () => {
        const { a, seedInstance } = tool.fresh();
        created(a.create(bean("fx-aaaa", { status: "completed" })));
        seedInstance(inst("ccr--a", { bean: "fx-aaaa", tokens: ["End_Done"], status: "completed" }));
        expect(a.positions("fx-aaaa")).toMatchObject([{ status: "completed", nodes: ["End_Done"] }]);
        expect(a.beansAt("code-change-review")).toEqual([]);
        expect(a.beansAt("code-change-review", "End_Done")).toEqual(["fx-aaaa"]);
      }, t);
    });

    describe("8. remember: the memory layer every work-plan Tool also is (Q17, §4.14)", () => {
      const at = "2026-11-03T07:00:00Z";
      const entry = (text: string, extra: Partial<MemoryEntry> = {}): MemoryEntry => ({ at, by: "agent-1", kind: "note", text, ...extra });

      test("what is kept is recalled, in order, with its metadata; the body's prose is not an entry", () => {
        const { a } = tool.fresh();
        created(a.create(bean("fx-aaaa")));
        a.keep("fx-aaaa", entry("took it up", { kind: "taken-up", process: "code-change-review", instance: "ccr--a" }));
        a.keep("fx-aaaa", entry("chose the smaller fix\nbecause it is reversible", { step: "Task_Review", role: "reviewer" }));
        const r = a.recall("fx-aaaa");
        if (r.state !== "hit") throw new Error("expected a record");
        expect(r.record.scope).toBe("item");
        expect(r.record.entries).toEqual([
          entry("took it up", { kind: "taken-up", process: "code-change-review", instance: "ccr--a" }),
          entry("chose the smaller fix because it is reversible", { step: "Task_Review", role: "reviewer" }),
        ]);
      }, t);

      test("a shared space: opened once, every agent's entries land", () => {
        const { a, b, settle } = tool.fresh();
        const o = a.open({ id: "fx-swrm", title: "Swarm notes", scope: "shared", about: ["run-7"] });
        if (o.state !== "opened") throw new Error(`open refused: ${o.why}`);
        settle?.();
        a.keep("fx-swrm", entry("found the parser bug", { by: "agent-1", kind: "checkpoint" }));
        settle?.();
        b.keep("fx-swrm", entry("fixed the test fixture", { by: "agent-2" }));
        settle?.();
        const r = a.recall("fx-swrm");
        if (r.state !== "hit") throw new Error("expected a record");
        expect([r.record.scope, r.record.about]).toEqual(["shared", ["run-7"]]);
        expect(r.record.entries.map((e) => [e.by, e.kind])).toEqual([["agent-1", "checkpoint"], ["agent-2", "note"]]);
      }, t);

      test("keeping to or recalling an unknown record is none, and creates nothing", () => {
        const { a } = tool.fresh();
        expect(a.keep("fx-gone", entry("x")).state).toBe("none");
        expect(a.recall("fx-gone").state).toBe("none");
        expect(a.get("fx-gone").state).toBe("none");
      }, t);
    });
  });
}
