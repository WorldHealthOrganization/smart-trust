Feature: dak-data-dictionary-diff compares two data-dictionary annexes
  Data elements are compared by id across two versions of a DAK's data
  dictionary: added, removed, changed, moved and column changes, rendered as
  markdown and reported by the CLI's exit code.

  @test:smart-base/L2/scripts/dak-data-dictionary-diff.test.ts::diffDataDictionary::identicalAnnexesNothingChanged
  Scenario: identical annexes: nothing changed, exit-0 shape
    When an annex is diffed against itself
    Then the diff is empty
    And it renders as "No data element changed."

  @test:smart-base/L2/scripts/dak-data-dictionary-diff.test.ts::diffDataDictionary::addedRemovedChangedKeyedById
  Scenario: added, removed and changed are keyed by id, with the changed cell named
    Given an after annex where IMMZ.C.DE.1's data type changes from "ID" to "Identifier", IMMZ.C.DE.3 is gone and IMMZ.C.DE.4 is new
    When it is diffed against the before annex
    Then IMMZ.C.DE.4 is added and IMMZ.C.DE.3 removed
    And IMMZ.C.DE.1 is changed, on sheet "IMMZ.C Client registration", in column "data type" from "ID" to "Identifier"
    And the markdown says "1 added, 1 removed, 1 changed, 0 moved" and has a table row for that change

  @test:smart-base/L2/scripts/dak-data-dictionary-diff.test.ts::diffDataDictionary::reorderedRowsColumnsNotChanges
  Scenario: reordered rows and reordered columns are not changes
    Given an after annex with the same rows and columns of a sheet in another order
    Then the diff is empty

  @test:smart-base/L2/scripts/dak-data-dictionary-diff.test.ts::diffDataDictionary::sheetMoveIsMoved
  Scenario: an element that moves sheet is moved, not removed and added
    Given an after annex where IMMZ.C.DE.3 sits on the "IMMZ.D Administer vaccine" sheet
    Then nothing is added or removed
    And IMMZ.C.DE.3 is moved from "IMMZ.C Client registration" to "IMMZ.D Administer vaccine"

  @test:smart-base/L2/scripts/dak-data-dictionary-diff.test.ts::diffDataDictionary::addedColumnReportedPerSheet
  Scenario: a column added is reported once per sheet, not once per row
    Given an after annex whose client registration sheet gains an "input option" column
    Then no element is changed
    And the column changes are that sheet with "input option" added and nothing removed

  @test:smart-base/L2/scripts/dak-data-dictionary-diff.test.ts::diffDataDictionary::duplicatedIdRefused
  Scenario: a duplicated id is refused, not diffed
    Given an annex with IMMZ.C.DE.1 on two sheets
    Then reading its terms throws "appears twice"

  @test:smart-base/L2/scripts/dak-data-dictionary-diff.test.ts::the_CLI::cliExitCodes
  Scenario: exit 0 when nothing changed, 1 when terms changed, 2 on an unreadable input
    When the CLI compares an annex file with itself
    Then it exits 0
    When it compares it with an annex missing elements
    Then it exits 1 and prints "### Removed"
    When it compares it with a file that is not an annex
    Then it exits 2
