/**
 * Bean `folio-assistant-1lfx` — branches/ must report which host rendered it,
 * not assume gh-pages.
 *
 * ## What these guard
 *
 * An agent finishing a turn previously composed staging URLs assuming GitHub
 * Pages. On private repositories or local-git topologies, Pages does not exist,
 * resulting in broken links and wasted round trips.
 *
 * The discipline in `turn-reporting.md` requires:
 * 1. Naming the rendering host from declared architecture / `deployment-awareness.md`
 *    (e.g., GitHub Pages, local server, chat discussion only).
 * 2. Forbidding guessing `github.io` or composing a URL from a git remote.
 * 3. The third state: explicitly stating "could not determine" and providing
 *    repo-relative paths for review when the host cannot be determined.
 *
 * @module scripts/tests/staging-host-reporting.test
 */
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { createStagingPreview, type StagingDeployFacts } from "../../../schemas/sdlc/staging-preview.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { skillMdFile } from "../../known-skills.ts";
import { publicationHost } from "../../../schemas/kg/cat-harness.ts";
import { writeDeclaration } from "../../../test/support/instance-fixture.js";

const ROOT = resolve(HARNESS_ROOT);
// Found where the declared skill directories hold it, not at a spelled path.
const TURN_REPORTING_MD = skillMdFile(ROOT, "turn-reporting")!;

describe("turn-reporting staging host requirements (folio-assistant-1lfx)", () => {
  test("turn-reporting.md exists", () => {
    expect(existsSync(TURN_REPORTING_MD)).toBe(true);
  });

  const content = readFileSync(TURN_REPORTING_MD, "utf-8");

  test("explicitly requires stating the host surface for staging/review", () => {
    expect(content).toMatch(/explicitly state which host rendered it/i);
    expect(content).toMatch(/GitHub Pages/);
    expect(content).toMatch(/local server/);
    expect(content).toMatch(/chat discussion only/);
  });

  test("connects to deployment-awareness discipline", () => {
    expect(content).toMatch(/deployment-awareness/);
  });

  test("forbids assuming github.io or composing URL from git remote", () => {
    expect(content).toMatch(/Never assume `github\.io` or compose a URL from a git remote/);
    expect(content).toMatch(/private\s+repository/);
  });

  test("includes the third state: 'could not determine' with repo-relative paths", () => {
    expect(content).toMatch(/could not determine/);
    expect(content).toMatch(/repo-relative/);
  });
});

describe("staging review host resolution discipline", () => {
  // The shipped resolver: the layer's DECLARED `publication.host`, read from its
  // declaration. No URL is composed from a remote; an undeclared host is its
  // own answer (`undefined`), never `github-pages`.
  const made: string[] = [];
  afterAll(() => { for (const d of made) rmSync(d, { recursive: true, force: true }); });
  const layer = (declaration: Record<string, unknown>): string => {
    const dir = mkdtempSync(join(tmpdir(), "staging-host-"));
    made.push(dir);
    writeDeclaration(dir, JSON.stringify({ name: "probe", ...declaration }));
    return dir;
  };

  test("resolves GitHub Pages when the declaration says github-pages", () => {
    expect(publicationHost(layer({ publication: { host: "github-pages" } }))).toBe("github-pages");
  });

  test("resolves local server when the declaration says local-server", () => {
    expect(publicationHost(layer({ publication: { host: "local-server" } }))).toBe("local-server");
  });

  test("resolves `none` (publishes nowhere, e.g. chat-only review) without guessing a web host", () => {
    const host = publicationHost(layer({ publication: { host: "none" } }));
    expect(host).toBe("none");
    expect(host).not.toBe("github-pages");
  });

  test("third state: an undeclared or unknown host resolves to undefined, never github-pages", () => {
    // A github.io remote in the declaration is not a host declaration: nothing is composed from it.
    expect(publicationHost(layer({ repository: "https://github.com/owner/repo" }))).toBeUndefined();
    expect(publicationHost(layer({ publication: { host: "owner.github.io" } }))).toBeUndefined();
    const empty = mkdtempSync(join(tmpdir(), "staging-host-none-"));
    made.push(empty);
    expect(publicationHost(empty)).toBeUndefined();
  });

  test("does not compose github.io from repo remote when pagesBaseUrl is absent in deploy facts", () => {
    const deployWithoutHost: StagingDeployFacts = {
      slug: "claude-my-branch",
      branch: "claude/my-branch",
      commit: "abcdef1234567890",
      pr: 100,
      issue: 50,
      builtAt: "2026-10-09T12:00:00Z",
    };
    const node = createStagingPreview(deployWithoutHost);
    expect(node.movedFrom).toBeUndefined();
  });
});
