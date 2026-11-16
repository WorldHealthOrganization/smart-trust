# Licence expressions checked against the pinned SPDX License List
# (schemas/library/spdx-license-expression.ts, with scripts/pin-spdx-license-list.ts and
# scripts/check-source-licence.ts). Each Scenario names the test that executes it.
Feature: SPDX licence expression validation

  @test:schemas/spdx-license-expression.test.ts::valid_expressions::a_listed_id,_a_LicenseRef,_and_a_DocumentRef-qualified_LicenseRef
  Scenario: A listed id, a LicenseRef and a DocumentRef-qualified LicenseRef are valid
    Given a test list holding MIT, Apache-2.0, CC-BY-3.0, GPL-2.0 (deprecated), GPL-2.0-or-later and Classpath-exception-2.0
    When "MIT", "LicenseRef-W3C-Document-License" and "DocumentRef-spdx-tool-1.2:LicenseRef-MIT-Style-2" are checked
    Then none reports a problem

  @test:schemas/spdx-license-expression.test.ts::valid_expressions::AND,_OR,_WITH,_`+`,_parentheses_—_and_lower-case_operators
  Scenario: AND, OR, WITH, plus, parentheses and lower-case operators are valid
    Given the test list
    When expressions such as "(MIT OR Apache-2.0) AND CC-BY-3.0", "GPL-2.0-or-later WITH Classpath-exception-2.0", "GPL-2.0+", "mit and apache-2.0" and "MIT AND(Apache-2.0 OR CC-BY-3.0)" are checked
    Then none reports a problem
    And a WITH naming an "AdditionRef-" exception is accepted too

  @test:schemas/spdx-license-expression.test.ts::valid_expressions::matches_ids_case-insensitively_and_reports_the_canonical_spelling
  Scenario: Ids match case-insensitively and the canonical spelling is reported
    Given the test list
    When "apache-2.0" is checked
    Then the result has no deprecated ids and recases "apache-2.0" to "Apache-2.0"

  @test:schemas/spdx-license-expression.test.ts::valid_expressions::reports_a_deprecated_id_without_refusing_it
  Scenario: A deprecated id is reported without being refused
    Given the test list
    When "GPL-2.0 OR MIT" is checked
    Then the result lists "GPL-2.0" as deprecated, with no problem and nothing recased

  @test:schemas/spdx-license-expression.test.ts::invalid_expressions::an_id_that_is_not_on_the_list_—_the_typo_this_exists_to_catch
  Scenario: An id not on the list is refused
    Given the test list
    When "CC-BY-3.O" is checked
    Then the problem says it is not a licence id

  @test:schemas/spdx-license-expression.test.ts::invalid_expressions::an_exception_used_as_a_licence,_and_a_licence_used_as_an_exception
  Scenario: An exception used as a licence and a licence used as an exception are refused
    Given the test list
    When "Classpath-exception-2.0" is checked
    Then the problem says it is not a licence id
    And when "MIT WITH Apache-2.0" is checked, the problem says it is not an exception id

  @test:schemas/spdx-license-expression.test.ts::invalid_expressions::mixed-case_operators_(sec-328)
  Scenario: Mixed-case operators are refused
    Given the test list
    When "MIT And Apache-2.0" is checked
    Then the problem says operators must be all upper or all lower case

  @test:schemas/spdx-license-expression.test.ts::invalid_expressions::two_licences_with_no_operator
  Scenario: Two licences with no operator are refused
    Given the test list
    When "MIT Apache-2.0" is checked
    Then the problem says licences must be joined by AND, OR or WITH

  @test:schemas/spdx-license-expression.test.ts::invalid_expressions::unbalanced_parentheses
  Scenario: Unbalanced parentheses are refused
    Given the test list
    When "(MIT OR Apache-2.0" is checked
    Then the problem says the parenthesis is not closed
    And when "MIT)" is checked, the problem says there is no opening parenthesis

  @test:schemas/spdx-license-expression.test.ts::invalid_expressions::WITH_on_a_parenthesised_expression_(the_grammar_binds_it_to_a_simple-expression)
  Scenario: WITH on a parenthesised expression is refused
    Given the test list
    When "(MIT) WITH Classpath-exception-2.0" is checked
    Then the problem says WITH must follow a single licence

  @test:schemas/spdx-license-expression.test.ts::invalid_expressions::a_malformed_LicenseRef,_a_dangling_operator,_and_the_empty_string
  Scenario: A malformed LicenseRef, a dangling operator and an empty expression are refused
    Given the test list
    When "LicenseRef-" is checked, the problem says it is not well-formed
    And "MIT AND" ends where a licence was expected
    And "WITH Classpath-exception-2.0" finds WITH where a licence was expected
    And "  " is reported empty

  @test:schemas/spdx-license-expression.test.ts::the_pinned_edition::the_committed_snapshot_loads_and_agrees_with_its_pin
  Scenario: The committed SPDX snapshot loads and keeps the corpus's ids valid
    Given the repository's committed SPDX License List snapshot
    When it is loaded
    Then it loads as a list of more than 500 licences
    And expressions the corpus states, such as "Apache-2.0 AND MIT", "CC-BY-NC-SA-3.0-IGO", "EUPL-1.2" and "CC0-1.0", report no problem

  @test:schemas/spdx-license-expression.test.ts::the_pinned_edition::the_pin_script_refuses_data_from_another_edition
  Scenario: The pin script refuses list data from another edition
    Given licence and exception data at list version "3.28.0"
    When a snapshot is made with pin "3.29.0"
    Then it throws naming the pin 3.29.0
    And with pin "3.28.0" the snapshot's concepts are the one MIT spdx-license with display "MIT License"

  @test:schemas/spdx-license-expression.test.ts::the_pinned_edition::an_unloadable_list_is_could-not-determine,_never_a_pass
  Scenario: An unloadable licence list is judged could-not-determine
    Given a source-licence report whose list problem is "missing"
    When it is judged
    Then the verdict is "unknown"
