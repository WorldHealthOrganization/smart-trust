# The four content axes (adapters, profiles, visualiser kinds, interactivity) declared
# in schemas/content/block-kinds.ts and schemas/kg/cat-harness.ts stay distinct, and
# the two newer axes keep their defining properties. Each Scenario names the test that executes it.
Feature: The four content axes stay four

  @test:schemas/content-axes.test.ts::the_four_axes_are_four,_and_none_is_a_synonym_for_another::no_value_appears_on_two_axes,_except_the_ONE_that_is_meant_to
  Scenario: Only "document" appears on two content axes
    # Gap: the test's comment names `paper` as the deliberate overlap, but the assertion pins "document"; the reason is not checked.
    Given the adapter, profile, visualiser and interactivity vocabularies
    When the number of axes each value appears on is counted
    Then exactly one value appears on more than one axis
    And that value is "document"

  @test:schemas/content-axes.test.ts::the_four_axes_are_four,_and_none_is_a_synonym_for_another::the_two_NEW_axes_overlap_nothing_at_all
  Scenario: The visualiser and interactivity axes share no value with adapters or profiles
    Given the union of the adapter and profile vocabularies
    When each visualiser kind and interactivity value is looked up in it
    Then none of them is found

  @test:schemas/content-axes.test.ts::the_four_axes_are_four,_and_none_is_a_synonym_for_another::each_axis_is_non-empty,_so_none_of_this_is_vacuous
  Scenario: Every content axis has at least one value
    Given the adapter, profile, visualiser and interactivity vocabularies
    Then each has a length greater than zero

  @test:schemas/content-axes.test.ts::interactivity_—_`undetermined`_is_a_VALUE,_not_an_absence::the_axis_carries_all_three_answers
  Scenario: The interactivity axis holds interactive, static and undetermined
    Given the interactivity vocabulary
    Then sorted it is exactly "interactive", "static", "undetermined"

  @test:schemas/content-axes.test.ts::interactivity_—_`undetermined`_is_a_VALUE,_not_an_absence::absent_and_`undetermined`_are_DIFFERENT_states_on_a_real_config
  Scenario: A harness config keeps an absent interactivity distinct from "undetermined"
    Given a harness config with contentType "document" and no interactivity
    And a harness config with contentType "document" and interactivity "undetermined"
    When both are parsed with the harness config schema
    Then the first has no interactivity
    And the second has interactivity "undetermined"

  @test:schemas/content-axes.test.ts::interactivity_—_`undetermined`_is_a_VALUE,_not_an_absence::it_is_a_widening,_which_is_why_it_could_not_be_a_profile
  Scenario: Interactivity cross-cuts profiles rather than nesting with them
    # Gap: only checks that four hand-written profile/interactivity pairs are distinct; no schema accepts or rejects them
    Given the pairs document/static, document/interactive, paper/static and paper/interactive
    Then the four pairs are all distinct

  @test:schemas/content-axes.test.ts::the_visualiser_axis_attaches_PER_GRAPH::a_directory_may_declare_it
  Scenario: A content directory may declare visualisedAs
    Given a content directory "lib" at "library/" with visualisedAs "folio"
    When it is parsed with the content directory schema
    Then its visualisedAs is "folio"

  @test:schemas/content-axes.test.ts::the_visualiser_axis_attaches_PER_GRAPH::ABSENT_is_not_a_default_—_a_consumer_reading_one_would_be_inventing_it
  Scenario: An undeclared visualisedAs is not defaulted
    Given a content directory with no visualisedAs
    When it is parsed with the content directory schema
    Then its visualisedAs is undefined

  @test:schemas/content-axes.test.ts::the_visualiser_axis_attaches_PER_GRAPH::a_value_outside_the_vocabulary_is_refused
  Scenario: A visualisedAs outside the vocabulary is refused
    Given a content directory with visualisedAs "whiteboard"
    When it is parsed with the content directory schema
    Then parsing throws

  @test:schemas/content-axes.test.ts::the_visualiser_axis_attaches_PER_GRAPH::it_is_NOT_`coverage.visualiser`_—_the_two_coexist_on_one_directory
  Scenario: visualisedAs and coverage.visualiser coexist on one directory
    Given a content directory with visualisedAs "folio" and a coverage.visualiser page path
    When it is parsed with the content directory schema
    Then its visualisedAs is "folio"
    And its coverage.visualiser is still defined

  @test:schemas/content-axes.test.ts::one_visualiser,_and_the_count_is_a_claim::cat-harness_provides_exactly_one
  Scenario: cat-harness provides exactly one visualiser, folio
    Given the visualiser kinds vocabulary
    Then it is exactly "folio"
