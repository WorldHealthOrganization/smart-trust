# scripts/keep-shared-payloads.ts: a main deploy keeps a payload blob it drops while an
# older preview that borrows it still stands, recorded in payload/retained.json.
# Each Scenario names the test that executes it.
Feature: Main keeps dropped payloads that previews still borrow

  @test:scripts/tests/sdlc/keep-shared-payloads.test.ts::planKeep::keeps_a_dropped_blob_while_a_preview_staged_before_the_drop_borrows
  Scenario: A dropped blob is kept while a preview staged before the drop borrows it
    Given blobs A and B on the branch being replaced and only B in the new build
    And no prior retained record
    And one sharing preview staged at 2026-10-31T12:00:00Z
    When the keep plan is made at 2026-11-01T00:00:00.000Z
    Then the plan keeps A since 2026-11-01T00:00:00.000Z

  @test:scripts/tests/sdlc/keep-shared-payloads.test.ts::planKeep::drops_it_once_every_borrowing_preview_was_staged_after_the_drop
  Scenario: A kept blob is dropped once every borrowing preview was staged after the drop
    Given blob A kept since 2026-10-31T00:00:00.000Z and absent from the new build
    And the only sharing preview was staged at 2026-10-31T06:00:00Z
    When the keep plan is made
    Then nothing is kept

  @test:scripts/tests/sdlc/keep-shared-payloads.test.ts::planKeep::a_preview_with_no_staging_time_counts_as_older;_no_borrowing_preview_keeps_nothing
  Scenario: A preview with no staging time counts as older, and no borrowing preview keeps nothing
    Given blob A dropped by the new build
    When the keep plan is made with one preview that has no staging time
    Then A is kept
    And when it is made with no sharing previews, nothing is kept

  @test:scripts/tests/sdlc/keep-shared-payloads.test.ts::planKeep::a_blob_the_new_build_writes_again_leaves_the_record
  Scenario: A blob the new build writes again leaves the retained record
    Given blob A in the retained record and written again by the new build
    When the keep plan is made with one preview that has no staging time
    Then nothing is kept

  @test:scripts/tests/sdlc/keep-shared-payloads.test.ts::reading_the_trees::payload_files,_sharing_previews_and_the_retained_record
  Scenario: Payload files, sharing previews and the retained record are read from the site tree
    Given a site with two payload blobs, a retained record keeping A, and previews "one" (shared.json and .staged-at), "two" (no shared.json) and "_retired"
    When the payload files, sharing previews and retained record are read
    Then the payload files are A and "payload/sha256/sub/cc.json", without the retained record
    And the only sharing preview is "one", at its staging time
    And the retained record keeps A since 2026-10-31T00:00:00Z
    And a tree with no record reads as keeping nothing

  @test:scripts/tests/sdlc/keep-shared-payloads.test.ts::reading_the_trees::staging-share_never_lets_a_new_preview_borrow_a_retained_blob
  Scenario: staging-share never lets a new preview borrow a retained blob
    Given a live site holding blobs A and B with A in its retained record
    And a preview holding the same A and B
    When the share is planned
    Then only B is shared

  @test:scripts/tests/sdlc/keep-shared-payloads.test.ts::a_retried_publish_(same_site,_newer_branch)::a_blob_carried_on_the_first_attempt_is_not_read_as_the_build's_own_on_the_second
  Scenario: A blob carried on the first publish attempt is not read as the build's own on the retry
    Given a branch with blobs A and B, a build writing only B, and an old sharing preview
    When the first attempt runs
    Then A is kept
    When the retry runs against a branch that now carries the first attempt's record
    Then A is still kept
    And the site's retained record still dates A from the first attempt

  @test:scripts/tests/sdlc/keep-shared-payloads.test.ts::a_retried_publish_(same_site,_newer_branch)::a_retry_that_keeps_nothing_takes_back_the_first_attempt's_carried_blob_and_record
  Scenario: A retry that keeps nothing takes back the first attempt's carried blob and record
    Given a branch with blob A, a build without it, and an old sharing preview
    When the first attempt runs
    Then A is carried into the site
    When the preview is removed and the retry runs against an empty branch
    Then nothing is kept
    And A and "payload/retained.json" are gone from the site
