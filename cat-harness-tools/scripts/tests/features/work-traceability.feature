# Work traceability: beans joined to content blocks and Lean declarations
# through explicit and inferred targets. Each Scenario names the test that
# executes it.
Feature: Work traceability

  @test:scripts/tests/work-traceability.test.ts::work_traceability::BeanFrontMatterSchema_and_BeanTargetsSchema::parses_beans_with_declared_targets_array
  Scenario: Front matter with a targets array parses
    Then a bean front matter with targets "def:quantum-universe" and "thm:transfer-matrix" keeps both

  @test:scripts/tests/work-traceability.test.ts::work_traceability::BeanFrontMatterSchema_and_BeanTargetsSchema::coerces_a_single_string_target_into_an_array
  Scenario: A single string target becomes a list
    Then the targets schema turns "def:single-target" into a one-item list
    And front matter with targets "sec:intro" gives ["sec:intro"]

  @test:scripts/tests/work-traceability.test.ts::work_traceability::BeanFrontMatterSchema_and_BeanTargetsSchema::allows_absent_targets
  Scenario: Targets may be absent
    Then front matter without targets parses with no targets

  @test:scripts/tests/work-traceability.test.ts::work_traceability::explicit_targets_extraction::extracts_explicit_targets_from_bean_object
  Scenario: Explicit targets are extracted without duplicates
    Then targets "thm:main", "def:helper", "thm:main" extract as "thm:main", "def:helper"

  @test:scripts/tests/work-traceability.test.ts::work_traceability::explicit_targets_extraction::handles_unquoted_or_single_quoted_items
  Scenario: Quotes are stripped from explicit targets
    Then single- and double-quoted targets extract unquoted

  @test:scripts/tests/work-traceability.test.ts::work_traceability::explicit_targets_extraction::returns_empty_array_for_beans_without_targets
  Scenario: No targets extract as empty
    Then an empty bean and null extract no targets

  @test:scripts/tests/work-traceability.test.ts::work_traceability::inferred_target_extraction_from_titles/prose::extracts_block_labels_from_title_and_prose
  Scenario: Block labels are inferred from prose
    Then thm, def, sec, lem, prop, cor, rem and ex labels in the text are all inferred

  @test:scripts/tests/work-traceability.test.ts::work_traceability::inferred_target_extraction_from_titles/prose::extracts_package-qualified_and_bare_Lean_declarations
  Scenario: Lean declarations are inferred
    Then "qou:QOU.CategoricalTransferMatrix", "QOU.TransferMatrix.lifting_exists" and "Fred2005.FormalGroupLaw" are inferred

  @test:scripts/tests/work-traceability.test.ts::work_traceability::inferred_target_extraction_from_titles/prose::cleans_trailing_punctuation_and_ignores_URLs/metadata_prefixes
  Scenario: Punctuation is trimmed; URLs and metadata are ignored
    # Gap: the URL half asserts only that "https:" is not inferred; it does not check that "sec:false-alarm" inside the URL is left out.
    Then "def:target-one", "def:target-two" and "thm:paren-target" are inferred without their punctuation
    And "https:" and "status:completed" are not inferred

  @test:scripts/tests/work-traceability.test.ts::work_traceability::inferred_target_extraction_from_titles/prose::excludes_explicit_targets_from_inferred_targets
  Scenario: Explicit targets are not also inferred
    Given explicit target "def:foo"
    Then the inferred targets of "def:foo and thm:bar and sec:baz" are thm:bar and sec:baz, not def:foo

  @test:scripts/tests/work-traceability.test.ts::work_traceability::joining_beans_to_content_blocks_and_lean_refs::joins_explicit_and_inferred_targets_to_blocks_and_Lean_declarations
  Scenario: Beans join to blocks and Lean declarations
    Given blocks def:state-space (with a Lean ref), thm:quantum-universe (with a Lean ref) and sec:intro
    And bean-1 targeting def:state-space, bean-2 naming thm:quantum-universe and sec:intro in prose, bean-3 targeting "QOU.StateSpace"
    When traceability is built
    Then bean-1's one explicit target resolves to the block and its Lean ref and declaration
    And bean-2 infers both labels, and its theorem target resolves with its Lean ref as "inferred"
    And bean-3's Lean-name target resolves to def:state-space
    And def:state-space is associated with bean-1 and bean-3 explicitly, and the theorem with bean-2 inferred

  @test:scripts/tests/work-traceability.test.ts::work_traceability::coverage_reporting::computes_coverage_statistics,_percentages,_and_unassociated_sets
  Scenario: Coverage statistics and the report
    Given four blocks of which a bean targets two, and a second bean with no targets
    When traceability is built
    Then 2 beans, 1 with targets, 50% coverage, "bean-without-target" listed
    And 4 blocks, 2 covered, "rem:uncovered" and "sec:uncovered" listed, 50% coverage
    And the formatted report has its heading, both summary lines, and names the uncovered block and the targetless bean

  @test:scripts/tests/work-traceability.test.ts::work_traceability::vacuity_guard_and_audit_evaluation::returns_unknown_when_0_beans_or_0_blocks_exist
  Scenario: No beans or no blocks is unknown
    Then an audit of no beans and no blocks is "unknown" with "traceability vacuous: 0 bean(s) and 0 block(s)"
    And an audit with beans but no blocks, and one with blocks but no beans, are "unknown"

  @test:scripts/tests/work-traceability.test.ts::work_traceability::vacuity_guard_and_audit_evaluation::vacuity_guard_on_empty_temporary_filesystem_directory
  Scenario: An empty directory is unknown
    Then an audit rooted at an empty directory is "unknown" with "traceability vacuous"

  @test:scripts/tests/work-traceability.test.ts::work_traceability::vacuity_guard_and_audit_evaluation::reports_findings_when_unassociated_blocks_or_targetless_beans_exist
  Scenario: Unassociated blocks and targetless beans fail
    Given a bean with no targets and a block no bean names
    Then the audit fails with findings for both

  @test:scripts/tests/work-traceability.test.ts::work_traceability::vacuity_guard_and_audit_evaluation::passes_when_all_blocks_are_covered_and_all_beans_have_resolved_targets
  Scenario: Full coverage passes
    Given a bean targeting the only block
    Then the audit passes with no findings

  @test:scripts/tests/work-traceability.test.ts::work_traceability::filesystem_integration_test::reads_beans_with_targets_from_disk_fixture
  Scenario: Beans with targets are read from disk
    Given a bean file whose front matter lists two targets and whose body names two more labels
    When beans are collected
    Then one bean "folio-assistant-0001" is read with the two targets
    And its explicit targets are those two, and its inferred targets include the body's labels
