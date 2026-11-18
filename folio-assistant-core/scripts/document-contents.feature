Feature: a Contents list in the document page

  A document page lists its chapters and their sections under its title, each
  linking to its anchor, so a reader who never opens the side panel (on a
  phone it is folded away) still sees what the document holds.

  @test:scripts/document-contents.test.ts::contentsList::chaptersAndSectionsLinked
  Scenario: chapters and their sections are listed and linked
    When a page has two anchored chapters, the first with one section
    Then the Contents list links both chapters and nests the section under the first

  @test:scripts/document-contents.test.ts::contentsList::notAHeading
  Scenario: the Contents title is not a heading
    When the Contents list is written
    Then it holds no h1–h6, so the side panel and the lazy page's folding do not count it as a chapter

  @test:scripts/document-contents.test.ts::contentsList::ownContentsKept
  Scenario: a document with a Contents heading of its own gets no second one
    When the page already has a "Table of contents" heading
    Then no Contents list is added

  @test:scripts/document-contents.test.ts::contentsList::oneChapterNone
  Scenario: a one-chapter document gets no Contents list
    When the page has a single anchored chapter
    Then no Contents list is added

  @test:scripts/document-contents.test.ts::contentsList_figures_and_tables::figuresAndTablesListed
  Scenario: numbered figures and tables are listed by caption
    When a page has a numbered figure and a numbered table
    Then the Contents list has a Figures list and a Tables list, each item linking to its block
