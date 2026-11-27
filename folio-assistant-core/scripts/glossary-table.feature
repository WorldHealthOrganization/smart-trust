Feature: the glossary and acronym tables drawn from a glossary

  @test:scripts/glossary-table.test.ts::glossary-table::termsTableLabelsNotes
  Scenario: prints labels with their altLabels, and the editorial note in brackets after the definition
    When the terms table is drawn
    Then labels carry their alt labels and editorial notes follow the definition in brackets

  @test:scripts/glossary-table.test.ts::glossary-table::acronymsTableNotationOnly
  Scenario: lists only terms with a notation as acronyms, the first row standing as the header
    When the acronyms table is drawn
    Then it lists only terms with a notation, the first row as header

  @test:scripts/glossary-table.test.ts::glossary-table::keepsCaptionAndFootnotes
  Scenario: keeps a caption above the table and footnotes below it
    When a table in a block is replaced
    Then the caption above and the footnotes below are kept

  @test:scripts/glossary-table.test.ts::glossary-table::refusesEscapingPath
  Scenario: refuses a config path that leaves the layer
    When a config naming ../g.json is validated
    Then it is refused

  @test:scripts/glossary-table.test.ts::glossary-table::drawsConfiguredTables
  Scenario: draws every table the layer's config names
    Given a layer config naming one terms table
    When the tables are drawn
    Then there is one, starting with the Term header
