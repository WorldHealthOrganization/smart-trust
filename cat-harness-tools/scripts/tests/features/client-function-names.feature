# The client script assets/js/docs-ui.js is one long IIFE, so a function name declared twice at
# its top scope silently replaces the first; a source scan keeps every top-level name unique.
# Each Scenario names the test that executes it.
Feature: The client script declares each function name once

  @test:scripts/tests/client-function-names.test.ts::the_client_declares_each_function_name_once::there_ARE_declarations,_so_this_is_not_vacuous
  Scenario: The scan finds the client's top-level function declarations
    Given the site's docs-ui.js source
    When its function declarations at exactly two spaces of indent are collected
    Then there are more than 50 of them

  @test:scripts/tests/client-function-names.test.ts::the_client_declares_each_function_name_once::no_name_is_declared_twice
  Scenario: No top-level function name is declared twice
    Given the top-level function declarations of docs-ui.js
    When they are grouped by name
    Then no name appears on more than one line
