/**
 * A Tool's own IRI sits beside its instance document (bean `tdir`).
 *
 * @module schemas/tool-folders.test
 */
import { describe, expect, test } from "bun:test";

import { toolDocumentPath, toolIri } from "./tool-folders.js";

describe("toolIri", () => {
  test("the host's document: tools/ at the base", () => {
    expect(toolIri("https://x.test/fa/cat-harness.jsonld", "beans-cli")).toBe("https://x.test/fa/tools/beans-cli.jsonld");
  });

  test("a foreign instance's document: tools/ inside its own segment", () => {
    expect(toolIri("https://x.test/fa/smart-base/smart-base.jsonld", "extract-dak")).toBe(
      "https://x.test/fa/smart-base/tools/extract-dak.jsonld",
    );
  });

  test("a fragment on the document IRI is not part of the directory", () => {
    expect(toolIri("https://x.test/fa/cat-harness.jsonld#tool/old", "a")).toBe("https://x.test/fa/tools/a.jsonld");
  });

  test("no base: document-relative, never rooted at /", () => {
    expect(toolIri("cat-harness.jsonld", "a")).toBe("tools/a.jsonld");
    expect(toolDocumentPath("a")).toBe("tools/a.jsonld");
  });
});
