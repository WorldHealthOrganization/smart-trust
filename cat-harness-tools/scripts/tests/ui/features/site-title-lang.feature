# The site's _includes/title.html marks the sidebar title with its own language and direction,
# not the page's. Each Scenario names the test that executes it.
Feature: The site title carries its own language

  @test:scripts/tests/ui/site-title-lang.test.ts::title.html_marks_the_site_title_with_its_own_language::the_title_span_carries_lang_and_dir,_never_the_page's
  Scenario: The title span carries its own lang and dir attributes
    Given the site's _includes/title.html
    Then it contains a span of class "fa-site-title" whose lang is title_lang and whose dir is title_dir

  @test:scripts/tests/ui/site-title-lang.test.ts::title.html_marks_the_site_title_with_its_own_language::the_language_is_the_translation_index's_source_locale,_defaulting_to_English
  Scenario: The title language is the translation index's source locale, defaulting to English
    Given the site's _includes/title.html
    Then it assigns title_lang from site.data.translations.sourceLocale with a default of "en"

  @test:scripts/tests/ui/site-title-lang.test.ts::title.html_marks_the_site_title_with_its_own_language::a_right-to-left_title_language_turns_the_direction;_anything_else_reads_left_to_right
  Scenario: A right-to-left title language turns the direction, anything else reads left to right
    # Gap: only the template text is checked; no title is rendered
    Given the site's _includes/title.html
    Then it assigns title_dir as "ltr" by default
    And it tests title_lang against "ar", "he", "fa" and "ur"
