# scripts/merge-watch.ts (`merge:watch`) reports, per repository, each PR's verdict and flags,
# the runner queue, the latest main push, the owners' idleness and runner-relief candidates.
# Each Scenario names the test that executes it.
Feature: Merge watch readings, flags and runner relief

  @test:scripts/tests/sdlc/merge-watch-readings.test.ts::Q-PIPE-1_table::reads_the_bold_line,_the_details_line_and_a_Markdown_row
  Scenario: The Q-PIPE-1 new-failure count is read from the bold line, the details line and a Markdown row
    Given the texts "**New failures: 0** · fixed by this PR: 1", "New failures (fail this check): 3" and "| New failures | 2 |"
    When the new-failure counts are read from each
    Then they are 0, 3 and 2

  @test:scripts/tests/sdlc/merge-watch-readings.test.ts::Q-PIPE-1_table::a_judge's_name_or_prose_is_not_a_table
  Scenario: A judge's name or prose is not a new-failure table
    Given the text "Tests (no new failures)" followed by "No new failures against main's record"
    When the new-failure counts are read
    Then there are none

  @test:scripts/tests/sdlc/merge-watch-readings.test.ts::reading_2:_the_runner_queue::counts_queued_and_in-progress_runs,_by_event,_with_the_oldest_queued_age
  Scenario: The runner queue counts queued and in-progress runs by event, with the oldest queued age
    Given a queued pull_request run 70 minutes old, a queued push run, an in-progress pull_request run and a waiting workflow_dispatch run
    When the queue is read
    Then 3 are queued and 1 is in progress, the oldest queued 70 minutes ago
    And pull_request has 1 queued and 1 in progress, push 1 queued, workflow_dispatch 1 queued

  @test:scripts/tests/sdlc/merge-watch-readings.test.ts::reading_2:_the_runner_queue::an_empty_queue_has_no_oldest_age
  Scenario: An empty runner queue has no oldest age
    Given no runs
    When the queue is read
    Then the oldest queued age is null

  @test:scripts/tests/sdlc/merge-watch-readings.test.ts::reading_3:_the_latest_main_push::judges_only_the_newest_SHA,_each_workflow's_latest_run
  Scenario: The latest main push judges only the newest SHA and each workflow's latest run
    Given a failed run on an old SHA, and on the newest SHA a failed then a successful run of one workflow and a successful run of another
    When the main reading is taken
    Then it is SHA "new", verdict "green"

  @test:scripts/tests/sdlc/merge-watch-readings.test.ts::reading_3:_the_latest_main_push::red_names_the_failed_workflow;_a_running_one_is_pending
  Scenario: A red main push names the failed workflow, and a running one is pending
    Given one main push run named "Main QA"
    When the main reading is taken with that run failed, and again with it in progress
    Then the failed run gives "red: Main QA"
    And the running one gives "pending: Main QA"

  @test:scripts/tests/sdlc/merge-watch-readings.test.ts::reading_4:_the_owners::the_later_of_the_owner's_last_push_and_last_comment;_others'_comments_do_not_count
  Scenario: An owner's idleness runs from the later of their last push and last comment
    Given owner alice with pushes 300 and 200 minutes ago, her comment 90 minutes ago and a bot comment 1 minute ago
    When the owner reading is taken with a 2-hour stale limit
    Then the last push is 200 minutes ago and the last comment 90 minutes ago
    And she is idle 1 hour and not stale

  @test:scripts/tests/sdlc/merge-watch-readings.test.ts::reading_4:_the_owners::two_hours_of_silence_is_stale
  Scenario: Two hours of an owner's silence is stale
    Given owner alice whose only push was 130 minutes ago and who has no comments
    When the owner reading is taken with a 2-hour stale limit
    Then she is stale

  @test:scripts/tests/sdlc/merge-watch-readings.test.ts::per-PR_flags::a_workflow_change_is_a_direct_merge,_even_on_folio-assistant
  Scenario: A workflow change is a direct merge, even on folio-assistant
    Given a folio-assistant PR changing ".github/workflows/x.yml"
    When its flags are read
    Then the only flag is "direct-merge (.github/workflows)"

  @test:scripts/tests/sdlc/merge-watch-readings.test.ts::per-PR_flags::folio-assistant_without_a_workflow_change_takes_the_merge-train_path
  Scenario: folio-assistant without a workflow change takes the merge-train path
    Given a folio-assistant PR changing "src/a.ts"
    When its flags are read
    Then the only flag is "merge-train"
    And the same change on litlfred/cat-harness has no flags

  @test:scripts/tests/sdlc/merge-watch-readings.test.ts::per-PR_flags::a_pin_change_to_an_excluded_layer_needs_owner_consent
  Scenario: A pin change to an excluded layer needs owner consent
    Given a cat-harness PR moving the smart-base pin
    When its flags are read with the default excluded layers
    Then the flag is "owner-consent (pins smart-base)"
    And with only "other" excluded there are no flags
    And with "smart-base" excluded the flag is "owner-consent (pins smart-base)"
    And a pin move of an instance named "smartish" raises no flag

  @test:scripts/tests/sdlc/merge-watch-readings.test.ts::per-PR_flags::pin_changes_are_the_instances_whose_SHA_moved
  Scenario: Pin changes are the instances whose SHA moved
    Given base pins a@1 and b@1 and head pins a@1, b@2 and c@9
    When the pin changes are computed
    Then they are b from 1 to 2 and c new at 9

  @test:scripts/tests/sdlc/merge-watch-readings.test.ts::per-PR_flags::superseded:_every_pin_is_an_ancestor_of_another_PR's_pin,_and_one_moved_further
  Scenario: A PR is superseded when every pin is an ancestor of another PR's pin and one moved further
    Given PR 1 pinning a at 3
    When another PR pins a at 5 and b at 1, PR 1 is superseded by PR 2
    Then another PR with the same pin, an older pin, or only another layer's pin does not supersede it
    And an ancestry that cannot be read never supersedes

  @test:scripts/tests/sdlc/merge-watch-readings.test.ts::many_repositories::--repo,_--repos_and_--config_combine,_without_duplicates
  Scenario: --repo, --repos and --config combine without duplicates
    Given the arguments --repo o/a, --repos "o/b, o/a", --config c.json and --json, with c.json listing o/c and options
    When the arguments are parsed
    Then the repos are o/a, o/b and o/c, json is on, and the options are staleHours 4, queuedMinutes 30 and excludedLayers x

  @test:scripts/tests/sdlc/merge-watch-readings.test.ts::many_repositories::--exclude-layer_replaces_the_default;_a_bad_repo_or_flag_is_a_usage_error
  Scenario: --exclude-layer replaces the default, and a bad repo or flag is a usage error
    Given the arguments --repo o/a and --exclude-layer y
    When they are parsed
    Then the excluded layers are only "y"
    And --repo nope throws "not owner/name"
    And --frobnicate throws "unknown flag"
    And --stale-hours x throws "needs a number"

  @test:scripts/tests/sdlc/merge-watch-readings.test.ts::watchRepo_over_the_stub::reading_1_with_the_every-judge_verdict_and_the_flags
  Scenario: The repository report gives each PR's every-judge verdict and flags
    Given a stubbed folio-assistant with three open PRs: two moving the smart-base pin, one also changing a workflow, and a draft
    When the repository is watched with smart-base excluded
    Then PR 1 is green with merge-train, owner-consent (pins smart-base) and superseded by #2
    And PR 2 is red on "bun test (head, 1/1)" with 4 new failures, flagged direct-merge and owner-consent
    And PR 3 is a draft flagged merge-train

  @test:scripts/tests/sdlc/merge-watch-readings.test.ts::watchRepo_over_the_stub::readings_2–4_and_relief
  Scenario: The repository report gives the main, queue and owner readings and the relief candidates
    Given the same stubbed folio-assistant
    When the repository is watched
    Then main is SHA "m", green
    And the queue has 1 queued, 0 in progress, the oldest 80 minutes
    And only PR 2's owner is stale
    And the one relief candidate is run 950, "draft PR #3"
    And there are no errors

  @test:scripts/tests/sdlc/merge-watch-readings.test.ts::watchRepo_over_the_stub::a_draft's_logs_are_never_read
  Scenario: A draft PR's job logs are never read
    Given the same stubbed folio-assistant, watched
    When the paths asked of the API are listed
    Then none of them is under "/jobs/3"

  @test:scripts/tests/sdlc/merge-watch-readings.test.ts::watchRepo_over_the_stub::the_text_report_names_every_reading
  Scenario: The text report names every reading
    Given the watched folio-assistant report
    When it is formatted as text
    Then it contains the repo heading, "main\tm\tgreen", "queue\tqueued 1", "#2\tready", "STALE" and "relief\trun 950"

  @test:scripts/tests/sdlc/merge-watch-readings.test.ts::watchRepo_over_the_stub::an_unreadable_repository_is_reported,_never_red
  Scenario: An unreadable repository is reported as unknown, never red
    Given a GitHub API that answers 404 for every path
    When repository o/x is watched
    Then the main verdict is "unknown: main push runs not read"
    And the queue is null
    And at least one error is reported

  @test:scripts/tests/sdlc/merge-watch-readings.test.ts::runner_relief::draft,_P3,_closed-PR_and_never-started_runs;_never_a_main_push_or_dynamic_run,_never_the_canceller
  Scenario: Runner relief takes draft, P3, closed-PR and never-started runs, never main's runs or the canceller
    Given a draft PR #1, a P3 PR #2 and a ready PR #3
    And eleven runs, including main push runs, a "dynamic" run on main, a completed run and the canceller of a closed PR
    When relief candidates are chosen with a 60-minute queue limit
    Then they are run 1 "draft PR #1", run 2 "P3 PR #2", run 3 "closed PR (closed-branch)", run 4 "queued 90m, never started" and run 9 "queued 75m, never started"
    And no other run is a candidate

  @test:scripts/tests/sdlc/merge-watch-readings.test.ts::pagination_never_follows_GitHub's_Link_header::asks_by_page=_on_the_given_path,_and_stops_at_a_short_page
  Scenario: Pagination asks by page= on the given path and stops at a short page
    Given a reader that returns two items per page, and one item for page 3
    When "repos/o/r/pulls/1/commits?per_page=2" is paginated
    Then pages 1, 2 and 3 of that path are asked for, in order
    And three pages are returned
    And no request goes to a "repositories/" path

  @test:scripts/tests/sdlc/merge-watch-readings.test.ts::pagination_never_follows_GitHub's_Link_header::a_wrapped_page_is_measured_by_its_array_field
  Scenario: A wrapped page is measured by its array field
    Given a reader whose page wraps one check run in an object with "total_count"
    When "repos/o/r/commits/s/check-runs?per_page=100" is paginated
    Then only page 1 is asked for

  @test:scripts/tests/sdlc/merge-watch-readings.test.ts::exit_2_says_why::names_each_repository_and_what_of_it_was_not_read
  Scenario: The unread summary names each repository and what of it was not read
    # Gap: only one repository is summarised, and the exit code itself is not checked
    Given a watch of "o/x" over a stub that answers nothing
    When the unread summary is made
    Then its line starts with "o/x: " and mentions "runner queue" and "main verdict"
    And a report with no errors, a queue reading and a green main verdict gives no line

  @test:scripts/tests/sdlc/merge-watch-readings.test.ts::the_labelled_queue_(--queue)::the_queue_labels_are_ready-to-merge_and_needs-repin,_read_in_that_order
  Scenario: The queue labels are ready-to-merge and needs-repin, in that order
    Given the labels "needs-repin", "bug" and "ready-to-merge"
    When the queue labels among them are read
    Then they are "ready-to-merge" then "needs-repin"
    And "bug" alone puts a PR in no queue

  @test:scripts/tests/sdlc/merge-watch-readings.test.ts::the_labelled_queue_(--queue)::lists_only_labelled_open_PRs,_oldest_first,_with_the_verdict_on_each_head_and_needs-repin_flagged
  Scenario: The queue lists only labelled open PRs, oldest first, with each head's verdict and needs-repin flagged
    Given open PRs #9 (needs-repin and ready-to-merge, green), #4 (ready-to-merge, green), #5 (unlabelled) and #7 (needs-repin, a shard in progress)
    When the queue is read
    Then it lists #4 green, #7 pending and flagged needs-repin, and #9 green and flagged needs-repin
    And #5's head is never read

  @test:scripts/tests/sdlc/merge-watch-readings.test.ts::the_labelled_queue_(--queue)::the_text_form_names_repo#n,_the_head,_the_verdict_and_NEEDS-REPIN;_the_JSON_form_carries_the_same_rows
  Scenario: The queue's text form and JSON form carry the same rows
    Given the queue of #4, #7 and #9
    When it is printed as text
    Then the first line is repo#4, its head, "green", no flag and its title
    And #7's line says "NEEDS-REPIN"
    When it is printed as JSON
    Then the rows are #4, #7 and #9 with their heads and needs-repin flags

  @test:scripts/tests/sdlc/merge-watch-readings.test.ts::the_labelled_queue_(--queue)::an_empty_queue_says_so;_an_unread_repository_or_head_is_unknown_and_named_for_exit_2,_never_red
  Scenario: An empty queue says so, and an unread repository or head is unknown, never red
    Given a repository with no labelled PR, one whose PR list cannot be read and one whose labelled PR's head cannot be read
    When the queue is read
    Then the empty one prints "queue empty: no open PR labelled ready-to-merge or needs-repin"
    And the unreadable list and the unjudged head are named for exit 2
    And the unjudged head's verdict is "unknown"

  @test:scripts/tests/sdlc/merge-watch-readings.test.ts::the_labelled_queue_(--queue)::--queue_is_a_flag_of_the_CLI,_beside_--json
  Scenario: --queue is a CLI flag beside --json
    Given the arguments "--queue --repo o/a --json"
    When they are parsed
    Then queue and json are both set
    And without "--queue" queue is not set
