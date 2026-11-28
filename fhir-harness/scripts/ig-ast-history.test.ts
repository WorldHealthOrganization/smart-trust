/**
 * The AST versions a resource's History view lists (fhir-harness#329).
 *
 * @module fhir-harness/scripts/ig-ast-history.test
 */
import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { annotateReleases, astCommitOfTag, parseSeedLog, readAstHistory, seedSource, tagsBySha, withTags } from "./ig-ast-history.ts";

const dir = mkdtempSync(join(tmpdir(), "ig-ast-history-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const A = "a".repeat(40);
const B = "b".repeat(40);
const C = "c".repeat(40);

describe("reading the seeds", () => {
  test("seedSourceFromSubject", () => {
    expect(seedSource("AST smart.x | 757 resources | 6483 edges | Publisher 3.0.0 | src 0232a9cd")).toBe("0232a9cd");
    expect(seedSource("Merge branch main")).toBeUndefined();
  });
  test("parseSeedLogSkipsOthers", () => {
    const log = [`${A}\t2026-11-10T17:38:52Z\tAST x | 1 resources | 0 edges | Publisher 3 | src 11112222`, `${B}\t2026-11-09T10:00:00Z\tsome other commit`, "garbage"].join("\n");
    expect(parseSeedLog(log)).toEqual([{ commit: A, date: "2026-11-10T17:38:52Z", src: "11112222" }]);
  });
  test("tagsPeeledAndMatchedByPrefix", () => {
    const t = tagsBySha([`${C}\trefs/tags/v1.0.0`, `${A}\trefs/tags/v1.0.0^{}`, `${A}\trefs/tags/v1.0.0-ballot`].join("\n"));
    expect(t.get(A)).toEqual(["v1.0.0", "v1.0.0-ballot"]);
    expect(t.has(C)).toBe(false);
    const v = withTags([{ commit: B, date: "d", src: "aaaaaaaa" }, { commit: C, date: "d", src: "12345678" }], t);
    expect(v[0]!.tags).toEqual(["v1.0.0", "v1.0.0-ballot"]);
    expect(v[1]!.tags).toBeUndefined();
    expect(astCommitOfTag({ versions: v }, "v1.0.0")).toBe(B);
    expect(astCommitOfTag({ versions: v }, "v0.9")).toBeUndefined();
  });
});

describe("the cache branch's history and the IG's tags (#326 keeps every seed)", () => {
  const git = (cwd: string, ...a: string[]): string => {
    const r = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "init.defaultBranch=main", "-c", "uploadpack.allowFilter=true", ...a], { cwd, encoding: "utf-8" });
    if (r.status !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr}`);
    return r.stdout.trim();
  };
  const remote = join(dir, "remote.git");
  const src = join(dir, "src");
  const cache = join(dir, "cache");
  const ig = join(dir, "ig");
  mkdirSync(src, { recursive: true });
  mkdirSync(cache, { recursive: true });
  mkdirSync(ig, { recursive: true });
  git(dir, "init", "-q", "--bare", remote);
  git(src, "init", "-q");
  git(cache, "init", "-q");
  const shas: string[] = [];
  const seeds: string[] = [];
  for (const n of [1, 2]) {
    writeFileSync(join(src, "f"), String(n));
    git(src, "add", ".");
    git(src, "commit", "-qm", `src ${n}`);
    shas.push(git(src, "rev-parse", "HEAD"));
    writeFileSync(join(cache, "manifest.json"), `{"n":${n}}`);
    git(cache, "add", ".");
    git(cache, "commit", "-qm", `AST ex.ig | 1 resources | 0 edges | Publisher 3 | src ${shas[n - 1]!.slice(0, 8)}`);
    seeds.push(git(cache, "rev-parse", "HEAD"));
  }
  git(src, "tag", "-a", "v1", shas[0]!, "-m", "release 1");
  git(src, "push", "-q", remote, "HEAD:refs/heads/main", "--tags");
  git(cache, "push", "-q", remote, "HEAD:refs/heads/cat/fhir-harness/fhir-ast/ex.ig");
  git(ig, "init", "-q");
  git(ig, "remote", "add", "origin", remote);

  test("readsSeedsAndTags", () => {
    const h = readAstHistory({ ig, commit: seeds[1]!, repository: "o/r" })!;
    expect(h.repository).toBe("o/r");
    expect(h.versions.map((v) => v.commit)).toEqual([seeds[1], seeds[0]]);
    expect(h.versions[1]!.tags).toEqual(["v1"]);
    expect(h.versions[0]!.tags).toBeUndefined();
  });

  test("releasesNameTheirAstCommit", () => {
    const h = readAstHistory({ ig, commit: seeds[1]!, repository: "o/r" })!;
    const file = join(dir, "releases.json");
    writeFileSync(file, JSON.stringify({ releases: [{ tag: "v1" }, { tag: "v0", ast: { commit: A } }] }));
    expect(annotateReleases(file, h)).toBe(1);
    const doc = JSON.parse(readFileSync(file, "utf-8")) as { releases: { tag: string; ast?: { commit: string } }[] };
    expect(doc.releases[0]!.ast).toEqual({ commit: seeds[0]! });
    expect(doc.releases[1]!.ast).toBeUndefined();
  });

  test("unreadableGivesNone", () => {
    expect(readAstHistory({ ig, commit: "d".repeat(40), repository: "o/r" })).toBeUndefined();
  });
});
