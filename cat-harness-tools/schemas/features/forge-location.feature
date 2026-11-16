# forgeLocation in schemas/kg/cat-harness.ts: a path under a remote mount links to the
# mounted repository, read from the mount lock, not to this checkout's forge.
# Each Scenario names the test that executes it.
Feature: forgeLocation over a remote mount

  @test:schemas/forge-location.test.ts::forgeLocation_over_a_remote_mount::a_mounted_path_names_the_mounted_repository,_relative_to_its_root
  Scenario: A mounted path links to the mounted repository relative to its root
    Given a mount lock mounting repository "o/leaf" at "leaf"
    When the forge location of "leaf/leaf.json" is asked with host "https://github.com/o/host"
    Then it is repository "https://github.com/o/leaf" at path "leaf.json"

  @test:schemas/forge-location.test.ts::forgeLocation_over_a_remote_mount::a_path_that_only_shares_a_prefix_stays_this_checkout's
  Scenario: A path that only shares the mount's prefix stays in this checkout
    Given a mount lock mounting repository "o/leaf" at "leaf"
    When the forge location of "leafy/x.md" is asked with host "https://github.com/o/host"
    Then it is repository "https://github.com/o/host" at path "leafy/x.md"
