Feature: the offline .docx round trip

  @test:scripts/docx-offline.test.ts::offline_.docx_round_trip::anchorsAreBookmarks
  Scenario: every anchor is a bookmark named from its label; no empty anchor paragraphs
    When the offline .docx is read
    Then each anchor label is a bookmark and the chapter's is on its heading
    And there are no empty anchor paragraphs

  @test:scripts/docx-offline.test.ts::offline_.docx_round_trip::finishLineNumbersTrackChangesSameBytes
  Scenario: finish: line numbers, Track Changes on, and the same bytes twice
    When the document is finished again with the same options
    Then it has continuous line numbers and Track Changes on
    And it has the same bytes as before and carries the commit

  @test:scripts/docx-offline.test.ts::offline_.docx_round_trip::changesApplyCarriesTrackedChange
  Scenario: changes --apply carries each tracked change onto the Markdown line
    When the edited .docx's changes are applied
    Then the report names the commit and one block applied by Jane Smith
    And the block's Markdown carries the tracked change

  @test:scripts/docx-offline.test.ts::offline_.docx_round_trip::changedBlockIsConflict
  Scenario: a block changed since export is a conflict and is left alone
    Given the block changed on main since export
    When the changes are applied
    Then the block is a conflict and its file is left alone

  @test:scripts/docx-offline.test.ts::offline_.docx_round_trip::unknownCommitRefused
  Scenario: a file from an unknown commit is refused
    When the changes are applied against a repository without the commit
    Then it exits 2 saying it cannot be merged safely

  @test:scripts/docx-offline.test.ts::exportNamesCommitAndDate
  Scenario: export file names carry the short commit and the date
    When export names are made from a commit and a date
    Then they carry the short commit, and the date for the PDF and review copy
    And a dirty commit is marked dirty
