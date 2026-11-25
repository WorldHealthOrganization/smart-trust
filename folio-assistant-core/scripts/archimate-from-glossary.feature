Feature: an ArchiMate model kept in step with the glossary's foaf:focus

  @test:scripts/archimate-from-glossary.test.ts::archimate-from-glossary::plansByLink
  Scenario: plans by link: renames, documents, creates the missing element, adds the listed relationship
    Given a model with linked and unlinked elements, and glossary terms with ArchiMate focuses
    When the plan is made
    Then two elements are linked and one unlinked
    And the linked ones are renamed and documented, client-role is created, and one Realization is added
    And id-old is listed as an extra relationship with no problems
    And planning again gives the same plan

  @test:scripts/archimate-from-glossary.test.ts::archimate-from-glossary::typeDisagreementReported
  Scenario: a type that disagrees is reported, never changed
    When a term says an ApplicationComponent element is an ApplicationService
    Then the plan reports the disagreement and changes nothing

  @test:scripts/archimate-from-glossary.test.ts::archimate-from-glossary::writtenBackAgrees
  Scenario: written back: the model then agrees, and no box moved
    When the plan is applied to the model's XML and planned again
    Then nothing is left to create, update or relate
    And the element is documented and the new role carries its skosConcept property
    And the existing bounds and the unlisted relationship's line are kept

  @test:scripts/archimate-from-glossary.test.ts::archimate-from-glossary::pruneRemovesUnlisted
  Scenario: --prune removes the unlisted relationship and the line that draws it
    When the plan is applied with prune
    Then the unlisted relationship and its connection are gone
    And planning again finds no extra

  @test:scripts/archimate-from-glossary.test.ts::archimate-from-glossary::seedMovesLinkedOnce
  Scenario: --seed moves a model's linked elements into the graph once, never over an existing focus
    When the model seeds glossary terms, one of which already has a focus
    Then only the term without a focus is seeded
    And when both lack a focus, client-lookup is seeded with its Serving relationship

  @test:scripts/archimate-from-glossary.test.ts::archimate-from-glossary::seedOnlyIngestedModel
  Scenario: --seed reads only an ingested model, held under library/
    When model paths are checked for being ingested
    Then only a model under the repository's library/ is ingested
