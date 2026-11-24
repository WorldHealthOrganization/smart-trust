# scripts/tool-coverage.ts triages uncovered skills into tiers A to D; a script
# declared in package.json is evidence of a command, so it keeps a skill out of tier D.
# Each Scenario names the test that executes it.
Feature: A declared package.json script keeps a skill out of tier D

  @test:scripts/tests/tools/tool-coverage-triage.test.ts::the_triage_is_asking_a_real_corpus::returns_rows,_and_reads_a_package.json_that_has_scripts
  Scenario: The triage runs over a real corpus with declared scripts
    Given the triage of the real corpus and its declared package.json scripts
    Then the triage has at least one row
    And there is at least one declared script

  @test:scripts/tests/tools/tool-coverage-triage.test.ts::a_declared_script_is_evidence,_so_it_cannot_leave_a_skill_in_D::NO_skill_in_tier_D_has_a_package.json_script
  Scenario: No skill in tier D has a declared script
    Given the triage of the real corpus
    When the tier D rows are matched against the declared scripts
    Then none has a script

  @test:scripts/tests/tools/tool-coverage-triage.test.ts::a_declared_script_is_evidence,_so_it_cannot_leave_a_skill_in_D::the_skills_moved_by_this_rule_carry_the_command_NAME_in_their_evidence
  Scenario: A skill with script evidence names its command and leaves tier D
    Given the triage rows whose evidence includes a "script:" entry
    Then there is at least one such row
    And none is in tier D
    And each without serviceTask, io-contract or userTask evidence is in tier C
    And each carries "script:" followed by the name of its matched script

  @test:scripts/tests/tools/tool-coverage-triage.test.ts::a_declared_script_is_evidence,_so_it_cannot_leave_a_skill_in_D::`ci-health`_is_the_worked_case_—_in_C_if_it_is_still_uncovered_at_all
  Scenario: ci-health is in tier C with its script as evidence, if still uncovered
    # Gap: asserts nothing when ci-health is no longer in the triage
    Given the triage of the real corpus
    When the "ci-health" row is looked up
    Then if present it is in tier C
    And its evidence contains "script:check:ci-health"

  @test:scripts/tests/tools/tool-coverage-triage.test.ts::`scriptFor`_is_strict,_because_loose_matching_was_tried_and_rejected::matches_a_whole_colon_segment_of_the_key
  Scenario: A skill matches a script whose key has it as a whole colon segment
    Given scripts "check:ci-health", "readme:sections", "check:diff-policy" and "build" running "scripts/render.ts"
    Then "ci-health" matches "check:ci-health"
    And "sections" matches "readme:sections"

  @test:scripts/tests/tools/tool-coverage-triage.test.ts::`scriptFor`_is_strict,_because_loose_matching_was_tried_and_rejected::matches_a_command_that_runs_`<skill>.ts`
  Scenario: A skill matches a script whose command runs its .ts file
    Given the same fixture scripts
    Then "render" matches "build", whose command runs "scripts/render.ts"

  @test:scripts/tests/tools/tool-coverage-triage.test.ts::`scriptFor`_is_strict,_because_loose_matching_was_tried_and_rejected::does_NOT_match_a_substring_of_a_segment_—_the_rejected_rule
  Scenario: A substring of a key segment does not match
    Given the same fixture scripts
    Then "diff", "policy" and "health" match no script

  @test:scripts/tests/tools/tool-coverage-triage.test.ts::`scriptFor`_is_strict,_because_loose_matching_was_tried_and_rejected::returns_undefined_for_a_skill_with_nothing
  Scenario: A skill with no script matches nothing
    Given the same fixture scripts
    Then "pure-judgement" matches no script
