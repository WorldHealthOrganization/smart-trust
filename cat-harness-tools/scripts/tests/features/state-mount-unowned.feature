# A checkout-level graph that a mounted layer declares and the root does not
# is absent, not a failed mount; a reader is told so while the answer holds.
# Each Scenario names the test that executes it.
Feature: Unowned repository-scoped state graphs

  Background:
    Given an index checkout whose root declares seeded beans and whose mounted layer "lower" declares repository-scoped issue-marks

  @test:scripts/tests/state-mount-unowned.test.ts::a_repository-scoped_graph_a_mounted_instance_declares_and_the_root_does_not::tipLocations_marks_it_unowned,_and_only_it
  Scenario: Only the mounted layer's repository-scoped location is unowned
    When the tip locations are read
    Then issue-marks is on cat/lower/issue-marks, unowned by lower
    And beans is not marked unowned

  @test:scripts/tests/state-mount-unowned.test.ts::a_repository-scoped_graph_a_mounted_instance_declares_and_the_root_does_not::its_branch_missing,_and_no_branch_of_its_namespace_on_the_checkout's_origin:_ABSENT,_and_the_mount_still_succeeds_(smart-ra)
  Scenario: With no branch of its namespace on origin the graph is absent
    When state is mounted
    Then beans is "mounted" and issue-marks "absent", and the mount as a whole is "mounted"
    And no issue-marks directory is written
    And the report says "`issue-marks`: absent" and not "FAILED"

  @test:scripts/tests/state-mount-unowned.test.ts::a_repository-scoped_graph_a_mounted_instance_declares_and_the_root_does_not::its_branch_missing_while_the_origin_keeps_other_branches_of_its_namespace:_a_MISS,_and_the_mount_fails_(folio-assistant)
  Scenario: With other branches of its namespace on origin the graph is a miss
    Given origin carries cat/lower/todos but not the issue-marks branch
    When state is mounted
    Then issue-marks is a "miss" naming cat/lower/todos
    And the mount is "partial" and the report says "FAILED"

  @test:scripts/tests/state-mount-unowned.test.ts::a_repository-scoped_graph_a_mounted_instance_declares_and_the_root_does_not::its_branch_on_the_checkout's_origin_mounts_as_before
  Scenario: With its branch on origin the graph mounts
    Given origin carries the issue-marks branch
    When state is mounted
    Then the mount is "mounted", issue-marks is mounted and issue-marks/1.json exists

  @test:scripts/tests/state-mount-unowned.test.ts::a_repository-scoped_graph_a_mounted_instance_declares_and_the_root_does_not::a_root_that_declares_the_path_owns_it:_its_branch_mounts,_and_its_miss_is_still_a_failure
  Scenario: A root declaring the path owns it
    Given the root also declares issue-marks on its own seeded branch
    Then the location is the root's branch, not unowned, and it mounts
    And when the root's branch is not seeded issue-marks is a "miss" and the mount "partial"

  @test:scripts/tests/state-mount-unowned.test.ts::a_reader_is_told_the_mount_found_a_graph_absent_(bean_x5e0)::contentAt_and_graphReadPath_say_absent_after_the_mount,_and_not-mounted_before_it
  Scenario: A reader is told absent after the mount and not-mounted before it
    Then before mounting issue-marks content is "not-mounted" and its read path refused without absent
    When state is mounted
    Then its content is "absent" and its read path is refused with absent true

  @test:scripts/tests/state-mount-unowned.test.ts::a_reader_is_told_the_mount_found_a_graph_absent_(bean_x5e0)::a_later_mount_asks_again:_once_the_remote_carries_the_branch,_the_record_is_gone
  Scenario: A later mount clears the absence record
    Given state was mounted and issue-marks is absent
    When origin gains the issue-marks branch and state is mounted again
    Then its content is "present" via the mount and there is no absence record

  @test:scripts/tests/state-mount-unowned.test.ts::a_reader_is_told_the_mount_found_a_graph_absent_(bean_x5e0)::a_record_judged_against_another_origin_answers_nothing
  Scenario: An absence record for another origin answers nothing
    Given state was mounted and an absence is recorded
    When origin is pointed elsewhere
    Then there is no absence record and the content is "not-mounted"

  @test:scripts/tests/state-mount-unowned.test.ts::a_reader_is_told_the_mount_found_a_graph_absent_(bean_x5e0)::the_record_is_not_a_mount:_state:push_never_lists_it
  Scenario: The absence record is not a mount
    # Gap: asserts on mountedIds, which state:push reads; state:push itself is not run.
    When state is mounted
    Then the mounted ids contain no "issue-marks.absent" and nothing named absent

  @test:scripts/tests/state-mount-unowned.test.ts::with_no_git_directory_there_is_no_record,_and_no_error:_the_reader's_not-mounted_stands_(x5e0)
  Scenario: With no git directory there is no record
    Then a directory with no .git has no absence record and raises no error

  @test:scripts/tests/state-mount-unowned.test.ts::the_record_survives_CI's_.git_rewrite_of_origin_during_the_mount_(x5e0)
  Scenario: The record survives a .git suffix rewrite of origin
    Given origin ends in .git during the mount and not after
    Then the two forms normalise alike
    And the absence record is still found

  @test:scripts/tests/state-mount-unowned.test.ts::the_record_names_the_configured_origin,_not_an_insteadOf_rewrite_of_it_(x5e0)
  Scenario: The record names the configured origin
    Given an insteadOf rewrite to a mirror during the mount
    Then the absence record's origin is the configured origin, normalised
