Feature: bootstrap's glossary describes bootstrap's vocabulary, not a copy of it

  @test:scripts/glossary-one-concept.test.ts::bootstrap's_glossary_describes_bootstrap's_vocabulary,_not_a_copy_of_it::vocabularyAndGlossaryPresent
  Scenario: the vocabulary is found, and the glossary is there — neither side empty
    When the vocabulary and the glossary are read
    Then neither is empty

  @test:scripts/glossary-one-concept.test.ts::bootstrap's_glossary_describes_bootstrap's_vocabulary,_not_a_copy_of_it::conceptsAreVocabularyIris
  Scenario: every term's concept IRI is the vocabulary's, and none is minted under glossary/
    When the glossary is rendered as SKOS
    Then there is one concept per term, each with the vocabulary's IRI and none under glossary/

  @test:scripts/glossary-one-concept.test.ts::bootstrap's_glossary_describes_bootstrap's_vocabulary,_not_a_copy_of_it::orderAndRequiresSameConcepts
  Scenario: the ordered list and `requires` point at the same concepts
    When the ordered list and the requires links are read
    Then each points at a vocabulary concept

  @test:scripts/glossary-one-concept.test.ts::bootstrap's_glossary_describes_bootstrap's_vocabulary,_not_a_copy_of_it::noVocabularyMintsOwn
  Scenario: a layer with no declared vocabulary mints its own, as before
    When the concepts of a layer with no declared vocabulary are read
    Then there are none
