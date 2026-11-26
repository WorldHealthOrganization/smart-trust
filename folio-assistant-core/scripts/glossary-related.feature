Feature: related terms on a layer's glossary page

  @test:scripts/glossary-related.test.ts::related_terms_on_an_instance's_page::openTermListsCandidates
  Scenario: an open term lists its candidates, open, with definition and linked source
    When the entry of an open term is rendered
    Then it lists its candidate open, with definition and linked source

  @test:scripts/glossary-related.test.ts::related_terms_on_an_instance's_page::deadIriLeftOut
  Scenario: an IRI that names no collected term is left out, not drawn as a dead link
    When the entry is rendered
    Then an IRI naming no collected term is not drawn

  @test:scripts/glossary-related.test.ts::related_terms_on_an_instance's_page::authoredKeepsCandidatesCollapsed
  Scenario: an authored term keeps its candidates, collapsed
    When the entry of an authored term is rendered
    Then its candidates are listed collapsed

  @test:scripts/glossary-related.test.ts::related_terms_on_an_instance's_page::scopeNoteShown
  Scenario: an authored scheme's scope note is shown
    When the entry is rendered
    Then the scheme's scope note is shown
