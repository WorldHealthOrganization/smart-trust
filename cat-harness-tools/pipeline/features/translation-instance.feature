# The translation scripts' "--instance <dir>" option (scripts/lib/roots.ts explicitInstanceRoot) and the catalogue pass of
# pipeline/translation-block-qa.ts, run against a downstream layer that declares translation-sources and has no Jekyll site.
# Each Scenario names the test that executes it.
Feature: Translation scripts on a downstream instance

  @test:pipeline/translation-instance.test.ts::explicitInstanceRoot_—_the_flag,_or_nothing::absent_means_the_caller_keeps_its_own_root
  Scenario: With no "--instance" flag the caller keeps its own root
    When the instance root is read from arguments "--check" only
    Then there is none

  @test:pipeline/translation-instance.test.ts::explicitInstanceRoot_—_the_flag,_or_nothing::present_names_a_declared_instance
  Scenario: An "--instance" flag names a declared instance
    Given a downstream instance "acme" declaring its translations directory
    Then "--instance <dir>" resolves to that directory
    And "--instance=<dir>" resolves to that directory

  @test:pipeline/translation-instance.test.ts::explicitInstanceRoot_—_the_flag,_or_nothing::a_directory_with_no_declaration_is_refused_where_it_is_named
  Scenario: A directory with no declaration is refused where it is named
    When the instance root is read from "--instance" naming a directory that does not exist
    Then it throws "no instance declaration"

  @test:pipeline/translation-instance.test.ts::catalogueDriftFor_—_each_catalogue_against_the_template_beside_it::reports_what_the_template_gained_and_what_the_catalogue_still_offers
  Scenario: Catalogue drift reports what the template gained and what the catalogue still offers
    Given the "acme" instance whose French "page.po" lacks a sentence its template has and still offers one the page dropped, an in-step glossary catalogue, and a "glossary.po" with no template
    When catalogue drift is measured
    Then 2 catalogues were compared
    And the only drifted catalogue is "translations/fr/page.po", missing "Second sentence, see WHO 2024." with extra "A sentence the page dropped."

  @test:pipeline/translation-instance.test.ts::catalogueDriftFor_—_each_catalogue_against_the_template_beside_it::an_instance_that_declares_no_translations_is_undefined,_never_an_empty_list
  Scenario: An instance that declares no translations has undefined catalogue drift
    Given an instance that declares no translations directory
    When catalogue drift is measured
    Then the result is undefined, not an empty list

  @test:pipeline/translation-instance.test.ts::cataloguePairs_—_catalogues_with_a_template,_per_locale::finds_page_and_glossary_catalogues,_skips_one_with_no_.pot
  Scenario: Catalogue pairs are found per locale, skipping a catalogue with no template
    Given the "acme" instance's translations directory
    When catalogue pairs are listed for "fr" and "es"
    Then they are "fr/glossary/terms" and "fr/page"

  @test:pipeline/translation-instance.test.ts::the_four_scripts_take_--instance::translation:drift:check_compares_the_instance's_catalogues,_and_fails_on_drift
  Scenario: The drift check compares an instance's catalogues and fails on drift
    When "pipeline/translation-drift.ts" runs with "--instance" on "acme"
    Then the output says it "declares no Jekyll site"
    And names "translations/fr/page.po"
    And reports "2 catalogue(s) in translations/ compared with their .pot, 1 drifted"
    And it exits 1

  @test:pipeline/translation-instance.test.ts::the_four_scripts_take_--instance::translation:drift:check_on_an_instance_with_no_catalogues_and_no_site_cannot_determine
  Scenario: The drift check on an instance with no catalogues and no site cannot determine
    When "pipeline/translation-drift.ts" runs with "--instance" on an undeclared instance
    Then it exits 2

  @test:pipeline/translation-instance.test.ts::the_four_scripts_take_--instance::translation:obsolete:check_resolves_an_instance-relative_source_with_no_site
  Scenario: The obsolete check resolves an instance-relative source with no site
    When "pipeline/obsolete-stale-po.ts" runs with "--check" and "--instance" on "acme"
    Then the output contains "translations/fr/page.po  (source input/page.md)"
    And it names "A sentence the page dropped."
    And it exits 1

  @test:pipeline/translation-instance.test.ts::the_four_scripts_take_--instance::translation:obsolete:check_on_an_undeclared_instance_is_not_a_pass
  Scenario: The obsolete check on an undeclared instance is not a pass
    When "pipeline/obsolete-stale-po.ts" runs with "--check" and "--instance" on an undeclared instance
    Then it exits 2

  @test:pipeline/translation-instance.test.ts::the_four_scripts_take_--instance::translation:index:check_reports_an_instance_with_no_site_unreadable
  Scenario: The index check reports an instance with no site as unreadable
    When "pipeline/translation-index.ts" runs with "--check" and "--instance" on "acme"
    Then the output says it "declares no Jekyll site"
    And it exits 2

  @test:pipeline/translation-instance.test.ts::the_four_scripts_take_--instance::translation:status_reports_the_instance's_locales_and_writes_nothing
  Scenario: Translation status reports the instance's locales
    # Gap: that nothing is written is not checked
    When "scripts/gen-translation-status.ts" runs with "--instance" on "acme"
    Then the output contains "acme: translations/"
    And it reports "fr" with 3 catalogues of 2 templates
    And it exits 0
    And with "--json" the first locale is "fr"
    And on an undeclared instance it exits 2

  @test:pipeline/translation-instance.test.ts::translation:page-qa_—_catalogues_with_no_block_or_page_get_a_sidecar::writes_one_translation-qa/v1_sidecar_per_translated_catalogue,_under_the_instance's_QA_tree
  Scenario: Catalogue QA writes one translation-qa/v1 sidecar per translated catalogue
    When "pipeline/translation-block-qa.ts" runs with "--catalogues" and "--instance" on "acme"
    Then it exits 0
    And "page.fr.translation-qa.json" under the instance's "test/results/translation-qa/translations" has schema "translation-qa/v1", label "trans:fr/page", pot path "translations/fr/page.pot" and po "translations/fr/page.po"
    And its translation coverage is "warn" with 2 of 3 translated, 67 percent
    And it has no semantic round-trip entries
    And the glossary "terms" sidecar's coverage is "pass"
    And no sidecar is written for the "glossary.po" with no template

  @test:pipeline/translation-instance.test.ts::translation:page-qa_—_catalogues_with_no_block_or_page_get_a_sidecar::without_--catalogues,_nothing_is_written_for_them
  Scenario: Without "--catalogues" no catalogue sidecars are written
    Given a fresh "acme" instance
    When "pipeline/translation-block-qa.ts" runs with "--instance" only
    Then no "test/results/translation-qa/translations" directory exists
