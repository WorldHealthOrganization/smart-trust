# scripts/merge-request-check.ts (`merge:request:check`) checks a six-line merge request
# against the PR as it is now: its head, its state and its Staging preview comment.
# Each Scenario names the test that executes it.
Feature: Merge request check against the live PR

  @test:scripts/tests/sdlc/merge-request-check.test.ts::the_Staging_preview_comment::the_latest_one_wins;_its_Commit_and_slug_are_read
  Scenario: The latest Staging preview comment wins, and its Commit and slug are read
    Given two Staging preview comments, for commit 3441735 and an hour older for 89668b7
    When the Staging preview is read from them
    Then it is commit "3441735", slug "claude-fix-nav", live
    And a comment without a "Staging preview" heading yields no preview
    And a "**Commit:** 3441735d" line under a "Staging preview" heading is read as commit "3441735d"

  @test:scripts/tests/sdlc/merge-request-check.test.ts::the_real_folio-assistant_comment_(#2985)::its_short_Commit,_slug_and_live_status_are_read
  Scenario: The real folio-assistant comment's short Commit, slug and live status are read
    Given the pinned Staging preview comment from folio-assistant#2985
    When the Staging preview is read from it
    Then it is commit "c1fbb65", slug "ccr-cce3e36b-lgh7fe", live

  @test:scripts/tests/sdlc/merge-request-check.test.ts::the_real_folio-assistant_comment_(#2985)::a_request_for_its_head_and_URL_(or_a_page_under_it)_is_ok
  Scenario: A request for the real comment's head and its URL, or a page under it, is ok
    Given an open PR whose head starts c1fbb65 and whose only comment is the pinned folio-assistant#2985 one
    When a request naming that head is checked with the branch preview URL, and again with its "changes/" page
    Then each check is ok with no notes

  @test:scripts/tests/sdlc/merge-request-check.test.ts::the_real_folio-assistant_comment_(#2985)::staged_and_queued_is_not_rendered_yet
  Scenario: A preview that is staged with its Pages build queued is not live yet
    Given the pinned comment with its Status changed to "staged — Pages build queued"
    When the Staging preview is read from it
    Then it is not live
    And a request against a PR carrying that comment is reported as "staged, not live yet"

  @test:scripts/tests/sdlc/merge-request-check.test.ts::merge:request:check::ok:_current_head,_preview_built_for_it
  Scenario: A request for the current head with a preview built for it is ok
    Given an open PR at the current head with a Staging preview for commit 3441735
    When a well-formed request for that head is checked
    Then the verdict is ok with no notes

  @test:scripts/tests/sdlc/merge-request-check.test.ts::merge:request:check::refused:_a_malformed_request_names_what_is_wrong
  Scenario: A malformed request is refused, naming what is wrong
    Given an open PR at the current head
    When a request naming the short sha "3441735" as its head is checked
    Then the verdict is refused
    And the report names "headSha"

  @test:scripts/tests/sdlc/merge-request-check.test.ts::merge:request:check::refused:_the_head_moved_since_the_request
  Scenario: A request is refused when the head moved since it was made
    Given an open PR whose head is newer than the request's sha
    When the request is checked
    Then the verdict is refused
    And the report says "head moved"

  @test:scripts/tests/sdlc/merge-request-check.test.ts::merge:request:check::refused:_the_preview_was_built_for_an_older_commit
  Scenario: A request is refused when the preview was built for an older commit
    Given an open PR at the current head whose Staging preview is for commit 89668b7
    When the request is checked
    Then the report says "preview built for 89668b7"

  @test:scripts/tests/sdlc/merge-request-check.test.ts::merge:request:check::refused:_no_Staging_preview_comment,_or_a_URL_of_the_wrong_form_or_slug
  Scenario: A request is refused with no Staging preview comment, or a preview URL of the wrong form or slug
    Given an open PR at the current head
    When the request is checked with no Staging preview comment
    Then the report says there is no "Staging preview" comment
    And a preview of "https://example.org/x" is reported as not of the form https://litlfred.github.io/folio-assistant/branches/<slug>/
    And a preview under branch slug "other" is reported as not the built slug "claude-fix-nav"

  @test:scripts/tests/sdlc/merge-request-check.test.ts::merge:request:check::refused:_the_PR_is_closed
  Scenario: A request for a closed PR is refused
    Given a closed PR with a Staging preview for its head
    When the request is checked
    Then the report says "the PR is closed"

  @test:scripts/tests/sdlc/merge-request-check.test.ts::merge:request:check::no_preview_needs_no_build;_another_repo's_preview_is_noted,_not_refused
  Scenario: A request with no preview needs no build, and another repo's preview is only noted
    Given an open PR with no Staging preview comment
    When a request with "no preview: a script change" is checked
    Then the verdict is ok with no notes
    And a request on litlfred/cat-harness-tools with a preview URL is ok with the note that the repo has no build record to check

  @test:scripts/tests/sdlc/merge-request-check.test.ts::merge:request:check::unknown,_never_refused,_when_the_PR_cannot_be_read
  Scenario: The verdict is unknown, never refused, when the PR cannot be read
    Given a GitHub API that answers 404 for every path
    When the request is checked
    Then the verdict is unknown
