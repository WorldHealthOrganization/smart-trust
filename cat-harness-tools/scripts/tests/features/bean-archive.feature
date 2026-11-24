# scripts/beans.ts reads the bean archive as a declared view separate from the active store, and
# scripts/check-bean-archive.ts finds archived beans that are not in a terminal status.
# Each Scenario names the test that executes it.
Feature: Bean archive view

  @test:scripts/tests/bean-archive.test.ts::this_repository's_archive_is_declared,_and_resolved_by_id_rather_than_kind
  Scenario: This repository's archive is declared and resolved by id, not by kind
    Given this repository's bean graph
    When the bean archive is resolved
    Then it is declared
    And its directory ends with "beans/defs/archive"
    And its directory is not the active bean store

  @test:scripts/tests/bean-archive.test.ts::the_active_store's_count_does_not_include_the_archive
  Scenario: The active store's beans do not include the archive
    Given a scratch layer with one active bean and three archived beans
    When the active beans are read
    Then they are exactly "active-one"
    And reading the archive gives 3 beans

  @test:scripts/tests/bean-archive.test.ts::a_non-terminal_archived_bean_is_a_finding
  Scenario: A non-terminal archived bean is a finding
    Given a scratch archive holding completed, in-progress and todo beans
    When the non-terminal archived beans are found
    Then they are the "in-progress" and "todo" beans

  @test:scripts/tests/bean-archive.test.ts::...and_an_all-terminal_archive_is_clean_—_the_anti-vacuity_half
  Scenario: An all-terminal archive is clean
    Given a scratch archive holding completed and scrapped beans
    When the archive is read and checked
    Then it holds 2 beans
    And none is non-terminal

  @test:scripts/tests/bean-archive.test.ts::an_undeclared_archive_resolves_to_nothing_rather_than_guessing_the_path
  Scenario: An undeclared archive resolves to nothing
    Given a scratch layer with an archive directory its bean graph does not declare
    When the bean archive is resolved
    Then it is not declared
    And its directory is null
    And reading the archive gives null

  @test:scripts/tests/bean-archive.test.ts::`completed`_and_`scrapped`_are_the_terminal_set,_and_`draft`_is_not
  Scenario: Completed and scrapped are the only terminal statuses
    Given the terminal status set
    Then it is exactly "completed" and "scrapped"
    And "todo", "in-progress" and "draft" are not in it
