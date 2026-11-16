# The rail stylesheet from scripts/lib/navbar.ts (navbarCss) and the site's docs-ui.css
# may not declare the same selector differently.
# Each Scenario names the test that executes it.
Feature: The two navbar stylesheets cannot disagree

  @test:scripts/tests/ui/navbar-css-single-source.test.ts::the_two_navbar_stylesheets_cannot_disagree::every_selector_both_files_declare,_they_declare_identically
  Scenario: A selector both stylesheets declare has the same declaration in each
    Given the rail stylesheet and the site's docs-ui.css parsed into selector-to-declaration maps, comments stripped
    When the selectors both declare are compared
    Then none has a different normalised declaration

  @test:scripts/tests/ui/navbar-css-single-source.test.ts::the_two_navbar_stylesheets_cannot_disagree::the_parser_saw_real_rules_on_both_sides
  Scenario: The parser found real rules in both stylesheets
    Given both stylesheets parsed into selector maps
    Then the rail map has more than 20 selectors
    And the site map has more than 200 selectors

  @test:scripts/tests/ui/navbar-css-single-source.test.ts::the_two_navbar_stylesheets_cannot_disagree::the_shared_set_is_SMALL,_and_its_size_is_the_trade_this_design_rests_on
  Scenario: The stylesheets share only one selector
    Given both stylesheets parsed into selector maps
    When the selectors both declare are listed
    Then the list is exactly ".fa-nav-open"
