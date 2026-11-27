Feature: An IG's CodeSystem translation supplements are checked with the pinned SUSHI

  @test:scripts/check-translation-supplements.test.ts::pins::the_lockfile_installs_the_SUSHI_ig-toolchain.env_pins
  Scenario: the lockfile installs the SUSHI version ig-toolchain.env pins
    Then the SUSHI version in the lockfile is the pinned SUSHI version

  @test:scripts/check-translation-supplements.test.ts::pins::the_lockfile_pins_every_package_by_integrity
  Scenario: the lockfile pins every package by a sha512 integrity
    Then every package in the lockfile, other than the root and a bundled package, has a sha512 integrity

  @test:scripts/check-translation-supplements.test.ts::pins::the_core_packages_for_R4_and_R5_are_pinned_by_sha512;_another_version_is_not
  Scenario: the FHIR core packages for R4 and R5 are pinned; another FHIR version is not
    Then the core package for 4.0.1 has a sha512 integrity
    And the core package for 5.0.0 is hl7.fhir.r5.core
    And there is no pinned core package for 3.0.2

  @test:scripts/check-translation-supplements.test.ts::the_FSH_split::finds_the_entities,_not_a_keyword_inside_a_string_or_a_comment
  Scenario: the FSH split finds the entities, not a keyword inside a string or a comment
    Given the fixture IG's codesystems.fsh
    Then its entities are the Alias, the RuleSet, the CodeSystem and the ValueSet, in order
    And the CodeSystem's id is the one its Id: line gives

  @test:scripts/check-translation-supplements.test.ts::the_FSH_split::keeps_CodeSystems,_Aliases_and_RuleSets_only
  Scenario: the compilable FSH keeps CodeSystems, Aliases and RuleSets only
    Given the fixture IG's codesystems.fsh
    Then the compilable FSH holds the CodeSystem and the RuleSet and not the ValueSet

  @test:scripts/check-translation-supplements.test.ts::the_FSH_split::a_CodeSystem_without_Id:_takes_its_name
  Scenario: a CodeSystem without an Id: line takes its name as its id
    Then a CodeSystem named Plain with no Id: has the id Plain

  @test:scripts/check-translation-supplements.test.ts::what_is_read::the_fixture's_translations_and_definitions
  Scenario: the fixture IG's translations and definitions are read
    When the fixture IG's inputs are read
    Then its one translation is the French file under input/fsh/translations
    And its one definition file is input/fsh/codesystems.fsh
    And its FHIR version is 4.0.1

  @test:scripts/check-translation-supplements.test.ts::what_is_read::no_translations_directory_is_not_applicable
  Scenario: an IG with no translations directory is not applicable
    Given a copy of the fixture IG without its translations directory
    When the check runs
    Then the status is not-applicable and the exit code is 0

  @test:scripts/check-translation-supplements.test.ts::what_is_read::a_translations_directory_outside_the_declared_scope_is_not_read
  Scenario: a translations directory outside the declared read scope is not read
    Given a copy of the fixture IG whose contentTypes.ig include lists only sushi-config.yaml and codesystems.fsh
    Then its inputs read as nothing
    And the check's status is not-applicable

  @test:scripts/check-translation-supplements.test.ts::what_is_read::an_undeclared_sushi-config.yaml_cannot_run
  Scenario: an IG whose read scope leaves out sushi-config.yaml cannot run
    Given a copy of the fixture IG whose contentTypes.ig include lists only input/fsh/
    When the check runs
    Then the status is cannot-run and the exit code is 2

  @test:scripts/check-translation-supplements.test.ts::judge,_without_SUSHI::a_good_supplement_has_no_findings
  Scenario: a good supplement has no findings
    Given the base CodeSystem and a French supplement of it whose designation is in French for a nested code
    When they are judged
    Then there are no findings

  @test:scripts/check-translation-supplements.test.ts::judge,_without_SUSHI::a_CodeSystem_in_a_translation_file_that_is_not_a_supplement
  Scenario: a CodeSystem in a translation file that is not a supplement is a finding
    Given a CodeSystem in the French translation whose content is complete
    When it is judged with the base CodeSystem
    Then the one finding says its content is complete, not supplement

  @test:scripts/check-translation-supplements.test.ts::with_SUSHI::the_good_supplement_compiles_with_0_errors_and_passes
  Scenario: with the pinned SUSHI, the good supplement compiles with 0 errors and passes
    Given the pinned SUSHI installed from the lockfile
    When the check runs over the fixture IG
    Then there are no SUSHI errors and no findings, and the status is pass
    And the report names the SUSHI version, the core package, 0 SUSHI errors, 1 CodeSystem and 1 French supplement

  @test:scripts/check-translation-supplements.test.ts::with_SUSHI::the_bad_supplement:_unknown_code,_wrong_language,_a_designation_in_a_third_language
  Scenario: the bad supplement is refused for an unknown code, a wrong language and a designation in a third language
    Given the fixture IG with the Spanish supplement added
    When the check runs with the pinned SUSHI
    Then the status is fail and the exit code is 1
    And the findings name the code not in the CodeSystem, the language that is not the file's locale, and the designation in another language

  @test:scripts/check-translation-supplements.test.ts::with_SUSHI::a_supplement_of_a_CodeSystem_the_IG_lacks_fails_on_SUSHI's_error_and_on_the_check
  Scenario: a supplement of a CodeSystem the IG lacks fails on SUSHI's error and on the check
    Given the fixture IG with the Italian supplement of a CodeSystem it does not have
    When the check runs with the pinned SUSHI
    Then the status is fail
    And the messages are SUSHI's error about the missing canonical URL and the check's finding that it supplements nothing of this IG

  @test:scripts/check-translation-supplements.test.ts::with_SUSHI::a_duplicated_id_is_named_once,_with_both_files
  Scenario: a duplicated supplement id is named once, with both files
    Given the fixture IG with a German supplement that reuses the French supplement's id
    When the check runs with the pinned SUSHI
    Then the status is fail
    And the messages are SUSHI's duplicate-id error and one finding naming the id, its 2 uses and both files

  @test:scripts/check-translation-supplements.test.ts::with_SUSHI::a_SUSHI_that_is_not_the_pinned_version_is_refused
  Scenario: a SUSHI that is not the pinned version is refused
    Given a SUSHI that reports version 9.9.9
    When the check runs with it
    Then the status is cannot-run, and the reason says it is SUSHI 9.9.9, not the pinned version
