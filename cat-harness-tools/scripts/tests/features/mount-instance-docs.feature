# The mount-point resolution rule (owner, 2026-09-20): walk the path to the
# first handler that wants it and stop; which kind answers at an instance's
# own route; withheld files; embedded assets; redirects; served directories;
# and the URL space. Each Scenario names the test that executes it.
Feature: Mounting instance directories on the site

  @test:scripts/tests/mount-instance-docs.test.ts::the_walk_stops_at_the_first_handler_that_wants_the_path::mounts_non-overlapping_routes,_all_of_them
  Scenario: Non-overlapping routes are all mounted
    When docs/who-iris and library/who-iris are resolved
    Then both are mounted and none refused

  @test:scripts/tests/mount-instance-docs.test.ts::the_walk_stops_at_the_first_handler_that_wants_the_path::OUTERMOST_wins:_a_handler_at_`docs`_owns_`docs/who-iris`
  Scenario: The outermost handler wins
    When docs/who-iris and docs are resolved
    Then only docs is mounted and docs/who-iris is refused as owned by docs

  @test:scripts/tests/mount-instance-docs.test.ts::the_walk_stops_at_the_first_handler_that_wants_the_path::refuses_regardless_of_the_order_the_claims_arrive_in
  Scenario: The result does not depend on the order the claims arrive in
    When docs and docs/who-iris are resolved in either order
    Then the mounted and refused routes are the same

  @test:scripts/tests/mount-instance-docs.test.ts::the_walk_stops_at_the_first_handler_that_wants_the_path::an_exact_duplicate_is_a_collision_too,_not_a_harmless_re-mount
  Scenario: An exact duplicate is a collision
    When docs/who-iris is claimed twice
    Then one is mounted and the other refused as owned by docs/who-iris

  @test:scripts/tests/mount-instance-docs.test.ts::the_walk_stops_at_the_first_handler_that_wants_the_path::a_shared_PREFIX_that_is_not_a_path_segment_is_not_a_collision
  Scenario: A shared prefix that is not a path segment is not a collision
    When docs/who-iris and docs/who-iris-extra are resolved
    Then both are mounted and none refused

  @test:scripts/tests/mount-instance-docs.test.ts::the_walk_stops_at_the_first_handler_that_wants_the_path::owns_the_whole_subtree,_not_just_the_next_segment_down
  Scenario: A handler owns its whole subtree
    When library and library/who-iris/items/x are resolved
    Then only library is mounted and the deep claim is refused as owned by library

  @test:scripts/tests/mount-instance-docs.test.ts::the_walk_stops_at_the_first_handler_that_wants_the_path::a_refused_claim_is_carried_out_with_its_owner_named,_never_dropped
  Scenario: A refused claim carries its owner
    When docs, docs/a and docs/b are resolved
    Then two claims are refused, each owned by docs

  @test:scripts/tests/mount-instance-docs.test.ts::the_walk_stops_at_the_first_handler_that_wants_the_path::returns_every_claim_exactly_once,_across_the_two_lists
  Scenario: Every claim comes back exactly once across the two lists
    When five claims are resolved
    Then the mounted and refused lists hold five distinct routes
    And docs, library and uploads/y are mounted while docs/a and library/x are refused

  @test:scripts/tests/mount-instance-docs.test.ts::both_handlers_register:_the_kind's,_and_the_instance's_own::an_instance_root_and_its_kind_route_are_DISTINCT,_so_neither_refuses_the_other
  Scenario: An instance root and its kind route are distinct
    When docs/who-iris and who-iris are resolved
    Then both are mounted and none refused

  @test:scripts/tests/mount-instance-docs.test.ts::both_handlers_register:_the_kind's,_and_the_instance's_own::but_an_instance_root_DOES_own_its_own_subtree
  Scenario: An instance root owns its own subtree
    When who-iris and who-iris/extra are resolved
    Then only who-iris is mounted and the other is refused as owned by it

  @test:scripts/tests/mount-instance-docs.test.ts::both_handlers_register:_the_kind's,_and_the_instance's_own::an_instance_root_does_NOT_own_a_same-prefixed_sibling_instance
  Scenario: An instance root does not own a same-prefixed sibling instance
    When who-iris and who-iris-extra are resolved
    Then both are mounted and none refused

  @test:scripts/tests/mount-instance-docs.test.ts::which_kind_answers_at_the_instance's_own_route::ONE_renderable_kind_needs_no_choosing
  Scenario: One renderable kind needs no choosing
    When routes are assigned to an instance with one docs directory
    Then it answers at docs/who-iris and who-iris, with nothing undetermined

  @test:scripts/tests/mount-instance-docs.test.ts::which_kind_answers_at_the_instance's_own_route::the_DECLARED_kind_takes_the_root,_not_the_one_that_sorts_first
  Scenario: The declared kind takes the instance root
    Given an instance with a docs directory and a library directory declared as root
    When routes are assigned
    Then the instance route is served by library, with nothing undetermined

  @test:scripts/tests/mount-instance-docs.test.ts::which_kind_answers_at_the_instance's_own_route::every_kind_still_gets_its_own_route,_declared_root_or_not
  Scenario: Every kind still gets its own route
    When routes are assigned to the docs and declared-root library directories
    Then the routes are docs/who-iris, library/who-iris and who-iris

  @test:scripts/tests/mount-instance-docs.test.ts::which_kind_answers_at_the_instance's_own_route::the_root_is_emitted_ONCE,_however_many_kinds_are_declared
  Scenario: The instance root is emitted once
    When routes are assigned to three kinds, one declared root
    Then exactly one candidate is at who-iris

  @test:scripts/tests/mount-instance-docs.test.ts::which_kind_answers_at_the_instance's_own_route::several_kinds_and_NONE_declared_is_UNDETERMINED,_and_still_serves_something
  Scenario: Several kinds and none declared is undetermined but still served
    When routes are assigned to docs and library with no root declared
    Then the instance is undetermined among docs and library, serving docs, and one candidate is at its route

  @test:scripts/tests/mount-instance-docs.test.ts::which_kind_answers_at_the_instance's_own_route::a_declared_root_YIELDS_its_kind_route_to_a_same-kind_sibling_—_bean_2b5s
  Scenario: A declared root yields its kind route to a same-kind sibling
    Given a site directory declared root and a docs directory, both of kind docs
    When routes are assigned
    Then docs/inst is the docs directory and inst is the site directory
    And resolving them refuses nothing, with nothing undetermined

  @test:scripts/tests/mount-instance-docs.test.ts::which_kind_answers_at_the_instance's_own_route::same-kind_siblings_with_no_root_each_get_their_OWN_kind_route_—_cat-harness-tools#681
  Scenario: Same-kind siblings with no root each get their own kind route
    Given three code directories of one instance and no root
    When routes are assigned
    Then the instance route and code/cht/<directory> for each are the candidates, and resolving refuses nothing

  @test:scripts/tests/mount-instance-docs.test.ts::which_kind_answers_at_the_instance's_own_route::a_lone_directory_of_a_kind_keeps_the_plain_kind_route
  Scenario: A lone directory of a kind keeps the plain kind route
    When routes are assigned to a code directory and a declared-root docs directory
    Then the routes are cht, code/cht and docs/cht

  @test:scripts/tests/mount-instance-docs.test.ts::which_kind_answers_at_the_instance's_own_route::with_NO_same-kind_sibling_the_root_still_publishes_at_both_routes
  Scenario: With no same-kind sibling the root publishes at both routes
    When routes are assigned to a lone declared-root docs directory
    Then the routes are docs/lone and lone

  @test:scripts/tests/mount-instance-docs.test.ts::which_kind_answers_at_the_instance's_own_route::a_root_already_TAKEN_by_an_IG_site_is_not_inherited_by_the_next_kind
  Scenario: A root taken by an IG site is not inherited by the next kind
    When routes are assigned to openapi and library directories of an instance whose root is an IG site
    Then only the kind routes are candidates, with nothing undetermined

  @test:scripts/tests/mount-instance-docs.test.ts::which_kind_answers_at_the_instance's_own_route::a_declared_igSite_root_keeps_/<instance>/_off_the_mount_table_—_read_from_a_declaration
  Scenario: A declared igSite root keeps /<instance>/ off the mount table
    Given an instance whose docs directory is a declared igSite root, and an openapi directory
    Then the IG site roots are that instance, and only openapi is mountable
    And without the IG site roots the openapi directory would take the instance route
    And with them it answers only at openapi/st

  @test:scripts/tests/mount-instance-docs.test.ts::which_kind_answers_at_the_instance's_own_route::an_instance_declared_at_the_REPOSITORY_ROOT_is_mounted_too_—_a_separated_instance's_own_site
  Scenario: An instance declared at the repository root is mounted
    Given a declaration at the checkout root with a declared-root site directory and a docs directory
    Then both directories are mountable and answer at docs/wi and wi

  @test:scripts/tests/mount-instance-docs.test.ts::which_kind_answers_at_the_instance's_own_route::mountedKindRoutes_answers_the_kind_route_the_navbar's_Docs_row_opens,_and_not_the_instance_root
  Scenario: mountedKindRoutes answers the kind route the Docs row opens
    Given an instance with a root site, one docs directory, and two directories of one other kind
    Then its mounted kind routes are exactly docs at /docs/wi/
    And an instance not in the repository has none

  @test:scripts/tests/mount-instance-docs.test.ts::which_kind_answers_at_the_instance's_own_route::a_directory_of_a_kind_a_build_Tool_publishes_(web-app)_is_never_mounted,_though_it_holds_an_index.html
  Scenario: A web-app directory is never mounted
    Given an instance with a web-app directory and a docs directory, each holding index.html
    Then only the docs directory is mountable

  @test:scripts/tests/mount-instance-docs.test.ts::which_kind_answers_at_the_instance's_own_route::one_instance_being_undetermined_does_not_implicate_another
  Scenario: One undetermined instance does not implicate another
    When routes are assigned to x with two kinds and no root, and y with two kinds and a root
    Then only x is undetermined

  @test:scripts/tests/mount-instance-docs.test.ts::a_mounted_directory's_withheld.json_is_honoured_—_bean_cw35::absent_→_nothing_withheld
  Scenario: No withheld.json means nothing withheld
    Then the withheld paths of a tree with no withheld.json are none

  @test:scripts/tests/mount-instance-docs.test.ts::a_mounted_directory's_withheld.json_is_honoured_—_bean_cw35::copies_everything_EXCEPT_the_listed_paths,_and_a_directory_takes_its_whole_subtree
  Scenario: Everything except the withheld paths is copied
    Given a withheld.json listing a directory and a file
    When the tree is copied through the withheld filter
    Then the directory's whole subtree and the file are absent
    And a sibling whose name merely starts with the withheld file, the kept files and the index are present

  @test:scripts/tests/mount-instance-docs.test.ts::a_mounted_directory's_withheld.json_is_honoured_—_bean_cw35::a_withheld.json_it_cannot_read_REFUSES_to_mount_—_never_'publish_everything'
  Scenario: An unreadable withheld.json refuses to mount
    Then a withheld.json that is not JSON throws refusing to publish
    And one whose paths do not match the schema throws refusing to publish

  @test:scripts/tests/mount-instance-docs.test.ts::a_page's_embedded_assets_are_published,_and_nothing_else_from_their_directory_—_bean_2b5s::finds_the_embedded_files_outside_the_mount,_and_only_those
  Scenario: Only embedded files outside the mount are found
    Given pages embedding a library cover, a local image, a remote image, a data URI and a root-absolute script, and linking another cover
    When the referenced assets are found
    Then there are no problems and the assets are the two library covers embedded by the two pages

  @test:scripts/tests/mount-instance-docs.test.ts::a_page's_embedded_assets_are_published,_and_nothing_else_from_their_directory_—_bean_2b5s::publishes_beneath_the_route_at_the_instance-relative_path,_and_rewrites_the_ref_to_match
  Scenario: An asset publishes beneath the route and its ref is rewritten to match
    Given a top-level page and a nested page embedding one library cover
    Then each publishes the cover at inst/library/a-cover.png
    And the top page's ref becomes library/a-cover.png and the nested page's ../library/a-cover.png

  @test:scripts/tests/mount-instance-docs.test.ts::a_page's_embedded_assets_are_published,_and_nothing_else_from_their_directory_—_bean_2b5s::refuses,_naming_it,_a_ref_that_leaves_the_instance,_resolves_to_nothing,_or_is_withheld
  Scenario: A ref that leaves the instance, resolves to nothing or is withheld is refused, named
    Given a page embedding a file outside the instance, a missing file and a withheld cover
    When the referenced assets are found
    Then there are no assets and the three refs are problems, the withheld one naming library/withheld.json

  @test:scripts/tests/mount-instance-docs.test.ts::a_kind_route_whose_directory_is_not_mounted_is_a_one-file_redirect_—_bean_2b5s::refreshes,_declares_canonical,_and_links_visibly,_all_to_the_viewer_re-based_from_the_route
  Scenario: An unmounted kind route is a one-file redirect
    When the redirect for library/inst to handler/library/inst/ is written
    Then it refreshes to, declares canonical, and visibly links the viewer re-based from the route, and is noindex

  @test:scripts/tests/mount-instance-docs.test.ts::a_served_directory's_bytes_publish_at_/<instance>/<path>_—_bean_680p::is_opt-in:_only_a_directory_declaring_`served:_true`_is_served
  Scenario: Serving is opt-in
    Then directories not declaring served true are not served

  @test:scripts/tests/mount-instance-docs.test.ts::a_served_directory's_bytes_publish_at_/<instance>/<path>_—_bean_680p::routes_under_the_instance,_with_no_leading_or_trailing_slash
  Scenario: A served directory routes under its instance
    Then a served fhir-artifact-index directory routes at smart-trust/fhir-artifact-index

  @test:scripts/tests/mount-instance-docs.test.ts::a_served_directory's_bytes_publish_at_/<instance>/<path>_—_bean_680p::a_MOUNTED_layer's_twin_under_the_layer_output_root_is_served_over_the_pinned_bytes_—_bean_cat-tools-sm8r_item_4
  Scenario: A mounted layer's computed twin is served over the pinned bytes
    Given a mounted layer's served directory and no twin under the layer output root
    Then it is served with no computed directory
    And once the twin exists it is served with the twin as its computed directory

  @test:scripts/tests/mount-instance-docs.test.ts::the_URL_space:_several_instances,_each_under_its_own_name_—_bean_cat-tools-sthf::an_instance_route_is_publishedPath's_instance_case,_with_the_slashes_trimmed
  Scenario: An instance route is publishedPath's instance case, slashes trimmed
    Then the route of alpha, and of beta's artifact-index, match the published path with its slashes trimmed

  @test:scripts/tests/mount-instance-docs.test.ts::the_URL_space:_several_instances,_each_under_its_own_name_—_bean_cat-tools-sthf::lays_out_every_enabled_instance_under_its_NAME,_never_its_stub,_and_leaves_the_disabled_one_out
  Scenario: Every enabled instance is laid out under its name
    Given alpha, beta with a stub and a served directory, and gamma disabled
    Then the mountable instances are alpha and beta
    And the routes are alpha, beta, docs/alpha, fhir-artifact-index/beta and library/beta
    And the served routes are beta/artifact-index

  @test:scripts/tests/mount-instance-docs.test.ts::a_served_directory_is_refused_over_a_FILE_the_site_holds,_not_over_its_route::names_only_the_files_both_sides_hold,_skipping_withheld_ones
  Scenario: A served directory clashes only over files both sides hold
    Given a served source and a site destination holding only an index
    Then there are no clashes
    And once the destination holds the source's sub/op.json and secret.json, with secret.json withheld, the clash is sub/op.json
    And a destination that does not exist has no clashes
