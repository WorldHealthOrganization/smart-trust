# scripts/set-html-lang.ts puts a built page's own declared locale on its <html> element, adding dir="rtl" for right-to-left locales and changing nothing else.
# Each Scenario names the test that executes it.
Feature: Built pages carry their own locale on the html tag

  @test:scripts/tests/ui/set-html-lang.test.ts::declaredLang_—_the_page's_own_statement,_not_its_path::reads_the_locale_out_of_the_meta_block
  Scenario: The locale is read from the page's translation meta block
    Given built pages whose meta blocks declare "zh" and "ar"
    When the declared language of each is read
    Then they are "zh" and "ar"

  @test:scripts/tests/ui/set-html-lang.test.ts::declaredLang_—_the_page's_own_statement,_not_its_path::returns_null_when_there_is_no_meta_block_at_all
  Scenario: A page with no meta block declares no locale
    Given a built page with no translation meta block
    When its declared language is read
    Then it is null

  @test:scripts/tests/ui/set-html-lang.test.ts::declaredLang_—_the_page's_own_statement,_not_its_path::distinguishes_UNREADABLE_from_absent
  Scenario: An unreadable meta block is told apart from an absent one
    Given a page whose translation meta block is not valid JSON
    And a page with no meta block
    When the declared language of each is read
    Then the broken page reads "unreadable"
    And the page with no meta block reads null

  @test:scripts/tests/ui/set-html-lang.test.ts::declaredLang_—_the_page's_own_statement,_not_its_path::treats_an_empty_or_non-string_lang_as_no_declaration
  Scenario: An empty or non-string lang counts as no declaration
    Given a meta block with lang "" and one with lang 7
    When the declared language of each is read
    Then both are null

  @test:scripts/tests/ui/set-html-lang.test.ts::setLang::replaces_the_theme's_site-wide_lang_with_the_page's_own
  Scenario: The theme's site-wide lang is replaced with the page's own
    Given a page whose html tag says lang "en-US" and whose meta declares "zh"
    When the lang is set to "zh"
    Then the result is reported changed
    And the html tag reads lang "zh"
    And "en-US" no longer appears

  @test:scripts/tests/ui/set-html-lang.test.ts::setLang::adds_dir=rtl_for_a_right-to-left_locale,_and_only_for_those
  Scenario: Only a right-to-left locale gets dir="rtl"
    Given pages declaring "ar" and "es"
    When each has its lang set
    Then the "ar" page carries dir="rtl"
    And the "es" page carries no dir attribute at all

  @test:scripts/tests/ui/set-html-lang.test.ts::setLang::covers_every_locale_RTL_LOCALES_names
  Scenario: Every locale in RTL_LOCALES gets dir="rtl"
    Given a page for each locale named in RTL_LOCALES
    When each has its lang set to that locale
    Then every one carries dir="rtl"

  @test:scripts/tests/ui/set-html-lang.test.ts::setLang::PRESERVES_every_other_attribute,_and_their_order
  Scenario: Other attributes on the html tag survive in their order
    Given an html tag with lang "en-US", class "js", data-theme "dark" and prefix "og: x"
    When the lang is set to "fr"
    Then the tag reads lang "fr" followed by the same class, data-theme and prefix in the same order

  @test:scripts/tests/ui/set-html-lang.test.ts::setLang::LEAVES_a_tag_whose_language_already_agrees,_keeping_its_region
  Scenario: A tag whose language already agrees is left with its region
    Given a page with html lang "en-US" that declares "en"
    When the lang is set to "en"
    Then the result is reported unchanged
    And the html tag still reads lang "en-US"

  @test:scripts/tests/ui/set-html-lang.test.ts::setLang::still_corrects_a_tag_whose_language_DIFFERS,_region_or_not
  Scenario: A tag whose language differs is corrected, region or not
    Given a page with html lang "en-US" declaring "zh" and one with html lang "en" declaring "fr"
    When each has its lang set
    Then the tags read lang "zh" and lang "fr"

  @test:scripts/tests/ui/set-html-lang.test.ts::setLang::compares_subtags_case-insensitively
  Scenario: Language subtags are compared case-insensitively
    Given a page with html lang "EN-us" that declares "en"
    When the lang is set to "en"
    Then the result is reported unchanged

  @test:scripts/tests/ui/set-html-lang.test.ts::setLang::adds_dir_to_an_RTL_page_whose_language_ALREADY_agrees
  Scenario: An RTL page whose language already agrees still gets dir
    Given a page with html lang "ar" that declares "ar"
    When the lang is set to "ar"
    Then the result is reported changed
    And the tag reads lang "ar" dir "rtl"

  @test:scripts/tests/ui/set-html-lang.test.ts::setLang::adds_lang_when_the_tag_carries_none
  Scenario: A tag with no lang gets one
    Given a page whose html tag has no attributes and which declares "ru"
    When the lang is set to "ru"
    Then the result is reported changed
    And the tag reads lang "ru"

  @test:scripts/tests/ui/set-html-lang.test.ts::setLang::replaces_an_existing_dir_rather_than_appending_a_second_one
  Scenario: An existing dir is replaced rather than duplicated
    Given a page with html lang "en-US" dir "ltr" that declares "ar"
    When the lang is set to "ar"
    Then the output carries dir="rtl"
    And dir= appears exactly once

  @test:scripts/tests/ui/set-html-lang.test.ts::setLang::is_idempotent_—_a_second_pass_changes_nothing
  Scenario: A second pass changes nothing
    Given a page declaring "ar" whose lang has been set once
    When the lang is set again on the result
    Then the second pass is reported unchanged
    And its output is identical to the first

  @test:scripts/tests/ui/set-html-lang.test.ts::setLang::reports_no_change_rather_than_throwing_when_there_is_no_html_tag
  Scenario: A fragment with no html tag is reported unchanged
    Given the fragment "<p>a fragment</p>"
    When the lang is set to "fr"
    Then the result is reported unchanged
    And the fragment is returned as it was

  @test:scripts/tests/ui/set-html-lang.test.ts::setLang::touches_ONLY_the_html_tag_—_the_rest_of_the_document_is_byte-identical
  Scenario: Only the html tag changes; the rest of the document is byte-identical
    Given a built page declaring "zh"
    When the lang is set to "zh"
    Then, with the html tag masked out, the output equals the input
    And the closing "</html>" and the "fa-translation-meta" block are still present

  @test:scripts/tests/ui/set-html-lang.test.ts::run_over_a_built_tree::corrects_the_translations,_counts_the_rest,_and_writes_only_what_changed
  Scenario: A run over a built tree corrects translations, counts the rest and writes only what changed
    Given a built tree with a root page with no meta, pages declaring "es", "ar" and a nested "zh" guide, and a non-HTML file
    When the pass runs over the tree
    Then it counts 4 pages, 3 declared, 3 changed and 1 with no meta
    And no page is unreadable or lacks an html tag
    And the nested "zh" guide now has lang "zh"
    And the "ar" page now has dir="rtl"
    And the page with no meta is byte-for-byte unchanged

  @test:scripts/tests/ui/set-html-lang.test.ts::run_over_a_built_tree::`--check`_reports_what_would_change_and_writes_NOTHING
  Scenario: Check mode reports what would change and writes nothing
    Given a built tree with one page declaring "fr"
    When the pass runs with check on
    Then it reports 1 change
    And the page on disk is unchanged

  @test:scripts/tests/ui/set-html-lang.test.ts::run_over_a_built_tree::is_idempotent_over_a_tree_—_the_second_run_corrects_nothing
  Scenario: A second run over a tree corrects nothing
    Given a built tree with pages declaring "ar" and "zh"
    When the pass runs twice
    Then the first run changes 2 pages and the second changes 0

  @test:scripts/tests/ui/set-html-lang.test.ts::run_over_a_built_tree::reports_an_unreadable_meta_block_rather_than_skipping_it_quietly
  Scenario: An unreadable meta block is reported, not skipped quietly
    Given a built tree with one page whose meta block is not valid JSON
    When the pass runs over the tree
    Then one page is listed as unreadable
    And no page is counted as having no meta

  @test:scripts/tests/ui/set-html-lang.test.ts::run_over_a_built_tree::reports_a_declared_page_with_no_html_tag_rather_than_counting_it_corrected
  Scenario: A declared page with no html tag is reported, not counted as corrected
    Given a built tree with a fragment that declares "fr" but has no html tag
    When the pass runs over the tree
    Then one page is listed as having no html tag
    And no page is counted as changed
