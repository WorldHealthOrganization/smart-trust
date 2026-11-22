# seed:ready judges whether a layer is settled enough to seed by evaluating
# the real decision table. Each Scenario names the test that executes it.
Feature: Seed readiness of a layer

  Background:
    Given a six-layer stack base, base-tools, harness, harness-tools, core and folio declared by `needs`
    And the real seed-readiness decision table

  @test:scripts/tests/seed-ready.test.ts::the_layer_map_comes_from_`needs`::depth_is_the_longest_chain,_and_the_next_layer_is_one_level_up
  Scenario: Depth is the longest chain and the next layer is one level up
    Then harness has depth 2 and its next layer is harness-tools
    And harness-tools has depth 3 and its next layer is core

  @test:scripts/tests/seed-ready.test.ts::the_layer_map_comes_from_`needs`::an_unknown_name_and_a_cycle_both_throw_rather_than_answer_about_another_stack
  Scenario: An unknown layer or a cycle throws
    Then planning "nope" throws "no instance declaration names"
    And planning a layer in a two-layer cycle throws "cycle"

  @test:scripts/tests/seed-ready.test.ts::the_layer_map_comes_from_`needs`::the_closure_a_rehearsal_copies_is_the_layer_and_everything_it_needs
  Scenario: The rehearsal closure is the layer and what it needs
    Then the closure of harness is base, base-tools and harness

  @test:scripts/tests/seed-ready.test.ts::the_gateway::a_quiet_source_and_a_clean_rehearsal_answer_settled
  Scenario: A quiet source and clean rehearsal are settled
    Given one open PR touching only folio and clean probes
    When harness is assessed
    Then the outcome is "settled" with exit 0 and every criterion passes

  @test:scripts/tests/seed-ready.test.ts::the_gateway::without_--rehearse_the_answer_is_unknown,_never_settled_(owner,_2026-10-02)
  Scenario: Without a rehearsal the answer is unknown
    Given settled requires a rehearsal
    And the standalone probe was not run
    When harness is assessed
    Then standalone is "could-not-determine", the outcome "unknown" and the exit code 2

  @test:scripts/tests/seed-ready.test.ts::the_gateway::a_labelled_heavy_mover_over_the_layer_is_not_yet;_one_elsewhere_is_not_counted
  Scenario: A labelled heavy mover over the layer fails
    Then a heavy-mover-labelled PR touching harness fails heavy-movers under Rule_HeavyMover
    And one touching only folio passes heavy-movers

  @test:scripts/tests/seed-ready.test.ts::the_gateway::a_label_that_cannot_be_read_is_could-not-determine,_not_a_pass
  Scenario: An unreadable heavy-mover label is could-not-determine
    Given whether the heavy-mover label exists is unknown
    When harness is assessed
    Then heavy-movers is "could-not-determine" and the outcome "unknown"

  @test:scripts/tests/seed-ready.test.ts::the_gateway::any_open_PR_on_the_next_layer_is_not_yet
  Scenario: An open PR on the next layer is not yet
    Given an open PR touching harness-tools
    When harness is assessed
    Then next-layer fails and the outcome is "not yet"

  @test:scripts/tests/seed-ready.test.ts::the_gateway::the_layer-load_limit_is_the_table's:_five_pass,_six_fail
  Scenario: The layer-load limit is five
    Then five open PRs touching harness pass layer-load
    And six fail it with outcome "not yet"

  @test:scripts/tests/seed-ready.test.ts::the_gateway::a_move_is_a_deletion_in_the_layer_or_a_rename_across_its_edge;_an_addition_is_not
  Scenario: Deletions and edge-crossing renames are moves, additions are not
    Then a PR adding a harness file passes layer-moves
    And removing a harness file, renaming one out of harness, or renaming one into harness each fail it

  @test:scripts/tests/seed-ready.test.ts::the_gateway::a_regenerated,_content-named_file_is_not_a_move:_deleting_it_changes_what_no_seeded_path_means_(owner,_2026-10-06)
  Scenario: Regenerated content-named files are not moves
    Then removing a hashed navbar rail or a sha256 payload, or renaming between payloads, passes layer-moves
    And removing the authored navbar.js fails
    And renaming an authored script to a rail name fails
    And a PR removing one rail and one authored script fails

  @test:scripts/tests/seed-ready.test.ts::the_gateway::a_PR_GitHub_truncated_is_undetermined_unless_what_WAS_seen_already_counts
  Scenario: A truncated PR is undetermined unless its seen files already fail
    Given a PR reporting 4000 changed files of which only a folio file is listed
    Then layer-load is "could-not-determine" and the outcome "unknown"
    And a truncated heavy-mover PR that lists a harness file fails heavy-movers with outcome "not yet"

  @test:scripts/tests/seed-ready.test.ts::the_gateway::open_PRs_that_could_not_be_listed_make_every_PR_criterion_could-not-determine
  Scenario: Unlistable PRs make every PR criterion undetermined
    Given the open PRs could not be listed
    When harness is assessed
    Then heavy-movers, next-layer, layer-load and layer-moves are all "could-not-determine" and the outcome "unknown"

  @test:scripts/tests/seed-ready.test.ts::the_gateway::a_red_rehearsal_or_an_upward_path_is_not_yet;_a_probe_that_errored_is_unknown
  Scenario: A red rehearsal or upward path is not yet; an errored probe is unknown
    Then a standalone probe with 3 failures selects Rule_Standalone
    And an upward-path probe with 1 finding selects Rule_UpwardPaths
    And an upward-path probe in error is "could-not-determine" with outcome "unknown"

  @test:scripts/tests/seed-ready.test.ts::the_probes::bun_test's_summary_is_read_for_the_failure_count_and_names
  Scenario: bun test output is parsed for failures
    Then a single-file summary gives 1 failure named "b > c"
    And a two-file summary keys each failure by its file
    And GitHub Actions group markers are keyed the same way
    And "Killed" parses to nothing

  @test:scripts/tests/seed-ready.test.ts::the_probes::a_file_that_fails_to_LOAD_is_named,_though_the_JUnit_report_has_no_case_for_it
  Scenario: A file that fails to load is named
    Given bun output with one failing test and one file failing to import a module
    When it is parsed
    Then there are 2 failures, the test named "b.test.ts > c"
    And the load error is named for a.test.ts with no temporary path

  @test:scripts/tests/seed-ready.test.ts::the_probes::a_load_error_not_spelled_`error:`_stays_with_its_own_file,_not_the_next_one
  Scenario: Load errors stay with their own file
    Given bun output with a TypeError, a bare ENOENT and an "error: ENOENT" load error in three files
    When it is parsed
    Then each load error is filed under its own file with temporary paths stripped

  @test:scripts/tests/seed-ready.test.ts::the_probes::the_JUnit_report_is_read_for_failing_names,_keyed_file_>_describe_>_test
  Scenario: The JUnit report is parsed for failing names
    Given a JUnit report with a failure in nested describes and one at file level
    When it is parsed
    Then the failures are "t.test.ts > D > E > x > y" and "sub/u.test.ts > z"
    And "Killed" parses to nothing

  @test:scripts/tests/seed-ready.test.ts::the_probes::upward_paths:_cat-harness_declares_paths,_and_none_resolves_only_above_it_(measured_2026-10-04)
  Scenario: No cat-harness path resolves only above it
    When upward paths are probed for cat-harness in the real checkout
    Then the probe is measured over more than 20 declared paths
    And its count equals its findings and there are none

  @test:scripts/tests/seed-ready.test.ts::the_probes::a_path_found_only_in_an_instance_above_the_layer_is_counted,_and_one_in_the_layer_is_not
  Scenario: Upward paths can be probed for core, and an unknown layer errors
    # Gap: asserts only that probing folio-assistant-core is "measured" and an unknown layer is "error"; no count is checked, so neither "counted" nor "not counted" is tested.
    When upward paths are probed for folio-assistant-core
    Then the probe is measured
    And probing "no-such-layer" is an error

  @test:scripts/tests/seed-ready.test.ts::the_probes::a_path_into_a_seeding_partner_(`seedsWith`)_is_stated,_not_counted_—_and_is_counted_without_it
  Scenario: Paths into a seeding partner are stated, not counted
    When upward paths for cat-harness are probed with and without seedsWith
    Then without it there are findings, each resolving only in cat-harness-tools
    And with it the count is 0 and the note states how many resolve into cat-harness-tools
