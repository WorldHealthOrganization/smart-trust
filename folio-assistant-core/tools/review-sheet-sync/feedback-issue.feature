Feature: feedback issues become Contributor Feedback rows

  @test:tools/review-sheet-sync/feedback-issue.test.ts::feedback_issues_become_Contributor_Feedback_rows::issueFormParsed
  Scenario: an issue-form body parses by label; empty fields are dropped
    When an issue-form body is parsed
    Then each labelled field is read and empty ones dropped

  @test:tools/review-sheet-sync/feedback-issue.test.ts::feedback_issues_become_Contributor_Feedback_rows::plainBodyParsed
  Scenario: a plain body parses too, ignoring the unfilled Type prompt
    When a plain body is parsed
    Then the block, comment and proposal are read and the unfilled Type prompt is not

  @test:tools/review-sheet-sync/feedback-issue.test.ts::feedback_issues_become_Contributor_Feedback_rows::feedbackRowMade
  Scenario: the row: Sections from the block's anchor, a draft Title, feedback signed by login
    When rows are made from an issue-form issue and a plain one
    Then the title, sections from the block's anchor, signed feedback and issue are set
    And the plain one's feedback carries the proposal

  @test:tools/review-sheet-sync/feedback-issue.test.ts::feedback_issues_become_Contributor_Feedback_rows::sharedFormIds
  Scenario: the shared form declares every id the site's link prefills and the parser reads
    When the shared issue form is read
    Then its ids are content, section, block, url, source, type, comment and proposed

  @test:tools/review-sheet-sync/feedback-issue.test.ts::feedbackBasis::basisChangesWithPersonCell
  Scenario: changes when a person's cell changes
    When a person's cell changes
    Then the feedback basis changes

  @test:tools/review-sheet-sync/feedback-issue.test.ts::feedbackBasis::basisIgnoresAgentColumns
  Scenario: ignores the agent's own proposal, the mechanical columns, Ready, and tree marks
    When the agent's proposal, mechanical columns, Ready and tree marks change
    Then the feedback basis is the same

  @test:tools/review-sheet-sync/feedback-issue.test.ts::feedbackBasis_with_grey_content_(a_"2:"_basis)::greyBasisMarked
  Scenario: is marked 2: and differs from the blue-only basis
    When the bases with and without grey content are made
    Then the grey one is marked 2: and the blue-only one is not

  @test:tools/review-sheet-sync/feedback-issue.test.ts::feedbackBasis_with_grey_content_(a_"2:"_basis)::greyBasisChangesWithGrey
  Scenario: changes when a grey content cell changes; the blue-only basis does not
    When a grey content cell changes
    Then the grey basis changes and the blue-only basis does not

  @test:tools/review-sheet-sync/feedback-issue.test.ts::feedbackBasis_with_grey_content_(a_"2:"_basis)::greyBasisIgnoresAgent
  Scenario: ignores the agent's own columns
    When the agent's own columns change
    Then the grey basis is the same
