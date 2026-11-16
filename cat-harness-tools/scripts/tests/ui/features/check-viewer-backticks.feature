# scripts/check-viewer-backticks.ts finds a stray backtick that ends a standalone page's HTML template literal early, over a file set derived by walking the repo.
# Each Scenario names the test that executes it.
Feature: Stray backticks in page templates

  @test:scripts/tests/ui/check-viewer-backticks.test.ts::strayBacktick::a_well-formed_template_is_not_a_finding
  Scenario: A well-formed page template is not a finding
    Given a function returning a doctype template with a comment holding no backtick
    When it is checked for a stray backtick
    Then there is no finding

  @test:scripts/tests/ui/check-viewer-backticks.test.ts::strayBacktick::a_backtick_in_a_COMMENT_is_found,_and_its_line_named
  Scenario: A backtick in an HTML comment inside the template is found, with its line named
    Given the well-formed template with its comment changed to quote "`qttr`"
    When it is checked for a stray backtick
    Then there is a finding on line 4
    And the finding's text contains "qttr"

  @test:scripts/tests/ui/check-viewer-backticks.test.ts::strayBacktick::a_backtick_BEFORE_the_template_is_fine_and_must_stay_fine
  Scenario: A backtick before the template is not a finding
    Given a doc comment quoting "`foo`" above the well-formed template
    When it is checked for a stray backtick
    Then there is no finding

  @test:scripts/tests/ui/check-viewer-backticks.test.ts::strayBacktick::a_file_with_no_page_template_is_not_a_finding
  Scenario: A file with no page template is not a finding
    Given a file holding only "export const x = 1;"
    When it is checked for a stray backtick
    Then there is no finding

  @test:scripts/tests/ui/check-viewer-backticks.test.ts::strayBacktick::an_escaped_backtick_does_not_end_the_literal
  Scenario: An escaped backtick does not end the literal
    Given the well-formed template with an escaped backtick in its comment
    When it is checked for a stray backtick
    Then there is no finding

  @test:scripts/tests/ui/check-viewer-backticks.test.ts::an_interpolation_is_CODE,_not_page_text_—_bean_`57n3`::a_nested_template_inside_${…}_does_not_end_the_page
  Scenario: A nested template inside an interpolation does not end the page
    Given a page whose title holds an interpolation containing a nested template literal
    When it is checked for a stray backtick
    Then there is no finding

  @test:scripts/tests/ui/check-viewer-backticks.test.ts::an_interpolation_is_CODE,_not_page_text_—_bean_`57n3`::a_brace_inside_a_STRING_inside_${…}_does_not_close_the_interpolation
  Scenario: A brace inside a string inside an interpolation does not close it
    Given a page with an interpolation whose string literal holds a closing brace and whose other branch is a template
    When it is checked for a stray backtick
    Then there is no finding

  @test:scripts/tests/ui/check-viewer-backticks.test.ts::an_interpolation_is_CODE,_not_page_text_—_bean_`57n3`::nested_braces_inside_${…}_are_balanced
  Scenario: Nested braces inside an interpolation are balanced
    Given a page with an interpolation calling a function on a nested object literal
    When it is checked for a stray backtick
    Then there is no finding

  @test:scripts/tests/ui/check-viewer-backticks.test.ts::an_interpolation_is_CODE,_not_page_text_—_bean_`57n3`::but_a_backtick_OUTSIDE_an_interpolation_still_ends_it_—_the_trap
  Scenario: A backtick outside any interpolation still ends the literal and is found
    Given a page whose HTML comment quotes "`backtick`"
    When it is checked for a stray backtick
    Then there is a finding
    And its text contains "backtick"

  @test:scripts/tests/ui/check-viewer-backticks.test.ts::an_interpolation_is_CODE,_not_page_text_—_bean_`57n3`::a_template_that_never_closes_is_not_a_finding
  Scenario: A template that never closes is not a finding
    Given a doctype template that is never closed
    When it is checked for a stray backtick
    Then there is no finding

  @test:scripts/tests/ui/check-viewer-backticks.test.ts::the_file_set_is_derived,_not_listed::it_finds_the_generators,_including_the_one_outside_cat-harness
  Scenario: The derived file set finds the generators, including one outside cat-harness
    When the viewer sources are derived from the repo root
    Then they include "who-iris/scripts/gen-iris-pages.ts" and "cat-harness-tools/scripts/kg-viewer.ts"
    And they exclude the themed generators gen-schema-viz, gen-voices-viz, gen-uploads-viz, gen-document-kinds-viz, gen-translation-status and gen-auto-docs

  @test:scripts/tests/ui/check-viewer-backticks.test.ts::the_file_set_is_derived,_not_listed::it_excludes_tests,_and_THIS_file_is_why
  Scenario: The derived file set excludes tests
    When the viewer sources are derived from the repo root
    Then none ends in ".test.ts"
    And none ends in ".e2e.ts"

  @test:scripts/tests/ui/check-viewer-backticks.test.ts::the_file_set_is_derived,_not_listed::every_derived_source_exists_and_holds_a_page_template
  Scenario: Every derived source exists, holds a page template and has no stray backtick
    When the viewer sources are derived from the repo root
    Then there is at least one
    And each file reads with a "return `<!doctype html>" template
    And each has no stray backtick
