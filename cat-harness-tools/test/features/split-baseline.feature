# scripts/split-baseline.ts diffs a recorded baseline of MCP tools and known skills against now, splitting
# findings into failures and notes, and judges only the root the baseline was recorded at.
# Each Scenario names the test that executes it.
Feature: Split baseline findings

  @test:test/split-baseline.test.ts::split-baseline_--check_findings::a_skill_a_downstream_repo_adds_is_a_note,_not_a_failure_(smart-base#249)
  Scenario: A newly resolving skill is a note, not a failure
    Given a baseline with tool "a" and skills "x" and "y"
    When the current state also resolves skill "dth-authoring"
    Then the split findings have no failures
    And one note "skill newly resolves: dth-authoring"

  @test:test/split-baseline.test.ts::split-baseline_--check_findings::a_skill_that_stops_resolving_still_fails
  Scenario: A skill that no longer resolves is a failure
    Given a baseline with skills "x" and "y"
    When the current state resolves only "x"
    Then the failures are exactly "skill no longer resolves: y"

  @test:test/split-baseline.test.ts::split-baseline_--check_findings::a_tool_change_still_fails
  Scenario: A removed tool is a failure
    Given a baseline with tool "a"
    When the current state has no tools
    Then the failures are exactly "tool gone: a"

  @test:test/split-baseline.test.ts::split-baseline_judges_only_the_root_it_was_recorded_at::the_root_it_names_is_judged
  Scenario: A baseline judges the root it names
    Given a baseline recorded at root "folio-assistant"
    Then it judges "folio-assistant"

  @test:test/split-baseline.test.ts::split-baseline_judges_only_the_root_it_was_recorded_at::any_other_root_is_not
  Scenario: A baseline does not judge another root
    Given a baseline recorded at root "folio-assistant"
    Then it does not judge "smart-ra"

  @test:test/split-baseline.test.ts::split-baseline_judges_only_the_root_it_was_recorded_at::a_baseline_naming_no_root_judges_every_root
  Scenario: A baseline with no root judges any root
    Given a baseline naming no root
    Then it judges "smart-ra"
