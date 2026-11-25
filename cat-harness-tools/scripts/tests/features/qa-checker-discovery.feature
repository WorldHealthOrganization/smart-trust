# QA checker discovery: names, the block/script subject partition, each
# checker resolved from the module the registry declares, the two
# disagreements reported, and a half-evaluated module kept distinct from an
# empty one (bean 95s1). Each Scenario names the test that executes it.
Feature: QA checkers are discovered from the modules the registry names

  @test:scripts/tests/qa-checker-discovery.test.ts::checkerFunctionName::kebab-case_ids
  Scenario: A kebab-case id names its checker function
    Then the checker function of "dak-bpmn-has-process" is "checkDakBpmnHasProcess"

  @test:scripts/tests/qa-checker-discovery.test.ts::checkerFunctionName::snake_case_ids_—_the_script_axis_uses_them
  Scenario: A snake_case id names its checker function
    Then the checker function of "does_not_default_to_float" is "checkDoesNotDefaultToFloat"

  @test:scripts/tests/qa-checker-discovery.test.ts::checkerFunctionName::a_single_word
  Scenario: A single-word id names its checker function
    Then the checker function of "deprecated" is "checkDeprecated"

  @test:scripts/tests/qa-checker-discovery.test.ts::subject_partition::absent_means_block
  Scenario: A criterion with no subject is a block criterion
    Then a criterion declaring no subject has subject "block"

  @test:scripts/tests/qa-checker-discovery.test.ts::subject_partition::every_script-quality_criterion_declares_subject:_script
  Scenario: Every script-quality criterion declares subject script
    Then no registry criterion in domain "script-quality" has a subject other than "script"

  @test:scripts/tests/qa-checker-discovery.test.ts::subject_partition::the_two_sets_are_disjoint
  Scenario: The block and script checker sets are disjoint
    Given the block and script checkers discovered with this repository's contributions
    Then no criterion id is in both

  @test:scripts/tests/qa-checker-discovery.test.ts::subject_partition::a_script_checker_never_lands_in_the_block_set
  Scenario: A script checker never lands in the block set
    Then "does_not_default_to_float" is a script checker and not a block checker

  @test:scripts/tests/qa-checker-discovery.test.ts::every_automated_criterion_resolves,_from_the_module_the_registry_names::each_checker_comes_from_the_module_the_registry_DECLARES
  Scenario: Each block checker comes from the module the registry declares
    Given every discovered block checker
    When its criterion's source is resolved as the sweep resolves it
    Then the source resolves without a reason
    And that module exports the same function object, directly or in a dispatch table

  @test:scripts/tests/qa-checker-discovery.test.ts::the_two_disagreements_are_reported,_not_swallowed::a_checker_for_a_criterion_declared_automated:_false_is_an_orphan
  Scenario: A checker for a non-automated criterion is an orphan
    Then the block discovery's orphans include "voice-statement-no-interpretation"

  @test:scripts/tests/qa-checker-discovery.test.ts::the_two_disagreements_are_reported,_not_swallowed::every_orphan_names_a_criterion_the_registry_really_declares_non-automated
  Scenario: Every orphan's criterion is declared non-automated
    Then every orphan names a registry criterion whose automated is false

  @test:scripts/tests/qa-checker-discovery.test.ts::a_module_that_never_finished_evaluating_keeps_its_own_name::an_unenumerable_namespace_is_`undefined`,_not_an_empty_read
  Scenario: An unenumerable module namespace reads as undefined
    Given a namespace whose key enumeration throws a ReferenceError
    When it is read
    Then the read is undefined

  @test:scripts/tests/qa-checker-discovery.test.ts::a_module_that_never_finished_evaluating_keeps_its_own_name::a_module_exporting_nothing_reads_as_EMPTY_—_the_case_`undefined`_must_not_collide_with
  Scenario: A module exporting nothing reads as empty
    When an empty namespace is read
    Then the read is defined with no values

  @test:scripts/tests/qa-checker-discovery.test.ts::a_module_that_never_finished_evaluating_keeps_its_own_name::one_unreadable_binding_does_not_cost_the_others
  Scenario: One unreadable binding does not cost the others
    Given a namespace with a good function binding and a binding that throws on read
    When it is read
    Then the read holds one value, a function

  @test:scripts/tests/qa-checker-discovery.test.ts::a_module_that_never_finished_evaluating_keeps_its_own_name::`byName`_yields_undefined_for_an_unreadable_binding_rather_than_throwing
  Scenario: Reading an unreadable binding by name yields undefined
    Given a namespace with a good function binding and a binding that throws on read
    Then reading "bad" by name is undefined
    And reading "good" by name is a function
