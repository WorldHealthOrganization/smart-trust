# Mount path and visualiser route collisions (bean folio-assistant-t4xb). Each
# Scenario names the test that executes it.
Feature: Mount path and visualiser route collisions

  @test:scripts/tests/mount-collisions.test.ts::RESERVED_ROOT_AND_ROUTE_NAMES::declares_the_one_authoritative_list_of_reserved_root_and_route_names
  Scenario: One list of reserved root and route names is declared
    Then the reserved names are exactly skills, tools, docs, assets, glossary, api, payload, STAGING, branches, beans, todos, fsh-guts, uploads, test, build, _site, _docs and _kg, in that order

  @test:scripts/tests/mount-collisions.test.ts::RESERVED_ROOT_AND_ROUTE_NAMES::identifies_reserved_names_case-insensitively_and_with_trailing_slashes
  Scenario: Reserved names are matched case-insensitively and by first segment
    Then docs, DOCS/, staging, STAGING, tools/sub, beans and _site are reserved
    And who-iris, smart-base and custom-harness are not

  @test:scripts/tests/mount-collisions.test.ts::Mount_path_collision_checks_(bean_folio-assistant-t4xb)::effectiveMountPathOf_defaults_to_harness_name_when_path_override_is_absent
  Scenario: The effective mount path defaults to the harness name
    Then a mount with no path is at its harness name
    And a mount's path, or an override's path, wins with the trailing slash dropped

  @test:scripts/tests/mount-collisions.test.ts::Mount_path_collision_checks_(bean_folio-assistant-t4xb)::rejects_a_mount_whose_effective_path_collides_with_a_downstream_declared_directory
  Scenario: A mount colliding with a declared directory is rejected
    When a mount named library is checked against a declared library directory
    Then there is one declared-directory finding naming library and telling to set path

  @test:scripts/tests/mount-collisions.test.ts::Mount_path_collision_checks_(bean_folio-assistant-t4xb)::rejects_a_mount_whose_effective_path_overlaps_with_a_downstream_declared_directory_tree
  Scenario: A mount overlapping a declared directory tree is rejected
    When a mount inside a declared directory and a mount containing one are checked
    Then there are two declared-directory findings, each telling to set path

  @test:scripts/tests/mount-collisions.test.ts::Mount_path_collision_checks_(bean_folio-assistant-t4xb)::rejects_a_mount_whose_effective_path_collides_with_a_reserved_root_or_site_route_name
  Scenario: A mount colliding with a reserved name is rejected
    When mounts at skills, docs, STAGING and api are checked
    Then there are four reserved-name findings, each telling to set path

  @test:scripts/tests/mount-collisions.test.ts::Mount_path_collision_checks_(bean_folio-assistant-t4xb)::rejects_sibling_mounts_that_collide_on_the_same_effective_path
  Scenario: Sibling mounts on one path are rejected
    When two mounts with the same path are checked
    Then each harness has a sibling-mount finding, every finding telling to set path

  @test:scripts/tests/mount-collisions.test.ts::Mount_path_collision_checks_(bean_folio-assistant-t4xb)::passes_with_0_findings_on_valid_distinct_non-reserved_non-colliding_paths
  Scenario: Distinct, non-reserved, non-colliding paths pass
    When four distinct mounts are checked against the declared directories
    Then there are no findings

  @test:scripts/tests/mount-collisions.test.ts::Mount_path_collision_checks_(bean_folio-assistant-t4xb)::setting_`path`_resolves_an_otherwise_colliding_mount
  Scenario: Setting path resolves a collision
    Given mounts named docs and library collide twice
    When each is given its own path
    Then there are no findings

  @test:scripts/tests/mount-collisions.test.ts::Visualiser_route_rules_(bean_folio-assistant-t4xb)::canonical_route_format_is_<base>/<harness>/<visualizer>/
  Scenario: The canonical route is <base>/<harness>/<visualizer>/
    Then the route of a visualiser is its harness and name, under the base when one is given

  @test:scripts/tests/mount-collisions.test.ts::Visualiser_route_rules_(bean_folio-assistant-t4xb)::visualizerAliasRoute_returns_alias_only_when_opt-in_is_declared
  Scenario: An alias route exists only when declared
    Then no alias, or false, gives none; true gives the visualiser's name; a string gives that string

  @test:scripts/tests/mount-collisions.test.ts::Visualiser_route_rules_(bean_folio-assistant-t4xb)::visualizerUrl_uses_canonical_form_unless_an_alias_is_declared
  Scenario: The visualiser URL is canonical unless an alias is declared
    Then with no alias the URL is canonical, under the base when given
    And with an alias declared the URL is the alias, under the base when given

  @test:scripts/tests/mount-collisions.test.ts::Visualiser_route_rules_(bean_folio-assistant-t4xb)::refuses_an_alias_that_collides_with_another_visualiser's_alias,_naming_both_claimants
  Scenario: Two visualisers claiming one alias are refused, naming both
    When two visualisers both alias "summary"
    Then there is one alias-collision finding on summary naming both claimants

  @test:scripts/tests/mount-collisions.test.ts::Visualiser_route_rules_(bean_folio-assistant-t4xb)::refuses_an_alias_that_collides_with_a_harness_route,_naming_both_claimants
  Scenario: An alias colliding with a harness route is refused, naming both
    When a visualiser aliases who-iris, a harness name
    Then there is one harness-route finding naming the visualiser and harness:who-iris

  @test:scripts/tests/mount-collisions.test.ts::Visualiser_route_rules_(bean_folio-assistant-t4xb)::refuses_an_alias_that_collides_with_a_reserved_site_route,_naming_both_claimants
  Scenario: An alias colliding with a reserved site route is refused, naming both
    When visualisers alias tools and docs
    Then there are two reserved-route findings, each naming the visualiser and the reserved route

  @test:scripts/tests/mount-collisions.test.ts::Visualiser_route_rules_(bean_folio-assistant-t4xb)::distinct_non-colliding_aliases_pass_with_0_findings
  Scenario: Distinct aliases pass
    When visualisers with distinct aliases and one with none are checked against their harness names
    Then there are no findings

  @test:scripts/tests/mount-collisions.test.ts::checkAllCollisions_integration::runs_cleanly_on_current_repository_root
  Scenario: The current repository has no collisions
    When every collision is checked from the working directory
    Then there are no mount collisions and no route collisions
