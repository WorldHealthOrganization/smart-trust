# scripts/check-anchors.ts checks rendered HTML pages: every heading has an id, anchored headings offer a way to copy a link, and a review page links back to its document.
# Each Scenario names the test that executes it.
Feature: Every page can be linked into and leads back

  @test:scripts/tests/check-anchors.test.ts::check-anchors:_every_page_can_be_linked_into_and_leads_back_(owner,_2026-11-02)::a_heading_with_no_id_is_reported,_by_its_text
  Scenario: A heading with no id is reported by its text
    Given a page with an "h2" "Scope" without an id and an "h3" with an id, loading the edit-links script
    When anchorProblems checks it
    Then there is 1 problem
    And its reason quotes "Scope"

  @test:scripts/tests/check-anchors.test.ts::check-anchors:_every_page_can_be_linked_into_and_leads_back_(owner,_2026-11-02)::headings_inside_scripts,_styles_and_navigation_are_not_judged
  Scenario: Headings inside scripts, styles and navigation are not judged
    Given a page with id-less headings inside nav, a script string and a style block, plus one anchored "h2" and the edit-links script
    When anchorProblems checks it
    Then there are no problems

  @test:scripts/tests/check-anchors.test.ts::check-anchors:_every_page_can_be_linked_into_and_leads_back_(owner,_2026-11-02)::anchored_headings_with_no_way_to_copy_a_link_are_reported
  Scenario: Anchored headings with no way to copy a link are reported
    Given a page with an anchored "h2" and nothing else
    When anchorProblems checks it
    Then there is 1 problem whose reason contains "no 🔗"
    And the same heading with a theme "anchor-heading" link has no problems
    And the same heading with the inline faEditLinks runtime has no problems

  @test:scripts/tests/check-anchors.test.ts::check-anchors:_every_page_can_be_linked_into_and_leads_back_(owner,_2026-11-02)::a_review_page_with_no_link_back_to_its_document_is_reported
  Scenario: A review page with no link back to its document is reported
    Given "en/review/index.html" holding a "What changed" heading and a changes div
    When anchorProblems checks it
    Then a reason is "review page with no link back to the source document"
    And the same page with a "source-docs" element has no problems
