# pipeline/cli-args.ts reads a flag's value with requireFlagValue (and paperArg for "--paper"),
# refusing a missing or flag-shaped value; a source scan keeps the unguarded idiom out of pipeline/ and scripts/.
# Each Scenario names the test that executes it.
Feature: The --paper flag value is guarded

  @test:scripts/tests/cli-args-paper-guard.test.ts::requireFlagValue::absent_flag_is_not_an_error_—_it_means_'not_specified'
  Scenario: An absent flag means not specified
    Given the arguments "--other x"
    When the value of "--paper" is required
    Then the result is undefined

  @test:scripts/tests/cli-args-paper-guard.test.ts::requireFlagValue::a_well-formed_value_comes_back
  Scenario: A well-formed value is returned
    Given the arguments "--paper qou --apply"
    When the value of "--paper" is required
    Then the result is "qou"

  @test:scripts/tests/cli-args-paper-guard.test.ts::requireFlagValue::a_flag-shaped_value_is_refused,_naming_what_was_found
  Scenario: A flag-shaped value is refused, naming it as another flag
    Given the arguments "--paper --apply"
    When the value of "--paper" is required
    Then it throws an error saying the flag "needs a value" and found "another flag"

  @test:scripts/tests/cli-args-paper-guard.test.ts::requireFlagValue::a_single-hyphen_token_is_refused_too
  Scenario: A single-hyphen token is refused as a value
    Given the arguments "--paper -x"
    When the value of "--paper" is required
    Then it throws an error mentioning "another flag"

  @test:scripts/tests/cli-args-paper-guard.test.ts::requireFlagValue::a_trailing_flag_with_nothing_after_it_is_refused
  Scenario: A trailing flag with nothing after it is refused
    Given the arguments "--apply --paper"
    When the value of "--paper" is required
    Then it throws an error saying "Nothing followed it"

  @test:scripts/tests/cli-args-paper-guard.test.ts::requireFlagValue::paperArg_is_requireFlagValue_at_--paper
  Scenario: paperArg reads --paper with the same guard
    When paperArg reads "--paper qou"
    Then the result is "qou"
    And when it reads "--paper --apply" it throws an error saying "needs a value"

  @test:scripts/tests/cli-args-paper-guard.test.ts::no_script_re-introduces_the_unguarded_idiom::the_detector_fires_on_a_planted_unguarded_snippet
  Scenario: The unguarded-idiom detector matches a planted snippet
    Given the source line "const i = process.argv.indexOf("--paper");"
    When the detector is applied
    Then it matches

  @test:scripts/tests/cli-args-paper-guard.test.ts::no_script_re-introduces_the_unguarded_idiom::and_finds_nothing_in_pipeline_or_scripts
  Scenario: No TypeScript file in pipeline or scripts uses the unguarded idiom
    Given every .ts file under pipeline/ and scripts/, except cli-args.ts and this test file
    When each is scanned for indexOf of "--paper"
    Then no file is an offender
