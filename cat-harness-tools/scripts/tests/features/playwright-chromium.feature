# Which Chromium Playwright launches: an explicit binary, Playwright's own
# choice, or the build the image ships, and unknown rather than a guessed path.
# Each Scenario names the test that executes it.
Feature: Resolving the Chromium Playwright launches

  @test:scripts/tests/playwright-chromium.test.ts::which_Chromium_Playwright_launches::an_explicitly_named_binary_wins_over_everything_else
  Scenario: An explicitly named binary wins
    Given PLAYWRIGHT_CHROMIUM_PATH and PLAYWRIGHT_BROWSERS_PATH are both set
    Then the choice is explicit, at the named binary

  @test:scripts/tests/playwright-chromium.test.ts::which_Chromium_Playwright_launches::without_a_pinned_browsers_directory_it_defers_to_Playwright
  Scenario: Without a pinned browsers directory Playwright chooses
    Given neither variable is set
    Then the choice is Playwright's expected browser, with no path

  @test:scripts/tests/playwright-chromium.test.ts::which_Chromium_Playwright_launches::uses_the_build_the_image_actually_ships,_and_says_which
  Scenario: The build the image ships is used, and named
    Given a browsers directory holding ffmpeg and chromium-1194
    Then the choice is a fallback to chromium-1194's chrome binary, with a note naming it

  @test:scripts/tests/playwright-chromium.test.ts::which_Chromium_Playwright_launches::prefers_the_newest_revision_when_an_image_carries_several
  Scenario: The newest revision is preferred
    Given a browsers directory holding chromium-1194 and chromium-1228
    Then chromium-1228's binary is chosen

  @test:scripts/tests/playwright-chromium.test.ts::which_Chromium_Playwright_launches::an_unreadable_browsers_directory_is_UNKNOWN,_never_a_guessed_path
  Scenario: An unreadable browsers directory is unknown
    Given the browsers directory cannot be listed
    Then the choice is unknown, with no path

  @test:scripts/tests/playwright-chromium.test.ts::which_Chromium_Playwright_launches::a_directory_holding_no_Chromium_is_UNKNOWN,_not_a_fabricated_launch_path
  Scenario: A directory holding no Chromium is unknown
    Given a browsers directory holding only ffmpeg
    Then the choice is unknown

  @test:scripts/tests/playwright-chromium.test.ts::which_Chromium_Playwright_launches::a_Chromium_directory_whose_binary_is_absent_does_not_get_launched
  Scenario: A Chromium directory whose binary is absent is not launched
    Given a chromium-1194 directory whose binary does not exist
    Then the choice is unknown, with no path
