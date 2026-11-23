# Every package.json script that runs translation-block-qa.ts with --check
# passes only flags the judge accepts: translation:page-qa:check once passed
# --catalogues and exited before judging anything. Each Scenario names the
# test that executes it.
Feature: The translation QA gates pass only flags the judge accepts

  @test:scripts/tests/translation-block-qa-flags.test.ts::translation-block-qa_--check_flags::both_gates_are_found
  Scenario: Both translation QA gates are found
    Given the package.json scripts and checkout scripts
    When those running translation-block-qa.ts with --check are selected
    Then they are exactly "translation:block-qa:check" and "translation:page-qa:check"

  @test:scripts/tests/translation-block-qa-flags.test.ts::translation-block-qa_--check_flags::%s_passes_no_flag_the_judge_refuses
  Scenario: Each gate passes no flag the judge refuses
    Given a script that runs translation-block-qa.ts with --check
    When the arguments after the script path are compared with the judge's flags
    Then none is unknown to the judge
