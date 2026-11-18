# pipeline/html-po.ts reads a rendered page into msgids (runs of text with inline
# elements as numbered placeholders) and puts a catalogue's translations back.
# Each Scenario names the test that executes it.
Feature: gettext over finished HTML

  @test:pipeline/html-po.test.ts::parseHtml::serializes_back_to_the_same_bytes
  Scenario: parseHtml: Serializes back to the same bytes
    Given the fixture in html-po.test.ts
    When parseHtml runs on it
    Then it serializes back to the same bytes

  @test:pipeline/html-po.test.ts::extractHtml::gives_one_msgid_per_run_of_text,_with_inline_elements_as_numbered_placeholders
  Scenario: extractHtml: Gives one msgid per run of text, with inline elements as numbered placeholders
    Given the fixture in html-po.test.ts
    When extractHtml runs on it
    Then it gives one msgid per run of text, with inline elements as numbered placeholders

  @test:pipeline/html-po.test.ts::extractHtml::walks_into_a_run_with_no_words_of_its_own_instead_of_making_a_sentence_of_placeholders
  Scenario: extractHtml: Walks into a run with no words of its own instead of making a sentence of placeholders
    Given the fixture in html-po.test.ts
    When extractHtml runs on it
    Then it walks into a run with no words of its own instead of making a sentence of placeholders

  @test:pipeline/html-po.test.ts::extractHtml::reads_the_attributes_a_reader_sees_or_hears
  Scenario: extractHtml: Reads the attributes a reader sees or hears
    Given the fixture in html-po.test.ts
    When extractHtml runs on it
    Then it reads the attributes a reader sees or hears

  @test:pipeline/html-po.test.ts::extractHtml::never_reads_scripts,_styles,_drawings,_code,_pre_or_translate=no
  Scenario: extractHtml: Never reads scripts, styles, drawings, code, pre or translate=no
    Given the fixture in html-po.test.ts
    When extractHtml runs on it
    Then it never reads scripts, styles, drawings, code, pre or translate=no

  @test:pipeline/html-po.test.ts::isWords::takes_words_and_leaves_identifiers_and_numbers
  Scenario: isWords: Takes words and leaves identifiers and numbers
    Given the fixture in html-po.test.ts
    When isWords runs on it
    Then it takes words and leaves identifiers and numbers

  @test:pipeline/html-po.test.ts::injectHtml::returns_the_page_unchanged,_but_for_its_lang,_when_nothing_is_translated
  Scenario: injectHtml: Returns the page unchanged, but for its lang, when nothing is translated
    Given the fixture in html-po.test.ts
    When injectHtml runs on it
    Then it returns the page unchanged, but for its lang, when nothing is translated

  @test:pipeline/html-po.test.ts::injectHtml::puts_a_translation_back_with_its_placeholders_moved,_keeping_each_element's_attributes
  Scenario: injectHtml: Puts a translation back with its placeholders moved, keeping each element's attributes
    Given the fixture in html-po.test.ts
    When injectHtml runs on it
    Then it puts a translation back with its placeholders moved, keeping each element's attributes

  @test:pipeline/html-po.test.ts::injectHtml::refuses_a_translation_whose_placeholders_differ,_leaving_the_English
  Scenario: injectHtml: Refuses a translation whose placeholders differ, leaving the English
    Given the fixture in html-po.test.ts
    When injectHtml runs on it
    Then it refuses a translation whose placeholders differ, leaving the English

  @test:pipeline/html-po.test.ts::injectHtml::escapes_what_a_translator_writes,_so_a_msgstr_cannot_inject_markup
  Scenario: injectHtml: Escapes what a translator writes, so a msgstr cannot inject markup
    Given the fixture in html-po.test.ts
    When injectHtml runs on it
    Then it escapes what a translator writes, so a msgstr cannot inject markup

  @test:pipeline/html-po.test.ts::injectHtml::translates_an_attribute_in_place
  Scenario: injectHtml: Translates an attribute in place
    Given the fixture in html-po.test.ts
    When injectHtml runs on it
    Then it translates an attribute in place

  @test:pipeline/html-po.test.ts::injectHtml::marks_a_right-to-left_locale_on_<html>
  Scenario: injectHtml: Marks a right-to-left locale on <html>
    Given the fixture in html-po.test.ts
    When injectHtml runs on it
    Then it marks a right-to-left locale on <html>
