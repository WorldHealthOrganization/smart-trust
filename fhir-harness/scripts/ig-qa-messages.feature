Feature: The IG Publisher's full message list, carried beside the AST

  @test:scripts/ig-qa-messages.test.ts::ig-qa-messages::groupsTheBundleInThePublishersOrder
  Scenario: the Publisher's qa.xml becomes groups of messages in its own order
    Given a qa.xml Bundle with the build's own warning and then a file's error and hint
    When it is converted
    Then the build's messages come first with no file, and the file's messages carry its path
    And each message keeps its severity, code, text, location, line, column, source and message id, with XML entities read

  @test:scripts/ig-qa-messages.test.ts::ig-qa-messages::noQaXmlStillWritesAFileThatSaysSo
  Scenario: a build whose Publisher wrote no qa.xml still gets a file that says so
    Given no qa.xml
    When the converter runs
    Then it writes a file with no groups that says the Publisher wrote no qa.xml, so the AST is not rebuilt for it again

  @test:scripts/ig-qa-messages.test.ts::ig-qa-messages::anIncrementalAstCarriesItsBasesPublisherQaAndSaysWhichRunItCameFrom
  Scenario: an incremental build's AST keeps its base's Publisher QA, and says which full run it came from
    Given a base AST holding qa.json and qa-messages.json from a full Publisher run
    When an incremental build writes a new AST over it with none
    Then the new AST carries both files, and qa-origin.json names the full run's source revision and time
    And a further incremental build keeps the first full run as the origin

  @test:scripts/ig-qa-messages.test.ts::ig-qa-messages::carryNeverOverwritesTheNewAstsOwnQaAndWritesNothingWithNothingToCarry
  Scenario: the carry never replaces QA the new AST has, and invents none
    Given a base AST with no Publisher QA, or a new AST that holds its own
    When the carry runs
    Then nothing is written, and the new AST's own qa.json is kept
