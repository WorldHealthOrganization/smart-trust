# scripts/lib/judge-tree.ts and the scripts/judge-tree.ts CLI: the tree digest names the whole
# judged tree, a verdict record holds to its schema, and the verdict-exists check answers only
# for this digest. Each Scenario names the test that executes it.
Feature: The judge-tree verdict on a tree digest

  @test:test/judge-tree.test.ts::tree_digest::is_the_same_for_the_same_tree,_whatever_order_the_lock_lists_instances_in
  Scenario: The tree digest does not depend on the order the lock lists instances in
    Given an index lock pinning bootstrap and cat-harness
    When the tree digest is taken for caller "cat-harness" at one tree, and again over the lock with its instances reversed
    Then both digests are equal
    And the digest is 64 lowercase hex digits

  @test:test/judge-tree.test.ts::tree_digest::replaces_the_caller's_locked_entry_by_its_PR_tree:_the_lock's_pin_of_the_caller_does_not_count
  Scenario: The caller's PR tree replaces its locked entry in the digest
    Given an index lock, and a copy where cat-harness's directory tree digest and declaration sha256 are changed
    When the tree digest is taken for caller "cat-harness" at the same tree over both
    Then both digests are equal
    And the listing holds the line "cat-harness, caller, git-tree:<tree>"
    And the listing does not hold the lock's directory digest for cat-harness

  @test:test/judge-tree.test.ts::tree_digest::changes_with_the_caller's_tree,_any_other_instance's_fixity_digest,_and_the_judging_version
  Scenario: The digest changes with the caller's tree, another instance's fixity digest, and the judging version
    Given the tree digest for caller "cat-harness" at tree T1 under judging version "v1"
    When the caller tree is T2, or the judging version is "v2", or bootstrap's directory tree digest changes
    Then each digest differs from the first

  @test:test/judge-tree.test.ts::tree_digest::names_the_caller_by_instance_or_by_repository;_a_caller_the_lock_does_not_pin_(index_mode)_is_added
  Scenario: The caller is named by instance or repository, and an unpinned caller is added
    Given an index lock pinning bootstrap and cat-harness
    When the digest is taken for caller "litlfred/cat-harness"
    Then it equals the digest for caller "cat-harness"
    And the listing for caller "smart-ra", which the lock does not pin, has 5 lines
    And it holds the line "smart-ra, caller, git-tree:<tree>"

  @test:test/judge-tree.test.ts::tree_digest::refuses_a_caller_tree_that_is_not_a_git_tree_id,_and_an_empty_judging_version
  Scenario: A caller tree that is not a git tree id, or an empty judging version, is refused
    Given an index lock
    When the digest is taken with caller tree "HEAD"
    Then it throws
    And taking it with an empty judging version also throws

  @test:test/judge-tree.test.ts::tree_digest::the_judging_version_hashes_this_checkout's_judging_scripts
  Scenario: The judging version hashes this checkout's judging scripts
    Given this checkout's .github/scripts/layer-pr-checks directory
    When the judging version is computed from its judging files
    Then it is "sha256:" followed by 64 hex digits
    And computing it again gives the same value
    And computing it from a missing scripts directory throws "judging scripts not found"

  @test:test/judge-tree.test.ts::runner::GitHub_Actions,_an_agent,_or_a_local_machine,_from_the_environment_alone
  Scenario: The runner is detected as GitHub Actions, an agent, or a local machine from the environment alone
    Given environments with GitHub Actions variables, with a Claude Code session id, or with only USER
    When the runner is detected
    Then GitHub Actions is "github-actions" with id "o/r/actions/runs/5/attempts/2"
    And a Claude Code session is "agent" with the session id
    And a plain machine is "local" with id "me@box"
    And JUDGE_RUNNER_KIND and JUDGE_RUNNER_ID override the detection
    And JUDGE_RUNNER_KIND "cloud" throws

  @test:test/judge-tree.test.ts::verdict_record::a_well-formed_record_validates
  Scenario: A well-formed verdict record validates
    Given a complete green verdict record
    When it is validated
    Then there are no errors

  @test:test/judge-tree.test.ts::verdict_record::the_validator_requires_what_the_schema_requires_and_admits_only_what_it_declares
  Scenario: The validator requires what the schema requires and admits only what it declares
    Given schemas/verdict-record.schema.json
    When each required property is removed from a record in turn
    Then the validator reports "missing <property>" each time
    And an extra property is reported as "unknown property extra"
    And the schema declares exactly the twelve top-level properties of a record
    And the verdict enum is green, red, unknown and the runner kind enum is agent, github-actions, local
    And a gate declares only baseExit, command, exit, name, new, seconds and skipped

  @test:test/judge-tree.test.ts::verdict_record::refuses_a_bad_digest,_runner,_verdict,_and_a_gate_both_skipped_and_exited
  Scenario: A bad digest, runner, verdict, start time, or a gate both skipped and exited is refused
    Given a well-formed verdict record
    When its treeDigest is "abc"
    Then the validator reports "treeDigest is not 64 hex digits"
    And a runner kind "cloud" is reported against runner
    And a verdict "pass" is reported against verdict
    And a gate with exit 0 and a skipped reason is reported as "exit is null exactly when skipped"
    And a startedAt of "yesterday" is reported against startedAt

  @test:test/judge-tree.test.ts::verdict_record::verdict:_green_only_when_both_comparisons_pass_and_a_gate_ran;_a_2_is_unknown,_never_green
  Scenario: The verdict is green only when both comparisons pass and a gate ran
    When the verdict is taken from the gate and test comparison exits and the number of gates run
    Then exits 0 and 0 with 3 gates run are green
    And an exit of 1 from either comparison is red
    And a gate comparison exit of 2 is unknown
    And no gates run is unknown

  @test:test/judge-tree.test.ts::verdict_record::a_stored_record_stands_in_for_a_base_run:_gates_and_failing_tests_round-trip
  Scenario: A stored record stands in for a base run
    Given a stored verdict record with a failed and a skipped gate
    When its gates report is rebuilt
    Then gate "x:check:b" has exit 1 and gate "x:check:live" keeps its skipped reason
    And a JUnit document written from two failing test names summarises back to 2 tests with the same failing names

  @test:test/judge-tree.test.ts::verdict_record::junit_summary_names_tests_as_compare-test-failures.py_does
  Scenario: The JUnit summary names failing tests as compare-test-failures.py does
    Given a JUnit document with nested suites, one failure and one error
    When it is summarised
    Then the total is 3
    And the failing names are "f.test.ts > d > bad & worse" and "f.test.ts > err"

  @test:test/judge-tree.test.ts::composing_the_existing_compare_scripts::new_gates_are_read_from_compare-gates.py's_own_table
  Scenario: New gates are read from compare-gates.py's own table
    Given a base gates report and a head report where gate a newly fails, gate c newly exits 2 and gate d is skipped
    When compare-gates.py compares them
    Then it exits 1 and its output names gates a and c as new
    And the gate entry for a has exit 1, base exit 0 and is new
    And the gate entry for d has a null exit, its skipped reason and is not new

  @test:test/judge-tree.test.ts::publishing_and_the_verdict-exists_decision::the_status_carries_the_digest;_unknown_is_an_error,_never_success
  Scenario: The published status carries the digest, and unknown is an error, never success
    Given a green verdict record and a run URL
    When the status payload is built
    Then its state is "success" and its context "judge-tree"
    And its target URL is the run URL with "#judge-tree=<digest>"
    And its description is at most 140 characters and names the first 16 digits of the digest
    And an unknown verdict gives state "error" and a red one "failure"

  @test:test/judge-tree.test.ts::publishing_and_the_verdict-exists_decision::passes_only_on_a_green_verdict_for_THIS_digest
  Scenario: The check passes only on a green verdict for this digest
    Given a tree digest
    When the candidates hold a green verdict for that digest, by full digest or by 16-digit prefix
    Then the check passes
    And a green verdict for another digest does not pass and says "no runner has judged this tree"
    And no candidates fail with "no runner has judged this tree (<digest>)"
    And a red verdict for the digest fails with "judged red"

  @test:test/judge-tree.test.ts::publishing_and_the_verdict-exists_decision::statuses:_the_newest_per_tree_answers,_other_contexts_are_ignored
  Scenario: The newest judge-tree status per tree answers, and other contexts are ignored
    Given a newer failure and an older success judge-tree status for one digest, and a "ci" status naming it
    When candidates are read from the statuses
    Then there is one candidate
    And the check for the digest does not pass

  @test:test/judge-tree.test.ts::publishing_and_the_verdict-exists_decision::the_REST_calls_go_through_the_injected_fetch,_with_the_token
  Scenario: The REST calls go through the injected fetch with the token
    Given a GitHub statuses client over a fake fetch with token "tok"
    When a status is posted and the statuses are listed for commit "abc1234" of "o/r"
    Then the post goes to "https://api.test/repos/o/r/statuses/abc1234" as POST with "Bearer tok" and a judge-tree context
    And the list reads "https://api.test/repos/o/r/commits/abc1234/statuses?per_page=100"
    And the listed green status passes the check
    And posting to repository "o/r; rm" is rejected

  @test:test/judge-tree.test.ts::publishing_and_the_verdict-exists_decision::the_sample_is_seeded:_the_same_seed_picks_the_same_run_gates,_never_a_skipped_one
  Scenario: The gate sample is seeded and never picks a skipped gate
    Given 20 run gates and one skipped gate
    When 3 gates are sampled with seed "sha1"
    Then 3 gates are picked
    And the same seed picks the same gates, and seed "sha2" picks different ones
    And sampling 100 never picks the skipped gate

  @test:test/judge-tree.test.ts::judge-tree.ts_end_to_end_(no_network,_no_gates_run)::judges_from_reports,_writes_a_valid_record,_and_check_finds_it_by_digest_only
  Scenario: The CLI judges from reports, writes a valid record, and check finds it by digest only
    Given an index lock, a base gates report and a head report where gate a passes, and no token
    When judge-tree.ts judges the tree T1 into a records directory
    Then it exits 0 and the record at "<digest>.json" validates, green, with runner local "test" and a run base
    And check finds a verdict for T1 and exits 1 for T2 with "no runner has judged this tree"
    And when head newly breaks gate a, judging T2 exits 1 and check reports "judged red"
    And a stored base verdict given for a different base tree exits 2 with "not the base tree"
    And a stored base verdict for its own tree is reused, recorded as a "stored-verdict" base
    And publish with no token exits 0 and says "not published"
    And sample re-runs one recorded command, says "agrees" and exits 0
