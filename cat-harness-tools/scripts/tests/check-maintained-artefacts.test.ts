/**
 * The `maintains` presence check, and its third state.
 *
 * @module scripts/tests/check-maintained-artefacts
 *
 * Bean `6f1x`. `kg:schema:check` only reconciles artefacts whose declaring Tool
 * invokes the schema exporter, so every other claim was unchecked and could rot
 * to a 404. This asks the question where the answer exists — after `_site/` is
 * assembled — and the tests below pin the part most likely to be softened later:
 * **an unbuilt tree clears nothing.**
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { checkMaintainedArtefacts } from "../check-maintained-artefacts.js";

describe("checkMaintainedArtefacts", () => {
  test("there are claims to check — a green run over zero rows is not coverage", () => {
    const dir = mkdtempSync(join(tmpdir(), "artefacts-empty-"));
    try {
      const checks = checkMaintainedArtefacts(dir);
      expect(checks.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("an empty tree reports every claim absent, never present", () => {
    // The failure mode this guards: a check that finds nothing and says nothing.
    const dir = mkdtempSync(join(tmpdir(), "artefacts-bare-"));
    try {
      const checks = checkMaintainedArtefacts(dir);
      expect(checks.every((c) => !c.present)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a claim is present only when the path is a FILE", () => {
    // A directory at the artefact's path serves an index or a 404 depending on
    // the host, so it is not the document a consumer dereferences. Passing on it
    // would be passing on a coincidence of the filesystem.
    const dir = mkdtempSync(join(tmpdir(), "artefacts-dir-"));
    try {
      const first = checkMaintainedArtefacts(dir)[0]!;
      mkdirSync(join(dir, first.artefact), { recursive: true });
      const asDir = checkMaintainedArtefacts(dir).find((c) => c.artefact === first.artefact)!;
      expect(asDir.present).toBe(false);

      rmSync(join(dir, first.artefact), { recursive: true, force: true });
      mkdirSync(dirname(join(dir, first.artefact)), { recursive: true });
      writeFileSync(join(dir, first.artefact), "x");
      const asFile = checkMaintainedArtefacts(dir).find((c) => c.artefact === first.artefact)!;
      expect(asFile.present).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a fully populated tree passes every claim", () => {
    const dir = mkdtempSync(join(tmpdir(), "artefacts-full-"));
    try {
      for (const c of checkMaintainedArtefacts(dir)) {
        const p = join(dir, c.artefact);
        mkdirSync(dirname(p), { recursive: true });
        writeFileSync(p, "x");
      }
      expect(checkMaintainedArtefacts(dir).every((c) => c.present)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("every claim names a source module and a relative artefact path", () => {
    // `maintains.artefact` is relative to the layer base; a leading slash
    // would name the domain root and resolve outside the published tree.
    const dir = mkdtempSync(join(tmpdir(), "artefacts-shape-"));
    try {
      for (const c of checkMaintainedArtefacts(dir)) {
        expect(c.source.length, `${c.artefact} names no source`).toBeGreaterThan(0);
        expect(c.artefact.startsWith("/"), `${c.artefact} is absolute`).toBe(false);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
