Feature: The L1 extractor reads, and never infers
  extract-smart-kg-l1 turns a library entry's labelled recommendations into an
  L1 document, reading GRADE strength and certainty only where stated, and
  leaving fidelity review to a person.

  @test:smart-base/L1/scripts/extract-smart-kg-l1.test.ts::a_recommendation_is_read,_never_inferred::readsGradeFromLabelledBlock
  Scenario: reads GRADE strength and certainty only from the labelled block, and quotes them
    Given an entry whose page holds "Recommendation 3" with "(strong recommendation, moderate-certainty evidence)"
    When its L1 document is built
    Then the recommendation's statement is "WHO recommends offering the vaccine to every infant at birth."
    And its strength is "strong" and its certainty "moderate"
    And its evidence quote contains "strong recommendation" and "moderate-certainty evidence"

  @test:smart-base/L1/scripts/extract-smart-kg-l1.test.ts::a_recommendation_is_read,_never_inferred::leavesNonGradeCategoryUnset
  Scenario: leaves a non-GRADE category unset and says what the source said
    Given an entry whose "Recommendation 8" is categorised "(Recommended only in specific contexts or conditions)"
    When its L1 document is built
    Then the recommendation has no strength and no certainty
    And its note quotes that category

  @test:smart-base/L1/scripts/extract-smart-kg-l1.test.ts::a_recommendation_is_read,_never_inferred::ignoresGradePhraseOutsideBlock
  Scenario: a GRADE phrase outside the block is not read
    Given the ungraded recommendation followed, outside its block, by "a strong recommendation, high-certainty evidence"
    When its L1 document is built
    Then the recommendation has no strength and no certainty

  @test:smart-base/L1/scripts/extract-smart-kg-l1.test.ts::a_recommendation_is_read,_never_inferred::gradeOnlyWithSourcePhraseInQuote
  Scenario: no strength or certainty appears unless its source phrase is in the quote
    Given an entry with the graded and the ungraded recommendation
    Then every strength or certainty set on a recommendation appears as its phrase in that recommendation's quote

  @test:smart-base/L1/scripts/extract-smart-kg-l1.test.ts::a_recommendation_is_read,_never_inferred::inferredCarriesNoteAndEvidence
  Scenario: is inferred, so carries a note and evidence pointing at the file and line
    Given the graded recommendation
    Then it is derived as "inferred"
    And its evidence location is sections/page-001.md line 4
    And its note quotes "Source: WHO, 2020 (4)."

  @test:smart-base/L1/scripts/extract-smart-kg-l1.test.ts::a_recommendation_is_read,_never_inferred::unlabelledProseCountedNotEmitted
  Scenario: prose that recommends without a label is counted, not emitted
    Given a page saying "WHO recommends (recommendation 8) the use of it."
    Then no recommendation is emitted
    And one unlabelled mention is counted

  @test:smart-base/L1/scripts/extract-smart-kg-l1.test.ts::a_recommendation_is_read,_never_inferred::refusesUnendingBlock
  Scenario: refuses a label whose block never ends rather than cutting it at a guess
    Given a "Recommendation 1" followed by more lines than the statement limit
    Then no recommendation is found and one is refused

  @test:smart-base/L1/scripts/extract-smart-kg-l1.test.ts::the_publication::takesElectronicIsbn
  Scenario: takes the ISBN labelled electronic when several are stated
    Given a page stating an electronic and a print ISBN
    Then the ISBN read is the electronic one, "978-92-4-009336-2"

  @test:smart-base/L1/scripts/extract-smart-kg-l1.test.ts::the_publication::takesNoUnlabelledIsbn
  Scenario: takes none when several are stated and none is labelled
    Given a page stating two unlabelled ISBNs
    Then no ISBN is read, and the reason mentions "2 ISBNs"

  @test:smart-base/L1/scripts/extract-smart-kg-l1.test.ts::the_publication::publicationIsFileHashWithoutIsbn
  Scenario: is the file's hash when no ISBN is read
    Given an entry with no ISBN
    Then the publication node's id is "urn:sha256:" followed by the source file's hash

  @test:smart-base/L1/scripts/extract-smart-kg-l1.test.ts::the_vocabulary_is_smart-base's_own::everyClassInKgClassLists
  Scenario: every class the document uses is in the KG class lists
    Given the L1 document of the graded and ungraded recommendations
    Then its node types are exactly publication, publication-section and recommendation
    And none is outside the KG class lists

  @test:smart-base/L1/scripts/extract-smart-kg-l1.test.ts::the_vocabulary_is_smart-base's_own::catchesClassOutsideLists
  Scenario: a class outside the lists is caught
    Given class lists holding only sgkg-l1#publication
    Then publication-section and recommendation are reported unpinned

  @test:smart-base/L1/scripts/extract-smart-kg-l1.test.ts::staleness::currentUpToGeneratedAtStaleOnEdit
  Scenario: is current up to generatedAt, and stale when a source text changes
    Given a serialised L1 document of an entry
    Then it is current against the same entry built at another generatedAt
    When the entry's section text is edited
    Then it is no longer current

  @test:smart-base/L1/scripts/extract-smart-kg-l1.test.ts::staleness::checkFailsStalePassesCurrent
  Scenario: --check fails on a stale document and passes on a current one
    When the script writes an entry's L1 document
    Then it exits 0 and the document contains "recommendation"
    And --check exits 0
    When the section is replaced by the ungraded text
    Then --check exits 1 and prints "stale"

  @test:smart-base/L1/scripts/extract-smart-kg-l1.test.ts::T3_fidelity_is_left_to_a_person_(bean_8pzh)::reportsT3PendingPerson
  Scenario: every run reports T3 pending a person, counting the inferred nodes awaiting review
    Given the L1 document of the graded recommendation
    Then its T3 fidelity is "pending-person"
    And the inferred node count equals the inferred nodes in the document, and is above 0

  @test:smart-base/L1/scripts/extract-smart-kg-l1.test.ts::T3_fidelity_is_left_to_a_person_(bean_8pzh)::neverSetsT3OtherThanPending
  Scenario: the extractor never sets T3 to anything but pending
    Given the extractor's source
    Then it assigns t3 at least once
    And every value assigned is "pending-person"
