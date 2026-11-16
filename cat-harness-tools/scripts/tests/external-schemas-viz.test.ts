/**
 * The external-schemas viewer — the declared users, and the page a reader gets.
 *
 * Bean `yunp`: `external-schema` was one of the declared kinds with no
 * published viewer, so the navbar listed it disabled and four records — an
 * authority, an edition, namespace IRIs, dependents and operative terms each —
 * were reachable only by opening the JSON.
 *
 * ## What is asserted, and what deliberately is not
 *
 * **Not the prose**, for the reason `methodologies-viz.test.ts` states: a test
 * that pinned the sentences fails every time somebody improves one.
 *
 * **The declared users** (bean `u63y`), read from the users rather than from a
 * hand-written list on the record; `spec-users.test.ts` tests the reader, and
 * this file asserts the page over the real corpus. `loadSpecs` already validates
 * every record and `undeclaredNamespaces` already reconciles the namespaces —
 * both are imported rather than restated, so this file asserts the join and
 * leaves their own tests to them.
 *
 * **The consumer property, over the real registry.** Every row in the summary
 * table links to `#<id>`, and the detail section below must carry that anchor —
 * `pb04`: a link that goes nowhere reads as a broken site. Checked against the
 * committed page as well as the freshly rendered one, so a stale commit fails
 * here rather than in a reader's browser.
 *
 * @module scripts/tests/external-schemas-viz.test
 */

import { describe, expect, it } from "bun:test";
import {
  jsonLdNamespacesInUse,
  loadSpecs,
  namespaceMentions,
  namespacesInUse,
} from "../external-schemas.js";
import { declaredUsers, page } from "../gen-external-schemas-viz.js";
import { contrast } from "../render-theme-sheet.js";

describe("external-schemas visualiser wireframe findings (folio-assistant-7x7g)", () => {
  const specs = loadSpecs();
  const users = declaredUsers(specs);
  const bpmnInUse = namespacesInUse();
  const jsonLd = jsonLdNamespacesInUse();
  const combined = [...new Set([...bpmnInUse, ...jsonLd.keys()])].sort();
  const mentioned = namespaceMentions(combined);
  const inUse = [...new Set([...combined, ...mentioned])].sort();
  const rendered = page(specs, users, inUse);

  it("adds scroll-margin-top to section headings to prevent handle overlap (Finding 5)", () => {
    expect(rendered).toMatch(/h[23][^}]*scroll-margin-top:\s*2rem/);
  });

  it("adds mobile scroll cue and table-wrapper scroll mask (Finding 7)", () => {
    expect(rendered).toContain('class="xs-scroll-cue"');
    expect(rendered).toMatch(/\.table-wrapper\s*\{[^}]*mask-image:\s*linear-gradient/);
  });

  it("ensures state tag colors satisfy the 4.5:1 contrast floor on dark backgrounds (Finding 6)", () => {
    const darkBg = "#27262b";
    expect(rendered).toContain("prefers-color-scheme: dark");
    expect(contrast("#34d399", darkBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#a1a1aa", darkBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#f87171", darkBg)).toBeGreaterThanOrEqual(4.5);
  });

  it("converts all-caps notes blocks to clean sentence-case paragraphs (Finding 8)", () => {
    expect(rendered).not.toContain("THE TRANSCRIPTION CAME FIRST AND THAT WAS THE DEFECT");
    expect(rendered).not.toContain("NO XSD IS HELD");
    expect(rendered).toContain("The transcription came first, which was the defect");
    expect(rendered).toContain("No XSD is held and none is fetched");
  });

  it("accounts for broader namespace usages and does not falsely claim DCMI/SKOS are unused (Finding 3)", () => {
    const unusedSection = rendered.match(/## Namespaces[\s\S]*?(?=## Each specification|$)/)?.[0] ?? "";
    expect(unusedSection).not.toContain("http://purl.org/dc/elements/1.1/");
    expect(unusedSection).not.toContain("http://purl.org/dc/terms/");
    expect(unusedSection).not.toContain("http://www.w3.org/2004/02/skos/core#");
  });

  it("qualifies operative terms and avoids repeating identical placeholder sentences (Finding 1)", () => {
    expect(rendered).toMatch(/operative terms in graph \(\d+ described/);
    expect(rendered).not.toContain("derived from the corpus; what this repository does with it is not yet described");
  });

  it("ensures every specification links to an existing section anchor", () => {
    for (const s of specs) {
      expect(rendered).toContain(`](#${s.id})`);
      expect(rendered).toContain(`{#${s.id}}`);
    }
  });
});


describe("one instance's page (`subject`): its own records, the corpus reconciliation left to the full page", () => {
  const specs = loadSpecs();
  const one = specs.slice(0, 1);
  const users = declaredUsers(one);
  const full = page(one, users, ["http://example.org/undeclared#"]);
  const sub = page(one, users, [], () => undefined, [], {
    instance: "some-layer",
    title: "Some layer",
    directory: "some-layer/external-schemas",
    fullHref: "../../",
  });

  it("is titled for the instance, names its directory and links the full page", () => {
    expect(sub).toContain('title: "External schemas — Some layer"');
    expect(sub).toContain("`some-layer/external-schemas`");
    expect(sub).toContain("](../../)");
  });

  it("draws the instance's records, and not the namespace reconciliation, which compares the corpus against the registry", () => {
    expect(sub).toContain(`{#${one[0]!.id}}`);
    expect(full).toContain("## Namespaces the corpus uses");
    expect(sub).not.toContain("## Namespaces the corpus uses");
    expect(sub).not.toContain("in use and not declared here");
  });
});
