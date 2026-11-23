# mountTip and pushMount in scripts/branch-store.ts mount a tip-keyed state
# branch's directory into a checkout and push its edits back with expected
# blobs, on real git repositories. Each Scenario names the test that executes it.
Feature: Mounting a state branch and pushing it back

  @test:scripts/tests/sdlc/branch-mount.test.ts::mount::puts_the_tip's_files_at_the_declared_path,_bytes_and_modes_intact,_with_the_marker_outside_the_mount
  Scenario: A mount puts the tip's files at the declared path, bytes and modes intact
    Given a remote fsh-guts branch holding markdown, a binary PDF, an executable script and a symlink
    When it is mounted into a fresh checkout
    Then the mount is "mounted"
    And "fsh-guts/retired/a.md" holds its text and "fsh-guts/uploads/doc.pdf" its exact bytes
    And "fsh-guts/scripts/run.sh" is executable
    And the branch root's manifest is not in the mount
    And the marker exists outside the mount directory and records the remote tip

  @test:scripts/tests/sdlc/branch-mount.test.ts::mount::a_miss_is_a_miss,_never_an_empty_mount
  Scenario: A missing branch is a miss, never an empty mount
    Given a location naming the absent branch "cat/cat-harness/no-such"
    When it is mounted
    Then the mount is "miss"
    And no "fsh-guts" directory is made and no marker is written

  @test:scripts/tests/sdlc/branch-mount.test.ts::mount::refuses_a_directory_the_checkout_still_tracks:_the_cutover_has_not_happened
  Scenario: A directory the checkout still tracks is refused
    Given a checkout that commits "fsh-guts/kept.md" on main
    When the branch is mounted
    Then the mount is "refused"
    And "fsh-guts/kept.md" still holds "on main"

  @test:scripts/tests/sdlc/branch-mount.test.ts::mount::refuses_a_non-empty_directory_that_is_not_a_mount
  Scenario: A non-empty directory that is not a mount is refused
    Given an untracked "fsh-guts/stray.md" in the checkout
    When the branch is mounted
    Then the mount is "refused"
    And the stray file is unchanged

  @test:scripts/tests/sdlc/branch-mount.test.ts::mount::refuses_to_re-mount_over_unpushed_edits
  Scenario: A re-mount over unpushed edits is refused
    Given a mounted fsh-guts with an unpushed edit to "retired/a.md"
    When the branch is mounted again
    Then the mount is "refused"
    And the edit is kept

  @test:scripts/tests/sdlc/branch-mount.test.ts::mount::refuses_a_non-tip_keying_with_a_reason_naming_the_keying_(bean_5akx)
  Scenario: A non-tip keying is refused with a reason naming the keying
    Given a route-keyed location "uml-overview"
    When it is mounted
    Then the mount is "refused" with a reason containing "keyed by route, not tip"

  @test:scripts/tests/sdlc/branch-mount.test.ts::push::splices_an_edit,_an_addition_and_a_removal_onto_the_tip,_then_has_nothing_left_to_send
  Scenario: A push splices an edit, an addition and a removal onto the tip
    Given a mounted fsh-guts where a.md is edited, "samples/new.md" is added and b.md is deleted
    When the mount is pushed
    Then the push is "pushed" and the remote tip moves
    And the remote holds the new a.md and new.md, and no b.md
    And the PDF's bytes and the branch manifest are carried across
    And the marker's lastPush is the new tip while its tip is still the mounted one
    And a second push is "unchanged"

  @test:scripts/tests/sdlc/branch-mount.test.ts::push::a_sibling's_edit_to_the_SAME_file_since_the_mount_is_a_conflict,_and_nothing_is_pushed
  Scenario: A sibling's edit to the same file since the mount is a conflict
    Given checkouts a and b both mounted, and b has pushed an edit to a.md
    When a pushes its own edit to a.md
    Then the push is "conflict"
    And the remote tip and a.md are still b's

  @test:scripts/tests/sdlc/branch-mount.test.ts::push::siblings_editing_DIFFERENT_files_both_land;_neither_overwrites_the_other
  Scenario: Siblings editing different files both land
    Given checkouts a and b both mounted, a editing a.md and b editing b.md
    When a pushes, then b pushes
    Then both pushes are "pushed"
    And the remote holds a's a.md and b's b.md

  @test:scripts/tests/sdlc/branch-mount.test.ts::push::a_file_the_checkout_ignores_(local_scratch_such_as_logs)_is_never_pushed
  Scenario: A file the checkout ignores is never pushed
    Given a mounted fsh-guts and a checkout that ignores "fsh-guts/logs/"
    When "fsh-guts/logs/session.jsonl" is written and the mount is pushed
    Then the push is "unchanged"
    And the remote has no session.jsonl

  @test:scripts/tests/sdlc/branch-mount.test.ts::push::ignoring_the_whole_mount_on_main_does_not_make_its_files_unpushable
  Scenario: Ignoring the whole mount on main does not make its files unpushable
    Given a checkout whose .gitignore ignores "fsh-guts/"
    When the branch is mounted, a.md is edited and the mount is pushed
    Then the push is "pushed"
    And the remote a.md holds the edit

  @test:scripts/tests/sdlc/branch-mount.test.ts::push::the_cutover's_ignore_rules:_logs_written_BEFORE_the_first_mount_neither_block_it_nor_get_pushed_(bean_9c7h)
  Scenario: Logs written before the first mount neither block it nor get pushed
    Given a checkout ignoring "/fsh-guts/**" and "fsh-guts/logs/", with a log already written
    When the branch is mounted
    Then the mount is "mounted" and the log is kept
    And after editing a.md the push is "pushed" with the edit on the remote
    And the remote has no log

  @test:scripts/tests/sdlc/branch-mount.test.ts::push::a_file_the_checkout_does_NOT_ignore_still_blocks_a_first_mount_—_it_is_a_competing_copy
  Scenario: A file the checkout does not ignore blocks a first mount
    Given an untracked, unignored "fsh-guts/retired/stray.md"
    When the branch is mounted
    Then the mount is "refused"
    And the stray file is unchanged

  @test:scripts/tests/sdlc/branch-mount.test.ts::push::an_unmounted_id_is_refused,_not_treated_as_empty
  Scenario: Pushing an unmounted id is refused
    Given a fresh checkout with nothing mounted
    When "fsh-guts" is pushed
    Then the push is "refused"

  @test:scripts/tests/sdlc/branch-mount.test.ts::push::a_mount_deleted_from_under_its_marker_is_refused,_never_pushed_as_the_deletion_of_every_file
  Scenario: A mount deleted from under its marker is refused, not pushed as deletions
    Given a mounted fsh-guts whose directory is then removed
    When the mount is pushed
    Then the push is "refused" with a reason containing "does not exist"
    And the emptying check gives the same reason
    And the remote tip and a.md are unchanged
    And a re-mount is "mounted" and restores the PDF's bytes

  @test:scripts/tests/sdlc/branch-mount.test.ts::push::a_mount_emptied_of_every_file_is_refused_too:_the_branch_would_then_be_a_miss
  Scenario: A mount emptied of every file is refused
    Given a mounted fsh-guts replaced by an empty directory
    When the mount is pushed
    Then the push is "refused" with a reason containing "holds no files"
    And the remote tip is unchanged
    And a re-mount is "mounted" and restores a.md

  @test:scripts/tests/sdlc/branch-mount.test.ts::push::a_copy_of_a_linked_worktree,_sharing_its_git_directory,_cannot_re-mount_over_the_original's_mount
  Scenario: A copy sharing the original's git directory cannot re-mount
    Given a mounted checkout copied with a ".git" file naming the original's git directory
    When the copy mounts the branch
    Then the mount is "refused" with a reason containing "shares this git directory"
    And the original's a.md and marker are untouched
    And the original's push is "unchanged"

  @test:scripts/tests/sdlc/branch-mount.test.ts::push::markers_store_a_checkout-relative_into;_cp_-a_of_a_checkout_followed_by_mountTip_in_the_copy_leaves_the_original_byte-identical_(bean_1ple)
  Scenario: A checkout-relative marker lets a full copy re-mount into itself only
    # Gap: only b.md and a local draft in the original are compared, not every byte
    Given a mounted checkout whose marker's into is "fsh-guts", copied whole
    And a local draft in the original and a newer b.md pushed from another checkout
    When the copy mounts the branch
    Then the mount is "mounted" and the copy holds the newer b.md
    And the original still holds the old b.md and its local draft

  @test:scripts/tests/sdlc/branch-mount.test.ts::push::a_marker_whose_into_resolves_outside_repoRoot_is_refused_by_mountTip_and_pushMount_(bean_1ple)
  Scenario: A marker whose into lies outside the checkout is refused
    Given a copied checkout whose marker's into is the original's absolute mount path
    When the copy mounts the branch, and when it pushes
    Then both are "refused" with a reason containing "outside this checkout"
    And the original's a.md is untouched

  @test:scripts/tests/sdlc/branch-mount.test.ts::push::an_existing_in-repo_absolute_marker_is_migrated_to_checkout-relative_on_next_mount_(bean_1ple)
  Scenario: An in-repo absolute marker is migrated to checkout-relative on the next mount
    Given a mounted checkout whose marker's into is rewritten to its own absolute mount path
    When the branch is mounted again
    Then the mount is "mounted"
    And the marker's into is "fsh-guts"

  @test:scripts/tests/sdlc/branch-mount.test.ts::push::deleting_all_but_one_file,_or_replacing_every_file,_is_an_edit_and_still_pushes
  Scenario: Deleting all but one file, or replacing every file, still pushes
    Given a mounted fsh-guts
    When every file but a.md is deleted and pushed
    Then the push is "pushed"
    And when a.md is replaced by "only.md" the push is "pushed" and the remote holds only.md

  @test:scripts/tests/sdlc/branch-mount.test.ts::review_on_#1957::two_worktrees_of_one_checkout_mounting_the_same_id_keep_separate_markers,_and_neither_pushes_the_other's_edits
  Scenario: Two worktrees of one checkout keep separate markers
    Given a checkout and a linked worktree, both mounting fsh-guts
    Then their marker paths differ
    When only the worktree edits b.md
    Then the checkout's push is "unchanged" and the remote b.md is unchanged
    And the worktree's push is "pushed" with its edit on the remote

  @test:scripts/tests/sdlc/branch-mount.test.ts::review_on_#1957::a_symlink_is_mounted_as_a_symlink_and_pushed_back_as_one,_never_as_a_regular_file
  Scenario: A symlink is mounted and pushed back as a symlink
    Given a mounted fsh-guts
    Then "scripts/a-link.md" is a symlink to "../retired/a.md"
    When b.md is edited and pushed
    Then the remote entry for the link has mode 120000
    And re-pointing the link to "../retired/b.md" pushes that new target

  @test:scripts/tests/sdlc/branch-mount.test.ts::review_on_#1957::gitBlobId_is_git's_own_blob_id,_computed_without_spawning_git
  Scenario: The blob id matches git's own
    # Gap: that no git process is spawned is not checked
    Given empty bytes, "hello", and non-UTF-8 PDF bytes
    When the blob id of each is computed
    Then it equals what git hash-object gives

  @test:scripts/tests/sdlc/branch-mount.test.ts::review_on_#1957::after_a_push_over_a_moved_tip,_`tip`_is_still_the_MOUNTED_tip_and_`lastPush`_records_the_push
  Scenario: After a push over a moved tip the marker keeps the mounted tip
    Given checkouts a and b both mounted, and b has pushed an edit to b.md
    When a pushes an edit to a.md
    Then the push is "pushed"
    And a's marker tip is still the one it mounted and its lastPush is the remote tip
    And a's later edit to its stale b.md is a "conflict" that leaves b's text on the remote
