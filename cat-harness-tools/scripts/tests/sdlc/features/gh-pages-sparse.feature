# The staging deploy's scripts (scripts/staging-share.ts, staging-rotate.ts, staging-push-gate.ts, render-log.ts,
# staging-changes.ts) give the same answers on a sparse, blobless gh-pages checkout as on a full one, reading what
# lies outside the cone from git objects. Each Scenario names the test that executes it.
Feature: The staging deploy on a sparse gh-pages checkout

  @test:scripts/tests/sdlc/gh-pages-sparse.test.ts::the_cone,_as_git_draws_it::root_files,_files_beside_a_path_to_a_cone_directory,_and_everything_under_one
  Scenario: The cone holds root files, files beside a path to a cone directory, and everything under one
    Given the cone directories "branches/s1" and "_render-log"
    When inCone is asked about paths
    Then "index.html", "branches/README.txt", "branches/s1/a/b.html" and "_render-log/1.jsonl" are in the cone
    And "branches/s10/index.html", "branches/b/index.html" and "docs/a.html" are not

  @test:scripts/tests/sdlc/gh-pages-sparse.test.ts::staging-share_—_the_plan_from_git_objects_is_the_plan_from_a_checkout::same_shared_list,_kept_count_and_bytes
  Scenario: The share plan from a sparse checkout equals the plan from a full one
    Given a full and a sparse checkout of the same gh-pages origin, each with preview "s1" staged
    When the share plan is made in each
    Then the two plans are equal
    And the shared files are "docs/big.bin", "docs/same.css" and "docs/same.html"

  @test:scripts/tests/sdlc/gh-pages-sparse.test.ts::staging-share_—_the_plan_from_git_objects_is_the_plan_from_a_checkout::a_live_file_left_on_disk_outside_the_cone_is_read_from_the_index,_not_the_disk
  Scenario: A stale live file on disk outside the cone does not change the share plan
    Given a sparse checkout with preview "s1" and a stale "docs/diff.css" on disk that matches the preview
    When the share plan is made
    Then it equals the plan from the full checkout

  @test:scripts/tests/sdlc/gh-pages-sparse.test.ts::staging-share_—_the_plan_from_git_objects_is_the_plan_from_a_checkout::a_blob_fetch_that_fails_throws,_so_apply_removes_nothing
  Scenario: A failed blob fetch makes the share plan throw
    # Gap: that apply removes nothing is not checked directly; only the throw is asserted
    Given a sparse checkout with preview "s1" whose origin URL points nowhere
    When the share plan is made
    Then it throws "could not fetch"

  @test:scripts/tests/sdlc/gh-pages-sparse.test.ts::staging-share_—_the_plan_from_git_objects_is_the_plan_from_a_checkout::a_byte-identical_file_is_decided_by_its_blob_id,_without_fetching_it
  Scenario: Byte-identical files are compared by blob id without being fetched
    Given the sparse checkout the share plan was made in
    Then the blobs of "docs/big.bin", "docs/same.css" and "branches/other/x.bin" are still absent
    And the blob of the page "docs/same.html" was fetched

  @test:scripts/tests/sdlc/gh-pages-sparse.test.ts::staging-rotate_—_the_same_plan,_and_the_same_commit,_on_a_sparse_checkout::inCone_agrees_with_git's_own_skip-worktree_marks_on_a_fresh_checkout
  Scenario: inCone agrees with git's skip-worktree marks
    Given a fresh sparse checkout with the cone for preview "cur"
    When every path git lists with its skip-worktree mark is checked
    Then inCone is true exactly for the paths git does not mark "S"

  @test:scripts/tests/sdlc/gh-pages-sparse.test.ts::staging-rotate_—_the_same_plan,_and_the_same_commit,_on_a_sparse_checkout::every_preview_has_the_same_age,_source_and_size
  Scenario: Every preview reads the same from a sparse checkout as from a full one
    Given a full and a sparse checkout holding previews "a", "b", "c", "d" and the current "cur"
    When the previews are read in each
    Then the two readings are equal
    And the age sources are "stamp" for "a" and "b", "render-log" for "c", "unknown" for "cur" and "record" for "d"

  @test:scripts/tests/sdlc/gh-pages-sparse.test.ts::staging-rotate_—_the_same_plan,_and_the_same_commit,_on_a_sparse_checkout::a_recorded_size_is_read_without_the_preview's_blobs;_an_unrecorded_one_fetches_them
  Scenario: A recorded size is used without fetching blobs, an unrecorded one fetches them
    Given a sparse checkout where preview "a" has a size record and "b" has none
    When the previews are read
    Then the blob of "branches/a/big.bin" is still absent
    And the blob of "branches/b/index.html" was fetched

  @test:scripts/tests/sdlc/gh-pages-sparse.test.ts::staging-rotate_—_the_same_plan,_and_the_same_commit,_on_a_sparse_checkout::a_size_record_that_no_longer_matches_the_preview's_files_is_not_trusted
  Scenario: A size record that no longer matches the preview's files is not trusted
    Given an origin where preview "a" gained a file after its size record was written
    When preview "a" is read from a full and from a sparse checkout
    Then the two readings are equal

  @test:scripts/tests/sdlc/gh-pages-sparse.test.ts::staging-rotate_—_the_same_plan,_and_the_same_commit,_on_a_sparse_checkout::the_rotation_removes_the_same_previews_and_commits_the_same_tree
  Scenario: The rotation removes the same previews and stages the same tree
    Given a full and a sparse checkout and a budget of 4000 bytes
    When each is rotated with "cur" as the current preview
    Then the plans and printed lines are equal
    And previews "c" and "d" are removed
    And after staging, both checkouts write the same tree
    And "branches/_retired" holds "d.json" and "old.json"

  @test:scripts/tests/sdlc/gh-pages-sparse.test.ts::staging-rotate_—_the_same_plan,_and_the_same_commit,_on_a_sparse_checkout::a_preview_directory_on_disk_OUTSIDE_the_cone_is_read,_and_removed,_from_the_index
  Scenario: A preview directory on disk outside the cone is read and removed via the index
    Given a sparse checkout with a rewritten preview "b" and an empty leftover "branches/c" on disk outside the cone
    When the previews are read and the checkout is rotated with a budget of 4000
    Then the previews and the plan equal the full checkout's
    And "branches/c" no longer exists on disk
    And after staging both checkouts write the same tree, with nothing under "branches/c" in the index

  @test:scripts/tests/sdlc/gh-pages-sparse.test.ts::staging-rotate_—_the_same_plan,_and_the_same_commit,_on_a_sparse_checkout::the_preview_being_staged_outside_the_cone_is_refused,_before_anything_is_written
  Scenario: Staging a preview outside the cone is refused before anything is written
    Given a sparse checkout whose cone is for "cur" and a new "index.html" written to preview "a"
    When it is rotated with "a" as the current preview
    Then it throws "outside the sparse checkout's cone"
    And "branches/a/index.html" still reads "new"
    And no staged-at stamp was written for "a"

  @test:scripts/tests/sdlc/gh-pages-sparse.test.ts::staging-rotate_—_the_same_plan,_and_the_same_commit,_on_a_sparse_checkout::a_preview_NEW_to_gh-pages,_outside_the_cone,_is_refused_too,_before_anything_is_written
  Scenario: Staging a preview new to gh-pages outside the cone is refused before anything is written
    Given a sparse checkout whose cone is for "cur" and a new preview "brand-new" on disk
    When it is rotated with "brand-new" as the current preview
    Then it throws "outside the sparse checkout's cone"
    And no staged-at stamp was written for "brand-new"
    And the index is unchanged

  @test:scripts/tests/sdlc/gh-pages-sparse.test.ts::staging-rotate_—_the_same_plan,_and_the_same_commit,_on_a_sparse_checkout::a_blob_fetch_that_fails_stops_the_rotation_before_any_removal
  Scenario: A failed blob fetch stops the rotation before any removal
    Given a sparse checkout whose origin URL points nowhere
    When it is rotated with a budget of 4000
    Then it throws "could not fetch"
    And the index is unchanged
    And the render log holds only its one unchanged file
    And "branches/_retired" holds only "old.json"

  @test:scripts/tests/sdlc/gh-pages-sparse.test.ts::staging-rotate_—_the_same_plan,_and_the_same_commit,_on_a_sparse_checkout::the_size_record's_digest_is_injective_and_its_file_count_is_checked
  Scenario: The size record's digest is injective and a wrong file count is not trusted
    Given one file whose path holds a newline and the two files that path would once have been confused with
    Then their size digests differ
    Given an origin where preview "a"'s size record claims one more file than it has
    When preview "a" is read from a sparse checkout
    Then it equals the reading from a full checkout
    And the blob of "branches/a/big.bin" was fetched

  @test:scripts/tests/sdlc/gh-pages-sparse.test.ts::staging-push-gate_and_render-log_—_nothing_they_read_is_outside_the_cone::the_tip_is_the_same
  Scenario: The push gate reads the same tip from a sparse checkout
    Given an origin whose tip is "staging(a): from b" committed at "2026-10-02T11:00:00Z"
    When the tip is read from a full and from a sparse checkout
    Then both give that subject and commit time

  @test:scripts/tests/sdlc/gh-pages-sparse.test.ts::staging-push-gate_and_render-log_—_nothing_they_read_is_outside_the_cone::the_render_log_is_appended_to_the_same_file
  Scenario: The render log entry is appended to the same file
    Given a full and a sparse checkout and one "rendered" entry for preview "s1"
    When the entry is appended in each
    Then both return the same file
    And "_render-log/2026-10-02.jsonl" has the same contents in both

  @test:scripts/tests/sdlc/gh-pages-sparse.test.ts::staging-changes_—_the_publish_root_from_its_tree_is_the_root_from_a_checkout::the_same_diff,_provenance_and_build_stamp
  Scenario: The publish root measured from its tree matches the root measured from a checkout
    Given a tree-only clone and a full clone of the publish root, and a staged site
    When the root is measured from the tree
    Then the diff, provenance index and build stamp equal those from the full checkout
    And the build stamp is sha "base1"
    And the changes are "a.html" changed, "based.css" changed, "build.json" removed, "new.svg" added, "old.png" changed and "ref/one.html" removed

  @test:scripts/tests/sdlc/gh-pages-sparse.test.ts::staging-changes_—_the_publish_root_from_its_tree_is_the_root_from_a_checkout::binary_files_and_unchanged_text_are_compared_by_blob_id,_never_fetched
  Scenario: Binary files and unchanged text are compared by blob id without being fetched
    Given a tree-only clone measured against the staged site
    Then the blobs of "logo.png", "old.png", "same.css" and "branches/other/a.html" are still absent
    And the blob of "based.css", which the base fold would change, was fetched

  @test:scripts/tests/sdlc/gh-pages-sparse.test.ts::staging-changes_—_the_publish_root_from_its_tree_is_the_root_from_a_checkout::the_CLI_writes_the_same_changes.json_from_--before-git_as_from_--before
  Scenario: The CLI writes the same changes.json from a tree as from a checkout
    Given a sources file naming one modified source "m/x.md"
    When staging-changes.ts render runs once with "--before" a full checkout and once with "--before-git" a tree clone
    Then both runs exit 0
    And both write byte-identical changes.json
    And its qa status is "known"
