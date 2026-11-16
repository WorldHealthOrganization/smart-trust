# anchorHeadings in scripts/journeys/present.ts gives every section heading of a journeys
# view an anchor id. Each Scenario names the test that executes it.
Feature: Journey section headings carry anchors

  @test:scripts/tests/journeys/anchor-headings.test.ts::anchorHeadings::a_heading_with_no_id_gets_one_from_its_text,_unique_on_the_page
  Scenario: A heading with no id gets one from its text, unique on the page
    Given a page with a section "hood", an h3 "Who’s in this moment" with a class, an h3 and an h4 both "Policy takeaway", and an h2 "Hood"
    When its headings are anchored
    Then the first h3 gets id "who-s-in-this-moment" and keeps its class
    And the "Policy takeaway" h3 gets id "policy-takeaway" and the h4 gets "policy-takeaway-2"
    And the h2 gets "hood-2", since "hood" is already on the page

  @test:scripts/tests/journeys/anchor-headings.test.ts::anchorHeadings::a_heading_that_has_an_id_keeps_it,_and_other_markup_is_unchanged
  Scenario: A heading that already has an id keeps it, and other markup is unchanged
    Given markup with an h3 whose id is "steps", a paragraph and an h5 "Deep"
    When its headings are anchored
    Then the markup comes back exactly as it went in
