#!/usr/bin/env bun
/**
 * Is the Bun RUNNING HERE the one `.bun-version` pins?
 *
 * ## What it reports
 *
 * 1. **The runtime differs from CI's.** `check:bun-pin` asserts the
 *    `setup-bun` sites install `.bun-version`, so CI runs exactly that. An
 *    agent on another bun is running different code than the gate that will
 *    judge its push — a test that passes here can fail there, and the
 *    reverse.
 * 2. **A sidecar whose CONTENT changes here will be stamped with the local
 *    engine.** `saveQaScriptSidecar` does not compare `engine_version`, so it
 *    records the engine of the last content change; changing a checker on an
 *    older bun stamps the sidecar BACKWARDS relative to those carrying CI's.
 *
 * The count it prints is **not a prediction of churn**: it is how many
 * committed sidecars record an engine other than the one running, i.e. their
 * last content change was made elsewhere.
 *
 * ## Why this is not part of `check:bun-pin`, and not a gate at all
 *
 * `check:bun-pin` asks about the CORPUS, which every checkout answers
 * identically, so it is gateable. This asks about the ENVIRONMENT: the
 * answer differs per container and no commit can change it, so as a gate it
 * would be always red on agent containers, and in CI (which installs the
 * pin) it would exercise nothing. It is declared in `SCRIPT_EXEMPTIONS` for
 * that reason, and `session-start-coord-sweep.sh` runs it with `--markdown`
 * at every session start.
 *
 * ## `bun-` is a prefix
 *
 * A sidecar records `engine_version: "bun-1.3.14"`; `.bun-version` holds the
 * bare `1.3.14`. Comparing them directly never matches, so the prefix is a
 * named constant with its own test.
 *
 * ## Three states, and `cannot-tell` is not `match`
 *
 *     match        the running engine is the pinned one            exit 0
 *     mismatch     they differ                                     exit 1
 *     cannot-tell  no pin, unparseable pin, or no Bun to ask       exit 2
 *
 * `cannot-tell` exits 2 rather than 0: an unanswered question is not a clean
 * answer.
 *
 * @module folio-assistant/scripts/check-bun-runtime
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { PIN_FILE, readPinFile } from "./check-bun-pin.ts";
import { SCRIPT_SIDECAR_DIR } from "../pipeline/qa-utils.ts";
// The HARNESS, not this layer: these scripts moved up in 70lx B2b and read cat-harness.
import { HARNESS_ROOT } from "./lib/roots.ts";

const INSTANCE_ROOT = HARNESS_ROOT;
const REPO_ROOT = resolve(INSTANCE_ROOT, "..");

/**
 * What a sidecar's `engine_version` puts in front of the version.
 *
 * Named because it is the difference between the count meaning something and
 * the count being every sidecar in every container — see the module header.
 */
export const ENGINE_PREFIX = "bun-";

export type Verdict = "match" | "mismatch" | "cannot-tell";

export interface RuntimeReport {
  verdict: Verdict;
  /** The literal `.bun-version` holds, when it could be read. */
  pinned?: string;
  /** The engine actually running, bare — no `bun-` prefix. */
  running?: string;
  /** Why the verdict is `cannot-tell`. Absent otherwise. */
  reason?: string;
  /** Sidecars read. A scan that matched nothing must not read clean. */
  sidecars: number;
  /**
   * Of those, how many record an engine other than the one running.
   *
   * **This is not a churn prediction.** It was, until #1452 stopped
   * `engine_version` from causing a write; now it says only that their last
   * CONTENT change was made on another engine. Named for what it measures so a
   * reader cannot take it for the old meaning.
   */
  stampedElsewhere: number;
}

/**
 * The whole judgement, as a function of its three inputs.
 *
 * Pure and parameterised rather than reading the environment, so a test can
 * build a mismatch instead of describing one. A check whose only demonstrated
 * behaviour is on a correct machine has not been shown to fire.
 */
export function judge(
  pinned: string | undefined,
  running: string | undefined,
  engineVersions: readonly (string | undefined)[],
): RuntimeReport {
  const sidecars = engineVersions.length;
  if (pinned === undefined) {
    return { verdict: "cannot-tell", running, reason: `${PIN_FILE} is absent or holds no bare X.Y.Z`, sidecars, stampedElsewhere: 0 };
  }
  if (running === undefined) {
    return { verdict: "cannot-tell", pinned, reason: "the running engine did not report a Bun version", sidecars, stampedElsewhere: 0 };
  }
  // Counted against RUNNING rather than the pin: the question is which engine
  // stamped the committed record, as against the one that would stamp a change
  // made here.
  const stamp = `${ENGINE_PREFIX}${running}`;
  const stampedElsewhere = engineVersions.filter((v) => v !== stamp).length;
  return { verdict: pinned === running ? "match" : "mismatch", pinned, running, sidecars, stampedElsewhere };
}

/** Every committed sidecar's `engine_version`, `undefined` where it has none. */
export function engineVersionsIn(instanceRoot: string): (string | undefined)[] {
  const dir = join(instanceRoot, SCRIPT_SIDECAR_DIR);
  let names: string[];
  try {
    names = readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    // An unreadable directory is not an empty one. The caller distinguishes
    // them by `sidecars`, which stays 0 and is reported.
    return [];
  }
  return names.map((f) => {
    try {
      return (JSON.parse(readFileSync(join(dir, f), "utf-8")) as { engine_version?: string }).engine_version;
    } catch {
      return undefined;
    }
  });
}

export function bunRuntime(repoRoot: string = REPO_ROOT, instanceRoot: string = INSTANCE_ROOT): RuntimeReport {
  let pinned: string | undefined;
  try {
    pinned = readPinFile(readFileSync(join(repoRoot, PIN_FILE), "utf-8"));
  } catch {
    pinned = undefined;
  }
  return judge(pinned, process.versions.bun, engineVersionsIn(instanceRoot));
}

/** The sweep's section. Markdown, because that is what the hook injects. */
export function markdown(r: RuntimeReport): string {
  const head = "## Bun runtime vs the pin\n\n";
  if (r.verdict === "cannot-tell") {
    return (
      head +
      `**Could not determine — treat as unknown, not as matched.** ${r.reason}.\n\n` +
      "Run it by hand: `bun run cat check:bun-runtime`.\n"
    );
  }
  if (r.verdict === "match") {
    return head + `Running Bun **${r.running}** matches \`${PIN_FILE}\`, so this container runs what CI runs.\n`;
  }
  const lead =
    head +
    `**This container runs Bun ${r.running}; \`${PIN_FILE}\` pins ${r.pinned}.** CI installs the pin at ` +
    "every `setup-bun` site, so you are running different code from the gates that will judge your " +
    "push — a test that passes here can fail there, and the reverse.\n\n";

  // The sidecar clause is only worth printing when the corpus actually
  // disagrees with this engine. It read "older than the 0 above" for one
  // commit, after main normalised all 86 stamps to `bun-1.3.11` — a sentence
  // that cannot be true and that no test covered, because every fixture here
  // had been built with a non-zero count.
  if (r.stampedElsewhere === 0) {
    return (
      lead +
      `All ${r.sidecars} committed script sidecars already record \`${ENGINE_PREFIX}${r.running}\`, so a ` +
      "checker you change here stamps its sidecar consistently with the rest and there is nothing to " +
      "watch for on that axis. Nothing will be rewritten either way: since #1452, `engine_version` is " +
      "excluded from `saveQaScriptSidecar`'s write-skip comparison.\n"
    );
  }

  return (
    lead +
    `Of ${r.sidecars} committed script sidecars, **${r.stampedElsewhere}** record a different engine. ` +
    "**That is not churn and will not dirty your tree**: since #1452, `engine_version` is excluded from " +
    "`saveQaScriptSidecar`'s write-skip comparison, so a sweep from any bun rewrites nothing. It means " +
    "their last CONTENT change was made elsewhere.\n\n" +
    "What to watch for instead: if you change a checker and its sidecar is rewritten here, the new stamp " +
    `is \`${ENGINE_PREFIX}${r.running}\`, which differs from the ${r.stampedElsewhere} above. Read what a ` +
    "regeneration writes before committing it (`rmcf`, and `#1430`'s `sfjo` rule), rather than committing " +
    "a stamp that moves backwards as though it were a fresh measurement.\n"
  );
}

if (import.meta.main) {
  const r = bunRuntime();
  if (process.argv.includes("--markdown")) {
    // Printed on stdout whatever the verdict: the sweep injects stdout, and a
    // finding routed to stderr would be the one the agent never reads.
    console.log(markdown(r));
  } else if (r.verdict === "cannot-tell") {
    console.error(`Bun runtime — could not determine: ${r.reason}. This is not a pass.`);
  } else if (r.verdict === "match") {
    console.log(`Bun runtime — ${r.running} matches ${PIN_FILE}; ${r.sidecars} sidecar(s) read.`);
  } else {
    console.error(
      `Bun runtime — this container runs ${r.running}, ${PIN_FILE} pins ${r.pinned}, so you are not\n` +
        `  running what CI runs. ${r.stampedElsewhere} of ${r.sidecars} script sidecar(s) record another engine;\n` +
        `  since #1452 that is a record, NOT pending churn. A checker you change here stamps ${ENGINE_PREFIX}${r.running}.`,
    );
  }
  process.exit(r.verdict === "match" ? 0 : r.verdict === "mismatch" ? 1 : 2);
}
