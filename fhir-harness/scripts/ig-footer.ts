/**
 * The facts the IG Publisher prints in every page's footer, read from the IG's
 * OWN package — never typed in (#1901, owner 2026-10-02: *"The values should
 * come from the IG's own metadata … and must not be hard-coded"*).
 *
 * `gen-ig-pages.ts` writes the result once per IG as `assets/ig-footer.json`.
 *
 * ## One footer per site, drawn once
 *
 * In an IG site (`igSite`), EVERY page's footer — the IG's own pages and its
 * artefact pages alike — is drawn by one Liquid include,
 * `templates/ig-site/ig-footer.liquid`, from one object, `igSiteFooter`'s
 * result in `site.data.fhir.footer`. That object lays the package's facts
 * (the JSON above) over the IG source's (`sushiFooterData`) and decides the
 * "Links:" row once, against the pages the site holds. Until the artefact
 * pages joined it they drew a second footer of their own from the package
 * alone, which had no © year and sent "Table of Contents" to the site root.
 *
 * `templates/ig-pages/ig-footer.js` still draws the footer where there is no
 * IG site and so no IG source: artefact pages composed into another site.
 *
 * ## Where each value comes from, in order
 *
 * | field | first | then |
 * |---|---|---|
 * | publisher | `ImplementationGuide.publisher` | `package.json` `author` |
 * | publisherUrl | the IG's first `contact` url | `package.json` `maintainers[0].url` |
 * | packageId, version | `package.json` `name`, `version` | the artefact index |
 * | fhirVersion | `ImplementationGuide.fhirVersion[0]` | `package.json` `fhirVersions[0]`, then the index |
 * | generated | `package.json` `date` (the build stamp) | the index's `builtAt`; on an IG site, the AST's `generatedAt` (`astFooterData`) |
 * | license | `ImplementationGuide.license` | `package.json` `license` |
 *
 * A value no source carries is ABSENT from the result, and the footer leaves
 * that clause out. The Publisher's "© 2023+" year is one such for a page
 * built from the package alone: it comes from `sushi-config.yaml`'s
 * `copyrightYear`, which the package does not carry. A page built WITH the
 * IG's source — every page of an IG site (`build-ig-site.ts`) — reads it from
 * there (`sushiFooterData`), the package's values still winning.
 *
 * @module fhir-harness/scripts/ig-footer
 */

export interface IgFooterData {
  publisher?: string;
  publisherUrl?: string;
  packageId?: string;
  version?: string;
  fhirVersion?: string;
  /** The FHIR specification the IG is built on, when its release is one this table names. */
  fhirUrl?: string;
  /** `YYYY-MM-DD`. */
  generated?: string;
  license?: string;
  licenseUrl?: string;
  /** `sushi-config.yaml` `copyrightYear`, e.g. `2023+` — only where the IG's source is read. */
  copyrightYear?: string;
}

/**
 * The class that scopes the mirrored chrome's custom properties
 * (`assets/ig-chrome.css`), the Publisher's `--footer-*` colours among them.
 * One name for both writers of the footer: the artefact pages
 * (`gen-ig-pages.ts`) and the IG site's own pages (`build-ig-site.ts`).
 */
export const IG_CHROME_SCOPE = "st-ig";

type Json = Record<string, unknown>;
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v : undefined);
const first = (v: unknown): unknown => (Array.isArray(v) ? v[0] : undefined);

/**
 * FHIR's published release names, by the version an IG declares. A fact
 * about FHIR, not about any IG: an IG on a version not listed here gets its
 * version printed and no link, rather than a guessed URL.
 */
const FHIR_RELEASES: [RegExp, string][] = [
  [/^5\.0\./, "R5"],
  [/^4\.3\./, "R4B"],
  [/^4\.0\./, "R4"],
  [/^3\.0\./, "STU3"],
];

export function fhirSpecUrl(version: string | undefined): string | undefined {
  const hit = version && FHIR_RELEASES.find(([re]) => re.test(version));
  return hit ? `http://hl7.org/fhir/${hit[1]}/` : undefined;
}

/** An SPDX identifier's page. Anything that is not shaped like one gets no link. */
export function licenseUrl(id: string | undefined): string | undefined {
  return id && /^[A-Za-z0-9.+-]+$/.test(id) ? `https://spdx.org/licenses/${id}.html` : undefined;
}

/** `20261001114021` or `2026-10-01T11:40:21+00:00` -> `2026-10-01`. */
export function dayOf(stamp: string | undefined): string | undefined {
  const m = stamp?.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}

function contactUrl(ig: Json | undefined): string | undefined {
  for (const c of Array.isArray(ig?.contact) ? (ig.contact as Json[]) : []) {
    for (const t of Array.isArray(c.telecom) ? (c.telecom as Json[]) : []) {
      if (t.system === "url" && str(t.value)) return str(t.value);
    }
  }
  return undefined;
}

/**
 * @param pkg  the package's `package/package.json`, when the package is held
 * @param ig   its `ImplementationGuide` resource, when the package is held
 * @param ix   the artefact index's own fields, the fallback for every value it carries
 */
export function igFooterData(
  pkg: Json | undefined,
  ig: Json | undefined,
  ix: { packageId?: string; version?: string; fhirVersion?: string[]; builtAt?: string },
): IgFooterData {
  const fhirVersion = str(first(ig?.fhirVersion)) ?? str(first(pkg?.fhirVersions)) ?? str(first(ix.fhirVersion));
  const license = str(ig?.license) ?? str(pkg?.license);
  const out: IgFooterData = {
    publisher: str(ig?.publisher) ?? str(pkg?.author),
    publisherUrl: contactUrl(ig) ?? str((first(pkg?.maintainers) as Json | undefined)?.url),
    packageId: str(pkg?.name) ?? ix.packageId,
    version: str(pkg?.version) ?? ix.version,
    fhirVersion,
    fhirUrl: fhirSpecUrl(fhirVersion),
    generated: dayOf(str(pkg?.date) ?? ix.builtAt),
    license,
    licenseUrl: licenseUrl(license),
  };
  // Absent, not `undefined`: the JSON written from this says only what is known.
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as IgFooterData;
}

/**
 * The same facts from the IG's SOURCE, `sushi-config.yaml` — the fallback for
 * an IG site page when the package's own values (`assets/ig-footer.json`) are
 * not held, and the only source of `copyrightYear`. SUSHI's own rules: a
 * `publisher` is a string or `{ name, url }`, `packageId` defaults to `id`,
 * `fhirVersion` is a string or a list.
 */
export function sushiFooterData(sushi: Json): IgFooterData {
  const pub = sushi.publisher;
  const pubObj = pub && typeof pub === "object" && !Array.isArray(pub) ? (pub as Json) : undefined;
  const fhirVersion = str(sushi.fhirVersion) ?? str(first(sushi.fhirVersion));
  const license = str(sushi.license);
  const year = sushi.copyrightYear;
  const out: IgFooterData = {
    publisher: str(pub) ?? str(pubObj?.name),
    publisherUrl: str(pubObj?.url),
    packageId: str(sushi.packageId) ?? str(sushi.id),
    version: str(sushi.version),
    fhirVersion,
    fhirUrl: fhirSpecUrl(fhirVersion),
    license,
    licenseUrl: licenseUrl(license),
    copyrightYear: typeof year === "number" ? String(year) : str(year),
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as IgFooterData;
}

/**
 * What the IG's AST says about its own build: the day its Publisher run
 * generated it (`manifest.json` `generatedAt`), the Publisher's "Generated"
 * date for a site built from that AST and no package. Absent when the
 * manifest carries none.
 */
export function astFooterData(manifest: Json | undefined): IgFooterData {
  const generated = dayOf(str(manifest?.generatedAt));
  return generated ? { generated } : {};
}

/**
 * The page the footer's "QA Report" link goes to: the Publisher's own name for
 * its QA page, which an IG site holds as the harness's combined QA report
 * (`ig-qa-page.ts`: the FHIR QA and the knowledge graph's).
 */
export const IG_QA_PAGE = "qa.html";

/** One link of the footer's "Links:" row. `external` marks a link off this site. */
export interface IgFooterLink {
  label: string;
  href: string;
  external?: boolean;
}

/**
 * What an IG site page's footer template reads (`site.data.fhir.footer`):
 * the facts, and the "Links:" row already decided. The Publisher's row is
 * Table of Contents | QA Report | Version History | License; a link is drawn
 * only where its target is HELD (#1901, owner 2026-10-02: no link to a page
 * that is not there), so the template never decides what exists.
 */
export interface IgSiteFooter extends IgFooterData {
  links: IgFooterLink[];
  /** The chrome scope class, when the site holds the mirrored chrome; the band then wears the Publisher's colours. */
  scope?: string;
  /** Stylesheets the footer needs, relative to the IG site's root. */
  stylesheets: string[];
}

/**
 * @param facts  the package's values first, the source's after (`{ ...sushi, ...pkg }`)
 * @param held   whether this IG site serves a page, by its root-relative href
 */
export function igSiteFooter(
  facts: IgFooterData,
  held: (href: string) => boolean,
  styling: { scope?: string; stylesheets?: string[] } = {},
): IgSiteFooter {
  const links: IgFooterLink[] = [];
  // The Publisher's own pages, in its order. `qa.html` is the harness's QA
  // report where the site holds one (`ig-qa-page.ts`); `history.html` is a
  // Publisher output this build does not write, and appears once it does.
  for (const [label, href] of [["Table of Contents", "toc.html"], ["QA Report", IG_QA_PAGE], ["Version History", "history.html"]] as const) {
    if (held(href)) links.push({ label, href });
  }
  if (facts.licenseUrl) links.push({ label: "License", href: facts.licenseUrl, external: true });
  return { ...facts, links, ...(styling.scope ? { scope: styling.scope } : {}), stylesheets: styling.stylesheets ?? [] };
}
