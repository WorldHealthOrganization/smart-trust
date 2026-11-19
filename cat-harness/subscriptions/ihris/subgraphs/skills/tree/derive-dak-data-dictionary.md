---
name: derive-dak-data-dictionary
description: >
  Derive a data dictionary from the iHRIS data model, in the column order of
  WHO's DAK L2 guide, plus FHIR R4 terminology from the shipped lists. iHRIS is
  independent of SMART Guidelines and smart-base. Use when the data model changes or
  when starting DAK authoring for health workforce information.
input: src/schemas/skills/derive-dak-data-dictionary/input.schema.json
output: src/schemas/skills/derive-dak-data-dictionary/output.schema.json
---

# Derive the DAK data dictionary from the iHRIS data model

**Input:** `src/*/data-model/<release>/` (`ihris-form-class/v1`, from
`build_kg.py`). **Output:** `src/ihris-data-dictionary/`. **Tool:** `ihris-build-dak`.

## The mapping, and the one rule

The rule: **derive only what the source states.** The source states a field's
name, label (`headers`), I2CE type, `required`, `unique`, and which list a MAP
draws from. It does **not** state a definition, conditionality, the reason a
field is required, or links to indicators and decision tables. Those WHO
columns stay `null` and are authored by a person. A plausible guessed
definition is worse than a blank, because it reads as sourced.

Column meanings come from WHO's *Form data mapping guide* (Digital
transformation handbook for primary health care, 9789240093362, pp. 86-90). Only the
column layout is borrowed; nothing here depends on smart-base.

| decision | rule |
|---|---|
| which classes | record forms become logical models. Classes whose `extends` chain reaches `I2CE_List`/`I2CE_SimpleList`/`I2CE_SimpleCodedList` become value sets. I2CE infrastructure and app state are `system`. CSD classes are `interoperability` |
| merging | the same class in two packages is one sheet; fields are merged and each keeps its `definedIn` |
| input options | a MAP's `meta/form`. With none, I2CE defaults to the form named after the field. Resolve form → class from **every** module across packages, because lists are often registered in one package on a class another defines |
| optionality | `required` → R, otherwise O. Never C |
| ids | `IHRIS.DE.<Class without prefix>.<field>`, stable across runs |
| evidence | restored wiki sections that mention the label in **bold**. These are material for authoring, not a definition |

## Terminology from shipped lists

Records under `//I2CE/formsData/forms/<list>/<id>` are stored in two formats: a `fields` group of configurations, or one delimited configuration with `field:value` values. `build_kg.py` reads both into `src/*/data-lists/`.

| records from | become | in a ValueSet? |
|---|---|---|
| a module's own default data (e.g. `iso-country`, `PersonDemographic`) | `CodeSystem-<list>`, `content: complete` | yes |
| `SampleData-*`, `QualifySampleData-*`, a site | `CodeSystem-<list>-example-<module>`, `content: example` | **never** |

A MAP value `list|id` becomes a Coding to whichever CodeSystem **holds** that id. It prefers the referring record's own package, because the Manage and Qualify sample lists disagree. A CURRENCY value `currency|id=amount` becomes a decimal plus a currency Coding. Records that repeat an id are merged, as I2CE's configuration tree merges them, and the CodeSystem description says so.

## Occupations (ISCO)

- iHRIS record ids in `isco_08_*` **are** ISCO-08 codes. Emit ValueSets on the ILO's own ISCO-08 system URL. Do not mint an ISCO-08 CodeSystem.
- Map only what a record itself states. A job code's ISCO-88 prefix counts only when it is a shipped ISCO-88 unit group. A classification's `code` field counts. A cadre is reached only through its jobs, and the map is `inexact` and lists the jobs.
- **Never** map ISCO-88 to ISCO-08 from memory. It needs ILO's correspondence table. Record the gap as a `blocked` item in `authored/`.
- Anything a person decides (a binding, a definition) goes in `authored/` as an `ihris-dak-proposal/v1`. Builds never write there.

## Standard code systems (ISO)

Where iHRIS's record ids *are* a standard's codes (country → ISO 3166-1 alpha-2, currency → ISO 4217), the DAK ValueSet binds to the standard (`urn:iso:std:iso:3166`, `urn:iso:std:iso:4217`). The shipped list stays a local CodeSystem, mapped by a ConceptMap that is verified against pycountry's iso-codes data. Withdrawn codes are `unmatched`, and successors are never inferred. To add another standard, extend `ISO_SYSTEMS` and `build_iso()` in `build_dak.py`.

## Steps

1. `python3 src/tools/build_dak.py`
2. `python3 src/tools/validate.py`. This checks the terminology as FHIR R4 (`.build/fhir-venv`, see `validate_fhir.py`), and sheets against
   `ihris-dak-data-dictionary/v1`.
3. Review `excluded.json`: a class wrongly marked `system` silently drops data
   elements.
