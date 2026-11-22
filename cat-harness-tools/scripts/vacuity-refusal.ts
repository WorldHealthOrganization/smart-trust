/**
 * A gate that examined NOTHING must refuse, not pass: an empty corpus makes
 * every count zero, and zero reads as a clean run.
 *
 * ## Why a module rather than a few lines in each gate
 *
 * A per-gate convention is applied only by an author who already knows about
 * it. A shared function makes the correct behaviour cheaper to reach than the
 * incorrect one, and gives the cross-gate reader a single shape to consume.
 *
 * ## Why the message names every source and its state
 *
 * "0 files validated" does not say whether a directory is missing,
 * present-and-empty, or present with nothing matching the filter, and those are
 * three different repairs: a wrong path, an empty layer, a filter that has
 * stopped matching what the corpus is named. Reporting the state per source
 * turns a refusal into an action.
 *
 * ## Why exit 2 rather than 1
 *
 * 1 is "determined, and it is wrong". 2 is "could not determine": a run that
 * examined nothing has not established that there are no errors. Same split
 * `check:bun-pin` and `check:red-gate-is-last` use for a scan that matched no
 * site.
 *
 * @covers none — a shared helper, not an audit of any declared graph typology
 * @graphNode tool
 */

/** One place a gate looked, and what it found there. */
export interface Source {
  /** Short name the reader will recognise from the gate's own output. */
  label: string;
  /** The resolved path, printed so a wrong root is visible rather than inferred. */
  dir: string;
  /** The directory exists. */
  present: boolean;
  /** Members found under it — files, entries, whatever the gate counts. */
  found: number;
}

/** What the refusing gate is, for a message a reader can act on. */
export interface Gate {
  /** The `bun run` target, so the reader can re-run exactly this. */
  script: string;
  /**
   * The declared graph typology this gate claims to audit, or `undefined`.
   *
   * Present because a vacuous pass is worse when a kind is credited to it:
   * `audit:coverage` reads `@covers` as coverage, so a gate that examined
   * nothing while declaring a kind makes that kind read as audited. Bean `3srh`
   * is the reason the declaration is trusted; this is what makes trusting it
   * safe.
   */
  covers?: string;
}

/**
 * Is this run's population empty, and if so what should the reader be told?
 *
 * Returns `undefined` when at least one source yielded something — the gate may
 * then pass or fail on its own findings. Returns the message to print before
 * exiting 2 when every source was empty.
 *
 * Pure and exported so the decision can be tested over a CONSTRUCTED empty
 * corpus. A gate cannot be pointed at one without moving directories, and a test
 * that moves directories during `bun test` repairs the tree other gates are
 * being judged on — bean `ymsu`, which is this defect's own shape one layer up.
 */
export function vacuityRefusal(gate: Gate, looked: readonly Source[]): string | undefined {
  if (looked.some((s) => s.found > 0)) return undefined;

  const width = Math.max(0, ...looked.map((s) => s.label.length));
  const rows = looked.map((s) => {
    const state = !s.present ? "ABSENT" : "present, nothing matched";
    return `  · ${s.label.padEnd(width)}  ${state}  (${s.dir})`;
  });

  const credited =
    gate.covers === undefined || gate.covers === "none"
      ? ""
      : `\n\nThis gate declares \`@covers ${gate.covers}\`, which \`audit:coverage\` reads as ` +
        `coverage of\nthat kind — so passing vacuously would credit \`${gate.covers}\` to a gate ` +
        `that examined\nnothing at all.`;

  const sourceList =
    looked.length === 0
      ? "  · (this gate recorded NO sources, which is its own defect — it cannot say\n" +
        "    where it looked)"
      : rows.join("\n");

  return (
    `\`${gate.script}\` examined 0 members — refusing to call that a clean run.\n\n` +
    `Every source it reads, and what was found:\n${sourceList}` +
    credited +
    `\n\nA filter over nothing passes, so a green verdict here would mean only that ` +
    `nothing was\nlooked at. Bean \`iym1\`; the class is \`6tkl\`.\n\n` +
    `If an empty population is legitimate for this instance, that is a decision to ` +
    `record\nwith its reason — the way \`check-bean-front-matter\` baselines its ` +
    `outstanding\nduplicates — not a run to let pass in silence.`
  );
}
