#!/usr/bin/env bun
/**
 * Write or retire the `staging-preview` record for one preview.
 *
 * @module scripts/staging-record
 * @covers none — a WRITER the deploy calls, not an audit: it records a preview, and judges nothing
 *
 * Bean `6pfo`. `feature-staging.yml` is the only thing that knows a preview's
 * pull request and issue, and it already fires at both ends of a preview's
 * life — `pull_request [opened, synchronize, reopened]` and
 * `pull_request_target [closed]`. This is what it calls at each.
 *
 * ## Why this is a script and not inline YAML
 *
 * Owner, 2026-09-19, on where the write and remove logic belongs: *"that's
 * part of the behaviour of that node type."* The rules live in
 * `schemas/sdlc/staging-preview.ts` — what a record carries, that retirement is a
 * state rather than a deletion, that retiring twice keeps the first
 * retirement. A workflow step that built the JSON with `jq` would be a second
 * copy of those rules, free to disagree with the first the moment either
 * changed. This file is a thin caller so that cannot happen.
 *
 * ## `create` is idempotent on purpose, and not by overwriting
 *
 * `synchronize` fires on every push to an open pull request, so `create` runs
 * many times for one preview. It REFUSES to overwrite a retired record and
 * otherwise preserves the original `builtAt`, because that field answers "when
 * did this preview first appear" — a value that walks forward on every push
 * answers nothing. The head commit IS updated, since that is the one deploy
 * fact that legitimately changes.
 *
 * ## Enrichment is deliberately absent
 *
 * Size, file count and liveness are the health sweep's knowledge, and
 * `health-check.yml` is `contents: read` DELIBERATELY — AGENTS.md: "It reports
 * and never acts", with bean `plj1` as the worked example of a reporting tool
 * that acted. Owner chose 2026-09-20 to drop enrichment rather than grant that
 * workflow write. So a record carries what the deploy knows and nothing it
 * would have to guess.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/staging-record.ts create --out FILE --slug S --branch B \
 *     --commit C [--pr N] [--issue N] [--host URL]
 *   bun run cat-harness-tools/scripts/staging-record.ts retire --out FILE --reason "..."
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  createStagingPreview,
  isRetired,
  readStagingPreview,
  retireStagingPreview,
  serializeStagingPreview,
  type StagingPreviewNode,
} from "../schemas/sdlc/staging-preview.ts";
import { previewPath } from "./lib/preview-prefix.ts";
import { PREVIEW_PREFIX } from "./lib/preview-prefix.ts";

/** What `create` does to a record that is already there. */
export type CreateOutcome =
  | { action: "created"; node: StagingPreviewNode }
  | { action: "updated"; node: StagingPreviewNode }
  | { action: "refused-retired"; why: string };

/**
 * Build the record, or fold new deploy facts into the one already present.
 *
 * Pure, so the decision is testable without a filesystem or a workflow.
 */
export function createOrUpdate(
  existing: StagingPreviewNode | undefined,
  facts: Parameters<typeof createStagingPreview>[0],
): CreateOutcome {
  const fresh = createStagingPreview(facts);
  if (existing === undefined) return { action: "created", node: fresh };

  if (isRetired(existing)) {
    // A retired record describes a preview that is gone. Rewriting it as live
    // would erase the one fact somebody consults it for — `retiredOn`. If a
    // branch comes back (bean `w2g5`: a session reusing one branch across five
    // successive pull requests), that is a NEW preview and the deploy will
    // have removed and rebuilt the directory; the record for the old one stays
    // retired rather than being quietly resurrected.
    return {
      action: "refused-retired",
      why:
        `${PREVIEW_PREFIX}/${existing.staging.slug} was retired on ${existing.staging.retiredOn} ` +
        `(${existing.staging.retiredReason ?? "no reason recorded"}); not overwriting it as live`,
    };
  }

  return {
    action: "updated",
    node: {
      ...fresh,
      // `builtAt` is when the preview FIRST appeared, so it does not walk
      // forward on every `synchronize`. Everything else is the current deploy.
      staging: { ...fresh.staging, builtAt: existing.staging.builtAt },
    },
  };
}

/** Read a record if one is there, or `undefined`. Throws on a corrupt one. */
export function loadExisting(path: string): StagingPreviewNode | undefined {
  if (!existsSync(path)) return undefined;
  const r = readStagingPreview(readFileSync(path, "utf8"));
  if (r.node === undefined) {
    // NOT treated as absent. A file that will not parse is a defect, and
    // silently replacing it would destroy whatever it was trying to say —
    // the same reason `readFshGutsNode` returns a reason rather than nothing.
    throw new Error(`${path} exists but is not a staging-preview record: ${r.reason}`);
  }
  return r.node;
}

function write(path: string, node: StagingPreviewNode): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, serializeStagingPreview(node));
}

function flag(argv: string[], name: string): string | undefined {
  const i = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return undefined;
  const v = argv[i].startsWith(`--${name}=`) ? argv[i].slice(name.length + 3) : argv[i + 1];
  return v === undefined || v === "" ? undefined : v;
}

function intFlag(argv: string[], name: string): number | undefined {
  const raw = flag(argv, name);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  // A pull request number that will not parse is a defect in the caller, not
  // an absent one — reporting it as absent would publish a record missing the
  // field it most exists to carry.
  if (!Number.isInteger(n) || n <= 0) throw new Error(`--${name} must be a positive integer, got \`${raw}\``);
  return n;
}

const USAGE =
  "usage:\n" +
  "  staging-record.ts create --out FILE --slug S --branch B --commit C [--pr N] [--issue N] [--host URL]\n" +
  "  staging-record.ts retire --out FILE --reason TEXT";

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const out = flag(argv, "out");

  if (out === undefined || (cmd !== "create" && cmd !== "retire")) {
    console.error(USAGE);
    process.exit(2);
  }

  try {
    if (cmd === "create") {
      const slug = flag(argv, "slug");
      const branch = flag(argv, "branch");
      const commit = flag(argv, "commit");
      if (slug === undefined || branch === undefined || commit === undefined) {
        console.error(USAGE);
        process.exit(2);
      }
      const outcome = createOrUpdate(loadExisting(out), {
        slug,
        branch,
        commit,
        pr: intFlag(argv, "pr"),
        issue: intFlag(argv, "issue"),
        builtAt: new Date().toISOString(),
        host: flag(argv, "host"),
      });
      if (outcome.action === "refused-retired") {
        console.error(`staging-record: ${outcome.why}`);
        process.exit(1);
      }
      write(out, outcome.node);
      console.log(`staging-record: ${outcome.action} ${out} for ${previewPath(slug)}`);
      process.exit(0);
    }

    const reason = flag(argv, "reason");
    if (reason === undefined) {
      console.error(USAGE);
      process.exit(2);
    }
    const existing = loadExisting(out);
    if (existing === undefined) {
      // Not an error. A preview deployed before this script existed has no
      // record, and a cleanup that failed because there was nothing to retire
      // would turn a no-op into a red job.
      console.log(`staging-record: no record at ${out} — nothing to retire`);
      process.exit(0);
    }
    const retired = retireStagingPreview(existing, reason, new Date().toISOString());
    write(out, retired);
    console.log(
      isRetired(existing)
        ? `staging-record: ${out} was already retired on ${existing.staging.retiredOn} — left as it was`
        : `staging-record: retired ${out}`,
    );
    process.exit(0);
  } catch (e) {
    console.error(`staging-record: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
