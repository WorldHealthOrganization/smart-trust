# scripts/check-bean-front-matter.ts and scripts/bean-store-read.ts: the front-matter gate reports unparseable,
# unfenced, duplicate-key, duplicate-id and invalid-status beans, tells the two store absences apart and
# reconciles its counts against the directory. Each Scenario names the test that executes it.
Feature: Bean front-matter gate

  @test:scripts/tests/bean-front-matter.test.ts::check-bean-front-matter::a_clean_store_reports_no_defect
  Scenario: A clean store reports no defect
    Given a bean store holding one well-formed bean
    When the front-matter gate runs
    Then it counts 1 bean
    And it reports no defect

  @test:scripts/tests/bean-front-matter.test.ts::check-bean-front-matter::THE_REAL_BROKEN_BEAN_is_caught,_as_unparseable
  Scenario: The real broken bean is caught as unparseable at its line
    Given a store holding a good bean and the sqtq bean whose line 8 is a literal "\1"
    When the front-matter gate runs
    Then there is exactly one unparseable defect
    And it names "folio-assistant-sqtq" at line 8
    And it is not baselined

  @test:scripts/tests/bean-front-matter.test.ts::check-bean-front-matter::one_broken_bean_does_not_hide_the_others_—_the_good_one_still_counts
  Scenario: One broken bean does not hide the others
    Given a store holding a good bean and the broken sqtq bean
    When the front-matter gate runs
    Then it counts 2 beans

  @test:scripts/tests/bean-front-matter.test.ts::check-bean-front-matter::a_duplicate_key_is_its_own_kind,_not_'unparseable'
  Scenario: A duplicate key is its own kind of defect, not unparseable
    Given a store holding one bean with two different title lines
    When the front-matter gate runs
    Then there is exactly one defect, of kind "duplicate-key"
    And it is not baselined

  @test:scripts/tests/bean-front-matter.test.ts::check-bean-front-matter::no_store_is_null,_never_an_empty_one
  Scenario: No store gives a null bean count, never zero
    Given a directory with no bean store
    When the front-matter gate runs
    Then the bean count is null

  @test:scripts/tests/bean-front-matter.test.ts::check-bean-front-matter::the_baseline_is_reported_stale_when_its_bean_is_absent
  Scenario: A baselined id absent from the store is reported stale
    Given a store holding only the good bean
    When the front-matter gate runs
    Then the stale baseline is exactly "folio-assistant-1hvo"

  @test:scripts/tests/bean-front-matter.test.ts::check-bean-front-matter::the_repository's_own_store_loads_—_no_unparseable_bean_on_this_branch
  Scenario: The repository's own store has no unparseable bean
    Given the repository's own bean store
    When the front-matter gate runs
    Then the bean count is a number greater than 0
    And there is no unparseable defect

  @test:scripts/tests/bean-front-matter.test.ts::t6s7_—_a_mangled_FENCE_is_reported,_not_skipped::the_planted_file_is_a_defect,_and_the_good_bean_beside_it_still_counts
  Scenario: A bean with a mangled closing fence is a defect and the good bean still counts
    Given a store holding a good bean and a bean whose closing fence is "--"
    When the front-matter gate runs
    Then there is exactly one unfenced defect, for "folio-assistant-cccc--unfenced.md"
    And its id is the filename stem "folio-assistant-cccc--unfenced"
    And the bean count is 1

  @test:scripts/tests/bean-front-matter.test.ts::t6s7_—_a_mangled_FENCE_is_reported,_not_skipped::THE_REGRESSION:_the_bean_count_alone_cannot_see_it_—_reconciliation_can
  Scenario: Reconciliation sees the unfenced file that the bean count cannot
    Given a clean store and the same store with an unfenced file planted
    When the front-matter gate runs on both
    Then the bean counts are equal
    And the planted store has seen one more file
    And in the planted store beans plus skipped files equals files seen

  @test:scripts/tests/bean-front-matter.test.ts::t6s7_—_a_mangled_FENCE_is_reported,_not_skipped::README.md_is_the_one_documented_exception_—_skipped,_and_NOT_a_defect
  Scenario: README.md is skipped as expected and is not a defect
    Given a store holding a good bean and a plain README.md
    When the front-matter gate runs
    Then there is no unfenced defect
    And exactly one file is skipped, marked as expected
    And beans plus skipped files equals files seen

  @test:scripts/tests/bean-front-matter.test.ts::t6s7_—_a_mangled_FENCE_is_reported,_not_skipped::the_archive_is_walked_for_this_too
  Scenario: Unfenced files in the archive are reported with their subdirectory
    Given a store with a good bean and an unfenced bean under defs/archive
    When the front-matter gate runs
    Then there is exactly one unfenced defect, for "archive/folio-assistant-dddd--unfenced.md"

  @test:scripts/tests/bean-front-matter.test.ts::t6s7_—_the_two_absences_are_two_answers::DECLARED_and_not_there_is_`declared-but-absent`,_never_a_pass
  Scenario: A declared bean directory that does not exist is declared-but-absent
    Given a beans.json declaring a defs directory that does not exist
    When the front-matter gate runs
    Then the bean count is null
    And the store state is "declared-but-absent"

  @test:scripts/tests/bean-front-matter.test.ts::t6s7_—_the_two_absences_are_two_answers::no_`beans/`_at_all_is_`absent`_—_legitimate,_and_still_a_pass
  Scenario: No beans directory at all is absent
    # Gap: the gate's exit code (still a pass) is not asserted
    Given a directory with no beans/ directory
    When the front-matter gate runs
    Then the bean count is null
    And the store state is "absent"

  @test:scripts/tests/bean-front-matter.test.ts::t6s7_—_the_two_absences_are_two_answers::a_DECLARED_directory_that_exists_is_read_normally
  Scenario: A declared directory that exists is read normally
    Given a beans.json declaring directory "somewhere-else" holding one good bean
    When the front-matter gate runs
    Then the store state is "read"
    And the bean count is 1

  @test:scripts/tests/bean-front-matter.test.ts::t6s7_—_the_four_consumers_are_untouched::readBeanFiles_still_returns_the_beans,_and_still_`null`_for_no_store
  Scenario: readBeanFiles still returns only the beans, and null for no store
    Given a store holding a good bean and an unfenced file
    When the bean files are read
    Then the result lists only "folio-assistant-aaaa"
    And reading bean files from a directory with no store gives null

  @test:scripts/tests/bean-front-matter.test.ts::t6s7_—_the_four_consumers_are_untouched::the_repository's_own_store_has_no_unfenced_file
  Scenario: The repository's own store has no unfenced file
    Given the repository's own bean store
    When the front-matter gate runs
    Then the store state is "read"
    And there is no unfenced defect
    And beans plus skipped files equals files seen

  @test:scripts/tests/bean-front-matter.test.ts::t6s7_—_the_reconciliation_is_not_a_tautology::`filesSeen`_is_an_INDEPENDENT_count_of_the_directory
  Scenario: Files seen is an independent count of the directory's markdown files
    Given a store holding a good bean, an unfenced bean, a README.md and a notes.txt
    Then the directory holds 3 .md files
    And the gate's files seen is 3

  @test:scripts/tests/bean-front-matter.test.ts::t6s7_—_the_reconciliation_is_not_a_tautology::the_guard's_FAILING_branch_is_executed,_not_merely_written
  Scenario: The reconciliation's failing branch produces a complaint naming all three counts
    Then reconciling 2 beans and 1 skipped against 3 files gives no complaint
    And reconciling 1 bean and 1 skipped against 3 files gives a complaint
    And the complaint contains "3 .md file(s)", "1 bean(s)" and "1 skipped"

  @test:scripts/tests/bean-front-matter.test.ts::who_can_settle_a_duplicated_front-matter_key_(bean_`kfkh`)::same_value_twice_is_collapsible_—_nothing_is_lost
  Scenario: The same value twice is a collapsible duplicate
    Then a title duplicated as 'A' and 'A' is "collapsible"
    And an updated_at duplicated with the same timestamp is "collapsible"

  @test:scripts/tests/bean-front-matter.test.ts::who_can_settle_a_duplicated_front-matter_key_(bean_`kfkh`)::two_different_TITLES_are_the_owner's_—_choosing_is_an_editorial_act
  Scenario: Two different titles are an authored duplicate with no mechanical winner
    Then a title duplicated with two different values is "authored"
    And no mechanical winner is chosen for title

  @test:scripts/tests/bean-front-matter.test.ts::who_can_settle_a_duplicated_front-matter_key_(bean_`kfkh`)::two_different_`updated_at`s_are_NOT_the_owner's_—_the_field_settles_it
  Scenario: Two different updated_at values are settled by taking the later
    Given updated_at values 2026-09-20T15:26:13Z and 2026-09-20T15:32:27Z
    Then the duplicate is "mechanical"
    And the mechanical winner is 2026-09-20T15:32:27Z

  @test:scripts/tests/bean-front-matter.test.ts::who_can_settle_a_duplicated_front-matter_key_(bean_`kfkh`)::`created_at`_goes_the_OTHER_way_—_creation_is_immutable,_so_the_earlier_is_it
  Scenario: Two different created_at values are settled by taking the earlier
    Given created_at values 2026-09-20T15:26:13Z and 2026-09-20T15:32:27Z
    Then the duplicate is "mechanical"
    And the mechanical winner is 2026-09-20T15:26:13Z
    And the mechanical keys record created_at as "earlier" and updated_at as "later"

  @test:scripts/tests/bean-front-matter.test.ts::who_can_settle_a_duplicated_front-matter_key_(bean_`kfkh`)::status,_type,_priority_and_parent_are_authored,_not_mechanical
  Scenario: Status, type, priority and parent duplicates are authored
    Then a duplicate of each of status, type, priority and parent with values "a" and "b" is "authored"

  @test:scripts/tests/bean-front-matter.test.ts::who_can_settle_a_duplicated_front-matter_key_(bean_`kfkh`)::the_key_scan_reads_the_RAW_block,_because_the_block_does_not_parse
  Scenario: The duplicate-key scan reads the raw block and ignores continuations
    Given a raw front-matter block with title "one" and later title "two", an indented line and a list item
    When its duplicated keys are scanned
    Then the only duplicate is title with values "one" and "two"

  @test:scripts/tests/bean-front-matter.test.ts::who_can_settle_a_duplicated_front-matter_key_(bean_`kfkh`)::a_block_with_no_duplicate_yields_none_—_the_scan_is_not_vacuous
  Scenario: A block with no duplicate key yields none
    Given the block "title: one" and "status: todo"
    When its duplicated keys are scanned
    Then there are none

  @test:scripts/tests/bean-front-matter.test.ts::check-bean-front-matter_—_duplicate_ids_across_files_(4vg7)::two_valid_files_declaring_one_id_are_BOTH_reported,_each_naming_the_other
  Scenario: Two valid files declaring one id are both reported
    Given a store holding a good bean and two valid files both declaring "folio-assistant-cccc"
    When the front-matter gate runs
    Then the duplicate-id defects name both files
    And each names "folio-assistant-cccc" and is not baselined
    And the first defect's message names the other file
    And there is no other defect

  @test:scripts/tests/bean-front-matter.test.ts::check-bean-front-matter_—_duplicate_ids_across_files_(4vg7)::a_collision_between_defs/_and_archive/_counts_—_archiving_does_not_free_an_id
  Scenario: A collision between defs and archive counts as a duplicate id
    Given a live bean in defs and an archived bean under defs/archive with the same id
    When the front-matter gate runs
    Then the duplicate-id defects name "archive/folio-assistant-cccc--old.md" and "folio-assistant-cccc--live.md"

  @test:scripts/tests/bean-front-matter.test.ts::check-bean-front-matter_—_duplicate_ids_across_files_(4vg7)::distinct_ids_yield_nothing,_and_a_collision_keeps_both_paths
  Scenario: Distinct ids yield nothing and a collision keeps both paths
    Then beans "a" and "b" have no duplicate ids
    And beans "a" in a1.md and archived "a" in a2.md give duplicate "a" with paths "a1.md" and "archive/a2.md"

  @test:scripts/tests/bean-front-matter.test.ts::check-bean-front-matter_—_invalid_status_and_generated_README.md::a_bean_with_`status:_done`_(cat-tools-g7ls_in_d29eea56)_is_caught_as_`invalid-status`
  Scenario: A bean with status done is caught as invalid-status
    Given a store holding a good bean and cat-tools-g7ls with "status: done"
    When the front-matter gate runs
    Then there is exactly one invalid-status defect, for "cat-tools-g7ls"
    And it is not baselined
    And its message names "done" and "completed"

  @test:scripts/tests/bean-front-matter.test.ts::check-bean-front-matter_—_invalid_status_and_generated_README.md::a_`README.md`_with_generated_YAML_front_matter_is_skipped_as_expected,_never_parsed_as_a_bean
  Scenario: A README.md with generated front matter is skipped, never read as a bean
    Given a store holding a good bean and a README.md with generated YAML front matter
    When the bean store is read
    Then its beans are only "folio-assistant-aaaa"
    And README.md is skipped as expected and not archived
    And the front-matter gate counts 1 bean and reports no defect
