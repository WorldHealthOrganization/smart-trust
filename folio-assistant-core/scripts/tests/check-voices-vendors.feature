Feature: checking vendor voices

  @test:scripts/tests/check-voices-vendors.test.ts::vendorVoiceFindings::vendorWithoutExtends
  Scenario: fires on a vendor voice with no extends
    When a vendor voice declares no extends
    Then one finding says so

  @test:scripts/tests/check-voices-vendors.test.ts::vendorVoiceFindings::baseNoInstanceShips
  Scenario: fires on a base no layer ships
    When a vendor voice extends a base nobody serves
    Then one finding says no layer serves it

  @test:scripts/tests/check-voices-vendors.test.ts::vendorVoiceFindings::extendsCycle
  Scenario: fires on a cycle
    When two voices extend each other
    Then one finding names the cycle

  @test:scripts/tests/check-voices-vendors.test.ts::vendorVoiceFindings::resolvedBaseClean
  Scenario: clean when the base resolves
    When a vendor voice extends a base that resolves
    Then there are no findings
