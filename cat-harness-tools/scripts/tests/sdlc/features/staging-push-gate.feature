# scripts/staging-push-gate.ts rate-limits staging pushes to gh-pages: it waits out
# the Pages build of the last push, longer after a main-site publish, and writes the
# PR comment with push and live-by times. Each Scenario names the test that executes it.
Feature: The staging push gate

  @test:scripts/tests/sdlc/staging-push-gate.test.ts::the_window::windows_are_longer_than_a_measured_Pages_build_(≤_3m40s_on_2026-10-03)
  Scenario: Both windows are longer than a measured Pages build
    Then the staging window is longer than 3 minutes 40 seconds
    And the main window is longer than the staging window

  @test:scripts/tests/sdlc/staging-push-gate.test.ts::the_window::a_staging_tip_younger_than_the_staging_window_holds_the_push
  Scenario: A staging tip younger than the staging window holds the push
    Given a gh-pages tip committed 2 minutes ago with subject "staging(foo): from abc"
    When the gate decides
    Then the tip kind is "staging"
    And the window is not open
    And it opens one staging window after the tip's commit time

  @test:scripts/tests/sdlc/staging-push-gate.test.ts::the_window::and_opens_once_it_is_older
  Scenario: A staging tip as old as the staging window opens the gate
    Given a staging tip committed exactly one staging window ago
    When the gate decides
    Then the window is open

  @test:scripts/tests/sdlc/staging-push-gate.test.ts::the_window::a_main-site_publish_gets_the_wider_window
  Scenario: A main-site publish holds the push for the wider main window
    Given a tip committed 7 minutes ago with subject "docs(gh-pages): site from 0123abcd"
    When the gate decides
    Then the tip kind is "other"
    And the window is not open
    And it opens one main window after the tip's commit time

  @test:scripts/tests/sdlc/staging-push-gate.test.ts::the_window::ANY_non-staging_publisher_is_protected,_not_just_docs-site
  Scenario: Every non-staging publisher is treated as "other"
    Then a "staging(cleanup): …" subject is of kind "staging"
    And a "deploy: 0123abc" subject is of kind "other"
    And an empty subject is of kind "other"

  @test:scripts/tests/sdlc/staging-push-gate.test.ts::the_window::a_tip_from_the_future_(clock_skew)_waits_a_full_window,_never_opens_early
  Scenario: A tip from the future waits a full window from now
    Given a staging tip committed 30 minutes in the future
    When the gate decides
    Then the window is not open
    And it opens one staging window from now

  @test:scripts/tests/sdlc/staging-push-gate.test.ts::the_window::waiting_past_the_deadline_is_EXPIRED_—_the_job_fails_rather_than_pushes
  Scenario: Waiting past the deadline is expired rather than pushed
    Given a staging tip committed 1 minute ago
    When the push was queued the maximum wait ago
    Then the decision is expired
    And when queued one minute less than the maximum wait it is not expired
    And an open window is never expired, even after ten maximum waits

  @test:scripts/tests/sdlc/staging-push-gate.test.ts::the_estimate_a_reviewer_is_given::push_at_the_window,_live_a_build_later
  Scenario: The estimate pushes at the window and is live a build later
    Given a staging tip committed 1 minute ago
    When the live time is estimated
    Then the push time is one staging window after the tip
    And the live-by time is the push time plus the live-after-push delay

  @test:scripts/tests/sdlc/staging-push-gate.test.ts::the_estimate_a_reviewer_is_given::an_open_window_pushes_now
  Scenario: An open window is estimated to push now
    Given a tip committed 60 minutes ago
    When the live time is estimated
    Then the push time is now

  @test:scripts/tests/sdlc/staging-push-gate.test.ts::the_PR_comment::queued:_says_staged,_gives_the_push_and_live_times,_and_the_marker
  Scenario: A queued comment says staged and gives push and live times
    Given a queued staging comment for owner "o", repo "r", slug "my-branch" and a staging tip 1 minute old
    When the comment body is built
    Then it starts with the comment marker
    And it links "https://o.github.io/r/branches/my-branch/"
    And it shows the short sha "0123456"
    And it says "staged"
    And it shows the estimated push time and live-by time
    And it references "#1956"

  @test:scripts/tests/sdlc/staging-push-gate.test.ts::the_PR_comment::queued_with_an_unreadable_tip_says_it_could_not_estimate_—_not_a_made-up_time
  Scenario: A queued comment with no readable tip says it could not estimate
    Given a queued staging comment with no tip
    When the comment body is built
    Then it contains "could not be estimated"

  @test:scripts/tests/sdlc/staging-push-gate.test.ts::the_PR_comment::pushed:_gives_the_push_time_and_live-by_time,_never_claims_it_is_live
  Scenario: A pushed comment gives push and live-by times and never says it is live
    Given a pushed staging comment pushed 3 minutes from now
    When the comment body is built
    Then it says "pushed to `gh-pages` at" the push time
    And it shows the push time plus the live-after-push delay
    And it never says "is live"

  @test:scripts/tests/sdlc/staging-push-gate.test.ts::the_pages_to_review_(deep_links,_bean_g4dv)::no_list_computed_is_its_own_state_—_said_plainly,_never_'nothing_changed'
  Scenario: A comment with no page list says so plainly
    Given a pushed comment with no rendered impact
    When the comment body is built
    Then it contains "No page list was computed for this build"
    And it does not say "no rendered page" or "nothing changed"
    And it links the preview root "https://o.github.io/r/branches/s/"

  @test:scripts/tests/sdlc/staging-push-gate.test.ts::the_pages_to_review_(deep_links,_bean_g4dv)::a_changed_page_links_deep_into_the_preview_and_the_same_page_on_main,_per_anchor
  Scenario: A changed page links into the preview and to the same page on main, per anchor
    Given a rendered impact with changed page "a/b.html" and "smart-base/processes/x.html" with anchor "step one"
    When the review section is built
    Then "a/b.html" links to the preview and a "before" link on main
    And the x.html row links both to "#step%20one"
    And it says "**Pages to review:** 2"

  @test:scripts/tests/sdlc/staging-push-gate.test.ts::the_pages_to_review_(deep_links,_bean_g4dv)::a_new_page_has_no_before;_a_removed_page_has_no_preview_link
  Scenario: A new page has no before link and a removed page no preview link
    Given a rendered impact with added "new.html" and removed "gone.html"
    When the review section is built
    Then "new.html" links to the preview marked "(new page)" with no main link
    And "gone.html" is listed as removed with only a "before" link on main

  @test:scripts/tests/sdlc/staging-push-gate.test.ts::the_pages_to_review_(deep_links,_bean_g4dv)::capped_at_20_rows,_with_how_many_more_and_where
  Scenario: The review list is capped at 20 rows, saying how many more and where
    Given a rendered impact with 25 changed pages
    When the review section is built
    Then exactly 20 link rows are listed
    And it says "… and 5 more"
    And it links the preview's "rendered-impact.json"

  @test:scripts/tests/sdlc/staging-push-gate.test.ts::the_pages_to_review_(deep_links,_bean_g4dv)::index_files_are_counted,_not_listed;_undetermined_inputs_are_NOT_KNOWN,_not_absent
  Scenario: Index files are counted not listed, and undetermined inputs are "Not known"
    Given a rendered impact with one index file and an undetermined input "_layouts/default.html" of scope all
    When the review section is built
    Then it says "names no rendered page (and 1 index file(s), not listed)"
    And search-data.json is not linked
    And it contains "**Not known**"
    And it says "`_layouts/default.html` — can change any page"

  @test:scripts/tests/sdlc/staging-push-gate.test.ts::the_pages_to_review_(deep_links,_bean_g4dv)::with_a_list,_the_main-site_root_is_not_presented_as_the_comparison
  Scenario: With a page list, the main-site root is not the comparison
    Given a pushed comment with a rendered impact of changed page "a.html"
    When the comment body is built
    Then it does not contain "to review changes"
    And it shows "**Main site:** https://o.github.io/r/"
    And it has a "before" link to "a.html" on main

  @test:scripts/tests/sdlc/staging-push-gate.test.ts::the_pages_to_review_(deep_links,_bean_g4dv)::pages_come_before_data_files,_so_the_capped_rows_are_the_ones_a_reviewer_reads
  Scenario: Pages are listed before data files
    Given a rendered impact with data file "assets/a.css" and content page "z/page.html"
    When the review section is built
    Then "z/page.html" appears before "assets/a.css"

  @test:scripts/tests/sdlc/staging-push-gate.test.ts::the_pages_to_review_(deep_links,_bean_g4dv)::readImpact:_one_impact_or_an_array;_anything_else_is_undefined
  Scenario: readImpact reads one impact, and anything else is undefined
    # Gap: the array form named in the title is not exercised
    Given a file holding one rendered impact, a file holding "{}", and a missing path
    When each is read as an impact
    Then the first gives a list of one
    And the "{}" file and the missing file give undefined

  @test:scripts/tests/sdlc/staging-push-gate.test.ts::the_pages_to_review_(deep_links,_bean_g4dv)::CLI_--impact_puts_the_deep_links_in_the_body
  Scenario: The CLI's --impact option puts the deep links in the comment
    Given a rendered-impact file with changed page "a/b.html"
    And GITHUB_REPOSITORY "o/r", SLUG "s", BRANCH "b" and SHA in the environment
    When the CLI runs "comment --state pushed --impact" with that file
    Then it exits 0
    And the written body links "a/b.html" in the preview with a "before" link on main

  @test:scripts/tests/sdlc/staging-push-gate.test.ts::reading_the_tip::parses_git's_%ct<TAB>%s
  Scenario: A tip is parsed from git's commit time and subject
    Then "1759478400<TAB>staging(x): from y" parses to that time in milliseconds and that subject
    And an empty string parses to undefined
    And "abc<TAB>x" parses to undefined

  @test:scripts/tests/sdlc/staging-push-gate.test.ts::reading_the_tip::reads_a_real_checkout
  Scenario: The tip is read from a real git checkout
    Given a git repository whose one commit "docs(gh-pages): site from abc" is dated "2026-10-03T07:55:00Z"
    When its tip is read
    Then it gives that commit time and subject

  @test:scripts/tests/sdlc/staging-push-gate.test.ts::reading_the_tip::CLI:_an_old_tip_opens_(exit_0)
  Scenario: The CLI gate opens on an old tip
    Given a git repository whose tip is a staging commit from 2020
    When the CLI runs "gate" on it
    Then it exits 0

  @test:scripts/tests/sdlc/staging-push-gate.test.ts::reading_the_tip::CLI:_an_unreadable_tip_is_exit_2,_never_open
  Scenario: The CLI gate exits 2 on an unreadable tip
    Given an empty directory with no git repository
    When the CLI runs "gate" on it
    Then it exits 2

  @test:scripts/tests/sdlc/staging-push-gate.test.ts::reading_the_tip::CLI:_a_young_tip_past_the_deadline_fails_(exit_1)_without_sleeping
  Scenario: The CLI gate fails a young tip past the deadline without sleeping
    Given a git repository whose tip is a staging commit made now
    When the CLI runs "gate" with a queued-at time past the maximum wait
    Then it exits 1
    And its output says "NOT deployed"
    And the waited exit code is 75

  @test:scripts/tests/sdlc/staging-push-gate.test.ts::reading_the_tip::CLI_comment_writes_the_body_from_the_environment
  Scenario: The CLI writes the comment body from the environment
    Given GITHUB_REPOSITORY "o/r", SLUG "s", BRANCH "b" and SHA in the environment
    When the CLI runs "comment --state pushed" with pushed-at "2026-10-03T08:00:00Z"
    Then it exits 0
    And the written body says "pushed to `gh-pages` at 08:00 UTC"

  @test:scripts/tests/sdlc/staging-push-gate.test.ts::the_stage_job_waits_at_the_gate_before_every_push::gate_after_the_re-read,_before_the_copy_and_the_push;_slept_means_re-read
  Scenario: The stage job gates after the re-read and before the copy and push
    # Gap: checks the workflow text only; the job is not run
    Given the deploy step of feature-staging.yml
    Then the reset to FETCH_HEAD, the gate, the copy into the preview directory and the push all appear
    And they appear in that order
    And a gate exit of 75 continues the loop

  @test:scripts/tests/sdlc/staging-push-gate.test.ts::the_stage_job_waits_at_the_gate_before_every_push::a_race_lost_to_a_moved_tip_goes_back_to_the_gate_without_spending_an_attempt
  Scenario: A race lost to a moved tip goes back to the gate
    # Gap: checks the workflow text only; that no attempt is spent is not checked
    Given the deploy step of feature-staging.yml
    Then a remote tip differing from the base leads to a continue

  @test:scripts/tests/sdlc/staging-push-gate.test.ts::the_stage_job_waits_at_the_gate_before_every_push::both_PR_comments_are_built_by_the_tested_function,_not_inline
  Scenario: Both PR comments are built by the CLI rather than inline
    Given feature-staging.yml
    Then it passes "'--state', 'queued'" and "'--state', 'pushed'"
    And it does not contain the inline heading "## 🔍 Staging preview deployed"
