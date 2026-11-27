/**
 * `qa-page-standalone.ts` puts the platform's integrated QA panel into a
 * folio's own site. Checked: the remote parsing every forge URL shape agents
 * see, and that the page carries the panel with the declared source.
 */
import { describe, expect, test } from "bun:test";

import { repositoryOf, standaloneQaPage } from "../qa-page-standalone.ts";

describe("repositoryOf", () => {
  test("https, ssh and a proxied remote all give owner/name", () => {
    expect(repositoryOf("https://github.com/example/folio")).toBe("example/folio");
    expect(repositoryOf("https://github.com/example/folio.git")).toBe("example/folio");
    expect(repositoryOf("git@github.com:example/folio.git")).toBe("example/folio");
    expect(repositoryOf("http://127.0.0.1:1234/git/example/folio")).toBe("example/folio");
  });
});

describe("standaloneQaPage", () => {
  const dir = { path: "test/results/", graphTypologies: ["qa"], storage: { branch: "cat/cat-harness/qa-reports" } };
  test("carries the integrated panel, rooted at <name>/<qa path>", () => {
    const html = standaloneQaPage({ name: "folio", repository: "example/folio", ref: "0123456789abcdef", dir })!;
    expect(html).toContain('data-repo="example/folio"');
    expect(html).toContain('data-root="folio/test/results"');
    expect(html).toContain('data-branch="cat/cat-harness/qa-reports"');
  });
  test("no page for a source the panel cannot read", () => {
    expect(standaloneQaPage({ name: "folio", repository: "not a repo", ref: "0123456", dir })).toBeUndefined();
  });
});
