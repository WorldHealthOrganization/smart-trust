/**
 * Library entries FLAT OR FILED IN A CONCERN GROUP — bean `6fez`, placement
 * ruling 3 (2026-09-30, option A): sources are filed at
 * `library/<group>/<slug>/`, and a new upload lands unfiled at
 * `library/<slug>/`, so a library holds both layouts at once, for good.
 *
 * The readers walk one enumerator (`libraryEntryDirs`) and resolve a slug
 * through one resolver (`libraryEntryDir`), so a group is never read as an
 * entry and a filed entry is never missed. A group is told from an entry by
 * `library/library.json` (`concern-groups/v1`), never by its name.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { libraryEntryDir, libraryEntryDirs, libraryOfEntry } from "../../lib/library-entry-graphs.ts";
import { resolveEvidence } from "../../check-methodology-evidence.ts";
import { unitsOf } from "../../lsi.ts";
import { clearGroupCache } from "../../concern-groups.ts";
import { writeDeclaration } from "../../../test/support/instance-fixture.js";
import { withheldEntryFor } from "../../lib/withheld.ts";
import { runRung } from "../../text-structure.ts";

const roots: string[] = [];
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
  clearGroupCache();
});

const SECTION_TEXT =
  "Latent semantic indexing projects a term document matrix onto a small number of dimensions so that " +
  "documents sharing vocabulary sit close together, which a retrieval system then ranks by cosine.";

/** An instance whose library holds `flat` unfiled and `filed` (group → slugs) in groups it declares. */
function fixture(flat: string[], filed: Record<string, string[]>, declare = true): { root: string; lib: string } {
  // Nested in a workspace of its own: a checkout walk from the instance then
  // sees this fixture, not every other test's leftovers in the temp directory.
  const ws = mkdtempSync(join(tmpdir(), "lib-grouped-"));
  roots.push(ws);
  const root = join(ws, "fixture");
  mkdirSync(root);
  writeDeclaration(root, {
    name: "fixture",
    directories: [{ id: "library", path: "library/", graphTypologies: ["library"] }],
  });
  const lib = join(root, "library");
  const entry = (dir: string): void => {
    mkdirSync(join(dir, "sections"), { recursive: true });
    writeFileSync(join(dir, "sections", "sec-000.md"), `${SECTION_TEXT}\n`);
  };
  mkdirSync(lib, { recursive: true });
  writeFileSync(join(lib, "README.md"), "# library\n");
  for (const s of flat) entry(join(lib, s));
  for (const [g, slugs] of Object.entries(filed)) for (const s of slugs) entry(join(lib, g, s));
  if (declare && Object.keys(filed).length > 0) {
    writeFileSync(join(lib, "library.json"), JSON.stringify({ $schema: "concern-groups/v1", groups: Object.keys(filed).sort() }));
  }
  return { root, lib };
}

describe("libraryEntryDirs", () => {
  test("a flat library lists exactly its subdirectories, sorted as readdirSync().sort() sorts them", () => {
    const { lib } = fixture(["b-doc", "a-doc", "C-doc"], {});
    const got = libraryEntryDirs(lib);
    expect(got.map((e) => e.slug)).toEqual(["C-doc", "a-doc", "b-doc"]);
    expect(got.every((e) => e.group === undefined && e.rel === e.slug && e.dir === join(lib, e.slug))).toBe(true);
  });

  test("a mixed library lists unfiled and filed entries, and never a group as an entry", () => {
    const { lib } = fixture(["unfiled-doc"], { kg: ["deerwester-lsa", "landauer-lsa"], sdlc: ["beans-readme"] });
    const got = libraryEntryDirs(lib);
    expect(got.map((e) => e.rel)).toEqual(["sdlc/beans-readme", "kg/deerwester-lsa", "kg/landauer-lsa", "unfiled-doc"]);
    expect(got.find((e) => e.slug === "deerwester-lsa")).toEqual({
      slug: "deerwester-lsa",
      dir: join(lib, "kg", "deerwester-lsa"),
      rel: "kg/deerwester-lsa",
      group: "kg",
    });
    expect(got.some((e) => e.slug === "kg" || e.slug === "sdlc")).toBe(false);
  });

  test("an UNDECLARED directory is an entry even when its name is a group code — location is declared, not guessed", () => {
    const { lib } = fixture(["ui"], { kg: ["x"] });
    const got = libraryEntryDirs(lib);
    expect(got.map((e) => e.rel)).toEqual(["ui", "kg/x"]);
    expect(got.find((e) => e.slug === "ui")?.group).toBeUndefined();
  });

  test("an absent library lists nothing", () => {
    expect(libraryEntryDirs(join(tmpdir(), "no-such-library-6fez"))).toEqual([]);
  });
});

describe("libraryEntryDir and libraryOfEntry", () => {
  test("a slug resolves wherever it is filed, and an absent one to undefined", () => {
    const { lib } = fixture(["unfiled-doc"], { kg: ["deerwester-lsa"] });
    expect(libraryEntryDir(lib, "unfiled-doc")).toBe(join(lib, "unfiled-doc"));
    expect(libraryEntryDir(lib, "deerwester-lsa")).toBe(join(lib, "kg", "deerwester-lsa"));
    expect(libraryEntryDir(lib, "missing")).toBeUndefined();
    // A group is not an entry, and a path is not a slug.
    expect(libraryEntryDir(lib, "kg")).toBeUndefined();
    expect(libraryEntryDir(lib, "kg/deerwester-lsa")).toBeUndefined();
  });

  test("the library of an entry is its parent, or its grandparent past a group", () => {
    const { lib } = fixture(["unfiled-doc"], { kg: ["deerwester-lsa"] });
    expect(libraryOfEntry(join(lib, "unfiled-doc"))).toBe(lib);
    expect(libraryOfEntry(join(lib, "kg", "deerwester-lsa"))).toBe(lib);
  });
});

describe("readers over a grouped library", () => {
  test("`library/<bib-slug>` evidence resolves to a filed entry without rewriting the reference", () => {
    const { root, lib } = fixture(["unfiled-doc"], { kg: ["deerwester-lsa"] });
    expect(resolveEvidence(root, "library/deerwester-lsa")).toBe(join(lib, "kg", "deerwester-lsa"));
    expect(resolveEvidence(root, "library/deerwester-lsa/sections")).toBe(join(lib, "kg", "deerwester-lsa", "sections"));
    expect(resolveEvidence(root, "library/unfiled-doc")).toBe(join(lib, "unfiled-doc"));
    expect(resolveEvidence(root, "library/kg")).toBeUndefined();
  });

  test("LSI indexes the sections of filed and unfiled entries alike, and nothing of a group itself", () => {
    const { lib } = fixture(["unfiled-doc"], { kg: ["deerwester-lsa"] });
    const ids = unitsOf(lib, ["library"]).map((u) => u.id.split("/").slice(-3).join("/"));
    expect(ids.sort()).toEqual(["deerwester-lsa/sections/sec-000.md", "unfiled-doc/sections/sec-000.md"]);
    // A named doc is found in its group.
    expect(unitsOf(lib, ["library"], ["deerwester-lsa"]).length).toBe(1);
  });
});

describe("writers and lists over a grouped library", () => {
  test("a filed entry is withheld by the library root's list, not the group directory's", () => {
    const { lib } = fixture(["unfiled-doc"], { kg: ["deerwester-lsa"] });
    writeFileSync(
      join(lib, "withheld.json"),
      JSON.stringify({ $schema: "folio-withheld/v1", paths: [{ path: "deerwester-lsa", reason: "licence not cleared" }] }),
    );
    expect(withheldEntryFor(join(lib, "kg", "deerwester-lsa"))?.reason).toBe("licence not cleared");
    expect(withheldEntryFor(join(lib, "unfiled-doc"))).toBeUndefined();
  });

  test("re-ingesting a filed entry writes it where it is filed, and a new one lands unfiled", () => {
    const { lib, root } = fixture([], { kg: ["deerwester-lsa"] });
    const src = join(root, "notes.md");
    writeFileSync(src, "# Notes\n\nSome text.\n");
    runRung([src], [], lib, "deerwester-lsa", root);
    expect(existsSync(join(lib, "deerwester-lsa"))).toBe(false);
    expect(existsSync(join(lib, "kg", "deerwester-lsa", "structure.json"))).toBe(true);
    runRung([src], [], lib, "new-upload", root);
    expect(existsSync(join(lib, "new-upload", "structure.json"))).toBe(true);
  });
});
