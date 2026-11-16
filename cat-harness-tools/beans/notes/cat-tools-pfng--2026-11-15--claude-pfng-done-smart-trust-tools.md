---
# note on cat-tools-pfng from claude/pfng-done-smart-trust-tools
$schema: folio-bean-note/v1
bean: cat-tools-pfng
branch: "claude/pfng-done-smart-trust-tools"
created: "2026-11-15"
---
## done smart-trust

Completed `smart-trust` under `cat-tools-pfng` (PR `litlfred/smart-trust#242`, branch `translations/opus-mt-candidates` @ `db0dbe714a67b255866bbd6c124321467f103ba5`):

- **Candidates (`opus-mt`):** Collected candidates into `translations/{ar,es,fr,zh}/menu/menu.candidates.json` (`ru/menu/menu` `"WHO SMART Trust"` refused by placeholder round-trip check).
- **Glossary (`translation-glossary.ts --instance . --check`):** Fixed 6 `fr` findings in `translations/fr/apps/onboarding-game.po` (`Legal Representative` → `Représentant juridique`, `Onboarding Process` → `Processus d’intégration`) and 8 `zh` findings in `translations/zh/apps/onboarding-game.po` + `translations/zh/menu/menu.po` (`QR` → `QR`, `PKI` → `PKI`). All 5 locales (`ar`, `es`, `fr`, `ru`, `zh`) now exit `0` with `0 finding(s)`.
- **Blind semantic round trip (`pfng-back-translator` `fcc9138e-cdb7-4960-b93a-be4fd698a1a2` + `pfng-adjudicator` `48353010-50c5-4f52-b97c-c761da4211b0`):**
  - `es/menu/menu` (`"WHO SMART Trust"` → `"WHO SMART Trust"`): `pass` (retained `#, fuzzy`).
  - `fr/menu/menu` (`"WHO SMART Trust"` → `"La confiance de l'OMS SMART"`): `warn` (`minor`, retained `#, fuzzy`).
  - `ar/menu/menu` (`"WHO SMART Trust"` → `"صندوق سمارت الاستئماني لمنظمة الصحة العالمية (WHO SMART Trust)"`): `fail` (`major` — `'Trust'` rendered as financial `'Trust Fund'`; `msgstr` emptied in `.po`, candidate kept in `menu.candidates.json`).
  - `zh/menu/menu` (`"WHO SMART Trust"` → `"卫生组织SMART信托基金"`): `fail` (`major` — `'Trust'` rendered as financial `'Trust Fund'`; `msgstr` emptied in `.po`, candidate kept in `menu.candidates.json`).
  - All 14 glossary-aligned strings in `fr/apps/onboarding-game.po`, `zh/apps/onboarding-game.po`, and `zh/menu/menu.po`: `pass`.

## claim smart-trust-phw

Claiming `litlfred/smart-trust-phw` for OPUS-MT candidate generation, glossary check, and blind round-trip verification.

## done smart-trust-phw

Completed translation candidate & glossary consistency pass for `litlfred/smart-trust-phw` (PR `litlfred/smart-trust-phw#83`, head `f0e26184f9064873f871e159d70b4b4669419eb4`):

- **Catalogue coverage:** Verified all 15 `.po` catalogues (`input/{images-source,images,pagecontent}/translations/{ar,es,fr,ru,zh}.po`, 1,093 entries per locale) already have `0` empty `msgstr` entries (`0 wanted, 0 skipped`).
- **Glossary consistency (`translation-glossary.ts --instance . --check`, 34 fixed terms across 9-layer `declarationChain`):**
  - Updated `input/images/translations/es.po` (`msgid "A2. Construct FHIR"` → `msgstr "A2. Construir los recursos FHIR"`) so `FHIR` is preserved across all locales.
  - Recorded 2 `other-sense` verdicts in `translations/glossary-sense.json` for general-English uses of `policy` (`"policy & disclosure"`, `"policy applies"`) vs. the fixed term `Policy` (`Política de gobernanza`).
  - `translation-glossary.ts --instance . --check` exits `0` with `0 finding(s), 0 pending adjudication` across `ar`, `es`, `fr`, `ru`, and `zh`.
- **Blind semantic round-trip verification:**
  - Back-translator subagent (`fcc9138e-cdb7-4960-b93a-be4fd698a1a2`, blind to English `msgid`) + Adjudicator subagent (`48353010-50c5-4f52-b97c-c761da4211b0`, comparing `msgid` vs `back_en`): **6 / 6 `pass`** (`es/images:A2` and `{ar,es,fr,ru,zh}/pagecontent:adapting.13`).

## claim smart-trust-demo

Claiming `litlfred/smart-trust-demo` for OPUS-MT translation candidate generation, glossary consistency check, and blind round-trip semantic verification under `cat-tools-pfng` (Sibling 1).

## done smart-trust-demo

Completed translation candidate & glossary consistency pass for `litlfred/smart-trust-demo` (PR `litlfred/smart-trust-demo#164`, head `9ff9cae17734ebd59ba6b6a55cb0121f644578ce`):

- **Catalogue coverage:** Verified all 36 `.pot`/`.po` catalogues per locale (`ar`, `es`, `fr`, `ru`, `zh`, 2,106 strings per locale = 10,530 strings total) are 100% translated (`0` empty `msgstr`, `0` fuzzy, `0` obsolete).
- **Glossary consistency (`pipeline/translation-glossary.ts --instance . --check` across the full 10-layer `declarationChain`):**
  - Adjudicated and recorded all 11 remaining pending uses (`policy`, `Reference`, `Role`) in `translations/glossary-sense.json` so `translation-glossary.ts --instance . --check` exits `0` with `0 finding(s), 0 pending adjudication` across all 5 locales (`ar`, `es`, `fr`, `ru`, `zh`).
  - `python3 -I tools/translation/glossary_qa.py --check` passes across all 5 locales (`losses 0, glossary 0 to fix, round trip PASS`).
- **Blind semantic round-trip verification:**
  - Back-translator subagent (`fcc9138e-cdb7-4960-b93a-be4fd698a1a2`, blind to English `msgid`) + Adjudicator subagent (`48353010-50c5-4f52-b97c-c761da4211b0`, comparing `msgid` vs `back_en`): **5 / 5 `pass`** across `ar`, `es`, `fr`, `ru`, and `zh`.

## claim smart-trust-tools

Claiming `litlfred/smart-trust-tools` for OPUS-MT translation candidate generation, glossary consistency check, and blind round-trip semantic verification under `cat-tools-pfng` (Sibling 1).

## done smart-trust-tools

Completed translation candidate & glossary consistency pass for `litlfred/smart-trust-tools` (PR `litlfred/smart-trust-tools#73`, head `7728b46cbe92c0ad0c5bea0dbdd7546a401a1ba8`):

- **Template extraction & declaration:** Declared `translations/` (`translation-sources`) in `smart-trust-tools.json` and extracted BPMN `.pot` templates via `translate-bpmn.ts --instance . --extract` across `ar`, `es`, `fr`, `ru`, and `zh` (4 BPMN processes × 5 locales = 20 catalogues, 76 strings per locale = 380 strings total).
- **OPUS-MT candidates (`translation-candidates.ts --instance . --engine opus-mt --init`):**
  - Recorded **380** OPUS-MT candidates across 20 `.candidates.json` files (`76` per locale across `ar`, `es`, `fr`, `ru`, `zh`), `0` refused.
  - **374** strings retained as `#, fuzzy` in `.po` after blind round-trip verification emptied 6 `fail` strings (`generatedBy: "machine"`, `official` unset).
- **Glossary consistency (`pipeline/translation-glossary.ts --instance . --check`, 31 fixed terms across 7-layer `declarationChain`):**
  - Exits `0` with `0 finding(s), 0 pending adjudication` across all 5 locales (`ar`, `es`, `fr`, `ru`, `zh`).
- **Blind semantic round-trip verification:**
  - Back-translator subagent (`fcc9138e-cdb7-4960-b93a-be4fd698a1a2`, blind to English `msgid`) + Adjudicator subagent (`48353010-50c5-4f52-b97c-c761da4211b0`, comparing `msgid` vs `back_en`) evaluated 40 sampled strings (2 per catalogue across all 20 catalogues): **30 `pass`**, **4 `warn`**, **6 `fail`** (`ar/processes/hcert-contract-change#5`, `ar/processes/hcert-issuance#5`, `ru/processes/hcert-contract-change#5`, `ru/processes/hcert-issuance#5`, `ru/processes/hcert-verification#5`, `zh/processes/hcert-verification#5` emptied in `.po`).
