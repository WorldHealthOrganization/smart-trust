# scripts/check-inline-scripts.ts walks a built site and refuses any inline classic script that no
# longer parses, or that carries the signature of a theme pass rewriting markup inside a string.
# Each Scenario names the test that executes it.
Feature: Inline scripts in the built site still parse

  @test:scripts/tests/check-inline-scripts.test.ts::check-inline-scripts_—_what_ships_must_still_parse_(owner,_2026-10-15)::the_published_bootstrap_schema_page_is_refused
  Scenario: The published bootstrap schema page is refused
    Given the bootstrap schema page as published, with an anchor-heading rewritten into a script string
    When the page's problems are read
    Then there is exactly one problem, at line 2
    And its reason mentions "anchor-heading"

  @test:scripts/tests/check-inline-scripts.test.ts::check-inline-scripts_—_what_ships_must_still_parse_(owner,_2026-10-15)::the_generator's_own_script,_untouched,_passes:_raw_<h2>_and_<table>_in_a_string_are_not_the_defect
  Scenario: The generator's untouched script passes despite raw h2 and table in strings
    Given the script as the generator wrote it, building "<h2>" and "<table>" strings
    When the page's problems are read
    Then there are none

  @test:scripts/tests/check-inline-scripts.test.ts::check-inline-scripts_—_what_ships_must_still_parse_(owner,_2026-10-15)::the_table-wrapper_pass_is_refused_even_where_no_anchor_pass_ran
  Scenario: The table-wrapper rewrite is refused even without an anchor rewrite
    Given a script string wrapped in a "table-wrapper" div
    When the script is judged
    Then the problem mentions "table-wrapper"

  @test:scripts/tests/check-inline-scripts.test.ts::check-inline-scripts_—_what_ships_must_still_parse_(owner,_2026-10-15)::a_rewrite_that_keeps_the_script_parsing_is_still_refused_by_its_signature
  Scenario: A rewrite that still parses is refused by its signature
    Given a script that parses but holds an anchor-heading and a table-wrapper string
    When the script is judged
    Then the problem mentions "table-wrapper"

  @test:scripts/tests/check-inline-scripts.test.ts::check-inline-scripts_—_what_ships_must_still_parse_(owner,_2026-10-15)::any_other_build_step_that_breaks_a_script_is_refused_by_the_parse
  Scenario: Any other break in a script is refused by the parse
    Given a script with a single-quoted string split across lines
    When the script is judged
    Then the problem says it "does not parse"

  @test:scripts/tests/check-inline-scripts.test.ts::check-inline-scripts_—_what_ships_must_still_parse_(owner,_2026-10-15)::only_inline_classic_scripts_are_judged:_src,_JSON,_modules_and_templates_are_not
  Scenario: Only inline classic scripts are judged
    Given a page with a src script, ld+json, JSON, module, template, text/javascript and plain scripts
    When its inline scripts are read
    Then only the bodies "var a = 1;" and "var b = 2;" are returned

  @test:scripts/tests/check-inline-scripts.test.ts::check-inline-scripts_—_what_ships_must_still_parse_(owner,_2026-10-15)::a_built_site:_every_page_walked,_each_problem_named_by_page_and_line
  Scenario: Every page of a built site is walked and each problem named by page and line
    Given a site with a clean index.html, the published page at "en/schemas/index.html" and a data.json
    When the site is checked
    Then 2 pages and 2 scripts are examined
    And the only problem is "en/schemas/index.html:2"
