Feature: checking a materialized localPath

  @test:scripts/local-path.test.ts::checkLocalPath::presentFileOk
  Scenario: a file that is there is ok
    When a present file is checked
    Then it is ok

  @test:scripts/local-path.test.ts::checkLocalPath::absentPathMissing
  Scenario: a path that is not there is missing, with no detail to invent
    When an absent path is checked
    Then it is missing with no detail

  @test:scripts/local-path.test.ts::checkLocalPath::directoryIsMissing
  Scenario: a DIRECTORY is missing, not ok — localPath is where bytes landed
    When a directory at the path is checked
    Then it is missing, saying it is a directory

  @test:scripts/local-path.test.ts::checkLocalPath::unreadableIsUnknown
  Scenario: UNREADABLE is its own state and is never reported as absent
    When a file in an unreadable directory is checked
    Then when the permission takes, it is unknown with a detail, never absent

  @test:scripts/local-path.test.ts::checkLocalPath::resolvesAgainstInstance
  Scenario: it resolves against the LAYER and nowhere else
    When a path present only in a sibling is checked against the layer
    Then it is missing

  @test:scripts/local-path.test.ts::the_who-iris_catalogue's_own_localPath_claims::catalogueClaimsResolve
  Scenario: every claim resolves, or the catalogue is lying about `materialized`
    When every localPath in the who-iris catalogue is checked
    Then each is ok

  @test:scripts/local-path.test.ts::the_who-iris_catalogue's_own_localPath_claims::materializedHasLocalPath
  Scenario: a materialized bitstream carries a localPath at all
    When every materialized bitstream in the catalogue is read
    Then each has a localPath
