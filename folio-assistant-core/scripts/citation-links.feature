Feature: numbered citations and the reference list, linked both ways

  A document that cites by number writes `<sup>N</sup>` in its prose and keeps
  a numbered list under a "References" heading. The rendered page links each
  citation to its reference, each reference back to every place it is cited,
  and each reference to its bibliography entry when exactly one matches.

  @test:scripts/citation-links.test.ts::linkCitations::citationLinksToReference
  Scenario: a citation links to its reference
    When a paragraph cites reference 2 and the list has three items
    Then the citation links to "#ref-2"
    And the second item carries the anchor "ref-2"

  @test:scripts/citation-links.test.ts::linkCitations::backLinksLetterEachCitation
  Scenario: a reference cited twice links back to both places
    When reference 1 is cited in two paragraphs
    Then its item ends with "↩ a b", linking to each citation

  @test:scripts/citation-links.test.ts::linkCitations::listsAndRangesExpand
  Scenario: a list or range of citations links every number it covers
    When a citation reads "1,3–4"
    Then each written number links to its reference
    And references 1, 3 and 4 link back to it, and reference 2 does not

  @test:scripts/citation-links.test.ts::linkCitations::outOfRangeLeftAsWritten
  Scenario: a superscript naming a reference the list does not have is left as written
    When a paragraph has "<sup>9</sup>" and the list has three items
    Then the superscript is unchanged

  @test:scripts/citation-links.test.ts::linkCitations::acrossLazyParts
  Scenario: a lazy page links a citation in one block to the list in another
    When the document is given as blocks and the list is in its own block
    Then the citing block links to the reference and the list block links back

  @test:scripts/citation-links.test.ts::linkCitations::noReferenceListNoChange
  Scenario: a document with no reference list is unchanged
    When the document has superscripts but no "References" heading
    Then the HTML is returned as it was

  @test:scripts/citation-links.test.ts::linkCitations::bibliographyEntryWhenOneMatches
  Scenario: a reference links to its bibliography entry only when exactly one entry matches
    When one item's DOI names one entry, and another item names no entry
    Then the first item links to that entry and the second has no bibliography link

  @test:scripts/citation-links.test.ts::identifierKeys::doiHandleAndUrlNormalised
  Scenario: the same work matches across DOI, handle and URL spellings
    When a DOI is written as "doi:" and as a doi.org link, and a handle as hdl.handle.net
    Then each normalises to the same key

  @test:scripts/citation-links.test.ts::bracketed_citations::whoStyleBracketLinks
  Scenario: a WHO-style bracketed citation links to its reference
    When running text cites "(2)" and "(1, 3)" after words
    Then each number links to its reference, and the references link back

  @test:scripts/citation-links.test.ts::bracketed_citations::enumerationLeftAlone
  Scenario: an enumeration is not read as citations
    When "(1)" follows a colon and "(2)" a semicolon
    Then neither is linked

  @test:scripts/citation-links.test.ts::bracketed_citations::notInsideLinksOrCode
  Scenario: a bracketed number inside a link or code is not a citation
    When "(1)" is in a link's text and "(2)" in code
    Then neither is linked

  @test:scripts/citation-links.test.ts::bracketed_citations::inlineEnumerationLeftAlone
  Scenario: an enumeration inside a sentence is not read as citations
    When "(2)" follows "; and" with words after it, and "(3)" follows a full stop
    Then neither is linked

  @test:scripts/citation-links.test.ts::bracketed_citations::noSpaceIsACode
  Scenario: a bracketed number with no space before it is part of a code
    When a DOI holds "7500(2)00038" and a sentence ends "more (1)."
    Then the DOI is left as written and only "(1)" is linked
