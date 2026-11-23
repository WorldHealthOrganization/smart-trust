/**
 * The journeys viewer's links to the DAK's own pages: a BPMN step's title to
 * the step's page, a persona to its actor's page in the IG, an artefact to
 * its page in the IG. Every such link carries {@link DAK_ATTR}, so
 * {@link checkDakLinks} can find them in a staged site and say which do not
 * resolve.
 *
 * @module scripts/journeys/dak-links
 *
 * Owner, 2026-11-06: *"make sure bpmn and archimate diagrams are clickable
 * per usual KG rendering"*, and *"link to personas and other DAK assets in
 * the IG"*. Nothing here decides where a step's page is: the BPMN title links
 * are `src/workflow/diagram-links.ts`'s `linkSteps`, given the href the
 * caller's {@link SiteLinks.stepPage} answers (`subjectHref`, as
 * `render-bpmn.ts` does for the site's `workflows/` copy). An IG page is
 * linked only when the IG's artefact index lists it: an asset with no page is
 * left as text, never given a guessed link.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";

import type { DakLink, DakRel } from "../../schemas/process/user-scenario.ts";
import type { WorkshopPresentation } from "../../schemas/process/workshop.ts";
import { linkSteps, stepsOf } from "../../src/workflow/diagram-links.ts";
import { instanceFile, lookup, processDrawing, type JourneyCorpus } from "./read.ts";

/** The attribute every link to a DAK asset carries. */
export const DAK_ATTR = "data-jv-dak";

/** Where the step pages and IG patterns are, as the generator was told (`SiteLinks`). */
export interface StepPageLinks {
  /**
   * The page of flow node `task` of process `process`, drawn in `bpmn`
   * (instance-relative): an absolute IRI, or a path from the site's root.
   */
  stepPage?: (instance: string, bpmn: string, process: string, task: string) => string | undefined;
}

const ABSOLUTE = /^[a-z][a-z0-9+.-]*:/i;

/** An href as a page at `siteRoot` writes it: an absolute IRI as it is, a site path from the site's root. */
export const fromSiteRoot = (href: string, siteRoot: string): string => (ABSOLUTE.test(href) || href.startsWith("/") ? href : `${siteRoot}${href}`);

/**
 * The drawing beside a BPMN file, with each step's TITLE linked to the step's
 * page the way the KG site's own rendering links it (`linkSteps`). Where no
 * page is published for a step (`stepPage` answers undefined: a downstream
 * site writes no subject pages), the title links `fallback`, the process's
 * own page in the IG, when the caller has one. Undefined when there is no
 * drawing; the drawing unlinked when no step has a page.
 */
export function linkedProcessDrawing(
  corpus: JourneyCorpus,
  links: StepPageLinks,
  instance: string,
  process: string,
  siteRoot: string,
  fallback?: string,
): { svg: string; file: string } | undefined {
  const d = processDrawing(corpus, instance, process);
  if (d === undefined || (links.stepPage === undefined && fallback === undefined)) return d;
  const file = instanceFile(corpus, instance, process);
  if (file === undefined) return d;
  const titles = new Map<string, { href: string; name: string }>();
  for (const s of stepsOf(readFileSync(file, "utf8"))) {
    const page = links.stepPage?.(instance, process, s.process, s.id);
    const href = page !== undefined ? fromSiteRoot(page, siteRoot) : fallback;
    if (href !== undefined) titles.set(s.id, { href, name: s.name });
  }
  return titles.size ? { ...d, svg: linkSteps(d.svg, titles, new Map()) } : d;
}

/** `birth-clinic-vaccinator` → `BirthClinicVaccinator`: a role id as the IG's ActorDefinition names it. */
export const pascal = (s: string): string =>
  s
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join("");

/**
 * The artefact-index key of the ActorDefinition a persona plays, from the
 * first of its roles the IG defines (`ActorDefinition/<…>.<RoleName>` or
 * `ActorDefinition/<RoleName>`). Undefined when the actor plays no role the
 * IG lists.
 */
export function personaArtifact(corpus: JourneyCorpus, instance: string, actor: string): string | undefined {
  const roles = lookup(corpus.actors, instance, actor)?.roles ?? [];
  const defs = [...corpus.examples.keys()].filter((k) => k.startsWith("ActorDefinition/"));
  for (const role of roles) {
    const name = pascal(role);
    const hit = defs.find((k) => {
      const id = k.slice("ActorDefinition/".length);
      return id === name || id.endsWith(`.${name}`);
    });
    if (hit) return hit;
  }
  return undefined;
}

/** The IG a journey's pages link into: the first workshop of its layer that declares one, else of the checkout. */
export function igOf(corpus: JourneyCorpus, instance: string): WorkshopPresentation | undefined {
  const withIg = corpus.workshops.filter((w) => w.workshop.presentation?.ig);
  return (withIg.find((w) => w.instance === instance) ?? withIg[0])?.workshop.presentation;
}

/** An artefact's page in the IG, from a page at `siteRoot`: only for an artefact the index lists. */
export function artifactPage(corpus: JourneyCorpus, pr: WorkshopPresentation | undefined, key: string, siteRoot: string): string | undefined {
  const x = corpus.examples.get(key);
  if (x === undefined) return undefined;
  if (x.url) return x.url;
  const [type, id] = key.split("/");
  if (!pr?.ig || !type || !id) return undefined;
  const page = (pr.ig.example ?? "{type}-{id}.html").split("{type}").join(type).split("{id}").join(id);
  return fromSiteRoot(`${pr.ig.href}${page}`, siteRoot);
}

// ── a step's DAK assets ───────────────────────────────────────────────────

/** What each `rel` of a step's `dak` is called on a page, in the order a DAK row draws the groups. */
export const DAK_REL_LABEL: Readonly<Record<DakRel, string>> = { data: "Data", decides: "Decision logic", measures: "Indicators" };

/** A step's DAK link's `rel`; when it says none, the one its resource type implies, else undefined. */
export function dakRel(l: DakLink): DakRel | undefined {
  if (l.rel !== undefined) return l.rel;
  switch (l.key.split("/")[0]) {
    case "StructureDefinition":
      return "data";
    case "PlanDefinition":
    case "Library":
      return "decides";
    case "Measure":
      return "measures";
    default:
      return undefined;
  }
}

/** One DAK asset as a DAK row draws it: its key, the index's title for it, and its page in the IG when the index lists it. */
export interface DakAsset {
  key: string;
  label: string;
  description?: string;
  href?: string;
}

/** A DAK row's group: the assets of one `rel` (`other`: a link that says none and whose type implies none). */
export interface DakGroup {
  rel: DakRel | "other";
  label: string;
  assets: DakAsset[];
}

/**
 * A step's `dak` links, grouped by what each is to the step (Data, Decision
 * logic, Indicators, then Other), each asset linked to its page in the IG
 * through {@link artifactPage}: an asset the artefact index does not list is
 * left as text. A key named twice is drawn once. Empty when the step names
 * none.
 */
export function dakGroups(corpus: JourneyCorpus, pr: WorkshopPresentation | undefined, links: readonly DakLink[] | undefined, siteRoot: string): DakGroup[] {
  const by = new Map<DakRel | "other", DakAsset[]>();
  const seen = new Set<string>();
  for (const l of links ?? []) {
    if (seen.has(l.key)) continue;
    seen.add(l.key);
    const x = corpus.examples.get(l.key);
    const href = artifactPage(corpus, pr, l.key, siteRoot);
    const rel = dakRel(l) ?? "other";
    const asset: DakAsset = { key: l.key, label: x?.title ?? l.key.slice(l.key.indexOf("/") + 1), ...(x?.description ? { description: x.description } : {}), ...(href ? { href } : {}) };
    (by.get(rel) ?? by.set(rel, []).get(rel)!).push(asset);
  }
  const order: (DakRel | "other")[] = [...(Object.keys(DAK_REL_LABEL) as DakRel[]), "other"];
  return order.filter((r) => by.has(r)).map((rel) => ({ rel, label: rel === "other" ? "Other" : DAK_REL_LABEL[rel], assets: by.get(rel)! }));
}

// ── the check over a staged site ──────────────────────────────────────────

/** An IHE VHL link to the profile's bare root, which serves no page (owner: link `volume-1.html`). */
export const BARE_VHL = /^https?:\/\/profiles\.ihe\.net\/ITI\/VHL\/?(?:[?#].*)?$/;

export interface DakLinkFinding {
  /** The page, site-relative. */
  page: string;
  href: string;
  why: string;
}

function htmlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...htmlFiles(p));
    else if (n.endsWith(".html")) out.push(p);
  }
  return out;
}

const attrOf = (tag: string, name: string): string | undefined => {
  const v = new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
  // One pass, so a decoded `&` is never decoded again (`&amp;quot;` stays `&quot;`).
  return v?.replace(/&(amp|quot);/g, (_m, name: string) => (name === "amp" ? "&" : '"'));
};

/**
 * Every DAK link on the pages under `route` of the staged site `site`: an
 * `<a>` with {@link DAK_ATTR}, a BPMN step's title or [+], and an ArchiMate
 * drawing's `<object>` together with every link INSIDE that drawing, which
 * resolves from the drawing's own address. A relative link must name a file in
 * the site, and its anchor, if any, an element of that page; no link on a page
 * may name the bare IHE VHL root. Absolute links
 * to other hosts are not fetched.
 */
export function checkDakLinks(site: string, route: string): { checked: number; findings: DakLinkFinding[] } {
  const root = resolve(site);
  const findings: DakLinkFinding[] = [];
  let checked = 0;
  const base = join(root, route);
  if (!existsSync(base)) return { checked, findings: [{ page: route, href: "", why: "the route is not in the site" }] };
  /** The file `href` names from `from` (a file), or why it does not resolve. */
  const target = (from: string, href: string): { file: string } | { why: string } | undefined => {
    if (ABSOLUTE.test(href) || href.startsWith("#")) return undefined;
    const path = href.replace(/[?#].*$/, "");
    const t = path.startsWith("/") ? join(root, path) : resolve(dirname(from), decodeURIComponent(path));
    if (relative(root, t).startsWith("..")) return { why: "resolves outside the site" };
    const f = path.endsWith("/") || path === "" ? join(t, "index.html") : t;
    if (!existsSync(f) || (statSync(f).isDirectory() && !existsSync(join(f, "index.html")))) return { why: `no file at ${posix.normalize(relative(root, f).split("\\").join("/"))}` };
    // An anchor must name an element of the page it lands on.
    const anchor = /#(.+)$/.exec(href)?.[1];
    if (anchor !== undefined && f.endsWith(".html") && !new RegExp(`\\sid="${decodeURIComponent(anchor).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`).test(readFileSync(f, "utf8"))) {
      return { why: `no id "${anchor}" in ${posix.normalize(relative(root, f).split("\\").join("/"))}` };
    }
    return { file: f };
  };
  const drawingsSeen = new Set<string>();
  for (const file of htmlFiles(base)) {
    const page = relative(root, file).split("\\").join("/");
    const html = readFileSync(file, "utf8");
    for (const m of html.matchAll(/<a\b[^>]*>/g)) {
      const href = attrOf(m[0], "href");
      if (href === undefined) continue;
      if (BARE_VHL.test(href)) findings.push({ page, href, why: "the bare IHE VHL root serves no page: link volume-1.html" });
      if (!m[0].includes(DAK_ATTR) && !/class="fa-(?:task|subprocess)-link"/.test(m[0])) continue;
      checked++;
      const r = target(file, href);
      if (r && "why" in r) findings.push({ page, href, why: r.why });
    }
    for (const m of html.matchAll(/<object\b[^>]*>/g)) {
      const data = attrOf(m[0], "data");
      if (data === undefined) continue;
      checked++;
      const r = target(file, data);
      if (r && "why" in r) {
        findings.push({ page, href: data, why: r.why });
        continue;
      }
      if (!r || drawingsSeen.has(r.file) || !r.file.endsWith(".svg")) continue;
      drawingsSeen.add(r.file);
      const drawing = relative(root, r.file).split("\\").join("/");
      for (const a of readFileSync(r.file, "utf8").matchAll(/<a\b[^>]*>/g)) {
        const href = attrOf(a[0], "href") ?? attrOf(a[0], "xlink:href");
        if (href === undefined) continue;
        checked++;
        const t = target(r.file, href);
        if (t && "why" in t) findings.push({ page: drawing, href, why: t.why });
      }
    }
  }
  return { checked, findings };
}

if (import.meta.main) {
  const arg = (n: string) => {
    const i = process.argv.indexOf(`--${n}`);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  const site = arg("site");
  const route = arg("route");
  if (!site || !route) {
    console.error("usage: dak-links.ts --site <staged site> --route <journeys route, e.g. en/<instance>/journeys>");
    process.exit(2);
  }
  const { checked, findings } = checkDakLinks(site, route);
  for (const f of findings) console.error(`✗ ${f.page}: ${f.href} — ${f.why}`);
  console.log(`${findings.length ? "✗" : "✓"} ${checked} DAK link(s) checked, ${findings.length} not resolving`);
  process.exit(findings.length ? 1 : 0);
}
