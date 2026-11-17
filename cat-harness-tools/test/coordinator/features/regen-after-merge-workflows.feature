# Specifies scripts/regen-after-merge.ts (repairableGates, writerFor,
# scriptOf, WRITER_OVERRIDES, NO_WRITER, UNGATED_INPUTS) against the gates
# the checkout's workflows run and its script table.
Feature: regen pairs each gate with a declared writer that writes, and records the rest

  @test:test/coordinator/regen-after-merge-workflows.test.ts::a_writer_that_is_not_<check_minus_:check>_is_DECLARED_(bean_eowd)::the_audit-coverage_gates_run_in_CI_and_are_NOT_offered_for_repair_—_bean_loxz
  Scenario: The audit-coverage gates run in CI and are not offered for repair
    Given the checkout's fast gates and the pairs regen derives from them
    When audit:coverage:strict and audit:coverage:require-all are looked up
    Then each is a CI gate
    And neither is a repair pair
    And each is recorded as having no writer, with a reason mentioning "judge-mode"

  @test:test/coordinator/regen-after-merge-workflows.test.ts::a_writer_that_is_not_<check_minus_:check>_is_DECLARED_(bean_eowd)::every_override_names_a_writer_that_exists_—_a_renamed_writer_is_a_finding,_not_a_guess
  Scenario: Every writer override names a script that exists
    Given the writer overrides
    When each writer is looked up in the checkout's scripts
    Then every one exists

  @test:test/coordinator/regen-after-merge-workflows.test.ts::a_`check:X`_gate_is_paired_only_by_DECLARATION_—_bean_`uju6`::every_`check:X`_that_is_some_script's_command_plus_`_--check`_is_decided_—_paired_or_recorded
  Scenario: Every check:X gate whose command is another script's plus --check is decided
    Given every --all gate whose script is "check:X", not ending ":check", whose command is another script's command followed by " --check"
    When it is looked up in the writer overrides and the no-writer record
    Then it is in one of them

  @test:test/coordinator/regen-after-merge-workflows.test.ts::a_`check:X`_gate_is_paired_only_by_DECLARATION_—_bean_`uju6`::the_recorded_non-writers_are_real_scripts,_and_none_is_also_paired
  Scenario: The recorded non-writers are real scripts and none is also paired
    Given every check recorded as having no writer
    When it is looked up
    Then it is a script in the checkout
    And it has no writer override
    And no writer is found for it by name

  @test:test/coordinator/regen-after-merge-workflows.test.ts::UNGATED_INPUTS_—_writers_regen_runs_without_making_them_gates_(bean_5qq3)::none_of_them_is_a_gate_—_the_owner's_2026-09-20_ruling_keeps_them_ungated
  Scenario: No ungated input is a gate
    Given the pairs regen derives from the --all gates
    When each ungated input's check is looked up among them
    Then none is a gated pair

  @test:test/coordinator/regen-after-merge-workflows.test.ts::a_writer_must_WRITE_—_bean_`i1q7`::no_pair_regen_uses_runs_its_CHECK_as_its_writer,_or_a_writer_that_is_itself_a_check
  Scenario: No pair's writer is its own check or a check script
    Given the ungated inputs and the pairs derived from the --all gates
    When each pair with a writer is read
    Then its writer is not its check
    And its writer's script does not pass --check

  @test:test/coordinator/regen-after-merge-workflows.test.ts::the_default_asks_the_WHOLE_gate_set_—_bean_`i1q7`,_item_3::render:bpmn:check_and_bat:sync:check_are_pairs_regen_asks_by_default
  Scenario: render:bpmn:check and bat:sync:check are paired with their writers in the set regen asks by default
    Given regen's own source
    Then it sets "fast" only from "--fast", sets "all" to "!fast", and loads its gates with "{ all }"
    Given the pairs derived from the --all gates
    When render:bpmn:check and bat:sync:check are looked up
    Then render:bpmn:check's writer is "render:bpmn"
    And bat:sync:check's writer is "bat:sync"
