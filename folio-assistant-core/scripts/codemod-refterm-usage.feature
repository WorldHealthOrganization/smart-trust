Feature: codemod-refterm's command-line arguments

  @test:scripts/codemod-refterm-usage.test.ts::codemod-refterm_CLI_argument_handling::noArgumentUsage
  Scenario: exits 2 with usage when given NO argument, rather than throwing
    When the CLI runs with no argument
    Then it exits 2 with its usage and no manifest error

  @test:scripts/codemod-refterm-usage.test.ts::codemod-refterm_CLI_argument_handling::missingDirNamed
  Scenario: exits 2 and NAMES the directory when the path does not exist
    When the CLI runs with a path that does not exist
    Then it exits 2 saying there is no such directory and naming it

  @test:scripts/codemod-refterm-usage.test.ts::codemod-refterm_CLI_argument_handling::flagAloneIsNoArgument
  Scenario: a flag alone is still no argument — `--write` does not stand in for a path
    When the CLI runs with only --write
    Then it exits 2 with its usage

  @test:scripts/codemod-refterm-usage.test.ts::codemod-refterm_CLI_argument_handling::notPaperDirNoUsage
  Scenario: an existing directory that is not a paper does NOT get the usage path
    When the CLI runs on an existing directory that is not a paper
    Then its error output carries no usage
