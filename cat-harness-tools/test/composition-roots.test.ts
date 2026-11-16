/**
 * The composition roots resolve their parts from declarations, and every way
 * of NOT resolving one is distinguishable from resolving it.
 *
 * `server.ts` imported six tool registrars, five route modules and
 * `src/index.ts` two adapter classes. Three of the registrars, three of the
 * routes and one of the adapters belong to another layer, so both generic
 * entry points named it — and after the split those imports do not resolve,
 * failing at MODULE LOAD, before either file's own error handling can run.
 *
 * The routes are the case where naming them is not merely inelegant but
 * measurably unfixable by reclassification: 10 wrong-direction edges with the
 * three content routes in the harness, 11 with them in core, because the
 * composition root then crosses the line to mount them.
 *
 * The negative cases are the ones worth having. A resolver that returned
 * nothing for every miss would pass "the platform's groups register" and still
 * let a server start silently missing half its tools.
 *
 * @module scripts/tests/composition-roots.test
 */
import { describe, test, expect } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  registerDeclaredToolGroups,
  registerServedToolGroups,
  servedToolGroups,
  toolGroupsFromNodes,
  type ToolGroupDeclaration,
} from "../src/tool-groups.ts";
import { tools as harnessTools } from "../schemas/tools/harness-tools.ts";
import { discoverTools } from "../tools/discover.ts";

/** This layer's root, for the ad-hoc declarations below. */
const MCP_ROOT = new URL("..", import.meta.url).pathname;
/** The repository: a layer root whose dependency tree holds every layer. */
const REPO = new URL("../..", import.meta.url).pathname;
const HARNESS = new URL("../../cat-harness/", import.meta.url).pathname;
import {
  AdapterDeclarationCollisionError,
  BUILTIN_ADAPTERS,
  discoverBuiltinAdapters,
  resolveAdapterPreamble,
  resolveBuiltinAdapter,
} from "../src/builtin-adapters.ts";
import { SERVER_ROUTES } from "../src/server.ts";
import { dispatchGet, dispatchPost, mountDeclaredRoutes } from "../src/route-groups.ts";

/** The HTTP server's own root, which its route declarations resolve against.
 * Still `cat-harness/` until the HTTP server moves here (bean `w2gr`, step 3b). */
const SERVER_ROOT = new URL("../../cat-harness/", import.meta.url).pathname;

describe("MCP tool groups", () => {
  // Bean riit 3c (owner, 2026-10-05): both MCP servers serve every Tool node
  // in the folio's dependency tree, so neither keeps a list. These replace the
  // tests of the viewer server's `TOOL_GROUPS`, which is gone with the six
  // forked modules it named.
  test("every served group in the dependency tree registers here", async () => {
    // A recording server: the registrars only need something to hang tools on.
    const calls: string[] = [];
    const fake = { tool: (name: string) => calls.push(name), registerTool: (n: string) => calls.push(n) };
    const { outcomes, failures } = await registerServedToolGroups(fake, REPO, [REPO]);
    expect(failures).toEqual([]);
    expect(outcomes.filter((o) => o.state !== "registered")).toEqual([]);
    expect(outcomes.length).toBeGreaterThan(0);
    expect(calls).toContain("folio_init");
  });

  test("the served groups ARE the Tool nodes' modules — no list restates them", () => {
    const sets = servedToolGroups(REPO).sets;
    // The harness's own, exactly — the set the harness server served before
    // the walk existed.
    const harness = sets.find((s) => s.root === HARNESS.replace(/\/$/, ""));
    expect(harness?.groups.map((g) => g.module).sort()).toEqual(toolGroupsFromNodes(harnessTools()).map((g) => g.module).sort());
    // And a layer ABOVE the harness, reached only through the tree: exactly
    // that layer's own Tool nodes' modules, read from its graph rather than
    // restated here — a hand list went stale the moment bean `bbza` moved
    // three Tools up to sci. sci's `lean_formal_edges` was a `contributes`
    // tool group until its Tool node replaced it (bean riit).
    const sci = sets.find((s) => s.instance === "folio-assistant-sci");
    expect(sci).toBeDefined();
    const sciNodes = discoverTools(dirname(sci!.root), undefined, sci!.root);
    expect(sciNodes.failures).toEqual([]);
    expect(sci!.groups.map((g) => g.module).sort()).toEqual(toolGroupsFromNodes(sciNodes.tools).map((g) => g.module).sort());
    expect(sci!.groups.map((g) => g.module)).toContain("pipeline/formal-edges-mcp.ts");
  });

  test("a folio that declares nothing still gets the harness's tools", () => {
    // Bean `zmdo`: `folio_init` must reach a fresh layer, whose chain is
    // empty because it has no declaration yet.
    const tmp = mkdtempSync(join(tmpdir(), "served-tools-"));
    try {
      const { sets } = servedToolGroups(tmp, [{ name: "cat-harness", root: HARNESS }]);
      expect(sets.map((s) => s.instance)).toEqual(["cat-harness"]);
      expect(sets[0]!.groups.map((g) => g.module)).toContain("src/tools/folio-init.ts");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("a group carries the instance that declares it as its layer", () => {
    for (const set of servedToolGroups(REPO).sets) {
      for (const g of set.groups) expect(g.layer).toBe(set.instance);
    }
  });

  test("an uninstalled layer is SKIPPED and reported, not a crash", async () => {
    // The one behaviour a hardcoded import cannot have: after the split a
    // core-only checkout has no science layer and must still start.
    const missing: ToolGroupDeclaration[] = [
      { id: "ghost", module: "adapters/mcp-server/tools/not-here.ts", registrar: "registerGhostTools", layer: "sci", requires: "a Lean toolchain" },
    ];
    const [o] = await registerDeclaredToolGroups({}, missing, MCP_ROOT);
    expect(o.state).toBe("absent");
    if (o.state === "absent") {
      expect(o.layer).toBe("sci");
      expect(o.detail).toContain("a Lean toolchain");
    }
  });

  test("a present-but-broken group is `failed`, NOT `absent`", async () => {
    // Different states because the remedies are opposite: fix the module vs
    // install the layer. Collapsing them sends the operator the wrong way.
    const broken: ToolGroupDeclaration[] = [
      { id: "wrong-export", module: "src/tools/readme-audit.ts", registrar: "registerNoSuchThing", layer: "sci" },
    ];
    const [o] = await registerDeclaredToolGroups({}, broken, MCP_ROOT);
    expect(o.state).toBe("failed");
    if (o.state === "failed") expect(o.detail).toContain("registerNoSuchThing");
  });

  test("a registrar that throws is `failed`, and does not abort the rest", async () => {
    const calls: string[] = [];
    const groups: ToolGroupDeclaration[] = [
      { id: "wrong-export", module: "src/tools/readme-audit.ts", registrar: "registerNoSuchThing", layer: "sci" },
      { id: "readme-audit", module: "src/tools/readme-audit.ts", registrar: "registerReadmeAuditTools", layer: "cat-harness" },
    ];
    const fake = { tool: (n: string) => calls.push(n), registerTool: (n: string) => calls.push(n) };
    const out = await registerDeclaredToolGroups(fake, groups, MCP_ROOT);
    expect(out.map((o) => o.state)).toEqual(["failed", "registered"]);
  });
});

describe("built-in content adapters", () => {
  test("both declared adapters resolve in this checkout", async () => {
    for (const d of BUILTIN_ADAPTERS) {
      const r = await resolveBuiltinAdapter(d.contentType);
      expect(r.used.contentType).toBe(d.contentType);
      expect(r.fallbackReason).toBeUndefined();
      expect(typeof r.ctor).toBe("function");
    }
  });

  test("a specialisation leads its base, because it is the superset", () => {
    // Falling back TO a specialisation loses nothing — it registers its base's
    // tools too. Falling back FROM it loses its own, which is why that
    // direction has to be announced. Which layers ship `paper` and
    // `document` is asserted by THOSE layers' tests, not here: this one
    // must hold in a checkout of the harness alone.
    for (const d of BUILTIN_ADAPTERS) {
      if (d.extends === undefined) continue;
      const base = BUILTIN_ADAPTERS.findIndex((a) => a.contentType === d.extends);
      if (base >= 0) expect(BUILTIN_ADAPTERS.indexOf(d)).toBeLessThan(base);
    }
  });

  test("discovery reads declarations, orders by `extends`, and refuses a collision", () => {
    const tmp = mkdtempSync(join(tmpdir(), "builtin-adapters-"));
    try {
      const harness = join(tmp, "harness");
      mkdirSync(harness);
      writeFileSync(join(harness, "harness.json"), JSON.stringify({ name: "harness" }));
      const decl = (name: string, adapters: unknown) => {
        mkdirSync(join(tmp, name));
        writeFileSync(join(tmp, name, `${name}.json`), JSON.stringify({ name, contentAdapters: adapters }));
      };
      decl("base", [{ contentType: "b", module: "a/b.ts", className: "B" }]);
      decl("spec", [{ contentType: "s", module: "a/s.ts", className: "S", extends: "b" }]);
      const { adapters, problems } = discoverBuiltinAdapters(tmp, harness);
      expect(problems).toEqual([]);
      // `base` sorts first alphabetically; `spec` leads anyway, by `extends`.
      expect(adapters.map((a) => a.contentType)).toEqual(["s", "b"]);
      expect(adapters[0]).toMatchObject({ instance: "spec", module: "../spec/a/s.ts" });

      decl("dupe", [{ contentType: "b", module: "x.ts", className: "X" }]);
      expect(() => discoverBuiltinAdapters(tmp, harness)).toThrow(AdapterDeclarationCollisionError);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("a malformed or escaping declaration is RECORDED, not read as 'declares none'", () => {
    const tmp = mkdtempSync(join(tmpdir(), "builtin-adapters-"));
    try {
      mkdirSync(join(tmp, "up"));
      writeFileSync(
        join(tmp, "up", "up.json"),
        JSON.stringify({ name: "up", contentAdapters: [{ contentType: "x", module: "../elsewhere/x.ts", className: "X" }] }),
      );
      const { adapters, problems } = discoverBuiltinAdapters(tmp, join(tmp, "up"));
      expect(adapters).toEqual([]);
      expect(problems.join("\n")).toContain("up");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("an unknown contentType falls back AND says so", async () => {
    // Silence here is the failure mode: a folio running on an adapter it did
    // not ask for behaves subtly differently and nothing says why.
    const r = await resolveBuiltinAdapter("no-such-type");
    expect(r.fallbackReason).toBeDefined();
    expect(r.fallbackReason).toContain("no-such-type");
    expect(typeof r.ctor).toBe("function");
  });

  test("the class name each declaration points at is the one exported", async () => {
    // Guards a rename: the module is loaded by variable path, so a class
    // renamed without updating the table fails at STARTUP, and only this test
    // catches it before a user does.
    for (const d of BUILTIN_ADAPTERS) {
      const r = await resolveBuiltinAdapter(d.contentType);
      expect(r.ctor.name).toBe(d.className);
    }
  });

  test("resolveAdapterPreamble returns the adapter's preamblePath or undefined on fallback", async () => {
    // An unknown contentType falls back in resolveBuiltinAdapter, but must not
    // masquerade as supplying a preamble for the unknown type.
    expect(await resolveAdapterPreamble("no-such-type")).toBeUndefined();
    expect(await resolveAdapterPreamble("document")).toBeUndefined();

    // When an adapter declares `static readonly preamblePath`, resolveAdapterPreamble
    // surfaces it without naming any layer path in the harness.
    const tmp = mkdtempSync(join(tmpdir(), "adapter-preamble-"));
    try {
      const modPath = join(tmp, "mock-paper-adapter.ts");
      const tplPath = join(tmp, "template.tex");
      writeFileSync(tplPath, "% mock preamble\n");
      writeFileSync(
        modPath,
        `export class MockPaperAdapter {\n  static readonly preamblePath = ${JSON.stringify(tplPath)};\n}\n`,
      );
      const resolved = await resolveAdapterPreamble(
        "paper",
        [{ contentType: "paper", instance: "mock", module: modPath, className: "MockPaperAdapter", root: tmp }],
        [],
      );
      expect(resolved).toBe(tplPath);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("HTTP routes", () => {
  /**
   * The same fixture the server builds. `adapter` is `{}` because nothing
   * reached here calls into it — a route that DID would fail loudly, which is
   * the point of leaving it minimal rather than mocking a whole adapter.
   */
  const deps = () => ({
    repoRoot: SERVER_ROOT,
    adapter: {},
    services: { gitHelper: {}, feedbackStore: {} },
  });

  test("every declared route's module exists and mounts", async () => {
    const { routes, outcomes } = await mountDeclaredRoutes(SERVER_ROUTES, SERVER_ROOT, deps());
    expect(outcomes.filter((o) => o.state !== "mounted")).toEqual([]);
    expect(routes).toHaveLength(SERVER_ROUTES.length);
  });

  test("the declaration covers all five routes the server used to import, and the work-plan route added since", () => {
    // `work-plan` (cat-harness#991 §4.9) is the read-only, localhost-only
    // beans-by-process route; it is GET-only and sits before `chat`.
    expect(SERVER_ROUTES.map((r) => r.id)).toEqual(
      ["branches", "feedback", "glossary", "relevance", "work-plan", "chat"],
    );
  });

  test("declaration order IS dispatch order, and chat stays last", () => {
    // Dispatch is first-match-wins, so this list reproduces the sequence of
    // `if` blocks it replaced. A reordering is a behaviour change, which is
    // exactly why the order is asserted rather than left to review.
    expect(SERVER_ROUTES.at(-1)!.id).toBe("chat");
  });

  test("chat is POST-only and work-plan GET-only, so each dispatch is one shorter than the list", async () => {
    // Paired by id through the outcomes, not by position: a layer that is not
    // installed (a standalone checkout has no content routes) mounts fewer
    // routes than are declared, and the routes come back in declaration order.
    const { routes, outcomes } = await mountDeclaredRoutes(SERVER_ROUTES, SERVER_ROOT, deps());
    const mounted = outcomes.filter((o) => o.state === "mounted").map((o) => o.id);
    expect(mounted).toContain("chat");
    expect(mounted).toContain("work-plan");
    expect(mounted.filter((_, i) => !routes[i]!.get)).toEqual(["chat"]);
    expect(mounted.filter((_, i) => !routes[i]!.post)).toEqual(["work-plan"]);
  });

  test("the three content routes are declared `core`", () => {
    // The boundary is reviewable in one place rather than inferable from five
    // import lines. Feedback, glossary and relevance all act on a folio's
    // content; branches and chat are the harness's own.
    const core = SERVER_ROUTES.filter((r) => r.layer === "core").map((r) => r.id).sort();
    expect(core).toEqual(["feedback", "glossary", "relevance"]);
  });

  test("a missing service is reported BY NAME, not as a later TypeError", async () => {
    // The negative case that matters: without this check a route mounts fine
    // and blows up inside a handler on some request hours later, where the
    // stack names neither the service nor the declaration.
    const { routes, outcomes } = await mountDeclaredRoutes(SERVER_ROUTES, SERVER_ROOT, {
      repoRoot: SERVER_ROOT,
      adapter: {},
      services: {},
    });
    const failed = outcomes.filter((o) => o.state === "failed");
    expect(failed.map((o) => o.id).sort()).toEqual(["branches", "feedback"]);
    for (const f of failed) expect((f as { detail: string }).detail).toMatch(/gitHelper|feedbackStore/);
    // The four that need nothing (glossary, relevance, work-plan, chat) still
    // mount: one route's missing service must not take the others down.
    expect(routes).toHaveLength(4);
  });

  test("an absent module is `absent`, a broken one is `failed`", async () => {
    // Two states, never one. The remedies are opposite — install that layer
    // versus fix the module — so collapsing them sends the operator the wrong
    // way half the time.
    const absent = await mountDeclaredRoutes(
      [{ id: "ghost", module: "src/routes/ghost.ts", mount: "x", layer: "sci" }],
      SERVER_ROOT,
      deps(),
    );
    expect(absent.outcomes[0]!.state).toBe("absent");
    expect(absent.routes).toHaveLength(0);

    const broken = await mountDeclaredRoutes(
      [{ id: "bad", module: "src/routes/feedback.ts", mount: "noSuchFactory", layer: "core" }],
      SERVER_ROOT,
      deps(),
    );
    expect(broken.outcomes[0]!.state).toBe("failed");
    expect((broken.outcomes[0] as { detail: string }).detail).toContain("noSuchFactory");
  });

  test("chat declares no `needs` — it never read the store it was handed", () => {
    // `handleChatPost` took a `_feedbackStore` it never read. Harmless while
    // the store was the harness's; a wrong-direction import bought with
    // nothing once it became core's. Pinned so it cannot quietly come back.
    expect(SERVER_ROUTES.find((r) => r.id === "chat")!.needs).toBeUndefined();
  });

  test("dispatch returns null for a URL nobody claims", async () => {
    const { routes } = await mountDeclaredRoutes(SERVER_ROUTES, SERVER_ROOT, deps());
    const url = new URL("http://x/api/nothing-claims-this");
    expect(await dispatchGet(routes, url)).toBeNull();
    expect(await dispatchPost(routes, url, new Request(url, { method: "POST" }))).toBeNull();
  });
});
