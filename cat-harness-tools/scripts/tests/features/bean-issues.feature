# The bean front-matter issue field (schemas/sdlc/bean-graph.ts, scripts/beans.ts) and the scripts/check-bean-issues.ts
# audit: which beans owe an issue, where the issue is found, and how the report and baseline behave.
# Each Scenario names the test that executes it.
Feature: Bean issue links

  @test:scripts/tests/bean-issues.test.ts::BeanFrontMatterSchema::accepts_front_matter_with_positive_integer_numeric_issue
  Scenario: The front-matter schema accepts a positive integer issue
    Given front matter for an in-progress feature with issue 730
    When it is parsed by the bean front-matter schema
    Then the issue is 730
    And the title is kept

  @test:scripts/tests/bean-issues.test.ts::BeanFrontMatterSchema::accepts_front_matter_with_string_issue_shorthand_(#730)
  Scenario: The front-matter schema accepts a "#730" issue shorthand
    Given front matter for a todo feature with issue "#730"
    When it is parsed by the bean front-matter schema
    Then the issue is "#730"

  @test:scripts/tests/bean-issues.test.ts::BeanFrontMatterSchema::accepts_front_matter_with_full_issue_URL
  Scenario: The front-matter schema accepts a full issue URL
    Given front matter for a todo feature with issue "https://github.com/litlfred/folio-assistant/issues/730"
    When it is parsed by the bean front-matter schema
    Then the issue is that URL

  @test:scripts/tests/bean-issues.test.ts::BeanFrontMatterSchema::accepts_front_matter_without_issue_field_(optional)
  Scenario: The issue field is optional
    Given front matter for a todo task with no issue
    When it is parsed by the bean front-matter schema
    Then the issue is undefined

  @test:scripts/tests/bean-issues.test.ts::BeanFrontMatterSchema::rejects_negative_or_zero_numbers
  Scenario: The schema rejects a negative or zero issue number
    Then parsing front matter with issue -1 fails
    And parsing front matter with issue 0 fails

  @test:scripts/tests/bean-issues.test.ts::BeanFrontMatterSchema::rejects_non-integer_numbers
  Scenario: The schema rejects a non-integer issue number
    Then parsing front matter with issue 730.5 fails

  @test:scripts/tests/bean-issues.test.ts::BeanFrontMatterSchema::rejects_empty_string_issue
  Scenario: The schema rejects an empty issue string
    Then parsing front matter with issue "" fails

  @test:scripts/tests/bean-issues.test.ts::BeanFrontMatterSchema::preserves_additional_unknown_keys_via_passthrough
  Scenario: Unknown front-matter keys are preserved
    Given front matter with issue 42 and custom_field "value"
    When it is parsed by the bean front-matter schema
    Then the issue is 42
    And custom_field is "value"

  @test:scripts/tests/bean-issues.test.ts::readBeans_front-matter_issue_parsing::parses_numeric_issue_from_bean_front_matter_into_BeanNode
  Scenario: A numeric issue in a bean file is read into the bean
    Given a bean store with one feature whose front matter has issue 730
    When the beans are read
    Then there is 1 bean and its issue is 730

  @test:scripts/tests/bean-issues.test.ts::readBeans_front-matter_issue_parsing::parses_string_issue_from_bean_front_matter_into_BeanNode
  Scenario: A string issue in a bean file is read into the bean
    Given a bean store with one feature whose front matter has issue "#730"
    When the beans are read
    Then there is 1 bean and its issue is "#730"

  @test:scripts/tests/bean-issues.test.ts::readBeans_front-matter_issue_parsing::leaves_issue_undefined_when_absent_from_front_matter
  Scenario: A bean with no issue field reads with no issue
    Given a bean store with one task with no issue in its front matter
    When the beans are read
    Then there is 1 bean and its issue is undefined

  @test:scripts/tests/bean-issues.test.ts::owesIssue_criteria::type_'feature'_owes_an_issue
  Scenario: A feature owes an issue
    Given a todo bean of type feature
    Then it owes an issue

  @test:scripts/tests/bean-issues.test.ts::owesIssue_criteria::type_'task'_without_special_tags_does_not_owe_an_issue
  Scenario: A plain task does not owe an issue
    Given a todo bean of type task with no tags
    Then it does not owe an issue

  @test:scripts/tests/bean-issues.test.ts::owesIssue_criteria::tags_declaring_issue_requirement_owe_an_issue
  Scenario: A tag declaring an issue requirement makes a bean owe an issue
    Given a task tagged with each of "issue-required", "needs-issue" and "requires-issue"
    Then it owes an issue every time

  @test:scripts/tests/bean-issues.test.ts::owesIssue_criteria::body_declaring_stakeholder_adjudication_owes_an_issue
  Scenario: A body asking for stakeholder adjudication makes a bean owe an issue
    Given a task whose body says it "requires stakeholder adjudication before landing"
    Then it owes an issue

  @test:scripts/tests/bean-issues.test.ts::owesIssue_criteria::openOnly_option_excludes_closed_beans
  Scenario: The openOnly option excludes closed beans
    Given a completed feature
    Then it does not owe an issue with openOnly true
    And it owes an issue with openOnly false

  @test:scripts/tests/bean-issues.test.ts::extractIssueFromBody_and_resolveIssue::extracts_issue_from_URL_in_body
  Scenario: An issue URL in the body is extracted
    Given a body mentioning "https://github.com/litlfred/folio-assistant/issues/1042"
    When the issue is extracted from the body
    Then it is that URL

  @test:scripts/tests/bean-issues.test.ts::extractIssueFromBody_and_resolveIssue::extracts_issue_from_'issue_#123'_or_'issue_123'
  Scenario: "issue #941" and "issue 941" in the body are extracted as "#941"
    Then "Discussed in issue #941." gives "#941"
    And "See issue 941 for details." gives "#941"

  @test:scripts/tests/bean-issues.test.ts::extractIssueFromBody_and_resolveIssue::extracts_issue_from_'gh-123'
  Scenario: "gh-88" in the body is extracted as "#88"
    Then "Fixes gh-88." gives "#88"

  @test:scripts/tests/bean-issues.test.ts::extractIssueFromBody_and_resolveIssue::extracts_issue_from_standalone_'#123'
  Scenario: A standalone "#123" in the body is extracted
    Then "Adjudication in #123." gives "#123"

  @test:scripts/tests/bean-issues.test.ts::extractIssueFromBody_and_resolveIssue::does_not_false-positive_on_markdown_headings
  Scenario: Markdown headings are not mistaken for issues
    Given a body of three markdown headings
    When the issue is extracted from the body
    Then there is none

  @test:scripts/tests/bean-issues.test.ts::extractIssueFromBody_and_resolveIssue::resolveIssue_prefers_frontmatter_over_body
  Scenario: The front-matter issue is preferred over a body reference
    Given a feature with issue 730 in front matter and "#999" in its body
    When its issue is resolved
    Then the source is "frontmatter" and the issue is 730

  @test:scripts/tests/bean-issues.test.ts::extractIssueFromBody_and_resolveIssue::resolveIssue_falls_back_to_body_reference
  Scenario: A body reference is used when the front matter has no issue
    Given a feature with no issue field whose body says "Adjudication tracked in #456."
    When its issue is resolved
    Then the source is "body" and the issue is "#456"

  @test:scripts/tests/bean-issues.test.ts::checkBeanIssues_logic::passes_when_every_feature_specifies_an_issue_in_front_matter
  Scenario: The audit passes when every feature has a front-matter issue
    Given a store with features carrying issue 730 and '#731' and a task with none
    When the bean issue audit runs
    Then there are no problems
    And 2 beans owe an issue and 2 are compliant

  @test:scripts/tests/bean-issues.test.ts::checkBeanIssues_logic::passes_when_feature_specifies_issue_in_body
  Scenario: The audit passes when a feature names its issue in the body
    Given a store with a feature whose body says "Human review in issue #555."
    When the bean issue audit runs
    Then there are no problems
    And 1 bean owes an issue, compliant from the body with issue "#555"

  @test:scripts/tests/bean-issues.test.ts::checkBeanIssues_logic::fails_when_a_feature_has_no_issue_in_front_matter_or_body
  Scenario: The audit fails a feature with no issue anywhere
    Given a store with a feature with no issue field whose body says "No issue here."
    When the bean issue audit runs
    Then there is exactly 1 problem
    And it names "t-f1" and says "owes an issue"

  @test:scripts/tests/bean-issues.test.ts::checkBeanIssues_logic::returns_store_null_and_0_problems_when_no_bean_store_exists
  Scenario: No bean store gives a null store and no problems
    Given a directory with no bean store
    When the bean issue audit runs
    Then the store is null
    And there are no problems
    And the formatted report says "no bean store"

  @test:scripts/tests/bean-issues.test.ts::checkBeanIssues_logic::formats_report_correctly_with_pass_and_compliant_beans
  Scenario: The report for a passing store lists the compliant beans
    Given a store with a feature carrying issue 730
    When the audit report is formatted
    Then it says "every bean owing an issue is linked to an issue"
    And it lists "t-f1: 730 (from frontmatter)"

  @test:scripts/tests/bean-issues.test.ts::checkBeanIssues_logic::formats_report_correctly_with_failures_and_guidance
  Scenario: The report for a failing store names the bean and how to fix it
    Given a store with a feature with no issue
    When the audit report is formatted
    Then it contains "✗ t-f1"
    And it contains "Add `issue: <number|string>`"

  @test:scripts/tests/bean-issues.test.ts::checkBeanIssues_logic::honours_baseline_for_accepted_missing_issues
  Scenario: A baselined missing issue is not a problem
    Given a store with a feature with no issue
    And a baseline listing "missing-issue:t-f1"
    When the bean issue audit runs
    Then there are no problems
    And one outstanding entry names "t-f1"
    And the formatted report mentions "baselined defect(s)"

  @test:scripts/tests/bean-issues.test.ts::checkBeanIssues_logic::flags_stale_baseline_entries
  Scenario: A baseline entry that matches nothing is flagged stale
    Given a store with a compliant feature
    And a baseline listing "missing-issue:t-repaired"
    When the bean issue audit runs
    Then the stale entries are "missing-issue:t-repaired"
    And the formatted report says "matches nothing — remove it"
