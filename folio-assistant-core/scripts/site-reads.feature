Feature: what each site builder says it reads

  @test:scripts/site-reads.test.ts::documentSiteReadsFolio
  Scenario: build-document-site reads the folio
    When build-document-site is asked
    Then it reads folio

  @test:scripts/site-reads.test.ts::publicCommentSiteReads
  Scenario: public-comment-site reads the comment store, or the one --store names, and the folio
    When public-comment-site is asked with and without --store
    Then it reads the comment store, or the named store, and the folio

  @test:scripts/site-reads.test.ts::nodeKindPagesReads
  Scenario: gen-node-kind-pages reads the directories of the typologies holding a kind it renders: todos, and beans since ujiv
    When gen-node-kind-pages is asked
    Then it reads todos, the comment store and beans, but not folio
