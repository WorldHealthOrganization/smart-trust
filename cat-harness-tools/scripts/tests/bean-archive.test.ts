/**
 * The archive view is declared, terminal-only, and does not leak into the
 * active store's counts. Bean `e8m3`.
 *
 * Three properties, and the third is the one a future change is most likely to
 * break by accident: `defs` and `archive` share the kind `bean-defs`, so any
 * reader that resolves by KIND rather than by id gets whichever comes first.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, expect, test } from "bun:test";

import { nonTerminal, ROOT, TERMINAL } from "../check-bean-archive.js";
import { beanDefsDir, readArchivedBeans, readBeans, resolveBeanArchive } from "../beans.js";

const scratches: string[] = [];
afterAll(() => {
  for (const d of scratches) rmSync(d, { recursive: true, force: true });
});

/** A scratch layer whose bean graph declares `defs` and `archive`. */
function scratch(opts: { archiveStatuses: string[]; declareArchive?: boolean }): string {
  const dir = mkdtempSync(join(tmpdir(), "bean-archive-"));
  scratches.push(dir);
  const defs = join(dir, "beans", "defs");
  const arch = join(defs, "archive");
  mkdirSync(arch, { recursive: true });
  const dirs: unknown[] = [{ id: "defs", path: "defs", graphTypologies: ["bean-defs"] }];
  if (opts.declareArchive !== false) {
    dirs.push({ id: "archive", path: "defs/archive", graphTypologies: ["bean-defs"] });
  }
  writeFileSync(
    join(dir, "beans", "beans.json"),
    JSON.stringify({ name: "scratch", directories: dirs }, null, 2),
  );
  const bean = (id: string, status: string): string =>
    `---\n# ${id}\ntitle: ${id}\nstatus: ${status}\ntype: task\n---\n\nbody\n`;
  writeFileSync(join(defs, "active-one.md"), bean("active-one", "todo"));
  opts.archiveStatuses.forEach((s, i) => writeFileSync(join(arch, `arch-${i}.md`), bean(`arch-${i}`, s)));
  return dir;
}

test("this repository's archive is declared, and resolved by id rather than kind", () => {
  const r = resolveBeanArchive(ROOT);
  expect(r.declared, "`beans/beans.json` declares no `archive` node — bean `e8m3`").toBe(true);
  expect(r.dir).toMatch(/beans\/defs\/archive$/);
  // The property that matters: the archive is NOT the active store. Resolving
  // by kind would return `defs` (declared first) and this would be equal.
  expect(
    r.dir,
    "the archive resolved to the ACTIVE store, which is what asking `nodeOfKind` " +
      "for `bean-defs` does now that two nodes share that kind — and it reports " +
      "the archive as clean while measuring something else entirely",
  ).not.toBe(beanDefsDir(ROOT));
});

test("the active store's count does not include the archive", () => {
  // The whole reason the archive is a separate reader. If `readBeans` ever
  // recursed, every open-bean count would silently absorb 631 terminal beans.
  const s = scratch({ archiveStatuses: ["completed", "scrapped", "completed"] });
  expect(readBeans(s)?.map((b) => b.id)).toEqual(["active-one"]);
  expect(readArchivedBeans(s)?.length).toBe(3);
});

test("a non-terminal archived bean is a finding", () => {
  const s = scratch({ archiveStatuses: ["completed", "in-progress", "todo"] });
  const found = nonTerminal(readArchivedBeans(s)!);
  expect(found.map((f) => f.status).sort()).toEqual(["in-progress", "todo"]);
});

test("...and an all-terminal archive is clean — the anti-vacuity half", () => {
  // Without this, a `nonTerminal` that returned everything, or a reader that
  // returned nothing, would pass the test above.
  const s = scratch({ archiveStatuses: ["completed", "scrapped"] });
  const beans = readArchivedBeans(s)!;
  expect(beans.length, "the sweep saw nothing, so it cleared nothing").toBe(2);
  expect(nonTerminal(beans)).toEqual([]);
});

test("an undeclared archive resolves to nothing rather than guessing the path", () => {
  // The defect this check was written for: the directory existed and held 631
  // beans while the graph named it nowhere. A resolver that fell back to a
  // plausible `defs/archive` would have hidden that forever.
  const s = scratch({ archiveStatuses: ["completed"], declareArchive: false });
  const r = resolveBeanArchive(s);
  expect(r.declared).toBe(false);
  expect(r.dir).toBeNull();
  expect(readArchivedBeans(s)).toBeNull();
});

test("`completed` and `scrapped` are the terminal set, and `draft` is not", () => {
  // `beans` stores five statuses and can hold no sixth, which is why the owner
  // chose VIEW over a new terminal state. `draft` is pre-work, not post-work.
  expect([...TERMINAL].sort()).toEqual(["completed", "scrapped"]);
  for (const open of ["todo", "in-progress", "draft"]) expect(TERMINAL.has(open)).toBe(false);
});
