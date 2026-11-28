# Specifies that each writer regen pairs for translate-bpmn:bootstrap:check,
# translate-bpmn:check, bat:sync:check and render:bpmn:check repairs a staled
# artefact: one test per check. Each is skipped where the checkout has no root
# `cat` alias, and render:bpmn:check also where no browser is installed.
Feature: Each writer regen runs turns a staled artefact's check green

  @test:test/coordinator/regen-writers.test.ts::every_writer_regen_pairs_for_these_gates_turns_a_STALED_artefact's_check_green_(bean_i1q7)::translate-bpmn:bootstrap:check:_red_on_a_staled_artefact,_green_after_regen_runs_its_writer
  Scenario: translate-bpmn:bootstrap:check goes red on a staled artefact and green after regen runs its writer
    Given the writer regen pairs with "translate-bpmn:bootstrap:check", which exists
    And the first .pot under cat-harness/translations/es/bootstrap/processes, with an extra msgid appended
    When "translate-bpmn:bootstrap:check" runs
    Then it fails
    When regen runs one pass over that pair
    Then the pair's outcome is "regenerated", or "current" when the check runs its writer itself
    And the staled bytes are gone
    And the artefact is restored afterwards

  @test:test/coordinator/regen-writers.test.ts::every_writer_regen_pairs_for_these_gates_turns_a_STALED_artefact's_check_green_(bean_i1q7)::translate-bpmn:check:_red_on_a_staled_artefact,_green_after_regen_runs_its_writer
  Scenario: translate-bpmn:check goes red on a staled artefact and green after regen runs its writer
    Given the writer regen pairs with "translate-bpmn:check", which exists
    And the first .pot under cat-harness/translations/es/processes, with an extra msgid appended
    When "translate-bpmn:check" runs
    Then it fails
    When regen runs one pass over that pair
    Then the pair's outcome is "regenerated", or "current" when the check runs its writer itself
    And the staled bytes are gone
    And the artefact is restored afterwards

  @test:test/coordinator/regen-writers.test.ts::every_writer_regen_pairs_for_these_gates_turns_a_STALED_artefact's_check_green_(bean_i1q7)::bat:sync:check:_red_on_a_staled_artefact,_green_after_regen_runs_its_writer
  Scenario: bat:sync:check goes red on a staled artefact and green after regen runs its writer
    Given the writer regen pairs with "bat:sync:check", which exists
    And the first .bat under cat-harness-tools/scripts, with a REM line appended
    When "bat:sync:check" runs
    Then it fails
    When regen runs one pass over that pair
    Then the pair's outcome is "regenerated", or "current" when the check runs its writer itself
    And the staled bytes are gone
    And the artefact is restored afterwards

  @test:test/coordinator/regen-writers.test.ts::every_writer_regen_pairs_for_these_gates_turns_a_STALED_artefact's_check_green_(bean_i1q7)::render:bpmn:check:_red_on_a_staled_artefact,_green_after_regen_runs_its_writer
  Scenario: render:bpmn:check goes red on a staled artefact and green after regen runs its writer
    Given the writer regen pairs with "render:bpmn:check", which exists
    And the first drawing beside a bootstrap process source, with a comment inserted before </svg>
    When "render:bpmn:check" runs
    Then it fails
    When regen runs one pass over that pair
    Then the pair's outcome is "regenerated", or "current" when the check runs its writer itself
    And the staled bytes are gone
    And the artefact is restored afterwards
