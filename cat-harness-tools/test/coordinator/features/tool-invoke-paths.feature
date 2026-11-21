# Specifies unresolvedPaths (scripts/check-tools.ts), resolveImplementingPath
# and resolveScriptCommand over every Tool node in the checkout: shell paths
# against the repository, in-process modules against the implementing
# instance, and script keys against the declared manifests.
Feature: Every path and script key a Tool node declares resolves against the right root

  @test:test/coordinator/tool-invoke-paths.test.ts::every_declared_path_exists::the_corpus_is_clean
  Scenario: No declared path is unresolved
    Given every Tool node
    When the unresolved paths are collected
    Then there are none

  @test:test/coordinator/tool-invoke-paths.test.ts::every_declared_path_exists::there_are_paths_to_check_—_a_clean_run_over_zero_declarations_is_not_coverage
  Scenario: More than twenty Tools declare a shell invocation
    Given every Tool node
    When those with an invoke.shell string are counted
    Then there are more than 20

  @test:test/coordinator/tool-invoke-paths.test.ts::the_two_roots,_asserted_separately_because_conflating_them_breaks_20_nodes::every_`invoke.shell`_path_resolves_against_the_REPOSITORY
  Scenario: Every invoke.shell path exists under the repository
    Given every Tool node with an invoke.shell
    When the .ts, .sh or .yml path it runs is taken
    Then each such path exists relative to the checkout root

  @test:test/coordinator/tool-invoke-paths.test.ts::the_two_roots,_asserted_separately_because_conflating_them_breaks_20_nodes::every_`inProcess.module`_resolves_against_the_INSTANCE_that_implements_it,_and_NOT_against_the_repo
  Scenario: Every inProcess.module resolves under its implementing instance and not the repository
    Given the inProcess modules of every instance's Tools
    When each is resolved from its declaring instance
    Then there are more than 10
    And each is found under the implementing instance
    And none exists relative to the checkout root

  @test:test/coordinator/tool-invoke-paths.test.ts::what_the_check_deliberately_does_NOT_rule_on::a_bare_command_is_not_reported_as_a_missing_path
  Scenario: A bare command is not reported as a missing path
    Given the Tools whose shell is neither "bun run" nor a .ts, .sh or .yml path
    When the unresolved paths are collected
    Then there is at least one such Tool
    And none of them is flagged

  @test:test/coordinator/tool-invoke-paths.test.ts::what_the_check_deliberately_does_NOT_rule_on::a_`package.json`_script_name_is_not_treated_as_a_path
  Scenario: A package.json script name is not treated as a path
    Given the Tools whose shell runs a "namespace:" script with bun run
    When the unresolved paths are collected
    Then there are more than 5 such Tools
    And none of them is flagged

  @test:test/coordinator/tool-invoke-paths.test.ts::a_harness_Tool_names_its_command_by_a_script_key,_resolved_from_a_declaration::a_key_resolves_to_the_command_its_manifest_declares,_arguments_kept
  Scenario: A script key resolves to its declared command with arguments kept
    Given the checkout
    When "bun run cat pdf:viewer --embed" is resolved
    Then its key is "pdf:viewer"
    And its command ends with "/scripts/pdf-viewer.ts --embed"

  @test:test/coordinator/tool-invoke-paths.test.ts::a_harness_Tool_names_its_command_by_a_script_key,_resolved_from_a_declaration::a_key_no_manifest_declares_does_not_resolve,_and_is_a_finding_rather_than_a_pass
  Scenario: An undeclared script key does not resolve
    Given the checkout
    When "bun run cat no-such:script-key" is resolved
    Then it resolves to nothing

  @test:test/coordinator/tool-invoke-paths.test.ts::a_harness_Tool_names_its_command_by_a_script_key,_resolved_from_a_declaration::a_command_that_is_not_a_key_comes_back_unchanged
  Scenario: A command that is not a key comes back unchanged
    Given the checkout
    When "beans list" and "bun run cat scripts/x.ts" are resolved
    Then each comes back as its own command

  @test:test/coordinator/tool-invoke-paths.test.ts::a_harness_Tool_names_its_command_by_a_script_key,_resolved_from_a_declaration::no_command_or_install_line_of_the_harness's_own_Tools_names_the_tools_layer's_code
  Scenario: No command or install line of cat-harness's Tools names the tools layer
    Given the string invoke and install values of cat-harness's own Tools
    When they are searched for a "cat-harness-tools/" path
    Then there are more than 20 values
    And none names one

  @test:test/coordinator/tool-invoke-paths.test.ts::a_harness_Tool_names_its_command_by_a_script_key,_resolved_from_a_declaration::every_key_a_harness_Tool_names_is_declared,_so_every_one_of_them_runs
  Scenario: Every script key cat-harness's Tools name resolves
    Given the invoke.shell, install.cli and install.container values of cat-harness's Tools that start "bun run cat "
    When each is resolved
    Then there are more than 40
    And every one resolves
