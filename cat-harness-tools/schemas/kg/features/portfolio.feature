# Specifies schemas/kg/portfolio.ts: the portfolio kind, an umbrella graph that
# links other graphs' libraries level by level without copying them (owner,
# 2026-11-10: smart-html-jtd as the umbrella KG of SMART Guidelines).
Feature: A portfolio links libraries into levels, and a subclass can pin the levels

  @test:schemas/kg/portfolio.test.ts::portfolio::accepts_levels_whose_libraries_use_each_of_the_three_sources
  Scenario: Levels whose libraries use each of the three sources are accepted
    Given a portfolio with an L1 library catalogue, an L2 discovered library and an L3 listed library
    When it is parsed
    Then it is accepted under the tag portfolio/1.0.0

  @test:schemas/kg/portfolio.test.ts::portfolio::refuses_a_level_or_a_library_declared_twice
  Scenario: A level or a library declared twice is refused
    Given a portfolio that declares level L1 twice, or library who-iris twice
    When it is parsed
    Then it fails naming the repeated id

  @test:schemas/kg/portfolio.test.ts::portfolio::refuses_an_unknown_key_and_a_source_that_is_none_of_the_three
  Scenario: An unknown key and an unknown source are refused
    Given a portfolio with an extra top-level key, or a library whose source is none of library, discover or repos
    When it is parsed
    Then it fails

  @test:schemas/kg/portfolio.test.ts::portfolio::a_subclass_can_pin_what_its_levels_mean
  Scenario: A subclass pins what its levels mean
    Given a kind extending portfolio that allows only levels L1 to L4
    When a portfolio with level L9 is parsed against it
    Then it fails, and one with L1 to L3 passes
