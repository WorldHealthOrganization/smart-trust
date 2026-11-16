# scripts/check-code-accounting.ts reports two separate questions about code files: how many sit in a
# declared directory, and how many are statically reachable from a tool's entry point.
# Each Scenario names the test that executes it.
Feature: Code accounting reports declared and reachable code apart

  @test:scripts/tests/code-accounting.test.ts::the_two_questions_are_reported_APART::a_file_can_be_DECLARED_and_unreachable
  Scenario: A file can be declared and unreachable
    Given a layer "alpha" declaring "src/" as code, holding "orphan.ts" that nothing invokes
    When the tree is audited
    Then 1 file is declared code
    And 0 files are reachable

  @test:scripts/tests/code-accounting.test.ts::the_two_questions_are_reported_APART::...and_REACHABLE_while_declared_by_nothing
  Scenario: A file can be reachable and declared by nothing
    Given a layer "alpha" with no declared directories
    And a tool whose shell invokes "bun run alpha/loose.ts"
    When the tree is audited
    Then more than 0 files are reachable
    And 0 files are declared code

  @test:scripts/tests/code-accounting.test.ts::the_two_questions_are_reported_APART::`declaredAny`_is_wider_than_`declaredCode`,_and_both_are_reported
  Scenario: Declared-any counts every declared directory, declared-code only code ones
    Given a layer declaring "schemas/" as schemas and "src/" as code, each holding one .ts file
    When the tree is audited
    Then 2 files are declared under any kind
    And 1 file is declared code
    And no file is outside every declared directory

  @test:scripts/tests/code-accounting.test.ts::the_two_questions_are_reported_APART::the_report_never_prints_a_combined_figure
  Scenario: The report presents the two questions separately
    # Gap: only the presence of the two headings and the note is checked, not the absence of a combined number
    Given an audit of a tree with one empty layer
    When the report is formatted
    Then it contains "1. DECLARED" and "2. REACHABLE"
    And it contains "NOT averaged"

  @test:scripts/tests/code-accounting.test.ts::toolEntryPoints_follows_package.json,_not_just_literal_paths::a_`bun_run_<script>`_chain_resolves_to_the_.ts_it_ends_at
  Scenario: A chain of package.json scripts resolves to the .ts it ends at
    Given a tool invoking "bun run gen"
    And package.json scripts where "gen" runs "inner" and "inner" runs "alpha/gen.ts"
    When the tool entry points are collected
    Then they are exactly "alpha/gen.ts"

  @test:scripts/tests/code-accounting.test.ts::toolEntryPoints_follows_package.json,_not_just_literal_paths::a_chain_that_loops_terminates_rather_than_hanging
  Scenario: A looping chain of scripts terminates with no entry point
    Given a tool invoking "bun run a"
    And package.json scripts where "a" runs "b" and "b" runs "a"
    When the tool entry points are collected
    Then there are none

  @test:scripts/tests/code-accounting.test.ts::reachableFrom_is_a_FLOOR,_and_says_so_by_behaving_like_one::follows_a_relative_import,_including_through_an_index
  Scenario: A relative import is followed through an index
    Given "e.ts" importing "./lib/index.js" and a "lib/index.ts"
    When the files reachable from "e.ts" are collected
    Then they are "e.ts" and "lib/index.ts"

  @test:scripts/tests/code-accounting.test.ts::reachableFrom_is_a_FLOOR,_and_says_so_by_behaving_like_one::does_not_follow_a_dynamic_import,_and_so_under-claims
  Scenario: A dynamic import is not followed
    Given "e.ts" dynamically importing "./late.js" and a "late.ts"
    When the files reachable from "e.ts" are collected
    Then only one file is reachable

  @test:scripts/tests/code-accounting.test.ts::reachableFrom_is_a_FLOOR,_and_says_so_by_behaving_like_one::an_entry_point_that_does_not_exist_is_skipped,_not_thrown_on
  Scenario: A missing entry point is skipped
    Given "e.ts" exists and "gone.ts" does not
    When the files reachable from both are collected
    Then only one file is reachable and nothing is thrown
