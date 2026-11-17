Feature: Declaring a repository as an IG source

  @test:scripts/ig-instantiate.test.ts::ig-instantiate::declaresExistingSources
  Scenario: declares the IG sources that exist, and keeps the rest of the config
    Given a config with another content type and a repository with sushi-config.yaml and input/ but no ig.ini
    When the ig section is added
    Then the config keeps its other content type and gains an ig section including "sushi-config.yaml" and "input/"

  @test:scripts/ig-instantiate.test.ts::ig-instantiate::existingSectionUnchanged
  Scenario: an existing ig section is the author's: nothing changes
    Given a config that already has an ig section
    Then nothing is changed

  @test:scripts/ig-instantiate.test.ts::ig-instantiate::refusesNonIgRepo
  Scenario: a repository with none of the sources is not an IG, and is refused
    Given a repository with none of the IG sources
    Then adding the ig section throws "not an IG repository"
    And "input/" is one of the IG sources

  @test:scripts/ig-instantiate.test.ts::ig-instantiate::ignoresOutputAstOnce
  Scenario: output-ast/ is ignored once, the author's lines kept
    Then "output-ast/" is appended to a gitignore with or without a final newline
    And a gitignore already ignoring "/output-ast/" is unchanged
