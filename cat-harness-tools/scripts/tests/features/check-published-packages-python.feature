# scripts/check-published-packages.ts runs a published package's Python tests without writing
# __pycache__/ or .pytest_cache/ into the package directory.
# Each Scenario names the test that executes it.
Feature: Python package tests leave no cache behind

  @test:scripts/tests/check-published-packages-python.test.ts::pytest_run_the_way_the_gate_runs_it_leaves_no_cache_in_the_package
  Scenario: Pytest run as the gate runs it leaves no cache in the package
    # Skipped: when python3 cannot import pytest
    Given a scratch package with a module, a passing test and a pyproject setting the pythonpath
    When pytest is run there with the gate's arguments and Python environment
    Then it exits 0
    And no "__pycache__" or ".pytest_cache" directory exists anywhere in the package
