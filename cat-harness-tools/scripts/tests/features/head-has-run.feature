# scripts/check-head-has-run.ts tells a commit with workflow runs, a commit with none, and a commit nobody could ask about apart,
# resolves and checks the push state of the commit with git, reads the PR merge ref to say why a head has no run, and words the advice per state.
# Each Scenario names the test that executes it.
Feature: Telling a head with no run from a head nobody could ask about

  @test:scripts/tests/head-has-run.test.ts::three_answers_stay_three_answers::runs_present_is_`has-run`,_and_they_come_back
  Scenario: Runs present are has-run and come back
    Given a stubbed GitHub answer with one workflow run
    When the runs for head "abc" of "o/r" are asked for
    Then the state is "has-run"
    And one run is returned

  @test:scripts/tests/head-has-run.test.ts::three_answers_stay_three_answers::an_EMPTY_list_is_`no-run`_—_a_determined_absence
  Scenario: An empty run list is no-run
    Given a stubbed GitHub answer with an empty workflow_runs list
    When the runs for head "abc" of "o/r" are asked for
    Then the state is "no-run"

  @test:scripts/tests/head-has-run.test.ts::three_answers_stay_three_answers::a_missing_`workflow_runs`_key_is_also_`no-run`,_not_a_crash
  Scenario: A missing workflow_runs key is also no-run
    Given a stubbed GitHub answer whose body has no workflow_runs key
    When the runs for head "abc" of "o/r" are asked for
    Then the state is "no-run"

  @test:scripts/tests/head-has-run.test.ts::three_answers_stay_three_answers::NO_REMOTE_is_`cannot-ask`,_never_`no-run`
  Scenario: No remote is cannot-ask
    Given no remote repository
    When the runs for head "abc" are asked for
    Then the state is "cannot-ask"

  @test:scripts/tests/head-has-run.test.ts::three_answers_stay_three_answers::a_404_is_`cannot-ask`_and_names_the_token_—_not_being_ALLOWED_to_look_is_not_an_absence
  Scenario: A 404 is cannot-ask and names the token
    Given a stubbed GitHub answer with status 404
    When the runs for head "abc" of "o/r" are asked for
    Then the state is "cannot-ask"
    And the reason mentions "GITHUB_TOKEN"

  @test:scripts/tests/head-has-run.test.ts::three_answers_stay_three_answers::a_403_is_`cannot-ask`_and_names_rate_limiting
  Scenario: A 403 is cannot-ask and names rate limiting
    Given a stubbed GitHub answer with status 403
    When the runs for head "abc" of "o/r" are asked for
    Then the reason is cannot-ask mentioning "rate limited"

  @test:scripts/tests/head-has-run.test.ts::three_answers_stay_three_answers::a_thrown_fetch_is_retried,_and_THEN_`cannot-ask`_with_the_reason
  Scenario: A thrown fetch is retried and then cannot-ask with the reason
    Given a fetch that always throws "network is unreachable"
    When the runs are asked for with 3 attempts and no real sleep
    Then the fetch is called 3 times
    And the state is cannot-ask with a reason mentioning "unreachable"

  @test:scripts/tests/head-has-run.test.ts::three_answers_stay_three_answers::a_5xx_is_retried;_a_404_is_NOT_—_one_is_a_blip,_the_other_is_an_answer
  Scenario: A 5xx is retried and a 404 is not
    Given a fetch answering status 503, and then one answering status 404
    When each is asked with 3 attempts and no real sleep
    Then the 503 fetch is called 3 times
    And the 404 fetch is called once

  @test:scripts/tests/head-has-run.test.ts::the_commit_is_resolved_HERE_before_GitHub_is_asked::an_id_git_does_not_know_is_undefined_—_the_CLI_turns_this_into_exit_2
  Scenario: An id git does not know resolves to undefined
    Given a fixture repository with one pushed commit
    When resolveCommit is asked for "deadbeef…" repeated to 40 characters
    Then it is undefined
    # Gap: the CLI's exit code 2 is not checked

  @test:scripts/tests/head-has-run.test.ts::the_commit_is_resolved_HERE_before_GitHub_is_asked::`HEAD`_resolves_to_a_full_40-character_sha
  Scenario: HEAD resolves to a full 40-character sha
    Given a fixture repository with one pushed commit
    When resolveCommit is asked for "HEAD"
    Then the answer is 40 lowercase hex characters

  @test:scripts/tests/head-has-run.test.ts::the_commit_is_resolved_HERE_before_GitHub_is_asked::a_short_sha_resolves_to_the_same_full_one
  Scenario: A short sha resolves to the same full one
    Given a fixture repository with one pushed commit
    When resolveCommit is asked for the first 8 characters of HEAD's sha
    Then it returns HEAD's full sha

  @test:scripts/tests/head-has-run.test.ts::pushed_or_not,_because_the_two_need_different_advice::a_commit_on_a_remote-tracking_ref_reads_as_pushed
  Scenario: A commit on a remote-tracking ref reads as pushed
    Given a fixture repository whose commit is recorded as "origin/main"
    When pushedState is asked about that commit
    Then it is "pushed"

  @test:scripts/tests/head-has-run.test.ts::pushed_or_not,_because_the_two_need_different_advice::a_commit_in_a_fresh_repo_with_no_remote_reads_as_NOT_pushed
  Scenario: A commit in a fresh repository with no remote reads as not pushed
    Given a fixture repository with no remote
    When pushedState is asked about its HEAD
    Then it is "not-pushed"

  @test:scripts/tests/head-has-run.test.ts::pushed_or_not,_because_the_two_need_different_advice::git_unable_to_answer_is_`cannot-tell`,_NOT_`not-pushed`
  Scenario: Git unable to answer is cannot-tell, with the reason kept
    Given a temporary directory that is not a git repository
    When pushedState is asked about a 40-zero sha there
    Then it is "cannot-tell"
    And the last pushed reason mentions "exited"

  @test:scripts/tests/head-has-run.test.ts::sddf_—_the_merge_ref_is_the_discriminator,_not_the_clock::a_sha_that_is_a_PR_head_is_found,_with_its_number
  Scenario: A sha that is a PR head is found with its number
    Given a fake forge where "aaa…" heads PR 11 and "bbb…" heads PR 22
    When prNumberForHead is asked about each sha
    Then they are 11 and 22

  @test:scripts/tests/head-has-run.test.ts::sddf_—_the_merge_ref_is_the_discriminator,_not_the_clock::a_sha_that_is_no_PR's_head_is_`not-a-pr-head`_—_nothing_was_ever_owed
  Scenario: A sha that is no PR's head is not-a-pr-head
    Given the fake forge
    When the sha "ccc…" is looked up
    Then prNumberForHead is undefined
    And mergeStateForHead is "not-a-pr-head"

  @test:scripts/tests/head-has-run.test.ts::sddf_—_the_merge_ref_is_the_discriminator,_not_the_clock::a_merge_ref_present_means_a_run_is_OWED
  Scenario: A merge ref present means the head is mergeable
    Given the fake forge where PR 11 has a merge ref built for its head on the default branch tip
    When mergeStateForHead is asked about "aaa…"
    Then it is "mergeable"

  @test:scripts/tests/head-has-run.test.ts::sddf_—_the_merge_ref_is_the_discriminator,_not_the_clock::NO_merge_ref_means_conflicted_—_this_head_will_never_get_a_run
  Scenario: No merge ref means conflicted
    Given the fake forge where PR 22 has no merge ref
    When mergeStateForHead is asked about "bbb…"
    Then it is "conflicted"

  @test:scripts/tests/head-has-run.test.ts::sddf_—_the_merge_ref_is_the_discriminator,_not_the_clock::a_merge_ref_built_for_an_EARLIER_head_is_`unknown`,_never_`mergeable`_(52cz,_#1665)
  Scenario: A merge ref built for an earlier head is unknown
    Given the fake forge where PR 11's merge ref has a second parent other than its head
    When mergeStateForHead is asked about "aaa…"
    Then it is "unknown"

  @test:scripts/tests/head-has-run.test.ts::sddf_—_the_merge_ref_is_the_discriminator,_not_the_clock::a_merge_ref_built_for_THIS_head_on_an_OLD_base_that_now_conflicts_is_`conflicted`_(rwwl,_#2197)
  Scenario: A merge ref for this head on an old base that now conflicts is conflicted
    Given the fake forge where PR 11's merge ref is built on an older base and merge-tree reports a conflict
    When mergeStateForHead is asked about "aaa…"
    Then it is "conflicted"

  @test:scripts/tests/head-has-run.test.ts::sddf_—_the_merge_ref_is_the_discriminator,_not_the_clock::an_old_base_that_still_merges_cleanly_is_`mergeable`_—_the_forge_rebuilds_lazily
  Scenario: An old base that still merges cleanly is mergeable
    Given the fake forge where PR 11's merge ref is built on an older base and merge-tree merges cleanly
    When mergeStateForHead is asked about "aaa…"
    Then it is "mergeable"

  @test:scripts/tests/head-has-run.test.ts::sddf_—_the_merge_ref_is_the_discriminator,_not_the_clock::a_base_that_is_not_the_default_branch_(a_stacked_PR)_is_`unknown`,_not_a_guess
  Scenario: A base that is not on the default branch is unknown
    Given the fake forge where PR 11's merge ref is built on a base that is not an ancestor of the default branch
    When mergeStateForHead is asked about "aaa…"
    Then it is "unknown"

  @test:scripts/tests/head-has-run.test.ts::sddf_—_the_merge_ref_is_the_discriminator,_not_the_clock::a_merge-tree_that_ERRORS_(rather_than_conflicts)_is_`unknown`,_never_`conflicted`
  Scenario: A merge-tree that errors rather than conflicts is unknown
    Given the fake forge where PR 11's merge ref is on an older base and merge-tree fails with status 128
    When mergeStateForHead is asked about "aaa…"
    Then it is "unknown"

  @test:scripts/tests/head-has-run.test.ts::sddf_—_the_merge_ref_is_the_discriminator,_not_the_clock::a_FAILING_probe_is_`unknown`,_never_`conflicted`
  Scenario: A failing probe is unknown, never conflicted
    Given a git runner that lists the PR heads but throws on every other call
    When mergeStateForHead is asked about "aaa…"
    Then it is "unknown"

  @test:scripts/tests/head-has-run.test.ts::sddf_—_the_advice,_per_state::CONFLICTED_never_says_dispatch,_and_never_says_dropped
  Scenario: Conflicted advice never says dispatch and never says dropped
    When the no-run advice for "conflicted" is read with its wrapping flattened
    Then it does not contain "the event was dropped"
    And it contains "Do NOT dispatch", "MERGE THE BASE BRANCH IN" and "a tree that will never exist"

  @test:scripts/tests/head-has-run.test.ts::sddf_—_the_advice,_per_state::MERGEABLE_is_the_only_state_where_dispatching_is_offered
  Scenario: Mergeable advice offers dispatching without claiming a cause
    # Gap: only the mergeable advice is read; that other states do not offer dispatch is not checked here
    When the no-run advice for "mergeable" is read with its wrapping flattened
    Then it contains "safe HERE"
    And it contains "NOT established"
    And it contains "Latency is no guide"

  @test:scripts/tests/head-has-run.test.ts::sddf_—_the_advice,_per_state::NO_state_claims_a_cause_it_cannot_establish
  Scenario: No state's advice claims the event was dropped
    When the no-run advice for "conflicted", "mergeable", "not-a-pr-head" and "unknown" is read
    Then none contains "the event was dropped"

  @test:scripts/tests/head-has-run.test.ts::sddf_—_the_advice,_per_state::UNKNOWN_warns_against_dispatching_rather_than_recommending_it
  Scenario: Unknown advice warns against dispatching
    When the no-run advice for "unknown" is read with its wrapping flattened
    Then it contains "by hand" and "a tree that will never exist"
    And it does not contain "safe HERE"

  @test:scripts/tests/head-has-run.test.ts::sddf_—_the_advice,_per_state::...and_'by_hand'_means_ASK_GIT,_not_the_field_that_goes_stale
  Scenario: Checking by hand means asking git, not the stale mergeable_state field
    When the no-run advice for "unknown" and the missing-required advice for "Code-quality gates" in state "unknown" are read
    Then each contains "--json merged" and "refs/pull/"
    And each contains "not `mergeable_state`"

  @test:scripts/tests/head-has-run.test.ts::sddf_—_the_advice,_per_state::the_warning_is_specific_about_WHY,_not_just_that
  Scenario: The unknown advice says why the field is not trusted
    When the no-run advice for "unknown" is read with its wrapping flattened
    Then it contains "45 minutes"
    And it contains "stale-safe"
