# scripts/harness-tiles.ts: harnessTiles builds one tile per initiated harness, ordered by the declared
# dependency stack, linked only to published viewers, with stats, avatar and findings derived from declarations.
# Each Scenario names the test that executes it.
Feature: Harness tiles are ordered by declaration and linked by presence

  @test:scripts/tests/kg/harness-tiles.test.ts::the_ORDER_is_the_declared_dependency_stack,_bottom_to_top::the_spine_reads_foundation-last,_which_is_the_owner's_sentence
  Scenario: The spine reads top layer first and foundation last
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers and needs nothing
    And "mid" needs "host" and "top" needs "mid"
    When the tiles are built
    Then the tile order is "top", "mid", "host"

  @test:scripts/tests/kg/harness-tiles.test.ts::the_ORDER_is_the_declared_dependency_stack,_bottom_to_top::it_is_the_DECLARATION,_not_alphabetical_luck
  Scenario: The order follows the declaration, not the alphabet
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers and needs "a"
    And "a" needs nothing
    When the tiles are built
    Then the tile order is "host", "a"

  @test:scripts/tests/kg/harness-tiles.test.ts::the_ORDER_is_the_declared_dependency_stack,_bottom_to_top::an_instance_that_declares_NO_needs_sits_BELOW_the_spine's_head,_and_says_so
  Scenario: An instance declaring no needs sits below the spine's head and says so
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers and needs nothing
    And "top" needs "host" and "loose" declares no needs at all
    When the tiles are built
    Then the tile order is "top", "loose", "host"
    And the "loose" tile has a finding containing "alphabetical rather than derived"

  @test:scripts/tests/kg/harness-tiles.test.ts::the_ORDER_is_the_declared_dependency_stack,_bottom_to_top::the_declared_FLOOR_is_last_even_when_its_layer_was_never_declared
  Scenario: The declared floor is last even with no needs declared
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers and needs nothing
    And "boot" declares no needs but a render exemption of "visualiser"
    When the tiles are built
    Then the last tile is "boot"
    And it is marked as the footer

  @test:scripts/tests/kg/harness-tiles.test.ts::the_ORDER_is_the_declared_dependency_stack,_bottom_to_top::the_two_rules_AGREE_on_the_real_repository_—_the_floor_is_also_the_deepest_layer
  Scenario: The floor rule and the dependency order agree
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers and needs "boot"
    And "boot" needs nothing and declares a render exemption of "visualiser"
    When the tiles are built
    Then the tile order is "host", "boot"

  @test:scripts/tests/kg/harness-tiles.test.ts::the_ORDER_is_the_declared_dependency_stack,_bottom_to_top::a_CYCLE_is_reported_and_falls_back_to_alphabetical_—_it_does_not_blank_the_navbar
  Scenario: A dependency cycle is reported and falls back to alphabetical order
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers and needs "b"
    And "b" needs "host"
    When the tiles are built
    Then the tile order is "b", "host"
    And some tile has a finding containing "cycle"

  @test:scripts/tests/kg/harness-tiles.test.ts::the_ORDER_is_the_declared_dependency_stack,_bottom_to_top::a_dependency_naming_no_instance_is_reported,_never_silently_dropped
  Scenario: A dependency naming no instance is reported
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers and needs "ghost", which is not an instance
    When the tiles are built
    Then the first tile has a finding containing 'needs "ghost"'

  @test:scripts/tests/kg/harness-tiles.test.ts::a_link_is_DECLARATION-driven_and_PRESENCE-checked::a_declared_graph_with_a_published_page_becomes_a_link
  Scenario: A declared graph with a published page becomes a link
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And "who" needs "host" and declares a "library" directory
    And a page is published at "host/library/who"
    When the tiles are built
    Then the "who" tile has exactly one visualisation: kind "library", label "Library", path "/host/library/who/"

  @test:scripts/tests/kg/harness-tiles.test.ts::a_link_is_DECLARATION-driven_and_PRESENCE-checked::a_declared_graph_with_NO_page_is_not_linked,_and_is_reported
  Scenario: A declared graph with no page is not linked and is reported
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And "who" needs "host" and declares a "library" directory
    And no page is published
    When the tiles are built
    Then the "who" tile has one visualisation: kind "library", label "Library", note "no viewer yet", and no path
    And it has a finding containing "no published viewer"

  @test:scripts/tests/kg/harness-tiles.test.ts::a_link_is_DECLARATION-driven_and_PRESENCE-checked::a_page_published_under_a_kind_the_instance_does_NOT_declare_is_reported,_not_linked
  Scenario: A page under a kind the instance does not declare is reported, not linked
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And "who" needs "host" and declares no directories
    And a page is published at "host/library/who"
    When the tiles are built
    Then the "who" tile has no visualisations
    And it has a finding containing "covers none of this instance's directories"

  @test:scripts/tests/kg/harness-tiles.test.ts::a_link_is_DECLARATION-driven_and_PRESENCE-checked::the_site_owner's_own_state_graph_is_at_its_DECLARED_route_—_the_short_URL_is_only_an_alias
  Scenario: The site owner's state graph links its declared route, not the short alias
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And a page is published at "host/beans"
    When the tiles are built
    Then the host tile links kind "beans", label "Plans and work", path "/host/beans/"
    And with a page published only at the bare "beans" the host tile has note "no viewer yet" and no path

  @test:scripts/tests/kg/harness-tiles.test.ts::a_link_is_DECLARATION-driven_and_PRESENCE-checked::there_is_no_elided_namespace_to_squat:_a_sibling's_graph_opens_the_visualiser_DECLARED_over_it
  Scenario: A sibling's graph opens the visualiser declared over its kind
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And "who" declares a "beans" directory
    And pages are published at "host/beans" and at the bare "beans"
    When the tiles are built
    Then the "who" tile links kind "beans", label "Plans and work", path "/host/beans/"

  @test:scripts/tests/kg/harness-tiles.test.ts::the_stats_are_DERIVED,_so_they_cannot_disagree_with_the_tile::views_counts_only_what_is_actually_linked
  Scenario: The views stat counts only what is linked
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And "who" declares a "library" directory and a "schemas" directory
    And only "host/library/who" is published
    When the tiles are built
    Then the "who" stats are directories 2, kinds 2, views 1
    And the number of linked visualisations equals the views stat

  @test:scripts/tests/kg/harness-tiles.test.ts::the_stats_are_DERIVED,_so_they_cannot_disagree_with_the_tile::every_stat_carries_a_label,_because_a_badge_with_no_name_is_an_unnamed_control
  Scenario: Every stat carries a label
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    When the tiles are built
    Then every stat on the host tile has a non-empty label

  @test:scripts/tests/kg/harness-tiles.test.ts::the_stats_are_DERIVED,_so_they_cannot_disagree_with_the_tile::two_directories_holding_the_same_graph_count_as_one_KIND
  Scenario: Two directories holding the same graph count as one kind
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers whose two directories "a/" and "b/" both hold "beans"
    When the tiles are built
    Then the host stats are directories 2, kinds 1, views 0

  @test:scripts/tests/kg/harness-tiles.test.ts::an_instance_with_no_avatar_says_so_rather_than_rendering_blank::a_name_with_no_declared_avatar_takes_the_generic_one_and_is_reported
  Scenario: A name with no declared avatar takes the generic one and is reported
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And "who" needs "host", declares no directories and no avatar
    When the tiles are built
    Then the "who" tile uses the generic avatar
    And it has a finding containing "no avatar declared"

  @test:scripts/tests/kg/harness-tiles.test.ts::an_instance_with_no_avatar_says_so_rather_than_rendering_blank::a_name_that_IS_a_declared_kind_takes_its_own_hue
  Scenario: A name that is a declared kind takes its own hue
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And an instance "cat-harness" with no directories
    When the tiles are built
    Then the "cat-harness" tile does not use the generic avatar
    And its tone is greater than 0

  @test:scripts/tests/kg/harness-tiles.test.ts::the_published_paths_are_the_OTHER_generators'_rules,_read_rather_than_restated::a_subject_page_is_handler/kind/subject_—_never_subject_first
  Scenario: A subject page is handler, kind, subject under the page locale
    When subjectPage composes handler "cat-harness", kind "library" and subject "who-iris"
    Then the path is "/<page locale>/cat-harness/library/who-iris/"

  @test:scripts/tests/kg/harness-tiles.test.ts::the_published_paths_are_the_OTHER_generators'_rules,_read_rather_than_restated::an_alias_is_the_bare_segment,_and_only_that
  Scenario: An alias is the bare segment
    When ownStatePage composes the alias "beans"
    Then the path is "/beans/"

  @test:scripts/tests/kg/harness-tiles.test.ts::a_repository_with_nothing_to_show::no_site-owning_declaration_yields_no_tiles_rather_than_throwing
  Scenario: No site-owning declaration yields no tiles
    Given an empty temporary repository
    When the tiles are built with no instance names
    Then there are no tiles and nothing throws

  @test:scripts/tests/kg/harness-tiles.test.ts::a_repository_with_nothing_to_show::an_instance_directory_with_no_harness.json_is_skipped,_not_guessed_at
  Scenario: An instance directory with no harness.json is skipped
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And a directory "not-an-instance" with no declaration
    When the tiles are built for "host" and "not-an-instance"
    Then there is exactly one tile

  @test:scripts/tests/kg/harness-tiles.test.ts::the_tile_opens_the_INSTANCE,_not_a_kind_handler's_view_of_it::an_instance_with_its_own_docs/_links_to_its_themed_root
  Scenario: An instance with its own site links to its themed root
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And "who" needs "host" and declares a "schemas" directory
    And a page is published at "host/schemas/who"
    And "who" has its own site directory
    When the tiles are built
    Then the "who" tile links "/who/" with href kind "folio"

  @test:scripts/tests/kg/harness-tiles.test.ts::the_tile_opens_the_INSTANCE,_not_a_kind_handler's_view_of_it::an_instance_WITHOUT_its_own_docs/_falls_back_to_a_viewer,_and_says_so
  Scenario: An instance without its own site falls back to a viewer and says so
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And "who" needs "host" and declares a "schemas" directory
    And a page is published at "host/schemas/who"
    When the tiles are built
    Then the "who" tile has href kind "viewer"
    And it has a finding containing "rather than the instance's own themed root"

  @test:scripts/tests/kg/harness-tiles.test.ts::the_tile_opens_the_INSTANCE,_not_a_kind_handler's_view_of_it::an_instance_with_neither_is_NOT_a_link
  Scenario: An instance with neither a site nor a viewer is not a link
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And "who" needs "host" and declares no directories
    When the tiles are built
    Then the "who" tile has no href and no href kind

  @test:scripts/tests/kg/harness-tiles.test.ts::the_tile_opens_the_INSTANCE,_not_a_kind_handler's_view_of_it::the_folio_view_WINS_over_a_viewer_that_also_exists
  Scenario: The folio view wins over a viewer that also exists
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And "who" needs "host" and declares a "schemas" directory
    And a page is published at "host/schemas/who"
    And "who" has its own site directory
    When the tiles are built
    Then the "who" tile links "/who/"
    And its only linked visualisation is "/host/schemas/who/"

  @test:scripts/tests/kg/harness-tiles.test.ts::an_icon_is_PUBLISHED,_never_declared_—_owner:_"broken_image_on_LHS_navbar"::the_site_directory's_prefix_is_STRIPPED,_because_the_mount_does_not_carry_it
  Scenario: An icon's site directory prefix is stripped
    Given a temporary repository whose "host" declares an icon image under its own site directory at "assets/img/mark.svg"
    When the tiles are built
    Then the host icon src is "/assets/img/mark.svg"
    And it does not contain the site directory prefix

  @test:scripts/tests/kg/harness-tiles.test.ts::an_icon_is_PUBLISHED,_never_declared_—_owner:_"broken_image_on_LHS_navbar"::an_instance_mounted_beneath_the_site_root_carries_its_SITE_DIR's_mount
  Scenario: An instance mounted beneath the site root carries its site directory's mount
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And "sibling" declares an icon under its own site directory and a "docs" directory at that site directory
    And "sibling" has its own site directory
    When the tiles are built
    Then the "sibling" icon src is "/docs/sibling/assets/img/mark.svg"

  @test:scripts/tests/kg/harness-tiles.test.ts::an_icon_is_PUBLISHED,_never_declared_—_owner:_"broken_image_on_LHS_navbar"::no_mount_means_NO_icon_and_a_finding_—_`pb04`_one_layer_down
  Scenario: No mount means no icon and a finding
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And "sibling" declares an icon under a site directory it does not have
    When the tiles are built
    Then the "sibling" icon is null
    And it has a finding containing "Showing no mark rather than a broken image"

  @test:scripts/tests/kg/harness-tiles.test.ts::an_icon_is_PUBLISHED,_never_declared_—_owner:_"broken_image_on_LHS_navbar"::a_path_outside_the_site_directory_is_refused_rather_than_rewritten
  Scenario: An icon path outside the site directory is refused
    Given a temporary repository whose "host" declares an icon image at "elsewhere/mark.svg"
    When the tiles are built
    Then the host icon is null
    And it has a finding naming "elsewhere/mark.svg"

  @test:scripts/tests/kg/harness-tiles.test.ts::a_LABEL_identifies_its_subject,_or_it_is_not_a_label::two_instances_with_one_title_are_told_apart,_and_both_say_so
  Scenario: Two instances with one title are told apart and both say so
    Given a temporary repository with "host" and "other" both titled "Shared"
    When the tiles are built
    Then all labels are distinct
    And the labels include "Shared (host)" and "Shared (other)"
    And every tile has a finding containing "is also another instance's"

  @test:scripts/tests/kg/harness-tiles.test.ts::a_LABEL_identifies_its_subject,_or_it_is_not_a_label::a_unique_title_is_left_exactly_as_its_author_wrote_it
  Scenario: A unique title is left as written
    Given a temporary repository whose "host" is titled "Only one"
    When the tiles are built
    Then the host label is "Only one"

  @test:scripts/tests/kg/harness-tiles.test.ts::a_LABEL_identifies_its_subject,_or_it_is_not_a_label::`name_(name)`_is_never_emitted_—_it_says_nothing_twice
  Scenario: A label never repeats the name in parentheses
    Given a temporary repository with "host" and "other" both titled "host"
    When the tiles are built
    Then the labels include "host" and "host (other)"
    And they do not include "host (host)"

  @test:scripts/tests/kg/harness-tiles.test.ts::a_render-exempt_instance_links_to_one_of_its_own_files,_as_published::with_`reachableAt`,_the_tab_is_a_link_and_says_what_KIND_of_target_it_is
  Scenario: A render-exempt instance with reachableAt links its published file
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And "floor" declares a "skills" directory and a render exemption of "visualiser" with reachableAt "README.md"
    And the file "floor/README.md" exists
    When the tiles are built
    Then the "floor" tile links "/floor/README.html" with href kind "handled"
    And it has a finding containing "renders nothing of its own"

  @test:scripts/tests/kg/harness-tiles.test.ts::a_render-exempt_instance_links_to_one_of_its_own_files,_as_published::WITHOUT_`reachableAt`_it_stays_unlinked_—_absent_is_a_real_state
  Scenario: A render-exempt instance without reachableAt stays unlinked
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And "floor" declares a "skills" directory and a render exemption of "visualiser" with no reachableAt
    When the tiles are built
    Then the "floor" tile has no href and no href kind

  @test:scripts/tests/kg/harness-tiles.test.ts::a_render-exempt_instance_links_to_one_of_its_own_files,_as_published::a_`reachableAt`_that_names_no_file_is_a_FINDING,_and_still_unlinked
  Scenario: A reachableAt that names no file is a finding and stays unlinked
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And "floor" declares a "skills" directory and a render exemption of "visualiser" with reachableAt "missing.md", which does not exist
    When the tiles are built
    Then the "floor" tile has no href
    And it has a finding containing "not a file"

  @test:scripts/tests/kg/harness-tiles.test.ts::a_render-exempt_instance_links_to_one_of_its_own_files,_as_published::a_`reachableAt`_outside_the_instance_is_a_FINDING,_and_still_unlinked
  Scenario: A reachableAt outside the instance is a finding and stays unlinked
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And "floor" declares a "skills" directory and a render exemption of "visualiser" with reachableAt "../host/NOTES.md"
    And the file "host/NOTES.md" exists
    When the tiles are built
    Then the "floor" tile has no href
    And it has a finding containing "outside the instance"

  @test:scripts/tests/kg/harness-tiles.test.ts::a_render-exempt_instance_links_to_one_of_its_own_files,_as_published::an_instance_with_its_OWN_site_ignores_`reachableAt`_—_it_is_the_last_resort
  Scenario: An instance with its own site ignores reachableAt
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And "floor" declares a "skills" directory and a render exemption of "visualiser" with reachableAt "README.md"
    And the file "floor/README.md" exists
    And "floor" has its own site directory
    When the tiles are built
    Then the "floor" tile has href kind "folio"

  @test:scripts/tests/kg/harness-tiles.test.ts::a_DECLARED_visualiser_is_a_viewer_—_the_other_half_of_`flh4`::a_resolving,_published_visualiser_links_its_kind_at_the_path_it_names
  Scenario: A resolving, published visualiser links its kind at the path it names
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And a page is published under the host site at "translation-status"
    And "who" needs "host" and is redeclared with a "library" directory whose coverage.visualiser names that page
    When the tiles are built
    Then the "who" tile links kind "library", label "Library", path "/translation-status/"
    And no finding contains "no published viewer"

  @test:scripts/tests/kg/harness-tiles.test.ts::a_DECLARED_visualiser_is_a_viewer_—_the_other_half_of_`flh4`::a_visualiser_that_does_NOT_resolve_links_nothing,_and_the_gap_is_still_reported
  Scenario: A visualiser that does not resolve links nothing and the gap is reported
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And "who" needs "host" and is redeclared with a "library" directory whose coverage.visualiser names "nowhere/index.html" under the host site, which does not exist
    When the tiles are built
    Then the "who" tile has kind "library", label "Library", note "no viewer yet", and no path
    And its findings contain "does not resolve on disk"
    And its findings contain "no published viewer"

  @test:scripts/tests/kg/harness-tiles.test.ts::a_DECLARED_visualiser_is_a_viewer_—_the_other_half_of_`flh4`::the_checkout_ROOT's_own_site_directory_is_served_at_the_site_root,_as_its_icon_is_(issue_#46,_gap_3)
  Scenario: The checkout root's own site directory is served at the site root
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And the checkout root is an instance "folio" with a "schemas" directory whose visualiser is "schemas/index.html" under its own site directory
    And that page exists
    When the tiles are built
    Then the "folio" tile links kind "schemas" at "/schemas/"

  @test:scripts/tests/kg/harness-tiles.test.ts::a_DECLARED_visualiser_is_a_viewer_—_the_other_half_of_`flh4`::a_folio_whose_whole_site_is_GENERATED_links_a_writer-built_viewer_at_its_ref_(smart-ra,_2026-10-14)
  Scenario: A folio whose site is generated links a writer-built viewer at its ref
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And the checkout root is an instance "folio" with no site directory on disk
    And a "models" directory holding "schemas" whose visualiser is ref "en/folio/models/index.html" written by "tools/gen.ts"
    And "tools/gen.ts" exists
    When the tiles are built
    Then the site directory does not exist
    And the "folio" tile links kind "schemas" at "/en/folio/models/"

  @test:scripts/tests/kg/harness-tiles.test.ts::a_DECLARED_visualiser_is_a_viewer_—_the_other_half_of_`flh4`::a_data-only_site_directory_(the_build's_own_docs/_data)_does_not_make_the_site_authored
  Scenario: A data-only site directory does not make the site authored
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And the checkout root is an instance "folio" whose site directory holds only "_data/stickies.json"
    And a "models" directory holding "schemas" whose visualiser is ref "en/folio/models/index.html" written by "tools/gen.ts"
    And "tools/gen.ts" exists
    When the tiles are built
    Then the "folio" tile links kind "schemas" at "/en/folio/models/"

  @test:scripts/tests/kg/harness-tiles.test.ts::a_DECLARED_visualiser_is_a_viewer_—_the_other_half_of_`flh4`::...but_not_when_the_folio_HAS_an_authored_site_on_disk
  Scenario: A folio with an authored site on disk does not link a writer-built ref
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And the checkout root is an instance "folio" whose site directory holds a "_config.yml"
    And a "models" directory holding "schemas" whose visualiser is ref "en/folio/models/index.html" written by "tools/gen.ts"
    And "tools/gen.ts" exists
    When the tiles are built
    Then the "folio" tile has no path for kind "schemas"

  @test:scripts/tests/kg/harness-tiles.test.ts::a_DECLARED_visualiser_is_a_viewer_—_the_other_half_of_`flh4`::a_page_that_resolves_OUTSIDE_the_site_directory_is_NOT_linked_—_and_is_named_as_built
  Scenario: A page outside the site directory is not linked and is named as built
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And a page exists at "who/elsewhere/index.html"
    And "who" needs "host" and is redeclared with a "library" directory whose coverage.visualiser names that page
    When the tiles are built
    Then the "who" tile has kind "library", label "Library", note "viewer not published", and no path
    And its findings contain "exists but is not at a conventional path"
    And its findings do not contain "no published viewer"

  @test:scripts/tests/kg/harness-tiles.test.ts::a_DECLARED_visualiser_is_a_viewer_—_the_other_half_of_`flh4`::the_CONVENTIONAL_page_wins_when_a_kind_resolves_both_ways
  Scenario: The conventional page wins when a kind resolves both ways
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And a page is published at "host/library/who"
    And a page is published under the host site at "somewhere-else"
    And "who" needs "host" and is redeclared with a "library" directory whose coverage.visualiser names the "somewhere-else" page
    When the tiles are built
    Then the "who" tile links kind "library" at "/host/library/who/" only

  @test:scripts/tests/kg/harness-tiles.test.ts::a_DECLARED_visualiser_is_a_viewer_—_the_other_half_of_`flh4`::one_directory's_viewer_does_not_vouch_for_a_kind_it_does_not_hold
  Scenario: One directory's viewer does not vouch for a kind it does not hold
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And a page is published under the host site at "lib-view"
    And "who" is redeclared with a "library" directory whose visualiser names that page and an "uploads" directory with none
    When the tiles are built
    Then the "who" tile links "library" at "/lib-view/"
    And it lists "uploads" with label "Uploads" and note "no viewer yet"
    And its findings contain "no published viewer — uploads"

  @test:scripts/tests/kg/harness-tiles.test.ts::a_render-exempt_instance_is_not_missing_what_it_was_excused_from::its_unrendered_kinds_are_named_as_EXEMPT,_not_as_a_gap
  Scenario: A render-exempt instance's unrendered kinds are named as exempt, not a gap
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And "floor" declares a "skills" directory and a render exemption of "visualiser" owing "its own graph as .jsonld"
    When the tiles are built
    Then the "floor" findings contain "render no viewer" and "under a declared `renderExemption`"
    And they do not contain "no published viewer"

  @test:scripts/tests/kg/harness-tiles.test.ts::a_render-exempt_instance_is_not_missing_what_it_was_excused_from::the_kinds_are_still_NAMED,_and_so_is_what_the_layer_owes
  Scenario: The exempt finding names the kinds and what the layer owes
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And "floor" declares a "skills" directory and a render exemption of "visualiser" owing "its own graph as .jsonld"
    When the tiles are built
    Then the "floor" finding about "render no viewer" names "skills"
    And it names "its own graph as .jsonld"

  @test:scripts/tests/kg/harness-tiles.test.ts::a_render-exempt_instance_is_not_missing_what_it_was_excused_from::an_instance_exempt_from_something_ELSE_still_gets_the_gap_finding
  Scenario: An instance exempt from something else still gets the gap finding
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And "floor" declares a "skills" directory and a render exemption only of "own-docs"
    When the tiles are built
    Then the "floor" findings contain "no published viewer"

  @test:scripts/tests/kg/harness-tiles.test.ts::a_render-exempt_instance_is_not_missing_what_it_was_excused_from::an_instance_with_NO_exemption_is_unaffected
  Scenario: An instance with no exemption still gets the gap finding
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And "who" needs "host" and declares a "library" directory with no page published
    When the tiles are built
    Then the "who" findings contain "no published viewer"

  @test:scripts/tests/kg/harness-tiles.test.ts::a_render-exempt_instance_is_not_missing_what_it_was_excused_from::a_directory_declaring_`coverage.exempt.visualiser`_renders_`no_viewer_by_design`_and_a_`Not_a_gap`_finding_(bean_folio-assistant-6gme)
  Scenario: A directory exempt from a visualiser reads no viewer by design and is not a gap
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And "sci" needs "host" and declares a "lean" directory with coverage.exempt.visualiser "This directory holds a Lean TEMPLATE, not a Lake package."
    And a "library" directory with no exemption and no page
    When the tiles are built
    Then the "sci" tile lists "lean" as "Lean packages" with note "no viewer by design"
    And it lists "library" as "Library" with note "no viewer yet"
    And the finding about "render no viewer" names "lean", "coverage.exempt.visualiser", "Not a gap" and the exemption reason
    And the finding about "no published viewer" names "library" and not "lean"

  @test:scripts/tests/kg/harness-tiles.test.ts::an_icon's_URL_is_the_SITE_DIRECTORY's_mount,_not_the_instance's_front_door::a_mounted_instance_addresses_its_icon_under_its_site_dir's_KIND
  Scenario: A mounted instance addresses its icon under its site directory's kind
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers and needs nothing
    And "guest" declares an icon at "assets/m.svg" under its site directory and classifies that site directory as "docs"
    And "guest" has its own site directory
    When the tiles are built
    Then the "guest" icon src is "/docs/guest/assets/m.svg"

  @test:scripts/tests/kg/harness-tiles.test.ts::an_icon's_URL_is_the_SITE_DIRECTORY's_mount,_not_the_instance's_front_door::...and_the_kind_is_the_DECLARATION's,_not_the_string_`docs`
  Scenario: The icon's mount kind is the declaration's, not the string docs
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers and needs nothing
    And "guest" declares an icon at "assets/m.svg" under its site directory and classifies that site directory as "library"
    And "guest" has its own site directory
    When the tiles are built
    Then the "guest" icon src is "/library/guest/assets/m.svg"

  @test:scripts/tests/kg/harness-tiles.test.ts::an_icon's_URL_is_the_SITE_DIRECTORY's_mount,_not_the_instance's_front_door::the_site_OWNER_keeps_the_root_—_its_docs_are_built_in_place,_not_mounted
  Scenario: The site owner's icon keeps the root
    Given a temporary repository whose site owner "host" declares an icon at "assets/m.svg" under its site directory, classified as "docs"
    When the tiles are built
    Then the host icon src is "/assets/m.svg"

  @test:scripts/tests/kg/harness-tiles.test.ts::an_icon's_URL_is_the_SITE_DIRECTORY's_mount,_not_the_instance's_front_door::an_instance_that_classifies_its_site_dir_under_NO_kind_gets_no_icon
  Scenario: An instance whose site directory is classified under no kind gets no icon
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers and needs nothing
    And "guest" declares an icon under its site directory but classifies only "beans/"
    And "guest" has its own site directory
    When the tiles are built
    Then the "guest" icon is null

  @test:scripts/tests/kg/harness-tiles.test.ts::inertNote_—_why_a_row_does_not_open::a_STAGING-ONLY_viewer_is_withheld_on_purpose,_and_is_not_called_a_gap
  Scenario: A staging-only viewer is labelled staging only, exempt or not
    When inertNote describes "staging-only" without an exemption
    Then the note is "staging only"
    And with an exemption the note is still "staging only"

  @test:scripts/tests/kg/harness-tiles.test.ts::inertNote_—_why_a_row_does_not_open::a_viewer_that_EXISTS_but_is_not_published_says_so_—_it_is_a_different_gap
  Scenario: A viewer that exists but is not published says so
    When inertNote describes "undiscovered" without an exemption
    Then the note is "viewer not published"
    And with an exemption the note is still "viewer not published"

  @test:scripts/tests/kg/harness-tiles.test.ts::inertNote_—_why_a_row_does_not_open::UNBUILT_is_the_only_bucket_the_render_exemption_narrows
  Scenario: Only the unbuilt note is narrowed by the render exemption
    When inertNote describes "unbuilt"
    Then without an exemption the note is "no viewer yet"
    And with an exemption the note is "no viewer by design"

  @test:scripts/tests/kg/harness-tiles.test.ts::inertNote_—_why_a_row_does_not_open::every_answer_is_distinct_—_four_states_must_not_collapse_to_one_wording
  Scenario: Every inert note is distinct
    When inertNote describes staging-only, undiscovered, unbuilt, and unbuilt under an exemption
    Then the four notes are all different

  @test:scripts/tests/kg/harness-tiles.test.ts::an_instance's_OWN_theme_tones_its_tile_(bean_v8n5)::an_instance_citing_a_PLATFORM_theme_keeps_its_avatar_tone
  Scenario: An instance citing a platform theme keeps its avatar tone
    Given the tiles built over the real checkout for "who-iris", "cat-harness" and "bootstrap" with cat-harness as host
    When the "cat-harness" and "bootstrap" tiles are read
    Then each has its tone from "avatar"

  @test:scripts/tests/kg/harness-tiles.test.ts::one_name_per_destination_(bean_`ob3m`_finding_6)::each_row_carries_its_kind's_display_name;_two_kinds_on_two_pages_are_not_merged
  Scenario: Two kinds in one directory share one page and are not given two names
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And "who" needs "host" and declares one directory holding "schemas" and "cat-harness"
    And a page is published at "host/schemas/who"
    When the tiles are built
    Then the "who" rows are "cat-harness" labelled "Schemas" and the same as "schemas"
    And "schemas" labelled "Schemas" with no sameAs

  @test:scripts/tests/kg/harness-tiles.test.ts::one_name_per_destination_(bean_`ob3m`_finding_6)::an_INSTANTIATED_harness_with_no_folio_opens_its_landing_section,_not_a_graph's_viewer
  Scenario: An instantiated harness with no folio opens its landing section
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers plus a "processes" visualiser
    And "who" needs "host" and declares a "processes" directory
    And a page is published at "host/processes/who"
    And "who.config.json" exists at the repository root
    When the tiles are built
    Then the "who" tile is instantiated
    And it links "/#harness-who" with href kind "section"
    And its only visualisation is "processes" labelled "Processes" at "/host/processes/who/"

  @test:scripts/tests/kg/harness-tiles.test.ts::subgraphsOf_—_every_declared_graph,_marked_local_or_remote_(603s)::lists_the_declared_directories_as_LOCAL,_in_declared_order,_with_their_paths
  Scenario: subgraphsOf lists declared directories as local, in declared order
    Given directories "library" at "who/library/" and "docs" at "who/docs/"
    When subgraphsOf lists them for a declaration with nothing remote
    Then the rows are "library" local then "docs" local
    And the first row has path "who/library/" and kinds "library"

  @test:scripts/tests/kg/harness-tiles.test.ts::subgraphsOf_—_every_declared_graph,_marked_local_or_remote_(603s)::lists_remote_graphs_and_subscriptions_as_REMOTE,_after_the_local_ones
  Scenario: subgraphsOf lists remote graphs and subscriptions as remote, after the local ones
    Given directories "library" and "docs"
    And a remote graph "upstream" at "https://example.org/kg"
    And a subscription "smart" to "WorldHealthOrganization/smart-base" at a full sha with subgraph "library"
    When subgraphsOf lists them
    Then the rows are local, local, remote, remote
    And the third row is "upstream" via "remote-graph" with its url
    And the fourth row is "smart" via "subscription", ref "0123456", materialised "library", and a GitHub tree url at the sha

  @test:scripts/tests/kg/harness-tiles.test.ts::subgraphsOf_—_every_declared_graph,_marked_local_or_remote_(603s)::an_instance_with_nothing_remote_has_zero_remote_rows,_not_an_absent_list
  Scenario: An instance with nothing remote has zero remote rows
    Given directories "library" and "docs" and empty remote graphs and subscriptions
    When subgraphsOf lists them
    Then no row is remote

  @test:scripts/tests/kg/harness-tiles.test.ts::every_harness's_navbar_MARK_is_resolved_once_—_bean_`2vpn`::an_instance_with_its_own_registry_glyph_and_no_image_carries_the_GLYPH_as_its_mark
  Scenario: An instance with its own registry glyph and no image carries the glyph as its mark
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And "smart-base" declares an avatar with glyph "M0 0h1v1z" and no image
    When the tiles are built
    Then the "smart-base" mark glyph starts with "M"
    And the mark has no src

  @test:scripts/tests/kg/harness-tiles.test.ts::every_harness's_navbar_MARK_is_resolved_once_—_bean_`2vpn`::the_generic_fallback_is_a_blank_mark_when_an_instance_has_none_declared
  Scenario: The fallback mark is blank when an instance declares none
    Given a temporary repository whose site owner "host" declares library, schemas and beans visualisers
    And "who" needs "host" and declares no avatar
    When the tiles are built
    Then the "who" mark is glyph "M3 3h18v18H3z", titled "a blank mark — no avatar declared; rendered in theme colour", and blank
