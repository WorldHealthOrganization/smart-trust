# A layer declaration's publication state, version and id (schemas/kg/cat-harness.ts), the gates that check them
# (scripts/check-publishable.ts, scripts/check-version-bump.ts), dependsOn records (schemas/kg/depends-on.ts)
# and the surface-diff version bump (schemas/kg/version-bump.ts). Each Scenario names the test that executes it.
Feature: Instance publication, versions and dependencies

  @test:schemas/instance-versioning.test.ts::publication_is_a_STATE,_and_`published`_is_refused_(§3.1,_superseded_2026-09-23)::absent_`publication`_is_legal_and_means_draft
  Scenario: An absent publication is legal and means draft
    Given a minimal declaration with no publication
    When it is parsed
    Then the parse succeeds

  @test:schemas/instance-versioning.test.ts::publication_is_a_STATE,_and_`published`_is_refused_(§3.1,_superseded_2026-09-23)::`publication.state:_"draft"`_is_legal_and_says_nothing_extra
  Scenario: A draft publication state is legal
    Given a minimal declaration with publication state "draft"
    When it is parsed
    Then the parse succeeds

  @test:schemas/instance-versioning.test.ts::publication_is_a_STATE,_and_`published`_is_refused_(§3.1,_superseded_2026-09-23)::`publication.state:_"published"`_FAILS_TO_PARSE_—_the_process_does_not_exist
  Scenario: A published publication state fails to parse
    Given a minimal declaration with publication state "published"
    When it is parsed
    Then the parse fails only at "publication.state"

  @test:schemas/instance-versioning.test.ts::publication_is_a_STATE,_and_`published`_is_refused_(§3.1,_superseded_2026-09-23)::`publication.host`_still_parses_beside_the_state_—_they_are_two_facets,_not_rivals
  Scenario: A publication host parses beside the state or alone
    Given a declaration with publication host "github-pages" and state "draft"
    Then it parses
    And a declaration with only publication host "github-pages" also parses

  @test:schemas/instance-versioning.test.ts::a_version_is_universal_but_GATE-enforced;_an_id_is_held_(§3.2,_owner_2026-09-23)::a_declaration_with_neither_still_parses_—_the_type_permits_absence
  Scenario: A declaration with neither id nor version still parses
    Given a minimal declaration with id and version undefined
    When it is parsed
    Then the parse succeeds

  @test:schemas/instance-versioning.test.ts::a_version_is_universal_but_GATE-enforced;_an_id_is_held_(§3.2,_owner_2026-09-23)::the_GATE_is_what_refuses_a_missing_version,_and_names_the_instance
  Scenario: The publishable gate refuses a missing version and names the instance
    Given a layer tree with instance "alpha" declaring no version
    When auditPublishable runs over it
    Then exactly one finding mentions "version"
    And it is a major finding naming "alpha"

  @test:schemas/instance-versioning.test.ts::a_version_is_universal_but_GATE-enforced;_an_id_is_held_(§3.2,_owner_2026-09-23)::an_instance_WITH_a_version_raises_nothing_—_falsifiable_in_both_directions
  Scenario: An instance with a version raises no publishable findings
    Given a layer tree with instance "alpha" at version "0.1.0"
    When auditPublishable runs over it
    Then there are no findings

  @test:schemas/instance-versioning.test.ts::a_version_is_universal_but_GATE-enforced;_an_id_is_held_(§3.2,_owner_2026-09-23)::no_instance_declares_an_`id`_yet,_and_an_absent_one_is_legal
  Scenario: An absent id is legal
    # Gap: does not check that no real instance declares an id; only that a declaration without one parses cleanly
    Given a minimal declaration with id undefined
    When it is parsed
    Then no parse issue is reported

  @test:schemas/instance-versioning.test.ts::a_version_is_universal_but_GATE-enforced;_an_id_is_held_(§3.2,_owner_2026-09-23)::`canonicalUrl`_is_NOT_required_—_a_draft_without_one_is_legal
  Scenario: A canonicalUrl is not required
    Given a minimal declaration with canonicalUrl undefined
    When it is parsed
    Then the parse succeeds

  @test:schemas/instance-versioning.test.ts::versions_are_exact_—_ranges_cannot_be_expressed_in_FHIR_`dependsOn`_(§2_rule_2)::accepts_%s
  Scenario: An exact version or pseudo-version is accepted
    Given each of "1.0.0", "0.0.1", "10.20.30", "1.2.3-rc.1", "1.2.3+build.5", "current" and "dev"
    When it is parsed by ExactVersionSchema
    Then the parse succeeds

  @test:schemas/instance-versioning.test.ts::versions_are_exact_—_ranges_cannot_be_expressed_in_FHIR_`dependsOn`_(§2_rule_2)::refuses_%p
  Scenario: A version range or non-version is refused
    Given each of "^1.2.3", "~1.2.3", ">=1.0.0", "1.2.*", "1.x", "1.2", "1.0.0 || 2.0.0", "latest" and ""
    When it is parsed by ExactVersionSchema
    Then the parse fails

  @test:schemas/instance-versioning.test.ts::check:publishable_—_the_rules_a_per-declaration_schema_cannot_see::a_duplicate_id_is_a_major_finding_—_an_id_is_an_identity,_so_two_is_two_packages_under_one_name
  Scenario: A duplicate id across instances is a major finding
    Given a layer tree where "alpha" and "beta" both declare id "org.example.shared"
    When auditPublishable runs over it
    Then exactly one finding mentions "org.example.shared"
    And it is major

  @test:schemas/instance-versioning.test.ts::check:publishable_—_the_rules_a_per-declaration_schema_cannot_see::distinct_ids_raise_nothing_—_the_duplicate_rule_is_falsifiable_in_both_directions
  Scenario: Distinct ids raise no publishable findings
    Given a layer tree where "alpha" and "beta" declare their own ids
    When auditPublishable runs over it
    Then there are no findings

  @test:schemas/instance-versioning.test.ts::check:publishable_—_the_rules_a_per-declaration_schema_cannot_see::an_unreadable_declaration_is_`unknown`,_never_counted_as_draft
  Scenario: An unreadable declaration is unknown, never counted as draft
    Given a layer tree whose "broken" declaration is not valid JSON
    When auditPublishable runs over it
    Then the "broken" row has state "unknown" and a problem
    And a major finding is raised for "broken"
    And the formatted report says "UNKNOWN is not draft"

  @test:schemas/instance-versioning.test.ts::check:publishable_—_the_rules_a_per-declaration_schema_cannot_see::an_all-draft_census_says_it_is_DECIDED_—_the_opposite_of_what_it_used_to_say
  Scenario: An all-draft census reports a decided state
    Given a layer tree where "alpha" and "beta" are versioned drafts
    When auditPublishable runs over it
    Then every row is "draft"
    And there are no findings
    And the formatted report says "EVERY INSTANCE IS DRAFT, and that is now a DECIDED state"

  @test:schemas/instance-versioning.test.ts::check:publishable_—_the_rules_a_per-declaration_schema_cannot_see::`publication.state:_"published"`_FAILS_TO_PARSE_—_refused,_not_reported
  Scenario: A declaration with publication state "published" is read as unknown by the gate
    Given a layer tree whose "alpha" declares publication state "published"
    When auditPublishable runs over it
    Then its row has state "unknown" and a problem

  @test:schemas/instance-versioning.test.ts::dependsOn_—_§3.4's_record,_and_what_it_reports_instead::a_publishable_instance_depending_on_a_publishable_one_emits_the_FHIR_triple
  Scenario: A dependency between two instances with canonical URLs emits the FHIR triple
    Given instance "top" needs "base", and both carry an id, version "1.0.0" and canonicalUrl
    When dependsOnFor reads "top"
    Then the records are packageId "org.example.base", version "1.0.0", uri "https://example.org/base"
    And there are no gaps and no unavailable note

  @test:schemas/instance-versioning.test.ts::dependsOn_—_§3.4's_record,_and_what_it_reports_instead::a_dependency_with_no_`canonicalUrl`_is_a_gap,_not_an_omission_—_and_says_which_reason
  Scenario: A dependency with no canonicalUrl is a no-uri gap
    Given instance "top" needs "base", which has an id and version but no canonicalUrl
    When dependsOnFor reads "top"
    Then there are no records
    And there is one gap with reason "no-uri"
    And the unavailable note says "none expressible as a record"

  @test:schemas/instance-versioning.test.ts::dependsOn_—_§3.4's_record,_and_what_it_reports_instead::an_id_and_a_version_are_NOT_enough_—_the_gap_is_specifically_the_uri
  Scenario: A dependency's gap names the missing canonicalUrl, not publishability
    Given instance "top" needs "base", which has an id and version "2.5.0" but no canonicalUrl
    When dependsOnFor reads "top"
    Then the first gap's detail mentions "canonicalUrl"
    And it does not mention "publishable"

  @test:schemas/instance-versioning.test.ts::dependsOn_—_§3.4's_record,_and_what_it_reports_instead::a_name_matching_no_instance_is_`unresolved`_—_external_and_misspelled_are_not_the_same
  Scenario: A needed name matching no instance is unresolved
    Given instance "top" needs "nowhere", which is not in the tree
    When dependsOnFor reads "top"
    Then there is one gap, for "nowhere", with reason "unresolved"

  @test:schemas/instance-versioning.test.ts::dependsOn_—_§3.4's_record,_and_what_it_reports_instead::a_publishable_instance_with_no_dependencies_is_a_DETERMINED_empty_—_no_`unavailable`
  Scenario: An instance with no dependencies has a determined empty dependsOn
    Given instance "solo" with a canonicalUrl and no needs
    When dependsOnFor reads "solo"
    Then there are no records and no gaps
    And there is no unavailable note

  @test:schemas/instance-versioning.test.ts::dependsOn_—_§3.4's_record,_and_what_it_reports_instead::an_instance_with_NO_canonicalUrl_withholds_the_block_and_says_why_—_it_does_not_emit_an_empty_one
  Scenario: An instance with no canonicalUrl withholds dependsOn and says why
    Given instance "top" with an id and version but no canonicalUrl
    When dependsOnFor reads "top"
    Then there are no records
    And the unavailable note mentions "canonicalUrl" and "cannot be expressed"

  @test:schemas/instance-versioning.test.ts::dependsOn_—_§3.4's_record,_and_what_it_reports_instead::having_an_id_and_a_version_is_not_enough_—_the_withholding_is_specifically_the_uri
  Scenario: An id and version alone do not make dependsOn expressible
    Given instance "top" with an id and version "3.1.4" but no canonicalUrl
    When dependsOnFor reads "top"
    Then an unavailable note is given
    And it does not mention "publishable"

  @test:schemas/instance-versioning.test.ts::version_bump_—_computed_from_the_surface,_not_claimed_by_a_commit_message_(§4)::a_removal_is_MAJOR,_and_outranks_a_simultaneous_addition
  Scenario: A removal is a major bump and outranks an addition
    Given a surface of Skill "a" and "b" that becomes Skill "a" and "c"
    When diffSurface compares them
    Then the bump is "major"
    And Skill "c" is listed as added and Skill "b" as removed

  @test:schemas/instance-versioning.test.ts::version_bump_—_computed_from_the_surface,_not_claimed_by_a_commit_message_(§4)::an_addition_alone_is_MINOR
  Scenario: An addition alone is a minor bump
    Given a surface of Skill "a" that gains Tool "t"
    When diffSurface compares them
    Then the bump is "minor"

  @test:schemas/instance-versioning.test.ts::version_bump_—_computed_from_the_surface,_not_claimed_by_a_commit_message_(§4)::no_change_is_PATCH_—_prose_included,_which_is_18_of_the_20_measured_commits
  Scenario: No surface change is a patch bump
    Given an unchanged surface of Skill "a"
    When diffSurface compares it with itself
    Then the bump is "patch"

  @test:schemas/instance-versioning.test.ts::version_bump_—_computed_from_the_surface,_not_claimed_by_a_commit_message_(§4)::a_node_whose_TYPE_changed_under_the_same_id_is_major,_not_patch
  Scenario: A node whose type changed under the same id is a major bump
    Given Skill "x" that becomes Tool "x"
    When diffSurface compares them
    Then the bump is "major"

  @test:schemas/instance-versioning.test.ts::version_bump_—_computed_from_the_surface,_not_claimed_by_a_commit_message_(§4)::surfaceOf_takes_every_node_with_an_@id,_dedupes,_and_sorts
  Scenario: surfaceOf takes every node with an @id, dedupes and sorts
    Given a graph with Skill "b", Skill "a" twice, and a Skill with no @id
    When surfaceOf reads it
    Then the surface is Skill "a" then Skill "b"

  @test:schemas/instance-versioning.test.ts::version_bump_—_computed_from_the_surface,_not_claimed_by_a_commit_message_(§4)::a_node_with_an_@id_but_no_@type_is_scored_under_`?`,_never_dropped
  Scenario: A node with an @id but no @type is scored under "?"
    Given a graph with a single node "x" that has no @type
    When surfaceOf reads it
    Then the surface is type "?" with id "x"

  @test:schemas/instance-versioning.test.ts::version_bump_—_computed_from_the_surface,_not_claimed_by_a_commit_message_(§4)::a_multi-typed_node_is_keyed_on_its_types_SORTED,_so_array_order_is_not_a_change
  Scenario: A multi-typed node is keyed on its sorted types
    Given node "x" typed ["B", "A"] in one graph and ["A", "B"] in another
    When diffSurface compares their surfaces
    Then the bump is "patch"

  @test:schemas/instance-versioning.test.ts::version_bump_—_computed_from_the_surface,_not_claimed_by_a_commit_message_(§4)::a_document_with_no_@graph_is_an_empty_surface,_not_a_crash
  Scenario: A document with no @graph is an empty surface
    When surfaceOf reads an empty object or null
    Then the surface is empty in both cases

  @test:schemas/instance-versioning.test.ts::version_bump_—_computed_from_the_surface,_not_claimed_by_a_commit_message_(§4)::applyBump::bumps_the_right_field_and_zeroes_the_ones_below_it
  Scenario: applyBump raises the right field and zeroes those below it
    Given version "1.2.3"
    Then a major bump gives "2.0.0"
    And a minor bump gives "1.3.0"
    And a patch bump gives "1.2.4"

  @test:schemas/instance-versioning.test.ts::version_bump_—_computed_from_the_surface,_not_claimed_by_a_commit_message_(§4)::applyBump::a_pseudo-version_comes_back_unchanged_rather_than_coerced
  Scenario: A pseudo-version comes back unchanged from applyBump
    Then a major bump of "current" gives "current"
    And a minor bump of "dev" gives "dev"

  @test:schemas/instance-versioning.test.ts::version_bump_—_computed_from_the_surface,_not_claimed_by_a_commit_message_(§4)::clearsFloor_—_a_floor,_not_an_expectation::equal_to_the_floor_passes
  Scenario: A version equal to the floor clears it
    Then clearsFloor of "1.3.0" against floor "1.3.0" is true

  @test:schemas/instance-versioning.test.ts::version_bump_—_computed_from_the_surface,_not_claimed_by_a_commit_message_(§4)::clearsFloor_—_a_floor,_not_an_expectation::ABOVE_the_floor_passes_—_the_author_may_always_bump_further
  Scenario: A version above the floor clears it
    Then clearsFloor of "2.0.0" and of "1.4.0" against floor "1.3.0" are both true

  @test:schemas/instance-versioning.test.ts::version_bump_—_computed_from_the_surface,_not_claimed_by_a_commit_message_(§4)::clearsFloor_—_a_floor,_not_an_expectation::below_the_floor_fails_—_that_is_the_whole_gate
  Scenario: A version below the floor fails
    Then clearsFloor of "1.2.9" against "1.3.0" is false
    And clearsFloor of "1.0.0" against "2.0.0" is false

  @test:schemas/instance-versioning.test.ts::version_bump_—_computed_from_the_surface,_not_claimed_by_a_commit_message_(§4)::clearsFloor_—_a_floor,_not_an_expectation::compares_NUMERICALLY,_so_0.10.0_is_above_0.9.0
  Scenario: Floors compare numerically
    Then clearsFloor of "0.10.0" against "0.9.0" is true
    And clearsFloor of "0.9.0" against "0.10.0" is false

  @test:schemas/instance-versioning.test.ts::version_bump_—_computed_from_the_surface,_not_claimed_by_a_commit_message_(§4)::clearsFloor_—_a_floor,_not_an_expectation::an_uncomparable_pair_is_NOT_a_pass_—_the_caller_reports_it_undetermined
  Scenario: An uncomparable pair does not clear the floor
    Then clearsFloor of "current" against "1.0.0" is false
    And comparable of "current" and "1.0.0" is false
    And comparable of "1.0.0" and "1.2.3" is true

  @test:schemas/instance-versioning.test.ts::version_bump_—_computed_from_the_surface,_not_claimed_by_a_commit_message_(§4)::every_instance_carrying_a_version_means_the_gate_has_rows_to_score
  Scenario: Every versioned instance gives the version-bump gate a row
    Given a layer tree with versioned instances "alpha" and "beta"
    When auditVersionBumps runs over it
    Then its rows are "alpha" and "beta"
    And the report carries no note

  @test:schemas/instance-versioning.test.ts::release_tags_—_`<name>-v`_everywhere,_plain_`v`_only_in_a_standalone_repository_(owner_2026-09-30,_Q4)::a_standalone_repository's_plain_tags_are_its_releases,_newest_first
  Scenario: A standalone repository's plain tags are its releases, newest first
    Given a git repository tagged "v0.1.0", "v0.10.0", "v0.9.0" and "vnext"
    When releaseTags reads it for "bootstrap" as a standalone repository
    Then the release tags are "v0.10.0", "v0.9.0", "v0.1.0" in that order

  @test:schemas/instance-versioning.test.ts::release_tags_—_`<name>-v`_everywhere,_plain_`v`_only_in_a_standalone_repository_(owner_2026-09-30,_Q4)::in_a_repository_of_several_instances_a_plain_tag_names_no_instance,_so_it_is_not_read
  Scenario: In a repository of several instances a plain tag is not read
    Given a git repository tagged "v1.0.0" and "bootstrap-v0.2.0"
    When releaseTags reads it for "bootstrap" not as a standalone repository
    Then the only release tag is "bootstrap-v0.2.0"

  @test:schemas/instance-versioning.test.ts::release_tags_—_`<name>-v`_everywhere,_plain_`v`_only_in_a_standalone_repository_(owner_2026-09-30,_Q4)::both_spellings_of_one_version_are_one_release
  Scenario: Both spellings of one version are one release
    Given a git repository tagged "v0.1.0" and "bootstrap-v0.1.0"
    When releaseTags reads it for "bootstrap" as a standalone repository
    Then the release versions are just "0.1.0"
