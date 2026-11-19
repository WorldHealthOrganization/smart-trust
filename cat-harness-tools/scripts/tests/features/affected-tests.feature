# What scripts/affected-tests.ts does: from a list of changed files, select the test files whose relative-import closure reaches them,
# or all of them when the change touches what every test runs under.
# Each Scenario names the test that executes it.
Feature: Selecting the tests a change affects

  @test:scripts/tests/affected-tests.test.ts::affectedTests::finds_every_test_file_bun_would_run,_not_node_modules
  Scenario: Test files and preloads are found the way bun finds them, skipping node_modules
    Given a scratch tree with tests "test/b.test.ts", "test/c.test.ts", "test/pkg.spec.ts", a test file under "node_modules", and a bunfig preloading "./test/setup.ts"
    When the test files under it are listed
    Then they are exactly "test/b.test.ts", "test/c.test.ts" and "test/pkg.spec.ts"
    And the preloads are exactly "test/setup.ts"

  @test:scripts/tests/affected-tests.test.ts::affectedTests::a_change_reaches_the_tests_whose_closure_holds_it,_transitively
  Scenario: A change reaches a test that imports it transitively
    Given "test/b.test.ts" imports "src/b.ts", which imports "src/a.ts"
    When "src/a.ts" changes
    Then the selection is "some" with only "test/b.test.ts"
    And the reason given for it is "imports src/a.ts"

  @test:scripts/tests/affected-tests.test.ts::affectedTests::an_imported_JSON_file_is_in_the_closure;_a_bare_package_import_is_not
  Scenario: An imported JSON file is in a test's closure, and an unimported file selects nothing
    # Gap: the bare package import half of the title is not asserted directly; the second case changes "README.md", which nothing imports.
    Given "test/c.test.ts" imports "src/data.json"
    When "src/data.json" changes
    Then only "test/c.test.ts" is selected
    And when "README.md" changes, no test is selected

  @test:scripts/tests/affected-tests.test.ts::affectedTests::a_changed_test_file_selects_itself
  Scenario: A changed test file selects itself
    When "test/pkg.spec.ts" changes
    Then only "test/pkg.spec.ts" is selected

  @test:scripts/tests/affected-tests.test.ts::affectedTests::a_change_to_what_every_test_runs_under_selects_them_all
  Scenario: A change to the lockfile, package.json or a preload selects every test
    When "bun.lock" changes
    Then the selection is "all"
    And a change to "package.json" selects "all"
    And a change to the preload "test/setup.ts" selects "all"

  @test:scripts/tests/affected-tests.test.ts::affectedTests::a_computed_or_unresolvable_import_is_walked_past:_literal_edges_still_count,_the_hidden_one_does_not_select
  Scenario: A computed or unresolvable import is walked past while the literal imports still count
    Given "src/hub.ts" imports "./c.ts" literally, imports a computed specifier, and imports a missing "./missing.ts"
    And "test/hub.test.ts" imports "src/hub.ts"
    When "src/c.ts" changes
    Then "test/c.test.ts" and "test/hub.test.ts" are selected
    And when "src/a.ts" changes, only "test/b.test.ts" is selected
