# scripts/check-undeclared-files.ts is the reverse sweep: it reports root entries that no layer,
# declared directory, root index include, infrastructure entry or git ignore accounts for.
# Each Scenario names the test that executes it.
Feature: Undeclared files at the repository root are reported

  @test:scripts/tests/check-undeclared-files.test.ts::an_instance_is_accounted_for_because_it_DECLARES_itself::a_directory_holding_harness.json_is_not_a_finding
  Scenario: A directory holding its own declaration is not a finding
    Given a synthetic repository with a layer "an-instance" that declares itself
    When the root is swept
    Then "an-instance" is not among the undeclared paths

  @test:scripts/tests/check-undeclared-files.test.ts::an_instance_is_accounted_for_because_it_DECLARES_itself::and_the_reason_says_so,_rather_than_naming_it_in_a_list
  Scenario: A self-declaring layer's reason says it declares itself
    Given a synthetic repository with a layer "an-instance"
    When the accounted root paths are read
    Then the reason for "an-instance" contains "declares itself"

  @test:scripts/tests/check-undeclared-files.test.ts::a_repository-scoped_declared_directory_is_accounted_for::`work/`_at_the_root_is_named_by_the_instance's_declaration
  Scenario: A repository-scoped declared directory at the root is accounted for by its layer
    Given a layer "an-instance" declaring "work/" at repository scope
    And a "work" directory at the root
    When the root is swept
    Then "work" is not among the undeclared paths
    And the reason for "work" names "an-instance"

  @test:scripts/tests/check-undeclared-files.test.ts::a_repository-scoped_declared_directory_is_accounted_for::an_INSTANCE-scoped_directory_of_the_same_name_would_NOT_account_for_a_root_one
  Scenario: An instance-scoped declared directory does not account for a root directory of the same name
    Given a layer declaring "own/" with no scope
    And a root-level "own" directory holding "stray.txt"
    When the root is swept
    Then "own" is among the undeclared paths

  @test:scripts/tests/check-undeclared-files.test.ts::the_ROOT_may_itself_be_an_instance::its_declared_directory_is_accounted_for,_and_the_reason_names_the_declaration
  Scenario: A root instance's declared directory is accounted for, naming the root declaration
    Given a root declaration "the-repo" declaring "uploads/"
    And an "uploads" directory holding "dropped.pdf"
    When the root is swept
    Then "uploads" is not among the undeclared paths
    And the reason for "uploads" names "the-repo"

  @test:scripts/tests/check-undeclared-files.test.ts::the_ROOT_may_itself_be_an_instance::the_root's_own_harness.json_is_accounted_for
  Scenario: The root's own declaration file is accounted for
    Given a repository whose root is an instance
    When the accounted root paths are read
    Then the reason for the root's declaration file contains "own declaration"

  @test:scripts/tests/check-undeclared-files.test.ts::the_ROOT_may_itself_be_an_instance::a_root_instance_does_NOT_account_for_what_it_does_not_declare
  Scenario: A root instance does not account for a directory it does not declare
    Given a repository whose root is an instance declaring only "uploads/"
    And a root directory "undeclared-thing" holding a file
    When the root is swept
    Then "undeclared-thing" is among the undeclared paths

  @test:scripts/tests/check-undeclared-files.test.ts::the_ROOT_may_itself_be_an_instance::with_NO_root_harness.json_the_same_directory_is_still_a_finding
  Scenario: Without a root declaration an uploads directory is still a finding
    Given a repository with no root declaration
    And an "uploads" directory holding "dropped.pdf"
    When the root is swept
    Then "uploads" is among the undeclared paths

  @test:scripts/tests/check-undeclared-files.test.ts::the_ROOT_may_itself_be_an_instance::being_an_instance_still_outranks_a_root_declaration_naming_the_same_directory
  Scenario: Being a layer outranks a root declaration naming the same directory
    Given a root declaration that declares "an-instance/" as one of its directories
    And "an-instance" is itself a layer
    When the accounted root paths are read
    Then the reason for "an-instance" contains "declares itself"

  @test:scripts/tests/check-undeclared-files.test.ts::a_root_index's_content-type_`include`_accounts_for_the_paths_it_lists::a_listed_file_is_accounted_for,_and_the_reason_names_the_section
  Scenario: A file listed in a root index content-type include is accounted for
    Given root files "sushi-config.yaml", "ig.ini" and "_genonce.sh"
    And an index.config.json whose "ig" content type includes "sushi-config.yaml", "ig.ini" and "input/fsh/"
    When the root is swept
    Then neither "sushi-config.yaml" nor "ig.ini" is among the undeclared paths
    And the reason for "sushi-config.yaml" names "contentTypes.ig.include"

  @test:scripts/tests/check-undeclared-files.test.ts::a_root_index's_content-type_`include`_accounts_for_the_paths_it_lists::a_file_the_section_does_not_list_is_still_a_finding
  Scenario: A root file the include does not list is still a finding
    Given an index.config.json whose "ig" content type includes only "sushi-config.yaml"
    When the root is swept
    Then "_genonce.sh" is among the undeclared paths

  @test:scripts/tests/check-undeclared-files.test.ts::a_root_index's_content-type_`include`_accounts_for_the_paths_it_lists::a_section_with_no_`include`_accounts_for_nothing
  Scenario: A content-type section with no include accounts for nothing
    Given an index.config.json with a "dak" content type and no include
    When the root is swept
    Then "sushi-config.yaml" is among the undeclared paths

  @test:scripts/tests/check-undeclared-files.test.ts::the_check_can_fire_—_which_is_the_whole_point::a_stray_file_at_the_root_IS_reported
  Scenario: A stray file at the root is reported
    Given a file "Some Uploaded Thing.pdf" at the root
    When the root is swept
    Then "Some Uploaded Thing.pdf" is among the undeclared paths

  @test:scripts/tests/check-undeclared-files.test.ts::the_check_can_fire_—_which_is_the_whole_point::a_name_with_spaces_and_commas_survives_the_report_intact
  Scenario: A file name with spaces and commas is reported intact
    Given a file "ChatGPT Image Sep 20, 2026, 08_26_47 AM.png" at the root
    When the root is swept
    Then that exact name is among the undeclared paths

  @test:scripts/tests/check-undeclared-files.test.ts::the_check_can_fire_—_which_is_the_whole_point::a_stray_DIRECTORY_is_reported,_with_its_recursive_size
  Scenario: A stray directory is reported with its recursive size
    Given a root directory "dropped" holding 100 bytes in a nested file and 50 bytes in a direct file
    When the root is swept
    Then the finding for "dropped" has kind "directory"
    And its size is 150 bytes

  @test:scripts/tests/check-undeclared-files.test.ts::the_check_can_fire_—_which_is_the_whole_point::findings_are_ordered_largest_first,_so_the_costly_one_is_read_first
  Scenario: Findings are ordered largest first
    Given root files "small.bin" of 10 bytes and "large.bin" of 10000 bytes
    When the root is swept
    Then "large.bin" comes before "small.bin"

  @test:scripts/tests/check-undeclared-files.test.ts::what_is_deliberately_NOT_reported::infrastructure_is_accounted_for,_with_a_reason_per_entry
  Scenario: Root infrastructure is accounted for, each entry with a reason
    Given a repository with a root "package.json"
    When the root is swept
    Then "package.json" is not among the undeclared paths
    And every ROOT_INFRASTRUCTURE entry has a reason longer than 10 characters

  @test:scripts/tests/check-undeclared-files.test.ts::what_is_deliberately_NOT_reported::dotfiles_are_skipped
  Scenario: Dotfiles are skipped
    Given a root file ".somerc"
    When the root is swept
    Then ".somerc" is not among the undeclared paths

  @test:scripts/tests/check-undeclared-files.test.ts::what_is_deliberately_NOT_reported::a_gitignored_path_is_skipped,_asked_of_git_rather_than_listed
  Scenario: A gitignored directory is skipped
    Given a git repository whose .gitignore names "build-output/"
    And a "build-output" directory holding a file
    When the root is swept
    Then "build-output" is not among the undeclared paths

  @test:scripts/tests/check-undeclared-files.test.ts::what_is_deliberately_NOT_reported::...and_that_skip_is_real:_the_same_directory_unignored_IS_reported
  Scenario: The same directory not ignored is reported
    Given a git repository whose .gitignore names only "something-else/"
    And a "build-output" directory holding a file
    When the root is swept
    Then "build-output" is among the undeclared paths

  @test:scripts/tests/check-undeclared-files.test.ts::this_repository,_as_it_stands::no_two_declarations_in_this_repository_share_a_`name`
  Scenario: No two declarations in this repository share a name
    Given the real repository's root declaration and each top-level directory's declaration
    When their names are collected
    Then there are at least 3 distinct names
    And no name is used by more than one declaration file

  @test:scripts/tests/check-undeclared-files.test.ts::this_repository,_as_it_stands::the_sweep_runs_over_the_real_root_without_throwing
  Scenario: The sweep runs over the real repository root without throwing
    Given the real repository root
    When the root is swept
    Then nothing is thrown

  @test:scripts/tests/check-undeclared-files.test.ts::this_repository,_as_it_stands::cat-harness_and_bootstrap_are_accounted_for_as_instances
  Scenario: cat-harness and bootstrap are accounted for as layers in the real repository
    Given the real repository root
    When the accounted root paths are read
    Then the reasons for "cat-harness" and "bootstrap" each contain "declares itself"

  @test:scripts/tests/check-undeclared-files.test.ts::this_repository,_as_it_stands::beans/_and_todos/_are_accounted_for_by_declaration,_not_by_a_list
  Scenario: beans and todos are accounted for by declaration in the real repository
    Given the real repository root
    When the accounted root paths are read
    Then the reasons for "beans" and "todos" each contain "declared by"

  @test:scripts/tests/check-undeclared-files.test.ts::this_repository,_as_it_stands::the_root_is_clean,_and_stays_that_way
  Scenario: The real repository root has nothing undeclared
    Given the real repository root
    When the root is swept
    Then the list of undeclared paths is empty

  @test:scripts/tests/check-undeclared-files.test.ts::the_size_report_is_for_a_person::%i_renders_as_%s
  Scenario: Byte counts render in human-readable units
    Given each row of a byte count and its expected text
    When the byte count is rendered
    Then 512 renders as "512 B", 1500 as "2 KB", 232840 as "233 KB" and 1234660 as "1.2 MB"

  @test:scripts/tests/check-undeclared-files.test.ts::an_instance's_own_declaration_outranks_another_instance_naming_it::the_named_instance_still_reads_as_an_instance_—_declarer_first
  Scenario: A layer named by another layer still declares itself when the declarer sorts first
    Given layers "a-outer" and "z-inner", where "a-outer" declares "z-inner/skills/" at repository scope
    When the accounted root paths are read
    Then the reason for "z-inner" contains "declares itself"

  @test:scripts/tests/check-undeclared-files.test.ts::an_instance's_own_declaration_outranks_another_instance_naming_it::...and_declarer_second,_which_is_the_order_that_used_to_pass
  Scenario: A layer named by another layer still declares itself when the declarer sorts second
    Given layers "z-outer" and "a-inner", where "z-outer" declares "a-inner/skills/" at repository scope
    When the accounted root paths are read
    Then the reason for "a-inner" contains "declares itself"

  @test:scripts/tests/check-undeclared-files.test.ts::an_instance's_own_declaration_outranks_another_instance_naming_it::neither_is_ever_reported_as_undeclared
  Scenario: Neither ordering of a declarer and a named layer reports anything
    Given each of the two orderings of a declaring layer and a named layer
    When the root is swept
    Then the list of undeclared paths is empty

  @test:scripts/tests/check-undeclared-files.test.ts::an_instance's_own_declaration_outranks_another_instance_naming_it::on_the_REAL_repository,_bootstrap_reads_as_an_instance
  Scenario: In the real repository bootstrap reads as a layer
    Given the real repository root
    When the accounted root paths are read
    Then the reason for "bootstrap" contains "declares itself"

  @test:scripts/tests/check-undeclared-files.test.ts::a_directory_that_only_HOLDS_ignored_files::is_not_reported_—_it_is_git's_business,_not_a_finding
  Scenario: A directory holding only ignored files is not reported
    Given a git repository ignoring "__pycache__/"
    And a "scripts" directory holding only "__pycache__/x.pyc"
    When the root is swept
    Then "scripts" is not among the undeclared paths

  @test:scripts/tests/check-undeclared-files.test.ts::a_directory_that_only_HOLDS_ignored_files::...and_the_skip_is_NARROW:_one_real_file_in_it_and_it_IS_reported
  Scenario: One real file in a directory of ignored files gets it reported
    Given a "scripts" directory holding only ignored bytecode
    And a file "genuinely-undeclared.ts" added to it
    When the root is swept
    Then "scripts" is among the undeclared paths

  @test:scripts/tests/check-undeclared-files.test.ts::a_directory_that_only_HOLDS_ignored_files::a_directory_of_TRACKED_files_is_not_mistaken_for_empty
  Scenario: A directory of tracked files is not mistaken for one holding only ignored files
    Given a git repository with a committed file "kept/a.ts"
    When it is asked whether "kept" holds only ignored files
    Then the answer is false

  @test:scripts/tests/check-undeclared-files.test.ts::a_directory_that_only_HOLDS_ignored_files::git_unavailable_means_REPORT,_never_skip
  Scenario: Where git cannot answer, the directory is not skipped
    Given "/tmp" and a directory that does not exist
    When it is asked whether that directory holds only ignored files
    Then the answer is false
