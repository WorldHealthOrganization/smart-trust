#!/usr/bin/env bun
/**
 * `merge:queue:read` and `merge:queue:record` — the queue, from the command line.
 *
 * @module cat-harness/scripts/merge-queue-cli
 * @covers none — a command over the `merge-queue` graph; `merge-queue-store.ts` judges it
 *
 * `merge-queue.ts` computes an order and `merge-steward.ts` prints it; this
 * RECORDS what the steward decided, and reads it back.
 *
 * ```sh
 * bun run cat merge:queue:read                 # the recorded decisions
 * bun run cat merge:queue:read --json
 * bun run cat merge:queue:record --pr 2065 --class standard --rank 3 --rule Rule_HarnessSmallClean \
 *     --reason "clean, green, unblocks the queue graph" --by https://claude.ai/code/session_…
 * bun run cat merge:queue:record --pr 2065 --position 1 --reason "owner, 2026-10-04: land it first" --by owner
 * bun run cat merge:queue:record --file entry.json      # or `-` for stdin
 * ```
 *
 * ## Exit codes
 *
 * `0` read (or recorded) · `1` the queue is `declared-but-absent` · `2` usage
 * · `4` **unreachable** · `5` the write was refused or conflicted.
 *
 * `1` and `4` have different remedies: `1` means the declaration and the disk
 * disagree, `4` that this checkout has not mounted the branch
 * (`bun run cat state:mount`). Neither is ever exit 0 with an empty table.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { MERGE_QUEUE_ENTRY_TAG, MergeQueueEntrySchema, PRIORITY_CLASSES, type MergeQueueEntry } from "../schemas/sdlc/merge-queue.ts";
import { PRIORITY_DECISION } from "./merge-queue.ts";
import { holdInForce, readQueueStore, recordDecision } from "./merge-queue-store.ts";
import { harnessRel } from "./lib/harness-layout.ts";

export const EXIT = { ok: 0, absent: 1, usage: 2, unreachable: 4, write: 5 } as const;

/** The decision table a computed placement cites, derived rather than retyped. */
// declared-path-literal: written in the sub-graph layout and answered in whichever the harness has — transitional (scripts/lib/harness-layout.ts, cat-harness#991 step 23; remove after cat-harness#1014 merges).
export const DEFAULT_DECISION = `${harnessRel("sdlc/processes/decisions/merge-priority.dmn")}#${PRIORITY_DECISION}`;

function flag(argv: readonly string[], name: string): string | undefined {
  const at = argv.indexOf(`--${name}`);
  return at >= 0 ? argv[at + 1] : undefined;
}

/**
 * `owner/name` for this checkout, from `origin`.
 *
 * Read rather than written down: a PR number means nothing without its
 * repository, and a literal here would be wrong in every folio that installs
 * this harness. `undefined` when `origin` is not a recognisable forge URL —
 * then `--repository` is required, and saying so beats guessing.
 */
export function repositoryOf(cwd: string): string | undefined {
  const r = spawnSync("git", ["remote", "get-url", "origin"], { cwd, encoding: "utf-8" });
  if (r.status !== 0) return undefined;
  const m = /[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?\s*$/.exec(r.stdout);
  return m?.[1];
}

/** The read half. Returns an exit code; prints the four states apart. */
export function read(root: string, json: boolean): number {
  const store = readQueueStore(root);
  if (json) console.log(JSON.stringify(store, null, 2));
  switch (store.state) {
    case "absent":
      if (!json) console.log("merge:queue — no instance declares a `merge-queue` directory. Nothing is recorded, and nothing claims to be.");
      return EXIT.ok;
    case "declared-but-absent":
      if (!json) {
        console.error(
          `merge:queue — DECLARED BUT ABSENT: ${store.dir}\n` +
            `  A declaration names this directory in the checkout and it is not there, so every reader scans\n` +
            `  nothing. Create it, or fix the declaration. This is NOT "no decisions recorded".`,
        );
      }
      return EXIT.absent;
    case "unreachable":
      if (!json) {
        console.error(
          `merge:queue — COULD NOT REACH THE QUEUE, so this is not an empty queue:\n  ${store.reason}`,
        );
      }
      return EXIT.unreachable;
    case "read": {
      if (json) return EXIT.ok;
      console.log(`merge:queue — ${store.entries.length} recorded decision(s) at ${store.dir} (${store.filesSeen} file(s) seen)`);
      console.log("");
      if (store.entries.length > 0) {
        console.log("  pr      placement            rank  hold      train    decided by / reason");
        for (const { entry: e } of store.entries) {
          const place = e.placement.kind === "override" ? `override@${e.placement.position}` : e.placement.class;
          const rank = e.placement.kind === "computed" ? String(e.placement.rank) : "-";
          const hold = e.hold === undefined ? "-" : holdInForce(e) ? `until ${e.hold.expires.slice(0, 16)}` : "EXPIRED";
          console.log(
            `  ${String(e.pr).padEnd(8)}${place.padEnd(21)}${rank.padEnd(6)}${hold.padEnd(10)}${(e.trainId ?? "-").padEnd(9)}${e.decidedBy} — ${e.reason}`,
          );
        }
        console.log("");
      }
      for (const s of store.skipped) {
        if (s.expected) continue;
        console.log(`  ✗ ${s.file} is not a queue entry — ${s.reason}`);
      }
      const bad = store.skipped.filter((s) => !s.expected).length;
      const accounted = store.entries.length + store.skipped.length;
      if (accounted !== store.filesSeen) {
        // The reconciliation is a real guard only because `filesSeen` is
        // counted independently (see `QueueStore`).
        console.error(`  ✗ ${store.filesSeen} file(s) in the directory and ${accounted} accounted for — something was dropped in silence`);
        return EXIT.absent;
      }
      console.log("Facts GitHub owns — CI, mergeability, labels, the head SHA — are not here: they are read live.");
      return bad > 0 ? EXIT.absent : EXIT.ok;
    }
  }
}

/** The entry a `record` invocation describes, or a usage error. */
export function entryFrom(argv: readonly string[], root: string): { entry: unknown } | { usage: string } {
  const file = flag(argv, "file");
  if (file !== undefined) {
    const text = file === "-" ? readFileSync(0, "utf-8") : readFileSync(file, "utf-8");
    try {
      return { entry: JSON.parse(text) };
    } catch (err) {
      return { usage: `--file ${file} does not parse: ${(err as Error).message}` };
    }
  }
  const pr = Number(flag(argv, "pr"));
  if (!Number.isInteger(pr) || pr <= 0) return { usage: "--pr <number> is required (or --file)" };
  const reason = flag(argv, "reason");
  if (!reason) return { usage: "--reason is required: a placement nobody can explain cannot be honoured or safely undone" };
  const by = flag(argv, "by");
  if (!by) {
    return {
      usage:
        "--by is required: a session URL, `owner`, or an actor id. Every session here acts with the owner's " +
        "token, so the link is the only thing that says which steward decided",
    };
  }
  const repository = flag(argv, "repository") ?? repositoryOf(root);
  if (!repository) return { usage: "--repository <owner/name> is required: `origin` is not a recognisable forge URL" };

  const position = flag(argv, "position");
  const klass = flag(argv, "class");
  let placement: Record<string, unknown>;
  if (position !== undefined) {
    placement = { kind: "override", position: Number(position), reason };
  } else if (klass !== undefined) {
    const rank = Number(flag(argv, "rank") ?? "0");
    if (!PRIORITY_CLASSES.includes(klass as (typeof PRIORITY_CLASSES)[number])) {
      return { usage: `--class must be one of ${PRIORITY_CLASSES.join(", ")} — the vocabulary the table answers in` };
    }
    placement = {
      kind: "computed",
      decision: flag(argv, "decision") ?? DEFAULT_DECISION,
      rule: flag(argv, "rule") ?? "",
      class: klass,
      rank,
    };
  } else {
    return { usage: "give the placement: --class <class> [--rank n] [--rule Rule_Id], or --position <n> for an owner override" };
  }

  const beans = (flag(argv, "beans") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const waitsOn = flag(argv, "hold-waits-on");
  const hold =
    waitsOn === undefined
      ? undefined
      : {
          waitsOn,
          since: flag(argv, "hold-since") ?? new Date().toISOString(),
          expires: flag(argv, "hold-expires") ?? "",
          handoff: flag(argv, "hold-handoff") ?? "",
        };
  const ejectReason = flag(argv, "eject-reason");
  const ejection =
    ejectReason === undefined
      ? undefined
      : {
          trainId: flag(argv, "eject-train") ?? flag(argv, "train") ?? "",
          reason: ejectReason,
          evidenceUrl: flag(argv, "eject-evidence") ?? "",
          at: flag(argv, "at") ?? new Date().toISOString(),
        };
  return {
    entry: {
      $schema: MERGE_QUEUE_ENTRY_TAG,
      repository,
      pr,
      placement,
      reason,
      decidedBy: by,
      decidedAt: flag(argv, "at") ?? new Date().toISOString(),
      ...(flag(argv, "train") !== undefined ? { trainId: flag(argv, "train") } : {}),
      ...(hold ? { hold } : {}),
      ...(ejection ? { ejection } : {}),
      beans,
    },
  };
}

/**
 * The entry a `decide` invocation produces (bean `ixmq`): the PR's EXISTING
 * entry with a person's `release` set and `--beans` merged in — or, when the
 * PR has no entry yet, a new one built from `record`'s placement flags.
 *
 * Placement is never invented here. A decision to merge says nothing about
 * where the PR sits in the queue, and computing a placement would mean reading
 * GitHub's live facts inside a capture command; so a PR with no entry and no
 * placement flags is REFUSED with the remedy named.
 *
 * `--by` is the PERSON. A session URL there is refused: the agent that writes
 * the decision down is `--captured-by`, and an agent recording its own
 * decision as a person's is what this record exists to prevent.
 */
export function decisionFrom(
  argv: readonly string[],
  root: string,
  existing: MergeQueueEntry | undefined,
): { entry: unknown } | { usage: string } {
  const verdict = flag(argv, "verdict");
  if (verdict !== "merge" && verdict !== "do-not-merge") return { usage: "--verdict merge|do-not-merge is required" };
  const by = flag(argv, "by");
  if (!by) return { usage: "--by <person> is required: the human who decided (a GitHub login, or `owner`)" };
  if (/\/code\/session_|^session_/.test(by)) {
    return { usage: "--by is the PERSON who decided, not a session — the session that records it goes in --captured-by" };
  }
  const capturedBy = flag(argv, "captured-by");
  if (!capturedBy) return { usage: "--captured-by <your session URL> is required: who wrote the decision down" };
  const quote = flag(argv, "quote");
  if (!quote) return { usage: "--quote \"<their words, verbatim>\" is required: a release nobody can quote cannot be checked" };
  const source = flag(argv, "source");
  if (!source) return { usage: "--source <url> is required: where they said it (the chat session or the PR comment)" };
  const sha = flag(argv, "sha");
  if (!sha) return { usage: "--sha <40-hex> is required: the head the person approved — a later push voids the decision" };
  const standing = argv.includes("--standing-ruling");
  const ruledAt = flag(argv, "ruled-at");
  if (standing && !ruledAt) return { usage: "--standing-ruling needs --ruled-at <YYYY-MM-DD>: merge-to-main accepts a standing ruling only with its date" };

  const release = {
    verdict,
    decidedBy: by,
    decidedAt: flag(argv, "at") ?? new Date().toISOString(),
    authority: standing ? { kind: "standing-ruling", quote, ruledAt, source } : { kind: "explicit", quote, source },
    releasedSha: sha,
    capturedBy,
    ...(flag(argv, "reason") !== undefined ? { reason: flag(argv, "reason") } : {}),
  };
  const beans = (flag(argv, "beans") ?? "").split(",").map((b) => b.trim()).filter(Boolean);

  if (existing) {
    return { entry: { ...existing, release, beans: [...new Set([...existing.beans, ...beans])] } };
  }
  if (flag(argv, "class") === undefined && flag(argv, "position") === undefined) {
    return {
      usage:
        "this PR has no queue entry yet, and a decision to merge says nothing about where it sits in the queue: " +
        "record its placement first (merge:queue:record), or pass --class/--rank/--rule (or --position) with --reason here",
    };
  }
  // A new entry: the PLACEMENT is the capturing session's, so `record`'s
  // `--by` becomes the capturer for that half; the person's word is `release`.
  const placementArgv = argv.map((a, i) => (argv[i - 1] === "--by" ? capturedBy : a));
  const built = entryFrom(placementArgv, root);
  if ("usage" in built) return built;
  return { entry: { ...(built.entry as Record<string, unknown>), release } };
}

function decideMain(argv: readonly string[], root: string): number {
  const pr = Number(flag(argv, "pr"));
  if (!Number.isInteger(pr) || pr <= 0) {
    console.error("merge:queue:decide — --pr <number> is required");
    return EXIT.usage;
  }
  const repository = flag(argv, "repository") ?? repositoryOf(root);
  if (!repository) {
    console.error("merge:queue:decide — --repository <owner/name> is required: `origin` is not a recognisable forge URL");
    return EXIT.usage;
  }
  const store = readQueueStore(root);
  if (store.state === "unreachable") {
    console.error(`merge:queue:decide — COULD NOT REACH THE QUEUE (run \`bun run cat state:mount\`): ${store.reason}`);
    return EXIT.unreachable;
  }
  if (store.state !== "read") {
    console.error(`merge:queue:decide — the queue reads \`${store.state}\`, so there is nowhere to record a decision`);
    return EXIT.absent;
  }
  const existing = store.entries.find(({ entry: e }) => e.pr === pr && e.repository === repository)?.entry;
  const built = decisionFrom(argv, root, existing);
  if ("usage" in built) {
    console.error(`merge:queue:decide — ${built.usage}`);
    return EXIT.usage;
  }
  const check = MergeQueueEntrySchema.safeParse(built.entry);
  if (argv.includes("--dry-run") || !check.success) {
    console.log(JSON.stringify(built.entry, null, 2));
    if (!check.success) {
      for (const i of check.error.issues) console.error(`  ✗ ${i.path.join(".") || "(root)"}: ${i.message}`);
      return EXIT.usage;
    }
    console.log("\n(--dry-run: this decision VALIDATES and nothing was written. Drop the flag to record it.)");
    return EXIT.ok;
  }
  const verdict = check.data.release!.verdict;
  const r = recordDecision(check.data, {
    root,
    push: !argv.includes("--no-push"),
    message: `queue: ${repository}#${pr} — release ${verdict} at ${check.data.release!.releasedSha.slice(0, 12)} by ${check.data.release!.decidedBy}`,
  });
  if (r.state === "refused") {
    console.error(`merge:queue:decide — REFUSED: ${r.reason}`);
    return EXIT.write;
  }
  console.log(`merge:queue:decide — ${verdict} recorded for #${pr} in ${r.file}${existing ? "" : " (new entry)"}`);
  if (r.push === "skipped") {
    console.log("--no-push: the decision is in the mount only. Nobody else can see it until `bun run cat state:push --id queue`.");
    return EXIT.ok;
  }
  console.log(`  push: ${r.push.state} — ${r.push.reason}`);
  return r.push.state === "pushed" || r.push.state === "unchanged" ? EXIT.ok : EXIT.write;
}

function recordMain(argv: readonly string[], root: string): number {
  const built = entryFrom(argv, root);
  if ("usage" in built) {
    console.error(`merge:queue:record — ${built.usage}`);
    return EXIT.usage;
  }
  if (argv.includes("--dry-run")) {
    // VALIDATED, not merely printed. A dry run that pretty-printed the object
    // and claimed it was checked would be the claim this repository punishes
    // hardest: the writer would find out at the real run, and the message
    // would already have said otherwise.
    const check = MergeQueueEntrySchema.safeParse(built.entry);
    console.log(JSON.stringify(built.entry, null, 2));
    if (!check.success) {
      console.error("");
      for (const i of check.error.issues) console.error(`  ✗ ${i.path.join(".") || "(root)"}: ${i.message}`);
      return EXIT.usage;
    }
    console.log("\n(--dry-run: this entry VALIDATES and nothing was written. Drop the flag to record it.)");
    return EXIT.ok;
  }
  const r = recordDecision(built.entry, { root, push: !argv.includes("--no-push") });
  if (r.state === "refused") {
    console.error(`merge:queue:record — REFUSED: ${r.reason}`);
    return EXIT.write;
  }
  console.log(`merge:queue:record — wrote ${r.file} into ${r.dir}`);
  if (r.push === "skipped") {
    console.log("--no-push: the entry is in the mount only. It is not visible to anyone until `bun run cat state:push --id queue`.");
    return EXIT.ok;
  }
  console.log(`  push: ${r.push.state} — ${r.push.reason}`);
  // `conflict` is the mechanism working: a sibling steward edited the same
  // entry since this mount was taken, and NOTHING was pushed. The local edit is
  // the only copy, so it is left alone and the steward re-mounts and re-decides.
  return r.push.state === "pushed" || r.push.state === "unchanged" ? EXIT.ok : EXIT.write;
}

export function main(argv: readonly string[], root: string = process.cwd()): number {
  const [cmd] = argv;
  switch (cmd) {
    case "read":
      return read(root, argv.includes("--json"));
    case "record":
      return recordMain(argv.slice(1), root);
    case "decide":
      return decideMain(argv.slice(1), root);
    default:
      console.error("usage: merge-queue-cli.ts read [--json] | decide --pr <n> --verdict merge|do-not-merge --by <person> --quote <words> --source <url> --sha <head> --captured-by <session> [--standing-ruling --ruled-at <date>] [--beans <ids>] | record --pr <n> --reason <why> --by <who> [--class <c> --rank <n> | --position <n>] [--file <path|->] [--no-push] [--dry-run]");
      return EXIT.usage;
  }
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
