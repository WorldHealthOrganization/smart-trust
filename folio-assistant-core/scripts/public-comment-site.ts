#!/usr/bin/env bun
/**
 * public-comment-site — add the public review to a built document site: a
 * DASHBOARD of every comment and where it stands, and each comment shown
 * BESIDE the block it is about in the document itself. Bean `v26p`.
 *
 * Run after `build-document-site.ts`, over the same `--out`:
 *
 *   <out>/en/folio-assistant-core/public-comments/folio/<slug>/index.html   the dashboard
 *                                    (`public-comment-route.ts`: <handler>/<kind>/<subject>)
 *   <out>/folio-assistant-core/public-comments/folio/<slug>/comments.json   its data
 *   <out>/en/<slug>/index.html          gains a comment note at each anchored block
 *   <out>/<slug>/pc-notes.json          a lazy page's notes, as data
 *
 * Pages are under the page locale and data is not (issue #2527,
 * `document-site-route.ts`).
 *
 * ## Why the data is inlined, not fetched
 *
 * The same pages are opened from `file://` on a reviewer's machine and from
 * GitHub Pages. `fetch` fails on the first. A few hundred comments are tens of
 * kilobytes, so they go in the page as JSON.
 *
 * ## Deep links
 *
 * A comment whose decision names a change set gets two links to its anchor:
 * BEFORE on the published `main` site, and AFTER on the change set's staging
 * preview, `branches/<slug>/`. The slug is computed exactly as
 * `folio-staging.yml` computes it, so the link is where the preview is. A
 * comment with a discussion URL links it. Every comment also links a GitHub
 * search for its reference, which finds every issue and PR that mentions it.
 *
 * Nothing here decides anything. It renders the store, and the store is moved
 * only by `public-comment.ts`.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import type { ReviewAnchors } from "./docx-to-folio.js";
import { type ChangeSet, DECISION_LABELS, IN_EDIT_STATUSES, OPEN_STATUSES, type PublicComment } from "../schemas/public-comment.js";
import { changeSets, discussUrl } from "./public-comment-changesets.js";
import { Store, storeDirOf } from "./public-comment.js";
import { folioDir } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";
import { BLOCK_ACTIONS_CSS, compactActionsHtml, compactActionsScript, DEFAULT_TEMPLATE, readIssueForm, type BlockActionsConfig } from "./block-actions.js";
import { changeSetRouting, commentRouting, type Routing, type RoutingFile, TWG_GROUPS } from "./public-comment-routing.js";
import { dashboardPageRoute, dashboardRoute, toSiteRoot } from "./public-comment-route.js";
import { DOC_CLASS, DOCUMENT_END_MARKER, documentDataDir, documentPage, documentPageDir, fromPageDir, hydratedPage, REVIEW_PAGE_DIR } from "./document-site-route.js";
import { darkRules } from "@litlfred/cat-harness-tools/scripts/lib/scheme-css.ts";
import { escapeForRaw } from "@litlfred/cat-harness-tools/scripts/lib/liquid-raw.ts";
import { scopeCss } from "./scope-css.js";

// The preview directory (cat-harness-tools `schemas/sdlc/preview-prefix.ts`),
// named here rather than imported so this layer does not wait on that
// module's release.
const previewPath = (slug: string): string => `branches/${slug}`;

/** `folio-staging.yml`'s slug rule, step `slug`. */
export const stagingSlug = (branch: string) =>
  branch.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

/**
 * The change-set review page of a branch's staging preview:
 * `<site>/branches/<slug>/en/review/` (owner, 2026-10-30: a comment or
 * change-set with a pull request links its staging review page). With a
 * recorded `stagingUrl`, that preview's own review page.
 */
export const stagingReviewUrl = (site: string | undefined, branch: string, stagingUrl?: string): string | undefined => {
  const base = stagingUrl ? stagingUrl.replace(/\/$/, "") : site ? `${site.replace(/\/$/, "")}/${previewPath(stagingSlug(branch))}` : undefined;
  return base === undefined ? undefined : `${base}/${REVIEW_PAGE_DIR}/`;
};

/**
 * The repository's open pull requests, read from GitHub when the site is
 * built. A staging preview exists only while its pull request is open, so a
 * staging link is drawn only for these (owner, 2026-10-30: links to merged
 * PRs' previews 404). A change-set's `pr` can also name the pull request
 * that PROPOSED it, long merged. Undefined when GitHub cannot be read: then
 * no staging link is drawn rather than a dead one.
 */
export function openPullRequests(repo: string): ReadonlySet<number> | undefined {
  const r = spawnSync("gh", ["api", "--paginate", `repos/${repo}/pulls?state=open&per_page=100`, "--jq", ".[].number"], { encoding: "utf-8" });
  if (r.status !== 0) {
    console.warn(`public-comment-site: open pull requests of ${repo} not read (${(r.stderr || r.error?.message || "").trim().split("\n")[0]}); no staging links drawn`);
    return undefined;
  }
  return new Set(r.stdout.split("\n").filter(Boolean).map(Number));
}

/** Whether a pull request's staging preview can be linked: only while it is open. */
const isOpen = (openPrs: ReadonlySet<number> | undefined, n: number | undefined): boolean => n !== undefined && openPrs !== undefined && openPrs.has(n);

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * A URL from record data, or undefined when it may not be an href: only
 * http(s), protocol-relative, relative and fragment URLs are linked. Browsers
 * ignore control characters and spaces inside a scheme, so they are dropped
 * before the scheme is read.
 */
export const safeHref = (url: string | undefined | null): string | undefined => {
  if (!url) return undefined;
  const bare = String(url).replace(/[\u0000-\u0020\u007f]/g, "");
  if (/^https?:/i.test(bare)) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(bare)) return undefined;
  return url;
};

/** A link to a URL from record data, or its text alone when the URL is refused. */
const linkTo = (url: string | undefined | null, text: string): string => {
  const u = safeHref(url);
  return u ? `<a href="${esc(u)}">${esc(text)}</a>` : esc(text);
};

export interface SiteComment {
  ref: string;
  status: string;
  phase: "open" | "editing" | "decided" | "closed";
  type: string;
  target: string | null;
  section: string;
  sectionTitle: string;
  citation: string;
  anchorNote: string;
  confidence: string;
  summary: string;
  text: string;
  suggestion: string;
  reviewer: string;
  recommendations: Array<{ by: string; code: string; rationale: string; url?: string }>;
  /** The TWG sub-group the log routed it to (public-comment-routing.ts). */
  committee?: Routing;
  /** Its record, repo-relative: what [edit] opens and [feedback] names. */
  source?: string;
  decision?: { code: string; label: string; reason: string; by: string };
  /** The change-sets it is in (issue #2183), derived from the change-set records. */
  changeSets: Array<{ id: string; title: string; status: string; issue?: number; pr?: number; review?: string }>;
  links: { document?: string; before?: string; after?: string; pr?: string; review?: string; discussion?: string; search?: string; record?: string };
}

export function siteComments(
  all: PublicComment[],
  anchors: ReviewAnchors,
  opts: { slug: string; site?: string; repo?: string; storeDir?: string; changeSets?: ChangeSet[]; toRoot?: string; routing?: RoutingFile; openPrs?: ReadonlySet<number> },
): SiteComment[] {
  const toRoot = opts.toRoot ?? "../";
  const inSets = new Map<string, SiteComment["changeSets"]>();
  for (const cs of opts.changeSets ?? [])
    if (cs.status !== "merged") {
      const review = cs.pr && isOpen(opts.openPrs, cs.pr.number) ? stagingReviewUrl(opts.site, cs.pr.branch) : undefined;
      for (const r of cs.refs) (inSets.get(r) ?? inSets.set(r, []).get(r)!).push({ id: cs.id, title: cs.title, status: cs.status, ...(cs.issue ? { issue: cs.issue } : {}), ...(cs.pr ? { pr: cs.pr.number } : {}), ...(review ? { review } : {}) });
    }
  const blocks = new Map(anchors.blocks.map((b) => [b.label, b]));
  const sections = new Map(anchors.sections.map((s) => [s.label, s]));
  return all.map((c) => {
    const p = c.public;
    const b = c.targetLabel ? blocks.get(c.targetLabel) : undefined;
    const secLabel = b ? b.sections.at(-1) : c.targetLabel && sections.has(c.targetLabel) ? c.targetLabel : undefined;
    const sec = secLabel ? sections.get(secLabel) : undefined;
    const cs = p.decision?.changeSet;
    const frag = c.targetLabel ? `#${encodeURIComponent(c.targetLabel)}` : "";
    const phase = OPEN_STATUSES.includes(c.status)
      ? "open"
      : IN_EDIT_STATUSES.includes(c.status)
        ? "editing"
        : c.status === "decided"
          ? "decided"
          : "closed";
    const site = opts.site?.replace(/\/$/, "");
    return {
      ref: p.ref,
      status: c.status,
      phase,
      type: p.type ?? "",
      target: c.targetLabel,
      section: sec?.number ?? "",
      sectionTitle: sec?.title ?? "",
      citation: p.citation.raw ?? "",
      anchorNote: p.anchor.note ?? p.anchor.method,
      confidence: p.anchor.confidence,
      summary: c.summary,
      text: p.text,
      suggestion: p.suggestedRevision ?? "",
      reviewer: [p.reviewer.name, p.reviewer.organisation, p.reviewer.country].filter(Boolean).join(", ") || "a reviewer",
      recommendations: p.recommendations.map((r) => ({ by: r.by, code: r.code, rationale: r.rationale, ...(r.url ? { url: r.url } : {}) })),
      ...((routing) => (routing ? { committee: routing } : {}))(commentRouting(p.labels, opts.routing?.routings[p.ref])),
      ...(p.decision ? { decision: { code: p.decision.code, label: DECISION_LABELS[p.decision.code], reason: p.decision.reason, by: p.decision.by } } : {}),
      changeSets: inSets.get(p.ref) ?? [],
      ...(opts.storeDir ? { source: `${opts.storeDir}/comments/${p.ref}.json` } : {}),
      links: {
        ...(c.targetLabel ? { document: `${toRoot}${documentPage(opts.slug)}${frag}` } : {}),
        ...(site && c.targetLabel && cs ? { before: `${site}/${documentPage(opts.slug)}${frag}` } : {}),
        ...(cs ? { after: cs.stagingUrl ? `${cs.stagingUrl.replace(/\/$/, "")}/${documentPage(opts.slug)}${frag}` : site ? `${site}/${previewPath(stagingSlug(cs.branch))}/${documentPage(opts.slug)}${frag}` : undefined } : {}),
        ...(cs?.pr && opts.repo ? { pr: `https://github.com/${opts.repo}/pull/${cs.pr}` } : {}),
        // The staging review page: the comment's own change's, else that of
        // the first change-set it is in that has a pull request.
        ...((review) => (review ? { review } : {}))(
          (cs?.pr && isOpen(opts.openPrs, cs.pr) ? stagingReviewUrl(site, cs.branch, cs.stagingUrl) : undefined) ?? (inSets.get(p.ref) ?? []).find((x) => x.review)?.review,
        ),
        ...(p.discussion ? { discussion: p.discussion } : {}),
        ...(opts.repo ? { search: `https://github.com/${opts.repo}/search?type=issues&q=${encodeURIComponent(`"${p.ref}"`)}` } : {}),
        ...(opts.repo && opts.storeDir ? { record: `https://github.com/${opts.repo}/blob/main/${opts.storeDir}/comments/${p.ref}.json` } : {}),
      },
    };
  });
}

const STYLE = `
.cs-pcs > summary { cursor:pointer; }
.cs-pc-list { margin:.3rem 0 .6rem; padding-left:1.1rem; }
.cs-pc { margin:.5rem 0; padding-bottom:.4rem; border-bottom:1px solid #8883; }
.cs-pc p { margin:.25rem 0; }
  :root { color-scheme: light dark; --fg:#1b1b1b; --bg:#fdfdfb; --muted:#5b5b5b; --line:#d6d6d0; --link:#0b5cad; --chip:#eef2f7;
    --open:#9a5b00; --editing:#0b5cad; --decided:#2e6b2e; --closed:#5b5b5b; }
  ${darkRules(`:root { --fg:#e8e8e6; --bg:#161616; --muted:#a8a8a4; --line:#3a3a38; --link:#7db4ff; --chip:#23272e;
    --open:#f0b35a; --editing:#7db4ff; --decided:#8fd18f; --closed:#a8a8a4; }`)}
  body { margin:0; font:1rem/1.5 system-ui,sans-serif; color:var(--fg); background:var(--bg); }
  /* Column and gutters belong to main: the harness rail owns body padding-left. */
  main { max-width:90rem; margin:0 auto; padding:1.5rem 1.5rem 4rem; }
  a { color:var(--link); } a:focus-visible, button:focus-visible, select:focus-visible, input:focus-visible { outline:3px solid var(--link); outline-offset:2px; }
  .tiles { display:flex; flex-wrap:wrap; gap:.75rem; margin:1rem 0; }
  .tile { border:1px solid var(--line); border-radius:.5rem; padding:.5rem .9rem; min-width:7rem; font:inherit; color:var(--fg); background:transparent; text-align:left; cursor:pointer; }
  .tile b { display:block; font-size:1.6rem; }
  .tile:hover { border-color:var(--link); }
  main input[type=checkbox] { min-height:0; width:1.1rem; height:1.1rem; }
  .sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
  #open-issue { font:inherit; padding:.45rem .9rem; border:1px solid var(--link); border-radius:.4rem; background:transparent; color:var(--link); cursor:pointer; }
  #open-issue:disabled { opacity:.5; cursor:default; }
  .tile[aria-pressed="true"] { border-color:var(--link); box-shadow:inset 0 0 0 1px var(--link); background:var(--chip); }
  form { display:flex; flex-wrap:wrap; gap:.75rem; align-items:end; margin:1rem 0; }
  /* Form, table and details rules are scoped to main: the harness rail's header
     is a label too, and a bare label rule stacked it and hid its avatar. */
  main label { display:flex; flex-direction:column; font-size:.85rem; color:var(--muted); }
  main select, main input { font:inherit; padding:.35rem .5rem; color:var(--fg); background:var(--bg); border:1px solid var(--line); border-radius:.35rem; min-height:2.4rem; }
  .table-wrap { overflow-x:auto; }
  main table { border-collapse:collapse; width:100%; font-size:.92rem; }
  main th, main td { border-bottom:1px solid var(--line); padding:.45rem .5rem; text-align:left; vertical-align:top; }
  main th { position:sticky; top:0; background:var(--bg); }
  .phase { font-weight:600; white-space:nowrap; }
  .phase-open { color:var(--open); } .phase-editing { color:var(--editing); } .phase-decided { color:var(--decided); } .phase-closed { color:var(--closed); }
  .chip { display:inline-block; background:var(--chip); border-radius:.3rem; padding:0 .35rem; margin:0 .2rem .2rem 0; font-size:.82rem; }
  main details > summary { cursor:pointer; }
  .muted { color:var(--muted); }
  .links a { margin-right:.5rem; white-space:nowrap; }
`;

/** The dashboard. Filters run in the page; with scripts off the full table still renders. */
export function dashboardHtml(
  rows: SiteComment[],
  meta: {
    title: string; slug: string; generated: string; repo?: string; changeSets?: ChangeSet[]; toRoot?: string; records?: string;
    /** The published site, for each change-set's staging review page. */
    site?: string;
    /** The open pull requests: only their staging previews are linked. */
    openPrs?: ReadonlySet<number>;
    /** [edit] and [feedback] on every comment, the platform's block recipe (edit-links.ts). Absent: none. */
    actions?: BlockActionsConfig;
    /** The dashboard's own route, so a feedback issue links back to the comment. */
    page?: string;
  },
): string {
  const issueLink = (n: number) => (meta.repo ? `<a href="https://github.com/${esc(meta.repo)}/issues/${n}">#${n}</a>` : `#${n}`);
  // A change-set with an issue links it; one without offers to open it, which
  // is the moment it gets one (issue #2183: "dont create issue until someone
  // comments").
  const csCell = (c: { id: string; title: string; status: string; issue?: number }) =>
    `<span class="chip" title="${esc(c.title)} (${esc(c.status)})"><a href="#${esc(c.id)}">${esc(c.id)}</a>` +
    (c.issue ? ` ${issueLink(c.issue)}` : meta.repo ? ` <a href="${esc(discussUrl(meta.repo, c))}">discuss</a>` : "") +
    `</span>`;
  const sets = (meta.changeSets ?? []).filter((c) => c.status !== "merged");
  // EACH CHANGE-SET'S COMMITTEE (owner, 2026-10-13: "I expected to see the
  // Change Sets assigned to committees"): rolled up from its comments' TWG
  // routing, the plurality group first, the rest as counts.
  const byRef = new Map(rows.map((r) => [r.ref, r.committee]));
  const unroutedLabel = "not routed";
  const committeeOf = (r: SiteComment) => r.committee?.group ?? (r.committee ? "unmapped" : unroutedLabel);
  const csCommittee = (c: ChangeSet) => {
    const x = changeSetRouting(c.refs, byRef, c.committee);
    const gaps = [x.unmapped && `${x.unmapped} need a ruling`, x.total - x.routed - x.unmapped && `${x.total - x.routed - x.unmapped} not routed`].filter(Boolean).join(", ");
    if (c.committee) {
      const counts = x.counts.map((k) => `<span class="chip muted">${esc(k.group)} ${k.n}</span>`).join("");
      const moves = c.committeeMoves ?? [];
      const history = moves.length
        ? `<details class="cs-moves"><summary class="muted">move history (${moves.length})</summary><ul class="cs-move-list">${moves
            .map(
              (m) =>
                `<li>${esc(m.from ?? unroutedLabel)} → <b>${esc(m.to)}</b> · <span class="muted">${linkTo(m.url, m.who)}, ${esc(m.when.slice(0, 10))}</span> — ${esc(m.why)}</li>`,
            )
            .join("")}</ul></details>`
        : "";
      return {
        group: c.committee,
        cell: `<b>${esc(c.committee)}</b> <span class="chip">rerouted</span>${counts || gaps ? `<br>${counts}${gaps ? `<span class="muted">${esc(gaps)}</span>` : ""}` : ""}${history}`,
      };
    }
    const rest = x.counts.slice(1).map((k) => `<span class="chip muted">${esc(k.group)} ${k.n}</span>`).join("");
    return {
      group: x.group ?? unroutedLabel,
      cell: x.group
        ? `<b>${esc(x.group)}</b> <span class="muted">${x.counts[0]!.n} of ${x.total}</span><br>${rest}${gaps ? `<span class="muted">${esc(gaps)}</span>` : ""}`
        : `<span class="muted">${esc(gaps || unroutedLabel)}</span>`,
    };
  };
  const csRows = sets
    .map(
      (c) => `<tr id="${esc(c.id)}" data-cs-status="${esc(c.status)}" data-committee="${esc(csCommittee(c).group)}"><td>${esc(c.id)}</td><td>${esc(c.title)}<details><summary class="muted">requirements</summary><p>${esc(c.requirements).replace(/\n/g, "<br>")}</p></details><details class="cs-pcs" data-refs="${esc(c.refs.join(" "))}"><summary class="muted">its ${c.refs.length} comment${c.refs.length === 1 ? "" : "s"}, in full</summary></details></td><td class="cs-committee">${csCommittee(c).cell}</td><td>${esc(c.status)}</td><td class="cs-n">${c.refs.length}</td>` +
        `<td>${c.issue ? issueLink(c.issue) + (c.issues.length > 1 ? ` <span class="muted">+${c.issues.length - 1} more</span>` : "") : meta.repo ? `<a class="discuss" href="${esc(discussUrl(meta.repo, c))}">Discuss</a>` : "—"}</td>` +
        `<td>${c.pr && meta.repo ? `<a href="https://github.com/${esc(meta.repo)}/pull/${c.pr.number}">#${c.pr.number}</a>` : ""}` +
        `${((u) => (u ? ` <a class="review" href="${esc(u)}">review (staging)</a>` : ""))(safeHref(c.pr && isOpen(meta.openPrs, c.pr.number) ? stagingReviewUrl(meta.site, c.pr.branch) : undefined))}</td>` +
        `<td><a href="#" class="show-cs" data-refs="${esc(c.refs.join(" "))}">show its comments</a></td></tr>`,
    )
    .join("\n");
  const count = (f: (r: SiteComment) => boolean) => rows.filter(f).length;
  // A tile is a TOGGLE (owner, 2026-10-05: "some of these should be toggable"):
  // pressing it filters the table to what it counts, pressing it again clears
  // that filter. `key` names the filter; the script keeps the tiles and the
  // Status select in step, so whichever filter is on shows as pressed.
  const tile = (n: number, label: string, key: string) =>
    `<button type="button" class="tile" data-tile="${key}" aria-pressed="false" title="Show ${esc(label)}"><b>${n}</b>${esc(label)}</button>`;
  const linkList = (r: SiteComment) =>
    [
      r.links.document && linkTo(r.links.document, "in the document"),
      r.links.before && linkTo(r.links.before, "before"),
      r.links.after && linkTo(r.links.after, "after (staging)"),
      r.links.pr && linkTo(r.links.pr, "change set PR"),
      r.links.review && linkTo(r.links.review, "review (staging)"),
      r.links.discussion && linkTo(r.links.discussion, "discussion"),
      r.links.search && linkTo(r.links.search, "all mentions on GitHub"),
      r.links.record && linkTo(r.links.record, "record"),
    ]
      .filter(Boolean)
      .join(" ");
  // [edit] AND [feedback] ON EVERY COMMENT (owner, 2026-10-13), the same
  // affordance as every document block: [edit] opens the comment's record in
  // GitHub's editor, [feedback] a new issue that names its ref, so the
  // public-comment workflow links the issue to the comment. Compact form: the
  // hrefs are built in the page from data attributes, as 2,600 prefilled
  // issue URLs would weigh megabytes.
  const actionsOf = (r: SiteComment) =>
    meta.actions?.repo && r.source
      ? compactActionsHtml({ label: r.ref, source: r.source, ...(r.section || r.sectionTitle ? { section: `${r.section} ${r.sectionTitle}`.trim() } : {}) })
      : "";
  const body = rows
    .map(
      (r) => `<tr id="${esc(r.ref)}" data-phase="${r.phase}" data-status="${esc(r.status)}" data-placed="${r.target ? "1" : "0"}" data-incs="${r.changeSets.length ? "1" : "0"}" data-summary="${esc(r.summary)}" data-type="${esc(r.type)}" data-committee="${esc(committeeOf(r))}" data-section="${esc(r.section)}" data-text="${esc(`${r.ref} ${r.text} ${r.suggestion} ${r.sectionTitle}`.toLowerCase())}">
<td><input type="checkbox" class="pick" value="${esc(r.ref)}" aria-label="Select ${esc(r.ref)}"></td>
<td><a href="#${esc(r.ref)}">${esc(r.ref)}</a>${actionsOf(r)}</td>
<td class="phase phase-${r.phase}">${esc(r.status)}</td>
<td>${esc(r.type)}</td>
<td>${r.committee ? `${r.committee.group ? `<b>${esc(r.committee.group)}</b>` : `<span class="chip" title="names no TWG category: needs a ruling">${esc(r.committee.raw)}</span>`}${r.committee.secondary.map((g) => ` <span class="chip muted">${esc(g)}</span>`).join("")}<br><span class="muted"${r.committee.rationale ? ` title="${esc(r.committee.rationale)}"` : ""}>${r.committee.source === "human" && r.committee.by ? esc(r.committee.by) : r.committee.source}${r.committee.confidence && r.committee.confidence !== "high" ? `, ${r.committee.confidence}` : ""}</span>` : `<span class="muted">${unroutedLabel}</span>`}</td>
<td>${r.target ? `${esc(r.section)} ${esc(r.sectionTitle)}` : `<em>unplaced</em>`}<br><span class="muted">${esc(r.citation)}</span>${r.confidence !== "high" && r.target ? `<br><span class="chip" title="${esc(r.anchorNote)}">anchor: ${esc(r.confidence)}</span>` : ""}</td>
<td><details><summary>${esc(r.summary)}</summary><p>${esc(r.text)}</p>${r.suggestion ? `<p><b>Suggested revision:</b> ${esc(r.suggestion)}</p>` : ""}<p class="muted">${esc(r.reviewer)}</p></details></td>
<td>${r.recommendations.map((x) => `<span class="chip" title="${esc(x.rationale)}">${linkTo(x.url, `${x.by}: ${x.code}`)}</span>`).join("") || `<span class="muted">none</span>`}</td>
<td>${r.decision ? `<b>${esc(r.decision.label)}</b>${r.decision.reason ? `<br>${esc(r.decision.reason)}` : ""}<br><span class="muted">${esc(r.decision.by)}</span>` : `<span class="muted">not yet</span>`}</td>
<td>${r.changeSets.map(csCell).join(" ") || `<span class="muted">none</span>`}</td>
<td class="links">${linkList(r)}</td>
</tr>`,
    )
    .join("\n");
  const sections = [...new Set(rows.map((r) => r.section).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const types = [...new Set(rows.map((r) => r.type).filter(Boolean))].sort();
  const committees = [...TWG_GROUPS, "unmapped", unroutedLabel].filter((g) => rows.some((r) => committeeOf(r) === g) || sets.some((c) => csCommittee(c).group === g));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Public comments — ${esc(meta.title)}</title>
<style>${STYLE}${meta.actions?.repo ? BLOCK_ACTIONS_CSS + "#comments .block-actions { float:none; display:block; margin:.2rem 0 0; opacity:.8; } #comments .block-actions a { margin:0 .5rem 0 0; }" : ""}</style>
</head>
<body>
<main>
<p><a href="${esc(meta.toRoot ?? "../")}${esc(documentPage(meta.slug))}">← ${esc(meta.title)}</a></p>
<h1>Public comments</h1>
<p class="muted">Generated ${esc(meta.generated)} from the comment store. Open = not yet decided. Editing = decided, and the change is being made on a feature branch. Closed = incorporated, duplicate or withdrawn.</p>
<div class="tiles" role="group" aria-label="Filter by count">
${[
  tile(rows.length, "comments", "all"),
  tile(count((r) => r.phase === "open"), "open", "open"),
  tile(count((r) => !r.target), "unplaced", "unplaced"),
  tile(count((r) => r.phase === "editing"), "being edited", "editing"),
  tile(count((r) => r.phase === "decided"), "decided", "decided"),
  tile(count((r) => r.status === "incorporated"), "incorporated", "incorporated"),
  tile(count((r) => r.phase === "open" && !r.changeSets.length), "open, in no change-set", "noissue"),
].join("\n")}
</div>
<form id="filters" aria-controls="comments">
<label>Status<select id="f-phase"><option value="">all</option><option value="open" selected>open</option><option value="editing">being edited</option><option value="decided">decided</option><option value="closed">closed</option></select></label>
<label>Type<select id="f-type"><option value="">all</option>${types.map((t) => `<option>${esc(t)}</option>`).join("")}</select></label>
<label>Committee<select id="f-committee"><option value="">all</option>${committees.map((g) => `<option>${esc(g)}</option>`).join("")}</select></label>
<label>Section<select id="f-section"><option value="">all</option>${sections.map((s) => `<option>${esc(s)}</option>`).join("")}</select></label>
<label>Search<input id="f-text" type="search" placeholder="words, or PC-0042"></label>
<p id="f-count" class="muted" aria-live="polite"></p>
</form>
${
  sets.length
    ? `<details id="change-sets"><summary><b>Change-sets (${sets.length})</b>: ${["proposed", "discussing", "editing", "incorporated", "closed"].map((st) => `${sets.filter((c) => c.status === st).length} ${st}`).join(", ")}. A change-set gets its GitHub issue the first time somebody discusses it, recommends on it or decides it. <span id="cs-count" class="muted" aria-live="polite"></span></summary>
<div class="table-wrap"><table><thead><tr><th>Id</th><th>Change</th><th>Committee</th><th>Status</th><th>Comments</th><th>Issue</th><th>PR</th><th></th></tr></thead><tbody>
${csRows}
</tbody></table></div></details>`
    : ""
}
${meta.repo ? `<p class="picker"><button type="button" id="open-issue" disabled>New change-set from the selected comments</button> <span id="pick-count" class="muted">Tick comments to group them.</span></p>` : ""}
<div class="table-wrap">
<table id="comments">
<thead><tr><th><span class="sr">Select</span></th><th>Ref</th><th>Status</th><th>Type</th><th>Committee</th><th>Where</th><th>Comment</th><th>Recommendations</th><th>Decision</th><th>Change-set</th><th>Links</th></tr></thead>
<tbody>
${body}
</tbody>
</table>
</div>
</main>
${meta.actions?.repo ? compactActionsScript(meta.actions, meta.page) : ""}
<script>
(() => {
  const REPO = ${JSON.stringify(meta.repo ?? "")};
  // [edit]/[feedback]: fill a row's links when the row is reached. The shared
  // runtime fills on reaching the links' host, but a pointer that lands
  // straight on a link (no gap crossed) or keyboard focus never reaches it, as
  // an <a> without an href is not focusable.
  for (const ev of ["pointerover", "focusin", "touchstart"])
    document.addEventListener(ev, (e) => {
      const tr = e.target.closest && e.target.closest("#comments tbody tr");
      if (tr && window.faEditLinks && !tr.dataset.faFilled) { tr.dataset.faFilled = "1"; window.faEditLinks.fill(tr); }
    }, { passive: true });
  const $ = (id) => document.getElementById(id);
  const rows = [...document.querySelectorAll("#comments tbody tr")];
  const csTrs = [...document.querySelectorAll("#change-sets tbody tr")];
  const tiles = [...document.querySelectorAll(".tile[data-tile]")];

  // Pre-index DOM dataset attributes into memory once on load to eliminate
  // thousands of live DOMStringMap reflections and layout invalidations during filtering.
  const commentItems = rows.map((r) => ({
    el: r,
    id: r.id,
    phase: r.dataset.phase,
    status: r.dataset.status,
    type: r.dataset.type,
    committee: r.dataset.committee,
    section: r.dataset.section,
    text: r.dataset.text,
    placed: r.dataset.placed,
    incs: r.dataset.incs,
  }));

  const csItems = csTrs.map((tr) => {
    const a = tr.querySelector("a.show-cs");
    const countEl = tr.querySelector(".cs-n");
    const refs = a && a.dataset.refs ? a.dataset.refs.split(" ") : [];
    return {
      el: tr,
      committee: tr.dataset.committee,
      refs,
      countEl,
      total: refs.length,
    };
  });

  // Tiles that ARE a Status value set the select; the other two are extra filters.
  const PHASE_TILES = ["open", "editing", "decided"];
  let extra = null; // "unplaced" | "incorporated" | "noissue" | null
  let only = null; // a change-set's comments, from "show its comments"
  const active = () => extra ?? ($("f-phase").value || "all");
  const apply = () => {
    const ph = $("f-phase").value, ty = $("f-type").value, co = $("f-committee").value, se = $("f-section").value, tx = $("f-text").value.trim().toLowerCase();
    let n = 0;
    const shown = new Set();
    for (let i = 0; i < commentItems.length; i++) {
      const it = commentItems[i];
      const s = it.section;
      const ok = (!ph || it.phase === ph) && (!ty || it.type === ty) && (!co || it.committee === co)
        && (!se || s === se || s.startsWith(se + ".")) && (!tx || it.text.includes(tx))
        && (extra !== "unplaced" || it.placed === "0")
        && (extra !== "incorporated" || it.status === "incorporated")
        && (extra !== "noissue" || (it.incs === "0" && it.phase === "open"))
        && (!only || only.has(it.id));
      if (it.el.hidden !== !ok) it.el.hidden = !ok;
      if (ok) {
        n++;
        shown.add(it.id);
      }
    }
    $("f-count").textContent = n + " of " + commentItems.length + " shown";

    // Change-sets: update visibility and match counts from the in-memory index
    let m = 0;
    for (let j = 0; j < csItems.length; j++) {
      const cs = csItems[j];
      let k = 0;
      for (let r = 0; r < cs.refs.length; r++) {
        if (shown.has(cs.refs[r])) k++;
      }
      // Under a committee filter a change-set shows when it is that
      // committee's, even if only some of its comments are routed there.
      const csOk = co ? cs.committee === co : k > 0;
      if (cs.el.hidden !== !csOk) cs.el.hidden = !csOk;
      if (csOk) m++;
      if (cs.countEl) {
        const text = k === cs.total ? String(k) : k + " of " + cs.total;
        if (cs.countEl.textContent !== text) cs.countEl.textContent = text;
      }
    }
    if ($("cs-count")) $("cs-count").textContent = "Showing " + m + " of " + csItems.length + ", by the filters below.";
    const on = active();
    for (const t of tiles) t.setAttribute("aria-pressed", String(t.dataset.tile === on));
  };
  // BACK WORKS (D-3 of the 2026-10-06 walkthrough): every filter change is a
  // history entry whose query string holds the filters, so Back restores the
  // previous view instead of leaving the page. Typing in Search replaces the
  // entry rather than adding one per keystroke.
  const save = (push = true) => {
    const q = new URLSearchParams();
    const put = (k, v) => { if (v) q.set(k, v); };
    q.set("status", $("f-phase").value);
    put("type", $("f-type").value); put("committee", $("f-committee").value); put("section", $("f-section").value); put("q", $("f-text").value);
    put("tile", extra); put("only", only ? [...only].join(" ") : "");
    const url = "?" + q + location.hash;
    if (url !== location.search + location.hash) history[push ? "pushState" : "replaceState"](null, "", url);
  };
  function load() {
    const q = new URLSearchParams(location.search);
    if (!q.has("status")) return;
    $("f-phase").value = q.get("status"); $("f-type").value = q.get("type") ?? ""; $("f-committee").value = q.get("committee") ?? "";
    $("f-section").value = q.get("section") ?? ""; $("f-text").value = q.get("q") ?? "";
    extra = q.get("tile"); only = q.get("only") ? new Set(q.get("only").split(" ")) : null;
    apply();
  }
  for (const t of tiles) t.addEventListener("click", () => {
    const key = t.dataset.tile;
    // Pressing the tile that is on clears it: back to every comment.
    const clear = key === active() || key === "all";
    extra = !clear && !PHASE_TILES.includes(key) ? key : null;
    $("f-phase").value = !clear && PHASE_TILES.includes(key) ? key : "";
    only = null;
    apply(); save();
  });
  $("f-phase").addEventListener("input", () => { extra = null; });
  for (const a of document.querySelectorAll("a.show-cs")) a.addEventListener("click", (e) => {
    e.preventDefault();
    only = new Set(a.dataset.refs.split(" "));
    // Every one of its comments, whatever was filtered before.
    extra = null; for (const id of ["f-phase", "f-type", "f-committee", "f-section", "f-text"]) $(id).value = "";
    apply(); save();
    document.getElementById("comments").scrollIntoView();
  });
  // A CHANGE-SET'S COMMENTS IN FULL, IN PLACE (owner, 2026-10-06: "in addition
  // to jumping to comment from CS you can expand panel to see original PC
  // details (who, what..)", and "that can be dynamic JS load of KG"). The
  // records are LOADED when a panel is first opened, from "comments.json"
  // (the comment store as published), which stays at the dashboard's route
  // while the page is under the locale (issue #2527). Opened from file://,
  // where fetch fails, it falls back to the comment rows already on the page.
  let records = null;
  const loadRecords = () => (records ??= fetch(${JSON.stringify(meta.records ?? "comments.json").replace(/</g, "\\u003c")})
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((list) => new Map(list.map((x) => [x.ref, x])))
    .catch(() => null));
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const fromRecord = (x) => "<li class=\\"cs-pc\\"><a href=\\"#" + h(x.ref) + "\\">" + h(x.ref) + "</a> · " + h(x.status) + (x.type ? " · " + h(x.type) : "") + " · " + h(x.committee ? (x.committee.group || x.committee.raw) : "not routed") +
    "<div class=\\"muted\\">" + (x.target ? h(x.section + " " + x.sectionTitle) : "<em>unplaced</em>") + (x.citation ? " — " + h(x.citation) : "") + "</div>" +
    "<p>" + h(x.text) + "</p>" + (x.suggestion ? "<p><b>Suggested revision:</b> " + h(x.suggestion) + "</p>" : "") +
    "<p class=\\"muted\\">" + h(x.reviewer) + "</p>" +
    (x.recommendations && x.recommendations.length ? "<p>" + x.recommendations.map((r) => "<span class=\\"chip\\" title=\\"" + h(r.rationale) + "\\">" + h(r.by) + ": " + h(r.code) + "</span>").join("") + "</p>" : "") +
    "<div class=\\"cs-pc-decision\\">" + (x.decision ? "<b>" + h(x.decision.label) + "</b>" + (x.decision.reason ? " — " + h(x.decision.reason) : "") : "<span class=\\"muted\\">not decided yet</span>") + "</div></li>";
  const fromRow = (ref) => {
    const tr = document.getElementById(ref);
    if (!tr) return "<li>" + h(ref) + " <span class=\\"muted\\">(not on this page)</span></li>";
    const c = tr.cells;
    // Cells: pick, ref, status, type, committee, where, comment, recommendations, decision.
    const body = [...(c[6].querySelector("details")?.children || [])].filter((x) => x.tagName !== "SUMMARY").map((x) => x.outerHTML).join("");
    return "<li class=\\"cs-pc\\"><a href=\\"#" + h(ref) + "\\">" + h(ref) + "</a> · " + h(c[2].textContent) + (c[3].textContent ? " · " + h(c[3].textContent) : "") + " · " + h(tr.dataset.committee) +
      "<div class=\\"muted\\">" + c[5].innerHTML + "</div>" + body + "<div class=\\"cs-pc-decision\\">" + c[8].innerHTML + "</div></li>";
  };
  document.addEventListener("toggle", async (e) => {
    const d = e.target;
    if (!(d instanceof HTMLDetailsElement) || !d.classList.contains("cs-pcs") || !d.open || d.dataset.built) return;
    d.dataset.built = "1";
    const ul = document.createElement("ul");
    ul.className = "cs-pc-list";
    ul.innerHTML = "<li class=\\"muted\\">Loading…</li>";
    d.append(ul);
    const byRef = await loadRecords();
    ul.innerHTML = d.dataset.refs.split(" ").map((ref) => (byRef && byRef.get(ref) ? fromRecord(byRef.get(ref)) : fromRow(ref))).join("");
  }, true);
  // GROUPING (issue #2183): tick comments, open the "new change-set" issue
  // form prefilled with them. The repository's workflow records the change-set
  // from the form and adopts that issue as its own.
  const picker = $("open-issue");
  if (picker) {
    const picked = () => [...document.querySelectorAll("input.pick:checked")].map((x) => x.value);
    const sync = () => {
      const n = picked().length;
      picker.disabled = n === 0;
      $("pick-count").textContent = n ? n + " selected" : "Tick comments to group them.";
    };
    document.getElementById("comments").addEventListener("change", (e) => { if (e.target.classList.contains("pick")) sync(); });
    picker.addEventListener("click", () => {
      const refs = picked();
      if (!refs.length) return;
      const q = new URLSearchParams({ template: "change-set-new.yml", title: "New change-set: ", comments: refs.join(", ") });
      const url = "https://github.com/" + REPO + "/issues/new?" + q;
      window.open(url, "_blank", "noopener");
    });
    sync();
  }
  // A link to #PC-0042 shows that comment whatever the filters say; a link to
  // #CS-012 opens the change-sets list there.
  if (location.hash.startsWith("#PC-")) $("f-phase").value = "";
  if (location.hash.startsWith("#CS-") && $("change-sets")) { $("change-sets").open = true; document.getElementById(location.hash.slice(1))?.scrollIntoView(); }
  // A select replaces "show its comments" (it used to stay on, hidden, and
  // made every later filter look broken: D-2 of the 2026-10-06 walkthrough);
  // the search box narrows within it.
  for (const id of ["f-phase", "f-type", "f-committee", "f-section"]) $(id).addEventListener("input", () => { only = null; apply(); save(); });
  let searchDebounceTimer = null;
  $("f-text").addEventListener("input", () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => { apply(); save(false); }, 75);
  });
  addEventListener("popstate", load);
  addEventListener("hashchange", () => { if (location.hash.startsWith("#PC-")) { $("f-phase").value = ""; only = null; extra = null; apply(); } });
  load();
  apply();
})();
</script>
</body>
</html>
`;
}

/**
 * The note beside each anchored block, added to the document page. The
 * comments are inlined as JSON, and a small script places a collapsible note
 * after each block's anchor. With scripts off the document reads as before.
 */
/** Each anchored block's comments, as the document page's notes list them. */
export function notesByTarget(rows: SiteComment[]) {
  const byTarget: Record<string, Array<Pick<SiteComment, "ref" | "status" | "phase" | "type" | "summary" | "decision"> & { sets?: string[] }>> = {};
  for (const r of rows) {
    if (!r.target) continue;
    (byTarget[r.target] ??= []).push({ ref: r.ref, status: r.status, phase: r.phase, type: r.type, summary: r.summary, ...(r.decision ? { decision: r.decision } : {}), ...(r.changeSets.length ? { sets: r.changeSets.map((c) => c.id) } : {}) });
  }
  return byTarget;
}

/**
 * The document page's comment notes. Inline, the page carries every block's
 * list. With `notesUrl` (a lazy page, bean v433) it carries only each block's
 * counts and change-sets, and the list is fetched from that file the first
 * time a note is opened: 545 KB less on the DPI-H document.
 */
export function overlaySnippet(rows: SiteComment[], opts: { repo?: string; issues?: Record<string, number>; notesUrl?: string; dashboard: string }): string {
  const byTarget = notesByTarget(rows);
  const head = Object.fromEntries(
    Object.entries(byTarget).map(([label, list]) => [
      label,
      { n: list.length, o: list.filter((c) => c.phase === "open").length, s: [...new Set(list.flatMap((c) => c.sets ?? []))] },
    ]),
  );
  const json = JSON.stringify({ head, lists: opts.notesUrl ? null : byTarget, url: opts.notesUrl ?? null }).replace(/</g, "\\u003c");
  // The change-sets' issues, so a block's [feedback] can point at the
  // discussion that already exists (REQ-17, bean uphx).
  const meta = JSON.stringify({ repo: opts.repo ?? "", issues: opts.issues ?? {}, dashboard: opts.dashboard }).replace(/</g, "\\u003c");
  return `
<style>
  /* Owner, 2026-11-01 (Q-STY-2): a block's comments are a 💬 icon among its
     controls (cat-harness-tools' block panel), its list a pane that slides
     out from the right. Without the panel runtime the note pops over the
     text from the same right-hand box instead. */
  .block-actions { position:relative; float:right; margin-left:.6rem; font-size:.75rem; white-space:nowrap; opacity:.55; }
  .block-actions:hover, .block-actions:focus-within, .block-actions:has(.pc-note[open]) { opacity:1; }
  .pc-note { display:inline-block; position:relative; margin:0; padding:0; font-size:inherit; }
  .pc-note > summary { cursor:pointer; list-style:none; padding:0 .3rem; border-radius:4px; }
  .pc-note > summary::-webkit-details-marker { display:none; }
  .pc-note[open] > summary { background:var(--link,#0b5cad); color:#fff; }
  .pc-note > ul { position:absolute; right:0; top:1.7em; z-index:20; width:min(24rem,80vw); margin:0; padding:.5rem .8rem .5rem 1.8rem;
    white-space:normal; text-align:left; font-size:.85rem; line-height:1.45; background:var(--bg,#fff); color:var(--fg,inherit);
    border:1px solid #8886; border-radius:8px; box-shadow:0 8px 24px #0003; }
  .fa-block-panel .pc-list { margin:0; padding-left:1.1rem; }
  .fa-block-panel .pc-list li { margin:.45rem 0; }
  .fa-block-panel .pc-chips { display:flex; flex-wrap:wrap; gap:4px; margin:.3rem 0; }
  .fa-block-panel .pc-chips button { font:inherit; font-size:.78rem; padding:.1rem .5rem; border:1px solid #8886; border-radius:999px; background:none; color:inherit; cursor:pointer; }
  .fa-block-panel .pc-chips button[aria-pressed=true] { background:var(--link,#0b5cad); border-color:var(--link,#0b5cad); color:#fff; }
  .fa-block-panel .pc-q { width:100%; box-sizing:border-box; margin:.3rem 0; padding:.3rem .5rem; font:inherit; font-size:.82rem; border:1px solid #8886; border-radius:6px; background:none; color:inherit; }
  .fa-block-panel .pc-more { font:inherit; font-size:.8rem; padding:.25rem .6rem; border:1px solid #8886; border-radius:6px; background:none; color:inherit; cursor:pointer; }
  .pc-bar { position:sticky; top:0; z-index:1; padding:.4rem 0; background:var(--bg,#fdfdfb); border-bottom:1px solid #8884; margin-bottom:1rem; }
</style>
<script type="application/json" id="pc-data">${json}</script>
<script type="application/json" id="pc-meta">${meta}</script>
<script>
(() => {
  const pc = JSON.parse(document.getElementById("pc-data").textContent);
  const data = pc.head;
  let notes = null;
  const listOf = (label) => pc.lists ? Promise.resolve(pc.lists[label] || [])
    : (notes ??= fetch(pc.url).then((r) => (r.ok ? r.json() : Promise.reject(r.status))).catch(() => ({})))
      .then((all) => all[label] || []);
  const meta = JSON.parse(document.getElementById("pc-meta").textContent);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  // LIGHT ON LOAD (owner, 2026-10-06: ease "2,520 comment notes built all at
  // once"). Each block gets its one-line summary only; the list inside is
  // built the first time the note is opened. Blocks are done in small batches
  // in idle time, so the page never freezes, and a #fragment target is
  // re-scrolled to once at the end because the notes above it moved it.
  const item = (c) => "<li><a href=\\"" + esc(meta.dashboard) + "#" + esc(c.ref) + "\\">" + esc(c.ref) + "</a> · " + esc(c.status) +
    (c.type ? " · " + esc(c.type) : "") + (c.decision ? " · <b>" + esc(c.decision.label) + "</b>" : "") +
    " — " + esc(c.summary) + "</li>";
  const note = (label, h) => {
    const a = document.getElementById(label);
    if (!a) return;
    const host = a.parentElement && a.parentElement.tagName === "P" && a.parentElement.textContent.trim() === "" ? a.parentElement : a;
    // Into the block's control box first; a block with no box gets one, so
    // every block's controls look the same.
    let acts = document.querySelector('.block-actions[data-block="' + CSS.escape(label) + '"]');
    if (!acts) {
      acts = document.createElement("span");
      acts.className = "block-actions";
      acts.dataset.block = label;
      host.after(acts);
    }
    discussed(acts, h);
    const bp = panel();
    if (bp) { bp.icon(acts, "comments", h.n); return; }
    const d = document.createElement("details");
    d.className = "pc-note";
    const n = h.o;
    const sum = document.createElement("summary");
    sum.textContent = "💬 " + h.n + (n ? " (" + n + " open)" : "");
    sum.title = h.n + " public comment" + (h.n > 1 ? "s" : "") + (n ? ", " + n + " open" : "");
    d.append(sum);
    d.addEventListener("toggle", () => {
      if (!d.open || d.dataset.built) return;
      d.dataset.built = "1";
      const ul = document.createElement("ul");
      ul.innerHTML = "<li>Loading…</li>";
      d.append(ul);
      listOf(label).then((list) => { ul.innerHTML = list.map(item).join("") || "<li>Could not load the comments.</li>"; });
    });
    acts.prepend(d);
  };
  // Beside the block's [feedback]: the issues where its change-sets are
  // already being discussed, so a reader joins rather than duplicates.
  const discussed = (acts, h) => {
    const nums = [...new Set(h.s.map((id) => meta.issues[id]).filter(Boolean))];
    if (acts && meta.repo && nums.length) {
      const s = document.createElement("span");
      s.className = "ba-existing";
      s.innerHTML = "discussed in " + nums.map((n) => "<a href=\\"https://github.com/" + esc(meta.repo) + "/issues/" + n + "\\">#" + n + "</a>").join(" ");
      acts.append(s);
    }
  };
  // The block panel's comments pane, registered once the runtime is there.
  let bpReady = false;
  const panel = () => {
    const bp = window.faBlockPanel;
    if (!bp || bpReady) return bp;
    bpReady = true;
    // Owner, 2026-11-02: "only show the PCs ... applicable to selected
    // section. PCs only. filter + show more". The pane lists this block's
    // public comments only (no change-set links), with filter chips, a search
    // box once the list is long, and the first few with "Show more".
    bp.pane("comments", { icon: "\u{1F4AC}", title: "Public comments", render: (label, body) => {
      const h = data[label] || { n: 0, o: 0 };
      const sum = document.createElement("p");
      sum.className = "pc-sum";
      sum.innerHTML = h.n + " comment" + (h.n === 1 ? "" : "s") + (h.o ? ", " + h.o + " open" : "") + " \\u00b7 <a href=\\"" + esc(meta.dashboard) + "\\">all public comments</a>";
      const ul = document.createElement("ul");
      ul.className = "pc-list";
      ul.innerHTML = "<li>Loading…</li>";
      body.append(sum, ul);
      listOf(label).then((list) => {
        if (!list.length) { ul.innerHTML = "<li>Could not load the comments.</li>"; return; }
        const STEP = 5;
        let shown = STEP, chip = "all", q = "";
        const chips = [["all", "All", list.length], ["open", "Open", list.filter((c) => c.phase === "open").length]];
        for (const t of [...new Set(list.map((c) => c.type).filter(Boolean))].sort()) chips.push(["t:" + t, t, list.filter((c) => c.type === t).length]);
        const bar = document.createElement("div");
        bar.className = "pc-chips";
        if (chips.length > 2 || chips[1][2] !== list.length) for (const [k, txt, n] of chips) {
          if (!n) continue;
          const b = document.createElement("button");
          b.type = "button";
          b.dataset.k = k;
          b.textContent = txt + " " + n;
          b.setAttribute("aria-pressed", String(k === chip));
          bar.append(b);
        }
        const box = document.createElement("input");
        box.type = "search";
        box.className = "pc-q";
        box.placeholder = "Filter these comments";
        box.setAttribute("aria-label", "Filter these comments");
        const more = document.createElement("button");
        more.type = "button";
        more.className = "pc-more";
        const draw = () => {
          const hit = list.filter((c) => (chip === "all" || (chip === "open" ? c.phase === "open" : c.type === chip.slice(2))) &&
            (!q || (c.ref + " " + c.status + " " + (c.type || "") + " " + c.summary).toLowerCase().includes(q)));
          ul.innerHTML = hit.slice(0, shown).map(item).join("") || "<li>No comment matches.</li>";
          more.hidden = hit.length <= shown;
          more.textContent = "Show " + Math.min(STEP * 4, hit.length - shown) + " more (" + (hit.length - shown) + " left)";
        };
        bar.addEventListener("click", (e) => {
          const b = e.target.closest("button");
          if (!b) return;
          chip = b.dataset.k;
          shown = STEP;
          for (const x of bar.children) x.setAttribute("aria-pressed", String(x === b));
          draw();
        });
        box.addEventListener("input", () => { q = box.value.trim().toLowerCase(); shown = STEP; draw(); });
        more.addEventListener("click", () => { shown += STEP * 4; draw(); });
        if (bar.children.length) ul.before(bar);
        if (list.length > 8) ul.before(box);
        ul.after(more);
        draw();
      });
    } });
    return bp;
  };
  // A popped-over list closes on a click elsewhere or on Escape.
  const shut = (keep) => document.querySelectorAll(".pc-note[open]").forEach((d) => { if (d !== keep) d.open = false; });
  document.addEventListener("click", (e) => shut(e.target.closest && e.target.closest(".pc-note")));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") shut(null); });
  const entries = Object.entries(data);
  let total = 0, open = 0;
  for (const [, h] of entries) { total += h.n; open += h.o; }
  const idle = window.requestIdleCallback || ((f) => setTimeout(() => f({ timeRemaining: () => 8 }), 1));
  let i = 0;
  // A lazy document page keeps the reader's place as each batch lands
  // (\`faKeepPlace\`, build-document-site.ts), so nothing is seen to move;
  // any other page jumps back to the target once, at the end.
  const keep = window.faKeepPlace || ((f) => f());
  const batch = (deadline) => {
    keep(() => {
      do { if (i >= entries.length) break; note(entries[i][0], entries[i][1]); i++; } while (deadline.timeRemaining() > 2 || i % 40 !== 0);
    });
    if (i < entries.length) idle(batch);
    else if (!window.faKeepPlace && location.hash.length > 1) { try { document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ behavior: "instant" }); } catch {} }
  };
  idle(batch);
  const bar = document.createElement("div");
  bar.className = "pc-bar";
  bar.innerHTML = '<a href="' + esc(meta.dashboard) + '">Public comments</a>: ' + total + " shown in this document, " + open + " open";
  const main = document.querySelector(".fa-doc") || document.querySelector("main") || document.body;
  keep(() => main.prepend(bar));
})();
</script>
`;
}

/**
 * Where a comment's [edit] and [feedback] point: the store's repository on
 * main, coded with the document's slug, and the folio's block-feedback form
 * when it has one (as `defaultBlockActions` does for the document's blocks).
 */
export function commentActions(repoRoot: string, cfg: { repo?: string; document: string; site?: string }): BlockActionsConfig {
  const fields = readIssueForm(repoRoot, DEFAULT_TEMPLATE);
  return {
    ...(cfg.repo ? { repo: cfg.repo } : {}),
    branch: "main",
    content: cfg.document,
    ...(cfg.site ? { siteUrl: cfg.site } : {}),
    ...(fields ? { template: DEFAULT_TEMPLATE, templateFields: fields } : {}),
  };
}

/**
 * `html` with `snippet` added where the document page ends: before the
 * closing body tag of a standalone page, else before the
 * {@link DOCUMENT_END_MARKER} of a themed one (`--document-layout`), its
 * styles scoped under the page class and the whole escaped for the Liquid raw
 * block it lands in. A page with neither is an error, not a
 * page written back without its notes.
 */
export function atDocumentEnd(html: string, snippet: string, what = "the document page"): string {
  const body = html.lastIndexOf("</body>");
  if (body >= 0) return html.slice(0, body) + snippet + html.slice(body);
  const mark = html.lastIndexOf(DOCUMENT_END_MARKER);
  if (mark >= 0) {
    // Inside the layout, its rules go under the page class like the page's own.
    const scoped = snippet.replace(/<style>([\s\S]*?)<\/style>/g, (_m, css: string) => `<style>\n${scopeCss(css, `.${DOC_CLASS}`)}</style>`);
    return html.slice(0, mark) + escapeForRaw(scoped) + html.slice(mark);
  }
  throw new Error(`${what} has neither a closing body tag nor ${DOCUMENT_END_MARKER}: nowhere to add the comment notes`);
}

export function buildPublicCommentSite(repo: string, out: string, storeDir?: string) {
  const store = Store.open(repo, storeDir);
  const cfg = store.config() as ReturnType<Store["config"]> & { title?: string };
  const anchors = store.anchors();
  const sets = changeSets(store);
  const route = dashboardRoute(repo, cfg.document);
  const pageRoute = dashboardPageRoute(repo, cfg.document);
  const toRoot = toSiteRoot(pageRoute);
  const openPrs = cfg.repo ? openPullRequests(cfg.repo) : undefined;
  const rows = siteComments(store.all(), anchors, {
    changeSets: sets,
    ...(openPrs ? { openPrs } : {}),
    toRoot,
    slug: cfg.document,
    site: cfg.site,
    repo: cfg.repo,
    storeDir: relative(repo, store.dir).split("\\").join("/"),
    ...((f) => (existsSync(f) ? { routing: JSON.parse(readFileSync(f, "utf-8")) as RoutingFile } : {}))(join(store.dir, "routing.json")),
  });
  const docPage = join(out, ...documentPage(cfg.document).split("/"));
  if (!existsSync(docPage)) throw new Error(`${docPage} is missing: run build-document-site.ts --out ${out} first`);
  const issues = Object.fromEntries(sets.filter((c) => c.issue).map((c) => [c.id, c.issue!]));
  // A lazy document (bean v433) also publishes the whole text on one page,
  // index.hydrated.html; its comment notes are the same.
  for (const f of [docPage, join(out, ...hydratedPage(cfg.document).split("/"))]) {
    if (!existsSync(f)) continue;
    const html = readFileSync(f, "utf-8");
    if (html.includes('id="pc-data"')) continue;
    // A lazy page fetches its notes' lists; the one-page version carries them.
    const lazy = html.includes('id="fa-blocks"');
    // The notes are data: beside the document's other data, not its page.
    const notes = `${documentDataDir(cfg.document)}/pc-notes.json`;
    if (lazy) {
      mkdirSync(join(out, ...documentDataDir(cfg.document).split("/")), { recursive: true });
      writeFileSync(join(out, ...notes.split("/")), JSON.stringify(notesByTarget(rows)));
    }
    const fromDoc = documentPageDir(cfg.document);
    const snippet = overlaySnippet(rows, { ...(cfg.repo ? { repo: cfg.repo } : {}), issues, dashboard: `${fromPageDir(fromDoc, pageRoute)}/index.html`, ...(lazy ? { notesUrl: fromPageDir(fromDoc, notes) } : {}) });
    writeFileSync(f, atDocumentEnd(html, snippet, f));
  }
  const dash = join(out, ...pageRoute.split("/"));
  const data = join(out, ...route.split("/"));
  mkdirSync(dash, { recursive: true });
  mkdirSync(data, { recursive: true });
  writeFileSync(
    join(dash, "index.html"),
    dashboardHtml(rows, {
      title: cfg.title ?? cfg.document,
      slug: cfg.document,
      ...(cfg.site ? { site: cfg.site } : {}),
      ...(openPrs ? { openPrs } : {}),
      toRoot,
      records: fromPageDir(pageRoute, `${route}/comments.json`),
      ...(cfg.repo ? { repo: cfg.repo } : {}),
      ...(cfg.repo ? { actions: commentActions(repo, cfg), page: `${pageRoute}/index.html` } : {}),
      changeSets: sets,
      generated: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
    }),
  );
  writeFileSync(join(data, "comments.json"), JSON.stringify(rows, null, 1) + "\n");
  return { route: pageRoute, comments: rows.length, open: rows.filter((r) => r.phase === "open").length };
}

/**
 * What this builder READS (bean `ehh6`), repo-relative: the comment store,
 * and the folio, where each comment's anchors and block text live. `args` are
 * the ones the build command passes.
 */
export function siteReads(repoRoot: string, args: string[] = []): string[] {
  const opt = (n: string) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const repo = resolve(repoRoot, opt("repo") ?? ".");
  const rel = (p: string) => relative(repoRoot, p).split("\\").join("/");
  const store = opt("store");
  return [rel(store === undefined ? storeDirOf(repo) : resolve(repo, store)), rel(folioDir(repo))];
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (n: string) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  if (args.includes("--help")) {
    console.log("usage: bun run folio-assistant-core/scripts/public-comment-site.ts [--repo <folio root>] [--out _site] [--store review/public-comment]");
    process.exit(0);
  }
  const repo = resolve(opt("repo") ?? process.cwd());
  try {
    const r = buildPublicCommentSite(repo, resolve(repo, opt("out") ?? "_site"), opt("store"));
    console.error(`✓ public comments: ${r.comments} (${r.open} open) → ${r.route}/index.html`);
  } catch (e) {
    console.error(`✗ ${(e as Error).message}`);
    process.exit(1);
  }
}
