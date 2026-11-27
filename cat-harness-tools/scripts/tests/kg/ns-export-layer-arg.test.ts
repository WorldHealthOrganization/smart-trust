/**
 * `--layer`'s verdict and its error message are ONE read of `TERM_LAYERS`.
 *
 * Issue #807. The predicate and the sentence used to be two literals, and they
 * drifted through the `cat-bootstrap` -> `bootstrap` rename: the check still
 * listed `cat-bootstrap` while the message beside it already said `bootstrap`,
 * so refusing `--layer bootstrap` printed
 *
 *     --layer must be bootstrap, harness or core (got bootstrap)
 *
 * a sentence that names the value it has just refused. The rename was the
 * trigger; the DEFECT was that nothing tied the two together, and nothing
 * could have caught it — the branch lived inside `import.meta.main`, reachable
 * only by spawning the script and reading stderr.
 *
 * So these assertions are deliberately about the RELATION between the message
 * and the accepted set, never about the sentence's wording. A test that
 * asserted the string "bootstrap, harness or core" would be a third copy of
 * the list, and would have passed just as happily while the predicate said
 * something else.
 */
import { describe, expect, test } from "bun:test";

import { layerArgError } from "../../ns-export.js";
import { TERM_LAYERS } from "../../../schemas/content/vocabulary.js";

describe("--layer accepts exactly the declared layers", () => {
  test("every declared layer is accepted", () => {
    // Vacuity guard first: an empty tuple would make the loop below pass
    // without testing anything, which is the shape this repo keeps paying for.
    expect(TERM_LAYERS.length).toBeGreaterThan(0);
    for (const layer of TERM_LAYERS) {
      expect(layerArgError(layer), `${layer} is a declared layer`).toBeUndefined();
    }
  });

  test("a value that is not a layer is refused", () => {
    for (const bad of ["cat-bootstrap", "Bootstrap", "bootstrap ", "", "folio"]) {
      expect(layerArgError(bad), `${JSON.stringify(bad)} is not a layer`).toBeDefined();
    }
  });

  test("the rejected value is quoted back", () => {
    // What made #807 unreadable was not knowing WHICH value had been refused
    // against which set. Both halves have to be in the sentence.
    expect(layerArgError("cat-bootstrap")).toContain("cat-bootstrap");
  });
});

describe("the message cannot disagree with the predicate", () => {
  test("it names every accepted layer", () => {
    const msg = layerArgError("not-a-layer")!;
    for (const layer of TERM_LAYERS) {
      expect(msg, `the message offers ${layer}`).toContain(layer);
    }
  });

  test("it offers nothing the predicate would refuse", () => {
    // The direction #807 actually failed in: the sentence advertised
    // `bootstrap` while the check did not accept it. Read the names back OUT
    // of the message and put each one through the predicate.
    const msg = layerArgError("not-a-layer")!;
    const offered = msg
      .slice(msg.indexOf("must be ") + "must be ".length, msg.indexOf(" (got "))
      .split(/,\s*|\s+or\s+/)
      .filter((s) => s.length > 0);
    expect(offered.length).toBe(TERM_LAYERS.length);
    for (const name of offered) {
      expect(layerArgError(name), `the message offers ${name}, so it must be accepted`).toBeUndefined();
    }
  });
});
