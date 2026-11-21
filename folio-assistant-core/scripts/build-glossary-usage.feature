Feature: build-glossary's command-line arguments

  @test:scripts/build-glossary-usage.test.ts::build-glossary_CLI_argument_handling::noArgumentUsage
  Scenario: exits 2 with usage when given NO argument, rather than throwing
    When the CLI runs with no argument
    Then it exits 2 with its usage and no manifest error

  @test:scripts/build-glossary-usage.test.ts::build-glossary_CLI_argument_handling::missingDirNamed
  Scenario: exits 2 and NAMES the directory when the path does not exist
    When the CLI runs with a path that does not exist
    Then it exits 2 saying there is no such directory and naming it

  @test:scripts/build-glossary-usage.test.ts::build-glossary_CLI_argument_handling::flagAloneIsNoArgument
  Scenario: a flag alone is still no argument — `--check` does not stand in for a path
    When the CLI runs with only --check
    Then it exits 2 with its usage

  @test:scripts/build-glossary-usage.test.ts::build-glossary_CLI_argument_handling::notPaperDirNoUsage
  Scenario: an existing directory that is not a paper does NOT get the usage path
    When the CLI runs on an existing directory that is not a paper
    Then it does not exit 2 and says the paper manifest was not found
