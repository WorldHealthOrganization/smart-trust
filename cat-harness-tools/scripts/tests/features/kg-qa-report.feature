# `scripts/kg-qa-report.ts` builds the KG half of a site's QA report: records read
# off the declared qa directories, the subject listed first, and the view linked
# only where a declaration names one. Each Scenario names the test that executes it.
Feature: KG QA report

  @test:scripts/tests/kg-qa-report.test.ts::kg-qa-report::a_record_that_does_not_parse_is_listed_as_unreadable,_never_dropped
  Scenario: A record that does not parse is listed as unreadable, never dropped
    Given a qa directory holding a valid "links.qa-results.json" and a malformed "broken.qa-results.json"
    When the QA records in that directory are read
    Then both records are listed
    And "broken.qa-results.json" is marked unreadable while "links.qa-results.json" is not

  @test:scripts/tests/kg-qa-report.test.ts::kg-qa-report::the_subject_comes_first,_and_says_it_declares_no_qa_directory
  Scenario: The subject comes first and says it declares no qa directory
    Given a checkout where "top" needs "cat-harness", which declares a qa directory and a QA view
    When the KG QA report for "top" is built and rendered as Markdown
    Then the instances are "top" then "cat-harness"
    And the view is "en/cat-harness/qa/" and only "cat-harness" has the page "en/cat-harness/qa/cat-harness/"
    And the Markdown has a row saying "top" declares no qa directory
    And it links "Every instance's QA" to "../en/cat-harness/qa/"
    And it reports "1 finding(s), written by check-links.ts" with a link to the record JSON under "assets/kg-qa/cat-harness/"
    And a pipe in a table value is escaped as "b\|c.html"
    And the malformed record is shown as "broken: unreadable."

  @test:scripts/tests/kg-qa-report.test.ts::kg-qa-report::no_declared_view:_nothing_is_linked
  Scenario: With no declared view nothing is linked
    Given the same checkout with no QA visualiser declared
    When the KG QA report for "top" is built
    Then it has no view and no instance has a page
    And the Markdown does not contain "en/cat-harness/qa"

  @test:scripts/tests/kg-qa-report.test.ts::kg-qa-report::records_are_copied_per_instance
  Scenario: Records are copied into the site per instance
    Given the checkout with a QA view
    When the report's records are copied into "_site" under "assets/kg-qa"
    Then 1 record is copied
    And "assets/kg-qa/cat-harness/links.qa-results.json" exists in the site
