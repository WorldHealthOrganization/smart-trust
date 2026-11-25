# Translation scripts

Scripts for the folio-assistant translation pipeline.

## Origin

The Python scripts in this directory are copied from
[`WorldHealthOrganization/smart-base/input/scripts/`](https://github.com/WorldHealthOrganization/smart-base/tree/main/input/scripts).
They are the upstream authority for FHIR IG translation workflows.
The TypeScript ports in `pipeline/` are the folio-assistant equivalents.

## Smart-base Python scripts

| Script | Role |
|---|---|
| `extract_translations.py` | POT extraction: PlantUML, SVG, ArchiMate, Markdown |
| `inject_translations.py` | PO injection for all four formats |
| `translation_config.py` | GitHub URL helpers, shared config |
| `translation_security.py` | Shared security helpers (request timeouts) for the service scripts |
| `extract_script_strings.py` | Script/template string extraction |
| `pull_translations.py` | Orchestrator for translation platform pulls |
| `pull_weblate_translations.py` | Weblate API sync |
| `pull_crowdin_translations.py` | Crowdin API sync |
| `pull_launchpad_translations.py` | Launchpad API sync |
| `register_translation_project.py` | Per-project Weblate registration |
| `register_all_dak_projects.py` | Bulk DAK project registration |
| `generate_weblate_yaml.py` | Weblate component discovery config |

## Translation platforms

The `pull_*_translations.py` scripts above write a platform's strings straight
into `msgstr`. Under the owner's 2026-11-14 rule, a platform is never an
adjudicator, so do not use them to import into a layer. Weblate, Crowdin and
Transifex are connected through `scripts/translation-platforms.ts` and the
reusable `layer-translation-platform-import.yml` workflow instead, which turn
their strings into candidates. [`PLATFORMS.md`](PLATFORMS.md) describes each
platform's account, keys, network hosts, open-source plan and where the
content goes.

## TypeScript ports (folio-assistant native)

| Module | Smart-base source | Functions ported |
|---|---|---|
| `pipeline/pot-extract.ts` | `extract_translations.py` L633–856 | `extractMarkdown`, `cleanMarkdownText`, `formatPot` |
| `pipeline/po-inject.ts` | `inject_translations.py` L56–818 | `injectMarkdown`, `parsePo`, `gettextToLiquid` |

## Simulation

```sh
bun run scripts/translation/simulate-translation.ts [path-to-md]
```

Runs the full pipeline on a markdown page (default: `docs/guides/agent-onboarding.md`):
1. Extract translatable strings → POT
2. Simulate French translation → PO
3. Inject translations → French markdown
4. Round-trip semantic verification (back-translate and compare)
5. Write `status.json`

Output goes to `translations/fr/`.

## Machine translation of empty entries (`translation:candidates`)

`scripts/translation-candidates.ts` asks open, self-hosted engines for
CANDIDATE translations of the empty and fuzzy entries of each
`translations/<locale>/**/<name>.pot`/`.po` pair, so no hosted freemium API or
quota is involved:

| `--engine` | Engine | Licence | Runs |
|---|---|---|---|
| `opus-mt` (preferred) | Helsinki-NLP OPUS-MT Marian models | CC-BY 4.0 | locally, `python3 -I scripts/translation/opus_mt_runner.py` (needs `transformers` and the model in the local cache; `HF_HUB_OFFLINE=1` forbids downloads) |
| `libretranslate` | LibreTranslate, Argos models | AGPL-3.0 | a self-hosted instance at `--url`; libretranslate.com is refused |

Every candidate goes through the one writer, `addCandidates` in
`scripts/lib/translation-candidates.ts`, which records it in
`<catalogue>.candidates.json` for the review page and fills an EMPTY msgstr
with the first good candidate, flagged `#, fuzzy`. A plural entry gets one
candidate carrying every form, as many as the catalogue's `Plural-Forms`
count, and is filled only when all its forms are empty. Each line of a string
is masked (`[0]`, `[1]`, …) and translated on its own.

A non-empty msgstr is never touched; a string whose placeholders, markup or
math do not round-trip is not recorded, and is reported; a catalogue signed
off as official (its node, or `X-Folio-Official: yes`) or marked `DO NOT
MACHINE-FILL` collects candidates but its `.po` is not changed. The
catalogue's `.json` translation node records `generatedBy: "machine"`,
`generator` and `generatedAt`, and never `official`.

```sh
bun run cat translation:candidates -- --instance . --engine opus-mt --locale fr --init
bun run cat translation:candidates -- --instance . --engine opus-mt,libretranslate --url http://localhost:5000 --dry-run
```

`bun run cat translate-pot` is the same command under its older name and
flags (`--locale` repeated, a `.po` started unless `--no-create`).

## Tests

```sh
bun test pipeline/translation.test.ts
```

Covers text cleaning, extraction, formatting, PO parsing, injection, and the
full round-trip.
