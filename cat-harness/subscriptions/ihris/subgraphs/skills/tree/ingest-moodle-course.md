---
name: ingest-moodle-course
description: >
  Ingest a Moodle 1.9 course backup (moodle.xml + course_files/): its structure
  always (course and backup metadata, sections and modules in course order,
  lesson page titles, resource links, question counts, a file inventory), and,
  under the licence its declaration records, its content as Markdown (section
  summaries, lesson pages, quizzes, surveys, transcripts) with its images. Use
  when someone shares an iHRIS e-learning course backup.
input: src/schemas/skills/ingest-moodle-course/input.schema.json
output: src/schemas/skills/ingest-moodle-course/output.schema.json
---

# Ingest a Moodle course backup

A Moodle 1.9 backup zip holds `moodle.xml` and the course's files (`course_files/`). In `moodle.xml`:

- `INFO` names the backup (`NAME`, `DATE`, `MOODLE_RELEASE`, `ORIGINAL_WWWROOT`) and what it includes (`DETAILS`: `USERS`, each module type's `USERINFO`).
- `COURSE/HEADER` has the course's `FULLNAME`, `SHORTNAME`, `FORMAT`, `CATEGORY`, `TIMECREATED` and `SUMMARY`.
- `COURSE/SECTIONS/SECTION` are the sections in order (`NUMBER` 0 is the general section), each with a `SUMMARY`. Each `MODS/MOD` places one module, in course order, by `TYPE` and `INSTANCE`; its `ID` is the course-module id, unique in the course.
- `COURSE/MODULES/MOD` are the module records, keyed by `MODTYPE` and `ID` (the instance id, unique per type only). A lesson's `PAGES/PAGE` each have a `TITLE` and `CONTENTS` (HTML). A resource has `TYPE`, `REFERENCE` (a URL, or a course file, relative or as `../../file.php/<course>/...`) and, for `html`, `ALLTEXT`. A quiz has `QUESTION_INSTANCES` naming questions in `COURSE/QUESTION_CATEGORIES` (`QUESTIONTEXT`, `ANSWERS` with `FRACTION`, `MATCHS`). A questionnaire has `SURVEY/QUESTION` with `QUESTION_CHOICE`s, a glossary `ENTRIES`.
- The HTML links to course files as `http://<host>/moodle/file.php/<course id>/<path>`.

## Steps

1. Put the zip in `uploads/<slug>/` with a `manifest.json` pinning `bytes`, `md5` and `sha256`, and an `expect` block with the totals established by inspection (sections, modules, modules by type, files, uncompressed bytes). The directory is git-ignored except the manifest (`.gitignore`).
2. Look for a licence: the course summary, the overview page, the lesson pages, the section summaries, any transcripts and the media files' headers. Record what was checked in the manifest's `licenceNote`. The declaration's `licence` decides what is written (AGENTS.md rule 4): `null` means structure only; a `stated` licence (here CC-BY-4.0, stated by the course's author, the owner) or the owner's `permission` means the content too, attributed as the record says.
3. Review every image before publishing it, and list any that shows personal data (a third party's name, an e-mail address, a date of birth, a photograph of a person who is not a public figure) in `WITHHOLD_IMAGES` in the tool, with the reason. Do the same for text naming third parties (`WITHHOLD`). An image that is publishable once a part is painted over (a name, an address) goes in `REDACT_IMAGES` instead, with the box, its fill and the demo text drawn in; the record marks it `redacted` with the source's sha256. These are decisions, not heuristics: a new image is published unless it is listed.
4. Run `python3 -I src/tools/ingest_moodle_course.py` (Tool `ihris-ingest-moodle-course`; needs antiword, beautifulsoup4 and markdownify). It verifies the zip, reads it in memory (no extraction), refuses a `DOCTYPE` or `ENTITY` in `moodle.xml`, refuses a backup with users or user info, and stops on a module or question type it does not know, a reference it cannot place, a module in no section, glossary entries it has not been taught to write, or totals that differ from the manifest's `expect`. Fix the tool or the manifest, never the output.
5. Read `course.md` and a sample of `modules/`: no e-mail address, no third party named, no image of a person. Check `missingImages` (shown by the text, absent from the backup) and `withheldImages`.
6. Add or update the declaration (`materialization`, `licence`), the sub-instance in `ihris.json`, the README map row, and AGENTS.md rules 3 and 4. Run AGENTS.md §3.

## Rules

- **The record holds no body text.** `course.json` holds names, titles, counts, URLs and pointers (path and sha256) to Markdown files; the text lives in those files, or nowhere. QA `moodle-course` fails on a body-text key, a long string, a file not at its sha256, a file present but not listed, an image link that does not resolve, a withheld image published, or an e-mail address.
- **Sanitised, then converted.** HTML is parsed with BeautifulSoup and reduced to a few tags (`p`, lists, emphasis, `a[href]`, `img[src,alt]`, tables, headings, `pre`, `code`); scripts, styles, iframes, event handlers and inline styles never survive. An embedded YouTube player becomes a link. `<` and `>` in running text are written as entities, so HTML the course shows as an example stays text.
- **Links to course files are rewritten**: an image to `images/`, a transcript to its Markdown, and audio to a note that it is not published. An image the backup does not hold becomes a note, and is listed in `missingImages`.
- **No people.** The backup must say `USERS none` and `USERINFO false` for every module type; otherwise the tool refuses. The certificate's settings (a contact address) are never read. Every e-mail address in what is written is removed and counted.
- **Size.** Audio is inventoried with its sha256, never committed.
- **The input is untrusted.** Read with `zipfile` and `xml.etree.ElementTree` under `python3 -I`: member paths are relative with no `..`, sizes and compression ratios are capped, and no entity is expanded.
