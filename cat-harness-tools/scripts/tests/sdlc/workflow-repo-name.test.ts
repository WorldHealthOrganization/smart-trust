/**
 * A workflow reads this repository's name; it never spells it.
 *
 * Bean `kuxk`. `feature-staging.yml` wrote
 * `baseurl: "/folio-assistant/branches/<slug>"` into the Jekyll config, and
 * Jekyll builds every internal link from `baseurl` — so in any folio whose
 * repository is not named `folio-assistant`, every link on every staging page
 * pointed at a path that does not exist. The build succeeded, the deploy
 * succeeded, and it was wrong only in a browser.
 *
 * It was the **one** outlier in its own file: five other places in it compose
 * the same URL from `github.event.repository.name` or `GITHUB_REPOSITORY` and
 * get it right. This is the genericity family `AGENTS.md` records — the `QOU.`
 * module prefix, `generate-readme.sh`, the `folio-assistant/simulators`
 * literal — each of which was found in `scripts/` or `pipeline/`.
 * **The workflows had never been swept.**
 *
 * ## What is deliberately NOT a finding
 *
 * Most `folio-assistant` strings under `.github/workflows/` are legitimate and
 * a checker that flagged them would be turned off within a week:
 *
 * - **Prose** — `::error::folio-assistant is the PLATFORM and carries no
 *   papers`. A message naming the platform is documentation.
 * - **The submodule directory** — `folio-assistant/computations`,
 *   `working-directory: folio-assistant`. A folio checks the platform out
 *   into a directory of that name; that is a convention about the DEPENDENCY,
 *   not this repository's own name, and it is correct as written.
 * - **Artefact stems** — `folio-assistant.jsonld`. Those come from the stub
 *   and are a separate question (`artefactStub`).
 *
 * So this checks the narrow thing that actually broke: a **Jekyll `baseurl`**
 * carrying a literal path segment instead of an expression. Narrow on purpose
 * — the value of a guard is that its findings are all real.
 *
 * @module scripts/tests/workflow-repo-name.test
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { repoFilesWithExt } from "../../repo-files.js";
import { HARNESS_ROOT } from "../../lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);

/**
 * Workflow files, **including one added in this working tree**.
 *
 * Tracked-only enumeration would let a brand-new workflow hardcode the
 * repository name and pass every local run — see bean `bgle` and
 * {@link repoFilesWithExt}. A new workflow is exactly when this guard is
 * worth having.
 */
function workflowFiles(): string[] {
  return repoFilesWithExt(ROOT, [".github/workflows"], [".yml", ".yaml"]);
}

/** A line that sets Jekyll's `baseurl` to something. */
const BASEURL = /baseurl:\s*\\?["']?(\/[^"'\\\n]*)/;

/** An expression rather than a literal — `${{ … }}` or a shell `${VAR}`/`$VAR`. */
const IS_EXPRESSION = /\$\{\{|\$\{|\$[A-Za-z_]/;

describe("workflows do not spell the repository name", () => {
  test("every Jekyll baseurl is composed, not hardcoded", () => {
    const offenders: string[] = [];

    for (const file of workflowFiles()) {
      readFileSync(resolve(ROOT, file), "utf8")
        .split("\n")
        .forEach((line, i) => {
          // Skip comments — this test's own rationale quotes the bad line, and
          // a guard that fires on the explanation of itself is a nuisance.
          if (/^\s*#/.test(line)) return;
          const m = BASEURL.exec(line);
          if (!m) return;
          // The FIRST path segment is the one Pages serves the repo at. A
          // later literal segment (branches/) is a real constant, not a name.
          const firstSegment = m[1]!.split("/").filter(Boolean)[0];
          if (!firstSegment) return;
          if (IS_EXPRESSION.test(firstSegment)) return;
          offenders.push(`${file}:${i + 1}: baseurl starts with the literal "${firstSegment}"`);
        });
    }

    expect(offenders).toEqual([]);
  });

  test("the guard can actually fire", () => {
    // A gate that cannot fail is not a gate. This is the pre-fix line.
    const bad = `          echo "baseurl: \\"/folio-assistant/STAGING/\${SLUG}\\"" >> x`;
    const m = BASEURL.exec(bad);
    expect(m).not.toBeNull();
    const first = m![1]!.split("/").filter(Boolean)[0];
    expect(first).toBe("folio-assistant");
    expect(IS_EXPRESSION.test(first!)).toBe(false);
  });

  test("a composed baseurl passes", () => {
    const good = `          echo "baseurl: \\"/\${REPO}/STAGING/\${SLUG}\\"" >> x`;
    const m = BASEURL.exec(good);
    expect(m).not.toBeNull();
    const first = m![1]!.split("/").filter(Boolean)[0];
    expect(IS_EXPRESSION.test(first!)).toBe(true);
  });
});
