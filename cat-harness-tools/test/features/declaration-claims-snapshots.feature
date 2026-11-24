# historicalPrefixes in src/docs/declaration-claims.ts names the directories whose claims the
# declaration-claims walk leaves out, such as subscription snapshots of an upstream.
# Each Scenario names the test that executes it.
Feature: Declaration claims leave out snapshots

  @test:test/declaration-claims-snapshots.test.ts::historicalPrefixes::leaves_out_a_substrate-snapshot_directory
  Scenario: A substrate-snapshot directory is a historical prefix
    Given an instance "inst" declaring directory "subscriptions/" with graph typology "substrate-snapshot"
    When the historical prefixes under the root are computed
    Then they include "inst/subscriptions/"
