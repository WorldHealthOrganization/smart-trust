# scripts/mount-instance-docs.ts (declaredGraphs) builds the graph-typology rows of a real
# layer's rail, and each must be marked as a kind row.
# Each Scenario names the test that executes it.
Feature: A layer's graph-typology rail rows are kind rows

  @test:scripts/tests/ui/navbar-kind-rows.test.ts::declaredGraphs'_rows_are_declared_kind_rows_(#2151)::there_are_rows_to_check,_so_an_empty_instance_is_not_a_pass
  Scenario: who-iris yields graph-typology rows to check
    Given the declared graphs of "who-iris" with a "docs" page path
    When its rows are built
    Then there is at least one row

  @test:scripts/tests/ui/navbar-kind-rows.test.ts::declaredGraphs'_rows_are_declared_kind_rows_(#2151)::every_one_carries_kind:_true
  Scenario: Every who-iris graph-typology row is marked as a kind row
    Given the declared graphs of "who-iris" with a "docs" page path
    When its rows are built
    Then no row lacks "kind" set to true
