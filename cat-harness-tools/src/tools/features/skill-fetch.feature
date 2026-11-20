# src/tools/skill-fetch.ts discovers skill packages from the layers' declared kg directories, a
# dependency's included, names each, locates a skill that moved, and pins reference packages to a commit.
# Each Scenario names the test that executes it.
Feature: Skill packages are discovered from declarations

  @test:src/tools/skill-fetch.test.ts::the_live_table::every_package_resolves_to_a_directory_that_exists
  Scenario: Every package in the live table resolves to a directory that exists
    Given the live table of local packages
    Then it holds at least one package
    And every package's directory exists

  @test:src/tools/skill-fetch.test.ts::the_live_table::the_co-located_skill_is_DISCOVERED,_not_hand-written
  Scenario: The co-located skill is discovered, not hand-written
    Given the packages discovered from this repository
    Then there is a package "kg-core"
    And its directory is under "skills/kg/kg-core"
    And it holds "corpus-grep.md"

  @test:src/tools/skill-fetch.test.ts::the_live_table::the_name_`cat-harness`_denotes_exactly_one_directory
  Scenario: The name "cat-harness" denotes no discovered package
    Given the packages discovered from this repository
    Then there is no package named "cat-harness"

  @test:src/tools/skill-fetch.test.ts::the_live_table::a_directly-held_kg_directory_is_named_after_its_INSTANCE
  Scenario: A directly-held kg directory is named after its instance
    Given the packages discovered from this repository
    Then the package "bootstrap" is the directory "bootstrap/skills"

  @test:src/tools/skill-fetch.test.ts::what_discovery_includes,_and_what_it_refuses::a_directory_holding_a_skill_is_a_package
  Scenario: A directory holding a skill is a package
    Given a layer whose declared kg directory "skills" holds "alpha" with a skill body
    When its packages are discovered
    Then the only package is "alpha"

  @test:src/tools/skill-fetch.test.ts::what_discovery_includes,_and_what_it_refuses::a_directory_whose_.md_declares_`$schema`_is_NOT_a_package
  Scenario: A directory whose Markdown declares a $schema is not a package
    Given a layer whose declared kg directory holds "memory" with a Markdown file declaring "$schema: agent-memory/v1"
    When its packages are discovered
    Then there is no package

  @test:src/tools/skill-fetch.test.ts::what_discovery_includes,_and_what_it_refuses::a_directory_with_no_markdown_at_all_is_NOT_a_package
  Scenario: A directory with no Markdown at all is not a package
    Given a layer whose declared kg directory holds "remote-packages" with only a JSON file
    When its packages are discovered
    Then there is no package

  @test:src/tools/skill-fetch.test.ts::what_discovery_includes,_and_what_it_refuses::a_kg_directory_NOT_at_skills/_still_yields_its_packages
  Scenario: A kg directory not at skills/ still yields its packages
    Given a layer whose declared kg directory is "kg" and holds "alpha" with a skill body
    When its packages are discovered
    Then the only package is "alpha"

  @test:src/tools/skill-fetch.test.ts::a_dependency's_packages_are_served_—_the_overlay::a_dependency_contributes,_and_the_root_overrides_by_name
  Scenario: A dependency contributes packages, and the root overrides by name
    Given a dependency layer holding the packages "shared" and "dep-only"
    And a root layer holding "shared", configured with that dependency
    When the root's packages are discovered
    Then the packages are "dep-only" and "shared"
    And "shared" is the root's directory
    And "dep-only" is the dependency's directory

  @test:src/tools/skill-fetch.test.ts::a_directly-held_set_is_named_by_ITS_instance,_not_by_the_caller's_root::two_directly-held_directories_do_not_collapse_onto_one_name
  Scenario: Two directly-held directories from two instances do not collapse onto one name
    Given a sibling layer "sibling" declaring its own "skills" directory with a skill
    And a layer "inst" declaring its own "kg" directory and the sibling's "skills" at repository scope
    When the packages of "inst" are discovered
    Then the packages are "inst" and "sibling"
    And "sibling" is the sibling's "skills" directory
    And "inst" is the layer's "kg" directory

  @test:src/tools/skill-fetch.test.ts::a_directly-held_set_is_named_by_ITS_instance,_not_by_the_caller's_root::FOUR_directly-held_directories_in_one_instance,_and_none_is_dropped
  Scenario: Four directly-held directories in one instance are all kept
    Given a layer "inst" declaring the directories "src/skills", "theming", "a" and "b", each holding a skill
    When its packages are discovered
    Then the packages are "a", "b", "inst" and "theming"
    And "inst" is the "src/skills" directory
    And "theming" is the "theming" directory

  @test:src/tools/skill-fetch.test.ts::a_directly-held_set_is_named_by_ITS_instance,_not_by_the_caller's_root::the_rule_is_UNIQUENESS,_not_order_—_reversing_the_declaration_changes_nothing
  Scenario: The naming rule is uniqueness, not order: reversing the declaration changes nothing
    Given a layer "inst" declaring "b", "a", "theming" and "src/skills" in that order, each holding a skill
    When its packages are discovered
    Then the packages are "a", "b", "inst" and "theming"
    And "inst" is the "src/skills" directory

  @test:src/tools/skill-fetch.test.ts::a_directly-held_set_is_named_by_ITS_instance,_not_by_the_caller's_root::a_SOLE_directly-held_directory_still_takes_the_instance_name,_whatever_it_is_called
  Scenario: A sole directly-held directory takes the instance name, whatever it is called
    Given a layer "inst" declaring only the directory "kg", holding a skill
    When its packages are discovered
    Then the only package is "inst"

  @test:src/tools/skill-fetch.test.ts::a_directly-held_set_is_named_by_ITS_instance,_not_by_the_caller's_root::the_live_table_names_a_directly-held_set_after_its_declaring_instance
  Scenario: The live table names a directly-held set after its declaring instance, dropping nothing
    Given the packages discovered from this repository
    Then the package "bootstrap" is the directory "bootstrap/skills"
    And no package points at "bootstrap/tools"
    And no two packages share a directory

  @test:src/tools/skill-fetch.test.ts::locateLocalSkill_—_a_skill_asked_for_in_a_package_that_no_longer_holds_it_(bean_9umr)::the_named_package_wins_when_it_holds_the_skill
  Scenario: The named package is used when it holds the skill
    # Gap: no other package holds "stays", so preference over a second holder is not exercised
    Given packages "core" holding "stays", "kg" holding "moved" and "twice", and "lib" holding "twice"
    When "stays" is located in "core"
    Then it is found in "core"

  @test:src/tools/skill-fetch.test.ts::locateLocalSkill_—_a_skill_asked_for_in_a_package_that_no_longer_holds_it_(bean_9umr)::a_moved_skill_is_found_in_the_one_package_that_holds_it
  Scenario: A moved skill is found in the one package that holds it
    Given packages "core" holding "stays", "kg" holding "moved" and "twice", and "lib" holding "twice"
    When "moved" is located in "core"
    Then it is found in "kg"

  @test:src/tools/skill-fetch.test.ts::locateLocalSkill_—_a_skill_asked_for_in_a_package_that_no_longer_holds_it_(bean_9umr)::two_holders_is_an_error_naming_both,_never_a_pick
  Scenario: Two holders is an error naming both, never a pick
    Given packages "core" holding "stays", "kg" holding "moved" and "twice", and "lib" holding "twice"
    When "twice" is located in "core"
    Then the result is an error naming "kg, lib"

  @test:src/tools/skill-fetch.test.ts::locateLocalSkill_—_a_skill_asked_for_in_a_package_that_no_longer_holds_it_(bean_9umr)::a_skill_nobody_holds_is_still_unknown
  Scenario: A skill nobody holds is still unknown
    Given packages "core", "kg" and "lib", none holding "nowhere"
    When "nowhere" is located in "core"
    Then the result is an error

  @test:src/tools/skill-fetch.test.ts::REFERENCE_PACKAGES_—_pinned_to_a_commit,_never_a_branch_(bean_c4lg_/_0mpw)::every_reference_package_pins_ref_to_a_40-hex_commit_SHA
  Scenario: Every reference package pins its ref to a 40-hex commit SHA
    Given the table of reference packages
    Then it holds at least one package
    And every package's ref is a 40-character lowercase hex commit SHA
