Feature: Auditing the IG Publisher's binaries on a pages branch

  @test:scripts/ig-binary-audit.test.ts::ig-binary-audit::namesPublisherBinaries
  Scenario: names the Publisher's binaries and nothing else
    Then "full-ig.zip" and a validator pack are Publisher binaries
    And "adr.zip" and "index.html" are not

  @test:scripts/ig-binary-audit.test.ts::ig-binary-audit::skipsSizelessEntries
  Scenario: skips entries with no size, such as submodules
    Given a tree listing with an entry that has no size
    Then it parses to 7 entries

  @test:scripts/ig-binary-audit.test.ts::ig-binary-audit::countsCopiesAndPreviews
  Scenario: counts copies and bytes, and splits out the previews
    When the tree is audited
    Then it holds 7 files of 108900 bytes, 6 of them binaries of 107900 bytes
    And 3 binaries of 70900 bytes are in 2 previews
    And "full-ig.zip" is the largest, with 3 copies, and the validator packs have 1
    And the formatted audit says "in 2 preview(s)"
