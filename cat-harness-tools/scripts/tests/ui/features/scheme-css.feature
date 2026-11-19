# Covers scripts/lib/scheme-css.ts: dark-mode CSS that the reader's pick overrides, and the first-paint
# scheme snippet (stored choice, else the OS, else light) that standalone pages carry. Each Scenario names the test that executes it.
Feature: Colour scheme CSS and first-paint snippet

  @test:scripts/tests/ui/scheme-css.test.ts::darkRules::the_OS_decides_only_when_the_reader_has_not_picked_light
  Scenario: OS dark rules apply only when the reader has not picked light
    Given dark rules built from a ":root" block and an "ins, del" block
    When the CSS is read
    Then the ":root" rule sits under "prefers-color-scheme: dark" scoped to ":root:not([data-fa-scheme=\"light\"])"
    And each selector of "ins, del" is scoped to ":root:not([data-fa-scheme=\"light\"])"

  @test:scripts/tests/ui/scheme-css.test.ts::darkRules::a_reader_who_picked_dark_gets_it_on_any_OS
  Scenario: A reader who picked dark gets the dark rules outside the media query
    Given dark rules built from a ":root" block and an "ins, del" block
    When the CSS after the media block is read
    Then it carries the ":root" rule under ":root[data-fa-scheme=\"dark\"]"
    And each selector of "ins, del" is scoped to ":root[data-fa-scheme=\"dark\"]"

  @test:scripts/tests/ui/scheme-css.test.ts::darkRules::the_native_controls_follow_the_pick_too
  Scenario: Native controls follow the reader's pick
    Given dark rules built from flat CSS
    Then the CSS sets "color-scheme: light" when the reader picked light
    And it sets "color-scheme: dark" when the reader picked dark

  @test:scripts/tests/ui/scheme-css.test.ts::darkRules::a_nested_block_is_refused,_not_half-copied
  Scenario: A nested CSS block is refused
    Given CSS with an "@supports" block nesting a rule
    When dark rules are built from it
    Then it throws an error mentioning "flat rules only"

  @test:scripts/tests/ui/scheme-css.test.ts::the_first-paint_scheme_—_stored,_else_the_OS,_else_light::a_stored_choice_wins_over_the_OS
  Scenario: A stored choice wins over the OS
    Given the first-paint snippet run against stubbed browser globals
    When light is stored and the OS prefers dark
    Then the page scheme is "light"
    And when dark is stored and the OS prefers light the scheme is "dark"

  @test:scripts/tests/ui/scheme-css.test.ts::the_first-paint_scheme_—_stored,_else_the_OS,_else_light::nothing_stored:_the_OS_decides
  Scenario: With nothing stored the OS decides
    Given the first-paint snippet with nothing stored
    When the OS prefers dark
    Then the page scheme is "dark"
    And when the OS prefers light the scheme is "light"

  @test:scripts/tests/ui/scheme-css.test.ts::the_first-paint_scheme_—_stored,_else_the_OS,_else_light::nothing_stored_and_the_OS_says_nothing:_LIGHT
  Scenario: With nothing stored and no OS preference the scheme is light
    Given the first-paint snippet with nothing stored
    When the OS matches neither scheme, has no matchMedia, or matchMedia throws
    Then the page scheme is "light" in each case
    And a stored value of "garbage" with no OS preference also gives "light"

  @test:scripts/tests/ui/scheme-css.test.ts::the_first-paint_scheme_—_stored,_else_the_OS,_else_light::a_site_that_DECLARES_dark_does_not_decide_the_reader's_scheme
  Scenario: A site that declares dark does not decide the reader's scheme
    Given the first-paint snippet and a site declaring scheme "dark"
    When the OS has no preference or prefers light
    Then the page scheme is "light" in both cases

  @test:scripts/tests/ui/scheme-css.test.ts::the_first-paint_scheme_—_stored,_else_the_OS,_else_light::a_standalone_page_carries_the_same_bytes,_marked_once
  Scenario: A standalone page carries the same snippet bytes, marked once
    Given a minimal HTML page
    When the saved scheme is added to it
    Then its marked script equals the first-paint snippet with the "data-folio-saved-scheme" mark
    And adding the saved scheme again leaves the page unchanged

  @test:scripts/tests/ui/scheme-css.test.ts::the_first-paint_scheme_—_stored,_else_the_OS,_else_light::a_page_carrying_an_OUTDATED_marked_snippet_is_brought_up_to_the_current_rule,_in_place
  Scenario: An outdated marked snippet is replaced in place by the current one
    Given a page whose head carries an older stored-choice-only marked snippet
    When the saved scheme is added to it
    Then the output is the page with only that snippet replaced by the current marked snippet
    And adding the saved scheme again leaves the output unchanged

  @test:scripts/tests/ui/scheme-css.test.ts::the_first-paint_scheme_—_stored,_else_the_OS,_else_light::a_second_marked_snippet_is_dropped,_so_one_rule_decides
  Scenario: A second marked snippet is dropped so one rule decides
    Given a page with the saved scheme and a second marked script inserted before the title
    When the saved scheme is added to it
    Then "data-folio-saved-scheme" appears exactly once

  @test:scripts/tests/ui/scheme-css.test.ts::the_first-paint_scheme_—_stored,_else_the_OS,_else_light::the_mark_named_in_prose_is_not_a_snippet:_the_page_still_gets_one
  Scenario: A mark named in prose is not taken for a snippet
    Given a page with no snippet whose body has "data-folio-saved-scheme" inside a code element
    When the saved scheme is added to it
    Then the output contains the current marked snippet

  @test:scripts/tests/ui/scheme-css.test.ts::the_first-paint_scheme_—_stored,_else_the_OS,_else_light::a_page_marked_with_an_OLDER_snippet_gets_the_current_one,_once
  Scenario: A page marked with an older snippet ends with exactly the current one
    Given a page whose head carries an older stored-choice-only marked snippet after a newline
    When the saved scheme is added to it
    Then the only marked script on the page is the current marked snippet
    And adding the saved scheme again leaves the page unchanged
