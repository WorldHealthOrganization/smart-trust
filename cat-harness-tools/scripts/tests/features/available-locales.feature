# scripts/check-available-locales.ts fails a docs page whose available_locales names a
# language the translation index has no rendered page for.
# Each Scenario names the test that executes it.
Feature: Available-locale claims are backed by rendered pages

  @test:scripts/tests/available-locales.test.ts::the_real_corpus::the_index_was_READABLE_—_a_clean_verdict_over_an_unreadable_one_is_not_clean
  Scenario: The translation index over the real corpus is readable
    Given the available-locale claims over the real corpus
    Then no unreadable index is reported

  @test:scripts/tests/available-locales.test.ts::the_real_corpus::pages_actually_declare_the_field_—_otherwise_this_file_asserts_nothing
  Scenario: Real pages declare available_locales
    Given the available-locale claims over the real corpus
    Then more than 0 pages declare the field

  @test:scripts/tests/available-locales.test.ts::the_real_corpus::translations_are_among_them_—_otherwise_the_index_inversion_is_untested
  Scenario: Both translated and source pages are among the declaring pages
    Given the available-locale claims over the real corpus
    Then more than 0 translated pages were checked
    And more than 0 source pages were checked

  @test:scripts/tests/available-locales.test.ts::the_real_corpus::no_page_claims_a_locale_it_has_no_rendered_page_for
  Scenario: No page claims a locale it has no rendered page for
    Given the available-locale claims over the real corpus
    Then there are no findings of a page claiming an unbacked locale

  @test:scripts/tests/available-locales.test.ts::backedLocales_—_what_a_claim_may_legitimately_name::the_source_language,_always,_with_no_entry_needed
  Scenario: An untranslated page is backed in its source language
    Given a translation index where "guides/who-smart-ig" has no translations
    When the backed locales of that page are read with source "en"
    Then they are exactly "en"

  @test:scripts/tests/available-locales.test.ts::backedLocales_—_what_a_claim_may_legitimately_name::plus_every_locale_with_a_rendered_translation
  Scenario: A page is backed in every locale it has a translation for
    Given a translation index where "architecture" has fr and zh translations
    When the backed locales of that page are read with source "en"
    Then they are "en", "fr" and "zh"

  @test:scripts/tests/available-locales.test.ts::backedLocales_—_what_a_claim_may_legitimately_name::and_NOT_a_locale_the_index_has_no_translation_for
  Scenario: A locale with no translation is not backed
    Given the same translation index
    Then "architecture" is not backed in "ru"
    And "guides/who-smart-ig" is not backed in "fr"

  @test:scripts/tests/available-locales.test.ts::backedLocales_—_what_a_claim_may_legitimately_name::an_unknown_key_yields_the_source_language_alone,_rather_than_throwing
  Scenario: A page missing from the index is backed in its source language alone
    Given the same translation index
    When the backed locales of "no-such-page" are read with source "en"
    Then they are exactly "en", and nothing throws

  @test:scripts/tests/available-locales.test.ts::sourceKeyByTranslation_—_the_inversion::a_translated_page's_key_maps_to_the_page_it_translates
  Scenario: A translated page's key maps to the page it translates
    Given the inversion of the translation index
    Then "fr/architecture" and "zh/architecture" each map to "architecture"

  @test:scripts/tests/available-locales.test.ts::sourceKeyByTranslation_—_the_inversion::a_SOURCE_page_is_absent_from_it,_which_is_how_the_two_roles_are_told_apart
  Scenario: Source pages are absent from the inversion
    Given the inversion of the translation index
    Then it has no entry for "architecture"
    And it has no entry for "guides/who-smart-ig"

  @test:scripts/tests/available-locales.test.ts::sourceKeyByTranslation_—_the_inversion::keys_are_NORMALISED,_not_raw_URLs
  Scenario: The inversion is keyed by normalised page keys, not raw URLs
    Given the inversion of the translation index
    Then it has no entry for "/fr/architecture.html"
