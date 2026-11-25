/**
 * Every layer keeps its initialization instructions in the same place.
 *
 * @module scripts/tests/bootstrap-initialization-convention.test
 *
 * CatBootstrap is handed ONE reference and reads everything else. That works only
 * while the place to read is the same for every target — otherwise the agent
 * needs per-instance knowledge of every harness it might be pointed at, which
 * is exactly what one reference was meant to remove.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  CAT_BOOTSTRAP_INIT_DOC,
  initializationDoc,
  readDeclaration,
  repoRootFor,
  siteDir,
} from "../../schemas/kg/cat-harness.js";
import { HARNESS_ROOT } from "../lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);
// `bootstrap/` is the REPOSITORY's — it sits at the top of the checkout, beside
// the layer rather than inside it, because it must be readable before any
// stub is resolved. Arrived from main as `join(ROOT, "bootstrap", …)`, correct
// there because the layer and the repository were one directory; here it
// named `cat-harness/bootstrap/`, which does not exist.
const REPO_ROOT = repoRootFor(ROOT);

describe("the convention is composed, not spelled", () => {
  test("it is built from siteDir rather than a literal", () => {
    // The stub pattern INVERTED on 2026-09-19 — `docs/<stub>` became
    // `<stub>/docs` — and every literal spelling of the old layout had to be
    // found and changed. Composing from the one function that knows the site
    // root survives the next relocation.
    for (const name of ["f-a-sci", "smart-base", "anything-at-all"]) {
      expect(initializationDoc({ name })).toBe(`${siteDir({ name })}/${CAT_BOOTSTRAP_INIT_DOC}`);
    }
  });

  test("it is the SAME suffix for every instance", () => {
    // The property bootstrap depends on: differing only by the layer's own
    // site root, never by which harness it is.
    const suffixes = new Set(
      ["a", "b", "c"].map((n) => initializationDoc({ name: n }).split("/").slice(1).join("/")),
    );
    expect(suffixes.size).toBe(1);
  });

  test("the stub does NOT appear — the suffix is the same for every instance", () => {
    // This asserted `toContain("base/")` when it arrived, which was right while
    // `siteDir` returned `<stub>/docs`. It returns plain `docs` now: the
    // layer has a directory of its own, so repeating the stub inside it
    // would be the redundancy the inversion removed.
    //
    // Inverted rather than deleted, because the property it was reaching for
    // still matters and is now STRONGER — the path is identical for every
    // layer, not merely differing by site root.
    const a = initializationDoc({ name: "smart-base", stub: "base" });
    expect(a).not.toContain("base/");
    expect(a).toBe(initializationDoc({ name: "anything-at-all" }));

    // WHAT THIS DELIBERATELY NO LONGER PROVES, so the gap is not mistaken for
    // a pass: bootstrap needs the layer's DIRECTORY to use this suffix, and
    // nothing here supplies it. Directory and stub are allowed to differ (here
    // `cat-harness/` against stub `folio-assistant`), so composing `<stub>/`
    // would name nothing. See `initializationDoc`'s docstring and bean `wggr`.
  });
});

describe("this instance honours the convention it publishes", () => {
  test("the file is where the convention says", () => {
    // A convention its own author does not follow is not a convention.
    const rel = initializationDoc(readDeclaration(ROOT)!);
    expect(existsSync(join(ROOT, rel))).toBe(true);
  });

  test("and it is DECLARED, so the asset gate checks its links too", () => {
    // Conventional AND declared: the convention means bootstrap can find it
    // without reading a declaration; the declaration means
    // `check:declared-assets` verifies it exists and that its links resolve.
    const decl = readDeclaration(ROOT)!;
    const asset = (decl.assets ?? []).find((a) => a.role === "bootstrap-initialization");
    expect(asset?.src).toBe(initializationDoc(decl));
  });
});

describe("the README tells an agent the same path the code computes", () => {
  test("bootstrap's README states the convention in its fenced block", () => {
    // The two could disagree, and a README that sends an agent to the wrong
    // place is worse than one that says nothing — it will be believed.
    //
    // Asserted against the FENCED BLOCK, not against the file text. The first
    // version of this test was `readme.toContain(path)`, and it passed after
    // the stated convention had been changed to `<name>/docs/setup.md` —
    // because the old path still appeared in a worked example further down.
    // A presence check over prose is satisfied incidentally; this reads the
    // one place the README actually makes the claim.
    const readme = readFileSync(join(REPO_ROOT, "bootstrap", "README.md"), "utf-8");
    // A fence may be indented, as it is inside the README's numbered steps.
    const fenced = [...readme.matchAll(/^[ \t]*```\n([^`]*?)\n[ \t]*```/gm)].map((m) => m[1]!.trim());
    expect(fenced).toContain(`<name>/docs/${CAT_BOOTSTRAP_INIT_DOC}`);
  });

  test("the convention is stated in ONE place, not echoed into the skill", () => {
    // `confirm-harness.md` deliberately does NOT repeat the path. It used to,
    // and this test asserted it did — two copies of a convention are two
    // things to keep in step, and the README is where a Bootstrapping Agent is sent.
    // What the skill owns is the CONTRACT (at most one harness); what the
    // README owns is WHERE that harness keeps its instructions.
    const skill = readFileSync(join(REPO_ROOT, "bootstrap", "skills", "confirm-harness.md"), "utf-8");
    expect(skill).not.toContain(CAT_BOOTSTRAP_INIT_DOC);
  });
});
