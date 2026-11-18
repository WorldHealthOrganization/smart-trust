import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import oxigraph from "oxigraph";
import {
  beansToNQuads,
  buildBeanStore,
  queryBeanStore,
  NAMED_QUERIES,
  BEAN_NS,
  BEAN_PREFIX
} from "../beans-query.ts";
import { readArchivedBeans, type BeanNode } from "../beans.ts";

const sampleBeans: BeanNode[] = [
  {
    id: "epic-1",
    file: "beans/defs/folio-assistant-epic-1--root.md",
    title: "Root Epic",
    status: "in-progress",
    type: "epic",
    priority: "high",
    parent: "",
    blocking: [],
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-02T00:00:00Z",
    body: "Epic body"
  },
  {
    id: "child-1",
    file: "beans/defs/folio-assistant-child-1--task.md",
    title: "First Task",
    status: "todo",
    type: "task",
    priority: "normal",
    parent: "epic-1",
    blocking: ["child-2"],
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-02T00:00:00Z",
    body: "First task body"
  },
  {
    id: "child-2",
    file: "beans/defs/folio-assistant-child-2--task.md",
    title: "Second Task",
    status: "todo",
    type: "task",
    priority: "normal",
    parent: "epic-1",
    blocking: [],
    declaredBlockedBy: ["child-1"],
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-02T00:00:00Z",
    body: "Second task body"
  },
  {
    id: "child-3",
    file: "beans/defs/folio-assistant-child-3--task.md",
    title: "Third Task",
    status: "in-progress",
    type: "task",
    priority: "high",
    parent: "epic-1",
    blocking: [],
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-02T00:00:00Z",
    body: "Third task body"
  }
];

describe("beans-query", () => {
  test("beansToNQuads converts bean nodes to valid RDF N-Quads", () => {
    const nquads = beansToNQuads(sampleBeans);
    expect(nquads).toContain(`<${BEAN_PREFIX}folio-assistant-epic-1>`);
    expect(nquads).toContain(`<${BEAN_NS}status> "in-progress"`);
    expect(nquads).toContain(`<${BEAN_NS}type> "epic"`);
    expect(nquads).toContain(`<${BEAN_NS}parent> <${BEAN_PREFIX}folio-assistant-epic-1>`);
    expect(nquads).toContain(`<${BEAN_NS}blocks> <${BEAN_PREFIX}folio-assistant-child-2>`);
    expect(nquads).toContain(`<${BEAN_NS}blockedBy> <${BEAN_PREFIX}folio-assistant-child-1>`);

    const store = new oxigraph.Store();
    store.load(nquads, { format: "application/n-quads" });
    expect(store.size).toBeGreaterThan(15);
  });

  test("safe_drain_candidates named query finds leaves with >= 2 open siblings", () => {
    const store = new oxigraph.Store();
    store.load(beansToNQuads(sampleBeans), { format: "application/n-quads" });

    const results = queryBeanStore(store, NAMED_QUERIES.safe_drain_candidates!.sparql);
    expect(results.length).toBe(3); // child-1, child-2, child-3
    const ids = results.map(r => r.id);
    expect(ids).toContain("child-1");
    expect(ids).toContain("child-2");
    expect(ids).toContain("child-3");
    expect(Number(results[0]!.openSiblings)).toBe(3);
  });

  test("actionable_leaves named query excludes blocked leaves", () => {
    const store = new oxigraph.Store();
    store.load(beansToNQuads(sampleBeans), { format: "application/n-quads" });

    const results = queryBeanStore(store, NAMED_QUERIES.actionable_leaves!.sparql);
    const ids = results.map(r => r.id);
    // child-1 is todo and unblocked -> included
    expect(ids).toContain("child-1");
    // child-2 is blocked by child-1 (todo) -> excluded
    expect(ids).not.toContain("child-2");
    // child-3 is in-progress -> excluded (only todo/open)
    expect(ids).not.toContain("child-3");
  });

  test("critical_path_blockers counts blocking relationships", () => {
    const store = new oxigraph.Store();
    store.load(beansToNQuads(sampleBeans), { format: "application/n-quads" });

    const results = queryBeanStore(store, NAMED_QUERIES.critical_path_blockers!.sparql);
    expect(results.length).toBe(1);
    expect(results[0]!.blockerId).toBe("child-1");
    expect(Number(results[0]!.blockedCount)).toBe(1);
  });

  test("epic_burndown aggregates child statuses per epic", () => {
    const store = new oxigraph.Store();
    store.load(beansToNQuads(sampleBeans), { format: "application/n-quads" });

    const results = queryBeanStore(store, NAMED_QUERIES.epic_burndown!.sparql);
    expect(results.length).toBe(1);
    expect(results[0]!.epicId).toBe("epic-1");
    expect(Number(results[0]!.total)).toBe(3);
    expect(Number(results[0]!.open)).toBe(2); // child-1, child-2
    expect(Number(results[0]!.inProgress)).toBe(1); // child-3
    expect(Number(results[0]!.completed)).toBe(0);
  });

  test("unparented_open_tasks finds open tasks without epic or milestone parent", () => {
    const beansWithOrphan: BeanNode[] = [
      ...sampleBeans,
      {
        id: "orphan-1",
        file: "beans/defs/folio-assistant-orphan-1--standalone.md",
        title: "Standalone Task",
        status: "todo",
        type: "task",
        priority: "normal",
        parent: "",
        blocking: [],
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-02T00:00:00Z",
        body: "Standalone body"
      }
    ];
    const store = new oxigraph.Store();
    store.load(beansToNQuads(beansWithOrphan), { format: "application/n-quads" });

    const results = queryBeanStore(store, NAMED_QUERIES.unparented_open_tasks!.sparql);
    const ids = results.map(r => r.id);
    expect(ids).toContain("orphan-1");
    expect(ids).not.toContain("epic-1"); // epic is excluded
    expect(ids).not.toContain("child-1"); // child has parent
  });

  test("circular_blockers detects mutual deadlocks", () => {
    const deadlockBeans: BeanNode[] = [
      {
        id: "lock-a",
        file: "beans/defs/lock-a.md",
        title: "Deadlock A",
        status: "todo",
        type: "task",
        priority: "normal",
        parent: "",
        blocking: ["lock-b"],
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-02T00:00:00Z",
        body: ""
      },
      {
        id: "lock-b",
        file: "beans/defs/lock-b.md",
        title: "Deadlock B",
        status: "todo",
        type: "task",
        priority: "normal",
        parent: "",
        blocking: ["lock-a"],
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-02T00:00:00Z",
        body: ""
      }
    ];
    const store = new oxigraph.Store();
    store.load(beansToNQuads(deadlockBeans), { format: "application/n-quads" });

    const results = queryBeanStore(store, NAMED_QUERIES.circular_blockers!.sparql);
    expect(results.length).toBe(1);
    expect(results[0]!.aId).toBe("lock-a");
    expect(results[0]!.bId).toBe("lock-b");
  });

  test("buildBeanStore loads the repository's real bean store cleanly", () => {
    const root = resolve(".");
    const { store, beans, quadsCount } = buildBeanStore(root);
    // The active store is open work, and a drain empties it on purpose: the
    // 2026-11-01 archive sweep left 30 (cat-harness-tools#1248). So the size
    // floor is on the history instead: active plus the archive view, which
    // archiving moves beans between but never shrinks.
    expect(beans.length).toBeGreaterThan(0);
    expect(quadsCount).toBeGreaterThan(beans.length);
    expect(store.size).toBe(quadsCount);
    expect(beans.length + (readArchivedBeans(root)?.length ?? 0)).toBeGreaterThan(500);
  });

  test("CLI --list prints available named queries", () => {
    const proc = Bun.spawnSync(["bun", "run", "cat-harness-tools/scripts/beans-query.ts", "--list"], {
      cwd: resolve("."),
    });
    expect(proc.exitCode).toBe(0);
    const stdout = proc.stdout.toString();
    expect(stdout).toContain("Available Named Queries:");
    expect(stdout).toContain("safe_drain_candidates");
    expect(stdout).toContain("actionable_leaves");
    expect(stdout).toContain("circular_blockers");
  });

  test("CLI --named query with --format ids outputs space or newline separated bean IDs", () => {
    const proc = Bun.spawnSync(["bun", "run", "cat-harness-tools/scripts/beans-query.ts", "--named", "safe_drain_candidates", "--format", "ids"], {
      cwd: resolve("."),
    });
    expect(proc.exitCode).toBe(0);
    const stdout = proc.stdout.toString().trim();
    const ids = stdout.split(/\s+/).filter(Boolean);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids[0]).toMatch(/^[a-z0-9-]+$/);
  });

  test("CLI --named query with --format json outputs parseable JSON array", () => {
    const proc = Bun.spawnSync(["bun", "run", "cat-harness-tools/scripts/beans-query.ts", "--named", "epic_burndown", "--format", "json"], {
      cwd: resolve("."),
    });
    expect(proc.exitCode).toBe(0);
    const stdout = proc.stdout.toString().trim();
    const data = JSON.parse(stdout);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty("epicId");
  });

  test("CLI --sparql executes arbitrary SPARQL 1.1 query", () => {
    const sparql = 'PREFIX bean: <https://folio-assistant.org/vocab/bean#> SELECT (COUNT(?b) AS ?c) WHERE { ?b a bean:Bean }';
    const proc = Bun.spawnSync(["bun", "run", "cat-harness-tools/scripts/beans-query.ts", "--sparql", sparql, "--format", "json"], {
      cwd: resolve("."),
    });
    expect(proc.exitCode).toBe(0);
    const data = JSON.parse(proc.stdout.toString().trim());
    expect(Array.isArray(data)).toBe(true);
    // Every bean the store loads is counted: exact, so a drain cannot break it.
    expect(Number(data[0].c)).toBeGreaterThan(0);
    expect(Number(data[0].c)).toBe(buildBeanStore(resolve(".")).beans.length);
  });
});
