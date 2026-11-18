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
