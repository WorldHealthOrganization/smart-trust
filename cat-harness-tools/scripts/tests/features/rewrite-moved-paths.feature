# rewrite-moved-paths rewrites a mention only where the file moved, and never
# inside a record. Each Scenario names the test that executes it.
Feature: Rewriting moved paths

  Background:
    Given a source layer "oldlayer" and a destination "newlayer"
    And scripts/moved.ts exists only in the destination
    And scripts/stays.ts exists in both
    And a skill, a proposal, a memory note and a test fixture each name moved.ts, stays.ts and nowhere.ts under oldlayer/scripts

  @test:scripts/tests/rewrite-moved-paths.test.ts::rewrite-moved-paths::reports_without_writing_by_default
  Scenario: The default run reports without writing
    When the rewrite runs without the write flag
    Then the only rewrite reported is the skill's mention, to "newlayer/scripts/moved.ts"
    And the skill file is unchanged

  @test:scripts/tests/rewrite-moved-paths.test.ts::rewrite-moved-paths::rewrites_only_a_path_whose_file_is_in_the_destination_and_not_in_the_source
  Scenario: Only a path whose file moved is rewritten
    When the rewrite runs with the write flag
    Then the skill names newlayer/scripts/moved.ts
    And its mentions of stays.ts and nowhere.ts are left alone and reported so

  @test:scripts/tests/rewrite-moved-paths.test.ts::rewrite-moved-paths::never_reads,_let_alone_rewrites,_a_record:_proposals,_memory,_fixtures
  Scenario: Records are never rewritten
    When the rewrite runs with the write flag
    Then the proposal, memory note and fixture are reported as records
    And their text is unchanged

  @test:scripts/tests/rewrite-moved-paths.test.ts::rewrite-moved-paths::a_second_run_owes_nothing,_which_is_what_--check_gates_on
  Scenario: A second run owes nothing
    Given the rewrite has run with the write flag
    When it runs again without writing
    Then no rewrite is reported

  @test:scripts/tests/rewrite-moved-paths.test.ts::rewrite-moved-paths::the_record_shapes_the_70lx_sweep_kept
  Scenario: The default record globs match the record shapes
    Then work item definitions, kg-qa results, upstream pins, library vector figures and test files are records
    And skills, guides, AGENTS.md and schema sources are not
