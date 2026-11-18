# The bean-drain Tools (scripts/drain-queue.ts, scripts/bean-claim-check.ts and scripts/lib/bean-drain.ts):
# queue merging and grouping, claim checks against branch activity and open PRs, and the claim itself
# on two real bean copies. Each Scenario names the test that executes it.
Feature: Bean drain queue and claim checks

  @test:scripts/tests/bean-drain.test.ts::agents_and_windows::an_author_is_matched_by_email,_and_an_unknown_one_is_nobody
  Scenario: A commit author is matched to an agent by email
    Given the default agents
    Then "Carl Leitner <litlfred@fenugreek.home>" is agent "agy"
    And "litlfred <litlfred@users.noreply.github.com>" is agent "cloud"
    And "Someone <x@y>" is no agent

  @test:scripts/tests/bean-drain.test.ts::agents_and_windows::windows_are_a_count_and_a_unit
  Scenario: A window is a count and a unit
    Then window "24h" is 24 hours
    And window "2d" is 48 hours
    And window "24" with no unit is not a window

  @test:scripts/tests/bean-drain.test.ts::parseBean_and_exclusions::front_matter_fields,_the_block-style_blocked_by_list,_and_the_parent
  Scenario: Parsing a bean reads its front matter, block-style blocked_by list and parent
    Given a bean file with a quoted title, a block-style blocked_by list and a parent
    When it is parsed
    Then its id is "folio-assistant-bssi"
    And its title is "A 'quoted' title"
    And it is blocked by "folio-assistant-m8gz"
    And its parent is "folio-assistant-ahvw"

  @test:scripts/tests/bean-drain.test.ts::parseBean_and_exclusions::blocked_only_while_the_blocker_is_open
  Scenario: A bean is excluded as blocked only while its blocker is open
    Given the parsed bean blocked by "folio-assistant-m8gz"
    Then it is excluded as "blocked" when that blocker is open
    And it is not excluded when no blocker is open

  @test:scripts/tests/bean-drain.test.ts::parseBean_and_exclusions::goals,_epics,_closed,_drafts_and_owner-held_beans_are_left_out_with_a_reason
  Scenario: Goals, epics, drafts and owner-held beans are excluded with a reason
    # Gap: a closed bean's exclusion is not asserted
    Then a milestone is excluded as "goal"
    And an epic is excluded as "epic"
    And a draft is excluded as "draft"
    And a bean whose body says the owner said keep parked is excluded as "owner-held"

  @test:scripts/tests/bean-drain.test.ts::heldOnBranch_reads_activity,_not_status::another_agent's_commit_inside_the_window_holds_it
  Scenario: Another agent's commit inside the window holds the bean
    Given agy committed on the bean at 2026-10-24T07:52:57Z
    When the branch is read at 08:00Z with a 24 hour window
    Then the bean is held as "skip-recent-commit"

  @test:scripts/tests/bean-drain.test.ts::heldOnBranch_reads_activity,_not_status::the_f1e1_replay:_at_07:50Z_the_branch_alone_says_the_bean_is_free
  Scenario: The f1e1 replay: at 07:50Z the branch alone says the bean is free
    Given the only commit on the bean is a cloud sync on 2026-10-16
    When the branch is read at 2026-10-24T07:50Z with a 24 hour window
    Then the bean is not held

  @test:scripts/tests/bean-drain.test.ts::heldOnBranch_reads_activity,_not_status::a_sibling_cloud_thread's_claim_holds_it;_our_own_does_not
  Scenario: A sibling cloud session's claim holds the bean, but our own does not
    Given a cloud commit at 08:15Z claiming the bean from another session
    When the branch is read at 08:20Z
    Then the bean is held as "skip-recent-commit"
    And when that commit carries our own session alongside an agy commit at 08:00Z, the bean is not held

  @test:scripts/tests/bean-drain.test.ts::heldOnBranch_reads_activity,_not_status::the_state_bot's_mirror_commits_never_hold_a_bean
  Scenario: The state bot's mirror commits never hold a bean
    Given a folio-state-bot commit on the bean at 08:00Z
    When the branch is read at 08:10Z
    Then the bean is not held

  @test:scripts/tests/bean-drain.test.ts::open_work_naming_a_bean::a_bean_id_is_a_word,_not_a_substring
  Scenario: A bean id matches as a word, not a substring
    Then "identity: name who is typing (f1e1)" mentions "folio-assistant-f1e1"
    And "feat/f1e1-host" mentions "f1e1"
    And "xf1e1y" does not mention "f1e1"

  @test:scripts/tests/bean-drain.test.ts::open_work_naming_a_bean::the_f1e1_replay:_agy's_PR_was_open_before_the_second_start,_and_it_names_the_bean
  Scenario: The f1e1 replay: agy's open PR names the bean
    Given open PR 686 titled "feat(identity): ... (folio-assistant-f1e1)" on branch "feat/f1e1-host-and-multiuser-identity"
    When the pulls naming "f1e1" are found
    Then PR 686 is the only hit

  @test:scripts/tests/bean-drain.test.ts::open_work_naming_a_bean::an_unreadable_repository_is_listed,_so_no_hits_is_not_absence
  Scenario: An unreadable repository is listed so no hits is not taken as absence
    Given a GitHub whose open pulls request fails with "HTTP 403"
    When open work for path "scripts/x.ts" is looked up in repository "a/b"
    Then there are no hits
    And the unread list is "a/b: HTTP 403"

  @test:scripts/tests/bean-drain.test.ts::open_work_naming_a_bean::a_path_found_only_on_an_open_PR_head_(pomp_case_3)
  Scenario: A path found only on an open PR head is a hit
    Given open PR 7 on head "claude/prune" whose files include "scripts/viewer-prune.ts"
    When open work under prefix "scripts/viewer-" is looked up in repository "a/b"
    Then the one hit is an open-pr file match on PR 7 in "a/b", naming its head, author, creation time and the path

  @test:scripts/tests/bean-drain.test.ts::drain-queue_merge_and_grouping::the_newest_updated_at_wins_and_a_disagreement_is_listed
  Scenario: The copy with the newest updated_at wins and the disagreement is listed
    Given copy "fa" has the bean completed at 2026-10-24 and copy "ch" has it in-progress at 2026-10-16
    When the copies are merged
    Then the merged bean is completed
    And the disagreement lists both statuses and that "fa" was used

  @test:scripts/tests/bean-drain.test.ts::drain-queue_merge_and_grouping::a_bean_goes_to_its_holder,_else_to_the_owner_of_a_sibling_under_the_same_parent,_else_spare
  Scenario: A bean goes to its holder, else the owner of a sibling, else spare
    Given beans "held" and "sib" under parent P and "lone" under parent Q
    And "BPMN thread" holds "held"
    When the beans are grouped
    Then "BPMN thread" is given "held" and "sib"
    And "lone" is spare

  @test:scripts/tests/bean-drain.test.ts::claimCheck_end_to_end::a_free_bean_is_claimed_by_a_plain_commit_on_BOTH_copies,_without_touching_the_checkout
  Scenario: A free bean is claimed by a commit on both copies without touching the checkout
    Given two bean copies, each a clone of its own bare remote holding a todo bean q9z9 and checked out on "my-feature"
    When q9z9 is claim-checked with no open pulls
    Then the state is "claimed"
    And on each remote the bean's status is in-progress and names our session
    And the claim commit carries our session as its Claude-Session trailer and is authored by "Claude <noreply@anthropic.com>"
    And each clone is still on "my-feature"

  @test:scripts/tests/bean-drain.test.ts::claimCheck_end_to_end::an_open_PR_naming_the_bean_stops_the_claim,_and_nothing_is_written
  Scenario: An open PR naming the bean stops the claim and nothing is written
    Given one bean copy holding todo bean q9z9
    And an open PR 686 "work on q9z9" first committed by agy
    When q9z9 is claim-checked
    Then the state is "skip-open-pr" with a reason naming "#686"
    And the remote bean's status is still todo

  @test:scripts/tests/bean-drain.test.ts::claimCheck_end_to_end::another_agent's_fresh_commit_on_the_bean_is_a_skip
  Scenario: Another agent's fresh commit on the bean is a skip
    Given one bean copy where agy has just pushed q9z9 as in-progress
    When q9z9 is claim-checked
    Then the state is "skip-recent-commit" with a reason naming "agy"

  @test:scripts/tests/bean-drain.test.ts::claimCheck_end_to_end::an_unreachable_copy_is_unknown,_never_free
  Scenario: An unreachable copy is unknown, never free
    Given a copy path that does not exist
    When q9z9 is claim-checked
    Then the state is "unknown"

  @test:scripts/tests/bean-drain.test.ts::claimCheck_end_to_end::recentCommits_reads_a_glob_pathspec,_as_the_skill's_command_does
  Scenario: recentCommits reads a glob pathspec
    Given one bean copy with its seed commit fetched
    When the recent commits for "beans/defs/*q9z9--*" are read
    Then there is 1 commit
