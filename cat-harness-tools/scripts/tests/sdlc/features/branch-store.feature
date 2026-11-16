# scripts/branch-store.ts reads and writes a state branch on a real git remote:
# reads say hit, miss, corrupt or unknown, and writes splice paths onto the tip
# without force. Each Scenario names the test that executes it.
Feature: Branch store reads and writes

  @test:scripts/tests/sdlc/branch-store.test.ts::reading::hit:_a_file,_JSON,_a_directory_listing_and_a_tree,_at_the_tip
  Scenario: A file, JSON, a directory listing and a tree are read at the tip
    Given a bare remote with a seeded tip-keyed beans branch
    When a store opened on that branch reads them
    Then "beans/defs/a.md" is a hit on the branch at the seeded tip, with its text
    And "beans/workflows/w.json" reads as JSON with its $schema
    And listing "beans" gives "blob:bad.json", "tree:defs" and "tree:workflows"
    And the tree of "beans/defs" holds "beans/defs/a.md" and "beans/defs/b.md"

  @test:scripts/tests/sdlc/branch-store.test.ts::reading::miss:_a_path_not_at_the_tip,_and_a_branch_the_remote_does_not_have
  Scenario: A path not at the tip, and a branch the remote lacks, are misses
    Given a seeded beans branch
    When "beans/defs/zzz.md" is read from it
    Then the read is a miss
    And reading "todos/x.md" from the absent "cat/cat-harness/todos" branch is a miss

  @test:scripts/tests/sdlc/branch-store.test.ts::reading::candidate_names_are_asked_in_one_ls-remote,_and_the_first_present_one_is_read
  Scenario: Of several candidate branch names, the first present one is read
    # Gap: that the candidates are asked in a single ls-remote is not checked
    Given a seeded beans branch and an absent "cat/cat-harness/beans-new"
    When a store is opened on both names, the absent one first
    Then a read is a hit on the beans branch
    And the store's branch is the beans branch

  @test:scripts/tests/sdlc/branch-store.test.ts::reading::corrupt:_unparseable_JSON,_a_directory_read_as_a_file,_a_file_listed_as_a_directory
  Scenario: Unparseable JSON, a directory read as a file and a file listed as a directory are corrupt
    Given a seeded beans branch
    When "beans/bad.json" is read as JSON, "beans/defs" is read as a file and "beans/defs/a.md" is listed
    Then each result is corrupt

  @test:scripts/tests/sdlc/branch-store.test.ts::reading::corrupt:_a_branch_with_no_manifest,_a_foreign_one,_or_a_commit-keyed_one_is_not_a_state_branch
  Scenario: A branch with no, a foreign or a commit-keyed manifest is not a state branch
    Given branches with no manifest, a "qa-reports-manifest/v1" manifest, and a commit-keyed state manifest
    When a file is read from each
    Then each read is corrupt

  @test:scripts/tests/sdlc/branch-store.test.ts::reading::unknown:_an_unreachable_remote_is_never_a_miss
  Scenario: An unreachable remote is unknown, never a miss
    Given a store whose remote is a nonexistent file URL
    When a file is read
    Then the read is unknown

  @test:scripts/tests/sdlc/branch-store.test.ts::reading::a_path_escaping_the_branch_is_a_usage_error,_not_a_miss
  Scenario: A path escaping the branch is a usage error
    Given a store on the seeded beans branch
    When "../etc/passwd" or "/beans" is read
    Then a branch-store usage error is thrown

  @test:scripts/tests/sdlc/branch-store.test.ts::writing::a_splice_write_changes_only_the_named_paths_and_carries_every_other_file_across
  Scenario: A splice write changes only the named paths and carries the rest across
    Given a seeded beans branch
    When a write edits "beans/defs/a.md", adds "beans/defs/c.md" and deletes "beans/bad.json"
    Then it is pushed in one attempt and the remote tip is the new commit, whose parent is the seed
    And the commit's files are exactly the README, manifest, a.md, b.md, c.md and w.json
    And a.md holds the new text
    And the README, manifest, b.md and w.json keep their seeded blobs
    And a fresh store reads c.md as "new"

  @test:scripts/tests/sdlc/branch-store.test.ts::writing::writing_the_content_already_at_the_tip_pushes_nothing
  Scenario: Writing the content already at the tip pushes nothing
    Given a seeded beans branch
    When b.md is written with its existing text
    Then the result is unchanged
    And the remote tip is still the seed

  @test:scripts/tests/sdlc/branch-store.test.ts::writing::a_tip_that_moved_between_fetch_and_push_is_rejected,_and_the_retry_lands_on_the_new_tip_without_losing_the_sibling's_write
  Scenario: A tip moved between fetch and push is retried onto the new tip
    Given a sibling store that writes "sib.md" just before my first push
    When I write "mine.md"
    Then my write is pushed on the second attempt after one sleep
    And my commit's parent is the sibling's commit
    And my commit holds both "sibling" in sib.md and "mine" in mine.md

  @test:scripts/tests/sdlc/branch-store.test.ts::writing::an_`expect`_the_tip_disagrees_with_stops_the_write_as_conflict_and_pushes_nothing
  Scenario: An expected blob the tip disagrees with is a conflict and pushes nothing
    Given I read a.md, then another store writes a.md first
    When I write a.md expecting the blob I read
    Then the result is a conflict naming a.md and my expected blob
    And the remote tip has not moved
    And writing b.md expecting it not to exist is also a conflict

  @test:scripts/tests/sdlc/branch-store.test.ts::writing::an_absent_branch_is_never_created_by_a_write;_seeding_is_a_steward_act
  Scenario: A write never creates an absent branch
    Given a remote with no "cat/cat-harness/todos" branch
    When a store writes "todos/x.md" to it
    Then the result is absent
    And the remote still has no such branch

  @test:scripts/tests/sdlc/branch-store.test.ts::writing::the_branch's_own_manifest_and_README_cannot_be_written
  Scenario: The branch's own manifest and README cannot be written
    Given a store on the seeded beans branch
    When "manifest.json" or "README.md" is written
    Then a branch-store usage error is thrown

  @test:scripts/tests/sdlc/branch-store.test.ts::writing::never_force-pushes:_no_push_in_the_module_carries_-f,_--force_or_a_+_refspec
  Scenario: No push in the branch-store source carries a force flag
    Given the source text of scripts/branch-store.ts
    When its lines naming "push" are collected
    Then there is at least one
    And none carries "-f", "--force", "--force-with-lease" or a "+" refspec

  @test:scripts/tests/sdlc/branch-store.test.ts::route_keying::a_route-keyed_store_reads_its_own_branch
  Scenario: A route-keyed store reads its own branch
    Given a seeded route-keyed auto-docs branch
    When a route-keyed store reads "uml/overview/index.html"
    Then the read is a hit with "<p>old</p>"

  @test:scripts/tests/sdlc/branch-store.test.ts::route_keying::the_manifest_must_agree_with_the_keying_the_caller_opened_for,_BOTH_ways
  Scenario: The manifest's keying must match the store's, both ways
    Given a route-keyed auto-docs branch and a tip-keyed beans branch
    When the route branch is read by a tip store
    Then the read is corrupt with a reason "keyed by route, not tip"
    And reading the tip branch with a route store is corrupt with "keyed by tip, not route"

  @test:scripts/tests/sdlc/branch-store.test.ts::route_keying::a_route-keyed_write_REFUSES_`expect`,_naming_the_paths
  Scenario: A route-keyed write refuses an expected blob, naming the paths
    Given a route-keyed store on the auto-docs branch
    When it writes "uml/overview/index.html" with an expect of null or of a blob
    Then a branch-store usage error is thrown
    And its message names the path and says "one writer"
    And the page is still readable as a hit

  @test:scripts/tests/sdlc/branch-store.test.ts::route_keying::the_same_overwrite_that_is_a_tip_`conflict`_is_a_plain_push_when_route-keyed
  Scenario: An overwrite that conflicts on a tip branch is a plain push when route-keyed
    Given a route-keyed store on the auto-docs branch
    When it overwrites "uml/overview/index.html" with no expect
    Then the write is pushed and the remote tip moves
    And a fresh route store reads "<p>new</p>"
    And a tip store writing a.md with a stale expect is a conflict

  @test:scripts/tests/sdlc/branch-store.test.ts::route_keying::route-keyed_writes_are_still_not_allowed_to_touch_the_manifest_or_README
  Scenario: Route-keyed writes still cannot touch the manifest or README
    Given a route-keyed store on the auto-docs branch
    When "manifest.json" or "README.md" is written
    Then a branch-store usage error is thrown
