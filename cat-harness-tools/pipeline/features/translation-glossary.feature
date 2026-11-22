# pipeline/translation-glossary.ts (translation:glossary:check) builds the layered term base, checks each locale's
# catalogues against it, and feeds the Glossary consistency section of the KG QA report.
# Each Scenario names the test that executes it.
Feature: Translation glossary consistency

  @test:pipeline/translation-glossary.test.ts::matching::a_term_is_a_whole_word_of_the_prose,_case-insensitive
  Scenario: A term matches a whole word of the prose, case-insensitive
    When "Health worker" is looked for in "Every health worker signs in."
    Then it is used
    And "Actor" is not used in "The cat-harness-actor list", where it is part of an identifier
    And "Actor" is not used in "See `Actor` in code", where it is inside code

  @test:pipeline/translation-glossary.test.ts::matching::a_short_all-caps_acronym_is_case-sensitive
  Scenario: A short all-caps acronym matches case-sensitively
    Then "DID" is used in "a DID document"
    And "DID" is not used in "what did it do"

  @test:pipeline/translation-glossary.test.ts::matching::a_rendering_is_found_by_stem,_or_by_substring_in_zh_and_ar
  Scenario: A rendering is found by stem, or by substring in Chinese and Arabic
    Then "agent de santé" is rendered in "Les agents de santé arrivent" in French
    And it is not rendered in "Le soignant arrive"
    And "卫生工作者" is rendered in "每位卫生工作者登录" in Chinese
    And "العامل الصحي" is rendered in "يسجل العامل الصحي الدخول" in Arabic

  @test:pipeline/translation-glossary.test.ts::Arabic:_a_fixed_rendering_in_its_plural,_possessive_and_broken-plural_forms_(owner,_Q-GLOSS-REST_A)::%s_«%s»_is_rendered_in_«%s»
  Scenario: An Arabic fixed term is found in its plural, possessive and broken-plural forms
    Given each of twelve Arabic msgstrs using "Skill" (المهارة), "Role" (الدور) or "Task" (المهمة) in an inflected form, such as "حزمة المهارات" and "تعيين الأدوار"
    When the fixed rendering is looked for in the msgstr in Arabic
    Then it is rendered

  @test:pipeline/translation-glossary.test.ts::Arabic:_a_fixed_rendering_in_its_plural,_possessive_and_broken-plural_forms_(owner,_Q-GLOSS-REST_A)::Reference_in_another_sense_(the_verb)_is_still_not_rendered
  Scenario: Arabic "Reference" used as a verb is still not rendered
    When "المرجع" is looked for in a msgstr that uses "الإشارة" in the verb sense
    Then it is not rendered

  @test:pipeline/translation-glossary.test.ts::Arabic:_a_fixed_rendering_in_its_plural,_possessive_and_broken-plural_forms_(owner,_Q-GLOSS-REST_A)::a_different_word_sharing_the_stem_is_not_a_form_of_it
  Scenario: A different Arabic word sharing the stem is not a form of the term
    Then "المهمة" is not rendered in "هذا أمر مهم" nor in "المهم هو الاختبار"
    And "المهارة" is rendered in "مهارة"

  @test:pipeline/translation-glossary.test.ts::termBase_—_the_lower_layer_fixes,_a_higher_one_may_only_add::each_term_binds_in_its_scheme_when_no_subject_is_declared;_empty,_localised_and_long_labels_fix_nothing
  Scenario: Each term binds in its scheme when no subject is declared, and empty, localised and long labels fix nothing
    Given a reference glossary "who", a lower layer "core" fixing "Actor" and "Skill", and a higher layer "app" translating "Actor" otherwise and adding terms
    When the term base for "app" in French is built
    Then "Actor" has two terms: "Acteur" in scheme "core--terms" out of scope, and "Intervenant" in "app--terms" in scope
    And "Health worker" is fixed as "Agent de santé" by layer "app", in scope
    And "Immunization" belongs to layer "who" in scope "reference:who", in scope
    And the localised label, the empty label and the sentence-long label fix no term

  @test:pipeline/translation-glossary.test.ts::termBase_—_the_lower_layer_fixes,_a_higher_one_may_only_add::the_instance_translating_another_area's_label_otherwise_is_a_sense_check,_not_an_override
  Scenario: Another area's label translated otherwise is a sense check, not an override
    Given the same layered sources
    When the term base for "app" in French is built
    Then there are no overrides
    And the sense overrides are "Actor" and "Skill", each fixed in "core--terms" and translated by "app"

  @test:pipeline/translation-glossary.test.ts::termBase_—_the_lower_layer_fixes,_a_higher_one_may_only_add::in_ONE_subject_area_the_lower_layer_fixes,_and_a_second_translation_is_an_override
  Scenario: In one subject area the lower layer fixes, and a second translation is an override
    Given the "core" and "app" scheme catalogues both in subject area "harness-vocabulary"
    When the term base for "app" in French is built
    Then "Actor" is fixed only as "Acteur"
    And the one override is "Actor", fixed by "core" and overridden by "app"

  @test:pipeline/translation-glossary.test.ts::termBase_—_the_lower_layer_fixes,_a_higher_one_may_only_add::a_term's_own_subject_overrides_its_scheme's;_a_term_that_is_not_authored_fixes_nothing
  Scenario: A term's own subject overrides its scheme's, and a non-authored term fixes nothing
    Given the "core" catalogue in "harness-vocabulary" where "actor" has its own subject "digital-health-trust" and "skill" is not authored
    When the term base is built
    Then "Actor" is scoped to "digital-health-trust"
    And there is no "Skill" term

  @test:pipeline/translation-glossary.test.ts::termBase_—_the_lower_layer_fixes,_a_higher_one_may_only_add::an_instance_binds_in_the_subject_areas_it_declares
  Scenario: An instance binds in the subject areas it declares
    Given the "core" catalogue in subject area "digital-health-trust"
    When the term base is built for an instance declaring "digital-health-trust"
    Then "Actor" is in scope

  @test:pipeline/translation-glossary.test.ts::termBase_—_the_lower_layer_fixes,_a_higher_one_may_only_add::a_reference_glossary_binds_every_instance
  Scenario: A reference glossary binds every instance
    Given the layered sources plus an instance glossary translating "Immunization" as "Immunisation"
    When the term base for "app" in French is built
    Then the only override is "Immunization"

  @test:pipeline/translation-glossary.test.ts::subject_areas_are_read_from_the_glossary_each_scheme_catalogue_names::readSchemeScope:_the_scheme's_subject,_a_term's_own,_and_non-authored_terms
  Scenario: A scheme's subject, a term's own subject and non-authored terms are read from the glossary
    Given a glossary with subject "harness-vocabulary", a term "policy" with subject "digital-health-trust", a candidate term "draft" and a plain term "actor"
    When its scope is read
    Then the subject is "harness-vocabulary"
    And "policy" maps to "digital-health-trust"
    And "draft" maps to no subject
    And "actor" has no entry of its own
    And an empty JSON file yields no scope

  @test:pipeline/translation-glossary.test.ts::subject_areas_are_read_from_the_glossary_each_scheme_catalogue_names::readSchemeScope:_a_schema_publishing_its_terms_in_$defs_carries_its_subject_as_data
  Scenario: A schema publishing its terms in $defs carries its subject as data
    Given a JSON schema with subject "harness-vocabulary" and a "Reference" definition
    When its scope is read
    Then the subject is "harness-vocabulary"
    And no term has its own entry
    And a schema with $defs but no subject yields no scope

  @test:pipeline/translation-glossary.test.ts::subject_areas_are_read_from_the_glossary_each_scheme_catalogue_names::glossarySources_finds_the_glossary_from_the_catalogue's_#:_reference
  Scenario: The glossary is found from the catalogue's "#:" reference
    Given an instance "acme" declaring translations and glossary directories, a glossary "health" with subject "who-health-guidance", and a French catalogue "acme--health.po" referencing it
    When the French glossary sources are listed
    Then the source for "acme--health.po" has scope "who-health-guidance"

  @test:pipeline/translation-glossary.test.ts::checkLocale_—_the_three_rules,_and_scope::flags_a_msgstr_that_does_not_use_an_in-scope_fixed_term,_and_a_term_rendered_two_ways
  Scenario: A msgstr not using an in-scope fixed term, and a term rendered two ways, are flagged
    Given an instance fixing "Health worker" as "Agent de santé", with "page.po" rendering it "soignant" and translating "Actor" as "Acteur" while "other.po" translates it "Intervenant"
    And a platform layer "core" fixing "Actor" and "Clinic"
    When the French locale is checked
    Then the findings are "inconsistent" for "Actor" and "not-fixed-rendering" for "Health worker"
    And "Actor" and "Clinic" are pending adjudication

  @test:pipeline/translation-glossary.test.ts::checkLocale_—_the_three_rules,_and_scope::a_clean_locale_has_no_findings
  Scenario: A clean locale has no findings
    Given an instance fixing "Health worker" as "Agent de santé" and a catalogue rendering it so
    When the French locale is checked
    Then there are no findings
    And 1 term is fixed

  @test:pipeline/translation-glossary.test.ts::the_CLI:_one_finding_per_line,_exit_0_/_1_/_2::findings_exit_1,_one_per_line
  Scenario: CLI findings exit 1, one per line
    Given the "acme" instance with a msgstr not using its fixed term
    When the CLI runs with "--check" for locale "fr"
    Then it exits 1
    And the only "✗ fr" line is the not-fixed-rendering finding for "Health worker" in "translations/fr/page.po"
    And no qa-results record is written

  @test:pipeline/translation-glossary.test.ts::the_CLI:_one_finding_per_line,_exit_0_/_1_/_2::an_override_by_a_--layer_reference_term_exits_1
  Scenario: An override of a "--layer" reference term exits 1
    Given the "acme" instance translating "Immunization" as "Immunisation"
    And a reference layer "who" fixing it as "Vaccination", passed with "--layer"
    When the CLI runs with "--check" for locale "fr"
    Then the output contains "✗ fr override «Immunization»: who fixes «Vaccination»"
    And it exits 1

  @test:pipeline/translation-glossary.test.ts::the_CLI:_one_finding_per_line,_exit_0_/_1_/_2::cannot_determine:_an_undeclared_instance,_or_an_unknown_locale,_exits_2
  Scenario: An undeclared instance, or an unknown locale, exits 2
    Then the CLI with "--check" on an instance declaring no translations directory exits 2
    And the CLI with "--check" and locale "xx" exits 2

  @test:pipeline/translation-glossary.test.ts::the_CLI:_one_finding_per_line,_exit_0_/_1_/_2::without_--check_it_writes_the_qa-results_record,_one_family_per_locale
  Scenario: Without "--check" the CLI writes the qa-results record, one family per locale
    Given the "acme" instance
    When the CLI runs without "--check"
    Then "test/results/glossary-consistency.qa-results.json" has schema "qa-results/v1"
    And its subject is kind "glossary-consistency", id "acme"
    And its only family is "fr", with count 1

  @test:pipeline/translation-glossary.test.ts::the_KG_QA_report's_Glossary_consistency_section::one_sub-section_per_locale,_its_findings_in_a_table
  Scenario: The report section has one sub-section per locale, its findings in a table
    Given a glossary result for "acme" with one "inconsistent" finding for "Actor" in "fr" and none in "ar"
    When the Glossary consistency markdown is rendered at level 3
    Then it contains "### Glossary consistency", "#### fr" and "#### ar"
    And it contains the table row "| `inconsistent` | Actor |"
    And it contains "No findings."

  @test:pipeline/translation-glossary.test.ts::a_declared_`catalogues`_pattern_(a_smart-base_IG's_input/<area>/translations/<locale>.po)::the_pattern's_files_are_the_locale's_catalogues,_and_its_locales_are_the_layer's
  Scenario: A declared catalogues pattern's files are the locale's catalogues
    Given layer "acme" whose translations directory declares catalogues "input/*/translations/{locale}.po"
    And fr catalogues under "input/pagecontent" and "input/images", an es catalogue and a .pot template
    Then the layer's catalogue pattern is "input/*/translations/{locale}.po"
    And the pattern's catalogues are images es.po as "es", images fr.po as "fr" and pagecontent fr.po as "fr", without the .pot
    When the fr locale is checked against the glossary fixing "Health worker" as "Agent de santé"
    Then the only finding is "not-fixed-rendering" for "Health worker" in "input/pagecontent/translations/fr.po"

  @test:pipeline/translation-glossary.test.ts::a_declared_`catalogues`_pattern_(a_smart-base_IG's_input/<area>/translations/<locale>.po)::without_the_field,_only_translations/<locale>/_is_read
  Scenario: Without the catalogues field, only translations/<locale>/ is read
    Given the same layer with the catalogues field removed
    Then the layer has no catalogue pattern
    And checking the fr locale finds nothing, so the pagecontent catalogue is not read
