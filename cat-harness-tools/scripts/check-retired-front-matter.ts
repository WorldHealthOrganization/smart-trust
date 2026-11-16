/**
 * A front-matter key that was RETIRED must not come back.
 *
 * The retired keys parsed and validated fine but were read by nothing, so a
 * schema cannot catch them, and copying an adjacent skill's front matter
 * brings them back. The error names the key's retirement **record**, which
 * explains what was tried and what remains open.
 *
 * Adding a retirement is one entry, refused without a record to point at —
 * see {@link RETIRED}.
 *
 * @module scripts/check-retired-front-matter
 * @covers computed — its scan set is `kgRoots(instance)` — whichever kg graphs each layer
 *   declares — plus the `.claude/skills/` convention, which is not a declared graph at all. A
 *   literal list is what `known-skills.ts` was extracted to remove
 */
import { HARNESS_ROOT } from "./lib/roots.ts";
import { readFileSync, existsSync } from "node:fs";
import { resolve, relative, join } from "node:path";

import { Glob } from "bun";

import { parseFrontMatter } from "../schemas/kg/front-matter.ts";
import { checkoutRootFor, repoRootFor, declarationPathIn } from "../schemas/kg/cat-harness.ts";
import { exitUnlessMounted } from "./branch-store.ts";
import { kgRoots } from "./known-skills.ts";
import { corpusDirectoryForGraph } from "../schemas/kg/harness-config.js";

const INSTANCE = HARNESS_ROOT;
const REPO = repoRootFor(INSTANCE);

interface Retired {
  /** The front-matter key that must not reappear. */
  key: string;
  /** Where the files carrying it lived, for the message. */
  scope: string;
  /**
   * `$schema` tags this retirement does NOT apply to.
   *
   * A key is retired **for a graph typology**, not for the word. `roles:` was
   * inert in skill markdown and is a LIVE axis in `folio-memory/v1` entries,
   * where `memoryForRoles` filters on `tags.roles` — the same seven letters,
   * a different field, a real reader.
   *
   * This exemption is not a caveat added for tidiness. The first pass of
   * `qif9` excised the key from all 140 files carrying it, the 26 memory
   * entries included, and `agent-memory.test.ts` caught it: the CI lane
   * stopped seeing more entries than another lane, because every entry had
   * become untagged and therefore visible to everyone. Sharing a key name
   * across graph typologies is not sharing a field.
   */
  exceptSchemas?: string[];
  /**
   * The fsh-guts record holding the full inventory, relative to the
   * `fsh-guts` directory the layer DECLARES.
   *
   * Relative rather than repo-relative because `fsh-guts/` is declared, not
   * conventional: `directoryForGraph(…, "fsh-guts")` is what resolves it,
   * and writing the prefix here would be a second answer to where the
   * trashcan is — free to disagree with the declaration the moment it moves.
   *
   * REQUIRED, and checked to exist on every run. A retirement whose record
   * has gone is a rule with no reasons — exactly the state that makes the
   * next agent re-add the field, since all they can see is a refusal.
   */
  record: string;
  /** One line on why, so the message stands without opening the record. */
  because: string;
}

/** Every retired key. One entry per retirement; none may be added without a record. */
export const RETIRED: Retired[] = [
  {
    key: "roles",
    scope: "skill and memory markdown",
    record: "retired/skill-roles-front-matter.md",
    exceptSchemas: ["folio-memory/v1"],
    because:
      "325 annotations across 140 files, read by nothing (0 of 180 Skill nodes in the " +
      "exported graph carried it) and dangling from its first commit — it pointed at " +
      "actor ids `reader`/`collaborator`/`owner` that have never existed in any commit. " +
      "If a skill should declare who performs it, that is bean `y1w9`, and the field it " +
      "needs has to be declared before it is written. NOTE the exemption: in a " +
      "`folio-memory/v1` entry `roles:` is a live axis, not this field.",
  },
  {
    key: "package",
    scope: "skill markdown",
    record: "retired/skill-package-front-matter.md",
    because:
      "18 annotations, read by nothing, and each equal to the directory the file sits in — " +
      "package membership is the directory and the package manifest, and " +
      "`skill:register:check` already holds those two to agreement (#1168 B8).",
  },
  {
    key: "capability",
    scope: "skill markdown",
    record: "retired/skill-capability-front-matter.md",
    because:
      "19 topic tags, read by nothing, and none of the seven values a Capability id — so " +
      "renaming it `requiresCapability` would have been false. A skill's placement is the " +
      "roles that carry it (`Role.skills`) and its package; a real Capability goes in the " +
      "package's `requiresCapabilities` (#1168 B9d).",
  },
];

/**
 * Where to sweep — EVERY directory the layer declares, plus two
 * conventions. Never a list written here.
 *
 * A hand-kept list is the failure `known-skills.ts` was extracted to remove:
 * its own header calls such a list "a copy that happens to match today", and
 * the copy it replaced had already stopped matching. A sweep blind to a
 * directory reports a clean run over files it never opened, which is worse
 * than not running at all.
 *
 * **Every declared directory, not a chosen few graph typologies.** Two earlier
 * versions of this function each went blind within a day:
 *
 * - `skillMdDirs` enumerates skill PACKAGES, and `skills/memory/` was not
 *   one — the sweep never opened the 26 entries the `roles` exemption
 *   exists for.
 * - Naming `beans` and `fsh-guts` by hand missed `memory` when it moved to
 *   the repository root as its own declared graph, hours later. The test
 *   asserting the exemption is non-vacuous is what caught it.
 *
 * Naming kinds is the same copy one level up. Sweeping everything declared
 * costs a directory walk over trees that hold no front matter and cannot go
 * blind when a graph is added.
 *
 * **Read RAW, not through `readDeclaration`.** That loader throws on a graph
 * kind no registry has seen yet — kinds are contributed at runtime, so which
 * are known depends on what has been imported. A check that refuses to run
 * because a kind it does not care about is unregistered is a check that goes
 * silent for an unrelated reason.
 *
 * `scope: "repository"` is honoured through `rootForScope`, or `fsh-guts/`,
 * `beans/` and `memory/` resolve inside the layer and find nothing.
 */
function sweepRoots(instance: string, repo: string): string[] {
  const dirs: string[] = [];
  const declaration = declarationPathIn(instance)!;
  if (existsSync(declaration)) {
    const decl = JSON.parse(readFileSync(declaration, "utf-8")) as {
      directories?: { path?: string; scope?: "repository" | "instance" }[];
    };
    for (const d of decl.directories ?? []) {
      if (typeof d.path !== "string") continue;
      // `repo` AS GIVEN, not recomputed. `rootForScope` derives the
      // repository root from the layer, which is right in production and
      // wrong for any caller that passes one — `scan(root, root)` in the
      // tests means "this fixture IS its own repository", and recomputing
      // resolved a `scope: "repository"` entry to the tmpdir's PARENT.
      //
      // Measured 2026-09-20: the fixture swept `/tmp/fsh-guts`, a directory
      // an unrelated test left behind on 2026-09-19, and counted its two
      // files. The test passes on a clean runner and fails on a machine that
      // has run the suite before — a failure that is real, order-dependent,
      // and points nowhere near its cause.
      //
      // A parameter a function accepts and then ignores is worse than one it
      // does not take: the caller has said something and been overruled
      // silently.
      dirs.push(resolve(d.scope === "repository" ? repo : instance, d.path));
    }
  } else {
    // No declaration is not a reason to sweep nothing: an unmigrated
    // layer falls back to the conventions, exactly as every other
    // consumer does.
    dirs.push(...kgRoots(instance));
  }
  // The CHECKOUT's root layer too (placement PR0, bean `ejye`): `memory/`,
  // `beans/` and `fsh-guts/` are declared there now that the platform no
  // longer mirrors them with `scope: "repository"`, and a sweep of this
  // layer alone would lose them — the exemption test is what notices.
  const checkoutDecl = resolve(repo) === resolve(instance) ? undefined : declarationPathIn(repo);
  if (checkoutDecl !== undefined && existsSync(checkoutDecl)) {
    const decl = JSON.parse(readFileSync(checkoutDecl, "utf-8")) as { directories?: { path?: string }[] };
    for (const d of decl.directories ?? []) if (typeof d.path === "string") dirs.push(resolve(repo, d.path));
  }
  // `.claude/skills/` is a local convention rather than a declared graph,
  // and since #437 it sits beside the layer rather than inside it.
  // Checking one place would silently skip it.
  for (const base of new Set([instance, repo])) dirs.push(join(base, ".claude", "skills"));
  return [...new Set(dirs)].filter((d) => existsSync(d));
}

/** A finding: one file carrying one retired key. */
export interface Finding {
  file: string;
  entry: Retired;
}

export function scan(
  instance = INSTANCE,
  repo = checkoutRootFor(instance),
): { findings: Finding[]; scanned: number; missingRecords: Retired[]; roots: string[] } {
  const guts = corpusDirectoryForGraph(instance, "fsh-guts");
  // No declared trashcan means the records are UNREACHABLE, not absent. Both
  // report here, because a rule whose reasons cannot be located is in the
  // same state either way from the reader's side.
  const missingRecords = RETIRED.filter(
    (r) => guts === undefined || !existsSync(join(guts, r.record)),
  );
  const findings: Finding[] = [];
  const roots = sweepRoots(instance, repo);
  let scanned = 0;
  for (const dir of roots) {
    for (const rel of new Glob("**/*.md").scanSync(dir)) {
      const abs = resolve(dir, rel);
      // The fsh-guts record QUOTES the field it retires, in prose and in a
      // code fence. Reading only the parsed front matter is what keeps the
      // record from tripping the check it exists to explain.
      const { fm } = parseFrontMatter(readFileSync(abs, "utf-8"));
      scanned += 1;
      const declaredAs = typeof fm.$schema === "string" ? fm.$schema : undefined;
      for (const entry of RETIRED) {
        if (!Object.hasOwn(fm, entry.key)) continue;
        // A file DECLARES what it is; the exemption is matched on that and
        // never on its directory. Location is a coincidence of the current
        // layout — the declaration is the contract (#263).
        if (declaredAs !== undefined && entry.exceptSchemas?.includes(declaredAs)) continue;
        findings.push({ file: relative(repo, abs), entry });
      }
    }
  }
  return { findings, scanned, missingRecords, roots };
}

function main(): void {
  exitUnlessMounted("fsh-guts", "check-retired-front-matter", REPO);
  const { findings, scanned, missingRecords, roots } = scan();

  // A vacuity guard. `scanned === 0` means the declaration resolved to
  // nothing readable, and reporting "no retired keys" over an empty sweep is
  // the could-not-determine-rendered-as-clean failure this repository names
  // as its own.
  if (scanned === 0) {
    console.error(`✗ scanned 0 markdown files across ${roots.length} declared root(s).`);
    console.error("  This is NOT a pass: nothing was checked.");
    process.exit(1);
  }

  for (const r of missingRecords) {
    console.error(`✗ retired key \`${r.key}\` names a record that is not there: ${r.record}`);
    console.error("  A retirement with no record is a refusal with no reasons.");
  }

  for (const f of findings) {
    console.error(`✗ ${f.file}`);
    console.error(`    carries \`${f.entry.key}:\`, retired from ${f.entry.scope}.`);
    console.error(`    ${f.entry.because}`);
    console.error(
      `    The full record, with every value it ever held: ` +
        `${relative(REPO, join(corpusDirectoryForGraph(INSTANCE, "fsh-guts") ?? "", f.entry.record))}`,
    );
  }

  if (findings.length > 0 || missingRecords.length > 0) process.exit(1);
  console.log(
    `✓ ${scanned} markdown file(s) across ${roots.length} declared root(s); none carries a ` +
      `retired front-matter key (${RETIRED.map((r) => `\`${r.key}\``).join(", ")}).`,
  );
}

if (import.meta.main) main();
