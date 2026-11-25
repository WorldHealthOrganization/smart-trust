# pipeline/qa-utils.ts `scriptSidecarTarget` picks where a sweep writes script sidecars: the
# platform's own git checkout, never a mounted copy, unless a root is given explicitly.
# Each Scenario names the test that executes it.
Feature: Where script sidecars are written

  @test:pipeline/script-sidecar-target.test.ts::scriptSidecarTarget::the_platform's_own_checkout_is_written_to
  Scenario: The platform's own checkout is the sidecar target
    Given a platform directory that contains a ".git" directory
    When the sidecar target is resolved with no explicit root
    Then the target is that checkout directory

  @test:pipeline/script-sidecar-target.test.ts::scriptSidecarTarget::a_mounted_copy_(no_.git)_is_not
  Scenario: A mounted copy without .git is not written to
    Given a platform directory with no ".git" directory
    When the sidecar target is resolved with no explicit root
    Then there is no target

  @test:pipeline/script-sidecar-target.test.ts::scriptSidecarTarget::an_explicit_--script-sidecar-root_always_wins
  Scenario: An explicit --script-sidecar-root always wins
    Given a mounted platform directory with no ".git" directory
    When the sidecar target is resolved with the explicit root "/elsewhere"
    Then the target is "/elsewhere"
