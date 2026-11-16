Feature: The IG AST lock, which pins an AST like a layer

  @test:schemas/ig-ast-lock.test.ts::ig-ast-lock/v1_(bean_fwtz:_the_AST_is_pinned_like_a_layer)::noLockNoPinsInvalidLockThrows
  Scenario: no lock is no pins; a lock that does not validate is an error, not no pins
    Given a directory with no lock file
    And a directory whose lock has a pin with a truncated sha
    Then reading the pins of the first gives none
    And reading the pins of the second throws

  @test:schemas/ig-ast-lock.test.ts::ig-ast-lock/v1_(bean_fwtz:_the_AST_is_pinned_like_a_layer)::pinMustNameMountedSameRepo
  Scenario: a pin must name an instance the lock mounts, from the same repository
    Given three directories with the same pin, whose index lock mounts the instance from the same repository, from a fork, or not at all
    When the AST lock of each is checked
    Then the first has no problems
    And the second's first problem says it is "mounted from fork/ig"
    And the third's first problem says it is "not mounted"

  @test:schemas/ig-ast-lock.test.ts::ig-ast-lock/v1_(bean_fwtz:_the_AST_is_pinned_like_a_layer)::repinReplacesAndSorts
  Scenario: a re-pin replaces the instance's pin and keeps the lock sorted
    Given a lock with pins for "ig" and "alpha"
    When "ig" is re-pinned to a new sha
    Then the pins are "alpha" then "ig", with "ig" at the new sha
