/**
 * The rail in the page's language — the mechanism, and no translations.
 *
 * Owner, 2026-11-12, on an Arabic page whose body was Arabic and whose rail was
 * not: *"translate all the stuff on the LHS navbar"*. The rail is drawn in the
 * browser from ONE shared data file per scope (`assets/navbar/rail-<hash>.js`),
 * the same bytes for every locale, so its labels are the site's source
 * language wherever the reader is.
 *
 * ## The label map is the SITE's, and this module ships none
 *
 * A rail's labels are of two kinds, and both reach the reader as one list:
 *
 * - the rail's OWN words — {@link RAIL_CHROME_STRINGS}, "Pages", "Folders"…;
 * - the site's words — its menu groups and page titles, which only the site
 *   knows (an IG's `sushi-config.yaml` `menu:`, a folio's page tree).
 *
 * So the catalogue is the site's: `translations/<locale>/navbar.po` in the
 * site's own checkout, holding both. The site's extractor takes the rail's own
 * words from {@link railChromePotEntries} so they are never typed twice, and a
 * site's translation policy (official, unofficial, by agent or by a person)
 * stays the site's to declare. This layer's own catalogues say *"DO NOT
 * MACHINE-FILL"* (`cat-harness/translations/<locale>/kg-viewer.po`), and
 * a mechanism that put agent translations into them would break that rule.
 *
 * ## Exact match, or English
 *
 * {@link writeNavbarStrings} turns each `navbar.po` into
 * `assets/navbar/strings-<locale>.js`, a map from the English label to its
 * translation. `navbar.js` loads the file named by the page's `<html lang>`
 * and replaces a label only when the WHOLE label is a key. A label with no
 * entry, or a page whose locale has no file, keeps its English, which is the
 * fallback that `translation-manager` §"The navbar filters by locale" asks
 * for: no rewrite, rather than a code path that can be wrong.
 *
 * @module scripts/lib/navbar-strings
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { parsePo } from "../../pipeline/po-inject.ts";
import type { PotEntry } from "../../pipeline/pot-extract.ts";
import { NAV_STRINGS_GLOBAL, navbarStringsFile } from "./navbar-locale.ts";
import { NAV_RESIZE_LABEL, NAV_TOGGLE_LABEL, RAIL_SECTION_LABELS } from "./navbar.ts";

/** A site's rail catalogue: `translations/<locale>/navbar.po`. */
export const NAVBAR_CATALOGUE = "navbar";

/** The rail's own words, each with the note a translator sees. */
export const RAIL_CHROME_STRINGS: readonly { msgid: string; note: string }[] = [
  { msgid: RAIL_SECTION_LABELS.pages, note: "Navbar section heading: the site's pages." },
  { msgid: RAIL_SECTION_LABELS.onThisPage, note: "Navbar section heading: the headings of the page being read." },
  { msgid: RAIL_SECTION_LABELS.folders, note: "Navbar section heading: the site's folders (its graphs)." },
  { msgid: RAIL_SECTION_LABELS.harnesses, note: "Navbar section heading: the harnesses (layers) the site is built on." },
  { msgid: NAV_TOGGLE_LABEL, note: "Tooltip and accessible name of the navbar's open/close control." },
  { msgid: NAV_RESIZE_LABEL, note: "Tooltip and accessible name of the navbar's drag-to-resize edge." },
];

/** The rail's own words as POT entries, for a site's extractor to add to its `navbar.pot`. */
export function railChromePotEntries(): PotEntry[] {
  return RAIL_CHROME_STRINGS.map((s, i) => ({
    source: "cat-harness-tools/scripts/lib/navbar-strings.ts",
    line: i + 1,
    msgid: s.msgid,
    kind: "ui-string" as const,
    comment: s.note,
  }));
}

/** A locale's map, from its `navbar.po`: English label to translation, translated entries only. */
export function navbarStringsMap(poContent: string): Record<string, string> {
  const out: Record<string, string> = {};
  // `parsePo` also keys a contexted entry as `context\u0004msgid`; the rail's labels carry no context.
  for (const [msgid, msgstr] of parsePo(poContent)) if (msgid && msgstr && !msgid.includes("\u0004")) out[msgid] = msgstr;
  return out;
}

export { NAV_STRINGS_GLOBAL, navbarStringsFile };

/** The strings file's script body. */
export function navbarStringsBody(locale: string, map: Record<string, string>): string {
  return `(self.${NAV_STRINGS_GLOBAL}=self.${NAV_STRINGS_GLOBAL}||{})[${JSON.stringify(locale)}]=${JSON.stringify(map)};\n`;
}

/**
 * Write `assets/navbar/strings-<locale>.js` under `siteAbs` for every
 * `translations/<locale>/navbar.po` under `translationsDir` with at least one
 * translated entry. A locale with none gets no file, so its pages keep the
 * English rail rather than loading an empty map.
 */
export function writeNavbarStrings(siteAbs: string, translationsDir: string): { written: string[]; empty: string[] } {
  const written: string[] = [];
  const empty: string[] = [];
  if (!existsSync(translationsDir)) return { written, empty };
  for (const e of readdirSync(translationsDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const po = join(translationsDir, e.name, `${NAVBAR_CATALOGUE}.po`);
    if (!existsSync(po)) continue;
    const map = navbarStringsMap(readFileSync(po, "utf-8"));
    if (Object.keys(map).length === 0) {
      empty.push(e.name);
      continue;
    }
    const out = join(siteAbs, navbarStringsFile(e.name));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, navbarStringsBody(e.name, map));
    written.push(e.name);
  }
  return { written, empty };
}
