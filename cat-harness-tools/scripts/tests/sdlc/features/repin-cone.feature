# scripts/repin-cone.ts plans which sites must re-pin when a harness moves: the cone of
# dependent sites in waves, the mounted-directory filter, possible adaptations and the report,
# all behind a stubbed GitHub API. Each Scenario names the test that executes it.
Feature: Re-pin cone planning

  @test:scripts/tests/sdlc/repin-cone.test.ts::planCone::the_cone_of_a_harness,_in_waves
  Scenario: The cone of a harness is planned in waves
    Given a fleet where mid takes the harness h, top takes h and mid, other takes only x, and bare has no lock
    When the cone of "o/h" is planned
    Then the sites are "o/mid" in wave 1 and "o/top" in wave 2
    And top's move of "o/h" does not wait, while its move of "o/mid" waits on the earlier wave
    And "o/bare" is listed as having no lock

  @test:scripts/tests/sdlc/repin-cone.test.ts::planCone::a_site_outside_the_cone_is_left_out;_--all_keeps_every_site
  Scenario: A site outside the cone is left out, and with no harness every site is kept
    Given the same fleet
    When the cone of "o/x" is planned
    Then the only site is "o/other"
    And when no harness is named the sites are "o/mid", "o/other" and "o/top"

  @test:scripts/tests/sdlc/repin-cone.test.ts::planCone::a_cycle_is_refused
  Scenario: A cycle between sites is refused
    Given two sites that each mount the other
    When the cone is planned
    Then planning throws an error mentioning "cycle"

  @test:scripts/tests/sdlc/repin-cone.test.ts::filters::mounted_prefixes:_declared_directories,_or_the_whole_tree
  Scenario: Mounted prefixes are the declared directories, or the whole tree
    Given top's lock, which declares only the "content" directory of "o/mid"
    When the mounted prefixes are read for "o/mid" and for "o/h"
    Then "o/mid" gives "content"
    And "o/h", with no declared directories, gives the empty prefix for the whole tree

  @test:scripts/tests/sdlc/repin-cone.test.ts::filters::possible_adaptations_by_path_or_file_name
  Scenario: Possible adaptations match by exact path, else by a unique file name
    Given the upstream file "content/anc/contact.md"
    When candidates include that exact path, it alone is matched
    And when only "input/contact.md" shares its file name, that file is matched
    And when two files share its file name, nothing is matched
    And "lib/x/README.md" against a root "README.md" matches nothing

  @test:scripts/tests/sdlc/repin-cone.test.ts::impactOf_and_the_report::only_mounted_changes_reach_the_site;_adaptations_are_matched
  Scenario: Only mounted changes reach a site, and adaptations are matched
    Given a stubbed API where mid changed "content/a.md" and "src/x.ts" and top holds "local/a.md"
    When the impact of the "o/h" cone is computed and reported
    Then top's move of "o/mid" reaches only "content/a.md", with 1 change outside the mount
    And "content/a.md" is matched to the possible adaptation "local/a.md"
    And mid is ready while top is not
    And the report contains "wave 1 → wave 2" and "Possible adaptations"
