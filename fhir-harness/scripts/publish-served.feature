Feature: Publishing an instance's served directories

  @test:scripts/publish-served.test.ts::publish-served::copiesServedDirsToRoot
  Scenario: copies only this instance's served directories, at the site root
    Given an instance with two served directories that exist
    Then both are copied to the site root and nothing is refused

  @test:scripts/publish-served.test.ts::publish-served::refusesAlreadyPublished
  Scenario: refuses a destination the site already publishes, rather than merging into it
    Given a site that already publishes "openapi"
    Then only the artifact index is copied and "openapi/" is refused

  @test:scripts/publish-served.test.ts::publish-served::refusesMissingDir
  Scenario: refuses a declared directory that does not exist
    Given a served directory that does not exist
    Then it is refused, naming the missing path
