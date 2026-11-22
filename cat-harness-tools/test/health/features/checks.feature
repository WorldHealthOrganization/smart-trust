# Specifies the health checks (test/health/checks.ts) and the probe helpers
# they lean on (test/health/probes.ts), each over fixture evidence: a
# healthy context with one field overridden so that the check under test
# fires, stays ok, or goes unknown. Also the report schema and verdict
# (schemas/sdlc/health-report.ts) and the committed branch budgets file.
Feature: Each health check fires on the evidence that breaches it, and is unknown when it could not look

  # ── remote-mounts ──

  @test:test/health/checks.test.ts::remote-mounts_(folio-assistant#2467,_decision_3)::every_declared_instance_mounted_is_ok;_nothing_declared_is_not_applicable
  Scenario: Remote mounts are ok when every instance is mounted or local, not applicable when none are declared, unknown when unread
    Given remote-mount outcomes "a" mounted and "b" local
    When the remote-mount check runs
    Then its state is "ok"
    And with remote mounts "absent" its reason contains "not applicable"
    And with remote mounts "unknown" its state is "unknown"

  @test:test/health/checks.test.ts::remote-mounts_(folio-assistant#2467,_decision_3)::one_not_mounted_is_a_major_finding_whose_action_names_what_a_person_does
  Scenario: Each missing mount is a major finding with an action a person can take
    Given remote-mount outcomes "a" mounted, "b" missing because its directory holds other bytes, and "c" missing for want of consent
    When the remote-mount check runs
    Then its state is "finding" with two "major" findings
    And the first action contains "Move the edits upstream"
    And the second action contains "consent"
    And the measurement "remote-mounts-not-mounted" is 2

  # ── staging-preview-size ──

  @test:test/health/checks.test.ts::staging-preview-size::fires_at_`major`_over_the_owner's_3_GB_budget_—_the_rotation's_own_constant
  Scenario: Nine 350 MiB previews breach the 3 GB budget at major
    Given nine staging previews of 350 MiB each
    When the staging size check runs
    Then its state is "finding" with the single metric "staging-total-bytes" at "major"
    And the summary contains "3.08 GB" and "3.00 GB"
    And the "staging-total-bytes" threshold is the rotation's MAX_PREVIEW_BYTES
    And the action contains "staging:cleanup"

  @test:test/health/checks.test.ts::staging-preview-size::history:_500_MB_of_~37_MB_previews_is_no_longer_a_finding
  Scenario: Fourteen 37 MiB previews are not a finding
    Given fourteen staging previews of 37 MiB each
    When the staging size check runs
    Then its state is "ok"

  @test:test/health/checks.test.ts::staging-preview-size::just_under_the_budget_is_not_a_finding
  Scenario: Eight 350 MiB previews are under the budget
    Given eight staging previews of 350 MiB each
    When the staging size check runs
    Then its state is "ok"

  @test:test/health/checks.test.ts::staging-preview-size::thirteen_concurrent_reviews_is_UNDER_the_threshold_—_the_number_means_a_concurrency
  Scenario: Thirteen 37 MiB previews are under the budget
    Given thirteen staging previews of 37 MiB each
    When the staging size check runs
    Then its state is "ok"

  @test:test/health/checks.test.ts::staging-preview-size::NEVER_escalates_past_`major`,_however_far_over_—_the_split,_bean_`qj9a`
  Scenario: The size check stays at one major finding however far over
    Given nine, and then one hundred, staging previews of 350 MiB each
    When the staging size check runs on each
    Then each state is "finding" with exactly one finding, at "major"
    And no threshold of either result has the severity "critical"

  @test:test/health/checks.test.ts::staging-preview-size::the_size_finding_does_NOT_predict_a_failed_publish_—_bean_`qj9a`
  Scenario: The size finding does not predict a failed publish
    Given one staging preview of 3500 MiB
    When the staging size check runs
    Then its finding is "major"
    And neither its summary nor its action contains "about to be lost" or "the next deploy is the one that fails"
    And if the threshold's basis contains "about to be lost" it also contains "USED TO PREDICT"
    And the summary contains "budget the deploy rotation enforces"
    And the action contains "staging:cleanup"
    And the threshold has a basis

  @test:test/health/checks.test.ts::staging-preview-size::a_branch_that_was_read_and_carries_no_previews_is_a_determined_`ok`
  Scenario: A publish branch with no previews is ok at zero bytes
    Given staging evidence with the branch present and no previews
    When the staging size check runs
    Then its state is "ok"
    And the measurement "staging-total-bytes" is 0

  @test:test/health/checks.test.ts::staging-preview-size::an_unreadable_publish_branch_is_`unknown`_—_never_0_MB_of_previews
  Scenario: Unreadable staging evidence makes the size check unknown with no measurement
    Given staging evidence "unknown" because git ls-remote exited 128
    When the staging size check runs
    Then its state is "unknown" and the reason contains "ls-remote"
    And it has no measurements and no findings

  # ── staging-preview-orphans ──

  @test:test/health/checks.test.ts::staging-preview-orphans::names_the_preview_whose_PR_is_closed,_and_leaves_the_open_one_alone
  Scenario: The preview without an open PR is named; the one with an open PR is not
    Given previews "claude-live" and "claude-merged-last-week", and the open PR head "claude/live"
    When the staging orphan check runs
    Then its state is "finding" with one finding whose summary contains "branches/claude-merged-last-week"
    And the finding is "minor" and its action contains "Ask the owner"

  @test:test/health/checks.test.ts::staging-preview-orphans::never_judges_`STAGING/_retired`,_the_retired-record_store,_as_a_preview
  Scenario: STAGING/_retired is never judged as a preview
    Given previews "_retired" and "claude-live", and the open PR head "claude/live"
    When the staging orphan check runs
    Then its state is "ok" and no finding mentions "_retired"
    And the measurement "staging-orphan-count" is 0 and "staging-live-count" is 1

  @test:test/health/checks.test.ts::staging-preview-orphans::is_`unknown`_when_the_PR_list_could_not_be_fetched,_rather_than_calling_every_preview_an_orphan
  Scenario: An unfetched PR list makes the orphan check unknown
    Given six previews and an open-PR list "unknown" with a 403 reason
    When the staging orphan check runs
    Then its state is "unknown" with no findings
    And the reason contains "403"

  @test:test/health/checks.test.ts::staging-preview-orphans::slugifies_the_branch_the_way_feature-staging.yml_does,_and_only_forwards
  Scenario: Branch names slugify as the staging workflow does
    When "claude/health-checks", "feat/a//b" and "-lead-and-trail-" are slugified
    Then they give "claude-health-checks", "feat-a-b" and "lead-and-trail"
    And "claude/a-b" and "claude-a-b" give the same slug

  # ── staging-preview-orphans — liveness ──

  @test:test/health/checks.test.ts::staging-preview-orphans_—_liveness::each_signal,_firing_on_its_own::`open-pr`_spares_a_preview_whose_branch_is_merged_and_long_idle
  Scenario: An open PR alone keeps a preview live
    Given the preview "claude-live" with the open PR head "claude/live", its branch merged and last committed 2026-08-01
    When its liveness is judged at 2026-09-19T12:00Z
    Then the slug is "claude-live" and the live signals are exactly "open-pr"

  @test:test/health/checks.test.ts::staging-preview-orphans_—_liveness::each_signal,_firing_on_its_own::`unmerged-branch`_spares_a_preview_with_no_PR_whose_branch_carries_work_not_in_`main`
  Scenario: An unmerged branch alone keeps a preview live
    Given the preview "claude-carries-work" with no open PR, its branch not merged and last committed three days before
    When its liveness is judged
    Then the live signals are exactly "unmerged-branch"

  @test:test/health/checks.test.ts::staging-preview-orphans_—_liveness::each_signal,_firing_on_its_own::`recent-commit`_spares_a_preview_in_the_gap_between_one_PR_merging_and_the_next_—_the_window_nothing_else_covers
  Scenario: A recent commit alone keeps a preview live
    Given the preview "claude-between-prs" with no open PR, its branch merged and last committed five minutes before
    When its liveness is judged
    Then the live signals are exactly "recent-commit"

  @test:test/health/checks.test.ts::staging-preview-orphans_—_liveness::each_signal,_firing_on_its_own::stops_sparing_on_recency_one_minute_past_the_horizon,_and_the_horizon_is_the_declared_threshold
  Scenario: Recency spares up to the horizon and not one minute past it
    Given a merged branch with no open PR
    When its liveness is judged with its last commit RECENT_COMMIT_MINUTES - 1, RECENT_COMMIT_MINUTES and RECENT_COMMIT_MINUTES + 1 minutes ago
    Then the first two are live by "recent-commit" and the third has no live signal
    And the "preview-branch-idle-minutes" orphan threshold is RECENT_COMMIT_MINUTES, in "minutes", with a basis containing "NO EXTERNAL STANDARD"

  @test:test/health/checks.test.ts::staging-preview-orphans_—_liveness::each_signal,_firing_on_its_own::a_tip_dated_in_the_future_reads_as_recent,_because_clock_skew_must_not_convict
  Scenario: A branch tip dated in the future reads as recent
    Given a merged branch with no open PR whose last commit is 30 minutes after now
    When its liveness is judged
    Then the live signals are exactly "recent-commit"

  @test:test/health/checks.test.ts::staging-preview-orphans_—_liveness::does_NOT_report_the_`claude-brave-hypatia-r820sf`_shape_—_the_regression_this_was_rewritten_for
  Scenario: An unmerged, recently committed branch with no open PR is not an orphan
    Given the preview "claude-brave-hypatia-r820sf" with no open PR, its branch not merged and committed two minutes before
    When the staging orphan check runs
    Then its state is "ok" with no findings, and no finding mentions "brave-hypatia"
    And the measurement "staging-orphan-count" is 0 and "staging-live-count" is 1
    And its liveness has no "open-pr" and nothing undetermined
    And its live signals are exactly "unmerged-branch" and "recent-commit"

  @test:test/health/checks.test.ts::staging-preview-orphans_—_liveness::STILL_reports_a_genuinely_dead_preview_—_merged,_no_PR,_long_idle
  Scenario: A merged, idle preview with no PR is reported with its evidence
    Given the preview "claude-merged-last-week" with no open PR, its branch merged and last committed 2026-09-08
    When the staging orphan check runs
    Then its state is "finding" with one finding whose summary contains "branches/claude-merged-last-week"
    And the summary contains "no open pull request", "already in `main`" and "11 days"
    And the measurement "staging-orphan-count" is 1

  @test:test/health/checks.test.ts::staging-preview-orphans_—_liveness::reports_a_preview_no_branch_on_the_remote_answers_for_—_a_determined_empty_is_not_a_blind_spot
  Scenario: A preview no remote branch slugifies to is reported
    Given the preview "claude-branch-gone" with no open PR and a listed remote with no candidate branches
    When the staging orphan check runs
    Then its state is "finding"
    And the summary contains "branches/claude-branch-gone" and "no branch on the remote slugifies to it"

  @test:test/health/checks.test.ts::staging-preview-orphans_—_liveness::names_the_remedy_a_person_can_actually_invoke,_since_the_label_alone_cannot_reach_a_closed_PR
  Scenario: The orphan action names the cleanup workflow inputs
    Given the preview "claude-branch-gone" with no open PR and no candidate branches
    When the staging orphan check runs
    Then the action contains "staging:cleanup", "cleanup_slug: claude-branch-gone", "cleanup_confirm: claude-branch-gone" and "Leaving it is a valid answer"
    And the action does not contain "rm -rf"

  @test:test/health/checks.test.ts::staging-preview-orphans_—_liveness::a_signal_that_cannot_be_evaluated::sends_that_preview_to_`unknown`,_never_to_the_orphan_list
  Scenario: A preview whose merge state could not be evaluated is unknown
    Given the preview "claude-unreadable" with no open PR, its branch unevaluated with "bad object"
    When the staging orphan check runs
    Then its state is "unknown" with no findings
    And the reason contains "branches/claude-unreadable" and "bad object"

  @test:test/health/checks.test.ts::staging-preview-orphans_—_liveness::a_signal_that_cannot_be_evaluated::takes_the_WHOLE_check_to_`unknown`,_and_still_names_the_orphan_it_had_determined
  Scenario: One unevaluated preview makes the whole check unknown, naming the determined orphan
    Given the unevaluated preview "claude-unreadable" and the preview "claude-clearly-dead" with no branch
    When the staging orphan check runs
    Then its state is "unknown" with no findings
    And the reason contains "branches/claude-clearly-dead" and "Determined but NOT reported"

  @test:test/health/checks.test.ts::staging-preview-orphans_—_liveness::a_signal_that_cannot_be_evaluated::does_not_blind_a_preview_another_signal_has_already_spared
  Scenario: An open PR spares a preview whose merge state could not be evaluated
    Given the preview "claude-unreadable" with the open PR head "claude/unreadable", its branch unevaluated
    When its liveness is judged
    Then the live signals are exactly "open-pr" and nothing is undetermined

  @test:test/health/checks.test.ts::staging-preview-orphans_—_liveness::a_signal_that_cannot_be_evaluated::is_`unknown`_when_the_branches_could_not_be_listed_at_all,_rather_than_calling_every_preview_an_orphan
  Scenario: Unlisted branches make the orphan check unknown
    Given six previews, no open PRs, and branch evidence "unknown" because git ls-remote exited 128
    When the staging orphan check runs
    Then its state is "unknown" with no findings
    And the reason contains "ls-remote" and "w2g5"

  # ── repository-size ──

  @test:test/health/checks.test.ts::repository-size::fires_`minor`_past_the_250_MB_early-warning_point
  Scenario: Tracked bytes past the warning point are a minor finding
    Given tracked bytes of TRACKED_WARN_BYTES plus 1 MiB and a 300 MiB git directory
    When the repository size check runs
    Then the findings are exactly "tracked-tree-bytes", at "minor"

  @test:test/health/checks.test.ts::repository-size::fires_`major`_past_GitHub's_documented_1_GB_recommendation
  Scenario: Tracked bytes past the major point are a major finding
    Given tracked bytes of TRACKED_MAJOR_BYTES plus 1 MiB
    When the repository size check runs
    Then the "tracked-tree-bytes" finding is "major"

  @test:test/health/checks.test.ts::repository-size::fires_on_the_history-to-tree_ratio_—_this_repository's_own_shape_on_2026-09-19
  Scenario: A 12x history-to-tree ratio is a finding that points to git gc
    Given a 349 MiB git directory over 29 MiB of tracked bytes in 42 packs
    When the repository size check runs
    Then the findings are exactly "git-dir-to-tree-ratio"
    And the summary contains "12.0x" and the action contains "git gc"

  @test:test/health/checks.test.ts::repository-size::does_not_fire_the_ratio_on_a_small_clone,_however_lopsided
  Scenario: A small lopsided clone is not a finding
    Given a 2 MiB git directory over 0.1 MiB of tracked bytes
    When the repository size check runs
    Then its state is "ok"

  @test:test/health/checks.test.ts::repository-size::is_`unknown`_when_git_could_not_be_asked
  Scenario: Unreadable repository size makes the check unknown with no measurement
    Given repository-size evidence "unknown" because git count-objects exited 128
    When the repository size check runs
    Then its state is "unknown" with no measurements

  # ── bean-rendered-decision-records ──

  @test:test/health/checks.test.ts::bean-rendered-decision-records::an_`##_Options`_heading_is_NOT_a_rendered_decision
  Scenario: An options heading with a numbered list is not a rendered decision
    Given "## Options" followed by two numbered bold options
    When it is checked for a rendered decision
    Then it is not one

  @test:test/health/checks.test.ts::bean-rendered-decision-records::all_five_rows_are_required_—_four_is_not_a_rendered_decision
  Scenario: A table with four of the five decision rows is not a rendered decision
    Given table rows "What it does", "Pro", "Con" and "Downstream" without "Reversibility"
    When it is checked for a rendered decision
    Then it is not one

  @test:test/health/checks.test.ts::bean-rendered-decision-records::the_table_`renderDecision`_emits_is_recognised
  Scenario: The full rendered decision table is recognised
    Given the text renderDecision produces for a two-option decision "a" (recommended) or "b"
    When it is checked for a rendered decision
    Then it is one

  # ── bean-store: session-log roots ──

  @test:test/health/checks.test.ts::bean-store::bean-session-log-roots::flags_an_open_Session/Handoff_epic_or_milestone
  Scenario: Open Session and Handoff epics and milestones are flagged
    Given open beans "Session: …" (milestone), "SESSION 3 - …" (epic), "Handoff: …" (epic) and "Handover — Q4" (milestone)
    When the bean store check runs
    Then the "bean-session-log-roots" findings name s1, s2, h1 and h2, all "minor"
    And the first action contains "never `beans delete`"
    And the measurement "bean-session-log-roots" is 4

  @test:test/health/checks.test.ts::bean-store::bean-session-log-roots::does_not_flag_a_session-titled_TASK,_a_closed_log,_a_mid-title_'session',_or_an_untyped_bean
  Scenario: Session-titled tasks, closed logs, mid-title "session" and untyped beans are not flagged
    Given a "Session:" task, a completed and a scrapped "Session:" root, an epic with "session" mid-title, and an untyped "Session:" bean
    When the bean store check runs
    Then no finding has the metric "bean-session-log-roots"
    And the measurement "bean-session-log-roots" is 0

  @test:test/health/checks.test.ts::bean-store::bean-session-log-roots::sessionLogRootBeans_is_the_same_answer_the_check_gives
  Scenario: sessionLogRootBeans picks out the session-log root
    Given a "Session: x" epic s1 and a "QA: verdicts" epic e1
    When sessionLogRootBeans is asked
    Then it returns exactly s1
    When the bean store check runs over the same beans
    Then the bean ids its "bean-session-log-roots" findings name are exactly the ones sessionLogRootBeans returns

  # ── bean-store: quiet claims and their children ──

  @test:test/health/checks.test.ts::bean-store::a_claim_whose_CHILD_moved_is_not_reported_quiet
  Scenario: An in-progress parent whose child moved recently is not quiet
    Given an in-progress bean last updated 120 hours ago, with an in-progress child updated 6 hours ago
    When the bean store check runs
    Then no finding has the metric "bean-quiet-claims"

  @test:test/health/checks.test.ts::bean-store::...but_it_is_still_COUNTED_—_`dh4f`
  Scenario: An excused parent is still counted
    Given an in-progress bean last updated 120 hours ago, with an in-progress child updated 6 hours ago
    When the bean store check runs
    Then the measurement "bean-quiet-claims-parenting-live-work" is 1
    And the measurement "bean-quiet-claims" is 0

  @test:test/health/checks.test.ts::bean-store::a_parent_whose_children_are_ALL_quiet_still_fires_—_the_discrimination
  Scenario: A parent whose only child is also quiet still fires
    Given an in-progress bean and its in-progress child, both last updated 120 hours ago
    When the bean store check runs
    Then there are two "bean-quiet-claims" findings

  @test:test/health/checks.test.ts::bean-store::a_CHILDLESS_quiet_claim_is_untouched_by_any_of_this
  Scenario: A childless quiet claim fires as before
    Given one childless in-progress bean last updated 120 hours ago
    When the bean store check runs
    Then the findings are exactly "bean-quiet-claims"
    And the measurement "bean-quiet-claims-parenting-live-work" is 0

  @test:test/health/checks.test.ts::bean-store::keyed_on_PARENTHOOD,_not_on_`type:_epic`
  Scenario: A parent with no type is excused by its moving child
    Given an untyped in-progress bean last updated 120 hours ago, with a todo child updated 6 hours ago
    When the bean store check runs
    Then no finding has the metric "bean-quiet-claims"

  @test:test/health/checks.test.ts::bean-store::the_ORPHAN_action_does_not_offer_the_label,_because_it_cannot_reach_an_orphan
  Scenario: The orphan action names the dispatch inputs and says the label does not work
    Given the preview "gone-branch" with no open PR and no candidate branches
    When the staging orphan check runs
    Then there is at least one finding
    And its action contains "workflow_dispatch", "cleanup_slug: gone-branch" and "cleanup_confirm: gone-branch"
    And its action says the label "DOES NOT WORK" or "does not work", and contains "w2g5"
    And "staging:cleanup" is named exactly once, as "`staging:cleanup` LABEL DOES NOT WORK", after "workflow_dispatch"
    And the action never tells the reader to apply or add a label

  # ── bean-store: duplicate titles ──

  @test:test/health/checks.test.ts::bean-store::fires_`major`_on_a_duplicate_title_—_the_14,688-duplicate_shape,_at_its_leading_edge
  Scenario: Two beans whose titles differ only in case are a major duplicate
    Given beans aaaa "Drain the exposition swarm", bbbb "drain the exposition swarm" and cccc "Something else"
    When the bean store check runs
    Then the findings are exactly "bean-duplicate-title-groups", at "major"
    And the summary contains "aaaa, bbbb"
    And the action contains "scrapped" and "Never `beans delete`"

  @test:test/health/checks.test.ts::bean-store::STOPS_firing_once_the_loser_is_`scrapped`_—_the_action_is_the_remedy
  Scenario: Scrapping the duplicate clears the finding
    Given beans aaaa and bbbb with the same title, bbbb "scrapped"
    When the bean store check runs
    Then there are no findings

  @test:test/health/checks.test.ts::bean-store::but_an_adjudicated_group_is_still_COUNTED_—_`dh4f`
  Scenario: An adjudicated duplicate group is still counted
    Given beans aaaa and bbbb with the same title, bbbb "scrapped", and cccc with another title
    When the bean store check runs
    Then the measurement "bean-duplicate-title-groups-adjudicated" is 1
    And the measurement "bean-duplicate-title-groups" is 0

  @test:test/health/checks.test.ts::bean-store::`completed`_is_NOT_adjudication_—_an_open_bean_duplicating_finished_work_still_fires
  Scenario: A completed duplicate does not adjudicate the group
    Given beans aaaa "completed" and bbbb open, with the same title
    When the bean store check runs
    Then the findings are exactly "bean-duplicate-title-groups"

  @test:test/health/checks.test.ts::bean-store::a_HALF-adjudicated_group_fires_on_what_is_left,_and_says_the_rest_was_settled
  Scenario: A partly scrapped group fires on the open beans and counts the scrapped one
    Given beans aaaa, bbbb and cccc with the same title, cccc "scrapped"
    When the bean store check runs
    Then the findings are exactly "bean-duplicate-title-groups"
    And the summary contains "aaaa, bbbb", not "cccc", and contains "1 more already `scrapped`"

  # ── bean-store: decision records ──

  @test:test/health/checks.test.ts::bean-store::fires_on_a_decision_record_listing_ONE_option_—_MADR's_refusal,_made_checkable
  Scenario: A decision record with one considered option is a minor finding
    Given bean aaaa with 1 considered option and bean bbbb with no options section
    When the bean store check runs
    Then the findings are exactly "bean-thin-decision-records", at "minor"
    And the summary contains "one option"
    And the action contains "WHY NO ALTERNATIVE EXISTED" and "Never invent a straw option"

  @test:test/health/checks.test.ts::bean-store::an_options_section_with_NO_items_reads_differently_from_one_with_a_single_option
  Scenario: An options section with no items has its own summary and action
    Given bean aaaa with 0 considered options
    When the bean store check runs
    Then the first finding's summary contains "no options"
    And its action contains "or drop the section"

  @test:test/health/checks.test.ts::bean-store::a_bean_with_no_options_section_is_NOT_a_malformed_decision_record
  Scenario: Beans with no options section are not decision records
    Given beans aaaa and bbbb with no considered-options count
    When the bean store check runs
    Then there are no findings
    And the measurement "bean-decision-records" is 0

  @test:test/health/checks.test.ts::bean-store::the_SUBJECT_COUNT_is_reported,_so_a_detector_that_stops_matching_is_not_green
  Scenario: The number of decision records is reported
    Given beans with 3 and 2 considered options and one with none
    When the bean store check runs
    Then there are no findings
    And the measurement "bean-decision-records" is 2 and "bean-thin-decision-records" is 0

  # ── bean-store: a claim its own criteria say is finished ──

  @test:test/health/checks.test.ts::bean-store::a_claim_its_own_criteria_say_is_finished_—_`fkjo`::fires_`minor`_on_an_in-progress_bean_with_every_Done-when_box_ticked
  Scenario: An in-progress bean with every Done-when box ticked is a finding
    Given an in-progress bean "done" with 4 of 4 boxes ticked and an in-progress bean "open" with 3 of 4
    When the bean store check runs
    Then the findings are exactly "bean-self-declared-done"
    And the finding's severity is "minor"
    And the summary contains "all 4 of its Done-when boxes ticked"
    And the action contains "RE-DERIVE"

  @test:test/health/checks.test.ts::bean-store::a_claim_its_own_criteria_say_is_finished_—_`fkjo`::a_ticked_claim_touched_inside_the_window_is_mid-flight:_counted,_not_a_finding
  Scenario: A ticked claim updated 10 hours ago is counted as mid-flight, not reported
    Given an in-progress bean with all 3 boxes ticked, updated 10 hours before the clock
    When the bean store check runs
    Then there are no findings
    And the measurement "bean-self-declared-done" is 0 and "bean-self-declared-done-mid-flight" is 1

  @test:test/health/checks.test.ts::bean-store::a_claim_its_own_criteria_say_is_finished_—_`fkjo`::a_ticked_parent_with_an_OPEN_child_is_not_done_at_any_age_—_the_`5a3l`_case
  Scenario: A ticked parent with an open child is not reported
    Given an in-progress bean with all boxes ticked, updated 500 hours ago, with a todo child
    When the bean store check runs
    Then no finding has the metric "bean-self-declared-done"
    And the measurement "bean-self-declared-done-open-children" is 1

  @test:test/health/checks.test.ts::bean-store::a_claim_its_own_criteria_say_is_finished_—_`fkjo`::the_same_parent_with_only_CLOSED_children,_past_the_window,_IS_a_finding_—_the_discrimination
  Scenario: A ticked parent whose only child is completed is reported
    Given an in-progress bean with all boxes ticked, updated 500 hours ago, with a completed child
    When the bean store check runs
    Then a finding has the metric "bean-self-declared-done"
    And its summary contains "no open child" and its action contains "you MAY act on it"

  @test:test/health/checks.test.ts::bean-store::a_claim_its_own_criteria_say_is_finished_—_`fkjo`::says_nothing_about_a_bean_that_is_ticked_but_NOT_claimed
  Scenario: A completed bean with every box ticked is not reported
    Given a completed bean with all boxes ticked
    When the bean store check runs
    Then there are no findings

  @test:test/health/checks.test.ts::bean-store::a_claim_its_own_criteria_say_is_finished_—_`fkjo`::counts,_and_never_reports,_the_two_states_it_cannot_judge
  Scenario: Absent and unreadable criteria are counted, not reported
    Given an in-progress bean with Done-when "absent" and one with Done-when "unreadable"
    When the bean store check runs
    Then there are no findings
    And the measurements "bean-claimed-criteria-absent" and "bean-claimed-criteria-unreadable" are 1 each
    And "bean-self-declared-done" is 0

  @test:test/health/checks.test.ts::bean-store::a_claim_its_own_criteria_say_is_finished_—_`fkjo`::reports_the_denominator,_so_a_detector_that_stops_matching_is_visible
  Scenario: The number of claims with readable criteria is reported
    Given two in-progress beans with no Done-when state
    When the bean store check runs
    Then there are no findings
    And the measurement "bean-claimed-with-criteria" is 0 and "bean-claimed" is 2

  # ── bean-store: staleness, size and the unreadable store ──

  @test:test/health/checks.test.ts::bean-store::fires_`minor`_on_a_claim_nobody_has_honoured_for_a_fortnight
  Scenario: An in-progress bean untouched since August is stale
    Given an in-progress bean "stale" updated 2026-08-01 and one "fresh" updated 2026-09-18
    When the bean store check runs
    Then the findings are exactly "bean-stale-in-progress"
    And the finding's severity is "minor"
    And the summary contains "`stale`" and "49 days"

  @test:test/health/checks.test.ts::bean-store::an_`in-progress`_bean_with_no_timestamp_is_not_reported_as_stale
  Scenario: An in-progress bean with no timestamp is not stale
    Given one in-progress bean with no updated time
    When the bean store check runs
    Then its state is "ok"

  @test:test/health/checks.test.ts::bean-store::fires_on_resolved_beans_still_inline,_and_the_action_MOVES_rather_than_deletes
  Scenario: Too many completed beans inline is a finding whose action archives them
    Given BEAN_RESOLVED_INLINE_LIMIT + 1 completed beans
    When the bean store check runs
    Then the findings are exactly "bean-resolved-inline"
    And the action contains "beans archive" and "MOVES"

  @test:test/health/checks.test.ts::bean-store::fires_on_an_open_backlog_past_the_calibration_point
  Scenario: An open backlog past the limit is a finding
    Given BEAN_OPEN_LIMIT + 1 todo beans
    When the bean store check runs
    Then the findings are exactly "bean-open"

  @test:test/health/checks.test.ts::bean-store::is_`unknown`_when_the_store_could_not_be_read
  Scenario: An unreadable bean store makes the check unknown
    Given bean evidence "unknown" because beans/beans.json could not be read
    When the bean store check runs
    Then its state is "unknown"

  # ── todo-store ──

  @test:test/health/checks.test.ts::todo-store::fires_on_a_todo_left_open_for_a_quarter
  Scenario: A todo open since January is a finding for its owner
    Given one open todo created 2026-01-01
    When the todo store check runs
    Then the findings are exactly "todo-stale-days"
    And the action contains "only they"

  @test:test/health/checks.test.ts::todo-store::fires_on_too_many_open_todos,_and_does_not_count_the_closed_ones
  Scenario: Twenty-six open todos are a finding; fifty done ones are not counted
    Given 26 open todos and 50 done todos
    When the todo store check runs
    Then the findings are exactly "todo-open"
    And the measurement "todo-open" is 26

  @test:test/health/checks.test.ts::todo-store::an_empty_todo_store_is_a_determined_`ok`,_unlike_an_empty_bean_store
  Scenario: An empty todo store is ok
    Given a todo store read with no todos
    When the todo store check runs
    Then its state is "ok"
    Given a fixture repository declaring both a todo store and a bean store, each directory empty
    When both stores are probed and their checks run
    Then the todo probe is "ok" with no todos and the todo store check is "ok"
    And the bean probe is "unknown" and the bean store check is "unknown"

  # ── the registry and the report ──

  @test:test/health/checks.test.ts::the_registry_and_the_report::every_registered_id_has_a_check_that_answers_to_it
  Scenario: Running the checks yields one result per registered id
    Given the healthy context
    When every health check runs
    Then the result ids, sorted, equal the registered HEALTH_CHECKS ids, sorted

  @test:test/health/checks.test.ts::the_registry_and_the_report::every_threshold_states_its_basis
  Scenario: Every threshold carries a basis of its own, in prose
    Given the healthy context
    When every health check runs
    Then every threshold of every result has a basis longer than 40 characters
    And each basis holds at least five words of letters once its digits are removed
    And no basis text is shared by thresholds of two different metrics

  @test:test/health/checks.test.ts::the_registry_and_the_report::every_finding_names_something_a_person_does
  Scenario: Every finding carries an action longer than 20 characters
    Given the healthy context with six orphaned previews and a 12x history-to-tree ratio
    When every health check runs
    Then there is at least one finding
    And every finding's action is longer than 20 characters

  @test:test/health/checks.test.ts::the_registry_and_the_report::one_`unknown`_takes_the_whole_verdict_to_unknown,_even_beside_findings
  Scenario: Unknown outranks findings, and findings outrank clean
    When the verdict is taken over states ok, finding and unknown
    Then it is "unknown"
    And over ok and finding it is "findings"
    And over ok alone it is "clean"

  @test:test/health/checks.test.ts::the_registry_and_the_report::the_schema_refuses_a_report_that_claims_ok_while_holding_findings
  Scenario: The report schema refuses an ok check that holds findings
    Given a report with verdict "clean" and one check in state "ok" holding a minor finding
    When it is parsed with the health report schema
    Then it is refused with "false pass"

  @test:test/health/checks.test.ts::the_registry_and_the_report::the_schema_refuses_an_`unknown`_that_does_not_say_what_it_could_not_determine
  Scenario: The report schema refuses an unknown check with no reason
    Given a report with verdict "unknown" and one check in state "unknown" with no reason
    When it is parsed with the health report schema
    Then it is refused with "gives no reason"

  @test:test/health/checks.test.ts::the_registry_and_the_report::the_schema_refuses_a_stored_verdict_that_disagrees_with_its_own_checks
  Scenario: The report schema refuses a verdict that disagrees with its checks
    Given a report with verdict "clean" and one check in state "finding" holding a major finding
    When it is parsed with the health report schema
    Then it is refused with "disagrees with the checks"

  @test:test/health/checks.test.ts::the_registry_and_the_report::the_schema_refuses_a_sweep_with_no_checks_in_it_at_all
  Scenario: The report schema refuses a report with no checks
    Given a report with verdict "clean" and an empty checks list
    When it is parsed with the health report schema
    Then it is refused

  @test:test/health/checks.test.ts::the_registry_and_the_report::formats_bytes_the_way_the_report_reads_them
  Scenario: Bytes are formatted in MB and GB
    When 222 MiB and 2 GiB are formatted
    Then they read "222.0 MB" and "2.00 GB"

  # ── pages-publish-health ──

  @test:test/health/checks.test.ts::pages-publish-health_—_reads_the_CI_observation,_bean_`1dre`::a_fresh_observation_of_served_pages_is_`ok`,_and_counts_as_the_one_instrument
  Scenario: A fresh observation of one served URL is ok
    Given a pages-serving observation from 6 hours before the clock with one URL at status 200 that is the expected page
    When the pages publish health check runs
    Then its state is "ok"
    And the measurements "pages-serving-instruments" and "pages-serving-urls" are 1 each

  @test:test/health/checks.test.ts::pages-publish-health_—_reads_the_CI_observation,_bean_`1dre`::MISSING_is_`unknown`,_with_the_store's_reason_—_never_zero,_never_clean_(owner's_option_1)
  Scenario: A missing observation is unknown with the store's reason
    Given pages-serving evidence "unknown" with the reason "… miss: nothing under health"
    When the pages publish health check runs
    Then its state is "unknown"
    And the reason contains "miss: nothing under health"

  @test:test/health/checks.test.ts::pages-publish-health_—_reads_the_CI_observation,_bean_`1dre`::OLD_is_`unknown`,_and_says_its_date_—_an_observation_past_the_horizon_is_not_one
  Scenario: An observation past the horizon is unknown and gives its date
    Given a pages-serving observation made 2026-09-01T06:00:00Z
    When the pages publish health check runs
    Then its state is "unknown"
    And the reason contains "2026-09-01T06:00:00Z" and the PAGES_OBSERVATION_HORIZON_DAYS value followed by "-day horizon"

  @test:test/health/checks.test.ts::pages-publish-health_—_reads_the_CI_observation,_bean_`1dre`::the_horizon_is_inclusive:_exactly_a_week_old_still_counts
  Scenario: An observation exactly seven days old is still ok
    Given a pages-serving observation made 2026-09-12T12:00:00Z, seven days before the clock
    When the pages publish health check runs
    Then its state is "ok"

  @test:test/health/checks.test.ts::pages-publish-health_—_reads_the_CI_observation,_bean_`1dre`::FALSIFICATION:_Pages'_own_404_is_a_finding_even_when_the_status_were_200
  Scenario: A URL answered with status 200 but not the expected page is a finding
    Given a pages-serving observation of the site root, the expected page, and a STAGING URL at status 200 that is not the expected page
    When the pages publish health check runs
    Then its state is "finding" with one finding whose summary contains "Pages' own 404"
    And the measurement "pages-serving-failing" is 1

  @test:test/health/checks.test.ts::pages-publish-health_—_reads_the_CI_observation,_bean_`1dre`::FALSIFICATION:_a_non-200_is_a_finding,_and_the_action_names_a_person,_not_a_deletion
  Scenario: A URL answered with 503 is a major finding
    Given a pages-serving observation of the site root at status 503
    When the pages publish health check runs
    Then the first finding is "major" and its summary contains "HTTP 503"
    And its action contains "deletion-requires-confirmation"

  @test:test/health/checks.test.ts::pages-publish-health_—_reads_the_CI_observation,_bean_`1dre`::its_thresholds_refuse_`critical`,_and_the_basis_still_says_enforcement_is_unknown
  Scenario: The pages thresholds have no critical severity and say enforcement is unknown
    Given the healthy context
    When the pages publish health check runs
    Then no threshold has the severity "critical"
    And the "pages-serving-instruments" threshold's basis contains "REMAINS UNKNOWN"

  @test:test/health/checks.test.ts::pages-publish-health_—_reads_the_CI_observation,_bean_`1dre`::is_registered,_so_it_actually_runs
  Scenario: The pages check is registered
    When the registered HEALTH_CHECKS ids are listed
    Then they include "pages-publish-health"

  # ── probePagesServing ──

  @test:test/health/checks.test.ts::probePagesServing_—_offline,_through_the_qa-store_reader::asks_for_THIS_commit's_entry_under_health/
  Scenario: The pages probe asks the store for this commit's health entry
    Given a HEAD commit and a store reader that records what it is asked
    When the pages-serving probe runs
    Then the reader was asked for "main/" followed by HEAD, under the prefix "health"

  @test:test/health/checks.test.ts::probePagesServing_—_offline,_through_the_qa-store_reader::reads_a_valid_observation
  Scenario: A valid stored observation is read
    Given a store hit holding a valid health/pages-serving.json
    When the pages-serving probe runs
    Then its state is "ok"

  @test:test/health/checks.test.ts::probePagesServing_—_offline,_through_the_qa-store_reader::a_store_miss,_an_absent_file,_bad_JSON_and_a_wrong_shape_are_each_`unknown`_with_a_reason
  Scenario: A miss, an absent file, bad JSON and a wrong shape are each unknown with a reason
    Given four store reads: a miss, a hit without pages-serving.json, a hit whose pages-serving.json is "{", and one holding only a $schema
    When the pages-serving probe runs on each
    Then each state is "unknown" with a non-empty reason

  @test:test/health/checks.test.ts::probePagesServing_—_offline,_through_the_qa-store_reader::an_unreadable_HEAD_is_`unknown`,_not_a_guessed_key
  Scenario: An empty HEAD makes the pages probe unknown
    Given an empty HEAD and a store reader that would answer
    When the pages-serving probe runs
    Then its state is "unknown"

  # ── special-branch-size ──

  @test:test/health/checks.test.ts::special-branch-size::fires_per_branch_over_a_`branch`_budget,_naming_the_branch_and_the_owner's_number
  Scenario: A branch over its per-branch budget is named with the owner's number
    Given the beans branch at 120 MiB and the todos branch at 1 MiB, each budgeted "100mb" per branch
    When the special branch size check runs
    Then its state is "finding" with the findings exactly "special-branch-bytes:beans"
    And the summary contains "120.0 MB" and "100mb"
    And the thresholds are "special-branch-bytes:beans" and "special-branch-bytes:todos"

  @test:test/health/checks.test.ts::special-branch-size::measures_a_`family`_budget_in_TOTAL_—_no_single_cache_branch_is_over,_the_family_is
  Scenario: A family budget is measured on the family's total
    Given three build-cache branches of 1.5 GiB each under a "4gb" family budget
    When the special branch size check runs
    Then its state is "finding" with one finding whose summary contains "4.50 GB"

  @test:test/health/checks.test.ts::special-branch-size::a_family_budgeted_PER_BRANCH_fires_on_the_branch_that_is_over,_not_on_the_total
  Scenario: A family budgeted per branch fires only on the branch over it
    Given auto-docs family branches "a" at 900 MiB and "b" at 1100 MiB under a "1gb" per-branch budget
    When the special branch size check runs
    Then the only finding names "cat/cat-harness/auto-docs/b"

  @test:test/health/checks.test.ts::special-branch-size::absent_and_unbudgeted_are_COUNTED_and_named,_never_read_as_within_budget
  Scenario: Absent and unbudgeted branches are counted and named
    Given an absent auto-docs family row and an unbudgeted fsh-guts branch row
    When the special branch size check runs
    Then its state is "ok"
    And the measurement "special-branches-absent" is 1 with a command naming "auto-docs"
    And the measurement "special-branches-unbudgeted" is 1 with a command naming "fsh-guts"

  @test:test/health/checks.test.ts::special-branch-size::a_probe_that_could_not_read_the_remote_is_`unknown`,_never_zero_bytes
  Scenario: An unread remote makes the special branch check unknown
    Given special-branch evidence "unknown" with the reason "ls-remote refused"
    When the special branch size check runs
    Then its state is "unknown" and the reason contains "ls-remote refused"

  @test:test/health/checks.test.ts::special-branch-size::the_committed_budgets_file_budgets_what_the_owner_named,_at_the_owner's_numbers
  Scenario: The committed budgets file holds the owner's budgets
    Given test/health/branch-budgets.json
    When its budgeted rows are read
    Then they are exactly qa-reports 500 MiB per branch, lake-cache 4 GiB per family, beans and todos 100 MiB per branch, and auto-docs 1 GiB per branch

  # ── budget rows named by typology ──

  @test:test/health/checks.test.ts::a_budget_row_named_by_TYPOLOGY_takes_its_family_from_the_declaring_directory::the_declared_storage.branchPrefix_is_the_name,_the_legacy_names_follow
  Scenario: A declared branch prefix becomes the row's name
    Given a repository declaring an auto-docs directory with the branch prefix "cat/x/build-cache/"
    And a budget row for typology "auto-docs" with the legacy name "old-cache/"
    When the declared family prefix is read and the row is resolved against the repository
    Then the prefix is "cat/x/build-cache/"
    And the row has the name "cat/x/build-cache/", the legacy names "old-cache/" and the typology "auto-docs"

  @test:test/health/checks.test.ts::a_budget_row_named_by_TYPOLOGY_takes_its_family_from_the_declaring_directory::with_nothing_declared,_the_legacy_names_are_what_is_measured_—_never_a_name_the_file_spells_for_a_layer_above
  Scenario: With no declared prefix, the first legacy name becomes the row's name
    Given a repository declaring an auto-docs directory with no storage
    And a budget row for typology "auto-docs" with the legacy name "old-cache/"
    When the declared family prefix is read and the row is resolved against the repository
    Then the prefix is undefined
    And the row has the name "old-cache/" and no legacy names

  @test:test/health/checks.test.ts::a_budget_row_named_by_TYPOLOGY_takes_its_family_from_the_declaring_directory::the_committed_lake-cache_row_names_its_typology,_not_a_layer
  Scenario: The committed lake-cache row names its typology and falls back to its legacy names
    Given test/health/branch-budgets.json, read with no repository
    When the "lake-cache" row is read
    Then its typology is "lake-cache"
    And its name and legacy names are "cat-lake-cache/" then "lake-cache/"

  # ── membersFor ──

  @test:test/health/checks.test.ts::membersFor_—_the_table's_resolution_rule::prefers_the_new_name,_falls_back_to_the_first_legacy_name_present
  Scenario: A branch row resolves to its new name, else its legacy name
    Given a branch row "cat/cat-harness/qa-reports" with the legacy name "qa-reports"
    When its members are found on a remote holding both names
    Then it resolves to "cat/cat-harness/qa-reports"
    And on a remote holding only "qa-reports" it resolves to "qa-reports"

  @test:test/health/checks.test.ts::membersFor_—_the_table's_resolution_rule::a_family_is_every_branch_under_its_prefix,_and_the_prefix_itself_is_not_a_member
  Scenario: A family's members are the branches under its prefix
    Given a family row "cat/x/lake-cache/"
    When its members are found on a remote holding "cat/x/lake-cache/b", "cat/x/lake-cache/a", "cat/x/lake-cachey" and "main"
    Then it resolves to "cat/x/lake-cache/" with the members "cat/x/lake-cache/a" and "cat/x/lake-cache/b"
    When its members are found on a remote holding "cat/x/lake-cache/", "cat/x/lake-cache" and "cat/x/lake-cache/a"
    Then it resolves to "cat/x/lake-cache/" with the single member "cat/x/lake-cache/a"
    When its members are found on a remote holding only "cat/x/lake-cache/" and "cat/x/lake-cache"
    Then there are no members and nothing is resolved

  @test:test/health/checks.test.ts::membersFor_—_the_table's_resolution_rule::nothing_on_the_remote_is_a_determined_absence
  Scenario: A family with no branch on the remote has no members and no resolution
    Given a family row "cat/x/auto-docs/"
    When its members are found on a remote holding only "main"
    Then there are no members and nothing is resolved

  @test:test/health/checks.test.ts::lsi-indexes_(cat-harness#1144:_the_LSI_page's_health_half)::every_needed_index_fresh_is_ok;_another_repository_is_not_applicable;_an_unread_store_is_unknown
  Scenario: The LSI index check is ok when every needed index is fresh, not applicable without evidence, unknown when unread
    Given LSI index evidence where one graph passes and one is not applicable
    When the lsi-indexes check runs
    Then its state is "ok"
    And with no LSI index evidence in the context, its reason says "not applicable"
    And with the store unread, its state is "unknown"

  @test:test/health/checks.test.ts::lsi-indexes_(cat-harness#1144:_the_LSI_page's_health_half)::the_probe_reads_nothing_for_a_repository_that_is_not_the_harness
  Scenario: The LSI index probe reads nothing for a repository that is not the harness
    When the LSI indexes are probed for "/some/other/instance" with the harness at "/the/harness"
    Then the evidence is "absent"

  @test:test/health/checks.test.ts::lsi-indexes_(cat-harness#1144:_the_LSI_page's_health_half)::a_needed_index_that_is_missing_or_stale_is_a_minor_finding_naming_the_command_that_builds_it
  Scenario: A missing or stale LSI index is a minor finding naming the command that builds it
    Given LSI index evidence where graph g0 passes, g1 fails and g2 is not applicable, and g0 has 5 near-duplicate pairs
    When the lsi-indexes check runs
    Then its state is "finding" with one minor finding
    And the finding's action names "bun run cat lsi index --instance inst --graph g1"
    And the "lsi-graphs-needing-index" measurement is 2
    And the "lsi-near-duplicate-pairs:inst/g0" measurement is 5
    And the result parses against the health check result schema

  @test:test/health/checks.test.ts::library-keywords_(cat-harness#1144)::every_entry_with_keywords_and_no_legacy_file_is_ok;_no_probe_is_not_applicable;_an_error_is_unknown
  Scenario: The library keywords check is ok when every entry has keywords and no legacy file, not applicable without evidence, unknown on error
    Given library keywords evidence of two entries with 12 and 3 keywords and no legacy file
    When the library-keywords check runs
    Then its state is "ok"
    And with no library keywords evidence in the context, its reason says "not applicable"
    And with unknown evidence, its state is "unknown"

  @test:test/health/checks.test.ts::library-keywords_(cat-harness#1144)::an_entry_with_no_keywords_and_a_committed_keywords.json_are_separate_minor_findings_naming_the_entries
  Scenario: An entry with no keywords and a committed keywords.json are separate minor findings naming the entries
    Given library keywords evidence where "lib/e0" has keywords, "lib/e1" has none and "lib/e2" has a legacy file
    When the library-keywords check runs
    Then its state is "finding"
    And the findings are "library-keywords-entries-without" then "library-keywords-legacy-files", both minor
    And the first names "lib/e1" and the second names "lib/e2"
    And the result parses against the health check result schema

  @test:test/health/checks.test.ts::library-keywords_(cat-harness#1144)::the_probe:_no_library_is_absent,_a_throw_is_unknown
  Scenario: The library keywords probe reports no library as absent and a throw as unknown
    When the library keywords are probed and the reader finds no libraries
    Then the evidence is "absent"
    When the library keywords are probed and the reader throws
    Then the evidence is "unknown"
