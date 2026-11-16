Feature: foaf:focus on an ArchiMate element

  @test:schemas/glossary-archimate-focus.test.ts::foaf:focus_on_an_ArchiMate_element::conceptFocusesArchimateElement
  Scenario: the concept points at its element, typed in ArchiMate's namespace
    When the glossary with ArchiMate focuses is rendered as SKOS
    Then the client-registry concept's foaf:focus is its element
    And the element is typed archimate:ApplicationComponent
    And the archimate prefix is bound and org is not

  @test:schemas/glossary-archimate-focus.test.ts::foaf:focus_on_an_ArchiMate_element::relationshipIsElementPredicate
  Scenario: each relationship is a predicate from element to element
    When the element nodes are read
    Then client-registry realizes client-identification
    And point-of-service serves client-identification and accesses client-record

  @test:schemas/glossary-archimate-focus.test.ts::foaf:focus_on_an_ArchiMate_element::relationshipTargetMustBeElement
  Scenario: a relationship must reach another element, and accessType only on Access
    When relationships with various targets, and an accessType on Serving, are validated
    Then a term with no ArchiMate focus is refused as target
    And an unknown target is refused as neither a term nor an absolute IRI
    And an absolute IRI target is accepted
    And accessType on a Serving relationship is refused
