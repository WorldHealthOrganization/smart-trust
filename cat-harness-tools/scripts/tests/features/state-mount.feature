# state:mount on real repositories: dispatch on the declared source, a
# three-state report, and a dirty mount is never re-read over.
# Each Scenario names the test that executes it.
Feature: Mounting state graphs

  @test:scripts/tests/state-mount.test.ts::inert_until_the_cutover::a_directory-sourced_subgraph_is_`not-enabled`,_not_a_failure
  Scenario: A directory-sourced subgraph is not enabled
    Given a checkout whose todos graph is directory-sourced
    When state is mounted
    Then the state is "not-enabled" and no todos directory is written
    And the report has no stop sign and says it is "read from the checkout"

  @test:scripts/tests/state-mount.test.ts::inert_until_the_cutover::a_commit-keyed_branch_is_qa-store's,_not_a_mount's
  Scenario: A commit-keyed branch is not mounted
    Given a todos graph on a commit-keyed branch
    When state is mounted
    Then the state is "not-enabled"

  @test:scripts/tests/state-mount.test.ts::mounting,_dispatched_on_the_declared_source::a_tip-keyed_branch_source_is_mounted_at_the_declared_path
  Scenario: A tip-keyed branch is mounted at the declared path
    When state is mounted
    Then todos is mounted from its branch with 2 files and todos/a.md reads "A"
    And the branch's manifest is not copied into todos/
    And the report names "bun run cat state:push"

  @test:scripts/tests/state-mount.test.ts::mounting,_dispatched_on_the_declared_source::a_clean_mount_behind_the_branch_is_moved_forward
  Scenario: A clean mount behind its branch moves forward
    Given todos is mounted and another checkout pushes todos/b.md
    When state is mounted again
    Then it is mounted at a new tip and todos/b.md reads "B"

  @test:scripts/tests/state-mount.test.ts::mounting,_dispatched_on_the_declared_source::--id_narrows_to_one_subgraph,_and_an_id_kept_on_no_branch_is_a_failure
  Scenario: --id narrows the mount and an unknown id fails
    Then mounting with id todos is "mounted"
    And mounting with id nope is "failed" with a reason naming nope

  @test:scripts/tests/state-mount.test.ts::it_never_discards_work::a_mount_with_unpushed_edits_is_reported_stale_and_left_exactly_as_it_is
  Scenario: A mount with unpushed edits is stale and untouched
    Given todos is mounted and todos/a.md is edited
    When state is mounted again
    Then the run is "mounted" with todos "stale"
    And the edit is still on disk and the report says "Nothing was discarded"

  @test:scripts/tests/state-mount.test.ts::it_never_discards_work::a_mount_that_is_GONE_is_re-mounted,_not_reported_stale_with_its_deletion_to_push
  Scenario: A mount whose files are gone is re-mounted
    Given todos was mounted and its directory then removed
    When state is mounted again
    Then todos is "mounted" with 2 files and todos/a.md is back

  @test:scripts/tests/state-mount.test.ts::it_never_discards_work::a_directory_the_checkout_still_tracks_is_refused,_never_overwritten,_and_NOT_read_as_stale
  Scenario: A tracked directory is refused
    Given the checkout tracks its own todos/local.md
    When state is mounted
    Then the run is "failed" with todos "refused"
    And todos/local.md is unchanged

  @test:scripts/tests/state-mount.test.ts::stale_is_ASKED,_never_inferred_from_a_refusal_plus_a_marker::a_mounted_graph_whose_path_the_checkout_then_tracks_is_refused,_not_stale_—_it_exits_non-zero
  Scenario: A mounted path the checkout then tracks is refused, not stale
    Given todos was mounted and then force-added and committed
    When state is mounted again
    Then todos is "refused" and the run is "failed"

  @test:scripts/tests/state-mount.test.ts::contentAt:_a_reader_is_told_when_the_content_is_not_on_disk_(bean_9c7h)::kept_on_a_branch_and_not_mounted_is_`not-mounted`,_never_an_empty_directory
  Scenario: Branch-kept content not yet mounted is not-mounted
    Then before mounting, todos content is "not-mounted" with a reason naming state:mount
    And after mounting it is "present" via the mount

  @test:scripts/tests/state-mount.test.ts::contentAt:_a_reader_is_told_when_the_content_is_not_on_disk_(bean_9c7h)::kept_in_the_checkout_is_`present`_with_no_mount_needed;_an_undeclared_id_says_so
  Scenario: Checkout-kept content is present and an undeclared id says so
    Given a directory-sourced todos graph
    Then its content is "present" via the checkout
    And the content of "nope" is "undeclared"

  @test:scripts/tests/state-mount.test.ts::the_resolved_source,_not_only_legacy_storage_(bean_doy3)::a_graph_declared_with_`source`_is_found_by_tipLocations_and_resolveTipLocation
  Scenario: A graph declared with source is a tip location
    Then the tip locations are exactly todos on its branch, keyed by tip
    And resolving todos gives the same location

  @test:scripts/tests/state-mount.test.ts::the_resolved_source,_not_only_legacy_storage_(bean_doy3)::a_directory_source_is_the_checkout_itself:_not_a_tip_location,_and_resolveTipLocation_says_so
  Scenario: A directory source is not a tip location
    Given a directory-sourced todos graph
    Then there are no tip locations
    And resolving todos throws "kept in the checkout"

  @test:scripts/tests/state-mount.test.ts::failure_is_LOUD,_and_says_what_not_to_believe::an_absent_branch_fails,_and_the_report_warns_against_trusting_an_empty_work-plan
  Scenario: An absent branch fails loudly
    Given the state branch does not exist
    When state is mounted
    Then it is "failed" and the report shows a stop sign
    And it says "do not trust an empty work-plan" and that absence is not evidence there is no work

  @test:scripts/tests/state-mount.test.ts::failure_is_LOUD,_and_says_what_not_to_believe::a_branch_without_the_manifest_is_not_a_state_branch
  Scenario: A branch without the manifest is corrupt
    Given the branch holds todos/a.md but no manifest
    When state is mounted
    Then it is "failed" with todos "corrupt" and nothing is written

  @test:scripts/tests/state-mount.test.ts::failure_is_LOUD,_and_says_what_not_to_believe::a_foreign_manifest_schema_is_refused
  Scenario: A foreign manifest schema is refused
    Given the branch manifest's schema is qa-reports-manifest/v1
    When state is mounted
    Then it is "failed" with a reason saying "not state-manifest/v1"

  @test:scripts/tests/state-mount.test.ts::failure_is_LOUD,_and_says_what_not_to_believe::a_commit-keyed_manifest_is_refused_—_the_keying_is_the_contract,_not_the_name
  Scenario: A commit-keyed manifest is refused
    Given the branch manifest is keyed by commit
    When state is mounted
    Then it is "failed" with a reason saying "keyed by commit"

  @test:scripts/tests/state-mount.test.ts::a_store_state:mount_does_not_mount_names_the_Tool_that_does_(bean_j9cs)::cat-harness's_site_store_names_the_Tool_that_publishes_it
  Scenario: cat-harness's site store names its Tool
    When the delegated stores of the real checkout are read
    Then the site store is route-keyed on gh-pages with Tool gh-pages

  @test:scripts/tests/state-mount.test.ts::a_store_state:mount_does_not_mount_names_the_Tool_that_does_(bean_j9cs)::a_family_store's_Tool_is_resolved_to_the_command_it_declares
  Scenario: A family store's Tool resolves to its command
    Given a declaration with a family-keyed cache store naming the Tool site-build-local
    Then the delegated store lists it with invoke "bun run cat preview:site"

  @test:scripts/tests/state-mount.test.ts::a_store_state:mount_does_not_mount_names_the_Tool_that_does_(bean_j9cs)::a_store_with_no_declared_Tool_says_so_rather_than_leaving_the_cell_blank
  Scenario: A store with no Tool says so
    Then the delegated report of a store with no Tool says "none declared"
    And the report of no stores is empty

  @test:scripts/tests/state-mount.test.ts::a_successful_mount_is_ignored_by_the_checkout::the_mounted_path_lands_in_a_generated_.gitignore_block,_and_git_ignores_it
  Scenario: A mounted path is ignored by git
    When state is mounted
    Then .gitignore has the generated block naming /todos/**
    And git status shows nothing under todos

  @test:scripts/tests/state-mount.test.ts::a_successful_mount_is_ignored_by_the_checkout::mounting_ONE_graph_keeps_every_declared_graph's_line,_and_leaves_.gitignore_byte-identical_(bean_792f)
  Scenario: Mounting one graph keeps every declared graph's ignore line
    Given two declared tip graphs and a committed block naming both
    When only todos is mounted
    Then .gitignore is byte-identical

  @test:scripts/tests/state-mount.test.ts::a_successful_mount_is_ignored_by_the_checkout::a_FULL_mount_over_layer_mounts_older_than_the_lock_leaves_.gitignore_byte-identical_(bean_x38u)
  Scenario: A full mount over stale layer mounts leaves .gitignore unchanged
    Given a committed block naming a graph only the pinned declaration has
    When state is mounted with layer mounts missing or undetermined
    Then each run is "mounted", says ".gitignore left unchanged" and leaves the file byte-identical
    And with current layer mounts the block is rewritten from the declarations

  @test:scripts/tests/state-mount.test.ts::a_successful_mount_is_ignored_by_the_checkout::a_mount_that_did_not_happen_writes_nothing
  Scenario: A mount that did not happen writes no block
    Given a directory-sourced todos graph
    When state is mounted
    Then .gitignore, if any, has no generated block

  @test:scripts/tests/state-mount.test.ts::a_successful_mount_is_ignored_by_the_checkout::the_block_is_replaced_in_place,_keeping_everything_around_it
  Scenario: The ignore block is replaced in place
    Given a .gitignore with lines before and after an old block
    When the block is rewritten for todos and issue-marks/
    Then the surrounding lines stay and the block lists /issue-marks/** and /todos/**

  @test:scripts/tests/state-mount.test.ts::a_successful_mount_is_ignored_by_the_checkout::unpaired_markers_are_refused,_not_guessed_at
  Scenario: Unpaired block markers are refused
    Then rewriting a .gitignore with a begin marker and no end throws "unpaired"

  @test:scripts/tests/state-mount.test.ts::checkout-relative_markers_and_damaged_mounts_(bean_1ple)::a_mount_missing_>50%_of_its_recorded_files_is_reported_as_damaged?_rather_than_unpushed_change(s)
  Scenario: A mount missing most of its files is reported damaged
    Given four mounted todo files of which three are then deleted
    When state is mounted again
    Then todos is "stale" and damaged
    And the report says "damaged?" and "--allow-mass-delete", not "push them with `bun run cat state:push`"

  @test:scripts/tests/state-mount.test.ts::staleLayerMounts_—_the_.gitignore_block_is_rewritten_only_over_current_layer_mounts_(beans_792f,_x38u)::a_checkout_with_no_lock_has_nothing_to_be_stale_against
  Scenario: A checkout with no lock has no stale layer mounts
    Then an empty directory has no stale layer mounts

  @test:scripts/tests/state-mount.test.ts::staleLayerMounts_—_the_.gitignore_block_is_rewritten_only_over_current_layer_mounts_(beans_792f,_x38u)::CORRUPTED:_a_layer_mount_that_does_not_match_the_lock_is_stale,_and_says_what_to_run
  Scenario: A layer mount not matching the lock is stale
    Then a missing or undetermined layer mount is stale, naming that state and state:mount
    And mounted, unverified-approver and not-enabled layer mounts are not stale
