/**
 * `validatorNotApplicable` — a decision kept apart from a gap.
 *
 * Bean `rj0n`. `check:kind-validators` counted seven kinds as declaring no
 * validator and carried `--require-all` "for the day the gap is meant to be
 * closed". That day could not come: all seven were either not JSON at all
 * (`.bpmn`, `.puml`, `.md`, `.ts`) or had no nodes. So the count read as a
 * seven-item backlog over a real backlog of zero, and the flag could never pass
 * — which is `dh4f` inverted, and the more expensive direction, because a flag
 * that cannot pass is one somebody eventually deletes.
 */
import { describe, expect, test } from "bun:test";

// The whole REGISTRY: since bean dmx1 kinds are declared per harness, and the
// sweep reaches every one of them (riit), not only the code list.
import { defaultGraphTypologies } from "../../schemas/kg/graph-typology-registry.js";
import { sweep } from "../check-kind-validators.js";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { join } from "node:path";
import { layerRootsIn, readDeclaration } from "../../schemas/kg/cat-harness.js";
import { typologyOwner } from "../../schemas/kg/node-kind-index.js";

const INSTANCE = HARNESS_ROOT;

describe("the three states partition the registry", () => {
  test("no kind has stayed silent, and none contradicts itself", async () => {
    const r = await sweep(INSTANCE);
    expect(r.undeclared).toEqual([]);
    expect(r.contradictory).toEqual([]);
    expect(r.notApplicable.length).toBeGreaterThan(0);
  });

  test("every kind lands in exactly ONE state", async () => {
    // A kind counted twice makes the denominator meaningless, which is the
    // defect this whole area keeps producing — most recently `nodesOf` listing
    // every todo item twice (bean `h1wq`).
    const r = await sweep(INSTANCE);
    const named = [
      ...r.resolved.map((k) => k.replace(" (per $schema family)", "")),
      ...r.notApplicable.map((n) => n.kind),
      ...r.undeclared,
      ...r.unresolvable.map((u) => u.kind),
      ...r.contradictory,
      // A kind another layer owns is in that layer's states, not these (bean w1gy).
      ...r.elsewhere.map((e) => e.kind),
    ];
    expect(new Set(named).size).toBe(named.length);
    expect(named.length).toBe(defaultGraphTypologies.names().length);
  });

  test("a kind left to another layer names an owner this checkout does not hold", async () => {
    // So `elsewhere` cannot become the place a kind of THIS checkout hides:
    // only the declaring layer's absence puts a kind there.
    const r = await sweep(INSTANCE);
    const here = new Set(layerRootsIn(join(INSTANCE, "..")).map((root) => readDeclaration(root)?.name));
    for (const e of r.elsewhere) {
      expect(typologyOwner(defaultGraphTypologies, e.kind)).toBe(e.owner);
      expect(here.has(e.owner), `${e.kind} is owned by ${e.owner}, which this checkout holds`).toBe(false);
    }
  });
});

describe("a reason must name a FACT, not a preference", () => {
  test("each cites a file format, an absent subject, or several families", async () => {
    // A boolean would let a kind opt out by asserting it. Checked structurally
    // so `validatorNotApplicable` cannot become the polite way to launder a real
    // gap: "we decided not to" fails this, "`.bpmn` is XML" passes.
    //
    // THREE shapes, and the third was found by this test failing on the reason
    // its own author wrote. The first version accepted a format or an absence,
    // and `cat-harness` cites neither — it holds SEVERAL node families, so no
    // single shape exists to name. That is a fact about the kind's structure and
    // just as checkable as an extension, and refusing it would have pushed the
    // reason toward whichever words the regex happened to want. `vq8g`'s failure
    // exactly: a detector that recognised one form and called the corpus wrong.
    const SHAPES: { name: string; test: RegExp }[] = [
      // An extension, bare (`.bpmn`) or as the glob that names its files (`*.lean`).
      { name: "a file format", test: /`\*?\.[a-z]+`|markdown|TypeScript|XML|PlantUML|Mermaid/ },
      { name: "an absent subject", test: /no instance declares|has no nodes|nothing here to validate/ },
      { name: "several node families", test: /several node kinds|per \$schema family|each family is validated/i },
    ];
    const r = await sweep(INSTANCE);
    for (const n of r.notApplicable) {
      expect(n.reason.length, `${n.kind} has a reason too short to be one`).toBeGreaterThan(40);
      const matched = SHAPES.filter((sh) => sh.test.test(n.reason)).map((sh) => sh.name);
      expect(
        matched.length,
        `${n.kind}: "${n.reason.slice(0, 80)}…" names none of ${SHAPES.map((sh) => sh.name).join(", ")}`,
      ).toBeGreaterThan(0);
    }
  });
});

describe("a kind cannot claim both", () => {
  test("nothing marked not-applicable also declares a schema", async () => {
    // Reported rather than resolved by precedence: picking a winner lets a
    // contradiction ship silently, and there is no reading under which "this
    // parses my nodes" and "nothing can parse my nodes" are both true.
    const r = await sweep(INSTANCE);
    for (const n of r.notApplicable) {
      const def = defaultGraphTypologies.get(n.kind);
      expect(def?.validator, `${n.kind} declares a validator AND that none applies`).toBeUndefined();
      expect(def?.nodeSchemas, `${n.kind} declares nodeSchemas AND that none applies`).toBeUndefined();
    }
  });
});

describe("the clean break (bean riit): validators are nodes, not strings on a kind", () => {
  test("no authored kind carries validator code, except code in another repository", async () => {
    const { authoredValidatorStrings, FOREIGN_REPOSITORY_PREFIXES } = await import("../check-kind-validators.js");
    const inline = authoredValidatorStrings().filter((a) => !FOREIGN_REPOSITORY_PREFIXES.some((p) => a.ref.startsWith(p)));
    expect(inline).toEqual([]);
  });
});
