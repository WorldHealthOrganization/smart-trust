# scripts/render-theme-sheet.ts builds the themes/ page a reader browses, one row per registered
# theme, and the themes viewer drawn at publish. Each Scenario names the test that executes it.
Feature: The themes page is usable

  @test:scripts/tests/ui/theme-page.test.ts::the_themes_page::has_exactly_one_row_per_registered_theme
  Scenario: The themes page has exactly one row per registered theme
    Given the themes page built from the harness
    When its theme row ids are read
    Then there is at least one
    And they are the theme registry's ids, in order

  @test:scripts/tests/ui/theme-page.test.ts::the_themes_page::links_every_image_to_a_file_the_site_publishes
  Scenario: Every image the themes page links is a file the site publishes
    Given the themes page built from the harness
    When its relative_url links under assets/ are collected
    Then there are at least 3
    And each exists under the site directory

  @test:scripts/tests/ui/theme-page.test.ts::the_themes_page::shows_each_themed_sample_sticky_with_that_theme's_SQUARE_crop_behind_it
  Scenario: Each themed sample sticky shows that theme's square crop behind it
    Given every registered theme that has a backdrop, at least one
    When the demo art of that theme's row is read
    Then it is the theme's "-card.webp" image

  @test:scripts/tests/ui/theme-page.test.ts::the_themes_page::reports_an_unreadable_image_as_unreadable,_never_as_a_link
  Scenario: An unreadable image is reported as unreadable, never linked
    Given an image reader that reads nothing
    When the theme sheet body is built
    Then it says "could not read"
    And it contains no img tag

  @test:scripts/tests/ui/theme-page.test.ts::the_themes_page::emits_an_HTML_block_kramdown_will_not_break
  Scenario: The page's HTML block has nothing that would end it under kramdown
    Given the themes page's raw HTML block, from the fa-theme-sheet div to its last closing div
    Then no line in it is blank
    And no line starts with a four-space indent

  @test:scripts/tests/ui/theme-page.test.ts::the_themes_page::lists_as_wearers_exactly_the_landing-board_cards_that_chose_each_theme
  Scenario: The wearers of each theme are exactly the landing-board cards that chose it
    Given the harness's declared landing-board contributions, at least one
    When the wearers of each theme are read
    Then each card is listed under the theme it chose
    And the wearers in total number the cards

  @test:scripts/tests/ui/theme-page.test.ts::the_themes_viewer_(bean_folio-assistant-6gme)::is_drawn_only_where_a_`themes`_visualiser_is_declared
  Scenario: The themes viewer is drawn at the themes route
    # Skipped: when no themes visualiser is declared (reported as skipped, not passed)
    Given the themes viewer built from the harness
    Then its path ends in themes/index.md

  @test:scripts/tests/ui/theme-page.test.ts::the_themes_viewer_(bean_folio-assistant-6gme)::names_the_Tool_that_renders_it,_and_opens_with_the_platform's_themes
  Scenario: The themes viewer names the Tool that renders it and opens with the platform's themes
    # Skipped: when no themes visualiser is declared (reported as skipped, not passed)
    Given the themes viewer built from the harness
    Then its page carries rendered-by naming the viewer Tool
    And it has a "## The platform" section
    And it shows at least as many themes as the registry holds

  @test:scripts/tests/ui/theme-page.test.ts::the_themes_viewer_(bean_folio-assistant-6gme)::gives_every_instance_it_read_a_section,_and_names_any_it_could_not
  Scenario: The themes viewer gives every instance it read a section and names any it could not
    # Skipped: when no themes visualiser is declared (reported as skipped, not passed)
    Given the themes viewer built from the harness
    Then it has at least one more level-2 section than the instances it read
    And it names every instance it could not read
