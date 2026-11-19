# state:seed refreshes a seeded state branch to its source ref, refuses what
# must not be refreshed, and carries a folio's cutover and an instance's
# separation into fsh-guts. Each Scenario names the test that executes it.
Feature: Seeding, cutting over and retiring state

  @test:scripts/tests/state-seed.test.ts::a_seed_that_is_already_current::is_`current`,_pushes_nothing,_and_exits_0
  Scenario: A current seed is left alone
    Given a beans seed taken from main's tip
    When it is refreshed
    Then the state is "current" and the exit code 0

  @test:scripts/tests/state-seed.test.ts::a_drifted_seed::is_refreshed_to_the_source_ref,_verified_by_RE-READING_the_tip,_and_`state:drift`_then_agrees
  Scenario: A drifted seed is refreshed and verified
    Given main gains a file under beans after the seed, so drift reports "drift"
    When the seed is refreshed
    Then it is "refreshed", verified, with 2 files and exit code 0
    And drift then reports "in-sync" and the branch manifest records refreshedAt

  @test:scripts/tests/state-seed.test.ts::a_drifted_seed::`--dry-run`_reports_what_it_WOULD_push_and_pushes_nothing
  Scenario: A dry run refresh pushes nothing
    Given a drifted seed
    When it is refreshed as a dry run
    Then it is "refreshed" with no commit and drift still reports "drift"

  @test:scripts/tests/state-seed.test.ts::what_it_refuses::`authoritative:_true`_—_the_branch_IS_the_store,_so_a_refresh_would_overwrite_live_edits
  Scenario: An authoritative branch is refused
    Given a seed whose manifest is authoritative
    When it is refreshed
    Then it is "refused" saying it "IS the store", with exit code 5

  @test:scripts/tests/state-seed.test.ts::what_it_refuses::`status:_retired`_—_a_superseded_seed_must_not_be_made_to_look_current
  Scenario: A retired seed is refused
    Given a seed whose status is retired
    When it is refreshed
    Then it is "refused" saying "RETIRED"

  @test:scripts/tests/state-seed.test.ts::what_it_refuses::no_root_manifest_—_a_stray_branch_is_not_a_seed_of_anything
  Scenario: A branch with no manifest is refused
    Given the branch is a copy of main with no manifest
    When it is refreshed
    Then it is "refused" saying it is "not a seed of anything"

  @test:scripts/tests/state-seed.test.ts::what_it_refuses::a_branch_that_is_not_there_at_all_is_`unknown`,_never_a_pass
  Scenario: A missing branch is unknown
    When a branch that does not exist is refreshed
    Then the state is "unknown" with exit code 4

  @test:scripts/tests/state-seed.test.ts::the_cutover's_branch_half::`--authoritative`_marks_the_branch_the_store,_and_the_next_refresh_is_REFUSED
  Scenario: --authoritative makes the branch the store
    Given a drifted seed
    When it is refreshed with authoritative
    Then it is "refreshed" and verified
    And the manifest is authoritative with status "authoritative" and an authoritativeSince
    And drift reports "authoritative"
    And a further refresh is refused

  @test:scripts/tests/state-seed.test.ts::the_key_it_takes::`rowFor`_matches_an_observed_row_by_id,_so_the_live_rows_are_the_vocabulary
  Scenario: rowFor matches observed rows by id
    Then beans is cat/cat-harness/beans and todos is cat/cat-harness/todos
    And an unknown id has no row

  @test:scripts/tests/state-seed.test.ts::the_key_it_takes::a_branch_FAMILY_is_refused:_a_prefix_is_not_a_seed
  Scenario: A branch family is refused
    When a family row is refreshed
    Then it is "refused" saying "branch FAMILY"

  @test:scripts/tests/state-seed.test.ts::a_folio's_own_repository_(hp54)::the_default_repository_is_the_cwd's_git_toplevel,_and_resolves_the_folio's_branch
  Scenario: The default repository is the git toplevel of the cwd
    Given a folio x declaring beans on cat/x/beans
    Then the default repository root from its beans directory is the folio's root
    And after seeding, its observed beans row is cat/x/beans

  @test:scripts/tests/state-seed.test.ts::a_folio's_own_repository_(hp54)::the_CLI_run_FROM_the_folio_root_resolves_the_folio's_branch,_not_the_platform's
  Scenario: The CLI run from the folio resolves the folio's branch
    Given the folio's authoritative tip-keyed beans seed
    When the CLI runs --id beans --cutover from the folio root
    Then it names cat/x/beans, prints "would-cut-over" and exits 0

  @test:scripts/tests/state-seed.test.ts::a_folio's_own_repository_(hp54)::--cutover_refuses_a_branch_whose_manifest_is_not_tip-keyed_(the_mount_would_be_corrupt)
  Scenario: Cutover refuses a manifest that is not tip-keyed
    Given an authoritative seed with no keyedBy
    When it is cut over
    Then it is "refused" saying "not tip"

  @test:scripts/tests/state-seed.test.ts::a_folio's_own_repository_(hp54)::--cutover_refuses_while_the_branch_is_not_authoritative
  Scenario: Cutover refuses a branch that is not authoritative
    Given a tip-keyed seed that is not authoritative
    When it is cut over
    Then it is "refused" naming "authoritative"

  @test:scripts/tests/state-seed.test.ts::a_folio's_own_repository_(hp54)::--cutover_refuses_when_the_branch's_tree_is_not_byte-identical_to_HEAD's
  Scenario: Cutover refuses a branch that differs from HEAD
    Given an authoritative seed and a later edit on main
    When it is cut over
    Then it is "refused" saying "not byte-identical"

  @test:scripts/tests/state-seed.test.ts::a_folio's_own_repository_(hp54)::--cutover_refuses_a_path_no_declaration_keeps_on_that_branch
  Scenario: Cutover refuses a path no declaration keeps on the branch
    Given a checkout tracking beans but declaring nothing, with an authoritative seed
    When it is cut over
    Then it is "refused" saying "Declare"

  @test:scripts/tests/state-seed.test.ts::a_folio's_own_repository_(hp54)::dry_run_reports_files_and_bytes;_--commit_removes_and_ignores_in_ONE_commit,_and_pushes_nothing
  Scenario: Cutover dry run reports and --commit removes in one commit
    Given the folio's authoritative tip-keyed seed
    When it is cut over as a dry run
    Then it "would-cut-over" beans with 1 file of 4 bytes and touches nothing
    When it is cut over with commit
    Then it is "cut-over" in exactly one new commit that removes beans, ignores /beans/** and names cat/x/beans
    And origin's main is unchanged and a further cutover is refused

  @test:scripts/tests/state-seed.test.ts::a_folio's_own_repository_(hp54)::the_deposit_into_fsh-guts::deposit_THEN_remove:_the_fsh-guts_commit_exists_before_main's,_and_main's_names_it
  Scenario: The fsh-guts deposit precedes the removal and is named by it
    When the folio's beans is cut over with commit
    Then one deposit is made on cat/x/fsh-guts as a retired cutover archive named for the tree
    And the deposit commit is the fetched branch tip, no later than the removal commit
    And the removal commit names the deposit and the record is on the branch

  @test:scripts/tests/state-seed.test.ts::a_folio's_own_repository_(hp54)::the_deposit_into_fsh-guts::the_deposited_archive_extracts_to_EXACTLY_the_removed_tree,_and_the_record_carries_the_provenance
  Scenario: The deposited archive is exactly the removed tree
    Given beans holds an executable, a .gitignore and a file it ignores but tracks
    When it is cut over with commit
    Then the archive's tree id equals the removed tree's
    And the record is a cutover-snapshot naming the move, the instance, the source commit, the tree and the authoritative branch

  @test:scripts/tests/state-seed.test.ts::a_folio's_own_repository_(hp54)::the_deposit_into_fsh-guts::REFUSES_when_the_instance_declares_no_fsh-guts_graph,_naming_the_fix_—_and_removes_nothing
  Scenario: Cutover refuses an instance with no fsh-guts graph
    Given a folio declaring no fsh-guts
    When it is cut over, dry run and with commit
    Then each is refused saying it "declares no `fsh-guts` graph" and naming cat/x/fsh-guts
    And HEAD is unchanged and beans is still tracked

  @test:scripts/tests/state-seed.test.ts::a_folio's_own_repository_(hp54)::the_deposit_into_fsh-guts::REFUSES_when_the_deposit_cannot_be_made_(declared,_branch_never_seeded)_—_and_removes_nothing
  Scenario: Cutover refuses when the deposit branch was never seeded
    Given fsh-guts declared but its branch never seeded
    Then a dry run cutover is refused
    And a cutover with commit is refused naming cat/x/fsh-guts and "nothing was removed"
    And HEAD and the working tree are unchanged

  @test:scripts/tests/state-seed.test.ts::a_folio's_own_repository_(hp54)::the_deposit_into_fsh-guts::REFUSES_when_an_item_of_the_same_name_with_different_content_is_already_there_—_never_overwrites
  Scenario: Cutover refuses to overwrite a different item of the same name
    Given fsh-guts already holds a different file at the archive's name
    When it is cut over with commit
    Then it is refused saying "different content"
    And HEAD is unchanged and the existing file is kept

  @test:scripts/tests/state-seed.test.ts::separating_an_instance_(--retire)::a_root_eol=crlf_attribute_does_not_make_the_snapshot_differ_from_HEAD_(folio-assistant-sci,_2026-10-07)
  Scenario: A root eol=crlf attribute does not block retiring
    Given a host with a leaf instance and a root *.bat eol=crlf attribute
    When the leaf is retired as a dry run
    Then it "would-retire"

  @test:scripts/tests/state-seed.test.ts::separating_an_instance_(--retire)::dry_run_deposits_nothing_and_removes_nothing
  Scenario: A retire dry run changes nothing
    When the leaf is retired as a dry run
    Then it "would-retire", HEAD is unchanged and fsh-guts/separated is empty

  @test:scripts/tests/state-seed.test.ts::separating_an_instance_(--retire)::--commit_deposits_into_the_HOST's_fsh-guts,_then_removes_the_root_and_its_--also_files_in_ONE_unpushed_commit
  Scenario: Retiring deposits into the host's fsh-guts and removes the root in one commit
    When the leaf is retired with commit, an --also config file and a work item id
    Then it is "retired" with an archive fsh-guts/separated/leaf.tar.gz on cat/h/fsh-guts
    And exactly one new commit removes leaf and leaf.config.json, and origin's main is unchanged
    And the archive holds both at their original tree ids
    And the record is a frozen subtree naming the move, the fork, the head commit, the instance, the host and the work item, with every required field and the paths with counts and bytes
    And retiring again is refused

  @test:scripts/tests/state-seed.test.ts::separating_an_instance_(--retire)::REFUSES_a_directory_that_is_not_an_instance_root_—_that_is_a_cutover
  Scenario: Retiring refuses a directory that is not an instance root
    When leaf/docs is retired
    Then it is refused saying "not an instance root"

  @test:scripts/tests/state-seed.test.ts::separating_an_instance_(--retire)::REFUSES_--into_the_instance_that_is_leaving,_or_one_that_does_not_exist
  Scenario: Retiring refuses a host that is the leaving instance or missing
    Then retiring into "leaf" or "nope" is refused saying "no OTHER instance"

  @test:scripts/tests/state-seed.test.ts::separating_an_instance_(--retire)::REFUSES_when_the_host_keeps_no_fsh-guts,_naming_the_fix_—_and_removes_nothing
  Scenario: Retiring refuses a host with no fsh-guts
    Given a host declaring no fsh-guts
    When the leaf is retired with commit
    Then it is refused saying "declares no `fsh-guts` graph" and HEAD is unchanged

  @test:scripts/tests/state-seed.test.ts::separating_an_instance_(--retire)::a_repository_that_does_not_answer_is_`unknown`,_never_a_guess_—_and_removes_nothing
  Scenario: An unreachable live repository is unknown
    When the leaf is retired with commit naming a repository that does not exist
    Then it is "unknown", HEAD is unchanged and nothing is deposited

  @test:scripts/tests/state-seed.test.ts::separating_an_instance_(--retire)::REFUSES_uncommitted_changes_under_the_root
  Scenario: Retiring refuses uncommitted changes
    Given an uncommitted edit under leaf
    When the leaf is retired with commit
    Then it is refused saying "uncommitted"

  @test:scripts/tests/state-seed.test.ts::separating_an_instance_(--retire)::REFUSES_rather_than_overwrite_an_item_of_the_same_name_already_in_the_host's_trashcan
  Scenario: Retiring refuses to overwrite a different archive
    Given the host's fsh-guts already holds a different leaf.tar.gz
    When the leaf is retired with commit
    Then it is refused saying "different content" and HEAD is unchanged
