# pipeline/validate.ts's sectionLabels collects the cross-reference labels of a chapter's
# sections, nested subsections included. Each Scenario names the test that executes it.
Feature: Section labels at every depth

  @test:pipeline/validate-section-labels.test.ts::sectionLabels::collects_labels_at_every_depth,_in_document_order
  Scenario: Section labels are collected at every depth, in document order
    Given a chapter whose labelled "Overview" section holds subsections A and B, B holding C
    And an unlabelled section followed by a section labelled "sec:last"
    When its section labels are collected
    Then they are "sec:overview", "sec:a", "sec:b", "sec:c", "sec:last" in that order

  @test:pipeline/validate-section-labels.test.ts::sectionLabels::an_empty_chapter_has_no_labels
  Scenario: An empty chapter has no section labels
    Given a chapter with no sections
    When its section labels are collected
    Then the list is empty
