# The pure parts of the visual diff Tool, scripts/block-screenshots.ts: pixel comparison,
# which changed blocks get a picture, and the page each is shot on.
# Each Scenario names the test that executes it.
Feature: Block screenshot diffs

  @test:scripts/tests/block-screenshots.test.ts::comparePixels::identical_pictures:_nothing_changed
  Scenario: Identical pictures show no change
    Given two identical 4 by 3 pictures
    When they are compared with tolerance 24
    Then the changed fraction is 0

  @test:scripts/tests/block-screenshots.test.ts::comparePixels::differences_within_the_tolerance_are_anti-aliasing,_not_change
  Scenario: Colour differences within the tolerance are not change
    Given two 2 by 2 pictures differing by 20 in red
    When they are compared with tolerance 24
    Then the changed fraction is 0
    And a difference of 30 in red gives a changed fraction of 1

  @test:scripts/tests/block-screenshots.test.ts::comparePixels::one_changed_pixel_of_four_is_a_quarter,_and_is_marked_in_the_diff
  Scenario: One changed pixel of four is a quarter, marked in the diff image
    Given two black 2 by 2 pictures where one pixel of the second turns red
    When they are compared with tolerance 24
    Then the changed fraction is 0.25
    And that pixel in the diff image is the marker colour 214, 51, 132, 255
    And an unchanged pixel is faded, with red above 150

  @test:scripts/tests/block-screenshots.test.ts::comparePixels::a_size_change_counts_the_uncovered_area_as_changed
  Scenario: A size change counts the uncovered area as changed
    Given a 2 by 2 picture and a 2 by 4 picture of the same colour
    When they are compared
    Then the result is 2 wide, 4 high, with a changed fraction of 0.5

  @test:scripts/tests/block-screenshots.test.ts::comparePixels::is_self-contained,_so_the_page_runs_exactly_this_function
  Scenario: The comparison function runs from its own source text
    Given comparePixels rebuilt from its source string with new Function
    When it compares a black pixel with a red one
    Then the changed fraction is 1

  @test:scripts/tests/block-screenshots.test.ts::which_blocks_get_a_picture::only_visual_kinds,_on_whichever_side_has_the_block
  Scenario: Only visual kinds get a picture, from whichever side has the block
    Given a changed figure, a changed prose block and a removed table with only a base side
    When the visual changes are selected
    Then only "fig:a" and "tbl:c" are selected

  @test:scripts/tests/block-screenshots.test.ts::which_blocks_get_a_picture::the_page_is_the_manifest's_first_segment,_kept_to_one_safe_segment
  Scenario: A block's page is its manifest's first path segment
    Given a block manifest "handbook/ch1/fig.ts"
    When its page is computed
    Then the page is "handbook/index.html"
    And a manifest "../evil/x.ts" or no manifest gives no page
    And "fig:dose-curve" becomes the safe name "fig_dose-curve"

  @test:scripts/tests/block-screenshots.test.ts::which_blocks_get_a_picture::in_a_site,_the_page_under_the_locale_when_it_is_there,_else_the_old_address_(#2527)
  Scenario: In a built site, the page under the locale is used when it exists
    Given a built site with no locale directory
    When the page for "handbook/ch1/fig.ts" is found in it
    Then it is "handbook/index.html"
    And once "en/handbook/index.html" exists it is "en/handbook/index.html"
    And "../evil/x.ts" gives no page

  @test:scripts/tests/block-screenshots.test.ts::which_blocks_get_a_picture::the_visual_renderer_defaults_for_exactly_the_kinds_the_Tool_pictures
  Scenario: The visual diff renderer defaults for exactly the pictured kinds
    Given the diff renderer with id "visual"
    Then its default kinds, sorted, equal VISUAL_KINDS, sorted
