# The change-set route of the corpus gate for a layer whose workflow store is kept on a branch:
# startedSince in src/workflow/change-set-coverage.ts and storedChangeSets in src/workflow/corpus-gate.ts.
# Each Scenario names the test that executes it.
Feature: A change set in the mounted workflow store covers its blocks

  @test:test/corpus-gate-changeset-store.test.ts::startedSince::keeps_running_change_sets_started_after_the_base,_and_nothing_else
  Scenario: Only running change sets started after the PR's base count
    Given change-set instances started before and after the base, a completed one, an editing instance and an undated one
    Then only the running change set started after the base is kept

  @test:test/corpus-gate-changeset-store.test.ts::startedSince::an_unparseable_base_admits_nothing
  Scenario: An unparseable base admits nothing
    Then no instance is kept

  @test:test/corpus-gate-changeset-store.test.ts::startedSince::a_stored_change_set_started_since_the_base_covers_the_blocks_it_names
  Scenario: A stored change set covers the blocks it names
    Then a block it names is covered and one it does not name is refused with a near-miss reason

  @test:test/corpus-gate-changeset-store.test.ts::storedChangeSets::reads_the_store_and_keeps_only_change_sets_started_since_the_base
  Scenario: The store is read
    Given a workflow store holding change sets started before and after the base
    Then only the one started after the base is returned

  @test:test/corpus-gate-changeset-store.test.ts::storedChangeSets::an_unmounted_store_gives_no_cover_rather_than_a_crash
  Scenario: An unmounted store gives no cover
    Given a bean graph declared on a branch that is not mounted
    Then no change set is returned and nothing throws
