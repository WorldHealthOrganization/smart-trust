# scripts/check-declared-dirs.ts checks that a declared directory exists or says why it does not,
# in both directions, including entries declared from within and undeclared state directories (beans 8mbk, hp54).
# Each Scenario names the test that executes it.
Feature: A declared directory exists, or says why it does not

  @test:scripts/tests/kg/declared-dirs.test.ts::the_resolution_rule::`scope:_repository`_resolves_against_the_repo,_not_the_instance
  Scenario: A repository-scoped path resolves against the repository root
    Given a declared path "a/" with scope "repository", instance root "/i" and repository root "/r"
    When the declared path is resolved
    Then it is "/r/a/"

  @test:scripts/tests/kg/declared-dirs.test.ts::the_resolution_rule::anything_else_resolves_against_the_instance
  Scenario: Any other path resolves against the instance root
    Given a declared path "a/" with no scope, instance root "/i" and repository root "/r"
    When the declared path is resolved
    Then it is "/i/a/"
    And with scope "instance" it is also "/i/a/"

  @test:scripts/tests/kg/declared-dirs.test.ts::absent_and_unexplained_is_a_finding::a_declared_directory_that_is_not_on_disk
  Scenario: A declared directory missing from disk is an absent finding
    Given a layer declaring the directory "somewhere/" that does not exist
    When the instance is audited
    Then there is exactly one finding, of kind "absent"

  @test:scripts/tests/kg/declared-dirs.test.ts::absent_and_unexplained_is_a_finding::...and_`absent.reason`_clears_it
  Scenario: An absent reason clears the absent finding
    Given a layer declaring the missing directory "somewhere/" with an absent reason
    When the instance is audited
    Then there are no findings

  @test:scripts/tests/kg/declared-dirs.test.ts::an_entry_declared_FROM_WITHIN_is_checked_too::absent_and_unexplained_is_a_finding,_where_before_it_was_invisible
  Scenario: A nested entry missing from disk is an absent finding
    Given a layer whose "processes/processes.json" declares a nested entry "nested" at "proposals" that does not exist
    When the nested entries are audited
    Then there is exactly one finding, of kind "absent"
    And its id is "processes/nested"

  @test:scripts/tests/kg/declared-dirs.test.ts::an_entry_declared_FROM_WITHIN_is_checked_too::...and_it_is_clean_once_the_directory_is_there
  Scenario: A nested entry is clean once its directory exists
    Given a layer whose "processes/processes.json" declares a nested entry "nested" at "proposals"
    And the directory "processes/proposals" exists
    When the nested entries are audited
    Then there are no findings

  @test:scripts/tests/kg/declared-dirs.test.ts::an_entry_declared_FROM_WITHIN_is_checked_too::`absent.reason`_clears_it,_and_an_exemption_that_outlived_its_cause_is_caught
  Scenario: An absent reason clears a nested entry, and a stale one is caught
    Given a nested entry "nested" at "proposals" carrying an absent reason
    When the nested entries are audited while the directory is missing
    Then there are no findings
    When the nested entries are audited while the directory exists
    Then there is exactly one finding, of kind "stale-exemption"

  @test:scripts/tests/kg/declared-dirs.test.ts::an_entry_declared_FROM_WITHIN_is_checked_too::the_remedy_names_the_DECLARING_FILE,_not_the_path's_parent
  Scenario: A nested finding's remedy names the declaring file, not the path's parent
    Given a nested entry "deep" at "assets/img/uml/overview" that does not exist
    When the nested entries are audited
    Then there is exactly one finding
    And it is nested in the file "processes/processes.json", not "processes/assets/img/uml/"
    And its detail names "processes/processes.json"

  @test:scripts/tests/kg/declared-dirs.test.ts::an_entry_declared_FROM_WITHIN_is_checked_too::an_off-checkout_nested_entry_gets_the_SAME_answer_as_a_top-level_one
  Scenario: An off-checkout nested entry gets the same finding kinds as a top-level one
    Given a nested sub-graph entry at "proposals" stored on branch "cat/x" keyed by tip
    And an identical top-level entry stored on branch "cat/x" keyed by tip
    When the nested entries and the top-level instance are audited
    Then both report the same list of finding kinds
    And the nested side reports at least one finding

  @test:scripts/tests/kg/declared-dirs.test.ts::an_entry_declared_FROM_WITHIN_is_checked_too::a_nested_branch_entry_that_no_mount_can_reach_says_SO,_rather_than_naming_the_mount
  Scenario: A nested branch entry no mount can reach is reported as unmountable
    Given a nested entry at "proposals" stored on branch "cat/x" keyed by tip without the sub-graph marker
    When the nested entries are audited
    Then the only finding is of kind "unmountable"
    And its detail names "\"subgraph\": true"

  @test:scripts/tests/kg/declared-dirs.test.ts::an_entry_declared_FROM_WITHIN_is_checked_too::auditInstance_now_reaches_nested_entries,_so_the_sweep_cannot_miss_them
  Scenario: Auditing an instance also reaches its nested entries
    Given a layer whose "processes/processes.json" declares a missing nested entry "nested" at "proposals"
    When the instance is audited
    Then exactly one finding has the id "processes/nested"

  @test:scripts/tests/kg/declared-dirs.test.ts::explained_but_present_is_ALSO_a_finding::an_exemption_that_outlived_its_cause
  Scenario: An absent reason on a directory that exists is a stale exemption
    Given a layer declaring "somewhere/" with an absent reason
    And the directory "somewhere" exists
    When the instance is audited
    Then there is exactly one finding, of kind "stale-exemption"

  @test:scripts/tests/kg/declared-dirs.test.ts::a_file_at_the_declared_path_is_not_the_directory_being_there::it_is_still_reported_absent
  Scenario: A file at the declared path is still reported absent
    Given a layer declaring the directory "somewhere/"
    And a regular file named "somewhere" in its place
    When the instance is audited
    Then there is exactly one finding, of kind "absent"

  @test:scripts/tests/kg/declared-dirs.test.ts::a_repository-scoped_entry_inside_another_instance_is_a_mirror::refused
  Scenario: A repository-scoped entry inside another instance is refused as a mirror
    Given another instance root holding a "library" directory
    And a layer declaring that "library" directory by absolute path with scope "repository"
    When the layer is audited with both instance roots known
    Then the only finding is of kind "mirror"

  @test:scripts/tests/kg/declared-dirs.test.ts::a_repository-scoped_entry_inside_another_instance_is_a_mirror::...but_not_inside_an_instance_that_CONTAINS_the_declaring_one
  Scenario: A repository-scoped entry inside an instance containing the declaring one is not a mirror
    Given a layer declaring "x/" with scope "repository" and an absent reason
    When the layer is audited with the repository root "/" as one of the instance roots
    Then there are no "mirror" findings

  @test:scripts/tests/kg/declared-dirs.test.ts::the_real_corpus::every_declared_directory_in_this_repository_resolves
  Scenario: Every declared directory in this repository resolves
    Given the instance roots discovered in this repository, more than one of them
    When every instance is audited
    Then there are no findings once those set aside are excluded
    And the set-aside findings are: absent directories that may leave main, unmounted directories, and absent repository-scoped directories when standing alone without the composed checkout

  @test:scripts/tests/kg/declared-dirs.test.ts::undeclared-state_—_a_state_directory_on_disk_that_nothing_declares_(hp54)::the_conventional_state_paths_are_beans/_and_todos/,_and_nothing_that_holds_content
  Scenario: The conventional state directories are beans and todos and nothing holding content
    When the conventional state directories are listed
    Then their ids include "beans" and "todos"
    And they do not include "library" or "skills"

  @test:scripts/tests/kg/declared-dirs.test.ts::undeclared-state_—_a_state_directory_on_disk_that_nothing_declares_(hp54)::present_and_undeclared_is_a_finding_—_named,_with_the_declaration_to_add
  Scenario: A present but undeclared state directory is a finding naming the declaration to add
    Given a layer declaring no directories, with "beans" and "todos" directories on disk
    When the undeclared state is audited
    Then the findings are "beans" and "todos", each of kind "undeclared-state"
    And the first finding's detail names "cat/<instance>/"
    And it says "Nothing is removed"

  @test:scripts/tests/kg/declared-dirs.test.ts::undeclared-state_—_a_state_directory_on_disk_that_nothing_declares_(hp54)::declared_—_either_source_—_is_not_a_finding
  Scenario: A declared state directory, from either source, is not a finding
    Given a layer declaring "beans/" on disk and "todos/" from branch "cat/fixture/todos" keyed by tip
    And both directories exist on disk
    When the undeclared state is audited
    Then there are no findings

  @test:scripts/tests/kg/declared-dirs.test.ts::undeclared-state_—_a_state_directory_on_disk_that_nothing_declares_(hp54)::an_undeclared_uploads/_is_the_repository's_data_store,_not_a_finding_(owner,_2026-11-03)
  Scenario: An undeclared uploads directory is not a finding
    Given a layer declaring no directories, with "uploads" and "beans" directories on disk
    When the undeclared state is audited
    Then the only finding is for "beans"

  @test:scripts/tests/kg/declared-dirs.test.ts::undeclared-state_—_a_state_directory_on_disk_that_nothing_declares_(hp54)::absent_is_not_a_finding,_and_neither_is_an_instance_with_no_declaration_at_all
  Scenario: An absent state directory, or an instance with no declaration, is not a finding
    Given a layer declaring no directories and holding no state directories
    When the undeclared state is audited
    Then there are no findings
    And a bare directory with "beans" on disk but no declaration also yields no findings
