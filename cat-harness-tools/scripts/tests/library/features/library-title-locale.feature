# The listing's title cell, written by scripts/gen-library-viz.ts (owner,
# 2026-11-13): the reader's language under a title in another one, and a cap
# with the whole title on hover. Each Scenario names the test that executes it.
Feature: The library listing's title cell

  @test:scripts/tests/library/library-title-locale.test.ts::a_title_not_in_the_page's_language::shows_the_reader's_language_under_it_when_an_edition_has_one
  Scenario: A French title on the English page shows its English edition's title under it
    Given the viewer's columns, run on a page under /en/
    When the title cell of a French entry whose English edition is titled "The strategy" is rendered
    Then "The strategy" follows the French title in a span marked lang "en", with the same text in its title attribute

  @test:scripts/tests/library/library-title-locale.test.ts::a_title_not_in_the_page's_language::shows_nothing_extra_when_there_is_none,_or_when_the_title_is_already_in_it
  Scenario: Nothing is added without an edition in the page's language, or for a title already in it
    Given the viewer's columns, run on a page under /en/
    When the title cell of a Chinese entry with no other edition, and of an English entry with a French edition, is rendered
    Then neither holds a locale title

  @test:scripts/tests/library/library-title-locale.test.ts::a_long_title::is_capped_at_three_lines,_with_the_whole_of_it_on_hover_and_in_the_DOM
  Scenario: A long title is capped, and the whole of it stays available
    Given a title of 200 words
    When its title cell is rendered
    Then the link holds the whole title as its text and in its title attribute
    And the stylesheet clamps the title link to three lines
