/**
 * A library holds flat and filed entries at once (bean `6fez`): the readers
 * list both, and never take a declared group for an entry.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { libraryEntries } from "./library-entries.ts";

const roots: string[] = [];
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

function lib(flat: string[], filed: Record<string, string[]>, declare = true): string {
  const l = mkdtempSync(join(tmpdir(), "core-lib-"));
  roots.push(l);
  for (const s of flat) mkdirSync(join(l, s));
  for (const [g, slugs] of Object.entries(filed)) for (const s of slugs) mkdirSync(join(l, g, s), { recursive: true });
  if (declare) writeFileSync(join(l, "library.json"), JSON.stringify({ $schema: "concern-groups/v1", groups: Object.keys(filed) }));
  return l;
}

describe("libraryEntries", () => {
  test("flatLibrarySorted", () => {
    const l = lib(["b-doc", "a-doc", ".git"], {}, false);
    expect(libraryEntries(l).map((e) => e.slug)).toEqual(["a-doc", "b-doc"]);
  });

  test("filedAndUnfiledTogether", () => {
    const l = lib(["unfiled"], { kg: ["deerwester-lsa"], process: ["mendling-7pmg"] });
    const got = libraryEntries(l);
    expect(got.map((e) => e.slug)).toEqual(["deerwester-lsa", "mendling-7pmg", "unfiled"]);
    expect(got.find((e) => e.slug === "deerwester-lsa")).toEqual({ slug: "deerwester-lsa", dir: join(l, "kg", "deerwester-lsa"), group: "kg" });
  });

  test("undeclaredGroupNameIsEntry", () => {
    const l = lib(["kg"], {}, false);
    expect(libraryEntries(l).map((e) => e.slug)).toEqual(["kg"]);
  });

  test("absentLibraryNothing", () => {
    expect(libraryEntries(join(tmpdir(), "no-such-library-6fez"))).toEqual([]);
  });
});
