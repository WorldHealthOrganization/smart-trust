# scripts/check-declaration-resolution.ts checks that every path a declaration names resolves
# in the checkout being checked, naming the gate that owns each field (kg-separation lesson 6).
# Each Scenario names the test that executes it.
Feature: Every path a declaration names resolves

  @test:scripts/tests/kg/declaration-resolution.test.ts::coverageFindings_—_coversKinds,_the_one_reference_no_composed_gate_resolves::an_unregistered_kind_is_a_finding;_a_registered_one_is_not
  Scenario: An unregistered covered kind is a finding and a registered one is not
    Given a visualiser of instance "demo" covering the kinds "docs" and "not-a-kind"
    And only "docs" is a registered kind
    When the coverage findings are computed
    Then there is exactly one finding, whose detail names "not-a-kind"
    And its field is "visualisers"

  @test:scripts/tests/kg/declaration-resolution.test.ts::checkDeclarationResolution_over_a_checkout::each_field_is_resolved_by_the_gate_that_owns_it,_and_named
  Scenario: Each unresolved field is found by the gate that owns it, and named
    Given a git checkout with "demo.json" needing "no-such-layer"
    And declaring the directories "present/" (which exists) and "gone/" (which does not)
    And an asset "README.md" that does not exist
    And a visualiser rendered by "no-such-tool" covering the kind "not-a-kind"
    When the declaration resolution check runs over the checkout
    Then the directories finding is by "check:declared-dirs" and its subject names "gone"
    And the assets finding is by "check:declared-assets"
    And the visualisers finding is by "check:declaration-resolution"
    And the needs finding is by "check:instance-graph"
    And it examined 1 declaration, 2 directories, 1 asset, 1 visualiser, 1 need, 0 enabled sub-graphs and 0 opt-in links
    And the exit code is 1

  @test:scripts/tests/kg/declaration-resolution.test.ts::checkDeclarationResolution_over_a_checkout::a_link_from_an_always-on_page_into_an_opt-in_sub-graph_is_a_finding_of_check:optin-links
  Scenario: A link from an always-on page into an opt-in sub-graph is a finding of check:optin-links
    Given a git checkout whose "demo.json" declares an always-on directory "present/" and an opt-in directory "extra/"
    And "present/page.md" links to "../extra/g.md" and "extra/g.md" links back
    When the declaration resolution check runs over the checkout
    Then the only opt-in link finding is for instance "demo", subject "present/page.md", by "check:optin-links", with detail naming "demo.extra"
    And 2 opt-in links were examined
    And the exit code is 1

  @test:scripts/tests/kg/declaration-resolution.test.ts::checkDeclarationResolution_over_a_checkout::a_clean_declaration_with_nothing_undetermined_exits_0
  Scenario: A clean declaration with nothing undetermined exits 0
    Given a git checkout whose "demo.json" declares only the existing directory "present/"
    When the declaration resolution check runs over the checkout
    Then there are no findings
    And the exit code is 0

  @test:scripts/tests/kg/declaration-resolution.test.ts::checkDeclarationResolution_over_a_checkout::an_empty_checkout_is_could-not-determine,_never_a_pass
  Scenario: An empty checkout is could-not-determine, never a pass
    Given a git checkout holding only "notes.txt" and no declaration
    When the declaration resolution check runs over the checkout
    Then the exit code is 2

  @test:scripts/tests/kg/declaration-resolution.test.ts::lesson_6_—_kinds_come_from_the_checkout_under_inspection::a_kind_only_a_layer_IN_the_checkout_contributes_is_known_when_run_there_with_--root
  Scenario: A kind contributed by a layer in the checkout is known when run there with --root
    Given a git checkout where "contributor" declares a typologies directory holding the kind "l6-contributed"
    And "consumer" needs "contributor" and declares a directory of graph typology "l6-contributed"
    When the check script runs with "--root" at that checkout and "--json", with REPO_ROOT empty
    Then there are no findings on the declaration field
    And the instances are "consumer" and "contributor"
