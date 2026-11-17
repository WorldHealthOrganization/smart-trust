Feature: l1-kgid mints smart-kg's IRIs
  The IRIs minted for L1 publications, sections, elements, references,
  citations and DAK namespaces match the outputs recorded from WHO
  smart-kg's kgid.mjs.

  @test:smart-base/L1/scripts/l1-kgid.test.ts::l1-kgid_mints_smart-kg's_IRIs::publicationIriFromFirstIdentifier
  Scenario: publication IRI from the first of isbn, iris-handle, doi, issn, url
    Given identifiers of a publication
    When an iris-handle and an isbn are both given
    Then the publication IRI is built from the isbn: ".../publication/isbn-9789240016514"
    When only the iris-handle "10665/340749" is given
    Then the publication IRI is ".../publication/iris-handle-10665-340749"
    When no identifier is given
    Then minting the publication IRI throws

  @test:smart-base/L1/scripts/l1-kgid.test.ts::l1-kgid_mints_smart-kg's_IRIs::mintsSectionElementReferenceCitationIris
  Scenario: section, element, reference, citation
    Given a publication IRI
    Then section "1.2" is "<pub>/section/1.2" and section "Annex 3" is "<pub>/section/Annex-3"
    And element "Table A1.1" is "<pub>/element/table-a1-1"
    And reference entry "26" of an artifact is "<artifact>/reference/26"
    And a citation of "abc" is "<dak>/citation/" followed by the short hash of "abc"
    And the DAK namespace of "http://smart.who.int/immunizations/bpmn/" is "https://smart.who.int/immunizations"
