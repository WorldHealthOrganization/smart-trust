# The figure-description schema in schemas/content/figure-description.ts: every description states its basis (labels-only or labels-and-render),
# a labels-only one says what went unread, and a file holds one description per page and figure. Each Scenario names the test that executes it.
Feature: Figure descriptions state their basis

  @test:scripts/tests/figure-description.test.ts::basis_is_required_and_closed::a_description_with_no_basis_is_refused
  Scenario: A description with no basis is refused
    Given a figure description with no basis
    When it is validated
    Then validation fails

  @test:scripts/tests/figure-description.test.ts::basis_is_required_and_closed::a_third_basis_cannot_be_invented
  Scenario: Only the two declared bases are accepted
    Given a figure description with basis "skimmed"
    When it is validated
    Then validation fails

  @test:scripts/tests/figure-description.test.ts::basis_is_required_and_closed::labels-only_WITHOUT_saying_what_went_unread_is_refused
  Scenario: A labels-only description must say what went unread
    Given a figure description with basis "labels-only" and no unread field
    When it is validated
    Then validation fails
    And the error says "could not read"

  @test:scripts/tests/figure-description.test.ts::basis_is_required_and_closed::labels-only_WITH_it_parses
  Scenario: A labels-only description that says what went unread is accepted
    Given a figure description with basis "labels-only" and unread "the arrows, and a glyph-only column"
    When it is validated
    Then validation succeeds

  @test:scripts/tests/figure-description.test.ts::basis_is_required_and_closed::labels-and-render_needs_no_`unread`,_and_may_still_carry_one
  Scenario: A labels-and-render description may omit or carry unread
    Given a figure description with basis "labels-and-render"
    Then it validates with no unread field
    And it validates with unread "nothing"

  @test:scripts/tests/figure-description.test.ts::the_narrative_rules_are_the_corpus's,_not_this_file's::an_agent_cannot_confirm_its_own_draft
  Scenario: An agent cannot confirm its own draft narrative
    Given a figure description whose narrative is confirmed by the same agent that drafted it
    When it is validated
    Then validation fails

  @test:scripts/tests/figure-description.test.ts::one_description_per_(page,_figure)::the_same_page_and_figure_twice_is_refused
  Scenario: The same page and figure described twice is refused
    Given a descriptions file with the same description of page 3, "Figure 2" twice
    When it is validated
    Then validation fails
    And the error says "described twice"

  @test:scripts/tests/figure-description.test.ts::one_description_per_(page,_figure)::TWO_UNLABELLED_figures_on_one_page_are_both_describable
  Scenario: Two unlabelled figures on one page are both accepted
    Given two descriptions of page 3 with no figure label and different narrative text
    When the file is validated
    Then validation succeeds

  @test:scripts/tests/figure-description.test.ts::one_description_per_(page,_figure)::...but_the_SAME_unlabelled_description_twice_is_still_refused
  Scenario: The same unlabelled description twice is refused
    Given the same unlabelled description of page 3 twice
    When the file is validated
    Then validation fails
    And the error says "identical narrative text"

  @test:scripts/tests/figure-description.test.ts::one_description_per_(page,_figure)::an_unlabelled_figure_does_not_collide_with_a_LABELLED_one_on_the_same_page
  Scenario: An unlabelled figure does not collide with a labelled one on the same page
    Given a description of page 3 "Figure 2" and an unlabelled description of page 3
    When the file is validated
    Then validation succeeds

  @test:scripts/tests/figure-description.test.ts::one_description_per_(page,_figure)::two_figures_on_ONE_page_are_fine_—_a_page_may_draw_more_than_one
  Scenario: Two labelled figures on one page are accepted
    Given descriptions of page 3 "Figure 2" and page 3 "Figure 3"
    When the file is validated
    Then validation succeeds

  @test:scripts/tests/figure-description.test.ts::one_description_per_(page,_figure)::an_unknown_key_is_refused,_so_a_field_cannot_arrive_unschema'd
  Scenario: An unknown key is refused
    Given a figure description with an extra key "role"
    When it is validated
    Then validation fails

  @test:scripts/tests/figure-description.test.ts::corpus_—_the_committed_file,_so_this_cannot_pass_on_fixtures_alone::cat-harness/library/figure-descriptions.json_validates
  Scenario: The committed figure-descriptions file validates
    # Skipped: when cat-harness/library/figure-descriptions.json does not exist
    Given the committed cat-harness/library/figure-descriptions.json
    When it is parsed with the file schema
    Then it holds at least one description
    And every confirmed narrative was confirmed by a human
    And every described page appears in that entry's vector-labels.json, where that sidecar exists
