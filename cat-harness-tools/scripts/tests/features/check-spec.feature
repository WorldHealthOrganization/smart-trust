# scripts/check-spec.ts and schemas/sdlc/spec-template.ts validate a feature spec against the
# declared spec template and gate code on a feature bean's governing issue carrying a valid spec
# comment. Each Scenario names the test that executes it.
Feature: Spec validation and the spec-before-code gate

  @test:scripts/tests/check-spec.test.ts::spec-template_—_declared_artefact_and_section_extraction::loadDeclaredSpecTemplate_loads_mandatory_sections_from_declared_template_markdown
  Scenario: The declared spec template yields its mandatory sections and metadata fields
    Given the default declared spec template
    When it is loaded
    Then its mandatory sections include "User Scenarios & Testing", "Requirements" and "Success Criteria"
    And its metadata fields include "Feature Branch" and "Status"

  @test:scripts/tests/check-spec.test.ts::spec-template_—_declared_artefact_and_section_extraction::extractH2Sections_extracts_clean_section_titles_without_markdown_decorations
  Scenario: H2 section titles are extracted without their decorations
    Given a spec with H2 headings, two of them suffixed "*(mandatory)*"
    When its H2 sections are extracted
    Then they are "User Scenarios & Testing", "Edge Cases" and "Requirements"

  @test:scripts/tests/check-spec.test.ts::validateSpec_—_mandatory_sections_and_naming_missing_ones_(SC-003)::a_spec_containing_all_mandatory_sections_passes_validation
  Scenario: A spec with every mandatory section passes
    Given a Draft spec with all mandatory sections
    When it is validated
    Then the state is "pass" with no findings and no missing sections
    And its status reads "Draft"

  @test:scripts/tests/check-spec.test.ts::validateSpec_—_mandatory_sections_and_naming_missing_ones_(SC-003)::a_spec_missing_'Success_Criteria'_fails_and_explicitly_names_the_missing_section
  Scenario: A spec missing Success Criteria fails and names it
    Given a spec without a "Success Criteria" section
    When it is validated
    Then the state is "fail"
    And "Success Criteria" is among the missing sections
    And a finding reads 'missing mandatory section: "Success Criteria"'

  @test:scripts/tests/check-spec.test.ts::validateSpec_—_mandatory_sections_and_naming_missing_ones_(SC-003)::a_spec_missing_'Requirements'_fails_and_explicitly_names_the_missing_section
  Scenario: A spec missing Requirements fails and names it
    Given a spec without a "Requirements" section
    When it is validated
    Then the state is "fail"
    And "Requirements" is among the missing sections

  @test:scripts/tests/check-spec.test.ts::validateSpec_—_mandatory_sections_and_naming_missing_ones_(SC-003)::a_spec_missing_'User_Scenarios_&_Testing'_fails_and_explicitly_names_it
  Scenario: A spec missing User Scenarios & Testing fails and names it
    Given a spec without a "User Scenarios & Testing" section
    When it is validated
    Then the state is "fail"
    And "User Scenarios & Testing" is among the missing sections

  @test:scripts/tests/check-spec.test.ts::validateSpec_—_unresolved_[NEEDS_CLARIFICATION]_markers_(SC-004)::extractClarificationMarkers_extracts_all_clarification_markers
  Scenario: Every clarification marker is extracted
    Given text holding "[NEEDS CLARIFICATION: threshold value]" and a bare "[NEEDS CLARIFICATION]"
    When its clarification markers are extracted
    Then there are 2, in that order

  @test:scripts/tests/check-spec.test.ts::validateSpec_—_unresolved_[NEEDS_CLARIFICATION]_markers_(SC-004)::unresolved_clarification_markers_are_permitted_in_Draft_status
  Scenario: Unresolved clarification markers are allowed in a Draft spec
    Given a complete Draft spec with one clarification marker
    When it is validated
    Then the state is "pass"
    And 1 unresolved clarification is reported
    And the spec is not adjudicated

  @test:scripts/tests/check-spec.test.ts::validateSpec_—_unresolved_[NEEDS_CLARIFICATION]_markers_(SC-004)::unresolved_clarification_markers_BLOCK_reaching_Adjudicated_status_(SC-004)
  Scenario: Unresolved clarification markers fail an Adjudicated spec
    Given a complete spec with status "Adjudicated" and one clarification marker
    When it is validated
    Then the state is "fail"
    And the spec is adjudicated
    And a finding mentions "unresolved [NEEDS CLARIFICATION] marker(s)"

  @test:scripts/tests/check-spec.test.ts::validateSpec_—_unresolved_[NEEDS_CLARIFICATION]_markers_(SC-004)::requireAdjudicated_option_enforces_that_markers_are_resolved_even_if_status_is_not_explicit
  Scenario: Requiring adjudication rejects markers whatever the status
    Given a complete spec with status "WIP" and one clarification marker
    When it is validated with adjudication required
    Then the state is "fail"
    And a finding mentions "unresolved [NEEDS CLARIFICATION] marker(s)"

  @test:scripts/tests/check-spec.test.ts::isStatusAdjudicated::recognizes_adjudicated_status_keywords
  Scenario: Adjudicated status keywords are recognised
    When the statuses "Adjudicated", "Approved", "Accepted by BA" and "Completed" are judged
    Then each is adjudicated

  @test:scripts/tests/check-spec.test.ts::isStatusAdjudicated::recognizes_non-adjudicated_status_keywords
  Scenario: Non-adjudicated statuses are recognised
    When the statuses "Draft", "WIP", "Under Review" and no status are judged
    Then none is adjudicated

  @test:scripts/tests/check-spec.test.ts::checkSpecBeforeCode_—_spec-before-code_gate_(Child_3_/_issue_#753)::passing_case:_returns_state_pass_when_referenced_issue_carries_a_valid_spec_comment
  Scenario: The gate passes when the issue carries a valid spec comment
    Given issue 730 whose fetched comments hold a valid spec
    When the gate checks issue 730
    Then the state is "pass" with no findings
    And the issue number is 730
    And the spec result is "pass"
    And the CLI, fetching the same comment through a stand-in gh, exits 0

  @test:scripts/tests/check-spec.test.ts::checkSpecBeforeCode_—_spec-before-code_gate_(Child_3_/_issue_#753)::failing_case:_missing_spec_comment_on_issue_reports_a_finding,_not_silence_(exit_1)
  Scenario: An issue with no spec comment is a finding
    Given issue 730 whose comments are fetched but hold no spec
    When the gate checks issue 730
    Then the state is "finding"
    And the first finding says it "carries no reachable spec comment"
    And the CLI, given an empty comment list by a stand-in gh, exits 1

  @test:scripts/tests/check-spec.test.ts::checkSpecBeforeCode_—_spec-before-code_gate_(Child_3_/_issue_#753)::failing_case:_invalid_spec_comment_(missing_mandatory_section)_reports_a_finding_(exit_1)
  Scenario: An issue whose spec lacks a mandatory section is a finding
    Given issue 730 whose spec comment has no "Requirements" section
    When the gate checks issue 730
    Then the state is "finding"
    And a finding reads 'missing mandatory section: "Requirements"'
    And the CLI, given that comment by a stand-in gh, exits 1

  @test:scripts/tests/check-spec.test.ts::checkSpecBeforeCode_—_spec-before-code_gate_(Child_3_/_issue_#753)::failing_case:_spec_with_unresolved_[NEEDS_CLARIFICATION]_when_requireAdjudicated_reports_a_finding
  Scenario: A spec with an unresolved marker is a finding when adjudication is required
    Given issue 730 whose Draft spec comment holds a clarification marker
    When the gate checks issue 730 with adjudication required
    Then the state is "finding"
    And a finding mentions "unresolved [NEEDS CLARIFICATION] marker(s)"

  @test:scripts/tests/check-spec.test.ts::checkSpecBeforeCode_—_spec-before-code_gate_(Child_3_/_issue_#753)::could-not-determine_case:_unreachable_issue_reports_unknown_(exit_2)
  Scenario: An unreachable issue is reported as unknown
    Given fetching issue 730's comments fails with a rate-limit or network reason
    When the gate checks issue 730
    Then the state is "unknown"
    And the reason says "could not determine" and "failed to fetch comments for issue #730"
    And the CLI, whose stand-in gh exits non-zero, exits 2

  @test:scripts/tests/check-spec.test.ts::checkSpecBeforeCode_—_spec-before-code_gate_(Child_3_/_issue_#753)::feature_bean_with_referenced_issue_carrying_a_valid_spec_passes
  Scenario: A feature bean whose linked issue carries a valid spec passes
    Given feature bean "folio-assistant-4kq7" linking issue 730 in its body
    And issue 730's comments hold a valid spec
    When the gate checks the bean
    Then the state is "pass" for issue 730
    And the bean is read as type "feature" with id "folio-assistant-4kq7"

  @test:scripts/tests/check-spec.test.ts::checkSpecBeforeCode_—_spec-before-code_gate_(Child_3_/_issue_#753)::feature_bean_with_NO_referenced_issue_reports_a_finding_(breach_is_not_silent)
  Scenario: A feature bean with no linked issue is a finding
    Given a feature bean with no issue link
    When the gate checks the bean
    Then the state is "finding"
    And the first finding says it "carries no reference to a governing issue"

  @test:scripts/tests/check-spec.test.ts::checkSpecBeforeCode_—_spec-before-code_gate_(Child_3_/_issue_#753)::non-feature_bean_(type:_task)_passes_without_requiring_a_spec
  Scenario: A task bean passes without a spec
    Given a bean of type "task" with no issue link
    When the gate checks the bean
    Then the state is "pass"
    And the reason mentions "type 'task'"

  @test:scripts/tests/check-spec.test.ts::parseBeanDefinition_—_bean_metadata_&_issue_extraction::extracts_issue_from_body_github_url
  Scenario: The issue is read from a GitHub URL in the bean body
    Given a feature bean whose body links "github.com/litlfred/folio-assistant/issues/730"
    When the bean is parsed
    Then its id is "folio-assistant-4kq7" and its type "feature"
    And its issue is 730 in repo "litlfred/folio-assistant"

  @test:scripts/tests/check-spec.test.ts::parseBeanDefinition_—_bean_metadata_&_issue_extraction::extracts_issue_from_front_matter
  Scenario: The issue is read from the bean's front matter
    Given a bean with front matter id "my-bean", type "feature" and issue 755
    When the bean is parsed
    Then its id is "my-bean", its type "feature" and its issue 755
