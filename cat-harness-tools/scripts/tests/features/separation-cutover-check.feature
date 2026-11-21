# separation:cutover:check: a separated repository's cutover from the monorepo
# is complete only when every condition is measured and passes.
# Each Scenario names the test that executes it.
Feature: Separation cutover check

  @test:scripts/tests/separation-cutover-check.test.ts::monorepoPathFindings_—_wiring_that_still_names_the_monorepo::a_path_into_the_old_checkout,_in_code_and_config
  Scenario: A path into the old checkout is found in code and config
    Then a script string, a tsconfig path and a package.json script each naming folio-assistant/… give one finding

  @test:scripts/tests/separation-cutover-check.test.ts::monorepoPathFindings_—_wiring_that_still_names_the_monorepo::a_reusable_workflow_called_from_the_monorepo_(lessons_16-17)
  Scenario: A reusable workflow called from the monorepo is found
    Then a workflow "uses:" line naming litlfred/folio-assistant's workflow gives one finding

  @test:scripts/tests/separation-cutover-check.test.ts::monorepoPathFindings_—_wiring_that_still_names_the_monorepo::livesAt_still_naming_the_monorepo_(lesson_15)
  Scenario: livesAt naming the monorepo is found
    Then a declaration whose livesAt repository is litlfred/folio-assistant gives a finding naming "livesAt"

  @test:scripts/tests/separation-cutover-check.test.ts::monorepoPathFindings_—_wiring_that_still_names_the_monorepo::a_submodule_of_the_monorepo
  Scenario: A submodule of the monorepo is found
    Then a .gitmodules entry for folio-assistant gives one finding

  @test:scripts/tests/separation-cutover-check.test.ts::monorepoPathFindings_—_wiring_that_still_names_the_monorepo::NOT:_the_repository_named_in_prose,_a_sibling_layer,_a_comment,_a_record,_a_link
  Scenario: Mentions that are not wiring are not findings
    Then an issue URL, a folio-assistant-core import, a shell comment, a work item record and a README mention give no findings

  @test:scripts/tests/separation-cutover-check.test.ts::the_verdict::complete_only_when_every_condition_was_measured_and_passed
  Scenario: Complete when every condition passes
    When every condition is "pass"
    Then the exit code is 0

  @test:scripts/tests/separation-cutover-check.test.ts::the_verdict::a_site_not_built_is_NOT_complete:_exit_2,_never_0
  Scenario: A site not built is not complete
    When the last condition is "not-run" and the rest pass
    Then the exit code is 2

  @test:scripts/tests/separation-cutover-check.test.ts::the_verdict::a_site_not_applicable_to_an_instance_root_does_not_block_complete_(Q-NA-1_B,_#1701)
  Scenario: A not-applicable site does not block completion
    When the last condition is "not-applicable" and the rest pass
    Then the exit code is 0
    And with one failure besides it the exit code is 1
    And with one could-not-determine besides it the exit code is 2

  @test:scripts/tests/separation-cutover-check.test.ts::the_verdict::a_failure_wins_over_anything_undetermined
  Scenario: A failure wins over undetermined conditions
    When conditions include could-not-determine, fail and not-run
    Then the exit code is 1

  @test:scripts/tests/separation-cutover-check.test.ts::ownInstances_—_what_the_repository_tracks,_as_opposed_to_what_it_mounts::a_mounted_(untracked)_layer_is_not_the_repository's_own
  Scenario: A git-ignored mounted layer is not the repository's own
    Given a repository declaring "downstream" at its root, a tracked layer "tracked" and an ignored layer "layer"
    Then its own instances are downstream and tracked
