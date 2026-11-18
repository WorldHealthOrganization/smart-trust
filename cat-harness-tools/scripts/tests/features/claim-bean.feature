# scripts/claim-bean.ts claims a bean by pushing its in-progress status alone to the default branch
# from a temporary worktree, joins that claim commit to the caller's branch, and reports refusals by state and exit code.
# Each Scenario names the test that executes it.
Feature: Claiming a bean on the default branch

  @test:scripts/tests/claim-bean.test.ts::claiming_on_the_default_branch::a_free_bean_is_claimed_there,_in_a_commit_of_its_own,_without_touching_the_working_tree
  Scenario: A free bean is claimed on the default branch in a commit of its own
    Given a work checkout on "claude/feature" whose bare remote's "main" holds a todo bean "aaaa"
    When "aaaa" is claimed for "claude/feature"
    Then the outcome is "pushed" with exit code 0
    And on origin/main the bean's status is "in-progress" and its file contains "Claimed by claude/feature"
    And the claim commit on origin/main changes exactly one file
    And the claim joined the branch as a "fast-forward"
    And the working tree is clean and HEAD equals origin/main
    And only one worktree remains

  @test:scripts/tests/claim-bean.test.ts::claiming_on_the_default_branch::the_claim_is_in_the_branch's_history,_so_the_branch's_own_later_edit_to_the_bean_merges_cleanly
  Scenario: The branch's own later edit to a claimed bean merges cleanly with the default branch
    # Gap: nothing else lands on main before the merge, so only a merge of the claim itself is exercised
    Given a todo bean "mmmm" claimed for "claude/feature" with outcome "pushed"
    And the local bean file now reads "in-progress"
    When the branch commits the bean as "completed" with a new updated_at and a summary section
    And origin/main is merged into the branch
    Then the working tree is clean
    And the bean file still says "status: completed"

  @test:scripts/tests/claim-bean.test.ts::claiming_on_the_default_branch::a_branch_with_commits_of_its_own_gets_a_MERGE_commit,_never_a_rewrite
  Scenario: A branch with commits of its own joins the claim by a merge commit
    Given a branch with its own commit adding "other.txt"
    When the todo bean "nnnn" is claimed for "claude/feature"
    Then the claim joined the branch as "merged"
    And HEAD's parents are the branch's own commit and origin/main, in that order
    And the outcome's description mentions "merge commit"

  @test:scripts/tests/claim-bean.test.ts::claiming_on_the_default_branch::local_edits_in_the_way:_the_merge_is_not_left_half-done,_and_today's_text_mirror_is_the_fallback
  Scenario: Uncommitted edits to the bean leave HEAD untouched and fall back to a text mirror
    Given the bean file for "pppp" has an uncommitted edit
    When "pppp" is claimed for "claude/feature"
    Then the outcome is "pushed" and the claim is "not-joined"
    And HEAD has not moved
    And the local bean file keeps the uncommitted edit and now says "in-progress"
    And the outcome's description mentions "NOT in this branch's history"

  @test:scripts/tests/claim-bean.test.ts::claiming_on_the_default_branch::a_bean_another_branch_holds_is_REFUSED,_by_name,_and_nothing_is_written
  Scenario: A bean held by another branch is refused by name and nothing is written
    Given bean "bbbb" already claimed by "claude/first"
    When "bbbb" is claimed for "claude/second"
    Then the outcome is "already-claimed", held by "claude/first", with exit code 0
    And origin/main gained no commits

  @test:scripts/tests/claim-bean.test.ts::claiming_on_the_default_branch::re-claiming_from_the_same_branch_is_idempotent_—_no_second_commit
  Scenario: Re-claiming from the same branch makes no second commit
    Given bean "cccc" already claimed by "claude/feature"
    When "cccc" is claimed again for "claude/feature"
    Then the outcome is "pushed"
    And origin/main gained no commits

  @test:scripts/tests/claim-bean.test.ts::claiming_on_the_default_branch::in-progress_with_NO_recorded_holder_is_its_own_state,_not_a_claim
  Scenario: In-progress with no recorded holder is held-unknown
    Given bean "eeee" authored directly as "in-progress" with no claim note
    When "eeee" is claimed for "claude/feature"
    Then the outcome is "held-unknown"
    And origin/main gained no commits

  @test:scripts/tests/claim-bean.test.ts::claiming_on_the_default_branch::...and_it_is_NEVER_reported_as_a_successful_claim
  Scenario: A held-unknown outcome never reads as a successful claim
    Given bean "ffff" authored as "in-progress" with no claim note
    When it is claimed and the outcome is described
    Then the description does not say "every session can see it now" and does not start with "claimed "
    And it says "NOBODY RECORDED A HOLDER" and mentions the "open PR list"

  @test:scripts/tests/claim-bean.test.ts::claiming_on_the_default_branch::its_exit_code_is_neither_'carry_on'_nor_'remote_unreadable'
  Scenario: A held-unknown outcome exits 4
    Given bean "gggg" authored as "in-progress" with no claim note
    When it is claimed
    Then the exit code is 4, neither 0 nor 2

  @test:scripts/tests/claim-bean.test.ts::claiming_on_the_default_branch::a_holder_that_IS_us_still_claims_—_the_two_cases_stay_apart
  Scenario: A bean held by this same branch still claims
    Given bean "hhhh" already claimed by "claude/feature"
    When it is claimed again for "claude/feature"
    Then the outcome is "pushed" with exit code 0

  @test:scripts/tests/claim-bean.test.ts::claiming_on_the_default_branch::a_REJECTED_push_falls_back_loudly_—_exit_3,_branch_untouched,_worktree_cleaned
  Scenario: A rejected push falls back with exit 3 and cleans up
    Given a remote whose pre-receive hook rejects every push as a protected branch
    When the todo bean "dddd" is claimed
    Then the outcome is "fell-back" with exit code 3
    And its reason mentions "Protected branch"
    And on origin/main the bean is still "todo"
    And only one worktree remains

  @test:scripts/tests/claim-bean.test.ts::claiming_on_the_default_branch::a_COMPLETED_or_SCRAPPED_bean_is_refused_—_finished_work_is_not_re-opened_by_accident
  Scenario: A completed or scrapped bean is refused
    Given bean "iiii" is "completed" and bean "jjjj" is "scrapped"
    When each is claimed
    Then each outcome is "already-closed", closed as its status, with exit code 0
    And on origin/main each bean keeps its status

  @test:scripts/tests/claim-bean.test.ts::claiming_on_the_default_branch::a_bean_that_is_NEW_on_this_branch_is_a_determined_state,_not_'could_not_tell'
  Scenario: A bean created only on this branch is new-on-branch
    Given bean "ffff" committed on the branch after it diverged from main
    When "ffff" is claimed
    Then the outcome is "new-on-branch" with exit code 0

  @test:scripts/tests/claim-bean.test.ts::claiming_on_the_default_branch::an_unreadable_remote_is_exit_2,_and_never_reads_as_'the_bean_is_free'
  Scenario: An unreadable remote is unknown with exit 2
    Given origin points at a remote that does not exist
    When the bean "gggg" is claimed
    Then the outcome is "unknown" with exit code 2

  @test:scripts/tests/claim-bean.test.ts::claiming_on_the_default_branch::a_bean_absent_from_the_store_is_unknown,_not_a_silent_success
  Scenario: A bean absent from the store is unknown with exit 2
    Given a store without a bean "nope"
    When "nope" is claimed
    Then the outcome is "unknown" with exit code 2

  @test:scripts/tests/claim-bean.test.ts::absoluteRemote::a_relative_local_path_is_resolved_against_the_repo,_not_the_worktree
  Scenario: A relative remote path is resolved against the repository
    Given the repository "/srv/folio" and the remote "../mirror.git"
    When the remote is made absolute
    Then it is "/srv/mirror.git"

  @test:scripts/tests/claim-bean.test.ts::absoluteRemote::a_URL_with_a_scheme_and_an_scp-form_address_are_left_alone
  Scenario: Scheme URLs and scp-form addresses are left alone
    Given https, ssh and file URLs and an scp-form "git@github.com:" address
    When each is made absolute against "/srv/folio"
    Then each comes back unchanged

  @test:scripts/tests/claim-bean.test.ts::a_claim_from_the_wrong_checkout_is_refused,_not_misattributed_(ssfp)::a_checkout_on_a_work_branch_is_the_right_one
  Scenario: A checkout on a work branch is accepted
    Given a checkout on "claude/feature"
    When it is asked whether it is the wrong checkout
    Then there is no complaint

  @test:scripts/tests/claim-bean.test.ts::a_claim_from_the_wrong_checkout_is_refused,_not_misattributed_(ssfp)::a_checkout_on_the_default_branch,_or_detached,_names_the_tree_it_would_have_written_to
  Scenario: A checkout on the default branch or detached is refused, naming the tree
    Given a checkout
    When it is asked about branch "main"
    Then the complaint names the checkout's path and mentions "default branch"
    And for "(detached)" the complaint mentions "detached"

  @test:scripts/tests/claim-bean.test.ts::a_claim_from_the_wrong_checkout_is_refused,_not_misattributed_(ssfp)::the_CLI_claims_from_a_WORKTREE_into_that_worktree,_and_refuses_from_the_main_checkout
  Scenario: The CLI refuses from the main checkout and claims from a worktree
    Given a main checkout on "main" and a worktree on "claude/agent"
    When the CLI claims "aaaa" from the main checkout
    Then it exits 5, its stderr names the main checkout, and "aaaa" stays "todo"
    When the CLI claims "bbbb" from the worktree's beans directory
    Then it exits 0 and prints "claiming from" the worktree path
    And "bbbb" is "in-progress" in the worktree and still "todo" in the main checkout

  @test:scripts/tests/claim-bean.test.ts::mirrorClaimNote_—_bean_`24fa`::copies_the_pushed_note_onto_the_local_branch_byte_for_byte
  Scenario: The pushed claim note is mirrored onto the local branch exactly
    Given a pushed bean "zz11" carrying a claim note and a local copy without it
    When the claim note is mirrored
    Then the result is "mirrored"
    And the local file contains the exact note

  @test:scripts/tests/claim-bean.test.ts::mirrorClaimNote_—_bean_`24fa`::is_idempotent_—_a_second_claim_does_not_append_the_note_twice
  Scenario: Mirroring a note already present does not duplicate it
    Given a local bean that already carries the pushed claim note
    When the claim note is mirrored
    Then the result is "already-there"
    And the note appears exactly once in the local file

  @test:scripts/tests/claim-bean.test.ts::mirrorClaimNote_—_bean_`24fa`::the_branch's_own_later_edits_stay_AFTER_the_note,_which_is_what_fixes_the_body_conflict
  Scenario: The branch's later edits come after the mirrored note
    # Gap: the later edit is appended by the test itself, and no merge against the pushed copy is run
    Given a pushed claim note mirrored onto the local bean with result "mirrored"
    When a "## Summary of Changes" section is appended to the local bean
    Then the file contains the note
    And the note comes before the summary section

  @test:scripts/tests/claim-bean.test.ts::mirrorClaimNote_—_bean_`24fa`::reports_`no-note`_rather_than_guessing_when_nothing_was_pushed
  Scenario: Nothing pushed is reported as no-note
    Given a pushed bean with no claim note
    When the claim note is mirrored
    Then the result is "no-note"
