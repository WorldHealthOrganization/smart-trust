Feature: links from document prose to glossary terms

  @test:scripts/glossary-term-links.test.ts::glossary_term_links::longestLabelWins
  Scenario: the longest label wins, and a plural links to the same term
    When prose with Regulated Trade Item and Trade Items is rendered
    Then the longest label wins and the plural links its term

  @test:scripts/glossary-term-links.test.ts::glossary_term_links::oncePerSection
  Scenario: each term links once per section, and again after a heading
    When prose naming NPC twice, then again after a heading, is rendered
    Then it is linked once per section

  @test:scripts/glossary-term-links.test.ts::glossary_term_links::leavesNonProseAlone
  Scenario: lower case, part of a word, code, links and headings are left alone
    When lower case, part of a word, code, links and headings are rendered
    Then only the existing link remains

  @test:scripts/glossary-term-links.test.ts::glossary_term_links::oneWordNotAtSentenceStart
  Scenario: a one-word label does not link at the start of a sentence
    When a one-word label begins a sentence
    Then only the later mention is linked

  @test:scripts/glossary-term-links.test.ts::glossary_term_links::iriLinkPointsAtEntry
  Scenario: a link to a term's IRI points at its entry, and the term is not linked again in that section
    When prose links a term's IRI and then names it
    Then the IRI link points at its entry and the term is not linked again

  @test:scripts/glossary-term-links.test.ts::glossary_term_links::noLinksUnchanged
  Scenario: without links the output is unchanged
    When prose is rendered with and without an empty link list
    Then the output is the same
