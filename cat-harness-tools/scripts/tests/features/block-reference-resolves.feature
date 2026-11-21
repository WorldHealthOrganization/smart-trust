# scripts/block-reference-resolver.ts checks that a block's computation.script, figure links,
# {{...}} macros and Liquid references resolve, answering unknown when it cannot tell.
# Each Scenario names the test that executes it.
Feature: Block references resolve

  @test:scripts/tests/block-reference-resolves.test.ts::block-reference-resolves_criterion_registration::registered_in_KG_CRITERIA_BY_ID_with_expected_attributes
  Scenario: The block-reference-resolves criterion is registered
    Given the KG criteria registry
    When the block-reference-resolves criterion is looked up
    Then it exists with id "block-reference-resolves"
    And it applies to "folio", has block scope and minor severity
    And its summary mentions "computation.script"

  @test:scripts/tests/block-reference-resolves.test.ts::reference_resolution_checker::resolving_valid_computation.script_paths::resolves_computation.script_inside_declared_computations_directory
  Scenario: A computation script inside the declared computations directory resolves
    Given a declared computations directory holding "proof_chi.py"
    And a block whose computation.script is "computations/proof_chi.py"
    When its references are resolved
    Then the result is "pass" with no findings
    And one block was audited

  @test:scripts/tests/block-reference-resolves.test.ts::reference_resolution_checker::resolving_valid_computation.script_paths::resolves_bare_script_name_against_declared_computation_directory
  Scenario: A bare script name resolves against the declared computations directory
    Given a declared computations directory holding "solve.py"
    And a block whose computation.script is "solve.py"
    When its references are resolved
    Then the result is "pass" with no findings

  @test:scripts/tests/block-reference-resolves.test.ts::reference_resolution_checker::resolving_valid_computation.script_paths::resolves_computation.script_from_parsed_.ts_manifest_file
  Scenario: A computation script read from a .ts manifest resolves
    Given a declared computations directory holding "verify.py"
    And a theorem manifest "thm-1.ts" labelled "thm:first" with computation.script "computations/verify.py"
    When the manifest is parsed
    Then the parsed block has label "thm:first" and that script
    And resolving its references gives "pass" with no findings

  @test:scripts/tests/block-reference-resolves.test.ts::reference_resolution_checker::detecting_missing/broken_computation.script_paths::fails_when_computation.script_does_not_exist_in_declared_directory
  Scenario: A computation script missing from the declared directory fails
    Given an empty declared computations directory
    And block "thm:missing-script" with computation.script "computations/does_not_exist.py"
    When its references are resolved
    Then the result is "fail" with one "computation.script" finding on "thm:missing-script"
    And the detail says it "does not exist in declared computation directory"

  @test:scripts/tests/block-reference-resolves.test.ts::reference_resolution_checker::resolving_template_{{...}}_macros_vs_undeclared_macros::resolves_macros_declared_in_knownMacros_or_paperConfig
  Scenario: Macros declared as known or in the paper config resolve
    Given prose using {{ alpha_const }} and {{ chi_bound }}
    And "alpha_const" is a known macro and "chi_bound" is a paper-config macro
    When its references are resolved
    Then the result is "pass" with no findings

  @test:scripts/tests/block-reference-resolves.test.ts::reference_resolution_checker::resolving_template_{{...}}_macros_vs_undeclared_macros::fails_when_prose_contains_undeclared_{{...}}_macro_template
  Scenario: An undeclared macro template in prose fails
    Given block "thm:macro-unknown" whose prose uses {{ undefined_macro }}, with only "known_macro" known
    When its references are resolved
    Then the result is "fail" with one "macro-template" finding on "thm:macro-unknown"
    And the detail says macro template "{{undefined_macro}}" does not resolve

  @test:scripts/tests/block-reference-resolves.test.ts::reference_resolution_checker::resolving_template_{{...}}_macros_vs_undeclared_macros::resolves_valid_Liquid_value_references_against_declared_data_directory
  Scenario: A Liquid value reference into a declared data directory resolves
    Given a declared computations directory holding "masses.witness.json" with data.m
    And prose referencing {{ demo.computations.masses.data.m | precision: 4 }} with "demo" a known Liquid prefix
    When its references are resolved
    Then the result is "pass" with no findings

  @test:scripts/tests/block-reference-resolves.test.ts::reference_resolution_checker::resolving_template_{{...}}_macros_vs_undeclared_macros::detects_missing_entry_in_Liquid_reference_as_failure
  Scenario: A Liquid reference to a missing entry fails
    Given an empty declared computations directory and "demo" a known Liquid prefix
    And prose referencing {{ demo.computations.nonexistent_witness.data.m }}
    When its references are resolved
    Then the result is "fail" with one "macro-template" finding
    And the detail says entry "nonexistent_witness" not found in directory "computations"

  @test:scripts/tests/block-reference-resolves.test.ts::reference_resolution_checker::third-state_/_undetermined_behavior_when_directories_are_absent::returns_unknown_when_declared_computation_directory_is_absent_on_disk
  Scenario: A declared computations directory absent from disk gives unknown
    Given a computations directory that is declared but does not exist
    And a block whose computation.script points into it
    When its references are resolved
    Then the result is "unknown" with one "undetermined" finding
    And the detail says it "is absent from disk"

  @test:scripts/tests/block-reference-resolves.test.ts::reference_resolution_checker::third-state_/_undetermined_behavior_when_directories_are_absent::returns_unknown_when_computation_directory_is_undeclared_in_instance
  Scenario: An undeclared computations directory gives unknown
    Given no declared directories
    And a block whose computation.script is "computations/calc.py"
    When its references are resolved
    Then the result is "unknown" with one "undetermined" finding
    And the detail says the "computation directory is undeclared in instance"

  @test:scripts/tests/block-reference-resolves.test.ts::reference_resolution_checker::third-state_/_undetermined_behavior_when_directories_are_absent::returns_unknown_when_relative_link_points_to_absent_target_directory
  Scenario: A figure link into an absent directory gives unknown
    Given a declared uploads directory that does not exist
    And block "fig:chart" whose figure src is "uploads/chart.png"
    When its references are resolved
    Then the result is "unknown" with one "undetermined" finding
    And the detail says it "is absent from disk"

  @test:scripts/tests/block-reference-resolves.test.ts::reference_resolution_checker::third-state_/_undetermined_behavior_when_directories_are_absent::returns_unknown_when_Liquid_reference_targets_undeclared_directory
  Scenario: A Liquid reference into an undeclared directory gives unknown
    Given no declared directories and "demo" a known Liquid prefix
    And prose referencing {{ demo.mystery_dir.entry.path }}
    When its references are resolved
    Then the result is "unknown" with one "undetermined" finding
    And the detail says directory "mystery_dir" is undeclared in instance

  @test:scripts/tests/block-reference-resolves.test.ts::reference_resolution_checker::vacuity_guard::returns_unknown_when_zero_blocks_are_examined
  Scenario: Resolving zero blocks gives unknown
    Given an empty list of blocks
    When their references are resolved
    Then the result is "unknown" with zero blocks audited
    And there is one "vacuity" finding saying "vacuity guard: zero blocks were examined"

  @test:scripts/tests/block-reference-resolves.test.ts::reference_resolution_checker::vacuity_guard::returns_unknown_when_folio_directory_is_absent_on_disk
  Scenario: Auditing an instance with no folio directory on disk gives unknown
    Given an instance path that does not exist
    When its block references are audited
    Then the result is "unknown" with zero blocks audited
    And its one finding says it "is absent from disk"

  @test:scripts/tests/block-reference-resolves.test.ts::reference_resolution_checker::auditFolioBlocks_sidecar_report_generation::returns_KgQaReport_with_block-reference-resolves_criterion
  Scenario: Auditing folio blocks produces a KG QA report for the criterion
    Given a declared folio directory holding one theorem manifest "thm:sample"
    When the folio blocks are audited
    Then there is one report, whose subject kind is "folio"
    And its block-reference-resolves criterion result is "pass"
    And its pass total is 1

  @test:scripts/tests/block-reference-resolves.test.ts::reference_resolution_checker::auditFolioBlocks_sidecar_report_generation::returns_empty_array_when_no_folio_directory_is_declared
  Scenario: Auditing with no declared folio directory gives no reports
    Given no declared directories
    When the folio blocks are audited
    Then there are no reports
