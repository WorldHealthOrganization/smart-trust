/**
 * Argv helpers for the pipeline CLIs.
 *
 * ## Why this exists
 *
 * Thirteen scripts read `--paper <name>` and every one of them took the token
 * after the flag without checking it was a value. `--paper --apply` therefore
 * handed {@link requirePaper} the string `"--apply"` — which it returns
 * unchanged, an explicit name being trusted by design, since naming a paper
 * directory is exactly what an explicit argument means — and the run failed
 * much later looking for a paper directory called `--apply`. A trailing
 * `--paper` yielded `undefined` and fell through to
 * `"N papers found — name one explicitly"`, hiding the fact that the caller
 * *had* tried to name one.
 *
 * Reported by the PR review bot on folio-assistant#151, fixed there in
 * `prune-transitive-deps.ts` alone; this module is the sweep.
 *
 * ## Why not reuse the `flagValue` that already existed
 *
 * `scripts/lean-coverage.ts` and `scripts/section-story-audit.ts` each carry a
 * verbatim copy of a `flagValue` that *does* guard — it returns `null` when the
 * flag is missing, last, or followed by another `--` token. Two reasons it is
 * not what the `--paper` readers want, and one reason it stays:
 *
 * - It returns `null` **silently**, so a caller who typed `--paper --apply`
 *   still lands on "N papers found" and is never told what went wrong. Naming
 *   the mistake is the whole point of the fix.
 * - Those two scripts also use it for `--out`, `--severity`, `--ref` and
 *   `--content-root`, where "flag present, no value" returning `null` is the
 *   established contract. Making it throw would change behaviour well beyond
 *   `--paper`.
 *
 * So the lenient `flagValue` stays where it is, and this one is deliberately
 * named differently rather than shadowing it: two same-named helpers with
 * opposite behaviour on the same input is the trap this module exists to avoid.
 */

/**
 * Value of a `--flag <value>` pair, refusing a flag supplied without one.
 *
 * Returns `undefined` when the flag is absent — that is not an error, it means
 * "not specified". **Throws** when the flag is present but the next token is
 * missing or begins with `-`, because that is a typo the caller wants to hear
 * about immediately rather than as a confusing failure three steps later.
 *
 * The hyphen test means a value may not itself begin with `-`. That holds for
 * every current use (paper directory names, chapter slugs, output paths); a
 * future flag taking a negative number needs its own reader, not a relaxation
 * of this one.
 */
export function requireFlagValue(
  argv: readonly string[],
  flag: string,
): string | undefined {
  const i = argv.indexOf(flag);
  if (i === -1) return undefined;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith("-")) {
    throw new Error(
      `${flag} needs a value — \`${flag} <value>\`. ` +
        (v === undefined
          ? "Nothing followed it."
          : `Got \`${v}\`, which is another flag.`),
    );
  }
  return v;
}

/**
 * The `--paper <name>` argument, guarded. Pass the argv the caller already has;
 * searching the full `process.argv` is equivalent, since `--paper` cannot
 * collide with the interpreter or script path.
 *
 * Feed the result straight to `requirePaper`, which supplies the sole-paper
 * default when this returns `undefined`.
 */
export function paperArg(argv: readonly string[] = process.argv): string | undefined {
  return requireFlagValue(argv, "--paper");
}

