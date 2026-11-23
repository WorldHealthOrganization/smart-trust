Feature: tool ids that a reader should not see in prose

  @test:scripts/check-reader-ids.test.ts::check-reader-ids::passesLinkedTitle
  Scenario: passes a linked title, whatever the link target holds
    When prose with linked titles is checked
    Then nothing is flagged

  @test:scripts/check-reader-ids.test.ts::check-reader-ids::flagsBlockLabel
  Scenario: flags a block label written out
    When prose that writes out two block labels is checked
    Then both labels are flagged

  @test:scripts/check-reader-ids.test.ts::check-reader-ids::flagsModelIdsPathsHitPolicy
  Scenario: flags BPMN and DMN ids, paths and hit policies
    When prose naming a lane, a rule, a DMN path and a hit policy is checked
    Then each is flagged with its kind

  @test:scripts/check-reader-ids.test.ts::check-reader-ids::leavesRequirementCodes
  Scenario: leaves requirement and role codes, which tables show as data
    When a table row of requirement and role codes is checked
    Then nothing is flagged

  @test:scripts/check-reader-ids.test.ts::check-reader-ids::urlAndTimeNotLabels
  Scenario: does not read a URL scheme or a time as a label
    When prose with a URL and a time is checked
    Then nothing is flagged

  @test:scripts/check-reader-ids.test.ts::check-reader-ids::skipsAllowedBlock
  Scenario: skips a block marked as documenting the model
    When a block marked as documenting the model is checked
    Then nothing is flagged

  @test:scripts/check-reader-ids.test.ts::check-reader-ids::reportsLine
  Scenario: reports the line
    When a file with a label on line 2 is scanned
    Then the finding has the file, line 2, kind and text

  @test:scripts/check-reader-ids.test.ts::check-reader-ids::ignoresHtmlComments
  Scenario: ignores single-line and multiline HTML comments while keeping line numbers
    When text with labels in single-line and multi-line comments is scanned
    Then only the visible label is found, on line 5
