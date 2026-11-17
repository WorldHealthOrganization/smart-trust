/**
 * The viewer Tools' `renders` declarations, grounded against the HARNESS
 * declarations (owner, 2026-10-09: *"Need harness to declare visualizer is
 * renderedBy"*).
 *
 * A Tool's `renders` is what it CAN draw; a harness's `visualisers` say what
 * it DOES, each `renderedBy` one Tool. So the two are checked against each
 * other: every visualiser names a Tool that exists, every Tool a visualiser
 * names renders something, and every rendered kind is declared somewhere.
 * `check:visualiser-routes` is the gate over the same facts; this pins them in
 * the test set the checkout runs.
 *
 * Moved here from `cat-harness/scripts/tests/viewer-tools.test.ts` to the
 * checkout's own test home `test/` (bean `7zz1`): it reads every layer's
 * declaration, which only the whole checkout holds.
 */
import { describe, expect, it } from "bun:test";
import { join, resolve } from "node:path";
import { layerRootsIn, instanceDirectories, isPublishedGraphTypology } from "../../schemas/kg/cat-harness.ts";
// Every layer's Tools: a viewer Tool may live in a dependency's `tools`
// graph (fhir-harness's `ig-pages`).
import { tools } from "../../tools/discover.js";
import { declaredVisualisers } from "../../scripts/viewer-declarations.js";

/** The directory this test was written in (`cat-harness/scripts/tests/`). */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const REPO = resolve(ORIGIN_DIR, "..", "..", "..");

interface Dir { id: string; graphTypologies?: string[] }

const dirs: { instance: string; dir: Dir }[] = [];
// Own entries AND those declared from within (bean `cmsl`).
for (const root of layerRootsIn(REPO)) {
  for (const dir of instanceDirectories(root)) dirs.push({ instance: root, dir });
}

const all = tools();
const renderers = all.filter((t) => (t.renders ?? []).length > 0);
const rendered = new Set(renderers.flatMap((t) => t.renders ?? []));
const visualisers = declaredVisualisers(REPO);

describe("viewer Tools declare what they render", () => {
  it("there are viewer Tools, and declared visualisers, at all", () => {
    expect(renderers.length).toBeGreaterThan(0);
    expect(visualisers.length).toBeGreaterThan(0);
  });

  it("every declared visualiser is renderedBy a Tool that exists", () => {
    const ids = new Set(all.map((t) => t.id));
    expect(visualisers.filter((v) => !ids.has(v.renderedBy)).map((v) => `${v.harness}/${v.id} → ${v.renderedBy}`)).toEqual([]);
  });

  /**
   * Kinds a Tool here renders whose only holders are layers this index does
   * not mount — each with the layer that holds it. Listed rather than
   * waived: an entry whose kind starts being declared in the checkout fails
   * below, so the list can only shrink to what is still true.
   */
  const HELD_OUTSIDE: Record<string, string> = {
    // Owner, 2026-10-09: the `archimate` subgraph of cat-harness, whose first
    // layer is smart-ra's DPI-H reference architecture models.
    archimate: "litlfred/smart-ra",
    // Owner, 2026-11-05, option A: journeys-viewer draws the journeys and
    // workshops of litlfred/smart-trust-demo and litlfred/smart-ips-pilgrimage,
    // neither of which this index mounts.
    "user-scenario": "litlfred/smart-trust-demo",
    workshop: "litlfred/smart-trust-demo",
    // Owner, 2026-11-06, option A: journeys-viewer draws the device screens of
    // the same two layers.
    "device-screen": "litlfred/smart-trust-demo",
  };

  /**
   * TRANSITIONAL (remove once folio-assistant main pins smart-trust-phw at or
   * past 0ac4693): a kind that WAS held outside and is arriving in this index.
   * Owner, 2026-11-01, Q-SUBG-6 A: `business-processes` is a display sub-graph
   * of `processes` for a DAK's business processes, which processes-viewer
   * renders (cat-harness 4fb8e9c). smart-trust-phw now declares it
   * (`input/business-processes/`), and this layer is tested against both the
   * index's main and its re-pin train, which pin smart-trust-phw on either
   * side of that. So each entry is checked as exactly one of the two states,
   * never waived: still rendered, and declared by NO layer or by the named
   * one only.
   */
  const ARRIVING: Record<string, string> = {
    "business-processes": "smart-trust-phw",
  };

  it("every rendered kind is declared by some directory", () => {
    const declared = new Set(dirs.flatMap(({ dir }) => dir.graphTypologies ?? []));
    expect([...rendered].filter((k) => !declared.has(k) && !(k in HELD_OUTSIDE) && !(k in ARRIVING))).toEqual([]);
  });

  it("a kind arriving in this index is still rendered, and declared by no instance but the one it arrives in", () => {
    for (const [k, by] of Object.entries(ARRIVING)) {
      expect(k in HELD_OUTSIDE, `${k} is both arriving and held outside`).toBe(false);
      expect(rendered.has(k), `${k} is no longer rendered by any Tool — drop it from ARRIVING`).toBe(true);
      const holders = [...new Set(dirs.filter(({ dir }) => (dir.graphTypologies ?? []).includes(k)).map(({ instance }) => instance.split("/").pop()))];
      expect(holders.filter((h) => h !== by), `${k} is declared outside ${by}`).toEqual([]);
    }
  });

  /**
   * TRANSITIONAL (remove once the cat-harness PR that adds `device-screen` to
   * journeys-viewer's `renders` is on cat-harness main): this layer draws the
   * kind and merges first, and the Tool that renders it is defined in
   * cat-harness, after. Until then the named Tool exists and does not render
   * it yet; that is checked as exactly that, never waived. Once it renders it,
   * the ordinary check holds it.
   */
  const NOT_YET_IN_THE_TOOLS_RENDERS: Record<string, string> = {
    "device-screen": "journeys-viewer",
  };

  /**
   * Kinds held outside AND by a layer some checkouts mount: smart-trust
   * declares an `archimate` directory since smart-trust#206 (2026-11-12),
   * while smart-ra still holds the DPI-H models. A checkout without
   * smart-trust (this layer's own) still needs the HELD_OUTSIDE entry, so
   * here the kind may be declared; the holder named is the one that may.
   */
  const ALSO_HELD_BY: Record<string, string> = {
    archimate: "smart-trust",
  };

  it("every kind listed as held outside is still rendered here and still not held here", () => {
    const declared = new Set(dirs.flatMap(({ dir }) => dir.graphTypologies ?? []));
    const ids = new Set(all.map((t) => t.id));
    for (const k of Object.keys(HELD_OUTSIDE)) {
      const toCome = NOT_YET_IN_THE_TOOLS_RENDERS[k];
      if (toCome !== undefined && !rendered.has(k)) {
        // The Tool that will render it is defined; it does not list the kind yet.
        expect(ids.has(toCome), `${k} is to be rendered by ${toCome}, which does not exist`).toBe(true);
        expect(declared.has(k), `${k} is declared in this checkout now — drop it from HELD_OUTSIDE`).toBe(false);
        continue;
      }
      expect(rendered.has(k), `${k} is no longer rendered by any Tool — drop it from HELD_OUTSIDE`).toBe(true);
      const also = ALSO_HELD_BY[k];
      if (also !== undefined) {
        const holders = [...new Set(dirs.filter(({ dir }) => (dir.graphTypologies ?? []).includes(k)).map(({ instance }) => instance.split("/").pop()))];
        expect(holders.filter((h) => h !== also), `${k} is declared outside ${also}`).toEqual([]);
        continue;
      }
      expect(declared.has(k), `${k} is declared in this checkout now — drop it from HELD_OUTSIDE`).toBe(false);
    }
  });

  it("no Tool renders an unpublished kind — the Tool graph is published", () => {
    expect([...rendered].filter((k) => !isPublishedGraphTypology(k))).toEqual([]);
  });
});
