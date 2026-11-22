/**
 * This layer DECLARES the document adapter, and the harness finds it there.
 *
 * Until 2026-09-30 the harness named this directory itself —
 * `../folio-assistant-core/adapters/document/index.ts` in
 * `src/builtin-adapters.ts` — and its test asserted `layer: "core"`. The
 * dependency is inverted now (bean `p11x`): the declaration lives in
 * `folio-assistant-core.json`, so the assertion that document is THIS
 * layer's lives with it.
 */
import { describe, expect, test } from "bun:test";

import { BUILTIN_ADAPTERS, resolveBuiltinAdapter } from "@litlfred/cat-harness-tools/src/builtin-adapters.ts";
import { DocumentContentAdapter } from "./index.ts";

describe("document adapter declaration", () => {
  test("discoveredFromInstanceDeclaration", () => {
    const doc = BUILTIN_ADAPTERS.find((a) => a.contentType === "document");
    expect(doc).toMatchObject({ instance: "folio-assistant-core", className: "DocumentContentAdapter" });
    expect(doc?.extends).toBeUndefined();
  });

  test("resolvesToExportedClass", async () => {
    const r = await resolveBuiltinAdapter("document");
    expect(r.fallbackReason).toBeUndefined();
    expect(r.ctor).toBe(DocumentContentAdapter as never);
  });
});
