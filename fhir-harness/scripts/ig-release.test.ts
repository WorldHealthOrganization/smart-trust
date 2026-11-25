import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { AST_ZIP, draftRelease, type Gh, type Git, releaseAssets, releaseBody, releaseCheck, releaseKind, releaseTag, SUMS, tagExists, versionCommit } from "./ig-release.ts";

const build = (): { root: string; output: string; ast: string; out: string } => {
  const root = mkdtempSync(join(tmpdir(), "ig-release-test-"));
  const output = join(root, "output");
  const ast = join(root, "ast");
  mkdirSync(output);
  mkdirSync(join(ast, "resources"), { recursive: true });
  writeFileSync(join(output, "package.tgz"), "pkg");
  writeFileSync(join(output, "package.r4.tgz"), "r4");
  writeFileSync(join(output, "full-ig.zip"), "not carried");
  writeFileSync(join(ast, "manifest.json"), "{}");
  writeFileSync(join(ast, "resources", "Library-x.json"), '{"content":[{"contentType":"application/elm+json"}]}');
  return { root, output, ast, out: join(root, "release") };
};

describe("ig-release", () => {
  test("kindFromSushiConfig", () => {
    expect(releaseKind({ version: "1.0.0", releaseLabel: "STU1" })).toBe("release");
    expect(releaseKind({ version: "1.0.0", releaseLabel: "trial-use" })).toBe("release");
    expect(releaseKind({ version: "1.0.0-ballot" })).toBe("prerelease");
    expect(releaseKind({ version: "0.2.0", releaseLabel: "ci-build" })).toBe("prerelease");
    expect(releaseKind({ version: "0.2.0", releaseLabel: "Draft for comment" })).toBe("prerelease");
  });

  test("gathersPackagesAndAst", () => {
    const b = build();
    const before = statSync(join(b.ast, "manifest.json")).mtimeMs;
    const a = releaseAssets(b);
    expect(a.map((x) => x.name)).toEqual(["package.tgz", "package.r4.tgz", AST_ZIP]);
    expect(readFileSync(join(b.out, SUMS), "utf-8")).toContain(`  ${AST_ZIP}\n`);
    expect(statSync(join(b.ast, "manifest.json")).mtimeMs).toBe(before);
    // The same AST zips to the same bytes.
    const again = releaseAssets({ ...b, out: join(b.root, "again") });
    expect(again.find((x) => x.name === AST_ZIP)!.sha256).toBe(a.find((x) => x.name === AST_ZIP)!.sha256);
    rmSync(b.root, { recursive: true });
  });

  test("refusesBuildWithoutPackage", () => {
    const b = build();
    rmSync(join(b.output, "package.tgz"));
    expect(() => releaseAssets(b)).toThrow(/no package.tgz/);
    rmSync(b.root, { recursive: true });
  });

  test("bodyListsFilesAndAuthorisation", () => {
    const body = releaseBody("v1.0.0", [{ name: "package.tgz", bytes: 2_000_000, sha256: "ab" }], true);
    expect(body).toContain("pre-release");
    expect(body).toContain("| `package.tgz` | 2.0 MB | `ab` |");
    expect(body).toContain("draft-to-publication.bpmn");
  });

  test("makesDraftAndUploads", () => {
    const b = build();
    releaseAssets(b);
    const calls: string[][] = [];
    const sent: (string | undefined)[] = [];
    const call: Gh = (args, input) => {
      calls.push(args);
      sent.push(input);
      if (args[0] === "repos/o/r/releases?per_page=100") return { status: 0, out: "[]" };
      if (args[1] === "POST" && args[2] === "repos/o/r/releases") return { status: 0, out: JSON.stringify({ id: 7, draft: true, upload_url: "https://uploads.github.com/repos/o/r/releases/7/assets{?name,label}", assets: [] }) };
      return { status: 0, out: "{}" };
    };
    const log = draftRelease({ repo: "o/r", tag: "v1.0.0", dir: b.out, prerelease: false }, call);
    expect(log[0]).toBe("made a draft for v1.0.0");
    expect(JSON.parse(sent[1]!)).toMatchObject({ tag_name: "v1.0.0", draft: true, prerelease: false });
    expect(calls.filter((c) => c[2]?.startsWith("https://uploads.github.com/repos/o/r/releases/7/assets?name=")).map((c) => c[2]!.split("name=")[1])).toEqual(["package.tgz", "package.r4.tgz", AST_ZIP, SUMS]);
    rmSync(b.root, { recursive: true });
  });

  test("refusesPublishedRelease", () => {
    const b = build();
    releaseAssets(b);
    const call: Gh = () => ({ status: 0, out: JSON.stringify([{ id: 1, tag_name: "v1.0.0", draft: false, upload_url: "", assets: [] }]) });
    expect(() => draftRelease({ repo: "o/r", tag: "v1.0.0", dir: b.out, prerelease: false }, call)).toThrow(/published release/);
    rmSync(b.root, { recursive: true });
  });

  test("refreshesExistingDraft", () => {
    const b = build();
    releaseAssets(b);
    const deleted: string[] = [];
    const call: Gh = (args) => {
      if (args[0] === "repos/o/r/releases?per_page=100") return { status: 0, out: JSON.stringify([{ id: 3, tag_name: "v1.0.0", draft: true, upload_url: "u{?name}", assets: [{ id: 9, name: "package.tgz" }, { id: 10, name: "notes.pdf" }] }]) };
      if (args[1] === "PATCH") return { status: 0, out: JSON.stringify({ id: 3, draft: true, upload_url: "u{?name}", assets: [] }) };
      if (args[1] === "DELETE") deleted.push(args[2]!);
      return { status: 0, out: "{}" };
    };
    expect(draftRelease({ repo: "o/r", tag: "v1.0.0", dir: b.out, prerelease: true }, call)[0]).toBe("refreshed the draft for v1.0.0");
    expect(deleted).toEqual(["repos/o/r/releases/assets/9"]);
    rmSync(b.root, { recursive: true });
  });
});

describe("ig-release check: the catch-up when the current version is untagged or unreleased (owner, 2026-11-10)", () => {
  /** An IG repository whose version was set to 0.2.0 by its second commit, and a third commit after it that changes nothing of the version. */
  const repo = (): { ig: string; set: string; head: string; tag: (sha: string) => string } => {
    const ig = mkdtempSync(join(tmpdir(), "ig-release-check-"));
    const g = (...a: string[]): string => {
      const r = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "init.defaultBranch=main", ...a], { cwd: ig, encoding: "utf-8" });
      if (r.status !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr}`);
      return r.stdout.trim();
    };
    g("init", "-q");
    writeFileSync(join(ig, "sushi-config.yaml"), "id: ex.ig\nversion: 0.1.0\nfhirVersion: 4.0.1\nreleaseLabel: ci-build\n");
    g("add", ".");
    g("commit", "-qm", "0.1.0");
    writeFileSync(join(ig, "sushi-config.yaml"), "id: ex.ig\nversion: 0.2.0\nfhirVersion: 4.0.1\nreleaseLabel: ci-build\n");
    g("commit", "-qam", "0.2.0");
    const set = g("rev-parse", "HEAD");
    writeFileSync(join(ig, "sushi-config.yaml"), "id: ex.ig\nversion: 0.2.0\nfhirVersion: 4.0.1\nreleaseLabel: ci-build\ntitle: Ex\n");
    g("commit", "-qam", "title");
    return { ig, set, head: g("rev-parse", "HEAD"), tag: (sha: string) => g("tag", "v0.2.0", sha) };
  };
  const releases = (list: unknown[]): Gh => (args) => (args[0] === "repos/o/r/releases?per_page=100" ? { status: 0, out: JSON.stringify(list) } : { status: 1, out: "unexpected" });

  test("untaggedVersionNamesTheCommitThatSetIt", () => {
    const r = repo();
    expect(releaseTag("0.2.0")).toBe("v0.2.0");
    expect(versionCommit(r.ig, "0.2.0")).toBe(r.set);
    expect(r.set).not.toBe(r.head);
    const c = releaseCheck({ ig: r.ig, repo: "o/r" }, undefined, releases([]));
    expect(c).toMatchObject({ version: "0.2.0", tag: "v0.2.0", tagged: false, versionCommit: r.set });
    expect(c.report).toHaveLength(1);
    expect(c.report[0]).toContain(`version 0.2.0 is untagged: the owner tags commit ${r.set} with v0.2.0`);
    expect(c.report[0]).toContain("pre-release");
    expect(c.report[0]).toContain("An agent never tags");
    // It reports; it never tags.
    expect(tagExists(r.ig, "v0.2.0")).toBe(false);
    rmSync(r.ig, { recursive: true });
  });

  test("taggedWithoutReleaseSaysRunTheReleaseByHand", () => {
    const r = repo();
    r.tag(r.set);
    expect(tagExists(r.ig, "v0.2.0")).toBe(true);
    const c = releaseCheck({ ig: r.ig, repo: "o/r" }, undefined, releases([{ id: 1, tag_name: "v0.1.0", draft: false, upload_url: "", assets: [] }]));
    expect(c.release).toBe("none");
    expect(c.report[0]).toContain('tag v0.2.0 has no release: run "IG release (draft)" (ig-release.yml) by hand with tag v0.2.0');
    rmSync(r.ig, { recursive: true });
  });

  test("draftOrPublishedReleaseIsInOrder", () => {
    const r = repo();
    r.tag(r.set);
    const draft = releaseCheck({ ig: r.ig, repo: "o/r" }, undefined, releases([{ id: 2, tag_name: "v0.2.0", draft: true, upload_url: "", assets: [] }]));
    expect(draft.release).toBe("draft");
    expect(draft.report[0]).toContain("waiting for the owner to publish it");
    const published = releaseCheck({ ig: r.ig, repo: "o/r" }, undefined, releases([{ id: 2, tag_name: "v0.2.0", draft: false, upload_url: "", assets: [] }]));
    expect(published).toMatchObject({ release: "published", report: [] });
    // The release list unreadable: said, not guessed.
    expect(releaseCheck({ ig: r.ig, repo: "o/r" }, undefined, () => ({ status: 1, out: "HTTP 403" })).release).toBe("unknown");
    rmSync(r.ig, { recursive: true });
  });

  test("shallowHistoryFallsBackToHead", () => {
    const ig = mkdtempSync(join(tmpdir(), "ig-release-shallow-"));
    writeFileSync(join(ig, "sushi-config.yaml"), "version: 1.0.0\nreleaseLabel: release\n");
    const head = "a".repeat(40);
    const run: Git = (args) => (args[0] === "rev-parse" && args[1] === "HEAD" ? { status: 0, out: head } : args[0] === "log" ? { status: 0, out: "" } : { status: 1, out: "" });
    const c = releaseCheck({ ig }, run);
    expect(c.versionCommit).toBeUndefined();
    expect(c.report[0]).toContain(`the owner tags commit ${head} with v1.0.0 (HEAD: the history does not say`);
    expect(c.report[0]).not.toContain("pre-release");
    expect(releaseCheck({ ig: join(ig, "nowhere") }, run).report[0]).toContain("no sushi-config.yaml");
    rmSync(ig, { recursive: true });
  });
});
