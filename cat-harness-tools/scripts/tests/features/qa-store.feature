# qa-store on real git repositories: a bare remote over file://, a private
# store per simulated container, and a work directory laid out like a
# checkout holding three files under cat-harness/test/results and one under
# other/test/results. The store branch is cat/cat-harness/qa-reports. Each
# Scenario names the test that executes it.
Feature: The qa-reports store reads in four states and writes without losing entries

  @test:scripts/tests/qa-store.test.ts::keys_and_refs::a_write_key_needs_a_full_sha;_a_read_ref_may_be_newest-of_or_a_prefix
  Scenario: A write key needs a full sha; a read ref may be a newest-of or a prefix
    Then "main/<sha>" and "pr/12/<sha>" are write keys
    And "main/abc1234" and "pr/0/<sha>" are usage errors as write keys
    And the read refs "main", "abc1234", "pr/7" and "pr/7/<sha>" parse as main-latest, a main prefix, pr-latest and a PR entry
    And "refs/heads/main" is a usage error as a read ref

  @test:scripts/tests/qa-store.test.ts::the_four_read_states::MISS:_no_branch_on_the_remote_is_a_determined_absence,_never_an_empty-clean_tree
  Scenario: No branch on the remote is a miss
    Given a remote with no store branch
    Then reading a file, reading a tree, and fetching are each "miss"
    And the tree read carries no files and the fetch creates no directory

  @test:scripts/tests/qa-store.test.ts::the_four_read_states::HIT:_a_publish_from_one_container_is_read,_byte-identical,_from_another
  Scenario: A publish from one container is read byte-identical from another
    When the two roots are published at main/<sha A> from one container
    Then the publish is "published" in one attempt
    And another container reads a file, a file by absolute path, a tree by sha prefix and the manifest (4 files, both roots) as hits with the same bytes
    And fetching "main" writes the 4 files and no manifest.json

  @test:scripts/tests/qa-store.test.ts::the_four_read_states::MISS_inside_a_hit_entry:_an_absent_file_or_prefix_is_a_miss,_not_an_empty_result
  Scenario: An absent file, prefix or entry inside a hit store is a miss
    Given main/<sha A> published
    Then reading a missing file, a missing prefix, main/<sha B>, and "pr/5" are each "miss"

  @test:scripts/tests/qa-store.test.ts::the_four_read_states::UNKNOWN:_an_unreachable_remote_is_could-not-determine,_never_a_miss
  Scenario: An unreachable remote is unknown
    Given a remote that does not exist
    Then reading a file and fetching are each "unknown"

  @test:scripts/tests/qa-store.test.ts::the_four_read_states::CORRUPT::a_file_that_does_not_parse_is_corrupt,_and_so_is_the_tree_holding_it
  Scenario: A file that does not parse is corrupt, and so is its tree
    Given a published result file holding a conflict marker
    Then reading it is "corrupt"
    And reading its tree is "corrupt", naming only it as bad
    And a sibling file still reads as a hit

  @test:scripts/tests/qa-store.test.ts::the_four_read_states::CORRUPT::a_payload_that_no_longer_matches_its_manifest_is_corrupt
  Scenario: A payload that no longer matches its manifest is corrupt
    Given a published entry whose result file was changed on the branch
    When the file is read
    Then it is "corrupt" with a reason naming the "payload tree"

  @test:scripts/tests/qa-store.test.ts::the_four_read_states::CORRUPT::an_entry_with_no_manifest,_and_an_index_naming_a_missing_entry,_are_corrupt
  Scenario: An entry with no manifest, and an index naming a missing entry, are corrupt
    Given a published entry whose manifest.json was removed on the branch
    Then reading from it is "corrupt"
    Given another store whose index names a main entry that does not exist
    Then reading "main" is "corrupt"

  @test:scripts/tests/qa-store.test.ts::the_four_read_states::CLI_exit_codes_follow_lake-cache:_0_hit,_1_miss,_2_usage,_3_corrupt,_4_unknown
  Scenario: The CLI's exit codes are 0 hit, 1 miss, 2 usage, 3 corrupt, 4 unknown
    Then fetching before anything is published exits as a miss
    And after a publish exits as a hit
    And with ref "refs/x" exits as a usage error
    And after the manifest is corrupted exits as corrupt
    And from a remote that does not exist exits as unknown

  @test:scripts/tests/qa-store.test.ts::writing::never_touches_the_checkout's_index_or_work_tree
  Scenario: Publishing never touches the checkout
    Given a committed checkout
    When it is published
    Then git status is unchanged and the checkout has no promisor configuration

  @test:scripts/tests/qa-store.test.ts::writing::an_entry_already_present_is_not_overwritten;_the_first_write_stands
  Scenario: An entry already present is not overwritten
    Given main/<sha A> published
    When the same content is published again at main/<sha A>
    Then the publish is "present" because it is "identical"
    When different content is published at main/<sha A>
    Then the publish is "present" because the "first write stands"
    And the stored file still holds the first content, at the first publish's commit

  @test:scripts/tests/qa-store.test.ts::writing::no_root_present_is_`empty`,_not_a_published_nothing
  Scenario: Publishing a root that is not there is empty
    When "nowhere/test/results" is published
    Then the publish is "empty" and the remote has no branches

  @test:scripts/tests/qa-store.test.ts::writing::CONCURRENT_WRITERS:_the_loser_is_rejected_by_the_ref_lock,_rebuilds_on_the_new_tip,_and_both_entries_survive
  Scenario: Concurrent writers both land on a linear history
    Given an entry published as a seed
    And writer A publishing main/<sha A> while writer B publishes pr/9999/<sha B> between A's fetch and push
    Then B publishes, and A publishes on its second attempt
    And the tip holds the seed's, A's and B's manifests on a first-parent chain of 3 ending at the seed
    And the PR entry reads as a hit, and the index names main <sha A> and PR 9999 <sha B>

  @test:scripts/tests/qa-store.test.ts::writing::MANY_LOST_RACES:_a_writer_that_loses_more_races_than_the_ordinary_budget_still_lands
  Scenario: A writer that keeps losing races keeps trying
    Given an entry published as a seed
    And a sibling that publishes between writer A's fetch and push on each of A's first five attempts
    Then A publishes on its sixth attempt
    And the tip holds A's entry and all five siblings'

  @test:scripts/tests/qa-store.test.ts::writing::a_lost_race_is_told_apart_from_any_other_rejection
  Scenario: Only a lost race earns the longer budget
    Then a rejection for "fetch first" or "non-fast-forward" is a lost race
    And a permission denial or a hook's refusal is not, and keeps the budget of 3

  @test:scripts/tests/qa-store.test.ts::writing::CONCURRENT_PROCESSES:_two_CLI_writers_started_together_both_land
  Scenario: Two CLI writers started together both land
    When two qa-store publish processes for main/<sha A> and main/<sha B> start together
    Then both exit 0
    And the branch's main/ holds exactly both entries

  @test:scripts/tests/qa-store.test.ts::CI_decision::push_to_main_publishes_main/<sha>
  Scenario: A push to main publishes main/<sha>
    Then a push to refs/heads/main publishes main/<sha>, checking out <sha>

  @test:scripts/tests/qa-store.test.ts::CI_decision::a_same-repo_PR_publishes_pr/<n>/<head-sha>,_keyed_by_the_head_and_not_the_merge_commit
  Scenario: A same-repo PR publishes under the head sha
    Then a same-repo pull_request for PR 42 with head <sha B> publishes pr/42/<sha B>, checking out the merge commit

  @test:scripts/tests/qa-store.test.ts::CI_decision::FORK_SKIP:_a_fork_PR_is_skipped_with_its_reason,_never_attempted
  Scenario: A fork PR is skipped with its reason
    Then a fork's pull_request does not publish, with a reason mentioning "read-only"
    And a merge_group event and a push to another branch do not publish

  @test:scripts/tests/qa-store.test.ts::CI_decision::FORK_SKIP_through_the_CLI:_exit_0,_a_::notice,_and_nothing_written_to_the_remote
  Scenario: A fork PR through the CLI exits 0 with a notice and writes nothing
    Given a fork pull_request event
    When qa-store publish --github runs
    Then it exits 0 printing "::notice title=qa:publish skipped::fork PR"
    And the remote has no branches

  @test:scripts/tests/qa-store.test.ts::prune::the_rule:_14_days_kept_whole,_one_per_day_after,_PRs_7_days_after_close,_unknown_kept
  Scenario: The prune rule
    Given main entries 10, 20 (two on one day), 100 (two on one day) and 200 days old and one undated, and PRs closed 8 days ago, closed 3 days ago, open and of unknown state
    When the prune is planned
    Then it removes the older entry of day 100, the older entry of day 20, and PR 1
    And notes mention PR 4 and the undated entry

  @test:scripts/tests/qa-store.test.ts::prune::dry_run_changes_nothing;_--apply_commits_on_the_tip_(no_history_rewrite)_and_keeps_the_rest
  Scenario: A dry-run prune changes nothing; --apply commits on the tip
    Given two main entries 120 days old on one day, one a day old, and PR 7 closed 10 days ago
    When the prune runs without --apply
    Then it is a "dry-run" planning to remove the older main entry and "pr/7", and the tip is unchanged
    When it runs with --apply
    Then it is "pruned" with a new commit whose parent is the old tip
    And the removed entries and PR 7's index row are gone while the others remain
    And a second --apply finds "nothing"

  @test:scripts/tests/qa-store.test.ts::every_branch_name_(bean_zlq9;_renames_32f6,_tlk2)::candidates:_any_spelling_of_the_QA_branch_yields_the_current_name_only_(oycs);_any_other_name_stands_alone
  Scenario: Any spelling of the QA branch yields the current name
    Then "cat/cat-harness/qa-reports", "cat-qa-reports" and "qa-reports" each have the candidates ["cat/cat-harness/qa-reports"]
    And "my-qa" stands alone
    And the branch picked from the names is the newest that exists, defaulting to "cat/cat-harness/qa-reports"

  @test:scripts/tests/qa-store.test.ts::every_branch_name_(bean_zlq9;_renames_32f6,_tlk2)::NEITHER_exists:_the_writer_creates_cat/cat-harness/qa-reports
  Scenario: With no branch, the writer creates cat/cat-harness/qa-reports
    When main/<sha A> is published to an empty remote
    Then it is "published" and the only branch is "cat/cat-harness/qa-reports"

  @test:scripts/tests/qa-store.test.ts::every_branch_name_(bean_zlq9;_renames_32f6,_tlk2)::ONLY_a_retired_name:_it_is_not_read,_and_a_writer_creates_cat/cat-harness/qa-reports_(oycs)
  Scenario: Only a retired branch name: it is not read, and a writer creates the new one
    Given an entry on a branch named "qa-reports"
    Then reading it through either name is "miss"
    When main/<sha B> is published
    Then "cat/cat-harness/qa-reports" is created holding only <sha B>, and "qa-reports" is unchanged

  @test:scripts/tests/qa-store.test.ts::every_branch_name_(bean_zlq9;_renames_32f6,_tlk2)::BOTH_exist:_the_new_name_wins_for_readers_and_writers;_the_legacy_branch_is_left_as_it_was
  Scenario: Both names exist: the new name wins and the legacy branch is left
    Given <sha A> on "qa-reports" and <sha B> on "cat/cat-harness/qa-reports"
    Then reading <sha A> is "miss" and reading <sha B> is a hit
    When main/<sha C> is published
    Then "qa-reports" is unchanged and the new branch holds <sha B> and <sha C>

  @test:scripts/tests/qa-store.test.ts::skipping_unchanged_QA_results_(folio-assistant-he8h)::publishing_an_unchanged_QA_result_skips_writing_duplicate_payload_trees
  Scenario: Publishing an unchanged result is skipped
    Given main/<sha A> published
    When the same content is published at main/<sha B>
    Then it is "skipped", "unchanged from main/<sha A>"
    And main/ holds only <sha A>, and the index points main at <sha B> recorded as skipped onto <sha A>

  @test:scripts/tests/qa-store.test.ts::skipping_unchanged_QA_results_(folio-assistant-he8h)::reading_at_the_skipped_commit_SHA_falls_back_to_prior_entry_and_returns_hit
  Scenario: Reading at a skipped commit falls back to the prior entry
    Given main/<sha B> skipped onto main/<sha A>
    Then reading a file, the manifest, and a tree at main/<sha B> are hits keyed main/<sha A>
    And the baseline against main/<sha B> is a hit from "qa-reports:main/<sha A>"
    And reading "main" resolves to main/<sha A>

  @test:scripts/tests/qa-store.test.ts::skipping_unchanged_QA_results_(folio-assistant-he8h)::publishing_a_changed_result_records_a_new_entry
  Scenario: Publishing a changed result records a new entry
    Given <sha B> skipped onto <sha A>, and then a result file changed
    When it is published at main/<sha C>
    Then it is "published" and main/ holds <sha A> and <sha C>
    And main/<sha C> reads the new content

  @test:scripts/tests/qa-store.test.ts::skipping_unchanged_QA_results_(folio-assistant-he8h)::an_unrecorded,_unskipped_commit_still_returns_miss
  Scenario: An unrecorded commit still misses
    Given main/<sha A> published
    Then a file, the manifest and a tree at main/<sha D> are each "miss"

  @test:scripts/tests/qa-store.test.ts::skipping_unchanged_QA_results_(folio-assistant-he8h)::PR_publishing_skips_unchanged_results_and_resolves_fallback
  Scenario: PR publishing skips unchanged results and resolves the fallback
    Given pr/42/<sha A> published
    When the same content is published at pr/42/<sha B>
    Then it is "skipped", "unchanged from pr/42/<sha A>", and pr/42/ holds only <sha A>
    And reading pr/42/<sha B> and "pr/42" are hits keyed pr/42/<sha A>

  @test:scripts/tests/qa-store.test.ts::skipping_unchanged_QA_results_(folio-assistant-he8h)::a_PR_skipped_onto_main's_entry_resolves_to_main's_entry,_not_to_one_under_the_PR
  Scenario: A PR skipped onto main's entry resolves to main's entry
    Given main/<sha A> published
    When the same content is published at pr/7/<sha B>
    Then it is "skipped", "unchanged from main/<sha A>"
    And reading a tree and a file at pr/7/<sha B> are hits keyed main/<sha A>

  @test:scripts/tests/qa-store.test.ts::skipping_unchanged_QA_results_(folio-assistant-he8h)::force:_true_forces_publish_even_if_content_is_unchanged
  Scenario: force publishes unchanged content
    Given main/<sha A> published
    When the same content is published at main/<sha B> with force
    Then it is "published" and main/ holds both

  @test:scripts/tests/qa-store.test.ts::skipping_unchanged_QA_results_(folio-assistant-he8h)::CLI_publish_exit_code_is_0_when_skipped_and_outputs_SKIPPED
  Scenario: The CLI exits 0 and says SKIPPED for an unchanged publish
    Given main/<sha A> published
    When the CLI publishes the same content at main/<sha B>
    Then it exits 0 printing "qa:publish SKIPPED main/<sha B>: unchanged from main/<sha A>"

  @test:scripts/tests/qa-store.test.ts::add-only_publish_(bean_1dre):_an_observation_added_to_the_commit's_existing_entry::adds_into_the_entry_the_gates_wrote,_and_the_entry_still_verifies;_the_first_write's_files_are_unchanged
  Scenario: An add-only publish adds into the gates' entry, which still verifies
    Given main/<sha A> published by the gates
    When "health/pages-serving.json" is added at main/<sha A> with a written_at
    Then the add is "added" keyed main/<sha A>
    And the observation and an original file read as hits
    And the manifest still counts 4 files with the original roots, and records the addition's written_at and 10 bytes

  @test:scripts/tests/qa-store.test.ts::add-only_publish_(bean_1dre):_an_observation_added_to_the_commit's_existing_entry::a_later_add_REPLACES_what_an_earlier_add_wrote_—_a_quiet_HEAD's_daily_observation_refreshes
  Scenario: A later add replaces an earlier add
    Given an observation added at main/<sha A>
    When a changed observation is added again
    Then it is "added", the observation reads the new content, and the manifest records 4 files and 11 bytes
    And adding the same bytes again is "present"

  @test:scripts/tests/qa-store.test.ts::add-only_publish_(bean_1dre):_an_observation_added_to_the_commit's_existing_entry::a_path_the_first_write_created_is_NEVER_changed:_conflict,_nothing_written
  Scenario: An add never changes a path the first write created
    Given main/<sha A> published
    When a changed copy of one of its files is added
    Then the add is a "conflict" naming that file
    And the file still reads the first content

  @test:scripts/tests/qa-store.test.ts::add-only_publish_(bean_1dre):_an_observation_added_to_the_commit's_existing_entry::NO_ENTRY:_nothing_is_created_—_the_commit's_first_write_stays_the_gates'
  Scenario: An add with no entry creates nothing
    Given main/<sha A> published
    When an observation is added at main/<sha B>
    Then the add is "no-entry" and the observation at main/<sha B> is a miss
    And a later forced gates publish of main/<sha B> is "published"

  @test:scripts/tests/qa-store.test.ts::add-only_publish_(bean_1dre):_an_observation_added_to_the_commit's_existing_entry::a_SKIPPED_commit_adds_into_the_entry_it_was_skipped_onto_—_the_one_its_readers_are_given
  Scenario: A skipped commit adds into the entry it was skipped onto
    Given main/<sha B> skipped onto main/<sha A>
    When an observation is added at main/<sha B>
    Then it is "added" keyed main/<sha A>
    And the "health" tree at main/<sha B> holds just the observation

  @test:scripts/tests/qa-store.test.ts::add-only_publish_(bean_1dre):_an_observation_added_to_the_commit's_existing_entry::a_commit_the_gates_have_not_published_yet_adds_into_its_nearest_recorded_ancestor_—_the_entry_its_readers_are_given
  Scenario: An unpublished commit adds into its nearest recorded ancestor
    Given commits a then b, with only a published
    When an observation is added at main/<b>
    Then it is "added" keyed main/<a>
    And the "health" tree at main/<b> is keyed main/<a> and holds just the observation

  @test:scripts/tests/qa-store.test.ts::add-only_publish_(bean_1dre):_an_observation_added_to_the_commit's_existing_entry::CLI:_--add_needs_a_--root;_added_is_exit_0,_no_entry_is_exit_1_(miss)
  Scenario: The CLI's --add needs a --root, exits 0 when added and 1 with no entry
    Given main/<sha A> published
    Then "publish --add" without --root exits as a usage error
    And with "--root health" it prints "ADDED" and exits 0
    And at main/<sha C> it exits as a miss
