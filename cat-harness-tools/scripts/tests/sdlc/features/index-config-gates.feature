# The gates over index.config.json (scripts/check-landing-instance.ts, check-index-ignores.ts) and the root scans
# folded into its shared helpers (check-avatar-instances.ts, check-folio-mount.ts, check-instance-config.ts).
# Each Scenario names the test that executes it.
Feature: Gates over index.config.json

  @test:scripts/tests/sdlc/index-config-gates.test.ts::the_folded_root_scans::check-avatar-instances_and_check-folio-mount_read_the_instantiated_set,_index_first
  Scenario: The avatar and folio-mount scans read the instantiated set, preferring the index
    Given a root with "a.config.json", "harness.config.json" and an index listing "a" and remote "m"
    When check-avatar-instances and check-folio-mount list the instances
    Then both give "a" and "m"
    Given a root with "a.config.json" and "harness.config.json" but no index
    Then both give only "a", the retired "harness" left out

  @test:scripts/tests/sdlc/index-config-gates.test.ts::the_folded_root_scans::check-instance-config_never_reports_the_reserved_index_as_an_orphan_config
  Scenario: The reserved index config is never an orphan
    Given a root with instance "x", its config and an index listing "x"
    When check-instance-config sweeps the root
    Then there are no orphan findings

  @test:scripts/tests/sdlc/index-config-gates.test.ts::check:landing-instance_over_an_index::an_index_landing_on_an_unlisted_instance_FAILS_the_gate,_and_never_falls_back_to_a_flag
  Scenario: An index landing on an unlisted instance fails, even with a landing flag elsewhere
    Given an index listing "a" and "b" with landing "c", and "a.config.json" flagging itself as landing
    When the landing instance is checked
    Then the check fails

  @test:scripts/tests/sdlc/index-config-gates.test.ts::check:landing-instance_over_an_index::an_index_landing_passes,_and_says_it_came_from_the_index
  Scenario: An index landing on a listed instance passes and names the index
    Given an index listing "a" and "b" with landing "a"
    When the landing instance is checked
    Then the check passes
    And its text mentions "index.config.json"

  @test:scripts/tests/sdlc/index-config-gates.test.ts::check:landing-instance_over_an_index::agreement_with_the_root_configs:_an_unlisted_config_fails,_a_config-less_entry_does_not
  Scenario: Index agreement fails on an unlisted config but not on a config-less entry
    Given a root with "stray.config.json" the index does not list
    Then the agreement check fails
    Given a root whose index lists "c", which has no config
    Then the agreement check passes
    And with no agreement to judge, the check passes

  @test:scripts/tests/sdlc/index-config-gates.test.ts::check:index-ignores::missing_and_drifted_blocks_fail;_a_synced_block_passes
  Scenario: A missing or drifted ignore block fails and a synced one passes
    Given an index with remote instance "m" and a ".gitignore" with no block
    Then the ignore-block check fails
    When the block is synced
    Then the check passes
    And checking it against an extra entry "extra" fails

  @test:scripts/tests/sdlc/index-config-gates.test.ts::check:index-ignores::this_repository's_own_block_agrees_with_its_index,_and_its_landing_is_cat-harness
  Scenario: This repository's own ignore block and configs agree with its index
    # Gap: that the landing is cat-harness is not asserted
    Given this monorepo's own index.config.json
    Then it reads as "ok"
    And its ignore block is "current"
    And the index agrees with the root configs
