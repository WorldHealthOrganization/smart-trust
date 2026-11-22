# scripts/backoff-sleep.ts is imported for its constants by synchronous require() chains,
# so its CLI block must not make the module async with a top-level await.
# Each Scenario names the test that executes it.
Feature: backoff-sleep stays a synchronous module

  @test:scripts/tests/backoff-sleep-sync-module.test.ts::backoff-sleep_stays_a_synchronous_module::its_CLI_block_does_not_await
  Scenario: The backoff-sleep CLI block contains no await
    Given the source of scripts/backoff-sleep.ts
    Then it contains an "if (import.meta.main) {" block
    And from that block on, outside comment lines, no "await" appears
