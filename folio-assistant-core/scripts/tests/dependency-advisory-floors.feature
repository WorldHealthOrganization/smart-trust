Feature: every resolved dependency is at or above its advisory floor

  @test:scripts/tests/dependency-advisory-floors.test.ts::dependency_advisory_floors_(bean_folio-core-0b88)::resolvedAtOrAboveFloor[${name}]
  Scenario Outline: every resolved <name> is >= <floor>
    Given the dependency <name> with advisory floor <floor>
    When its resolved versions are read from the lockfile
    Then at least one is resolved
    And none is below the floor

    Examples:
      | name | floor |
      | undici | 6.29.1 |
      | minimatch | 11.0.1 |
      | zod | 4.6.6 |
