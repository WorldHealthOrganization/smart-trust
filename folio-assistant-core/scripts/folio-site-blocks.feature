Feature: a block's QA report and Lean status on the folio site

  @test:scripts/folio-site-blocks.test.ts::QA_report::latestVerdictShown
  Scenario: each criterion shows its MOST RECENT verdict, whether a writer appended or prepended it
    When the latest entry is picked from appended, prepended and undated lists
    Then the most recent is picked, or the last when undated

  @test:scripts/folio-site-blocks.test.ts::QA_report::sidecarStaleMilnorFirst
  Scenario: read from the sidecar the platform resolves; stale when the block changed since; Milnor first
    Given a block's QA sidecar recorded before the block changed
    When its report is read
    Then it comes from that sidecar with Milnor first
    And a criterion recorded on the old text is stale and its counts include it
    And criteria are grouped by name

  @test:scripts/folio-site-blocks.test.ts::QA_report::resultsTreeWins
  Scenario: the results tree wins over the legacy sibling, and a block with neither has no report
    Given a legacy sibling sidecar and one in the results tree
    When the report is read
    Then the results tree's verdict is used
    And a block with neither has no report

  @test:scripts/folio-site-blocks.test.ts::Lean::compileMeasuredOrUnchecked
  Scenario: compile status is MEASURED or 'unchecked'; a measured sorry beats the text
    When a theorem's Lean status is read with and without a status file
    Then measured, it fails with its error and a measured sorry
    And unmeasured, it is unchecked and judged by its text

  @test:scripts/folio-site-blocks.test.ts::Lean::absentLeanMarked
  Scenario: a kind that expects Lean with none found is marked absent; a remark is not
    When a definition and a remark have no Lean file
    Then the definition expects Lean, the remark does not

  @test:scripts/folio-site-blocks.test.ts::Lean::leanRefResolves
  Scenario: a lean.ref resolves through the platform resolver once the folio's packages are declared
    Given a folio's Lean package declared to the resolver
    When a lean.ref is resolved for a known and an unknown declaration
    Then the known one resolves by ref to its file, unchecked
    And the unknown one is unresolved with no path
