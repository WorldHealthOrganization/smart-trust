# scripts/init-folio.ts initStaged (init-folio --staged <path>): stages a sub-KG inside a host repository, writing only its declaration and import seam and nothing at the repository level.
# Each Scenario names the test that executes it.
Feature: init-folio --staged stages a sub-KG inside a host repository

  @test:scripts/tests/init-folio-staged.test.ts::init-folio_--staged::writes_exactly_the_declaration_and_the_seam,_and_nothing_at_the_repository_level
  Scenario: Staging writes only the declaration and the seam
    Given a host repository holding host.json, AGENTS.md and a beans directory
    When initStaged stages "my-ig" at path "my-ig"
    Then the only files added to the host tree are "my-ig/my-ig.json" and "my-ig/platform.ts"
    And the result lists exactly those two files as created
    And the host's AGENTS.md is unchanged and no file outside my-ig/ was added

  @test:scripts/tests/init-folio-staged.test.ts::init-folio_--staged::the_declaration_is_a_staged_instance:_repository_differs_from_livesAt
  Scenario: The written declaration is a staged instance living in the host
    Given a host repository
    When initStaged stages "nested-ig" at path "folio/nested-ig" for repository "owner/my-ig" in host "owner/host"
    Then the declaration parses against the cat-harness declaration schema
    And its name is "nested-ig" and its repository is "owner/my-ig"
    And its livesAt is repository "owner/host" at path "folio/nested-ig"
    And its needs are "fhir-harness" and its directories are empty

  @test:scripts/tests/init-folio-staged.test.ts::init-folio_--staged::dry_run_writes_nothing
  Scenario: A dry run writes nothing
    Given a host repository
    When initStaged runs as a dry run
    Then the result still lists 2 files as created
    And the host tree is unchanged

  @test:scripts/tests/init-folio-staged.test.ts::init-folio_--staged::a_re-run_leaves_an_existing_declaration_alone
  Scenario: A re-run leaves an existing declaration alone
    Given a host where "my-ig" was staged and its declaration then overwritten with "{}"
    When initStaged runs again
    Then "my-ig/my-ig.json" is listed as skipped
    And its content is still "{}"

  @test:scripts/tests/init-folio-staged.test.ts::init-folio_--staged::refuses_the_host_root,_an_escaping_path,_no_needs,_and_a_planned_home_that_is_the_host
  Scenario: Invalid staging requests are refused without writing
    Given a host repository
    When initStaged is asked to stage at "." or at "../out"
    Then it throws saying the path must be INSIDE the host
    And with empty needs it throws naming "--needs"
    And with repository "owner/host" it throws saying it is not staged
    And with repository "nope" it throws asking for owner/name
    And the host tree is still only AGENTS.md and host.json
