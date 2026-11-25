/**
 * The tier (full or fast) is read from the PR's labels as they are NOW, not
 * from the event payload (owner, card Q-TIER-1 A, 2026-11-12).
 *
 * The merge flow adds `ready-to-merge`, removes `release` and toggles draft;
 * the final ready_for_review event's payload then said "no release", and the
 * run was the fast tier only (cat-harness#1275, and two PRs of a layer above). The
 * tier step's own script (prepare-head's "Which tier (the PR's live labels)",
 * a job of its own until the owner's 2026-11-13 "A. Collapse into one job")
 * is read out of `layer-pr-checks.yml` and run with a fake `curl`, so what is
 * tested is the shell the workflow runs.
 *
 * @module test/layer-pr-checks-live-labels.test
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "yaml";

const WORKFLOW = resolve(import.meta.dir, "..", ".github", "workflows", "layer-pr-checks.yml");
const TEXT = readFileSync(WORKFLOW, "utf-8");
type Job = { needs?: string | string[]; if?: string; name?: string; steps?: Array<{ name?: string; run?: string; if?: string; env?: Record<string, string> }> };
const WF = parse(TEXT, { maxAliasCount: -1 }) as { jobs: Record<string, Job & { env?: Record<string, string> }> };
const TIER_STEP = "Which tier (the PR's live labels)";

/**
 * Run the tier step. `withToken` / `anonymous`: what the fake curl answers
 * for a request with and without the token (a JSON body, or null to fail).
 */
function tier(opts: { event?: string; withToken?: string | null; anonymous?: string | null; payloadFull?: string; payloadPreview?: string }): { full: string; env: string; out: string; preview: string; previewEnv: string } {
  const dir = mkdtempSync(join(tmpdir(), "tier-"));
  const enc = (v: string | null | undefined) => (v === null || v === undefined ? "" : Buffer.from(v).toString("base64"));
  writeFileSync(
    join(dir, "curl"),
    [
      "#!/usr/bin/env bash",
      'auth=no; for a in "$@"; do case "$a" in Authorization:*) auth=yes ;; esac; done',
      `if [ "$auth" = yes ]; then b='${enc(opts.withToken)}'; else b='${enc(opts.anonymous)}'; fi`,
      '[ -n "$b" ] || exit 22',
      'printf %s "$b" | base64 -d',
    ].join("\n"),
  );
  chmodSync(join(dir, "curl"), 0o755);
  const output = join(dir, "out");
  const envFile = join(dir, "env");
  writeFileSync(output, "");
  writeFileSync(envFile, "");
  const step = WF.jobs["prepare-head"]!.steps!.find((s) => s.name === TIER_STEP)!;
  const r = spawnSync("bash", ["-c", step.run!], {
    encoding: "utf-8",
    env: {
      // input-site: env PATH #34b0985f — PATH handed to a child process, which decides which binaries it runs
      PATH: `${dir}:${process.env.PATH ?? ""}`,
      GITHUB_OUTPUT: output,
      GITHUB_ENV: envFile,
      GITHUB_STEP_SUMMARY: join(dir, "summary"),
      GH_TOKEN: "t",
      EVENT: opts.event ?? "pull_request",
      REPO: "o/r",
      PR: "7",
      PAYLOAD_FULL: opts.payloadFull ?? "false",
      ...(opts.payloadPreview !== undefined ? { PAYLOAD_PREVIEW: opts.payloadPreview } : {}),
    },
  });
  const outText = readFileSync(output, "utf-8");
  const envText = readFileSync(envFile, "utf-8");
  const last = (re: RegExp, t: string) => [...t.matchAll(re)].at(-1)?.[1] ?? "";
  const full = last(/^full=(\w+)/gm, outText);
  const env = last(/^FULL=(\w+)/gm, envText);
  return { full, env, out: r.stdout + r.stderr, preview: last(/^preview=(\w+)/gm, outText), previewEnv: last(/^PREVIEW=(\w+)/gm, envText) };
}

const labels = (...names: string[]) => JSON.stringify(names.map((name) => ({ name })));

describe("tier: the PR's live labels decide, not the payload", () => {
  test("cat-harness#1275: release removed, ready-to-merge added, payload says no release -> the FULL tier", () => {
    const r = tier({ withToken: labels("ready-to-merge"), payloadFull: "false" });
    expect(r.full).toBe("true");
    expect(r.env).toBe("true");
    expect(r.out).toContain("live labels: ready-to-merge -> full tier");
  });

  test("release live -> full; neither -> fast, even when the payload still says release", () => {
    expect(tier({ withToken: labels("release", "docs") }).full).toBe("true");
    expect(tier({ withToken: labels("docs"), payloadFull: "true" }).full).toBe("false");
    expect(tier({ withToken: labels("docs"), payloadFull: "true" }).env).toBe("false");
    expect(tier({ withToken: "[]", payloadFull: "true" }).full).toBe("false");
  });

  test("the token refused: the anonymous read decides", () => {
    expect(tier({ withToken: null, anonymous: labels("ready-to-merge") }).full).toBe("true");
  });

  test("no read at all: the payload decides, with a warning", () => {
    const r = tier({ withToken: null, anonymous: null, payloadFull: "true" });
    expect(r.full).toBe("true");
    expect(r.out).toContain("::warning::the PR's labels could not be read");
    expect(tier({ withToken: "not json", anonymous: null, payloadFull: "false" }).full).toBe("false");
  });

  test("preview live, without release -> the preview tier: the full machinery, cut to the change's cone", () => {
    const r = tier({ withToken: labels("docs", "preview") });
    expect(r.preview).toBe("true");
    expect(r.previewEnv).toBe("true");
    expect(r.full).toBe("true");
    expect(r.out).toContain("live labels: docs preview -> preview tier");
  });

  test("release and preview -> the full tier, never the preview tier", () => {
    const r = tier({ withToken: labels("preview", "release") });
    expect(r.full).toBe("true");
    expect(r.preview).toBe("false");
    expect(r.out).toContain("-> full tier");
  });

  test("no read at all: the payload's preview label decides too; unset, it is not the preview tier", () => {
    expect(tier({ withToken: null, anonymous: null, payloadPreview: "true" }).preview).toBe("true");
    expect(tier({ withToken: null, anonymous: null }).preview).toBe("false");
    expect(tier({ event: "push", withToken: null, anonymous: null }).preview).toBe("false");
  });

  test("a push is always the full tier", () => {
    expect(tier({ event: "push", withToken: null, anonymous: null }).full).toBe("true");
    expect(tier({ event: "push", withToken: null, anonymous: null }).env).toBe("true");
  });
});

describe("every tier condition reads the tier step", () => {
  test("no condition outside the tier job reads the payload's labels", () => {
    const outside = TEXT.split("\n").filter((l) => l.includes("labels.*.name") && !l.includes("PAYLOAD_FULL:") && !l.includes("PAYLOAD_PREVIEW:"));
    expect(outside).toEqual([]);
  });

  test("there is no tier job; the tier step comes before every step that reads env.FULL", () => {
    expect(WF.jobs.tier).toBeUndefined();
    expect(TEXT).not.toContain("needs.tier");
    const steps = WF.jobs["prepare-head"]!.steps!;
    const at = steps.findIndex((s) => s.name === TIER_STEP);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(steps.slice(0, at).some((s) => JSON.stringify(s).includes("env.FULL"))).toBe(false);
  });

  test("every other job whose (anchored) steps read env.FULL sets it, and reaches it only on the full tier", () => {
    for (const [name, job] of Object.entries(WF.jobs)) {
      if (name === "prepare-head" || !JSON.stringify(job.steps ?? []).includes("env.FULL")) continue;
      expect(job.env?.FULL, name).toBe("true");
    }
    // prepare-base (and so run and record-writers, which need it) runs only
    // on a push or when prepare-head decided the full tier.
    expect(WF.jobs["prepare-base"]!.if).toContain("(github.event_name == 'push' || needs.prepare-head.outputs.full == 'true')");
  });

  test("prepare-head (and with it the tier step) skips a no-op labeled event, like every job after it", () => {
    expect(WF.jobs["prepare-head"]!.if).toContain("github.event.label.name == 'release'");
  });
});
