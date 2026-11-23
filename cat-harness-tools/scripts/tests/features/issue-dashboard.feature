# src/issue-watch/dashboard.ts renders the issue-body dashboard: a branch's sync state,
# the requests, and the fields it cannot compute named as not determined, spliced
# between markers in the issue body. Each Scenario names the test that executes it.
Feature: The issue-body dashboard

  @test:scripts/tests/issue-dashboard.test.ts::syncState::no_commits_ahead_of_base_is_synchronized
  Scenario: No commits ahead of base is synchronized
    Given a head sha and 0 commits ahead
    When the sync state is computed
    Then it is "synchronized"

  @test:scripts/tests/issue-dashboard.test.ts::syncState::staging_at_the_branch_head_is_ready_for_review
  Scenario: Staging at the branch head is ready for review
    Given a staging sha equal to the head sha and 3 commits ahead
    When the sync state is computed
    Then it is "ready-for-review"

  @test:scripts/tests/issue-dashboard.test.ts::syncState::staging_behind_the_branch_head_is_dirty
  Scenario: Staging behind the branch head is dirty
    Given a staging sha different from the head sha and 3 commits ahead
    When the sync state is computed
    Then it is "dirty"

  @test:scripts/tests/issue-dashboard.test.ts::syncState::an_unknown_staging_sha_is_NOT_reported_as_dirty
  Scenario: An unknown staging sha is not reported as dirty
    Given a head sha, 2 commits ahead and no staging sha
    When the sync state is computed
    Then it is "not-determined"

  @test:scripts/tests/issue-dashboard.test.ts::syncState::an_unreadable_head_declines_rather_than_guessing
  Scenario: An unreadable head declines rather than guessing
    Given no head sha at all
    When the sync state is computed
    Then it is "not-determined"

  @test:scripts/tests/issue-dashboard.test.ts::stagingHeadFromMergeSha::resolves_the_merge_commit's_second_parent,_not_the_merge_commit
  Scenario: The staging head is the merge commit's second parent, not the merge commit
    Given merge commit "dbf361c" whose second parent resolves to "d645772"
    When the staging head is derived from the merge sha
    Then it is "d645772"
    And with head "d645772" and that staging head the sync state is "ready-for-review"

  @test:scripts/tests/issue-dashboard.test.ts::stagingHeadFromMergeSha::an_unfetchable_merge_ref_yields_undefined,_which_declines_rather_than_claiming_stale
  Scenario: An unfetchable merge ref yields undefined, which declines rather than claiming stale
    Given a merge sha whose parent cannot be resolved
    When the staging head is derived
    Then it is undefined
    And the sync state with that staging head is "not-determined"

  @test:scripts/tests/issue-dashboard.test.ts::renderDashboard::names_the_undetermined_fields_instead_of_omitting_them
  Scenario: The undetermined fields are named instead of omitted
    Given a dashboard input with one request and two related issues
    When the dashboard is rendered
    Then it contains "Not determined", "Level of effort" and "stalled"

  @test:scripts/tests/issue-dashboard.test.ts::renderDashboard::never_prints_an_effort_number
  Scenario: The dashboard never prints an effort number
    Given the same dashboard input
    When the dashboard is rendered
    Then it has no number followed by hours, days, weeks or "% complete"

  @test:scripts/tests/issue-dashboard.test.ts::renderDashboard::links_related_issues_and_carries_the_markers
  Scenario: Related issues are linked and the markers are present
    Given a dashboard input for repo "o/r" related to issue 197
    When the dashboard is rendered
    Then it contains "https://github.com/o/r/issues/197"
    And it contains the folio:dashboard begin and end markers

  @test:scripts/tests/issue-dashboard.test.ts::spliceDashboard::appends_when_no_dashboard_is_present,_preserving_the_body
  Scenario: With no dashboard present the block is appended, keeping the body
    Given the body "Author's original text."
    When a dashboard block holding "NEW" is spliced in
    Then the result holds the original text and "NEW"

  @test:scripts/tests/issue-dashboard.test.ts::spliceDashboard::replaces_in_place_on_a_second_run,_without_duplicating
  Scenario: A second run replaces the dashboard in place without duplicating it
    Given a body with a dashboard already spliced in
    When a block holding "NEWER" is spliced again
    Then the result holds "NEWER" and no longer the old "NEW" line
    And it holds exactly one begin marker

  @test:scripts/tests/issue-dashboard.test.ts::spliceDashboard::text_OUTSIDE_the_markers_is_never_touched
  Scenario: Text outside the markers is never touched
    Given an author's intro, a dashboard block and a trailing note
    When a new block is spliced in
    Then the intro and the trailing note are both still present
