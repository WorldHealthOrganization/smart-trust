import { test, expect, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { overlayPath } from "../scripts/lib/layer-output.ts";
import { siteFileAt } from "./support/site-fs.ts";
import { parseIssueBody, payloadProblems } from "../scripts/lib/translation-adjudication.ts";

/**
 * A block's translation, in its feedback panel (owner, 2026-11-14: "add to
 * the feedback controls (edit, suggest, etc) interface to fixing/adjudication
 * of translation via github issue workflow. should indicate translation status
 * of content block").
 *
 * On a translated page, each block's 📣 panel carries a 🌐 pane, drawn by
 * cat-harness `site-chrome/assets/js/translation-review.js` from the
 * `folio-translation-review/v1` projection (scripts/gen-translation-status.ts).
 * It says what state the block's catalogue is in, and files the same
 * `translation-adjudication/v1` issue the review page files: "translation OK"
 * as an acceptable verdict, "fix translation" as a mistranslation carrying the
 * strings of THIS block's source file only. The record in the issue must be
 * one `parseIssueBody` and `payloadProblems` accept.
 *
 * Fixtures are written here, never read off the corpus.
 */

const ROOT = join(HARNESS_ROOT);
const asset = (p: string) => readFileSync(overlayPath(join(ROOT, siteFileAt(ROOT, p))), "utf8");
const CSS = asset("assets/css/docs-ui.css");
const EDIT_LINKS = asset("assets/js/edit-links.js");
const REVIEW_JS = asset("assets/js/translation-review.js");

const REVIEW_URL = "/assets/translation-status/review.json";
const PO_URL = "https://raw.githubusercontent.com/o/r/main/translations/fr/docs/guide.po";

/** The catalogue behind the machine-translated block: two of its strings are the block's, one is another file's. */
const PO = [
  'msgid ""',
  'msgstr ""',
  '"Content-Type: text/plain; charset=UTF-8\\n"',
  "",
  "#: docs/guide.md:3",
  'msgid "Hello, reader."',
  'msgstr "Bonjour, lecteur."',
  "",
  "#: docs/guide.md:5",
  "#, fuzzy",
  'msgctxt "button"',
  'msgid "Save"',
  'msgstr "Sauver"',
  "",
  "#: docs/other.md:1",
  'msgid "Elsewhere."',
  'msgstr "Ailleurs."',
  "",
].join("\n");
const CANDIDATES_URL = "https://raw.githubusercontent.com/o/r/main/translations/fr/docs/guide.candidates.json";
/** The candidates sidecar (translation-candidates/v1): "Sauver" is the .po's fuzzy default, so it is not offered again. */
const CANDIDATES = {
  $schema: "translation-candidates/v1",
  locale: "fr",
  catalogue: "docs/guide",
  entries: [
    {
      msgctxt: "button",
      msgid: "Save",
      candidates: [
        { text: "Sauver", source: { kind: "agent", id: "claude-opus-5-5" } },
        { text: "Enregistrer", source: { kind: "open-mt", id: "opus-mt-en-fr" } },
        { text: "Sauvegarder", source: { kind: "web-service", id: "deepl" } },
      ],
    },
  ],
};
const HASH = createHash("sha256").update(PO, "utf-8").digest("hex").slice(0, 16);

const cell = (o: object) => ({ entries: 3, translated: 3, fuzzy: 0, hash: "0123456789abcdef", ...o });
const review = (maxUrl = 7500) => ({
  $schema: "folio-translation-review/v1",
  reviewPage: "en/cat-harness/translation-status/review.html",
  issue: { schema: "translation-adjudication/v1", label: "translation-adjudication", titlePrefix: "[translation review]", fence: "json translation-adjudication", maxUrl, candidatesSchema: "translation-candidates/v1", candidatesSuffix: ".candidates.json" },
  layers: [
    {
      name: "demo",
      repository: "o/r",
      translations: "translations",
      locales: ["ar", "fr"],
      rows: [
        { catalogue: "docs/guide", sources: ["docs/guide.md", "docs/other.md"], cells: { fr: cell({ state: "machine", translated: 2, fuzzy: 1, hash: HASH, generatedBy: "agent" }), ar: cell({ state: "empty", translated: 0 }) } },
        { catalogue: "docs/rev", sources: ["docs/rev.md"], cells: { fr: cell({ state: "reviewed", by: "alice", at: "2026-11-01T10:00:00Z" }) } },
        { catalogue: "docs/stale", sources: ["docs/stale.md"], cells: { fr: cell({ state: "stale", by: "bob", at: "2026-10-02T10:00:00Z" }) } },
        { catalogue: "docs/flag", sources: ["docs/flag.md"], cells: { fr: cell({ state: "flagged", flagReason: "mistranslation reported by carol" }) } },
        { catalogue: "docs/off", sources: ["docs/off.md"], cells: { fr: cell({ state: "official", by: "Dr. A", at: "2026-09-01" }) } },
      ],
    },
  ],
});

const META = {
  lang: "fr",
  translationStatus: "unverified",
  translationSource: "docs/guide",
  supportedLocales: ["ar", "en", "fr"],
  availableLocales: ["en", "fr"],
  statusSrc: "/assets/translation-status/index.json",
  reviewSrc: REVIEW_URL,
};

/** One block as the compact block actions draw it: an anchor, then its box with ✎ and 📣. */
const block = (id: string, src: string, text: string) =>
  `<p><a id="${id}"></a><span class="block-actions" data-block="${id}" data-src="${src}" data-repo="o/r">` +
  `<a class="ba-edit" data-fa-link="edit" tabindex="0">✎ edit</a><a class="ba-feedback" data-fa-link="feedback" tabindex="0">📣 feedback</a></span>${text}</p>`;
const BODY =
  block("b-guide", "docs/guide.md", "Bonjour, lecteur.") +
  block("b-rev", "docs/rev.md", "Revu.") +
  block("b-stale", "docs/stale.md", "Vieux.") +
  block("b-flag", "docs/flag.md", "Signalé.") +
  block("b-off", "docs/off.md", "Officiel.") +
  block("b-none", "docs/nothing.md", "Rien.");

function harness(meta: object, scheme: "light" | "dark"): string {
  return (
    `<!doctype html><html lang="${(meta as { lang: string }).lang}" data-fa-scheme="${scheme}"><head><meta charset="utf-8">` +
    `<style>body{background:${scheme === "light" ? "#fff" : "#27262b"};color:${scheme === "light" ? "#1b1b1b" : "#ecebe4"}}${CSS}</style>` +
    `<script type="application/json" id="fa-translation-meta">${JSON.stringify(meta)}<\/script>` +
    `<script type="application/json" id="fa-edit-cfg">${JSON.stringify({ repo: "o/r" })}<\/script>` +
    `</head><body><div class="main-content" id="main-content"><h1>Page</h1>${BODY}</div>` +
    `<script>${EDIT_LINKS}<\/script><script>${REVIEW_JS}<\/script></body></html>`
  );
}

async function serve(page: Page, opts: { scheme?: "light" | "dark"; meta?: object; review?: { code: number; body?: unknown }; candidates?: boolean; strings?: unknown } = {}) {
  const rv = opts.review ?? { code: 200, body: review() };
  await page.addInitScript(() => {
    (window as unknown as { __opened: string[] }).__opened = [];
    window.open = ((u: string) => { (window as unknown as { __opened: string[] }).__opened.push(u); return null; }) as typeof window.open;
  });
  await page.route("https://tr.test/**", (route) => {
    const url = route.request().url();
    if (url.endsWith("/page.html")) return route.fulfill({ contentType: "text/html", body: harness(opts.meta ?? META, opts.scheme ?? "light") });
    if (url.endsWith(STRINGS_URL) && opts.strings !== undefined) return route.fulfill({ contentType: "application/json", body: JSON.stringify(opts.strings) });
    if (url.endsWith(REVIEW_URL)) {
      return rv.code === 200
        ? route.fulfill({ contentType: "application/json", body: JSON.stringify(rv.body) })
        : route.fulfill({ status: rv.code, body: "" });
    }
    return route.fulfill({ status: 404, body: "" });
  });
  await page.route(PO_URL, (route) => route.fulfill({ contentType: "text/plain", body: PO, headers: { "access-control-allow-origin": "*" } }));
  await page.route(CANDIDATES_URL, (route) =>
    opts.candidates === false
      ? route.fulfill({ status: 404, body: "", headers: { "access-control-allow-origin": "*" } })
      : route.fulfill({ contentType: "application/json", body: JSON.stringify(CANDIDATES), headers: { "access-control-allow-origin": "*" } }));
  await page.goto("https://tr.test/fr/page.html");
}

const openPanel = async (page: Page, id: string) => {
  await page.locator(`.block-actions[data-block="${id}"] > .ba-trigger`).click();
  await expect(page.locator(".fa-block-panel.open")).toBeVisible();
  return page.locator(".fa-block-panel .fa-trf");
};

/** The record inside an issue URL's body, as `parseIssueBody` reads it. */
function recordOf(url: string) {
  const u = new URL(url);
  const body = u.searchParams.get("body")!;
  const fence = "```json translation-adjudication";
  const from = body.indexOf("\n", body.indexOf(fence)) + 1;
  return { u, body, record: JSON.parse(body.slice(from, body.indexOf("\n```", from))) };
}

for (const scheme of ["light", "dark"] as const) {
  test(`each block's panel says its translation state, in words (${scheme} scheme)`, async ({ page }) => {
    await serve(page, { scheme });
    const say = async (id: string, text: string) => {
      const pane = await openPanel(page, id);
      await expect(pane).toContainText(text);
      await page.keyboard.press("Escape");
      await expect(page.locator(".fa-block-panel.open")).toHaveCount(0);
      return pane;
    };
    await say("b-guide", "Machine translation, not reviewed by a person (made by agent)");
    // A string showing its first candidate as a default (fuzzy) is machine until adjudicated.
    await say("b-guide", "1 string show a machine default that no person has reviewed.");
    await say("b-rev", "Reviewed by alice on 2026-11-01");
    await say("b-stale", "Reviewed by bob on 2026-10-02; changed since the review");
    await say("b-flag", "mistranslation reported by carol");
    await say("b-off", "Official translation, signed off by Dr. A on 2026-09-01");
    await say("b-none", "No translation catalogue names this block's source (docs/nothing.md)");

    const pane = await openPanel(page, "b-guide");
    await expect(pane.locator(".fa-trf-state")).toHaveAttribute("data-fa-tr-state", "machine");
    // The full review page, from the projection's own path.
    await expect(pane.locator("a.fa-trf-more")).toHaveAttribute("href", "/en/cat-harness/translation-status/review.html");
    // Large targets: every control is at least 44px tall.
    for (const b of await pane.locator(".fa-trf-btn").all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    // Readable in this scheme: the pane's text is not its background's colour.
    const c = await pane.evaluate((n) => ({ fg: getComputedStyle(n).color, bg: getComputedStyle(n.closest(".fa-block-panel")!).backgroundColor }));
    expect(c.fg).not.toBe(c.bg);
  });
}

test("an official translation has nothing to adjudicate; a machine one has both controls", async ({ page }) => {
  await serve(page);
  let pane = await openPanel(page, "b-off");
  await expect(pane.locator(".fa-trf-ok, .fa-trf-fix")).toHaveCount(0);
  await page.keyboard.press("Escape");
  pane = await openPanel(page, "b-guide");
  await expect(pane.getByRole("button", { name: "✓ Translation OK" })).toBeVisible();
  await expect(pane.getByRole("button", { name: "✎ Fix translation" })).toBeVisible();
});

test("translation OK files an acceptable verdict for this catalogue and locale, pinned to its hash", async ({ page }) => {
  await serve(page);
  const pane = await openPanel(page, "b-guide");
  await pane.getByRole("button", { name: "✓ Translation OK" }).click();
  const link = pane.locator("a.fa-trf-open");
  await expect(link).toBeVisible();
  const href = (await link.getAttribute("href"))!;
  expect(await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened)).toEqual([href]);
  const { u, body, record } = recordOf(href);
  expect(u.origin + u.pathname).toBe("https://github.com/o/r/issues/new");
  expect(u.searchParams.get("labels")).toBe("translation-adjudication");
  expect(u.searchParams.get("title")).toBe("[translation review] demo: 1 acceptable");
  expect(body).toContain("By filing this issue, I (its author) adjudicate");
  expect(record).toEqual({
    $schema: "translation-adjudication/v1",
    repository: "o/r",
    layer: "demo",
    translations: "translations",
    items: [{ catalogue: "docs/guide", locale: "fr", verdict: "acceptable", poHash: HASH }],
  });
});

test("fix translation lists only this block's strings, and files each typed one as a suggestion", async ({ page }) => {
  await serve(page);
  const pane = await openPanel(page, "b-guide");
  await pane.getByRole("button", { name: "✎ Fix translation" }).click();
  const dlg = page.locator("dialog.fa-trf-dialog");
  await expect(dlg).toBeVisible();
  const items = dlg.locator(".fa-trf-strings > li");
  await expect(items).toHaveCount(2);
  await expect(dlg).toContainText("Hello, reader.");
  await expect(dlg).toContainText("Save [button]");
  await expect(dlg).not.toContainText("Elsewhere.");
  // The catalogue fetched is the one the site was built from: no changed-since warning.
  await expect(dlg.locator(".fa-trf-warn")).toHaveCount(0);

  // Nothing typed: nothing filed.
  await dlg.getByRole("button", { name: "Make the GitHub issue" }).click();
  await expect(dlg).toContainText("Type at least one suggestion first.");

  await items.nth(1).getByLabel("Your suggestion").fill("Enregistrer");
  await dlg.getByLabel("Note (optional)").fill("a button label");
  await dlg.getByRole("button", { name: "Make the GitHub issue" }).click();
  const href = (await dlg.locator("a.fa-trf-open").getAttribute("href"))!;
  const { u, record } = recordOf(href);
  expect(u.searchParams.get("title")).toBe("[translation review] demo: 1 mistranslation");
  expect(record.items).toEqual([
    {
      catalogue: "docs/guide",
      locale: "fr",
      verdict: "mistranslation",
      poHash: HASH,
      suggestions: [{ msgid: "Save", msgctxt: "button", current: "Sauver", suggested: "Enregistrer" }],
      note: "a button label",
    },
  ]);
  await dlg.getByRole("button", { name: "Cancel" }).click();
  await expect(dlg).toBeHidden();
});

test("past GitHub's URL limit the issue text is copied instead, and the link carries no body", async ({ page }) => {
  await serve(page, { review: { code: 200, body: review(200) } });
  const pane = await openPanel(page, "b-guide");
  await pane.getByRole("button", { name: "✓ Translation OK" }).click();
  await expect(pane.locator("a.fa-trf-open")).toHaveCount(0);
  await expect(pane.getByRole("button", { name: "1. Copy the issue text" })).toBeVisible();
  const short = new URL((await pane.getByRole("link", { name: "2. Open the issue and paste" }).getAttribute("href"))!);
  expect(short.searchParams.get("body")).toBeNull();
  expect(short.searchParams.get("labels")).toBe("translation-adjudication");
  expect(await pane.locator("textarea.fa-trf-body").inputValue()).toContain("```json translation-adjudication");
  expect(await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened)).toEqual([]);
});

// (A source-language page now shows the pane too — owner, 2026-11-18, ruling 1 —
// so the test that it shows none is gone; the pane's own e2e for it follows the pane.)
test("a site that publishes no review says so", async ({ page }) => {
  await serve(page, { review: { code: 404 } });
  const pane = await openPanel(page, "b-guide");
  await expect(pane).toContainText("This site publishes no translation review.");
});

test("fix translation offers each string's candidates by source; a picked one is filed with its source, an edited one without", async ({ page }) => {
  await serve(page);
  const pane = await openPanel(page, "b-guide");
  await pane.getByRole("button", { name: "✎ Fix translation" }).click();
  const dlg = page.locator("dialog.fa-trf-dialog");
  const save = dlg.locator(".fa-trf-strings > li").nth(1);
  await expect(save).toContainText("(machine default, not reviewed)");
  // Each candidate names its source (every candidate is offered — owner, 2026-11-18, ruling 2).
  const choices = save.locator(".fa-trf-cand");
  await expect(choices.filter({ hasText: "Enregistrer" })).toContainText("Enregistrer — open-mt opus-mt-en-fr");
  await expect(choices.filter({ hasText: "Sauvegarder" })).toContainText("Sauvegarder — web-service deepl");
  for (const c of await choices.all()) expect((await c.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // A string with no candidates shows no choices, only the free-text field.
  await expect(dlg.locator(".fa-trf-strings > li").nth(0).locator(".fa-trf-cands")).toHaveCount(0);

  await save.getByRole("radio", { name: /Sauvegarder/ }).check();
  await expect(save.getByLabel("Your suggestion")).toHaveValue("Sauvegarder");
  await dlg.getByRole("button", { name: "Make the GitHub issue" }).click();
  const picked = recordOf((await dlg.locator("a.fa-trf-open").getAttribute("href"))!);
  expect(picked.record.items[0].suggestions).toEqual([
    { msgid: "Save", current: "Sauver", suggested: "Sauvegarder", source: { kind: "web-service", id: "deepl" }, msgctxt: "button" },
  ]);
  expect(picked.body).toContain("`Sauver` → `Sauvegarder` (candidate from web-service `deepl`)");

  // Edited after picking: the text is the reviewer's own, and carries no source.
  await save.getByLabel("Your suggestion").fill("Sauvegarder le texte");
  await dlg.getByRole("button", { name: "Make the GitHub issue" }).click();
  const edited = recordOf((await dlg.locator("a.fa-trf-open").getAttribute("href"))!);
  expect(edited.record.items[0].suggestions).toEqual([{ msgid: "Save", current: "Sauver", suggested: "Sauvegarder le texte", msgctxt: "button" }]);
});

test("no candidates sidecar (404): the reviewer types their own", async ({ page }) => {
  await serve(page, { candidates: false });
  const pane = await openPanel(page, "b-guide");
  await pane.getByRole("button", { name: "✎ Fix translation" }).click();
  const dlg = page.locator("dialog.fa-trf-dialog");
  await expect(dlg.locator(".fa-trf-strings > li")).toHaveCount(2);
  await expect(dlg.locator(".fa-trf-cands")).toHaveCount(0);
});

// ── The owner's rulings of 2026-11-18 (cat-harness-tools translation-strings.ts) ──

const STRINGS_URL = "/assets/translation-status/strings/demo/docs/guide.json";
const SAVE_HASH = "1111111111111111";
/** The review projection as the tools layer now writes it: a strings projection per row. */
const reviewWithStrings = () => {
  const r = review() as ReturnType<typeof review> & { strings?: object };
  r.strings = { schema: "folio-translation-strings/v1", base: "assets/translation-status/strings/", statuses: [], pickTiers: [] };
  (r.layers[0]!.rows[0] as { strings?: string }).strings = "demo/docs/guide.json";
  return r;
};
const cand = (text: string, kind: string, id: string, extra: object = {}) => ({ text, source: { kind, id }, msgidHash: SAVE_HASH, tier: "mt", stale: false, qaFailures: [], current: false, ...extra });
const STRINGS = {
  $schema: "folio-translation-strings/v1",
  layer: "demo",
  repository: "o/r",
  translations: "translations",
  catalogue: "docs/guide",
  hashes: { ar: "2222222222222222", fr: HASH },
  strings: [
    {
      msgid: "Hello, reader.",
      hash: "3333333333333333",
      sources: ["docs/guide.md"],
      locales: {
        ar: { text: "", status: "missing", fuzzy: false, candidates: [] },
        fr: {
          text: "Bonjour, lecteur.",
          status: "adjudicated",
          fuzzy: false,
          chosen: { text: "Bonjour, lecteur.", how: "adjudicated", by: "github:alice", at: "2026-11-17T09:00:00Z", issue: 4, reason: "formal register" },
          candidates: [],
        },
      },
    },
    {
      msgctxt: "button",
      msgid: "Save",
      hash: SAVE_HASH,
      sources: ["docs/guide.md"],
      locales: {
        fr: {
          text: "Sauver",
          status: "agent",
          fuzzy: true,
          pick: { text: "Enregistrer", candidate: 0, tier: "human-proposed", unofficial: true },
          candidates: [
            cand("Enregistrer", "human", "github:ana", { tier: "human-proposed", source: { kind: "human", id: "github:ana", by: "github:ana", at: "2026-11-16T08:00:00Z", issue: 3 } }),
            cand("Conserver", "official", "who-glossary", { tier: "official", exactMatch: false, sourceText: "save" }),
            cand("Sauver", "agent", "claude-opus-5-5", { tier: "agent", current: true, qa: { roundtrip: { score: 0.55, threshold: 0.7, pass: false } }, qaFailures: ["round trip 0.55 < 0.7"] }),
            cand("Sauvegarder", "web-service", "weblate", { tier: "platform", source: { kind: "web-service", id: "weblate", version: "5.8", by: "jean" }, qa: { glossary: { pass: false, missing: ["save"] }, placeholders: { pass: true } } }),
            cand("Garder", "open-mt", "opus-mt-en-fr", { stale: true }),
          ],
        },
      },
    },
    { msgid: "Elsewhere.", hash: "4444444444444444", sources: ["docs/other.md"], locales: { fr: { text: "Ailleurs.", status: "mt", fuzzy: false, candidates: [] } } },
  ],
};

test("a source-language page shows the pane, listing every locale's translation of the block and its status", async ({ page }) => {
  await serve(page, { meta: { ...META, lang: "en", translationSource: "" }, review: { code: 200, body: reviewWithStrings() }, strings: STRINGS });
  await expect(page.locator('.block-actions[data-block="b-guide"] .ba-ic[data-pane="translation"]')).toHaveCount(1);
  const pane = await openPanel(page, "b-guide");
  await expect(pane).toContainText("In every language");
  const every = pane.locator(".fa-trf-every > li");
  await expect(every).toHaveCount(2); // the block's two strings, not "Elsewhere."
  await expect(every.nth(0).locator('[data-fa-tr-locale="ar"]')).toHaveAttribute("data-fa-tr-status", "missing");
  await expect(every.nth(0).locator('[data-fa-tr-locale="fr"]')).toContainText("adjudicated by a collaborator");
  await expect(every.nth(0).locator('[data-fa-tr-locale="fr"]')).toContainText("chosen by alice, 2026-11-17: formal register");
  await expect(every.nth(1).locator('[data-fa-tr-locale="fr"]')).toContainText("agent translation, not reviewed");
  await expect(every.nth(1).locator('[data-fa-tr-locale="fr"]')).toContainText("default pick (unofficial): Enregistrer");
  // A source page has no "translation OK" for its own language, but a fix per locale with a catalogue.
  await expect(pane.locator(".fa-trf-ok")).toHaveCount(0);
  await expect(pane.getByRole("button", { name: "✎ Fix translation (fr)" })).toBeVisible();
  // An empty catalogue too: a missing string is where a proposal matters most.
  await expect(pane.getByRole("button", { name: "✎ Fix translation (ar)" })).toBeVisible();
});

test("a translated page lists every locale too, beside its own catalogue's state", async ({ page }) => {
  await serve(page, { review: { code: 200, body: reviewWithStrings() }, strings: STRINGS });
  const pane = await openPanel(page, "b-guide");
  await expect(pane.locator(".fa-trf-state").first()).toHaveAttribute("data-fa-tr-state", "machine");
  await expect(pane.locator('.fa-trf-loc[data-fa-tr-locale="ar"]').first()).toContainText("missing: the source text is shown");
});

test("with no review published, the pane says so plainly and shows what the page itself says", async ({ page }) => {
  await serve(page, { meta: { ...META, lang: "en", translationSource: "" }, review: { code: 404 } });
  const pane = await openPanel(page, "b-guide");
  await expect(pane).toContainText("This site publishes no translation review.");
  await expect(pane).toContainText("This page is published in: en, fr.");
});

test("fix translation offers EVERY candidate, the current one included, with its provenance and the unofficial default pick", async ({ page }) => {
  await serve(page, { review: { code: 200, body: reviewWithStrings() }, strings: STRINGS });
  const pane = await openPanel(page, "b-guide");
  await pane.getByRole("button", { name: "✎ Fix translation" }).click();
  const dlg = page.locator("dialog.fa-trf-dialog");
  await expect(dlg).toContainText("only a collaborator's choice is recorded as the translation");
  const save = dlg.locator(".fa-trf-strings > li").nth(1);
  const choices = save.locator(".fa-trf-cands .fa-trf-cand");
  await expect(choices).toHaveCount(5);
  await expect(choices.nth(0)).toContainText("Enregistrer — human github:ana · ★ default pick (unofficial) · 2026-11-16 · by ana · issue #3");
  await expect(choices.nth(1)).toContainText("Conserver — official who-glossary · not an exact match to the official source");
  await expect(choices.nth(2)).toContainText("Sauver — agent claude-opus-5-5 · round trip 0.55 ✗ · current");
  await expect(choices.nth(2)).toHaveAttribute("data-fa-tr-qa", "fail");
  await expect(choices.nth(3)).toContainText("Sauvegarder — web-service weblate · version 5.8 · by jean · glossary ✗: save missing · placeholders ✓");
  await expect(choices.nth(4)).toContainText("stale: made for an older source text");
  await expect(choices.nth(4)).toHaveAttribute("data-fa-tr-stale", "true");
  for (const c of await choices.all()) expect((await c.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // A picked candidate is filed with its source, as before.
  await save.getByRole("radio", { name: /Sauvegarder/ }).check();
  await dlg.getByRole("button", { name: "Make the GitHub issue" }).click();
  const { record, body } = recordOf((await dlg.locator("a.fa-trf-open").getAttribute("href"))!);
  expect(record.items[0].suggestions).toEqual([{ msgid: "Save", current: "Sauver", suggested: "Sauvegarder", source: { kind: "web-service", id: "weblate" }, msgctxt: "button" }]);
  expect(body).toContain("proposes `Save`");
  // Choose, with a reason: the record carries both, the summary says "chooses", and the workflow's parser accepts it.
  await save.getByRole("checkbox", { name: "Choose as the translation" }).check();
  await save.getByLabel("Why (optional)").fill("the glossary term");
  await dlg.getByRole("button", { name: "Make the GitHub issue" }).click();
  const chosen = recordOf((await dlg.locator("a.fa-trf-open").getAttribute("href"))!);
  expect(chosen.record.items[0].suggestions).toEqual([{ msgid: "Save", current: "Sauver", suggested: "Sauvegarder", source: { kind: "web-service", id: "weblate" }, msgctxt: "button", choose: true, reason: "the glossary term" }]);
  expect(chosen.body).toContain("chooses `Save` (context `button`): `Sauver` → `Sauvegarder` (candidate from web-service `weblate`) because the glossary term");
  expect(parseIssueBody(chosen.body)).toEqual(chosen.record);
  expect(payloadProblems(chosen.record)).toEqual([]);
});

for (const scheme of ["light", "dark"] as const) {
  test(`the every-locale list and the choose controls are readable in the ${scheme} scheme`, async ({ page }) => {
    await serve(page, { scheme, review: { code: 200, body: reviewWithStrings() }, strings: STRINGS });
    const pane = await openPanel(page, "b-guide");
    // A translated page: its own locale shown, the others collapsed.
    await expect(pane.locator('.fa-trf-every .fa-trf-loc[data-fa-tr-locale="fr"]').first()).toBeVisible();
    await expect(pane.locator(".fa-trf-every details.fa-trf-others").first()).toBeVisible();
    await expect(pane.locator('.fa-trf-every .fa-trf-loc[data-fa-tr-locale="ar"]').first()).toBeHidden();
    await pane.locator(".fa-trf-every details.fa-trf-others > summary").first().click();
    await expect(pane.locator('.fa-trf-every .fa-trf-loc[data-fa-tr-locale="ar"]').first()).toBeVisible();
    const c = await pane.evaluate((n) => ({ fg: getComputedStyle(n).color, bg: getComputedStyle(n.closest(".fa-block-panel")!).backgroundColor }));
    expect(c.fg).not.toBe(c.bg);
    await pane.getByRole("button", { name: "✎ Fix translation" }).click();
    const box = page.locator("dialog.fa-trf-dialog .fa-trf-choose").first();
    await expect(box).toBeVisible();
    const d = await page.locator("dialog.fa-trf-dialog").evaluate((n) => ({ fg: getComputedStyle(n).color, bg: getComputedStyle(n).backgroundColor }));
    expect(d.fg).not.toBe(d.bg);
  });
}

test("a source page's per-locale fix files a suggestion for that locale", async ({ page }) => {
  await serve(page, { meta: { ...META, lang: "en", translationSource: "" }, review: { code: 200, body: reviewWithStrings() }, strings: STRINGS });
  const pane = await openPanel(page, "b-guide");
  await pane.getByRole("button", { name: "✎ Fix translation (fr)" }).click();
  const dlg = page.locator("dialog.fa-trf-dialog");
  await expect(dlg.locator("#fa-trf-dialog-title")).toHaveText("Fix the translation (fr)");
  await dlg.locator(".fa-trf-strings > li").nth(0).getByLabel("Your suggestion").fill("Salut, lecteur.");
  await dlg.getByRole("button", { name: "Make the GitHub issue" }).click();
  const { record } = recordOf((await dlg.locator("a.fa-trf-open").getAttribute("href"))!);
  expect(record.items[0]).toMatchObject({ catalogue: "docs/guide", locale: "fr", verdict: "mistranslation", poHash: HASH });
});

test("the pane's rank equals the tools layer's rankCandidates, fixture for fixture", async ({ page }) => {
  const { rankCandidates } = await import("../scripts/lib/translation-strings.ts");
  const H = "aaaaaaaaaaaaaaaa";
  const c = (text: string, kind: string, id: string, extra: object = {}) => ({ text, source: { kind, id }, msgidHash: H, ...extra });
  const fixtures = [
    { candidates: [c("MT", "open-mt", "opus"), c("Svc", "web-service", "deepl"), c("Ag", "agent", "a"), c("Wb", "web-service", "Weblate"), c("Hu", "human", "github:a"), c("Of", "official", "who")] },
    { candidates: [c("Fail", "human", "github:a", { qa: { glossary: { pass: false, missing: ["x"] } } }), c("Clean", "open-mt", "m", { qa: { roundtrip: { score: 0.9, threshold: 0.7, pass: true } } }), c("Ph", "agent", "a", { qa: { placeholders: { pass: false } } }), c("None", "open-mt", "n")] },
    { candidates: [c("Old", "human", "github:a", { source: { kind: "human", id: "github:a", at: "2026-11-01T00:00:00Z" } }), c("New", "human", "github:b", { source: { kind: "human", id: "github:b", at: "2026-11-17T00:00:00Z" } }), c("Stale", "official", "who", { msgidHash: "bbbbbbbbbbbbbbbb" }), c("NoHash", "agent", "a", { msgidHash: undefined })] },
    { candidates: [c("A", "agent", "a"), c("B", "human", "github:b"), c("C", "open-mt", "m", { qa: { roundtrip: { score: 0.2, threshold: 0.7, pass: false } } })], chosen: { text: "A", how: "adjudicated", by: "github:x", at: "t" } },
    { candidates: [c("A", "agent", "a"), c("B", "human", "github:b")], chosen: { text: "A", how: "auto", at: "t" } },
    { candidates: [] },
  ];
  await serve(page);
  const js = await page.evaluate(([fs, h]) => (fs as object[]).map((f) => (window as unknown as { faTranslationReview: { rankCandidates: (e: object, h: string) => Array<{ index: number; tier: string; score: number; stale: boolean; qaFailures: unknown[] }> } }).faTranslationReview.rankCandidates(f, h as string).map((r) => ({ index: r.index, tier: r.tier, score: r.score, stale: r.stale, qa: r.qaFailures.length }))), [fixtures, H] as const);
  const ts = fixtures.map((f) => rankCandidates(f as never, H).map((r) => ({ index: r.index, tier: r.tier, score: r.score, stale: r.stale, qa: r.qaFailures.length })));
  expect(js).toEqual(ts);
  expect(ts[0]!.map((r) => r.tier)).toEqual(["official", "human-proposed", "platform", "agent", "mt", "mt"]);
});
