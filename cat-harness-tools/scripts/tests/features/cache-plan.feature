# scripts/cache-plan.ts (cache:plan) derives which caches a target needs from its recorded read set, judges
# each one stale or current, and plans restore, refresh or skip. Each Scenario names the test that executes it.
Feature: Planning which caches a target restores

  @test:scripts/tests/cache-plan.test.ts::under::a_path_under_a_materialized_dir,_or_equal_to_it;_never_a_home_path;_no_prefix_confusion
  Scenario: A path is under a materialized directory only by real containment
    Given materialized directories "node_modules/", ".lake/build" and "~/.cache/x"
    When paths are tested against them
    Then "node_modules/a" is under "node_modules/"
    And ".lake/build" is under ".lake/build"
    And "node_modules_x/a" is not under "node_modules/"
    And "x" is not under the home path "~/.cache/x"

  @test:scripts/tests/cache-plan.test.ts::needed_is_derived::a_read_under_materializes_makes_a_cache_needed,_and_its_needs_closure_too
  Scenario: A read under a cache's materialized directory makes it and its needs needed
    Given caches layers-ref, node-modules, lean and jekyll, and a record of "check:lint" reading under "node_modules/"
    When "check:lint" is planned
    Then node-modules is needed because "check:lint reads node_modules/"
    And layers-ref is needed, "needed by node-modules"
    And lean is not needed and is skipped
    And jekyll is not needed

  @test:scripts/tests/cache-plan.test.ts::needed_is_derived::closure_through_two_levels:_jekyll_→_node-modules_→_layers-ref
  Scenario: The needs closure runs through two levels
    Given a record of "docs:build" reading under ".jekyll-cache/"
    When "docs:build" is planned
    Then exactly jekyll, node-modules and layers-ref are needed

  @test:scripts/tests/cache-plan.test.ts::needed_is_derived::a_target_with_no_record:_could_not_derive,_nothing_restored,_it_builds
  Scenario: A target with no record restores nothing and builds
    Given no record for "check:unknown"
    When "check:unknown" is planned
    Then the plan lists it as undetermined because it "cannot be derived"
    And every cache is skipped
    And the reason given says "the target builds"

  @test:scripts/tests/cache-plan.test.ts::needed_is_derived::readSets_unions_the_ci-cone_and_writer-cone_records
  Scenario: readSets unions the ci-cone and writer-cone records
    Given a checks record for "check:lint" and a writers record for "docs:build"
    When the read sets of both targets are taken
    Then "check:lint" reads "node_modules/eslint/index.js" and "src/a.ts"
    And "docs:build" reads ".jekyll-cache/x"

  @test:scripts/tests/cache-plan.test.ts::stale_is_computed;_undetermined_counts_as_stale::no_stored_key:_undetermined_→_refresh,_never_restore
  Scenario: With no stored key a needed cache is refreshed, never restored
    Given no stored cache keys
    When "check:lint" is planned
    Then node-modules is undetermined and planned "refresh-whole"
    And layers-ref, which refreshes incrementally, is planned "refresh-incremental"

  @test:scripts/tests/cache-plan.test.ts::stale_is_computed;_undetermined_counts_as_stale::an_implied_key_equal_to_the_stored_key_→_restore;_different_→_refresh
  Scenario: A hashFiles key over no file is undetermined and refreshed even with a stored key
    # Gap: the title claims restore on an equal key; this test only checks the undetermined case
    Given a hashFiles cache over no files with a stored key "k"
    When "check:lint" is planned
    Then the cache is undetermined and planned "refresh-whole"

  @test:scripts/tests/cache-plan.test.ts::order_and_cost::needs_order_in_batches;_independent_caches_share_a_batch
  Scenario: Caches are batched in needs order with independent caches sharing a batch
    Given caches layers-ref, node-modules, lean and jekyll
    When they are batched
    Then none is refused
    And layers-ref is in batch 0, node-modules and lean in batch 1, and jekyll in batch 2

  @test:scripts/tests/cache-plan.test.ts::order_and_cost::a_cycle_or_an_unknown_needs_id_is_refused_and_planned_skip
  Scenario: A needs cycle or an unknown needs id is refused and skipped
    Given caches a and b that need each other, and c that needs the unknown "nope"
    When a target reading under a's directory is planned
    Then a, b and c are refused
    And every cache is skipped

  @test:scripts/tests/cache-plan.test.ts::order_and_cost::cost_comes_only_from_the_report;_otherwise_unknown
  Scenario: Cost comes only from the report
    Given a stored report for node-modules of 1048576 bytes and hit rate 0.5
    When "check:lint" is planned
    Then node-modules carries that size and hit rate as its cost
    And lean's cost is "unknown"

  @test:scripts/tests/cache-plan.test.ts::order_and_cost::the_plan_is_machine-readable
  Scenario: The plan declares a machine-readable schema
    When "check:lint" is planned
    Then the plan's schema is "cache-plan/1"

  @test:scripts/tests/cache-plan.test.ts::fresh_(implied_key_equals_the_stored_key)_→_restore;_a_different_stored_key_→_refresh
  Scenario: A stored key equal to the implied key restores, a different one refreshes
    Given a hashFiles cache over "lock.json" and the implied key of that file
    When it is planned with the implied key stored
    Then it is "current" and planned "restore"
    And when it is planned with the stored key "old-key" it is "stale" and planned "refresh-whole"

  @test:scripts/tests/cache-plan.test.ts::a_needed_node_whose_producer_reads_unmeasured_state_is_refreshed,_never_restored
  Scenario: A needed cache whose producer reads unmeasured state is never restored
    Given a cache "pages" materializing "docs/" whose state inputs are unmeasured, with a stored key
    And a writer "w" that reads "docs/a.html"
    When "w" is planned
    Then pages is undetermined
    And it is not planned "restore"
