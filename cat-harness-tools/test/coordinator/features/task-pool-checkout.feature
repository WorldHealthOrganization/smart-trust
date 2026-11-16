# Specifies TASK_IO (scripts/task-io.ts) against the checkout's script table.
Feature: Every script task-io declares exists in the checkout

  @test:test/coordinator/task-pool-checkout.test.ts::task-io_declarations::every_declared_script_exists_in_package.json
  Scenario: Every TASK_IO script is a package.json script
    Given the checkout's scripts (the test is skipped where the root has no package.json)
    When each script name TASK_IO declares is looked up
    Then every one exists
