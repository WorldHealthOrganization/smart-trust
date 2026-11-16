Feature: converting a .docx structure into a document folio

  @test:scripts/docx-to-folio.test.ts::splitNumber::splitNumberReadsHeadingNumber
  Scenario: reads the printed number off a heading
    When headings are split
    Then numbered and lettered headings give number and title
    And an appendix heading keeps its title, and an unnumbered one has no number

  @test:scripts/docx-to-folio.test.ts::convert::coverIsDocument
  Scenario: the cover title and subtitle are the document's, not a chapter
    When the document is converted
    Then the chapters are the executive summary and chapter 1
    And the subtitle is the document's

  @test:scripts/docx-to-folio.test.ts::convert::heading1NumberedFromChapter
  Scenario: Heading 1 is numbered from its chapter when Word numbers it automatically
    When the sections are listed
    Then their numbers are 1.1, 1.1.1 and 1.2

  @test:scripts/docx-to-folio.test.ts::convert::heading3NestsUnderHeading1
  Scenario: Heading 3 nests under Heading 1, so 1.1.1 is a subsection of 1.1
    When section 1.1.1 is read
    Then its parent is sec:1-1 and the chapter lists it as a subsection

  @test:scripts/docx-to-folio.test.ts::convert::leadSectionTitledAsChapter
  Scenario: text before a chapter's first heading is a LEAD section titled as the chapter
    When the executive summary chapter is read
    Then it has a lead section titled Executive Summary

  @test:scripts/docx-to-folio.test.ts::convert::captionNamesTableAndFigure
  Scenario: a caption names its table and figure, and lends them its line
    When the table and the figure are read
    Then the table is tbl:1-1, captioned Table 1.1, on the caption's line
    And the figure is fig:1 showing media/image1.png

  @test:scripts/docx-to-folio.test.ts::convert::oneCellTableIsQuote
  Scenario: a one-cell table is a boxed quote, not a table
    When the one-cell table is read
    Then it is a prose block written as a quote

  @test:scripts/docx-to-folio.test.ts::convert::footnoteInCitingBlock
  Scenario: a footnote is defined in the block that cites it
    When the block citing footnote 3 is read
    Then it defines the footnote

  @test:scripts/docx-to-folio.test.ts::convert::blockCarriesPagesAndLines
  Scenario: every block carries page, printed page and lines from the review PDF
    When a block is read
    Then it carries page 3, printed page 2, line 8 and its library

  @test:scripts/docx-to-folio.test.ts::convert::labelsSurviveInsertion
  Scenario: labels are content-derived and survive an inserted paragraph
    When the document is converted again with an inserted paragraph
    Then only one new label appears and every earlier one is reused

  @test:scripts/docx-to-folio.test.ts::renderSectionMarkdown_nests_subsections::subsectionsNestDeeper
  Scenario: each subsection keeps its heading, one level deeper, at any depth
    When a section with nested subsections is rendered
    Then each heading is one level deeper and follows its parent's text

  @test:scripts/docx-to-folio.test.ts::renderSectionMarkdown_nests_subsections::leadHasAnchorNoHeading
  Scenario: a lead section has an anchor and no heading
    When a lead section is rendered
    Then it has its anchor and no heading
