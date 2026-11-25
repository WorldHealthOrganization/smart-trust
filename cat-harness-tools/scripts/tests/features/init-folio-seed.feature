# scripts/init-folio.ts seedMainIfEmpty: an empty repository gets an empty main seeded before the bootstrap lands on a branch off it; a repository with history is never seeded over.
# Real git and real bare remotes in temp directories. Each Scenario names the test that executes it.
Feature: An empty repository is seeded with main before bootstrapping

  @test:scripts/tests/init-folio-seed.test.ts::an_empty_repository_is_seeded,_then_bootstrapped_on_a_branch::with_a_bare_remote:_main_exists_on_the_remote_BEFORE_the_bootstrap_branch
  Scenario: With a bare remote, main is seeded and pushed before the bootstrap branch
    Given a fresh repository on branch "trunk" whose origin is an empty bare remote
    When seedMainIfEmpty is called for "demo"
    Then it reports seeded on branch "bootstrap/demo", pushed
    And the remote has a main branch
    And HEAD is "bootstrap/demo", branched from main
    And main's tree is empty

  @test:scripts/tests/init-folio-seed.test.ts::an_empty_repository_is_seeded,_then_bootstrapped_on_a_branch::with_no_remote:_seeded_locally,_not_pushed
  Scenario: With no remote, main is seeded locally and not pushed
    Given a fresh repository with no remote
    When seedMainIfEmpty is called for "demo"
    Then it reports seeded on branch "bootstrap/demo", not pushed
    And main has exactly 1 commit

  @test:scripts/tests/init-folio-seed.test.ts::history_is_never_seeded_over::commits_but_no_main_is_REPORTED,_not_seeded
  Scenario: A repository with commits but no main is reported, not seeded
    Given a repository with one commit on "trunk" and no main
    When seedMainIfEmpty is called for "demo"
    Then it reports "no-main" with current branch "trunk"
    And HEAD is unchanged
    And no main branch exists

  @test:scripts/tests/init-folio-seed.test.ts::history_is_never_seeded_over::an_ordinary_repository_with_main_is_left_alone
  Scenario: A repository that already has main is left alone
    Given a repository with a commit on main
    When seedMainIfEmpty is called for "demo"
    Then it reports "has-main"

  @test:scripts/tests/init-folio-seed.test.ts::history_is_never_seeded_over::an_empty_checkout_whose_REMOTE_has_branches_stops_—_it_is_empty_only_because_nothing_was_fetched
  Scenario: An empty checkout whose remote has branches stops
    Given a bare remote with a main branch pushed from another clone
    And a fresh empty repository whose origin is that remote
    When seedMainIfEmpty is called for "demo"
    Then it reports "stopped"
    And the repository still has no HEAD commit

  @test:scripts/tests/init-folio-seed.test.ts::history_is_never_seeded_over::a_remote_that_cannot_be_asked_is_could-not-determine,_and_stops
  Scenario: A remote that cannot be queried stops the seed
    Given a fresh repository whose origin points at a path that does not exist
    When seedMainIfEmpty is called for "demo"
    Then it reports "stopped" with a reason containing "could not ask the remote"

  @test:scripts/tests/init-folio-seed.test.ts::--skip-vcs_still_puts_main_on_an_empty_remote_(dth-hrh,_2026-10-14)::a_cloud_checkout_on_an_unborn_feature_branch:_main_reaches_the_remote,_the_branch_is_kept
  Scenario: With --skip-vcs, an unborn feature branch still gets main on an empty remote
    Given a fresh repository on the unborn branch "claude/feature" whose origin is an empty bare remote
    When initFolio scaffolds a document folio there with skipVcs
    Then the remote has a main branch
    And HEAD is still "claude/feature"
    And "claude/feature" points at the remote's main commit

  @test:scripts/tests/init-folio-seed.test.ts::--skip-vcs_still_puts_main_on_an_empty_remote_(dth-hrh,_2026-10-14)::a_remote_with_branches_is_not_touched
  Scenario: With --skip-vcs, a remote that has branches is not touched
    Given a bare remote holding only a "trunk" branch
    And a fresh repository whose origin is that remote
    When initFolio scaffolds a document folio there with skipVcs
    Then the remote has no main branch
