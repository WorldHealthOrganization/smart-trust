Feature: review anchors made from the working document

  @test:scripts/review-anchors-from-folio.test.ts::review_anchors_from_the_working_document::indexesInReadingOrder
  Scenario: indexes every chapter, section and block in reading order
    When the anchors of a document seeded from an outline are made
    Then the chapters, sections and blocks are listed in reading order with numbers and parents
    And blocks carry excerpts and captions, and the source carries its file and sha256

  @test:scripts/review-anchors-from-folio.test.ts::review_anchors_from_the_working_document::deterministic
  Scenario: is deterministic, so --check can compare bytes
    When the anchors are made twice
    Then the bytes are the same

  @test:scripts/review-anchors-from-folio.test.ts::review_anchors_from_the_working_document::noSeedFile
  Scenario: a document authored from scratch needs no seed file
    When the anchors of a document authored from scratch are made
    Then there is no library or source and the three sections are listed
