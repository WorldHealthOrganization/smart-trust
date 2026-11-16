# check:state-on-main: a new state directory on main fails, and so does a
# baseline line that describes nothing. Each Scenario names the test that
# executes it.
Feature: State directories on main

  @test:scripts/tests/state-on-main.test.ts::keyOf::keys_on_instance_and_id,_and_spells_the_repository_root_`.`
  Scenario: Keys are instance and id, with the root as "."
    Then the root's beans is keyed ".::beans"
    And cat-harness's health is keyed "cat-harness::health"

  @test:scripts/tests/state-on-main.test.ts::keyOf::does_NOT_key_on_the_path,_because_a_cutover_leaves_the_path_alone
  Scenario: The key ignores the path
    Then two directories differing only in path have the same key

  @test:scripts/tests/state-on-main.test.ts::compare_—_a_NEW_state_directory_on_main_fails::an_unrecorded_on-main_directory_is_a_finding
  Scenario: An unrecorded on-main directory is a finding
    When an on-main beans directory is compared with an empty baseline
    Then there is one "new-on-main" finding keyed ".::beans"

  @test:scripts/tests/state-on-main.test.ts::compare_—_a_NEW_state_directory_on_main_fails::a_recorded_one_is_not
  Scenario: A recorded on-main directory is not a finding
    When it is compared with a baseline recording ".::beans"
    Then there is no finding

  @test:scripts/tests/state-on-main.test.ts::compare_—_a_NEW_state_directory_on_main_fails::an_off-checkout_directory_is_never_a_finding,_recorded_or_not
  Scenario: An off-checkout directory is not a finding
    When an off-checkout directory is compared with an empty baseline
    Then there is no finding

  @test:scripts/tests/state-on-main.test.ts::compare_—_a_NEW_state_directory_on_main_fails::FALSIFICATION:_drop_the_baseline_and_every_on-main_directory_fires
  Scenario: With no baseline every on-main directory is a finding
    When three on-main directories are compared with an empty baseline
    Then there are 3 findings

  @test:scripts/tests/state-on-main.test.ts::compare_—_a_baseline_line_that_describes_nothing_also_fails::a_cut-over_entry_must_be_deleted_from_the_baseline
  Scenario: A cut-over directory still in the baseline is stale
    When an off-checkout beans directory is compared with a baseline recording it
    Then there is one "baseline-stale" finding keyed ".::beans"

  @test:scripts/tests/state-on-main.test.ts::compare_—_a_baseline_line_that_describes_nothing_also_fails::so_does_an_entry_whose_directory_is_no_longer_declared_at_all
  Scenario: A baseline line for an undeclared directory is stale
    When no directories are compared with a baseline recording ".::gone"
    Then there is one "baseline-stale" finding

  @test:scripts/tests/state-on-main.test.ts::compare_—_a_baseline_line_that_describes_nothing_also_fails::FALSIFICATION:_a_one-way_ratchet_would_pass_this,_and_must_not
  Scenario: A recorded cut-over entry is reported, not passed
    # Gap: the same input as the cut-over scenario above; the case its comment describes, another directory now holding the id on main, is not built.
    When an off-checkout beans directory is compared with a baseline recording it
    Then the only finding kind is "baseline-stale"

  @test:scripts/tests/state-on-main.test.ts::stateDirectories_reads_the_declaration,_not_the_disk::a_directory_holding_a_state_kind_is_listed;_a_content_kind_is_not
  Scenario: Only state-kind directories are listed
    Given a declaration with a beans directory and a skills directory
    Then only beans is listed, with state kind beans

  @test:scripts/tests/state-on-main.test.ts::stateDirectories_reads_the_declaration,_not_the_disk::`source:_branch`_reads_as_off_the_checkout;_a_bare_directory_does_not
  Scenario: A branch source is off the checkout
    Given a branch-sourced beans and a bare todos
    Then beans is off the checkout and todos is not

  @test:scripts/tests/state-on-main.test.ts::stateDirectories_reads_the_declaration,_not_the_disk::the_legacy_`storage`_spelling_counts_too
  Scenario: The legacy storage spelling is off the checkout
    Given a qa directory declared with legacy storage
    Then it is off the checkout

  @test:scripts/tests/state-on-main.test.ts::stateDirectories_reads_the_declaration,_not_the_disk::it_finds_entries_declared_FROM_WITHIN_a_directory,_which_is_where_most_of_them_are
  Scenario: Entries declared from within a directory are found
    Given beans declares defs, notes and workflows from within
    Then the listed ids include beans, beans/defs, beans/notes and beans/workflows

  @test:scripts/tests/state-on-main.test.ts::stateDirectories_reads_the_declaration,_not_the_disk::an_entry_declared_from_within_a_BRANCH-sourced_directory_is_off_the_checkout_too
  Scenario: An entry within a branch-sourced directory is off the checkout
    Given a branch-sourced beans declaring defs from within
    Then beans and beans/defs are both off the checkout

  @test:scripts/tests/state-on-main.test.ts::stateDirectories_reads_the_declaration,_not_the_disk::a_`repository`-scoped_entry_is_keyed_and_located_at_the_checkout_root,_not_under_its_declarer
  Scenario: A repository-scoped entry belongs to the checkout root
    Given a layer declaring repository-scoped uploads and its own health
    Then checkout-uploads is keyed ".::checkout-uploads" at path uploads
    And health is keyed "fixture::health" at fixture/health

  @test:scripts/tests/state-on-main.test.ts::stateDirectories_reads_the_declaration,_not_the_disk::an_ABSENT_directory_is_not_a_finding_—_the_question_is_the_declaration
  Scenario: An absent branch-sourced directory is not a finding
    Given a branch-sourced beans with nothing on disk
    When its state directories are compared with an empty baseline
    Then there is no finding

  @test:scripts/tests/state-on-main.test.ts::instancesNotInCheckout_—_a_baseline_line_for_an_instance_this_checkout_does_not_hold::an_instance_absent_from_the_lock_and_the_disk_is_not_applicable,_and_is_not_a_failure
  Scenario: An instance absent from lock and disk is not applicable
    Given a lock and disk holding only cat-harness
    Then folio-assistant-sci is the only instance not in the checkout
    And its baseline line is "not-applicable"

  @test:scripts/tests/state-on-main.test.ts::instancesNotInCheckout_—_a_baseline_line_for_an_instance_this_checkout_does_not_hold::an_instance_the_lock_mounts_is_still_judged,_so_a_really_stale_line_still_fails
  Scenario: An instance the lock mounts is still judged
    Given a lock mounting folio-assistant-sci
    Then it is not excused and its stale line is "baseline-stale"

  @test:scripts/tests/state-on-main.test.ts::instancesNotInCheckout_—_a_baseline_line_for_an_instance_this_checkout_does_not_hold::an_instance_on_disk_is_still_judged,_lock_or_no_lock_entry
  Scenario: An instance on disk is still judged
    Given an empty lock and folio-assistant-sci on disk
    Then it is not excused

  @test:scripts/tests/state-on-main.test.ts::instancesNotInCheckout_—_a_baseline_line_for_an_instance_this_checkout_does_not_hold::no_lock,_or_an_unreadable_lock,_determines_nothing
  Scenario: No lock or an unreadable lock excuses nothing
    Then a checkout with no lock excuses no instance
    And one whose lock is not valid JSON excuses none
