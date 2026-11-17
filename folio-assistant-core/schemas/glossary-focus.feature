Feature: foaf:focus on an organization

  @test:schemas/glossary-focus.test.ts::foaf:focus::conceptPointsAtOrganization
  Scenario: the concept points at the organization and is not typed as one
    When the WHO concept is read from the SKOS
    Then it is a skos:Concept with notation WHO whose foaf:focus is the organization

  @test:schemas/glossary-focus.test.ts::foaf:focus::organizationCarriesOrgData
  Scenario: the organization carries its ORG type, homepage, parent and sameAs
    When the WHO organization node is read
    Then it is an org:FormalOrganization with its homepage
    And it is a sub-organization of the UN's focus and sameAs its ROR IRI

  @test:schemas/glossary-focus.test.ts::foaf:focus::prefixesBoundOnlyWithFocus
  Scenario: the prefixes are bound only when a term has a focus
    When a glossary with a focus and an empty one are rendered as SKOS
    Then the first binds org and foaf
    And the empty one binds no org

  @test:schemas/glossary-focus.test.ts::foaf:focus::ownIriUsedForOrganization
  Scenario: an organization with its own IRI is referred to by it
    When the focus IRI is computed with and without an own iri
    Then an own iri is used as is
    And otherwise it is the term IRI followed by /_focus

  @test:schemas/glossary-focus.test.ts::foaf:focus::subOrganizationNeedsFocusOrIri
  Scenario: subOrganizationOf must name a term with a focus, or an IRI
    When subOrganizationOf names various references
    Then a term without focus and an unknown term are refused
    And a term with a focus and an absolute IRI are accepted

  @test:schemas/glossary-focus.test.ts::foaf:focus::unknownOrgTypeRefused
  Scenario: an unknown ORG type is refused
    When a term with focus type "Company" is validated
    Then it is refused
