/**
 * Is a pinned upstream dependency still at the newest release we would accept?
 *
 * The decision logic only — reading files, talking to a remote and printing
 * live in `scripts/check-upstream-pins.ts`, so every rule below is testable
 * without a network.
 *
 * THE THIRD STATE IS THE POINT. `current`, `behind` and **`unknown`** are three
 * answers, not two-and-an-error. An upstream we could not reach, a pattern that
 * matched nothing and a tag list we could not order are all `unknown`, and
 * `unknown` is never rendered as `current` — the same rule `check-ci-health.ts`
 * follows and the same rule `readme-links.ts` follows for a ref it cannot read.
 * A watcher that reports "fine" when it has gone blind is worse than no watcher,
 * because it is believed.
 *
 * @module src/upstream/pins
 */

/** One row of `upstream-pins.json`. */
export interface PinDef {
  id: string;
  title: string;
  /** Upstream git URL — tags are read from it with `git ls-remote`. */
  repo: string;
  /** The file that actually holds the pin literal. */
  pinnedIn: string;
  /** Anchored, multiline regex over that file; capture group 1 is the ref. */
  pattern: string;
  /** Which tags count as a release we would adopt. */
  tagPattern: string;
  /**
   * What upstream prefixes its tags with, when the pinned literal cannot carry
   * it.
   *
   * `just-the-docs` needs none: `docs/_config.yml` holds `v0.12.0` and upstream
   * tags it `v0.12.0`, so the pin literal IS the tag. Bun's cannot be —
   * `setup-bun` and `.bun-version` take a bare `1.3.14` while upstream tags
   * `bun-v1.3.14`, so a literal that matched the tag would be a literal the
   * build rejects.
   *
   * Without this, {@link assessPin} compares `1.3.14` against a list of
   * `bun-v…` tags, finds no match, and returns `unknown` — FOREVER, with the
   * detail "a sha, a branch or a withdrawn tag". That is the watchdog's failure
   * mode in its other direction: not blind and claiming health, but permanently
   * crying blind, which trains a reader to stop looking. Measured before this
   * field existed.
   */
  tagPrefix?: string;
  /** Upstream directories whose changes can reach our rendered output. */
  themedPaths?: string[];
  /** What of OURS reaches into this dependency — the impact-analysis list. */
  binds?: string[];
  /** The commands that constitute this tenant's MVP. */
  mvp?: string[];
}

export interface PinRegistry {
  pins: PinDef[];
}

/** One registry file, read: the layer that declares it and the root its `pinnedIn` paths resolve against. */
export interface LoadedRegistry {
  /** The instance that declares the registry, e.g. `cat-harness`. */
  layer: string;
  /** That instance's root on disk; every row's `pinnedIn` resolves against it. */
  root: string;
  pins: PinDef[];
}

/** A row ready to check: the pin, its layer, and the absolute path of its `pinnedIn` file. */
export interface LocatedPin {
  pin: PinDef;
  layer: string;
  file: string;
}

/**
 * Every row of every registry, each resolved against ITS OWN layer's root.
 *
 * Each layer declares the pins whose files it holds. A harness row cannot
 * name a file in the tool layer above it, because that is a wrong-direction
 * reference (`check:reference-direction`). When bean `70lx` moved
 * `scripts/pdf-viewer.ts` up into cat-harness-tools, the harness row could no
 * longer find it, and the watchdog reported `unknown` every week from
 * 2026-10-20 (folio-assistant#1481).
 *
 * The same `id` in two registries is returned twice, so the caller reports
 * both rows. That is the expected state while a row moves between layers: the
 * row whose file is gone stays `unknown` until it is deleted, and nothing is
 * silently merged.
 */
export function locatePins(registries: readonly LoadedRegistry[], join: (root: string, rel: string) => string): LocatedPin[] {
  return registries.flatMap((r) => r.pins.map((pin) => ({ pin, layer: r.layer, file: join(r.root, pin.pinnedIn) })));
}

/**
 * The verdict for a row whose `pinnedIn` file is not on disk.
 *
 * Kept apart from "no ref matched", because the two need different fixes. A
 * missing file means the row points at the wrong layer or path. A pattern
 * that matches nothing means the line in the file changed.
 */
export function missingFileVerdict(located: LocatedPin): PinVerdict {
  return {
    id: located.pin.id,
    title: located.pin.title,
    state: "unknown",
    detail: `${located.pin.pinnedIn} is not in ${located.layer} (looked at ${located.file}). The file moved or the row is in the wrong layer's registry; each layer declares the pins whose files it holds.`,
  };
}

export type PinState = "current" | "behind" | "unknown";

export interface PinVerdict {
  id: string;
  title: string;
  state: PinState;
  /** The ref read out of `pinnedIn`, when it could be read. */
  pinned?: string;
  /** The newest tag matching `tagPattern`, when the list could be read. */
  latest?: string;
  /** Releases strictly newer than the pin, oldest first. */
  behindBy?: string[];
  /** Why, in one sentence a reader can act on. */
  detail: string;
}

/**
 * The pinned ref, read out of the file the build reads.
 *
 * Returns `undefined` when the pattern matches nothing, and the caller turns
 * that into `unknown` rather than into "not pinned". A pattern that has drifted
 * away from the file looks exactly like an unpinned dependency, and treating it
 * as one would silently stop watching the thing this registry exists to watch.
 */
export function readPin(fileText: string, pattern: string): string | undefined {
  const re = new RegExp(pattern, "m");
  const m = re.exec(fileText);
  return m?.[1];
}

/**
 * Order two `vX.Y.Z` tags.
 *
 * Numeric per component, so `v0.10.0` sorts ABOVE `v0.9.0` — the trap that
 * makes a lexicographic sort of this repo's own upstream report the wrong
 * newest release. Anything the pattern admits but this cannot parse compares
 * as lower than everything, which keeps it from being announced as "newest".
 */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string): number[] => {
    const m = /(\d+(?:\.\d+)*)/.exec(v);
    if (!m) return [-1];
    return m[1].split(".").map((n) => Number(n));
  };
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** The tags matching `tagPattern`, oldest first. */
export function releases(tags: string[], tagPattern: string): string[] {
  const re = new RegExp(tagPattern);
  return tags.filter((t) => re.test(t)).sort(compareVersions);
}

/**
 * One pin's verdict.
 *
 * `tags: undefined` means the remote could not be read — `unknown`, never
 * `current`. A pin at a ref that is NOT in the release list is also `unknown`
 * and not `behind`: it may be a commit sha, a branch, or a tag upstream has
 * deleted, and "behind by every release" would be a confident wrong answer.
 */
export function assessPin(pin: PinDef, pinned: string | undefined, tags: string[] | undefined): PinVerdict {
  const base = { id: pin.id, title: pin.title };
  if (!pinned) {
    return {
      ...base,
      state: "unknown",
      detail: `no ref matched /${pin.pattern}/ in ${pin.pinnedIn} — the pattern has drifted, or the pin was removed.`,
    };
  }
  if (!tags) {
    return { ...base, state: "unknown", pinned, detail: `could not read tags from ${pin.repo}.` };
  }
  const rel = releases(tags, pin.tagPattern);
  if (rel.length === 0) {
    return {
      ...base,
      state: "unknown",
      pinned,
      detail: `${pin.repo} has no tag matching /${pin.tagPattern}/ — nothing to compare against.`,
    };
  }
  const latest = rel[rel.length - 1];
  // The pin literal is what the BUILD reads; the tag is what upstream
  // publishes. They coincide for most dependencies and cannot for some, so the
  // comparison is done on the tag form and every message still reports the
  // literal a reader will find in `pinnedIn`.
  const tag = `${pin.tagPrefix ?? ""}${pinned}`;
  if (!rel.includes(tag)) {
    return {
      ...base,
      state: "unknown",
      pinned,
      latest,
      detail:
        `pinned at "${pinned}"${pin.tagPrefix ? ` (looked for tag "${tag}")` : ""}, which is not one ` +
        `of the ${rel.length} release(s) upstream lists. ` +
        `A sha, a branch or a withdrawn tag — say which, rather than reporting it behind.`,
    };
  }
  const behindBy = rel.slice(rel.indexOf(tag) + 1);
  if (behindBy.length === 0) {
    return { ...base, state: "current", pinned, latest, behindBy: [], detail: `at ${latest}, the newest release.` };
  }
  return {
    ...base,
    state: "behind",
    pinned,
    latest,
    behindBy,
    detail: `pinned at ${pinned}; ${behindBy.length} newer release(s), newest ${latest}.`,
  };
}

/** 0 = every pin current · 1 = at least one behind · 2 = at least one unknown. */
export function exitCode(verdicts: PinVerdict[]): 0 | 1 | 2 {
  if (verdicts.some((v) => v.state === "unknown")) return 2;
  if (verdicts.some((v) => v.state === "behind")) return 1;
  return 0;
}

const MARK: Record<PinState, string> = { current: "✓", behind: "▲", unknown: "?" };

/**
 * The tracking issue's body, and the console report.
 *
 * Written for someone who has not read the registry: every pin names the file
 * its literal lives in and the process that governs moving it, so the reader
 * can act without opening anything first.
 */
export function render(verdicts: PinVerdict[]): string {
  const lines: string[] = ["## Pinned upstream dependencies", ""];
  if (verdicts.length === 0) {
    lines.push("`upstream-pins.json` declares no pins.", "");
    return lines.join("\n");
  }
  lines.push("| | Dependency | Pinned | Newest release | State |", "|---|---|---|---|---|");
  for (const v of verdicts) {
    lines.push(
      `| ${MARK[v.state]} | ${v.title} | \`${v.pinned ?? "—"}\` | \`${v.latest ?? "—"}\` | ${v.state} |`,
    );
  }
  lines.push("");
  for (const v of verdicts) {
    lines.push(`- **${v.title}** (\`${v.id}\`) — ${v.detail}`);
    if (v.behindBy?.length) lines.push(`  - newer: ${v.behindBy.map((t) => `\`${t}\``).join(", ")}`);
  }
  lines.push(
    "",
    "Moving a pin is the `upstream-version-adoption` process — impact analysis, an MVP",
    "deployed to staging, review, and a **person** deciding. See",
    "`skills/process/process-core/upstream-version-adoption.md`. `unknown` is not `current`:",
    "it means this check could not tell, and it is never reported as green.",
  );
  return lines.join("\n");
}
