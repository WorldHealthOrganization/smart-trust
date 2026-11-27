# scripts/lib/gate-own.ts scopes a layer's PR checks to the caller's own instances and files:
# the runner names the own layers, the reader parses them, and each check judges only
# those. Each Scenario names the test that executes it.
Feature: Gates judge only the caller's own files

  @test:test/gate-own-files.test.ts::gateOwnInstances::unset_or_blank_is_undefined:_the_whole_checkout_is_judged,_as_before
  Scenario: Unset or blank own instances mean the whole checkout is judged
    Given an environment without the own-instances variable, and one where it is " , "
    When the own instances are read
    Then both are undefined

  @test:test/gate-own-files.test.ts::gateOwnInstances::a_comma_list_is_the_set_of_own_instances
  Scenario: A comma list is the set of own instances
    Given the own-instances variable "smart-base, smart-ra"
    When the own instances are read
    Then they are "smart-base" and "smart-ra"

  @test:test/gate-own-files.test.ts::run-gates.py_hands_every_gate_the_caller's_own_instances::it_names_the_same_variable_and_sets_it_from_the_own_instances
  Scenario: run-gates.py names the same variables and sets them for every gate
    Given the source of .github/scripts/layer-pr-checks/run-gates.py
    When its text is read
    Then it defines GATE_OWN_ENV, GATE_OWN_PATHS_ENV and GATE_FOREIGN_PATHS_ENV with the same names as gate-own.ts
    And it sets GATE_OWN_ENV by default to the own instances joined with commas
    And it sets defaults for GATE_OWN_PATHS_ENV and GATE_FOREIGN_PATHS_ENV
    # Gap: the source text is checked; the script is not run

  @test:test/gate-own-files.test.ts::auditSchemaNodes_with_own_instances::an_instance_that_declares_no_schemas/_reads_nothing,_and_is_not_the_schemas/_fallback
  Scenario: An instance that declares no schemas directory reads nothing
    Given the harness root and own instance "no-such-instance"
    When the schema nodes are audited
    Then no directory is read
    And no module is reported

  @test:test/gate-own-files.test.ts::auditSchemaNodes_with_own_instances::this_layer's_own_run_reads_only_this_layer's_directories,_a_subset_of_the_whole
  Scenario: This layer's own audit reads only its own directories, a subset of the whole
    Given the harness root and own instance "cat-harness-tools"
    When the schema nodes are audited
    Then every directory read is under this layer
    And every module reported is also reported by the unscoped audit
    And directories and modules are found exactly when the unscoped audit holds this layer

  @test:test/gate-own-files.test.ts::gateDirectoriesForGraph:_the_subjects_a_scoped_check_judges::unset_is_the_whole_corpus,_unscoped
  Scenario: With no own instances a check judges the whole corpus
    Given the harness root, the "methodology" graph and an empty environment
    When the gate directories are computed
    Then they are not scoped
    And they equal the corpus directories for that graph

  @test:test/gate-own-files.test.ts::gateDirectoriesForGraph:_the_subjects_a_scoped_check_judges::scoped_to_an_instance_that_commits_none_is_empty,_and_says_it_was_scoped
  Scenario: Scoped to an instance that commits none, the directories are empty and marked scoped
    Given the "methodology" graph and own instance "no-such-instance"
    When the gate directories are computed
    Then the scope is "no-such-instance"
    And there are no directories

  @test:test/gate-own-files.test.ts::a_scoped_check_whose_caller_commits_none_of_its_subjects_passes,_never_exits_2_or_78::%s_says_its_caller_commits_no_%s,_and_passes
  Scenario: A scoped check whose caller commits none of its subjects says so and passes
    Given own instance "no-such-instance"
    When each check script is run
    Then it exits 0
    And its output says the caller "commits no" subjects of its kind
    # Rows: check-methodology-evidence.ts (methodology directory), check-tabular-stubs.ts (library directory), check-translation-officiality.ts (translations directory), check-schema-nodes.ts (schemas/*.ts), check-concern-groups.ts (grouping directory), check-subgraphs.ts (markdown in a declared directory)

  @test:test/gate-own-files.test.ts::gateOwnsFile:_a_file_is_the_caller's_when_its_deepest_instance_directory_is::unset_is_undefined:_judge_everything
  Scenario: With no own paths, file ownership is undefined
    Given an empty environment
    When ownership of "cat-harness/AGENTS.md" is asked
    Then the answer is undefined

  @test:test/gate-own-files.test.ts::gateOwnsFile:_a_file_is_the_caller's_when_its_deepest_instance_directory_is::a_layer_root:_its_own_directory_is_its_own,_a_mounted_layer's_and_the_index's_root_files_are_not
  Scenario: A layer owns its own directory but not a mounted layer's or the index root's files
    Given own path "smart-base" and foreign paths "cat-harness" and "cat-harness-tools"
    When file ownership is asked
    Then "smart-base/AGENTS.md" and "./smart-base/scripts/x.ts" are owned
    And "cat-harness/docs/guides/agent-onboarding.md" and "README.md" are not
    And "smart-base-extra/AGENTS.md" is not, since a name prefix is not containment

  @test:test/gate-own-files.test.ts::gateOwnsFile:_a_file_is_the_caller's_when_its_deepest_instance_directory_is::an_instance_at_the_root_owns_the_root's_files_but_not_a_mounted_layer_under_it
  Scenario: An instance at the root owns root files but not a mounted layer under it
    Given own path "." and foreign path "cat-harness"
    When file ownership is asked
    Then "README.md" is owned
    And "cat-harness/AGENTS.md" is not

  @test:test/gate-own-files.test.ts::check:command-paths_judges_only_the_caller's_own_files::a_caller_that_commits_none_of_them_passes,_never_exit_1_for_reading_nothing
  Scenario: check:command-paths passes for a caller that commits none of its files
    Given own instance and own path "no-such-instance" and no foreign paths
    When scripts/check-command-paths.ts is run
    Then it exits 0
    And its output says "commits none of the files it reads"

  @test:test/gate-own-files.test.ts::check:reference-direction_judges_only_the_caller's_own_files_and_instances::a_lower_layer's_file_naming_an_instance_above_it_is_not_charged_to_the_caller_(smart-base#298)
  Scenario: A wrong-direction reference in another layer's file is not charged to the caller
    Given a report with wrong-direction occurrences in folio-assistant-core and smart-base files and both undeclared
    And own path "smart-base" with foreign path "folio-assistant-core"
    When the report is scoped to the caller
    Then only "smart-base/input/y.md" remains classified
    And only "smart-base" remains undeclared
    And the instance count stays 3

  @test:test/gate-own-files.test.ts::check:reference-direction_judges_only_the_caller's_own_files_and_instances::unscoped,_nothing_is_dropped
  Scenario: An unscoped reference-direction report is unchanged
    Given the same report
    When it is scoped with every file owned and no own instances
    Then it equals the original report

  @test:test/gate-own-files.test.ts::a_generator_check_judges_only_the_output_the_caller_commits::%s_--check_passes_for_a_caller_that_commits_none_of_its_output
  Scenario: A generator's check passes for a caller that commits none of its output
    Given own instance and own path "no-such-instance" and no foreign paths
    When each generator is run with "--check"
    Then it exits 0
    And its output has no failure mark
    # Rows: bpmn-checklist.ts, branch-readme.ts, ../pipeline/obsolete-stale-po.ts, ../pipeline/pot-for-pages.ts
