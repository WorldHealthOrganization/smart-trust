# scripts/lib/themed-page.ts puts a generated viewer onto the site's default layout, with
# helpers for subject navigation, scoped CSS and YAML quoting. Each Scenario names the test that executes it.
Feature: Themed pages on the site's default layout

  @test:scripts/tests/ui/themed-page.test.ts::themedPage::front_matter:_the_default_layout,_a_quoted_title,_out_of_the_theme's_nav
  Scenario: A themed page's front matter uses the default layout, a quoted title, and stays out of the theme's nav
    Given a body and a title containing double quotes and a backslash
    When the themed page is made
    Then it starts with front matter naming layout default
    And the title is YAML-quoted with the quote and backslash escaped
    And the front matter ends with nav_exclude true
    And the page is not a standalone document
    And it has no doctype, html, head or body tag

  @test:scripts/tests/ui/themed-page.test.ts::themedPage::the_body_sits_inside_one_Liquid_raw_block,_and_a_closing_tag_in_it_cannot_end_it_early
  Scenario: The body sits inside one Liquid raw block that an embedded endraw cannot close early
    Given a body containing a Liquid expression and an endraw tag
    When the themed page is made
    Then it has exactly 2 raw openers, its own and the one the escape reopens with
    And it ends with an endraw tag
    And the embedded endraw is escaped as an endraw, a quoted "{" and a reopened raw block

  @test:scripts/tests/ui/themed-page.test.ts::themedPage::rendered-by_goes_into_the_same_front_matter,_and_no_`renders`_list_does
  Scenario: rendered-by is added to the same front matter, with no renders list
    Given a themed page
    When rendered-by "x-viewer" is added to its front matter
    Then the front matter ends with "rendered-by: x-viewer"
    And no line starts with "renders:"

  @test:scripts/tests/ui/themed-page.test.ts::themedPage::themedBody_recovers_the_body_a_layout_stand-in_serves
  Scenario: themedBody recovers the body a themed page wraps
    Given a themed page over a div with a paragraph and a trailing newline
    When its body is recovered
    Then it is the div and paragraph without the trailing newline

  @test:scripts/tests/ui/themed-page.test.ts::themedPage::subjectNav:_relative_links_to_every_subject_page,_the_current_one_plain_text
  Scenario: subjectNav links every subject page relatively, the current one as plain text
    Given subjects "a" and "b"
    When the nav is made with no current subject
    Then "All instances" is the current page and "a" links to "a/"
    When the nav is made on subject "a"
    Then "All instances" links to "../", "a" is the current page and "b" links to "../b/"
    And with no subjects the nav is empty
    And the nav's CSS has no selector outside its class

  @test:scripts/tests/ui/themed-page.test.ts::themedPage::unscopedSelectors_names_a_rule_that_would_restyle_the_theme
  Scenario: unscopedSelectors names the rules that would restyle the theme
    Given a style block with rules scoped to ".x", one under a :root scheme selector, one inside a media query, a body rule and an "a, .x b" rule
    When unscoped selectors are listed for ".x"
    Then they are "body" and "a"

  @test:scripts/tests/ui/themed-page.test.ts::themedPage::yamlQuoted_escapes_the_two_characters_YAML_treats_specially
  Scenario: yamlQuoted escapes the double quote and the backslash
    Given the text a"b\c
    When it is YAML-quoted
    Then the result is wrapped in double quotes with the quote and the backslash each escaped
