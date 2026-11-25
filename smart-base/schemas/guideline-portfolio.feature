Feature: The guideline-portfolio kind
  The umbrella graph of SMART Guidelines is a portfolio whose levels are the
  SMART levels L1 to L4, in order.

  @test:smart-base/schemas/guideline-portfolio.test.ts::guideline-portfolio::extendsPortfolioAndAcceptsSmartLevelsInOrder
  Scenario: a portfolio with SMART levels in order parses
    Given the guideline-portfolio kind
    Then it is composed portfolio, then guideline-portfolio
    And a portfolio with levels L1, L2, L3 parses
    And a portfolio with levels L1, L3 parses

  @test:smart-base/schemas/guideline-portfolio.test.ts::guideline-portfolio::refusesUnknownOrOutOfOrderLevels
  Scenario: an unknown or out-of-order level is refused
    Given a portfolio with levels L1, L5
    Then it does not parse
    Given a portfolio with levels L2, L1
    Then it does not parse
