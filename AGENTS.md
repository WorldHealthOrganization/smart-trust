# AGENTS.md — smart-trust

This file is agent-generic: Claude Code, Gemini CLI, Cursor, Copilot and others
read it natively. What binds everywhere is the harness's
[`AGENTS.md`](https://github.com/litlfred/cat-harness/blob/HEAD/AGENTS.md); what
this repository *is* is [`README.md`](README.md).

## What this instance is

The WHO SMART Trust implementation guide: FHIR IG source under `input/`, built
by the IG Publisher. It has no harness of its own: `index.config.json` mounts
`smart-base` and the layers below it, and `smart-trust.json` declares what an
index may mount from here.

## The one rule

**The two mounted graphs are generated copies of upstream, never authored.**
`fhir-artifact-index/` is not committed: fhir-harness's `ig-index:build`
writes its `index.json`, `menu.json`, `releases.json`, `package.tgz` and
`sidecars/` at publish from the IG's AST. `openapi/` is written by
`ingest-openapi.ts` and `gen-openapi-pages.ts` from the sources
`openapi/cat-openapi.config.json` names. Never commit, hand-edit or re-ingest
either; both are declared `readOnly`. To change what is there, change the
upstream source or the writer, then re-run the writer.
`check:materialized-fixity` and the writers' `--check` catch a hand edit.

## What an index mounts from here

folio-assistant mounts the directories `smart-trust.json` declares as
`fhir-artifact-index/`, `openapi/`, `document-kinds/`, `library/`,
`catalogue/`, `glossary/` and `translations/`, plus this file and the README
as assets. `document-kinds/` holds this IG's DAK coverage report, generated at
publish from `fhir-artifact-index/` by `smart-base:document-kinds`. The IG
source (`input/`) is not mounted. `docs/` is built at publish by
`smart-trust:pages` (fhir-harness's `gen-ig-pages.ts`) and never committed.
`fhir-ast/` is restored from its cache branch by `ig-cache.sh`.

## Before running SUSHI

Read fhir-harness's [`fhir-validation`](https://github.com/litlfred/fhir-harness/blob/main/skills/content/fhir-ig-authoring/fhir-validation.md#when-a-package-host-refuses-you)
§"When a package host refuses you" first. Where packages.fhir.org is refused,
`fhir-cache-seed-npm` fills the package cache from npm and
fhir-package-mirror at exact versions only. Never report "SUSHI cannot run
here" before running the seeder, and never substitute another version for a
pinned one; its `--missing-out` list is what the mirror still needs.

## Translations

The harness's generic process is
[`translation-refresh`](https://github.com/litlfred/cat-harness/blob/HEAD/skills/library/library-core/translation-refresh.md)
and `translation-manager` §"Translating into several locales as a team"; this
section names what that skill leaves to the instance. Locales: ar, es, fr, ru,
zh, all unofficial (agent, no human sign-off). Each locale is its own PR to
main.

| step | here |
|---|---|
| templates | `bun input/scripts/translation-pot.ts` (`--check` in CI): `input/pagecontent/` and the BPMN of `input/business-processes/` into `translations/<locale>/{pagecontent,processes}/` |
| new and obsolete strings | `bun input/scripts/po-status.ts --merge` appends new msgids empty and keeps obsolete ones as `#~`; without `--merge` it reports |
| app strings | the onboarding game (`onboarding-game/`, kind `web-app`): `bun run cat web-apps:build --extract` writes `translations/<locale>/apps/onboarding-game.pot` from its catalog `onboarding-game/src/i18n/en.json` (refresh that first with `npm run catalog` in the game); translators fill `translations/<locale>/apps/onboarding-game.po`, one PR per locale; `web-apps:build --check` fails on a stale template, a dropped `{placeholder}` or a translation for a string that is gone. Cat-harness skill `web-apps` |
| FHIR terms | one CodeSystem supplement per locale, `input/fsh/translations/<locale>.fsh`; never edit a resource's own text |

`.github/workflows/translations.yml` runs the template check, the officiality
check and `po-status --github`. Merge policy: **merge-when-green** (owner, 2026-11-07). A
refresh run merges its own refresh PR only when every check is green and the
untainted round trip on the changed strings records no fail; anything red,
uncertain or failing is left open and reported to the owner. Merging is not
sign-off: the translations stay unofficial.
