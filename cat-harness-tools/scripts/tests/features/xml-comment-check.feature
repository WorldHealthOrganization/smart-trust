# The diagram corpus is well-formed where a conformant parser would look:
# no "--" inside an XML comment (bean folio-assistant-qjog). Each Scenario names
# the test that executes it.
Feature: XML comment check

  @test:scripts/tests/xml-comment-check.test.ts::XML_comments_in_the_diagram_corpus::there_are_diagrams_to_check_—_otherwise_this_proves_nothing
  Scenario: There are diagrams to check
    Then the harness's processes directory holds more than 10 XML sources

  @test:scripts/tests/xml-comment-check.test.ts::XML_comments_in_the_diagram_corpus::both_.bpmn_and_.dmn_are_covered
  Scenario: Both .bpmn and .dmn are covered
    Then the sources include a .bpmn and a .dmn file

  @test:scripts/tests/xml-comment-check.test.ts::XML_comments_in_the_diagram_corpus::no_diagram_has_a_malformed_comment
  Scenario: No diagram has a malformed comment
    Then checking every source finds nothing

  @test:scripts/tests/xml-comment-check.test.ts::the_rule_itself::a_double_hyphen_in_the_body_is_caught
  Scenario: A double hyphen in a comment is caught
    Then "<!-- a -- b -->" gives one finding saying 'contains "--"'

  @test:scripts/tests/xml-comment-check.test.ts::the_rule_itself::a_body_ending_in_a_hyphen_is_caught_—_the_case_a_lazy_regex_gets_wrong
  Scenario: A comment body ending in a hyphen is caught
    Then "<!-- a --->" gives one finding

  @test:scripts/tests/xml-comment-check.test.ts::the_rule_itself::an_em_dash_is_fine_—_it_is_what_the_corpus_was_supposed_to_use
  Scenario: An em dash is fine
    Then a comment holding an em dash gives no findings

  @test:scripts/tests/xml-comment-check.test.ts::the_rule_itself::`--`_OUTSIDE_a_comment_is_legal_and_must_not_be_reported
  Scenario: "--" outside a comment is legal
    Then element text "run it with --json" gives no findings

  @test:scripts/tests/xml-comment-check.test.ts::the_rule_itself::an_unterminated_comment_is_reported,_not_skipped
  Scenario: An unterminated comment is reported
    Then a comment that never closes gives one finding saying "never closed"

  @test:scripts/tests/xml-comment-check.test.ts::the_rule_itself::the_offending_line_is_named,_not_the_comment's_first_line
  Scenario: The offending line is named
    Then a multi-line comment with "--" on its fourth line gives one finding at line 4

  @test:scripts/tests/xml-comment-check.test.ts::what_it_reads::a_declared_business-processes_directory_is_read,_beside_processes_—_the_kind_the_registry_says_this_check_grades
  Scenario: A declared business-processes directory is read and graded
    Given a layer declaring "input/business-processes/" holding a BPMN with a bad comment
    Then the files read are that BPMN only
    And checking them gives one finding

  @test:scripts/tests/xml-comment-check.test.ts::what_it_reads::this_checkout's_processes_directories_are_still_read
  Scenario: The harness's processes are still read
    Then more than 10 of the files read for the harness are under its processes directory
