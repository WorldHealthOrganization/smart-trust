# scripts/merge-guard.ts judges whether a PR may merge (base, ready flip, signed ready marker,
# labels, CI, checklist, open questions, mergeability), tested against three real PRs captured as fixtures.
# Each Scenario names the test that executes it.
Feature: Merge guard

  @test:scripts/tests/sdlc/merge-guard.test.ts::the_three_real_cases_are_refused_—_exit_1,_never_0::#%d
  Scenario: Each of the three real merged PRs is refused with exit 1
    Given the captured snapshot of PR #1937, #1957 or #1960, judged as a release merge
    When the guard evaluates it
    Then the verdict is "refused"
    And the exit code is 1

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_1_—_base::#1937:_base_was_#1764's_head_branch_after_#1764_merged,_not_main
  Scenario: #1937's base was a merged PR's head branch, not main
    Given PR #1937's snapshot
    When the "base" check is read
    Then it refuses
    And its detail says "not `main`" and names "#1764"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_1_—_base::a_base_that_is_a_merged_PR's_head_is_refused_even_if_it_were_named_main
  Scenario: A base that is a merged PR's head is refused
    Given PR #1957's snapshot with its base recorded as the head of a merged PR
    When the "base" check is read
    Then it refuses

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_1_—_base::could_not_ask_about_the_base_is_unknown,_not_a_pass
  Scenario: Not being able to ask about the base is unknown, not a pass
    Given PR #1957's snapshot where asking about the base failed with "HTTP 502"
    When the "base" check is read
    Then it is "unknown"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_2_—_ready_for_review::a_draft_is_refused
  Scenario: A draft is refused
    Given PR #1960's snapshot marked as a draft
    When the "ready-for-review" check is read
    Then it refuses

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_2_—_ready_for_review::#1957:_marked_ready_with_nothing_from_its_own_session_beside_it_—_the_steward_did_it
  Scenario: #1957 was marked ready with nothing from its own session beside it
    Given PR #1957's snapshot
    When the "ready-for-review" check is read
    Then it refuses
    And its detail says it "cannot be attributed to the PR's own session"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_2_—_ready_for_review::#1957_with_the_steward's_signed_comment_beside_the_event:_refused_as_the_MERGING_session
  Scenario: A ready flip beside the merging session's signed comment is refused as the merging session
    Given PR #1957 with a steward-signed "Marking ready and labelling." comment a minute after the ready event
    When the "ready-for-review" check is read with the steward as merging session
    Then it refuses
    And its detail names the "MERGING session"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_2_—_ready_for_review::marked_ready_beside_the_PR's_OWN_signed_ready_marker_passes
  Scenario: A ready flip beside the PR's own signed ready marker passes
    Given PR #1957 with a "ready:" marker signed by its own session four seconds after the ready event
    When the "ready-for-review" check is read with the steward as merging session
    Then it passes

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_2_—_ready_for_review::the_merge_manager_landing_its_own_PR:_its_own_session_may_mark_it_ready_and_merge_it
  Scenario: The merge manager landing its own PR may have marked it ready itself
    Given PR #1957 with its own signed "ready:" marker beside the ready event
    When the "ready-for-review" check is read with the PR's own session as merging session
    Then it refuses
    When it is read again with --merge-manager-own-pr
    Then it passes
    And its detail says "the merge manager is landing its own PR"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_2_—_ready_for_review::the_merge_manager's_own_PR_still_refuses_a_ready_flip_nobody_from_the_PR's_own_session_signed
  Scenario: The merge manager's own PR still refuses a ready flip nobody from the PR's session signed
    Given PR #1957 with only a steward-signed comment beside the ready event
    When the "ready-for-review" check is read with --merge-manager-own-pr
    Then it refuses
    And its detail says it "cannot be attributed to the PR's own session"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_2_—_ready_for_review::--merge-manager-own-pr_refuses_when_the_merging_session_is_not_the_PR's_own_session
  Scenario: --merge-manager-own-pr refuses when the merging session is not the PR's own
    Given PR #1957 with its own signed "ready:" marker beside the ready event
    When the "ready-for-review" check is read with --merge-manager-own-pr and the steward as merging session
    Then it refuses as a defect
    And its detail says the merging session "is not this PR's own session"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_2_—_ready_for_review::a_`ready:`_the_merging_session_RELAYS_for_the_PR's_own_session_beside_the_event_is_not_the_merging_session_marking_it_ready
  Scenario: A ready marker the merging session relays for the PR's own session is not it marking the PR ready
    Given PR #1957 with a "Marked ready." comment signed by its own session a minute after the ready event
    And a "ready:" comment signed by the steward four seconds after the event, saying "relayed for" the PR's own session
    When the "ready-for-review" check is read with the steward as merging session
    Then it passes
    When the "relayed for" line is removed
    Then it refuses, naming the "MERGING session"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_2_—_ready_for_review::never_a_draft:_nothing_to_attribute,_passes
  Scenario: A PR that was never a draft passes the ready-for-review check
    Given PR #1960's snapshot
    When the "ready-for-review" check is read
    Then it passes

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_2_—_ready_for_review::steward_ACK_posted_within_seconds_of_another_session's_flip_does_not_steal_attribution_or_refuse_(bean_gdni)
  Scenario: A steward ACK just before the PR session's own marker does not steal attribution
    Given PR #1957 with a steward "Merge queue ACK" two seconds after the ready event
    And the PR's own signed "ready:" marker four seconds after it
    When the "ready-for-review" check is read with the steward as merging session
    Then it passes
    And its detail says it was marked ready by the PR's own session at the event time

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_2_—_ready_for_review::steward_ACK_carrying_HTML_comment_marker_within_seconds_passes
  Scenario: A steward ACK carrying an HTML comment marker within seconds does not refuse
    Given PR #1957 with a steward comment marked "<!-- steward:ack -->" one second after the ready event
    And the PR's own session's "Re-marked ready" comment three seconds after it
    When the "ready-for-review" check is read with the steward as merging session
    Then it passes

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_2_—_ready_for_review::steward_ACK_alone_without_an_owning_session_comment_does_not_attribute_the_flip
  Scenario: A steward ACK alone does not attribute the ready flip
    Given PR #1957 with only a steward "ACK: queued for merge." comment two seconds after the ready event
    When the "ready-for-review" check is read with the steward as merging session
    Then it refuses as "not-ready"
    And its detail says the attribution "does not exist"

  @test:scripts/tests/sdlc/merge-guard.test.ts::isStewardAckComment_and_claimsReadyFlip_(bean_gdni)::isStewardAckComment_recognises_common_steward_notes_and_markers
  Scenario: Steward ACK notes and markers are recognised
    When comment bodies are tested as steward ACKs
    Then "Merge queue ACK", "ACK:", "[ACK]", "Hand-back", "Handed back", "Queue entry", "Queued for next train" and the steward:ack, merge:ack and steward:note markers are ACKs
    And "Marking ready and labelling.", a "ready:" marker, prose mentioning the queue, and no body are not

  @test:scripts/tests/sdlc/merge-guard.test.ts::isStewardAckComment_and_claimsReadyFlip_(bean_gdni)::claimsReadyFlip_recognises_comments_claiming_the_ready_flip
  Scenario: Comments claiming the ready flip are recognised
    When comment bodies are tested as ready-flip claims
    Then a "ready:" marker, "Marking ready", "now marked ready for review", "Re-marked ready" and "Ready-for-review: I converted this PR" are claims
    And "not ready for review yet", a Merge queue ACK, a steward:ack-marked comment, unrelated text and no body are not

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_3_—_the_ready_marker::#1960:_no_`ready:`_comment_at_all,_and_no_label_to_stand_in
  Scenario: #1960 has no ready marker and no label to stand in for one
    Given the snapshot of PR #1960
    When the "ready-marker" check is read
    Then it refuses with detail "no `ready: <sha>` comment"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_3_—_the_ready_marker::#1937:_its_`ready:_e75895610c4`_is_signed_by_no_session
  Scenario: #1937's ready marker is signed by no session
    Given PR #1937's snapshot
    When its ready markers are read
    Then the only one is "e75895610c4" with no session
    And the "ready-marker" check refuses, saying "signed by no session"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_3_—_the_ready_marker::#1937_with_the_marker_signed:_still_refused,_the_head_is_newer_and_the_commits_after_it_are_not_bot_merges
  Scenario: A signed marker is still refused when commits after it are not bot merges
    Given PR #1937 with its "ready: e75895610c4" marker signed by its own session
    When the "ready-marker" check is read
    Then it refuses, saying "not merge-main bot merges"
    And it names the commits "1aaa669f99" and "c4036a79af" but not the bot's merge "ee4151d2cc"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_3_—_the_ready_marker::a_head_newer_than_the_marker_ONLY_by_merge-main_bot_merges_passes
  Scenario: A head newer than the marker only by merge-main bot merges passes
    Given PR #1937 with its marker signed and only the ready commit and the bot's merge kept
    Then the last commit is a bot merge
    And the "ready-marker" check passes

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_3_—_the_ready_marker::a_marker_signed_by_another_session_is_not_this_PR's_marker
  Scenario: A marker signed by another session is not this PR's marker
    Given PR #1960 with a "ready:" marker for its head signed by the steward
    When the "ready-marker" check is read
    Then it refuses and its detail names the steward's session

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_3_—_the_ready_marker::a_quoted_marker_is_not_a_marker
  Scenario: A quoted marker is not a marker
    Given a comment "> ready: abcdef1"
    When ready markers are read
    Then there are none

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_3_—_a_`ready:`_the_merge_manager_relays_for_the_PR's_own_session::relayedFor_reads_an_id_or_a_URL,_and_not_a_quoted_line_or_code
  Scenario: "relayed for" names a session by id or URL, never from a quoted line or code
    Given "relayed for session_01Abc", "Relayed for https://claude.ai/code/session_01Abc", a quoted relay line, a relay line in a code fence and a bare marker
    When the relayed-for session is read from each
    Then the first two give "session_01Abc" and the rest give none

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_3_—_a_`ready:`_the_merge_manager_relays_for_the_PR's_own_session::a_relayed_marker_for_the_PR's_own_session_passes,_signed_by_the_merge_manager
  Scenario: A ready marker the merge manager relays for the PR's own session passes
    Given PR #1960 with a "ready:" on its head signed by the steward and "relayed for" the PR's own session
    When the "ready-marker" check is read
    Then it passes
    And its detail names the relay and the steward that posted it

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_3_—_a_`ready:`_the_merge_manager_relays_for_the_PR's_own_session::a_marker_relayed_for_ANOTHER_session_is_a_defect,_not_this_PR's_marker
  Scenario: A ready marker relayed for another session is a defect
    Given PR #1960 with a "ready:" signed by the steward and "relayed for" another session
    When the "ready-marker" check is read
    Then it refuses as a defect, naming the session it was relayed for

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_3_—_a_`ready:`_the_merge_manager_relays_for_the_PR's_own_session::a_relayed_marker_is_the_point_check_7_measures_questions_from
  Scenario: A relayed ready marker is where check 7 starts looking for open questions
    Given PR #1960 with a relayed "ready:" for its own session
    And a later comment asking the owner a question
    When the "open-question" check is read
    Then it refuses

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_3_—_the_`ready-to-merge`_label_added_after_the_last_push::#1957:_labelled_after_its_last_push,_so_the_label_stands_in_for_the_marker
  Scenario: #1957 was labelled ready-to-merge after its last push, so the label stands in for a marker
    Given PR #1957, with no "ready:" comment, labelled at 11:31:46Z after its last commit at 11:19:32Z
    When the "ready-marker" check is read
    Then it passes
    And its detail says the label was added after the last push of "76244c5e"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_3_—_the_`ready-to-merge`_label_added_after_the_last_push::a_commit_dated_after_the_label_refuses,_and_says_why_the_label_did_not_stand_in
  Scenario: A commit dated after the label keeps the label from standing in
    Given PR #1957 with its last commit re-dated a minute after the label
    When the "ready-marker" check is read
    Then it refuses with "no `ready: <sha>` comment; nor does the label stand in"
    And its detail says the label was "not after the last push"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_3_—_the_`ready-to-merge`_label_added_after_the_last_push::a_workflow_run_on_the_head_that_started_after_the_label_dates_the_push_after_it
  Scenario: A workflow run on the head dates the push
    Given PR #1957 whose head's workflow runs all started 30 seconds after the label
    When the "ready-marker" check is read
    Then it refuses
    When one run is moved to 30 seconds before the label
    Then it passes

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_3_—_the_`ready-to-merge`_label_added_after_the_last_push::a_force-push_after_the_label_refuses
  Scenario: A force-push after the label keeps the label from standing in
    Given PR #1957 with a head_ref_force_pushed event a minute after the label
    When the "ready-marker" check is read
    Then it refuses

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_3_—_the_`ready-to-merge`_label_added_after_the_last_push::the_label_with_no_`labeled`_event_in_the_timeline_refuses
  Scenario: The label with no labeled event in the timeline does not stand in
    Given PR #1957 with its labeled events removed from the timeline
    When the "ready-marker" check is read
    Then it refuses, saying there is "no `labeled ready-to-merge` event"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_3_—_the_`ready-to-merge`_label_added_after_the_last_push::only_merge-main_bot_merges_after_the_label:_still_passes
  Scenario: Only merge-main bot merges after the label still pass
    Given PR #1957 with a merge-main bot merge pushed ten minutes after the label as its head
    When the "ready-marker" check is read
    Then it passes
    And its detail says "the 1 commit(s) after it are merge-main bot merges"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_3_—_the_`ready-to-merge`_label_added_after_the_last_push::a_question_to_the_owner_after_the_label_is_open_(check_7_measures_from_the_label)
  Scenario: Check 7 measures open questions from the label when the label stands in
    Given PR #1957 labelled ready-to-merge, with a question to the owner a minute after the label
    When the "open-question" check is read
    Then it refuses
    When the question is moved to a minute before the label
    Then it passes

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_4_—_labels::#1937:_`needs-merge-human`_was_still_on_it
  Scenario: #1937 still carried needs-merge-human
    Given PR #1937's snapshot
    When the "labels" check is read
    Then it refuses with detail "`needs-merge-human` is present"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_4_—_labels::#1960:_no_`ready-to-merge`
  Scenario: #1960 had no ready-to-merge label
    Given PR #1960's snapshot
    When the "labels" check is read
    Then it refuses with detail "`ready-to-merge` is absent"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_the_head's_own_pull_request_CI::#1937:_its_pull_request_runs_failed;_the_green_dispatches_are_named_and_NOT_counted
  Scenario: #1937's failed pull_request runs refuse, and its green dispatches are named but not counted
    Given PR #1937's snapshot
    When the "ci" check is read
    Then it refuses
    And its detail says "Code-quality gates: failure" and "2 green `workflow_dispatch` run(s)"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_the_head's_own_pull_request_CI::an_in-flight_run_is_not_green
  Scenario: An in-flight run is not green
    Given PR #1957 with its Code-quality gates pull_request run in progress
    When the "ci" check is read
    Then it refuses

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_the_head's_own_pull_request_CI::the_guard's_own_run_is_never_evidence,_either_way
  Scenario: The guard's own run is never evidence
    # Gap: only a failed own run is checked, not a green one
    Given PR #1957 with a failed "Merge guard" pull_request run added
    When the "ci" check is read
    Then it passes

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_the_head's_own_pull_request_CI::a_later_success_supersedes_an_earlier_failure_of_the_same_workflow
  Scenario: A later success supersedes an earlier failure of the same workflow
    Given PR #1937 with a later successful rerun of every pull_request run
    When the "ci" check is read
    Then it passes

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_the_head's_own_pull_request_CI::a_later_all-skipped_run_(a_no-op_`labeled`_run)_never_displaces_an_earlier_verdict
  Scenario: A later all-skipped run never displaces an earlier verdict
    Given PR #1937 with a later skipped run of every pull_request run
    When the "ci" check is read
    Then it refuses, saying "Code-quality gates: failure"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_the_head's_own_pull_request_CI::an_all-skipped_run_stands_when_it_is_the_only_run_of_its_workflow
  Scenario: An all-skipped run stands when it is the only run of its workflow
    Given PR #1957 with a single skipped "Release-only checks" run
    When the "ci" check is read
    Then it passes

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_the_head's_own_pull_request_CI::could_not_read_the_runs_is_unknown_—_and_unknown_outranks_every_refusal:_exit_2
  Scenario: Runs that could not be read are unknown, which outranks every refusal
    Given PR #1937 whose runs could not be read ("HTTP 502")
    When the guard evaluates it
    Then the "ci" check is "unknown"
    And the verdict is "unknown" with exit code 2

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_a_held_run_on_a_bot-merged_head_is_judged_by_its_dispatch::every_pull_request_run_held,_green_dispatches_of_both_gating_workflows_—_passes;_staging_is_not_judged
  Scenario: Held pull_request runs with green dispatches of both gating workflows pass
    Given #1937 recast as a bot-merged head with every pull_request run held at action_required
    When the "ci" check is read
    Then it passes
    And its detail says the head is judged by its green dispatch of Code-quality gates and JSON-LD generated-file drift
    And that Feature Staging is not judged, as preview-only and not dispatched by merge-main

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_a_held_run_on_a_bot-merged_head_is_judged_by_its_dispatch::Feature_Staging_held_and_never_dispatched_does_not_refuse_—_it_is_not_one_merge-main_dispatches
  Scenario: Feature Staging held and never dispatched does not refuse
    Given the bot-merged head with no Feature Staging dispatch run
    When the "ci" check is read
    Then it passes

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_a_held_run_on_a_bot-merged_head_is_judged_by_its_dispatch::a_dispatch_still_in_progress_is_not-ready
  Scenario: A dispatch still in progress is not-ready
    Given the bot-merged head with the Code-quality gates dispatch in progress
    When the "ci" check is read
    Then it refuses as "not-ready"
    And its detail names the dispatch stand-in run 37114602513 as in_progress

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_a_held_run_on_a_bot-merged_head_is_judged_by_its_dispatch::a_red_dispatch_is_a_defect
  Scenario: A red dispatch is a defect
    Given the bot-merged head with the JSON-LD drift dispatch failed
    When the "ci" check is read
    Then it refuses as a "defect", saying "is failure"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_a_held_run_on_a_bot-merged_head_is_judged_by_its_dispatch::no_dispatch_yet_for_code-quality-gates_is_not-ready:_merge-main_still_owes_it
  Scenario: No dispatch yet for code-quality-gates is not-ready
    Given the bot-merged head with no Code-quality gates dispatch
    When the "ci" check is read
    Then it refuses as "not-ready"
    And its detail says the dispatch merge-main owes for "code-quality-gates.yml" has not appeared

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_a_held_run_on_a_bot-merged_head_is_judged_by_its_dispatch::merge-main.yml_unparseable_is_unknown_—_never_a_pass
  Scenario: An unparseable merge-main.yml is unknown, never a pass
    Given the bot-merged head with no Code-quality gates dispatch and merge-main's dispatch set unknown
    When the guard evaluates it
    Then the "ci" check is "unknown" with exit code 2
    And with both gates dispatched but the set unknown, the "ci" check is still "unknown"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_a_held_run_on_a_bot-merged_head_is_judged_by_its_dispatch::a_held_run_on_a_head_that_is_NOT_a_bot_merge_gets_no_stand-in
  Scenario: A held run on a head that is not a bot merge gets no stand-in
    Given the bot-merged head whose last commit is cut to one parent
    When the "ci" check is read
    Then it refuses as "not-ready", saying "not a merge-main bot merge"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_a_held_run_on_a_bot-merged_head_is_judged_by_its_dispatch::an_ordinary_head_whose_pull_request_runs_executed_is_unchanged:_a_green_dispatch_never_rescues_a_red_run
  Scenario: A green dispatch never rescues a red run that executed
    Given PR #1937 as recorded, with pull_request runs that executed and failed
    When the "ci" check is read
    Then it refuses as a "defect", saying "Code-quality gates: failure" and not "judged by its green"
    And PR #1957's "ci" check passes

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_6_—_the_body's_checklist::#1960:_`-_[_]_CI_green`_was_unticked
  Scenario: #1960's unticked "CI green" box refuses the checklist
    Given PR #1960's snapshot
    When the "checklist" check is read
    Then it refuses, naming "- [ ] CI green"
    And the unticked items of its body are just "- [ ] CI green"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_6_—_the_body's_checklist::an_unticked_box_inside_a_code_fence_is_a_template,_not_an_item
  Scenario: An unticked box inside a code fence is not an item
    Given a body with "- [ ] example" inside a code fence and a ticked "- [x] done"
    When its unticked items are read
    Then there are none

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_7_—_an_open_question_after_the_ready_marker::#1937's_own_question,_re-timed_after_the_marker,_is_caught
  Scenario: #1937's own question re-timed after the marker is caught
    Given PR #1937 with its marker signed and its "Should I delete the `_external` copy?" comment moved a minute after the marker
    When the "open-question" check is read
    Then it refuses, quoting the question

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_7_—_an_open_question_after_the_ready_marker::before_the_marker_it_is_not_open
  Scenario: A question before the marker is not open
    Given PR #1937 with its marker signed and its question left before it
    When the "open-question" check is read
    Then it passes

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_7_—_an_open_question_after_the_ready_marker::a_question_naming_nobody_and_asking_no_decision_is_a_documented_miss
  Scenario: A question naming nobody and asking no decision is a documented miss
    Given a comment "Is this the right file?" after the marker
    When open questions are read
    Then there are none

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_7_—_an_open_question_after_the_ready_marker::a_`?`_inside_a_URL_is_not_a_question
  Scenario: A question mark inside a URL is not a question
    Given a comment "Owner: see https://example.org/x?y=1 for the run." after the marker
    When open questions are read
    Then there are none

  @test:scripts/tests/sdlc/merge-guard.test.ts::every_check_passes_only_when_every_fact_is_in_hand::#1957_as_it_SHOULD_have_been:_own_session_marks_ready_and_signs_`ready:`,_label_on,_CI_green_—_exit_0
  Scenario: #1957 as it should have been passes every check with exit 0
    Given PR #1957 with its own signed "ready:" marker beside the ready event
    When the guard evaluates it with the steward as merging session
    Then base, ready-for-review, ready-marker, labels, ci, checklist, open-question and mergeable each pass
    And the exit code is 0

  @test:scripts/tests/sdlc/merge-guard.test.ts::every_check_passes_only_when_every_fact_is_in_hand::and_the_same_PR_is_refused_when_the_MERGING_session_is_the_one_that_signed_the_marker_beside_the_event
  Scenario: The same PR is refused when the merging session signed the marker beside the event
    Given PR #1957 with a steward-signed "ready:" marker beside the ready event
    When the guard evaluates it with the steward as merging session
    Then the exit code is 1

  @test:scripts/tests/sdlc/merge-guard.test.ts::the_commit-status_state:_pending_for_unfinished,_failure_for_a_defect::#1960_was_only_unfinished_—_no_marker,_no_label,_an_unticked_box_—_so_`pending`,_exit_1
  Scenario: #1960 was only unfinished, so its state is pending with exit 1
    Given PR #1960's snapshot
    When the guard evaluates it
    Then the refusals are ready-marker, labels and checklist, each "not-ready"
    And the state is "pending" with exit code 1

  @test:scripts/tests/sdlc/merge-guard.test.ts::the_commit-status_state:_pending_for_unfinished,_failure_for_a_defect::#1937_had_defects_—_a_dead_base,_needs-merge-human,_red_CI_—_so_`failure`
  Scenario: #1937 had defects, so its state is failure
    Given PR #1937's snapshot
    When the guard evaluates it
    Then base, labels and ci are each a "defect"
    And the state is "failure"

  @test:scripts/tests/sdlc/merge-guard.test.ts::the_commit-status_state:_pending_for_unfinished,_failure_for_a_defect::a_draft_alone_is_`pending`
  Scenario: A draft alone is not-ready
    # Gap: the overall "pending" state is not asserted
    Given PR #1960 marked as a draft
    When the "ready-for-review" check is read
    Then its kind is "not-ready"

  @test:scripts/tests/sdlc/merge-guard.test.ts::the_commit-status_state:_pending_for_unfinished,_failure_for_a_defect::CI_still_running_is_`not-ready`;_the_same_run_failed_is_a_`defect`;_a_run_that_never_executed_is_`not-ready`
  Scenario: CI running is not-ready, failed is a defect, and a run never executed is not-ready
    Given PR #1957 with its Code-quality gates pull_request run set in turn
    Then in progress gives "not-ready"
    And completed with failure gives "defect"
    And completed with action_required gives "not-ready"

  @test:scripts/tests/sdlc/merge-guard.test.ts::the_commit-status_state:_pending_for_unfinished,_failure_for_a_defect::a_marker_signed_by_ANOTHER_session_is_a_defect;_an_unsigned_one_is_merely_not_ready
  Scenario: A marker signed by another session is a defect and an unsigned one is not-ready
    Given PR #1937's unsigned marker
    Then the "ready-marker" kind is "not-ready"
    And for PR #1960 with a steward-signed "ready:" marker the kind is "defect"

  @test:scripts/tests/sdlc/merge-guard.test.ts::the_commit-status_state:_pending_for_unfinished,_failure_for_a_defect::the_merging_session_beside_the_ready_flip_is_a_defect
  Scenario: The merging session beside the ready flip is a defect
    Given PR #1957 with a steward "Marking ready." comment a minute after the ready event
    When the "ready-for-review" check is read with the steward as merging session
    Then its kind is "defect"

  @test:scripts/tests/sdlc/merge-guard.test.ts::the_commit-status_state:_pending_for_unfinished,_failure_for_a_defect::pass_is_`success`,_unknown_is_`error`
  Scenario: A pass posts success and an unknown posts error
    Given PR #1957 with its own signed "ready:" marker beside the ready event
    When the guard evaluates it
    Then the state is "success"
    And once its runs could not be read, the state is "error"

  @test:scripts/tests/sdlc/merge-guard.test.ts::paging_—_page_2_is_asked_in_the_repos/{owner}/{repo}_form::sameRepoNext_rewrites_the_numeric_form_to_the_walk's_own_repos/{owner}/{repo}_prefix
  Scenario: sameRepoNext rewrites a numeric repository next link to the repos/{owner}/{repo} form
    Given a next link in the numeric "/repositories/<id>/" form
    When it is rewritten against the walk's start, relative or absolute
    Then it becomes the "repos/litlfred/folio-assistant" form of page 2

  @test:scripts/tests/sdlc/merge-guard.test.ts::paging_—_page_2_is_asked_in_the_repos/{owner}/{repo}_form::sameRepoNext_leaves_a_next_it_cannot_place_unchanged
  Scenario: sameRepoNext leaves a next link it cannot place unchanged
    Given a next link already in the named form, or a start that is not a repos path
    When it is rewritten
    Then it is returned unchanged

  @test:scripts/tests/sdlc/merge-guard.test.ts::paging_—_page_2_is_asked_in_the_repos/{owner}/{repo}_form::a_two-page_list_is_read_whole,_with_page_2_asked_by_name_and_never_by_numeric_id
  Scenario: A two-page list is read whole with page 2 asked by name
    Given a fake API serving page 1 with a numeric next link and page 2 under the named form
    When every page is fetched
    Then the shas are "a", "b" and "c"
    And the two URLs asked are page 1 and the named page 2
    And no "/repositories/" URL is asked

  @test:scripts/tests/sdlc/merge-guard.test.ts::paging_—_page_2_is_asked_in_the_repos/{owner}/{repo}_form::a_page_2_that_cannot_be_read_is_CannotAsk_(could-not-determine),_never_a_short_list
  Scenario: An unreadable page 2 is CannotAsk, never a short list
    Given a fake API serving page 1 and answering page 2 with the proxy's 403
    When every page is fetched
    Then it fails with CannotAsk
    And the message names "GET" the named page 2 with "HTTP 403" and "not supported through this proxy"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_Feature_Staging_is_judged_once_finished,_never_waited_for::the_scan_maps_the_exempt_FILE_to_the_run_name_check_5_sees
  Scenario: The scan maps the exempt staging file to the run name check 5 sees
    Given the set of workflow files not waited for
    Then it holds ".github/workflows/feature-staging.yml"
    And in the trigger scan that file is named "Feature Staging (GitHub Pages)"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_Feature_Staging_is_judged_once_finished,_never_waited_for::every_run_green:_passes,_as_before
  Scenario: Every run green passes
    Given PR #1937 with every pull_request run successful
    When the "ci" check is read
    Then it passes

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_Feature_Staging_is_judged_once_finished,_never_waited_for::staging_still_IN_PROGRESS_(waiting_out_the_#1956_window):_passes,_and_says_it_did_not_wait
  Scenario: Staging still in progress passes and says it did not wait
    Given every run green except Feature Staging in progress
    When the "ci" check is read
    Then it passes
    And its detail says Feature Staging was not waited for, "(in_progress)"
    And that 2 pull_request workflows ran on the head

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_Feature_Staging_is_judged_once_finished,_never_waited_for::staging_QUEUED:_passes
  Scenario: Staging queued passes
    Given every run green except Feature Staging queued
    When the "ci" check is read
    Then it passes

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_Feature_Staging_is_judged_once_finished,_never_waited_for::staging_has_no_run_on_the_head_at_all:_passes
  Scenario: Staging with no run on the head passes
    Given every run green and no Feature Staging run
    When the "ci" check is read
    Then it passes

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_Feature_Staging_is_judged_once_finished,_never_waited_for::staging_FINISHED_red:_still_refused_—_the_exemption_is_from_waiting,_never_from_judging
  Scenario: Staging finished red is still refused
    Given every run green except Feature Staging completed with failure
    When the "ci" check is read
    Then it refuses, saying "Feature Staging (GitHub Pages): failure"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_Feature_Staging_is_judged_once_finished,_never_waited_for::staging_red_ONLY_in_the_deploy_step_(push_window_never_opened):_passes,_and_says_so
  Scenario: Staging red only in the deploy step passes and says so
    Given Feature Staging failed with the deploy step as its only failed step
    When the "ci" check is read
    Then it passes
    And its detail says "(failure in the deploy step only)"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_Feature_Staging_is_judged_once_finished,_never_waited_for::staging_red_in_a_build_step_as_well_as_the_deploy:_still_refused
  Scenario: Staging red in a build step as well as the deploy is refused
    Given Feature Staging failed in "Build the site" and the deploy step
    When the "ci" check is read
    Then it refuses, saying "Feature Staging (GitHub Pages): failure"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_Feature_Staging_is_judged_once_finished,_never_waited_for::staging_red,_failed_steps_could_not_be_read:_still_refused
  Scenario: Staging red with failed steps not read is refused
    Given Feature Staging failed and its failed steps unknown, not fetched, or empty
    When the "ci" check is read
    Then it refuses in each case

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_Feature_Staging_is_judged_once_finished,_never_waited_for::control:_a_gating_workflow_in_progress_is_still_waited_for
  Scenario: A gating workflow in progress is still waited for
    Given every run green except Code-quality gates in progress
    When the "ci" check is read
    Then it refuses, saying "Code-quality gates: in_progress"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_the_agent-built_preview's_verify_status_(folio-assistant#2881)::control:_every_run_green_and_no_agent_build_passes
  Scenario: Every run green and no agent build passes
    Given PR #1937 with every pull_request run green and no agent-build status
    When the "ci" check is read
    Then it passes

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_the_agent-built_preview's_verify_status_(folio-assistant#2881)::verify_red:_refused_as_a_defect,_with_its_description
  Scenario: A red agent-build verify is refused as a defect with its description
    Given the agent-build status "failure" with description "3 paths differ"
    When the "ci" check is read
    Then it refuses as a "defect"
    And its detail says the agent-build context is "failure (3 paths differ)"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_the_agent-built_preview's_verify_status_(folio-assistant#2881)::verify_errored:_refused_too
  Scenario: An errored agent-build verify is refused
    Given the agent-build status "error"
    When the "ci" check is read
    Then it refuses

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_the_agent-built_preview's_verify_status_(folio-assistant#2881)::verify_pending:_passes,_and_says_it_did_not_wait
  Scenario: A pending agent-build verify passes and says it did not wait
    Given the agent-build status "pending"
    When the "ci" check is read
    Then it passes
    And its detail says "pending: the verify rebuild has not reported"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_the_agent-built_preview's_verify_status_(folio-assistant#2881)::verify_green:_passes
  Scenario: A green agent-build verify passes
    Given the agent-build status "success"
    When the "ci" check is read
    Then it passes

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_the_agent-built_preview's_verify_status_(folio-assistant#2881)::the_statuses_could_not_be_read:_unknown,_never_a_pass
  Scenario: Agent-build statuses that could not be read are unknown
    Given the agent-build status could not be read ("HTTP 502")
    When the "ci" check is read
    Then it is "unknown"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_the_agent-built_preview's_verify_status_(folio-assistant#2881)::a_non-release_merge_reports_the_red_verify_as_advisory
  Scenario: A non-release merge reports a red verify as advisory
    Given the agent-build status "failure"
    When the "ci" check is read for a non-release merge
    Then it does not refuse

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_—_the_agent-built_preview's_verify_status_(folio-assistant#2881)::agentBuildStatus_takes_the_newest_status_of_that_context,_ignoring_others
  Scenario: agentBuildStatus takes the newest status of its context
    Given only a "merge-guard" status
    Then there is no agent-build status
    And among agent-build statuses at 10:00 pending and 11:00 success and a newer merge-guard failure, the result is "success"
    And with no timestamps, the first listed "failure" is taken

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_8_—_the_head_still_merges_cleanly_into_main::control:_every_check_passes_on_the_base_case
  Scenario: The check 8 base case passes every check
    Given PR #1957 as it should have been, with mergeable true and state "clean"
    When the guard evaluates it
    Then no check fails to pass
    And the verdict is "pass", state "success", exit 0

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_8_—_the_head_still_merges_cleanly_into_main::#1898's_state_—_signed,_green,_labelled,_but_conflicting_(`dirty`)_—_is_refused,_not-ready,_with_the_remedy
  Scenario: A signed, green, labelled but conflicting head is refused not-ready with the remedy
    Given the passing PR with mergeable false and state "dirty"
    When the "mergeable" check is read
    Then it is check 8 and refuses as "not-ready"
    And its detail says "conflicts with `main`" and "Merge `main` into the head"
    And the verdict is "refused", state "pending", exit 1

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_8_—_the_head_still_merges_cleanly_into_main::`mergeable:_false`_alone_refuses;_so_does_`dirty`_alone
  Scenario: mergeable false alone refuses, and so does dirty alone
    Given the passing PR with mergeable false and no state, or mergeable true and state "dirty"
    When the "mergeable" check is read
    Then it refuses in each case

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_8_—_the_head_still_merges_cleanly_into_main::`mergeable:_null`_(not_computed_yet)_is_unknown,_never_a_pass,_and_the_verdict_is_`error`,_exit_2
  Scenario: mergeable null is unknown and the verdict is error with exit 2
    Given the passing PR with mergeable null and state "unknown"
    When the "mergeable" check is read
    Then it is "unknown", saying it "has not computed"
    And the verdict is "unknown", state "error", exit 2

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_8_—_the_head_still_merges_cleanly_into_main::a_record_with_no_`mergeable`_field_is_unknown,_not_a_pass
  Scenario: A record with no mergeable field is unknown
    Given the passing PR with no mergeable field
    When the "mergeable" check is read
    Then it is "unknown", saying "no `mergeable` field"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_8_—_the_head_still_merges_cleanly_into_main::`mergeable:_true`_passes,_including_`unstable`,_`blocked`_and_`behind`:_CI_and_review_are_not_this_check's
  Scenario: mergeable true passes whatever the mergeable state
    Given the passing PR with mergeable true and state "clean", "unstable", "blocked", "behind" or none
    When the "mergeable" check is read
    Then it passes and the exit code is 0 in each case

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_8_—_the_head_still_merges_cleanly_into_main::a_conflict_beside_a_defect_elsewhere_still_posts_`failure`:_the_conflict_adds,_it_does_not_mask
  Scenario: A conflict beside a defect elsewhere still posts failure
    Given the passing PR with mergeable false, state "dirty", and a "needs-merge-human" label
    When the guard evaluates it
    Then the state is "failure"

  @test:scripts/tests/sdlc/merge-guard.test.ts::fetchPull_—_re-asks_while_GitHub_has_not_computed_`mergeable`::null_then_false:_the_second_answer_is_the_one_returned
  Scenario: fetchPull re-asks while mergeable is null and returns the later answer
    Given a PR API answering mergeable null ("unknown") then false ("dirty")
    When the PR is fetched with waits of 1, 2 and 3
    Then mergeable is false and the state "dirty"
    And it waited once, for 1

  @test:scripts/tests/sdlc/merge-guard.test.ts::fetchPull_—_re-asks_while_GitHub_has_not_computed_`mergeable`::still_null_after_every_wait:_returned_as_null,_so_check_8_says_unknown
  Scenario: Still null after every wait is returned as null
    Given a PR API always answering mergeable null
    When the PR is fetched with waits of 1, 2 and 3
    Then mergeable is null
    And it waited 1, 2 and 3 and asked 4 times

  @test:scripts/tests/sdlc/merge-guard.test.ts::fetchPull_—_re-asks_while_GitHub_has_not_computed_`mergeable`::an_answer_on_the_first_ask_is_not_re-asked;_nor_is_a_closed_PR
  Scenario: An answer on the first ask is not re-asked, nor is a closed PR
    Given a PR API answering mergeable true ("clean")
    When the PR is fetched
    Then it is asked once
    And a closed PR answering mergeable null is also asked once

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_gates_a_release_only_(owner,_card_Q-CIB-4_A,_2026-11-08)::a_non-release_merge:_red_CI_is_reported,_and_the_check_passes_as_advisory
  Scenario: On a non-release merge red CI is reported and the check passes as advisory
    Given PR #1937 with red CI
    When the "ci" check is read for a non-release merge
    Then it passes
    And its detail says "advisory, not a gate" and "is not green"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_gates_a_release_only_(owner,_card_Q-CIB-4_A,_2026-11-08)::a_release_merge:_the_same_red_CI_still_refuses
  Scenario: On a release merge the same red CI still refuses
    Given PR #1937 with red CI
    When the "ci" check is read with the release flag
    Then it refuses

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_gates_a_release_only_(owner,_card_Q-CIB-4_A,_2026-11-08)::the_`release`_label_makes_it_a_release_without_the_flag
  Scenario: The release label makes it a release without the flag
    Given PR #1937 with the release label added
    Then it is a release
    And its "ci" check refuses without the flag

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_gates_a_release_only_(owner,_card_Q-CIB-4_A,_2026-11-08)::CI_that_could_not_be_read_is_advisory_on_a_non-release_merge,_never_a_silent_pass
  Scenario: Unreadable CI is advisory on a non-release merge, never a silent pass
    Given an "unknown" ci check whose detail is "could not read the head's runs: HTTP 502"
    When it is made advisory
    Then it passes
    And its detail says "could not be judged" and names "HTTP 502"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_gates_a_release_only_(owner,_card_Q-CIB-4_A,_2026-11-08)::green_CI_says_it_was_advisory
  Scenario: Green CI says it was advisory
    Given a passing ci check with detail "3 workflows green"
    When it is made advisory
    Then the detail is "3 workflows green (advisory: not a gate on a non-release merge)"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_gates_a_release_only_(owner,_card_Q-CIB-4_A,_2026-11-08)::advisory_CI_lifts_only_check_5:_every_other_refusal_still_stands
  Scenario: Advisory CI lifts only check 5
    Given PR #1937 with red CI
    When it is evaluated as a non-release merge and as a release merge
    Then the number of refusals other than ci is the same

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_under_--full-tier_—_the_full_tier_must_be_green_on_the_head::a_green_full-tier_judge_on_the_head_passes
  Scenario: Under --full-tier a green full-tier judge on the head passes check 5
    Given PR #1960 with a green "No new failures (tests and gates)" check run and a test shard that ran on its head
    When check 5 is read with --full-tier
    Then it passes, naming the judge and the shard count

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_under_--full-tier_—_the_full_tier_must_be_green_on_the_head::the_fast_tier_alone_is_not-ready,_and_says_how_to_run_the_full_tier
  Scenario: Under --full-tier the fast tier alone is not ready
    Given PR #1960 whose only check run is the green "Fast tier only" job
    When check 5 is read with --full-tier
    Then it refuses as not-ready
    And its detail says the full tier has not run and that ready-to-merge or release runs it

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_under_--full-tier_—_the_full_tier_must_be_green_on_the_head::a_red_judge_is_a_defect;_one_still_running_is_not-ready;_the_latest_run_of_a_judge_counts
  Scenario: Under --full-tier a red judge is a defect, a running one not ready, and the latest run counts
    Given PR #1960 with its full-tier judge red, then running, then red followed by a later green run
    When check 5 is read with --full-tier each time
    Then it is a defect, then not-ready, then a pass

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_under_--full-tier_—_the_full_tier_must_be_green_on_the_head::check_runs_not_fetched_or_not_readable_are_unknown,_never_a_pass
  Scenario: Under --full-tier unread check runs are unknown, never a pass
    Given PR #1960 with no check runs fetched, and then check runs unreadable with "HTTP 403"
    When check 5 is read with --full-tier
    Then it is unknown both times, and names "HTTP 403"

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_under_--full-tier_—_the_full_tier_must_be_green_on_the_head::--full-tier_gates_even_without_--release,_and_keeps_a_red_workflow_run's_refusal
  Scenario: --full-tier gates without --release and keeps a workflow run's refusal
    Given PR #1937 with a green full-tier judge
    When check 5 is read with --full-tier and no --release
    Then it has the same status as the release judgement, and is not advisory
    And a passing workflow-run judgement with no full-tier judge refuses as not-ready

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_under_--full-tier_—_the_full_tier_must_be_green_on_the_head::a_skipped_judge,_or_one_whose_name_was_never_rendered,_judged_nothing:_not-ready,_never_a_defect
  Scenario: Under --full-tier a skipped or unrendered judge judged nothing
    Given PR #1960 whose only "No new failures" check runs are a skipped one and a skipped one whose name is still a template
    When check 5 is read with --full-tier
    Then it refuses as not-ready, saying the full tier has not run
    When a green "No new failures (tests and gates)" run is added beside the unrendered one
    Then it passes

  @test:scripts/tests/sdlc/merge-guard.test.ts::check_5_under_--full-tier_—_the_full_tier_must_be_green_on_the_head::a_green_judge_with_every_test_shard_skipped_is_the_fast_tier_(#2103's_real_head):_not-ready
  Scenario: Under --full-tier a green judge with every test shard skipped is the fast tier
    Given PR #1960 with #2103's real fast-tier check runs: "Tests (no new failures)" green and every "bun test" shard skipped and unrendered
    When check 5 is read with --full-tier
    Then it refuses as not-ready, saying no test shard ran
    When a "bun test (head, 2/4)" shard that ran is added
    Then it passes
