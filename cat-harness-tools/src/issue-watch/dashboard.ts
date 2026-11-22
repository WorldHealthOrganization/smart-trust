/**
 * The project-management dashboard an agent maintains in an issue's body.
 *
 * #203 (2026-09-18): a folio's project manager should get status at a glance,
 * and someone meeting the issue for the first time — or after a long gap —
 * should not have to read forty comments to find out where it stands.
 *
 * ## The rule this module exists to enforce
 *
 * **A field is either computed or it is not determined.** The requested status
 * vocabulary splits cleanly in two, and rendering both halves with the same
 * badge would make the dashboard uniformly authoritative while half of it was
 * guesswork:
 *
 *   COMPUTED   `synchronized` · `ready for review` · `dirty` — all derivable
 *              from the branch, the publish ref and the staging build.
 *   ASSERTED   `stalled`, level of effort, "expected to finish in …" — these
 *              are judgements, and an agent has no measurement behind them.
 *
 * So the asserted half renders as **not determined**, with a note saying who
 * can fill it in. That is the same doctrine the README sections and the CI
 * health report already follow: "could not determine" is a third state, never
 * rendered as the good one.
 *
 * Getting this wrong is not cosmetic. A PM reading an effort estimate styled
 * like a measurement will plan against it.
 */

/**
 * The branch head that a staging build's reported sha corresponds to.
 *
 * THE branches/ COMMENT DOES NOT REPORT THE BRANCH HEAD. `feature-staging.yml`
 * stamps `${{ github.sha }}`, and on a `pull_request` event that is the MERGE
 * COMMIT GitHub synthesises at `refs/pull/N/merge` — a commit that does not
 * exist in a contributor's clone at all, so comparing it to `git rev-parse
 * HEAD` fails in a way that looks like "staging is stale" rather than like
 * "you are comparing the wrong things".
 *
 * Its second parent is the branch head. Measured 2026-09-18 on PR #249:
 * reported `dbf361c`, parents `6dc2f29` (base) and `d645772` (head), where
 * `d645772` was the branch head — so staging was current while a naive
 * comparison said otherwise.
 *
 * Returns undefined when the merge ref cannot be fetched, because "could not
 * tell" must not collapse into "stale".
 */
export function stagingHeadFromMergeSha(
  reported: string,
  resolveSecondParent: (sha: string) => string | undefined,
): string | undefined {
  return resolveSecondParent(reported);
}

/** Branch state relative to `main` and to what branches/ last published. */
export type SyncState =
  | "synchronized"    // branch has nothing main lacks; rendering matches
  | "ready-for-review" // STAGING published at the branch's current head
  | "dirty"           // branch has commits STAGING has not rendered
  | "not-determined"; // could not read one of the inputs

export interface SyncInputs {
  /** Branch head sha, or undefined if it could not be read. */
  headSha?: string;
  /** Sha branches/ last published, or undefined if no staging build is known. */
  stagingSha?: string;
  /** Commits on the branch not yet in the base branch. */
  commitsAhead?: number;
}

/**
 * Derive the sync state, or decline.
 *
 * Declining is a real outcome and is returned as such — a missing staging sha
 * means "we do not know whether branches/ is current", which is NOT the same as
 * "branches/ is stale", and reporting the latter would send a reviewer to a page
 * that may be perfectly fine.
 */
export function syncState(i: SyncInputs): SyncState {
  if (!i.headSha) return "not-determined";
  if (i.commitsAhead === 0) return "synchronized";
  if (i.stagingSha === undefined) return "not-determined";
  return i.stagingSha === i.headSha ? "ready-for-review" : "dirty";
}

const BADGE: Record<SyncState, string> = {
  synchronized: "🟢 **synchronized**",
  "ready-for-review": "🔵 **ready for review**",
  dirty: "🟡 **dirty**",
  "not-determined": "⚪ **not determined**",
};

const MEANING: Record<SyncState, string> = {
  synchronized: "the branch holds nothing `main` lacks; the published site matches",
  "ready-for-review": "STAGING is published at the branch's current head — what you see is what the branch contains",
  dirty: "the branch has commits STAGING has not rendered; the preview is behind the code",
  "not-determined": "an input could not be read, so no claim is made either way",
};

export interface RequestRow {
  /** Short description of the request. */
  what: string;
  /** Where it came from — a comment link, or "initial request". */
  source: string;
  /** Computed state, or undefined when the item is not branch-shaped. */
  state?: SyncState;
  /** One line of narrative. Facts only; no estimates. */
  note: string;
}

export interface DashboardInputs {
  generatedAt: string;
  sync: SyncState;
  requests: RequestRow[];
  /** Issue numbers referenced, e.g. [197, 206]. */
  related: number[];
  repo: string;
}

/** Render the dashboard block that lives at the end of the issue body. */
export function renderDashboard(d: DashboardInputs): string {
  const L: string[] = [];
  L.push("<!-- folio:dashboard:begin -->");
  L.push("## 📊 Project status");
  L.push("");
  L.push(`**Branch state:** ${BADGE[d.sync]} — ${MEANING[d.sync]}`);
  L.push("");
  L.push("| Request | Source | State | Note |");
  L.push("|---|---|---|---|");
  for (const r of d.requests) {
    const badge = r.state ? BADGE[r.state] : "—";
    L.push(`| ${r.what} | ${r.source} | ${badge} | ${r.note} |`);
  }
  L.push("");
  L.push("### Not determined");
  L.push("");
  L.push(
    "**Level of effort (done / remaining)** and **stalled** are deliberately blank. " +
      "They are judgements, not measurements, and an agent asserting them with the " +
      "same badge styling as the computed fields would make the whole table read as " +
      "equally reliable. A PM reading an invented estimate will plan against it.",
  );
  L.push("");
  L.push("These are for the BA or project manager to fill in.");
  if (d.related.length) {
    L.push("");
    L.push(
      `**Related:** ${d.related.map((n) => `[#${n}](https://github.com/${d.repo}/issues/${n})`).join(" · ")}`,
    );
  }
  L.push("");
  L.push(`<sub>Maintained by the agent working this issue. Last computed ${d.generatedAt}.</sub>`);
  L.push("<!-- folio:dashboard:end -->");
  return L.join("\n");
}

/**
 * Splice the dashboard into an issue body, replacing any previous one.
 *
 * Marker-delimited and append-only outside the markers, for the same reason
 * `readme-sections.ts` works that way: the body is the AUTHOR'S text, and a
 * tool that rewrites the whole thing will one day eat something they wrote.
 */
export function spliceDashboard(body: string, block: string): string {
  const begin = "<!-- folio:dashboard:begin -->";
  const end = "<!-- folio:dashboard:end -->";
  const i = body.indexOf(begin);
  const j = body.indexOf(end);
  if (i !== -1 && j !== -1 && j > i) {
    return body.slice(0, i) + block + body.slice(j + end.length);
  }
  return `${body.trimEnd()}\n\n---\n\n${block}\n`;
}
