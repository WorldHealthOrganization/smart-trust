# scripts/split-baseline.ts records the MCP tools and skills the harness split
# must not change, and diffs a fresh measurement against that baseline.
# Each Scenario names the test that executes it.
Feature: Split baseline of tools and skills

  @test:scripts/tests/sdlc/split-baseline.test.ts::split-baseline_diff::identical_measurements_agree
  Scenario: Identical measurements report no differences
    Given a baseline with tools "a" and "b" and skills "s1" and "s2"
    When the baseline is diffed against itself
    Then no difference is reported

  @test:scripts/tests/sdlc/split-baseline.test.ts::split-baseline_diff::a_tool_gone,_added,_or_with_a_changed_contract_is_each_reported
  Scenario: A tool gone, added, or with a changed contract is each reported
    Given a baseline with tool "a" requiring "x" and tool "b"
    And a measurement where "a" also takes optional "y", "b" is gone and "c" is new
    When the two are diffed
    Then exactly three lines are reported
    And they are "tool added: c", "tool gone: b" and "tool contract changed: a req=[x] opt=[] → a req=[x] opt=[y]"

  @test:scripts/tests/sdlc/split-baseline.test.ts::split-baseline_diff::a_skill_that_stops_or_starts_resolving_is_reported
  Scenario: A skill that stops or starts resolving is reported
    Given a baseline with skills "s1" and "s2"
    And a measurement with skills "s2" and "s3"
    When the two are diffed
    Then "skill no longer resolves: s1" and "skill newly resolves: s3" are reported, and nothing else

  @test:scripts/tests/sdlc/split-baseline.test.ts::split-baseline_measure::reads_the_real_checkout:_tools_AND_skills,_never_a_vacuous_zero
  Scenario: Measuring the real checkout finds tools and skills, never a vacuous zero
    Given the real checkout
    When it is measured
    Then no problems are reported
    And more than 10 MCP tools are found
    And more than 100 known skills are found
