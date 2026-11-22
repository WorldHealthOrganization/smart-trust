Feature: dth init writes the wiring of a new digital transformation handbook
  The files dth init plans for a new DTH repository, and how it applies them
  over files already there.

  @test:smart-base/scripts/dth-init.test.ts::dth_init::namesSharedCoreChecks
  Scenario: names the shared core checks, never a local copy
    Given the plan for a DTH "dth-xx" with ISBN 9789240000000
    Then its package.json's check:l1-coverage runs folio-assistant-core's folio-l1-coverage.ts for that document and library entry
    And its check:dth-glossary runs folio-assistant-core's glossary-validate.ts for "dth-xx"
    And no script names scripts/folio/ or scripts/glossary/

  @test:smart-base/scripts/dth-init.test.ts::dth_init::mountsRemotePinsAndOwnInstance
  Scenario: mounts the remote pins as written, and only its own local instance
    Given the plan, with a local pin "dth-old" and a remote pin "who-iris"
    Then its index.config.json's instances are "dth-xx" and "who-iris"
    And the who-iris remote keeps its trust consent as written

  @test:smart-base/scripts/dth-init.test.ts::dth_init::fillsEveryTemplatePlaceholder
  Scenario: fills every template placeholder
    Given the plan
    Then no planned file contains a "{{name}}" placeholder
    And the plan includes a .gitignore

  @test:smart-base/scripts/dth-init.test.ts::dth_init::writesSheetLinkOnlyWithSheet
  Scenario: writes the sheet link only when given a sheet
    Then the plan without a sheet has no file under review/
    And the plan with a sheet includes review/drafting/sheet-sync.json

  @test:smart-base/scripts/dth-init.test.ts::dth_init::keepsExistingFilesMergesPackageJson
  Scenario: leaves existing files alone unless forced, and merges package.json
    Given a directory with its own AGENTS.md and a package.json with scripts "seed:folio" and "cat"
    When the plan is applied
    Then AGENTS.md is skipped and still reads "mine"
    And package.json keeps "seed:folio" and its "cat" script becomes the harness's run-script
    When the plan is applied with force
    Then AGENTS.md contains "dth init"

  @test:smart-base/scripts/dth-init.test.ts::dth_init::keepsOwnDependencyVersions
  Scenario: keeps a repository's own dependency versions
    Given a package.json depending on zod "^4.6.5"
    When it is merged with the planned package.json
    Then zod stays "^4.6.5"
