# test/health/run.ts healthResultPath: where the health report is written, following the
# declared health directory into its mount when it is stored on a branch.
# Each Scenario names the test that executes it.
Feature: Health report path follows the graph

  @test:scripts/tests/health-result-path.test.ts::healthResultPath::not_moved:_the_declared_directory_in_the_checkout
  Scenario: An unmoved health directory puts the report in the checkout
    Given a git repository declaring the health directory "test/health/results/" with no storage
    And that directory exists in the checkout
    When the health result path is resolved
    Then it is the health report file under test/health/results in the checkout

  @test:scripts/tests/health-result-path.test.ts::healthResultPath::mounted:_the_report_follows_the_graph
  Scenario: A mounted health directory puts the report in the mount
    Given a git repository declaring the health directory stored on branch "cat/cat-harness/health"
    And a mount marker mounting it into "health-mount"
    When the health result path is resolved
    Then it is the health report file inside the mount directory

  @test:scripts/tests/health-result-path.test.ts::healthResultPath::unreachable:_THROWS_rather_than_naming_a_directory_mkdirSync_would_happily_create
  Scenario: An unreachable stored health directory throws instead of naming a path
    Given a git repository declaring the health directory stored on a branch
    And no mount marker for it
    When the health result path is resolved
    Then it throws saying it cannot write the health report and naming "state:mount"

  @test:scripts/tests/health-result-path.test.ts::healthResultPath::nothing_declared:_the_conventional_layout,_unchanged_—_an_unmigrated_instance_is_fine,_not_wrong
  Scenario: With no directory declared the conventional layout is used
    Given a git repository declaring no directories
    When the health result path is resolved
    Then it is the health report file under test/health/results in the checkout
