---
name: ingest-wiki-book-export
description: >
  Ingest a MediaWiki "book" PDF (an mwlib/PediaPress export, such as the 2010
  iHRIS Administator Handbook) into library/<slug>/: one Markdown section per
  wiki article, the images with their credit lines, and the export's own
  attribution and licence pages as data. Use when someone shares a wiki PDF export.
input: src/schemas/skills/ingest-wiki-book-export/input.schema.json
output: src/schemas/skills/ingest-wiki-book-export/output.schema.json
---

# Ingest a wiki book export (mwlib PDF)

An mwlib export has a fixed shape, and the ingest relies on it:

- The PDF outline's **level-1 entries are the articles**. Each article starts with its title at 22 pt bold, and every page carries a running header (article title, page number) above y = 50.
- Code is set in **FreeMono**, headings in FreeSerifBold (14 pt for level 2, 12 pt for level 3), and bullets are a lone `•` followed by the item.
- After the last article, the export appends **"Article Sources and Contributors"** (each article's wiki revision and contributors: the attribution a GFDL or CC-BY-SA text needs), **"Image Sources, Licenses and Contributors"** (one credit per image, in order of appearance) and **"License"**.

## Steps

1. Put the PDF in `uploads/<slug>/` with a `manifest.json` pinning md5 and sha256 (the file is git-ignored). Record who uploaded it and where.
2. **Decide the licence before publishing anything** (AGENTS.md §2.4). Read the "License" page. The text licence is usually stated there, but images often say `License: unknown`. Ask the owner about those, and record the answer in the instance declaration's `licence` block: `stated` for the text, and `images: {status: permission, ...}` when the owner grants it.
3. Run `python3 src/tools/ingest_handbook.py` (Tool `ihris-ingest-handbook`). It does the following:
   - verifies the sha256;
   - runs folio-assistant's `pdf-structure` and `pdf-images` rungs;
   - writes `sections/<article>.md` with each article's revision and contributors in front matter;
   - matches image credits to images by order of appearance, and refuses when the counts differ;
   - redacts real e-mail addresses and phone numbers;
   - writes `book.json` (`ihris-wiki-book/v1`).
   For a new export, point the script's `UP`/`OUT` at the new slug.
4. Register the instance in `ihris.json`, add the site pages (`src/tools/site_instances.py`), and run AGENTS.md §3.

## Rules

- Undo only the renderer's artefacts: spaces mwlib inserts inside URLs, and hidden 1-pt text. Do not edit the prose.
- Talk and user pages carry third parties' words and names. Never publish them.
- Contributor usernames from the export's own appendix are the licence's attribution. Keep them with each article.
