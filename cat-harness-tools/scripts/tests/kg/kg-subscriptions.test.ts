/**
 * `subscriptions` (issue #1719, epic bean `fnx4`): an external Knowledge Graph
 * this layer CONSUMES, and which of its parts it chose to hold. The schema
 * holds the choice and the pin; state lives on each part's materialisation
 * record. These pin the shapes that would blur that.
 *
 * The tests of this file that read the whole checkout (derives the staged
 * layers of the checkout) live in `test/kg-subscriptions-checkout.test.ts`
 * (bean `7zz1`): standing alone, cat-harness has none of it.
 */
import { describe, expect, test } from "bun:test";

import { CatHarnessDeclarationSchema } from "../../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { dirname } from "node:path";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const WHO_IRIS = {
  id: "who-iris",
  repository: "litlfred/who-iris",
  ref: SHA,
  subgraphs: ["catalogue"],
  assets: { policy: "on-demand" },
  harnesses: ["who-iris"],
};

function decl(over: Record<string, unknown> = {}): unknown {
  return { name: "example", directories: [], remoteGraphs: [], ...over };
}
function failedPaths(value: unknown): string[] {
  const r = CatHarnessDeclarationSchema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => i.path.join(".")).sort();
}

describe("subscriptions: the schema", () => {
  test("absent is legal, and stays absent (not defaulted to [])", () => {
    const r = CatHarnessDeclarationSchema.safeParse(decl());
    expect(r.success).toBe(true);
    expect(r.success && r.data.subscriptions).toBeUndefined();
  });

  test("a well-formed entry parses", () => {
    expect(failedPaths(decl({ subscriptions: [WHO_IRIS] }))).toEqual([]);
  });

  test("the minimum is id + repository + ref: choosing nothing is a legal subscription (all referenced)", () => {
    expect(failedPaths(decl({ subscriptions: [{ id: "ihris", repository: "litlfred/ihris", ref: SHA }] }))).toEqual([]);
  });

  test("`ref` must be a FULL SHA — a branch, a tag or an abbreviation is refused", () => {
    for (const ref of ["main", "v1.0.0", SHA.slice(0, 11), SHA.toUpperCase()]) {
      expect(failedPaths(decl({ subscriptions: [{ ...WHO_IRIS, ref }] }))).toEqual(["subscriptions.0.ref"]);
    }
  });

  test("`repository` is owner/repo, not a URL", () => {
    expect(failedPaths(decl({ subscriptions: [{ ...WHO_IRIS, repository: "https://github.com/litlfred/who-iris" }] }))).toEqual([
      "subscriptions.0.repository",
    ]);
  });

  test("an unknown key is refused (strict): a misspelt `subgraph` must not vanish", () => {
    expect(failedPaths(decl({ subscriptions: [{ ...WHO_IRIS, subgraph: ["x"] }] }))).toEqual(["subscriptions.0"]);
  });

  test("an unknown asset policy is refused", () => {
    expect(failedPaths(decl({ subscriptions: [{ ...WHO_IRIS, assets: { policy: "some" } }] }))).toEqual([
      "subscriptions.0.assets.policy",
    ]);
  });

  test("a subgraph or harness chosen twice is refused", () => {
    expect(failedPaths(decl({ subscriptions: [{ ...WHO_IRIS, subgraphs: ["a", "a"] }] }))).toEqual(["subscriptions.0.subgraphs"]);
    expect(failedPaths(decl({ subscriptions: [{ ...WHO_IRIS, harnesses: ["h", "h"] }] }))).toEqual(["subscriptions.0.harnesses"]);
  });

  test("the same id twice is refused", () => {
    expect(failedPaths(decl({ subscriptions: [WHO_IRIS, WHO_IRIS] }))).toEqual(["subscriptions"]);
  });

  test("an id also in `needs` is refused: a subscription is consumed part by part, not loaded", () => {
    expect(failedPaths(decl({ needs: ["who-iris"], subscriptions: [WHO_IRIS] }))).toEqual(["subscriptions.0.id"]);
  });

  test("an id also in `associatedHarnesses` is refused: one relation per remote thing", () => {
    const associated = { name: "who-iris", url: "https://litlfred.github.io/who-iris/" };
    expect(failedPaths(decl({ associatedHarnesses: [associated], subscriptions: [WHO_IRIS] }))).toEqual(["subscriptions.0.id"]);
  });
});

import { knownSubstrates, render, repoFromUrl, type SubstrateRow } from "../../subscriptions-viz.ts";
import { join, resolve } from "node:path";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

describe("the known-substrates registry (subscriptions-viz)", () => {
  const REPO = resolve(dirname(HARNESS_ROOT));

  test("iHRIS is derived as exists, with its repository (associated, or subscribed since bean tmo5)", () => {
    const ihris = knownSubstrates(REPO).find((r) => r.name === "ihris");
    expect(ihris?.status).toBe("exists");
    expect(ihris?.repository).toBe("litlfred/ihris");
  });

  // Asserted over a synthetic checkout since the harness dropped its
  // `who-iris` hand row: that layer is mounted in the checkout now, with a
  // declaration of its own, and a hand row is only for what no declaration
  // names. The harness may not name a layer above it either.
  test("a hand row OVERRIDES a derived one by name (planned -> exists)", () => {
    const root = mkdtempSync(join(tmpdir(), "substrates-"));
    try {
      mkdirSync(join(root, ".git"));
      const instance = (name: string, extra: Record<string, unknown>) => {
        mkdirSync(join(root, name), { recursive: true });
        writeFileSync(join(root, name, `${name}.json`), JSON.stringify({ name, version: "0.1.0", repository: `o/${name}`, directories: [], ...extra }));
      };
      instance("staged", { livesAt: { repository: "o/host", path: "staged" } });
      instance("host", {
        livesAt: { repository: "o/host", path: "." },
        knownSubstrates: [{ name: "staged", title: "Staged", repository: "o/staged", status: "exists", note: "Repository created; hand row." }],
      });
      const rows = knownSubstrates(root);
      const staged = rows.find((r) => r.name === "staged");
      expect(staged?.status).toBe("exists");
      expect(staged?.source).toBe("hand-entered");
      expect(staged?.repository).toBe("o/staged");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a subscription is derived as exists, titled from its cached snapshot", () => {
    const root = mkdtempSync(join(tmpdir(), "substrates-"));
    try {
      mkdirSync(join(root, ".git"));
      mkdirSync(join(root, "host", "subscriptions"), { recursive: true });
      writeFileSync(
        join(root, "host", "host.json"),
        JSON.stringify({
          name: "host",
          version: "0.1.0",
          livesAt: { repository: "o/host", path: "host" },
          directories: [{ id: "subscriptions", path: "subscriptions/", graphTypologies: ["substrate-snapshot"] }],
          subscriptions: [{ id: "kb", repository: "o/kb", ref: SHA }],
        }),
      );
      writeFileSync(join(root, "host", "subscriptions", "kb.substrate.json"), JSON.stringify({ summary: { name: "kb", title: "The KB" } }));
      const kb = knownSubstrates(root).find((r) => r.name === "kb");
      expect(kb).toMatchObject({ status: "exists", repository: "o/kb", source: "subscription", title: "The KB" });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("repoFromUrl takes only a github repository URL", () => {
    expect(repoFromUrl("https://github.com/litlfred/ihris")).toBe("litlfred/ihris");
    expect(repoFromUrl("https://github.com/litlfred/ihris/")).toBe("litlfred/ihris");
    expect(repoFromUrl("https://litlfred.github.io/ihris/")).toBeUndefined();
    expect(repoFromUrl(undefined)).toBeUndefined();
  });

  test("a subscription card draws chosen parts as NOT YET HELD — never as held", () => {
    const text = render([] as SubstrateRow[], [{ subscriber: "demo", subscription: WHO_IRIS as never }]);
    expect(text).toContain("subgraph `catalogue` | ✓ | 🔗 chosen, not yet held");
    expect(text).toContain("harness `who-iris` | ✓ | 🔗 chosen, not yet instantiated");
    expect(text).toContain("everything else the substrate offers | — | 🔗 referenced");
    expect(text).not.toContain("⬇");
  });

  test("an empty registry says so rather than rendering an empty table", () => {
    expect(render([], [])).toContain("_No substrate is known");
  });
});
