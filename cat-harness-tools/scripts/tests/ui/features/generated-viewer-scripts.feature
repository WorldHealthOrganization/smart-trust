# Guards over the generated viewer pages under the site tree: their inline and shared scripts must parse
# as JavaScript, and the graph builders must not sum raw JSON fields without a typeof guard.
# Each Scenario names the test that executes it.
Feature: Generated viewers ship parseable scripts and numeric-only unescaped fields

  @test:scripts/tests/ui/generated-viewer-scripts.test.ts::generated_viewers_ship_JavaScript_that_is_JavaScript::the_viewer_trees_are_not_empty_—_examined_nothing_is_not_a_pass
  Scenario: The generated viewer trees are not empty
    Given the generated viewer trees under the page locale and the legacy cat-harness site directory
    When every non-empty index.html in them is collected
    Then at least one viewer page is found

  @test:scripts/tests/ui/generated-viewer-scripts.test.ts::generated_viewers_ship_JavaScript_that_is_JavaScript::every_inline_script_in_every_generated_viewer_parses
  Scenario: Every inline script in every generated viewer parses
    Given every generated viewer page
    When each inline script body, excluding src scripts and JSON data blocks, is compiled with new Function
    Then no script reports a parse error

  @test:scripts/tests/ui/generated-viewer-scripts.test.ts::generated_viewers_ship_JavaScript_that_is_JavaScript::every_SHARED_script_a_generated_viewer_loads_exists_and_parses
  Scenario: Every shared script a generated viewer loads exists and parses
    Given every generated viewer page
    When each relative script src it loads is resolved beside the page
    Then every referenced script file exists
    And every referenced script compiles with new Function without a parse error

  @test:scripts/tests/ui/generated-viewer-scripts.test.ts::generated_viewers_ship_JavaScript_that_is_JavaScript::...and_the_guard_has_teeth_—_a_raw_newline_in_a_string_is_caught
  Scenario: The parse guard catches a raw newline inside a string literal
    Given a script whose join argument holds a literal line break inside quotes
    When it is checked by the parse guard
    Then the guard reports an "Invalid or unexpected token" style error
    And the same script with an escaped "\n" parses cleanly

  @test:scripts/tests/ui/generated-viewer-scripts.test.ts::a_field_rendered_without_`esc()`_must_be_provably_numeric::no_graph_builder_sums_a_raw_JSON_field_without_a_typeof_guard
  Scenario: No graph builder sums a raw JSON field without a typeof guard
    # Gap: a source-text line check; it does not exercise rendering or esc() at runtime
    Given the source of library-graph.ts and uploads-graph.ts under scripts
    When each line is checked for a reduce that adds a property read with no typeof on the line
    Then no offending line is found

  @test:scripts/tests/ui/generated-viewer-scripts.test.ts::a_field_rendered_without_`esc()`_must_be_provably_numeric::...and_the_guard_has_teeth_—_the_original_line_is_caught
  Scenario: The numeric guard catches the line that originally shipped
    Given the original line "words: secs.reduce((n, s) => n + (s.n_words ?? 0), 0)"
    When it is checked against the same predicate
    Then it is caught

  @test:scripts/tests/ui/generated-viewer-scripts.test.ts::a_field_rendered_without_`esc()`_must_be_provably_numeric::the_guarded_form_passes
  Scenario: The guarded form passes the numeric check
    Given the fixed line "words: sumSections((s) => s.n_words)"
    When it is checked against the same predicate
    Then it is not caught
