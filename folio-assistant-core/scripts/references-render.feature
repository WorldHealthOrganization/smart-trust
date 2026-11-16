Feature: a document's reference list rendered from its reference nodes

  @test:scripts/references-render.test.ts::whoEntry::whoBookEntry
  Scenario: a book: Title. Place: Publisher; Year (URL).
    When a book is rendered in WHO style
    Then it reads Title. Place: Publisher; Year (URL).

  @test:scripts/references-render.test.ts::whoEntry::whoWebPageEntry
  Scenario: a web page in a site, with its access date; or without it when the list states it once
    When a web page is rendered with and without its access date
    Then it reads In: site, with the access date in the URL's brackets
    And without it the URL stands alone

  @test:scripts/references-render.test.ts::whoEntry::whoJournalEntry
  Scenario: a journal article: Authors. Title. Journal. Year;Vol(Issue):Pages. doi:
    When a journal article is rendered
    Then it reads Authors. Title. Journal. Year;Vol(Issue):Pages. doi:

  @test:scripts/references-render.test.ts::whoEntry::sevenAuthorsEtAlEditors
  Scenario: seven authors list six, then et al; editors are named as editors
    When an entry with seven authors and one with editors are rendered
    Then six authors are listed then et al
    And editors are named as editors

  @test:scripts/references-render.test.ts::shortEntry_and_printed::shortEntry
  Scenario: short: Authors. Title. Year., with no year when the node has none
    When short entries are made with and without a year
    Then they read Authors. Title. Year. or Authors. Title.

  @test:scripts/references-render.test.ts::shortEntry_and_printed::printedVerbatim
  Scenario: a node's printed text is printed verbatim, whatever the style, and is not CSL
    When a node with printed text is rendered in both styles
    Then the printed text is used as it is
    And it is not carried into CSL

  @test:scripts/references-render.test.ts::shortEntry_and_printed::numberedOrBulleted
  Scenario: the list is numbered, or bulleted, one entry per line
    When a list of two entries is rendered numbered and bulleted
    Then each entry is on its own line, numbered or bulleted

  @test:scripts/references-render.test.ts::referenceListsOf::listFromCitedNodes
  Scenario: draws the block's .md from the nodes it cites, in cites order
    When the reference lists of a layer citing b then a are drawn
    Then the block's Markdown lists them in cites order in the chosen style

  @test:scripts/references-render.test.ts::referenceListsOf::badKeyEmptyUnknownOption
  Scenario: a key no node holds, an empty list or an unknown option is an error
    When a list cites an unknown key, cites nothing, or names an unknown style
    Then each is an error saying why
