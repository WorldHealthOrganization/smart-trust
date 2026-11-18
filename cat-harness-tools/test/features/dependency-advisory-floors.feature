# bun.lock must resolve past the advisories of bean d3vq: undici at 6.29.1 or later and
# zod at 4.6.6 or later. Each Scenario names the test that executes it.
Feature: Dependency advisory floors

  @test:test/dependency-advisory-floors.test.ts::dependency_advisory_floors_(bean_d3vq)::every_resolved_%s_is_>=_%s
  Scenario: Every resolved version of a package is at or above its advisory floor
    Given the committed bun.lock
    And the rows undici at 6.29.1 and zod at 4.6.6
    When the resolved versions of the package are read from the lockfile
    Then at least one version is found
    And none orders below the floor
