/**
 * The block kinds are DISCOVERED from `folio-block-kind/v1` nodes (bean riit,
 * step 2). Owner, 2026-10-04: *"kinds need to be discoverable … not
 * centrally managed"*. These tests pin the properties that make discovery
 * safe to rely on.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  ADAPTER_BLOCK_KINDS, BLOCK_KIND_NODES, BLOCK_KINDS, CONTENT_ADAPTERS, CONTENT_ADAPTER_NODES, DOCUMENT_BLOCK_KINDS, MATH_BLOCK_KINDS,
  adapterForKind, discoverBlockKinds, discoverContentAdapters, kindForBuilder, type ContentAdapter,
} from "./content/block-kinds";
import { ADAPTER_COMPANION_ROLES } from "./sdlc/block-qa";
import { KNOWN_LABEL_PREFIXES, LABEL_PREFIXES } from "./constraints";
import { allTypedBlockKinds } from "./content/vocabulary-modules";
import { BLOCK_KIND_TO_FOLIO_TYPE, KIND_PREFIXES, assertPrefixesInSync } from "./kg/jsonld";
import { kindHeading } from "./content/translation";

/**
 * Run `fn` with the standalone fixture switched off. Standing alone the test
 * preload points discovery at test/fixtures/standalone-checkout/, which a test
 * about an EMPTY or planted checkout must not see.
 */
function withoutFixture<T>(fn: () => T): T {
  // input-site: inert #7361076d — saves the environment to restore it after the test, or strips names before handing it to a child; no assertion reads the values
  const saved = process.env.FOLIO_FIXTURE_CHECKOUT;
  delete process.env.FOLIO_FIXTURE_CHECKOUT;
  try {
    return fn();
  } finally {
    if (saved !== undefined) process.env.FOLIO_FIXTURE_CHECKOUT = saved;
  }
}

describe("block kinds are discovered, not listed", () => {
  test("every typed kind is discovered, and every discovered kind is typed", () => {
    // Typed by BlockSchema or by a vocabulary module: the science layer types
    // its own kinds (vocabulary-modules.ts).
    expect([...BLOCK_KINDS].map(String).sort()).toEqual(allTypedBlockKinds().sort());
  });

  test("the math kinds are the paper adapter's, declared by folio-assistant-sci; the rest by folio-assistant-core", () => {
    expect([...MATH_BLOCK_KINDS].map(String).sort()).toEqual(
      ["conjecture", "corollary", "definition", "lemma", "proof", "proposition", "theorem"],
    );
    expect(MATH_BLOCK_KINDS.length + DOCUMENT_BLOCK_KINDS.length).toBe(BLOCK_KINDS.length);
  });

  test("each per-kind table is read off the nodes", () => {
    for (const n of BLOCK_KIND_NODES) {
      expect(BLOCK_KIND_TO_FOLIO_TYPE[n.kind as keyof typeof BLOCK_KIND_TO_FOLIO_TYPE]).toBe(n.folioType);
      expect(KNOWN_LABEL_PREFIXES).toContain(`${n.labelPrefix}:`);
      expect(kindHeading(n.kind, "en")).toBe(n.heading!);
      expect(kindForBuilder(n.builder ?? n.kind)).toBe(n.kind);
      if (n.prefixEnforced) expect(LABEL_PREFIXES[n.kind]).toBe(`${n.labelPrefix}:`);
    }
    expect(() => assertPrefixesInSync(KNOWN_LABEL_PREFIXES)).not.toThrow();
    expect(KIND_PREFIXES.length).toBe(KNOWN_LABEL_PREFIXES.length);
  });

  test("non-English headings come from the owners' translation catalogues", () => {
    expect(kindHeading("theorem", "fr")).toBe("Théorème"); // folio-assistant-sci/translations/fr
    expect(kindHeading("table", "zh-Hans")).toBe("表"); // folio-assistant-core/translations/zh
    expect(kindHeading("figure", "es")).toBe("Figura"); // had no row before; diagram's rendering
    expect(kindHeading("prose", "ru")).toBe(""); // shown with no heading, in every locale
    expect(kindHeading("lemma", "xx")).toBe("Lemma"); // no catalogue: the node's English
    expect(kindHeading("decision-table", "fr")).toBe("Decision table"); // no node here: sentence-cased
    expect(kindHeading("non-functional-requirement", "en")).toBe("Non-functional requirement"); // a "non-" prefix keeps its hyphen
  });

  test("a kind declared by two files is refused, naming both", () => {
    const root = mkdtempSync(join(tmpdir(), "block-kinds-"));
    for (const inst of ["a", "b"]) {
      mkdirSync(join(root, inst, "block-kinds"), { recursive: true });
      writeFileSync(
        join(root, inst, `${inst}.json`),
        JSON.stringify({ name: inst, directories: [{ id: `${inst}-bk`, path: "block-kinds/", graphTypologies: ["block-kinds"] }] }),
      );
      writeFileSync(
        join(root, inst, "block-kinds", "note.json"),
        JSON.stringify({
          $schema: "folio-block-kind/v1", kind: "note", adapter: "paper", profile: "document",
          labelPrefix: "note", folioType: "x:Note", heading: "Note", headingPlural: "Notes",
        }),
      );
    }
    expect(() => discoverBlockKinds(root)).toThrow(/declared twice: .*a\/block-kinds\/note\.json and .*b\/block-kinds\/note\.json/);
  });

  test("a checkout that declares no block-kinds graph has no kinds — the harness alone loads", () => {
    // It threw until check:cat-harness-standalone measured the cost: every
    // module importing block-kinds failed to LOAD in a cat-harness-only
    // checkout, which owns no vocabulary (bean `zmdo`: generic tools only).
    // "None" is guarded where it could lie: a malformed node throws (above),
    // and THIS checkout, which does declare them, must find them (below).
    const root = mkdtempSync(join(tmpdir(), "block-kinds-empty-"));
    expect(withoutFixture(() => discoverBlockKinds(root))).toEqual([]);
    expect(BLOCK_KINDS.length).toBeGreaterThan(0);
  });
});

describe("content-adapter vocabularies are nodes (bean riit, step 5)", () => {
  test("the typed vocabularies are the nodes that say typed, each owning a kind, and every built-in kind names one", () => {
    // Bean `bzwk` (owner 2026-10-12, option B): the vocabulary splits by
    // layer — core's `document`, sci's `mathpaper` — so `ContentAdapter` is a
    // string and the harness names neither. What still holds, whatever the
    // layout: the typed adapters are read off the nodes, none is empty, and
    // a built-in kind always belongs to exactly one of them.
    const typedNodes = CONTENT_ADAPTER_NODES.filter((n) => n.typed).map((n) => n.adapter).sort();
    expect([...CONTENT_ADAPTERS].sort() as string[]).toEqual(typedNodes);
    for (const a of CONTENT_ADAPTERS) expect(ADAPTER_BLOCK_KINDS[a]!.length).toBeGreaterThan(0);
    for (const k of BLOCK_KINDS) expect(CONTENT_ADAPTERS as readonly string[]).toContain(adapterForKind(k)!);
  });

  test("each typed vocabulary's companion roles come from its node", () => {
    for (const n of CONTENT_ADAPTER_NODES.filter((x) => x.typed)) {
      expect(ADAPTER_COMPANION_ROLES[n.adapter as ContentAdapter]).toEqual(n.companionRoles);
    }
    // A formal-claim kind (profile `paper`) carries a .lean sibling, so its
    // adapter must offer the role, whichever adapter holds it.
    for (const n of BLOCK_KIND_NODES.filter((x) => x.profile === "paper")) {
      expect(ADAPTER_COMPANION_ROLES[n.adapter]).toContain("lean");
    }
  });

  test("every block-kind node names a vocabulary that has a node", () => {
    const names = new Set(CONTENT_ADAPTER_NODES.map((n) => n.adapter));
    for (const k of discoverBlockKinds()) expect(names.has(k.adapter)).toBe(true);
  });

  test("a node is never mistaken for an instance declaration", () => {
    // `paper.json` carrying `name: "paper"` read as a declaration, made
    // `content-adapters/` a layer, and hid core from sci's needs. The
    // field is `adapter` so the two shapes cannot coincide.
    for (const n of CONTENT_ADAPTER_NODES) expect("name" in n).toBe(false);
  });

  test("a vocabulary declared twice throws; finding no typed one does not", () => {
    const tmp = mkdtempSync(join(tmpdir(), "content-adapters-"));
    const inst = (name: string, nodes: Record<string, unknown>) => {
      mkdirSync(join(tmp, name, "content-adapters"), { recursive: true });
      writeFileSync(
        join(tmp, name, `${name}.json`),
        JSON.stringify({ name, directories: [{ id: `${name}-ca`, path: "content-adapters/", graphTypologies: ["content-adapters"] }] }),
      );
      for (const [f, n] of Object.entries(nodes)) writeFileSync(join(tmp, name, "content-adapters", f), JSON.stringify(n));
    };
    const node = (adapter: string, typed: boolean) => ({ $schema: "folio-content-adapter/v1", adapter, typed, companionRoles: ["md"] });
    inst("a", { "x.json": node("x", false) });
    expect(withoutFixture(() => discoverContentAdapters(tmp)).map((n) => n.adapter)).toEqual(["x"]);
    expect(CONTENT_ADAPTERS.length).toBeGreaterThan(0);
    inst("b", { "x.json": node("x", true) });
    expect(() => withoutFixture(() => discoverContentAdapters(tmp))).toThrow(/declared twice/);
  });
});
