# scripts/check-reference-direction.ts enforces the no-upward-reference rule: a layer may name only
# the layers it needs, with declared exemptions, a committed sidecar and a NEW-pair baseline gate.
# Each Scenario names the test that executes it.
Feature: Reference direction between layers

  @test:scripts/tests/kg/check-reference-direction.test.ts::occurrencesOf_is_bounded,_because_one_instance_name_may_prefix_another::a_name_inside_a_longer_name_is_NOT_an_occurrence_of_it
  Scenario: A name inside a longer name is not an occurrence of it
    Given the line "see folio-assistant-core for this"
    When occurrences of "folio-assistant" are sought
    Then none are found

  @test:scripts/tests/kg/check-reference-direction.test.ts::occurrencesOf_is_bounded,_because_one_instance_name_may_prefix_another::the_longer_name_IS_found_on_that_same_line
  Scenario: The longer name is found on the same line
    Given the line "see folio-assistant-core for this"
    When occurrences of "folio-assistant-core" are sought
    Then exactly one is found

  @test:scripts/tests/kg/check-reference-direction.test.ts::occurrencesOf_is_bounded,_because_one_instance_name_may_prefix_another::ordinary_punctuation_and_path_separators_still_bound_a_name
  Scenario: Punctuation and path separators still bound a name
    Given the lines "`smart-base`", "smart-base/schemas/x.ts", "(smart-base)" and "smart-base."
    When occurrences of "smart-base" are sought in each
    Then each line yields exactly one occurrence

  @test:scripts/tests/kg/check-reference-direction.test.ts::occurrencesOf_is_bounded,_because_one_instance_name_may_prefix_another::one_occurrence_per_LINE,_so_a_line_is_never_counted_twice_for_one_name
  Scenario: A name is counted once per line however often it appears
    Given the line "smart-base and smart-base again"
    When occurrences of "smart-base" are sought
    Then exactly one is found

  @test:scripts/tests/kg/check-reference-direction.test.ts::occurrencesOf_is_bounded,_because_one_instance_name_may_prefix_another::line_numbers_are_1-based_and_point_at_the_right_line
  Scenario: Occurrence line numbers are 1-based
    Given a text whose third line is "smart-base"
    When occurrences of "smart-base" are sought
    Then the first occurrence is on line 3

  @test:scripts/tests/kg/check-reference-direction.test.ts::classifyReference_follows_the_dependency_arrow::naming_what_you_depend_on_is_allowed
  Scenario: Naming a layer you depend on is allowed
    Given the layers low <- mid <- high, each needing the one before
    When a reference from high to mid is classified with no name collision
    Then the verdict is "allowed"

  @test:scripts/tests/kg/check-reference-direction.test.ts::classifyReference_follows_the_dependency_arrow::naming_it_TRANSITIVELY_is_allowed_too_—_the_rule_is_the_closure,_not_the_direct_edge
  Scenario: Naming a layer you depend on transitively is allowed
    Given the layers low <- mid <- high
    When a reference from high to low is classified
    Then the verdict is "allowed"

  @test:scripts/tests/kg/check-reference-direction.test.ts::classifyReference_follows_the_dependency_arrow::naming_an_instance_that_depends_on_you_is_wrong-direction
  Scenario: Naming a layer that depends on you is wrong-direction
    Given the layers low <- mid <- high
    When a reference from low to high is classified
    Then the verdict is "wrong-direction"
    And its basis says the layer "may not name it"

  @test:scripts/tests/kg/check-reference-direction.test.ts::classifyReference_follows_the_dependency_arrow::an_instance_that_declares_no_`needs`_is_undetermined,_never_clean_and_never_a_finding
  Scenario: A reference from a layer that declares no needs is undetermined
    Given a layer "floating" that declares no needs
    When a reference from floating to high is classified
    Then the verdict is "undetermined"

  @test:scripts/tests/kg/check-reference-direction.test.ts::a_name_colliding_with_the_repository's_is_decided_per_OCCURRENCE,_not_per_name::"unknown"_is_still_`undetermined`_—_the_honest_residue_survives
  Scenario: An "unknown" collision is undetermined
    Given the target name collides with the repository's and the resolver answers "unknown"
    When a reference from low to high is classified
    Then the verdict is "undetermined"
    And its basis mentions the "repository's name"

  @test:scripts/tests/kg/check-reference-direction.test.ts::a_name_colliding_with_the_repository's_is_decided_per_OCCURRENCE,_not_per_name::"unknown"_is_not_called_clean_either:_it_does_NOT_become_`allowed`
  Scenario: An "unknown" collision is never allowed
    Given the resolver answers "unknown" for the target high
    When a reference from low to high is classified
    Then the verdict is not "allowed"

  @test:scripts/tests/kg/check-reference-direction.test.ts::a_name_colliding_with_the_repository's_is_decided_per_OCCURRENCE,_not_per_name::"unknown"_outranks_every_exemption,_so_no_exemption_can_silently_claim_the_credit
  Scenario: An "unknown" collision outranks every exemption
    Given the resolver answers "unknown" for the target high
    And an exemption whose pattern matches every line
    When a reference from low to high is classified
    Then the verdict is "undetermined"

  @test:scripts/tests/kg/check-reference-direction.test.ts::a_name_colliding_with_the_repository's_is_decided_per_OCCURRENCE,_not_per_name::"repository"_is_`names-repository`_—_judged,_and_owing_no_direction
  Scenario: A "repository" collision is names-repository
    Given the resolver answers "repository" for the target high
    When a reference from low to high is classified
    Then the verdict is "names-repository"
    And its basis says "not a layer"

  @test:scripts/tests/kg/check-reference-direction.test.ts::a_name_colliding_with_the_repository's_is_decided_per_OCCURRENCE,_not_per_name::"repository"_is_NOT_`allowed`,_`exempt`_or_`undetermined`_—_it_is_its_own_statement
  Scenario: A "repository" collision stays names-repository even under a matching exemption
    Given the resolver answers "repository" for the target high
    And an exemption whose pattern matches every line
    When a reference from low to high is classified
    Then the verdict is "names-repository"

  @test:scripts/tests/kg/check-reference-direction.test.ts::a_name_colliding_with_the_repository's_is_decided_per_OCCURRENCE,_not_per_name::"instance"_falls_THROUGH_to_the_arrow,_so_it_can_be_wrong-direction
  Scenario: An "instance" collision falls through to the arrow and can be wrong-direction
    Given the resolver answers "instance" for the target high
    When a reference from low to high is classified
    Then the verdict is "wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::a_name_colliding_with_the_repository's_is_decided_per_OCCURRENCE,_not_per_name::"instance"_pointing_DOWN_the_arrow_is_allowed,_like_any_other_reference
  Scenario: An "instance" collision pointing down the arrow is allowed
    Given the resolver answers "instance" for the target low
    When a reference from high to low is classified
    Then the verdict is "allowed"

  @test:scripts/tests/kg/check-reference-direction.test.ts::a_name_colliding_with_the_repository's_is_decided_per_OCCURRENCE,_not_per_name::"instance"_can_be_exempted,_which_the_blanket_verdict_made_impossible
  Scenario: An "instance" collision can be exempted
    Given the resolver answers "instance" for the target high
    And a URL exemption
    When a reference from low to high on the line "see https://x/high" is classified
    Then the verdict is "exempt"

  @test:scripts/tests/kg/check-reference-direction.test.ts::exemptions_are_consulted_only_for_a_reference_the_rule_would_refuse::a_refused_reference_on_an_exempt_line_is_exempt,_carrying_its_reason
  Scenario: A refused reference on an exempt line is exempt with the exemption's reason
    Given a URL exemption with the reason "an address, not a reference"
    When a reference from low to high on the line "see https://x/high" is classified
    Then the verdict is "exempt"
    And its basis carries "an address, not a reference"

  @test:scripts/tests/kg/check-reference-direction.test.ts::exemptions_are_consulted_only_for_a_reference_the_rule_would_refuse::an_ALLOWED_reference_is_never_reported_as_exempt_—_which_is_what_lets_a_caller_find_a_stale_exemption
  Scenario: An allowed reference is never reported as exempt
    Given a URL exemption
    When a reference from high to low on the line "see https://x/low" is classified
    Then the verdict is "allowed"

  @test:scripts/tests/kg/check-reference-direction.test.ts::exemptions_are_consulted_only_for_a_reference_the_rule_would_refuse::a_file-scoped_exemption_matches_on_the_file,_not_the_line
  Scenario: A file-scoped exemption matches on the file, not the line
    Given an exemption scoped to files ending ".test.ts"
    When a reference from low to high in "a/b.test.ts" is classified
    Then the verdict is "exempt"
    And the same reference in "a/b.ts" is "wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::exemptions_are_consulted_only_for_a_reference_the_rule_would_refuse::an_exemption_scoped_to_another_target_does_not_fire
  Scenario: An exemption scoped to another target does not fire
    Given an exemption matching every line but scoped to the target mid
    When a reference from low to high is classified
    Then the verdict is "wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::analyse_over_a_synthetic_tree::a_lower_instance_naming_a_higher_one_is_a_finding
  Scenario: A lower layer naming a higher one is a finding
    Given a tree with low <- high and "low/notes.md" saying "this is about high"
    When the tree is analysed
    Then the only verdict is "low/notes.md wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::analyse_over_a_synthetic_tree::a_higher_instance_naming_a_lower_one_is_not
  Scenario: A higher layer naming a lower one is not a finding
    Given a tree with low <- high and "high/notes.md" saying "this is about low"
    When the tree is analysed
    Then nothing is classified

  @test:scripts/tests/kg/check-reference-direction.test.ts::analyse_over_a_synthetic_tree::a_file_belongs_to_the_INNERMOST_declaring_root_that_contains_it
  Scenario: A file belongs to the innermost declaring root that contains it
    Given a tree with low <- high and "high/deep/nested/notes.md" saying "about low"
    When the tree is analysed
    Then nothing is classified

  @test:scripts/tests/kg/check-reference-direction.test.ts::analyse_over_a_synthetic_tree::a_directory_DECLARED_to_hold_a_machine-written_graph_is_not_read
  Scenario: A directory declared to hold a machine-written graph is not read
    Given low declares "out/" holding the "qa" typology
    And "low/out/index.json" and "low/notes.md" both name high
    When the tree is analysed
    Then the only verdict is "low/notes.md wrong-direction"
    And one file is counted as skipped machine-written

  @test:scripts/tests/kg/check-reference-direction.test.ts::analyse_over_a_synthetic_tree::a_route_another_harness_builds_on_this_instance's_site_(builtOnHostSite)_is_not_read_as_this_instance's
  Scenario: A route another harness builds on this layer's site is not read as this layer's
    Given "low/docs/en/high/bibliography/references.jsonld" and "low/notes.md" both name high
    When the tree is analysed with no host-site route
    Then both files are wrong-direction
    When it is analysed with "low/docs/en/high/bibliography" as a host-site route
    Then only "low/notes.md" is classified
    And one file is counted as skipped machine-written

  @test:scripts/tests/kg/check-reference-direction.test.ts::analyse_over_a_synthetic_tree::a_tree_with_no_builtOnHostSite_visualiser_derives_no_host-site_route
  Scenario: A tree with no builtOnHostSite visualiser skips nothing as machine-written
    Given a tree where only "low/notes.md" names high
    When the tree is analysed
    Then the skipped machine-written count is 0

  @test:scripts/tests/kg/check-reference-direction.test.ts::analyse_over_a_synthetic_tree::a_directory_holding_an_AUTHORED_graph_is_read_—_the_exclusion_is_the_declaration,_not_the_shape
  Scenario: A directory holding an authored graph is read
    Given low declares "out/" holding the "docs" typology
    And "low/out/index.json" names high
    When the tree is analysed
    Then the only verdict is "low/out/index.json wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::analyse_over_a_synthetic_tree::an_instance_with_no_declared_`needs`_is_reported_as_undeclared_rather_than_assumed
  Scenario: A layer with no declared needs is reported as undeclared
    Given a tree with "low" needing nothing and "adrift" declaring no needs
    When the tree is analysed
    Then the undeclared layers are exactly ["adrift"]

  @test:scripts/tests/kg/check-reference-direction.test.ts::analyse_over_a_synthetic_tree::a_broken_needs_graph_is_REFUSED,_not_walked_—_a_partial_closure_reports_allowed_references_as_findings
  Scenario: A broken needs graph is refused rather than walked
    Given a tree where x needs y and y needs x
    When the tree is analysed
    Then it throws "needs graph is broken"

  @test:scripts/tests/kg/check-reference-direction.test.ts::a_file_whose_own_`$schema`_is_declared_`generated`_is_not_read::it_is_skipped_even_though_its_DIRECTORY_holds_authored_content
  Scenario: A file whose $schema is declared generated is skipped inside an authored directory
    Given low declares its root as holding the "docs" typology
    And "low/index.json" has $schema "folio-schema-graph/v1" and names high
    When the tree is analysed
    Then nothing is classified
    And one file is counted as skipped generator-written

  @test:scripts/tests/kg/check-reference-direction.test.ts::a_file_whose_own_`$schema`_is_declared_`generated`_is_not_read::an_AUTHORED_family_is_read_—_`folio-intake/v1`_is_not_declared_generated
  Scenario: A file of an authored family such as folio-intake/v1 is read
    Given low declares its root as holding the "docs" typology
    And "low/index.json" has $schema "folio-intake/v1" and names high
    When the tree is analysed
    Then the skipped generator-written count is 0
    And the only verdict is "low/index.json wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::a_file_whose_own_`$schema`_is_declared_`generated`_is_not_read::the_same_file_with_an_UNDECLARED_$schema_is_read
  Scenario: A file with an undeclared $schema is read
    Given "low/index.json" has $schema "something-nobody-declared/v1" and names high
    When the tree is analysed
    Then the only verdict is "low/index.json wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::a_file_whose_own_`$schema`_is_declared_`generated`_is_not_read::only_a_TOP-LEVEL_$schema_counts_—_a_file_that_MENTIONS_one_is_still_read
  Scenario: Only a top-level $schema counts
    Given "low/notes.json" carries the generated $schema only inside a nested object and names high
    When the tree is analysed
    Then the only verdict is "low/notes.json wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::a_file_whose_own_`$schema`_is_declared_`generated`_is_not_read::an_unparseable_JSON_file_is_read_rather_than_skipped_—_a_broken_file_is_not_a_licence
  Scenario: An unparseable JSON file is read rather than skipped
    Given "low/broken.json" is not valid JSON and mentions high
    When the tree is analysed
    Then the only verdict is "low/broken.json wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::a_file_that_DECLARES_itself_generated_is_not_read::a_top-level_"_generated"_key_in_JSON_—_the_convention_sync-docs-harness.ts_already_emits
  Scenario: A JSON file with a top-level "_generated" key is not read
    Given "low/d.json" has a top-level "_generated" key and names high
    When the tree is analysed
    Then nothing is classified

  @test:scripts/tests/kg/check-reference-direction.test.ts::a_file_that_DECLARES_itself_generated_is_not_read::`generated:`_front_matter_in_Markdown_—_what_the_docs/reference_mirrors_now_carry
  Scenario: A Markdown page with generated front matter is not read
    Given "low/p.md" has front matter with a "generated:" key and a body naming high
    When the tree is analysed
    Then nothing is classified

  @test:scripts/tests/kg/check-reference-direction.test.ts::a_file_that_DECLARES_itself_generated_is_not_read::front_matter_with_NO_generated_key_is_read
  Scenario: Front matter without a generated key is read
    Given "low/p.md" has front matter with only "layout: default" and a body naming high
    When the tree is analysed
    Then the only verdict is "low/p.md wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::a_file_that_DECLARES_itself_generated_is_not_read::a_page_that_merely_DISCUSSES_generation_cannot_exempt_itself
  Scenario: A page that discusses generation in its body cannot exempt itself
    Given "low/p.md" has no front matter and a body line "generated: is a front-matter key" naming high
    When the tree is analysed
    Then the only verdict is "low/p.md wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::a_file_that_DECLARES_itself_generated_is_not_read::"_generated"_nested_deeper_in_the_JSON_does_not_count
  Scenario: A "_generated" key nested deeper in JSON does not count
    Given "low/d.json" carries "_generated" only inside a nested object and names high
    When the tree is analysed
    Then the only verdict is "low/d.json wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::the_repository-name_collision,_resolved_from_the_occurrence_and_the_declaration::a_URL_naming_the_repository_is_`names-repository`_—_an_address,_not_a_layer
  Scenario: A URL naming the repository is names-repository
    Given a tree where layer "repo" is rooted at the repository root, needs low, and declares "uploads/" and "tools/"
    And "low/a.md" says "see <https://litlfred.github.io/repo/guides/x.html>"
    When the tree is analysed
    Then the only verdict is "names-repository"

  @test:scripts/tests/kg/check-reference-direction.test.ts::the_repository-name_collision,_resolved_from_the_occurrence_and_the_declaration::`<owner>/<name>`_is_`names-repository`_—_a_repository_slug
  Scenario: An owner/name slug is names-repository
    Given a tree where layer "repo" is rooted at the repository root, needs low, and declares "uploads/" and "tools/"
    And "low/a.md" says "cloned from litlfred/repo last week"
    When the tree is analysed
    Then the only verdict is "names-repository"

  @test:scripts/tests/kg/check-reference-direction.test.ts::the_repository-name_collision,_resolved_from_the_occurrence_and_the_declaration::`<name>/`_before_any_OTHER_path_segment_is_`names-repository`_—_a_path_in_the_repository
  Scenario: The name followed by an undeclared path segment is names-repository
    Given a tree where layer "repo" is rooted at the repository root, needs low, and declares "uploads/" and "tools/"
    And "low/a.md" says "it lives at repo/docs/guides/x.md"
    When the tree is analysed
    Then the only verdict is "names-repository"

  @test:scripts/tests/kg/check-reference-direction.test.ts::the_repository-name_collision,_resolved_from_the_occurrence_and_the_declaration::a_path_into_a_DECLARED_directory_is_judged_by_the_arrow,_NOT_`names-repository`
  Scenario: A path into a declared directory is judged by the arrow
    Given a tree where layer "repo" is rooted at the repository root, needs low, and declares "uploads/" and "tools/"
    And "low/a.md" says "dropped in repo/uploads/x.pdf"
    When the tree is analysed
    Then the only verdict is "wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::the_repository-name_collision,_resolved_from_the_occurrence_and_the_declaration::the_OTHER_declared_directory_too_—_it_is_read_from_the_declaration,_not_from_a_literal
  Scenario: The other declared directory is recognised too
    Given a tree where layer "repo" is rooted at the repository root, needs low, and declares "uploads/" and "tools/"
    And "low/a.md" says "the barrel is repo/tools/index.ts"
    When the tree is analysed
    Then the only verdict is "wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::the_repository-name_collision,_resolved_from_the_occurrence_and_the_declaration::a_URL_that_points_INTO_a_declared_directory_is_still_the_instance_—_order_matters
  Scenario: A URL into a declared directory is the layer, then excused by the URL exemption
    Given a tree where layer "repo" is rooted at the repository root, needs low, and declares "uploads/" and "tools/"
    And "low/a.md" says "see https://x.test/repo/uploads/x.pdf"
    When the tree is analysed
    Then the only verdict is "exempt"

  @test:scripts/tests/kg/check-reference-direction.test.ts::the_repository-name_collision,_resolved_from_the_occurrence_and_the_declaration::a_bare_prose_mention_is_`undetermined`_—_the_third_state_is_still_reachable
  Scenario: A bare prose mention of the colliding name is undetermined
    Given a tree where layer "repo" is rooted at the repository root, needs low, and declares "uploads/" and "tools/"
    And "low/a.md" says "this whole thing is about repo, in the end"
    When the tree is analysed
    Then the only verdict is "undetermined"
    And its basis mentions the "repository's name"

  @test:scripts/tests/kg/check-reference-direction.test.ts::the_repository-name_collision,_resolved_from_the_occurrence_and_the_declaration::a_NON-colliding_target_behaves_exactly_as_before_—_the_collision_rule_reaches_nothing_else
  Scenario: A non-colliding target is never names-repository
    Given a tree where layer "repo" is rooted at the repository root, needs low, and declares "uploads/" and "tools/"
    And "low/a.md" names high as prose, as a URL, as an owner/name slug and as a path, one tree each
    When each tree is analysed
    Then no verdict is "names-repository"
    And the prose line "this is about high" is "wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::a_declared_path_resolves_against_the_scope_it_declares,_not_against_the_declarer::a_repository-scoped_machine-written_directory_is_excluded_from_ANOTHER_instance's_tree
  Scenario: A repository-scoped machine-written directory is excluded from another layer's tree
    Given high declares "low/out/" at repository scope holding the "qa" typology
    And "low/out/x.md" and "low/keep.md" both name high
    When the tree is analysed
    Then the only verdict is "low/keep.md wrong-direction"
    And one file is counted as skipped machine-written

  @test:scripts/tests/kg/check-reference-direction.test.ts::a_declared_path_resolves_against_the_scope_it_declares,_not_against_the_declarer::the_SAME_entry_at_instance_scope_resolves_under_the_declarer_and_excludes_nothing
  Scenario: The same entry at instance scope resolves under the declarer and excludes nothing
    Given high declares "low/out/" at instance scope holding the "qa" typology
    And "low/out/x.md" and "low/keep.md" both name high
    When the tree is analysed
    Then both files are wrong-direction
    And the skipped machine-written count is 0

  @test:scripts/tests/kg/check-reference-direction.test.ts::directionStates_records_the_determinations,_and_each_one_separately::a_file_naming_SEVERAL_instances_above_it,_unlisted,_is_the_state_that_exits_1
  Scenario: An unlisted file naming several higher layers is multi-destination unlisted
    Given a three-tier tree low <- mid <- high
    And "low/a.md" says "about mid and high"
    When the direction states are computed with no pending list
    Then multi-destination-unlisted is exactly "low/a.md" naming 2

  @test:scripts/tests/kg/check-reference-direction.test.ts::directionStates_records_the_determinations,_and_each_one_separately::the_same_file_LISTED_is_not_in_that_set_—_membership_is_the_ruling
  Scenario: The same file listed as pending is not multi-destination unlisted
    Given a three-tier tree low <- mid <- high
    And "low/a.md" says "about mid and high"
    When the direction states are computed with "low/a.md" pending for 2 names
    Then multi-destination-unlisted is empty

  @test:scripts/tests/kg/check-reference-direction.test.ts::directionStates_records_the_determinations,_and_each_one_separately::a_file_naming_ONE_instance_above_it_is_not_multi-destination_—_it_has_a_destination
  Scenario: A file naming one higher layer is not multi-destination
    Given a three-tier tree low <- mid <- high
    And "low/a.md" says "about high"
    When the direction states are computed with no pending list
    Then multi-destination-unlisted is empty

  @test:scripts/tests/kg/check-reference-direction.test.ts::directionStates_records_the_determinations,_and_each_one_separately::a_PENDING_entry_with_no_wrong-direction_reference_left_is_reported_stale
  Scenario: A pending entry with no wrong-direction reference left is stale
    Given a three-tier tree low <- mid <- high
    And "low/a.md" says "nothing to see"
    When the direction states are computed with "low/a.md" pending for 2 names
    Then it is reported stale with "no wrong-direction reference left"

  @test:scripts/tests/kg/check-reference-direction.test.ts::directionStates_records_the_determinations,_and_each_one_separately::a_PENDING_entry_that_now_names_ONE_instance_is_reported_stale_too_—_the_set_is_checked_BOTH_ways
  Scenario: A pending entry that now names one layer is stale
    Given a three-tier tree low <- mid <- high
    And "low/a.md" says "about high"
    When the direction states are computed with "low/a.md" pending for 2 names
    Then it is reported stale because it "now names ONE instance, so it has a destination and is not pending"

  @test:scripts/tests/kg/check-reference-direction.test.ts::directionStates_records_the_determinations,_and_each_one_separately::an_instance_declaring_no_`needs`_is_carried_as_its_own_state,_never_folded_into_a_count
  Scenario: A layer declaring no needs is carried as its own state
    Given a tree with "low" needing nothing and "adrift" declaring no needs
    When the direction states are computed
    Then the undeclared instances are exactly ["adrift"]

  @test:scripts/tests/kg/check-reference-direction.test.ts::the_census_records_VERDICT_counts_and_no_FILE_count::the_four_verdicts_are_all_recorded,_`undetermined`_among_them
  Scenario: The census records all four verdict counts
    Given a three-tier tree low <- mid <- high
    And "low/a.md" says "about mid and high"
    When the census is computed
    Then it has the keys wrongDirection, exempt, namesRepository and undetermined
    And wrongDirection is 2

  @test:scripts/tests/kg/check-reference-direction.test.ts::the_census_records_VERDICT_counts_and_no_FILE_count::a_count_of_FILES_is_NOT_recorded_—_it_is_a_census_and_stays_printed
  Scenario: The census records no skipped-file counts
    # Gap: Only keys named "skipped..." are checked; other file counts are not
    Given a three-tier tree low <- mid <- high
    And "low/a.md" says "about high"
    When the census is computed
    Then no key starts with "skipped"

  @test:scripts/tests/kg/check-reference-direction.test.ts::the_census_records_VERDICT_counts_and_no_FILE_count::`undetermined`_is_carried_as_its_own_number,_never_merged_with_a_pass_or_a_finding
  Scenario: Undetermined is counted on its own, apart from allowed and wrong-direction
    Given "adrift" declares no needs and "dep" needs adrift
    And "adrift/a.md" says "about dep"
    When the census is computed
    Then undetermined is 1, wrongDirection is 0 and allowed is 0

  @test:scripts/tests/kg/check-reference-direction.test.ts::the_sidecar_is_idempotent,_and_`--check`_grades_the_states_rather_than_the_counts::re-running_the_producer_over_the_same_tree_yields_the_same_bytes
  Scenario: Re-running the producer over the same tree yields the same bytes
    Given a three-tier tree low <- mid <- high
    And "low/a.md" says "about mid and high"
    When the sidecar is written, then rewritten with a later "now"
    Then the file bytes are unchanged

  @test:scripts/tests/kg/check-reference-direction.test.ts::the_sidecar_is_idempotent,_and_`--check`_grades_the_states_rather_than_the_counts::a_fresh_sidecar_is_`current`
  Scenario: A freshly written sidecar is current
    Given a three-tier tree low <- mid <- high
    And the sidecar written from it
    When the sidecar state is checked against the same result
    Then it is "current"

  @test:scripts/tests/kg/check-reference-direction.test.ts::the_sidecar_is_idempotent,_and_`--check`_grades_the_states_rather_than_the_counts::no_sidecar_at_all_is_`absent`,_which_is_NOT_`current`
  Scenario: No sidecar at all is absent
    Given a layer root with no sidecar
    When the sidecar state is checked
    Then it is "absent"

  @test:scripts/tests/kg/check-reference-direction.test.ts::the_sidecar_is_idempotent,_and_`--check`_grades_the_states_rather_than_the_counts::the_state_check_does_NOT_write_—_bean_`ymsu`,_and_this_is_what_pins_it
  Scenario: Checking the sidecar state does not write it
    Given a layer root with no sidecar
    When the sidecar state is checked
    Then no sidecar file exists afterwards

  @test:scripts/tests/kg/check-reference-direction.test.ts::the_sidecar_is_idempotent,_and_`--check`_grades_the_states_rather_than_the_counts::a_hand-edited_GRADED_family_is_`stale`
  Scenario: A hand-edited graded family is stale
    Given a three-tier tree low <- mid <- high
    And the sidecar written from it
    When its "multi-destination-unlisted" family is emptied by hand
    Then the sidecar state is "stale"

  @test:scripts/tests/kg/check-reference-direction.test.ts::the_sidecar_is_idempotent,_and_`--check`_grades_the_states_rather_than_the_counts::a_corpus_whose_STATES_moved_is_`stale`_—_the_sidecar_cannot_outlive_its_ruling
  Scenario: A sidecar whose corpus states moved is stale
    Given a sidecar written for a tree where "low/a.md" names mid and high
    When it is checked against a tree where "low/b.md" names them instead
    Then the sidecar state is "stale"

  @test:scripts/tests/kg/check-reference-direction.test.ts::the_sidecar_is_idempotent,_and_`--check`_grades_the_states_rather_than_the_counts::a_hand-edited_CENSUS_is_still_`current`,_and_that_is_the_deliberate_line
  Scenario: A hand-edited census is still current
    Given a three-tier tree low <- mid <- high
    And the sidecar written from it
    When its census wrongDirection is set to 999999 by hand
    Then the sidecar state is "current"

  @test:scripts/tests/kg/check-reference-direction.test.ts::the_sidecar_is_idempotent,_and_`--check`_grades_the_states_rather_than_the_counts::a_producer_that_moved_is_`stale`_—_a_result_says_what_the_code_that_wrote_it_found
  Scenario: A sidecar from a producer whose hash moved is stale
    Given a three-tier tree low <- mid <- high
    And the sidecar written from it
    When it is checked against a result whose producer script_hash is "0123456789ab"
    Then the sidecar state is "stale"

  @test:scripts/tests/kg/check-reference-direction.test.ts::the_sidecar_is_idempotent,_and_`--check`_grades_the_states_rather_than_the_counts::the_timestamp_alone_never_makes_it_stale
  Scenario: A later timestamp alone never makes the sidecar stale
    Given a three-tier tree low <- mid <- high
    And the sidecar written from it
    When it is checked against a result built at 2030-12-31
    Then the sidecar state is "current"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X1_—_a_translation_mirror_is_exempt_by_its_own_front_matter,_never_by_its_path::`lang:`_other_than_en_AND_`translation_source:`_is_exempt,_carrying_the_X1_reason
  Scenario: A non-English page with translation_source is an exempt translation mirror
    Given "low/fr/p.md" with front matter "lang: fr" and "translation_source: p.md" and a body naming high
    When the tree is analysed
    Then the only verdict is "exempt"
    And it carries the reason "X1, a TRANSLATION MIRROR"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X1_—_a_translation_mirror_is_exempt_by_its_own_front_matter,_never_by_its_path::`lang:_en`_with_a_`translation_source:`_is_still_read_—_the_English_source_is_counted_once
  Scenario: An English page with translation_source is still read
    Given "low/p.md" with front matter "lang: en" and "translation_source: p.md" and a body naming high
    When the tree is analysed
    Then the only verdict is "low/p.md wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X1_—_a_translation_mirror_is_exempt_by_its_own_front_matter,_never_by_its_path::a_non-English_`lang:`_WITHOUT_`translation_source:`_is_read_—_both_halves_are_required
  Scenario: A non-English page without translation_source is read
    Given "low/p.md" with front matter "lang: fr" only and a body naming high
    When the tree is analysed
    Then the only verdict is "low/p.md wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X1_—_a_translation_mirror_is_exempt_by_its_own_front_matter,_never_by_its_path::a_page_that_merely_MENTIONS_the_keys_in_its_body_cannot_exempt_itself
  Scenario: A page mentioning the mirror keys in its body cannot exempt itself
    Given "low/p.md" with no front matter whose body has "lang: fr" and "translation_source: x.md" lines and names high
    When the tree is analysed
    Then the only verdict is "low/p.md wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X1_—_a_translation_mirror_is_exempt_by_its_own_front_matter,_never_by_its_path::it_is_decided_by_the_file,_not_the_path:_a_locale_directory_alone_exempts_nothing
  Scenario: A locale directory alone exempts nothing
    Given "low/docs/fr/p.md" with no front matter naming high
    When the tree is analysed
    Then the only verdict is "low/docs/fr/p.md wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X1_—_a_translation_mirror_is_exempt_by_its_own_front_matter,_never_by_its_path::only_Markdown_is_read_for_it_—_a_JSON_file_with_the_same_keys_is_not_a_mirror
  Scenario: A JSON file with the mirror keys is not a translation mirror
    Given "low/p.json" with lang "fr" and translation_source "x" and a value naming high
    When it is tested as a translation mirror
    Then it is not one
    And the only verdict is "low/p.json wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X1_—_a_translation_mirror_is_exempt_by_its_own_front_matter,_never_by_its_path::it_is_consulted_LAST:_a_line_another_exemption_already_covers_keeps_that_exemption's_reason
  Scenario: A line another exemption covers keeps that exemption's reason over X1
    # Gap: The verdict is not checked to be exempt, nor to carry the URL reason
    Given a French mirror "low/fr/p.md" whose body line is "see https://example.org/high"
    When the tree is analysed
    Then exactly one reference is classified
    And its verdict does not carry the X1 reason

  @test:scripts/tests/kg/check-reference-direction.test.ts::X1_—_a_translation_mirror_is_exempt_by_its_own_front_matter,_never_by_its_path::the_declared-exemption_count_includes_it
  Scenario: The declared-exemption count is reported in the census summary
    # Gap: Does not check that X1 itself is among the counted exemptions
    Given the declared exemption count
    When a result is built from an empty tree with that count
    Then the count is above 0
    And the census summary says "<count> exemption(s) declared"

  @test:scripts/tests/kg/check-reference-direction.test.ts::A.10_—_a_wrong-direction_pair_NEW_against_the_baseline_fails_`--check`,_single_or_multi_destination::the_family_holds_ONE_entry_per_file_and_per_instance_above_it
  Scenario: The wrong-direction family holds one entry per file and higher layer
    Given a three-tier tree low <- mid <- high
    And "low/a.md" names mid and high and "low/b.md" names high
    When the result is built
    Then the wrong-direction entries are low/a.md -> high, low/a.md -> mid and low/b.md -> high

  @test:scripts/tests/kg/check-reference-direction.test.ts::A.10_—_a_wrong-direction_pair_NEW_against_the_baseline_fails_`--check`,_single_or_multi_destination::an_unchanged_tree_is_inherited,_not_new_—_exit_0
  Scenario: An unchanged tree is inherited against its baseline
    Given a baseline written from a tree where "low/a.md" names high
    When the same tree is judged against it
    Then the exit code is 0

  @test:scripts/tests/kg/check-reference-direction.test.ts::A.10_—_a_wrong-direction_pair_NEW_against_the_baseline_fails_`--check`,_single_or_multi_destination::a_NEW_file_naming_ONE_instance_above_it_fails_—_the_single-destination_half_of_A.10
  Scenario: A new file naming one higher layer fails the check
    Given a baseline where only "low/a.md" names high
    When a tree that adds "low/b.md" naming mid is judged against it
    Then the exit code is 1
    And the added wrong-direction entries are exactly low/b.md -> mid

  @test:scripts/tests/kg/check-reference-direction.test.ts::A.10_—_a_wrong-direction_pair_NEW_against_the_baseline_fails_`--check`,_single_or_multi_destination::a_NEW_file_naming_SEVERAL_instances_above_it_fails,_one_new_entry_per_target
  Scenario: A new file naming several higher layers fails with one entry per target
    Given a baseline where only "low/a.md" names high
    When a tree that adds "low/c.md" naming mid and high is judged against it
    Then the exit code is 1
    And the added wrong-direction entries are low/c.md -> high and low/c.md -> mid

  @test:scripts/tests/kg/check-reference-direction.test.ts::A.10_—_a_wrong-direction_pair_NEW_against_the_baseline_fails_`--check`,_single_or_multi_destination::a_KNOWN_file_naming_a_FURTHER_instance_fails_on_the_added_target_only
  Scenario: A known file naming a further higher layer fails on the added target only
    Given a baseline where "low/a.md" names high
    When a tree where "low/a.md" names high and mid is judged against it
    Then the exit code is 1
    And the added wrong-direction entries are exactly low/a.md -> mid

  @test:scripts/tests/kg/check-reference-direction.test.ts::A.10_—_a_wrong-direction_pair_NEW_against_the_baseline_fails_`--check`,_single_or_multi_destination::a_FIXED_pair_is_resolved,_never_a_failure_—_the_ratchet_only_tightens
  Scenario: A fixed pair is resolved, not a failure
    Given a baseline where "low/a.md" names mid and high
    When a tree where "low/a.md" names only mid is judged against it
    Then the exit code is 0
    And one pair is resolved

  @test:scripts/tests/kg/check-reference-direction.test.ts::A.10_—_a_wrong-direction_pair_NEW_against_the_baseline_fails_`--check`,_single_or_multi_destination::a_baseline_that_predates_the_family_is_UNKNOWN_for_it,_never_'every_pair_is_new'
  Scenario: A baseline without the wrong-direction family is unknown for it
    Given a baseline with its wrong-direction family removed
    When a tree adding "low/b.md" naming mid is judged against it
    Then the exit code is 0
    And the unknowns say it "carries no `wrong-direction` family"

  @test:scripts/tests/kg/check-reference-direction.test.ts::A.10_—_a_wrong-direction_pair_NEW_against_the_baseline_fails_`--check`,_single_or_multi_destination::no_baseline_at_all_is_UNKNOWN_and_not_gated_—_not_'no_new_findings'
  Scenario: No baseline at all is unknown and not gated
    Given an empty baseline directory
    When a tree where "low/b.md" names mid is judged against it
    Then the exit code is 0
    And the baseline state is not "hit"

  @test:scripts/tests/kg/check-reference-direction.test.ts::the_real_tree:_a_new_doc_naming_two_instances_above_it_makes_`--check`_exit_1::planted_under_cat-harness/docs/,_it_is_NEW_in_`wrong-direction`_against_a_baseline_of_the_same_tree_without_it
  Scenario: A planted doc in the real tree naming two higher layers is new in wrong-direction
    Given a doc planted under cat-harness/docs/ naming smart-base and who-iris
    And the real repository analysed once, then the planted file removed
    When a baseline built without the planted file is judged against itself
    Then the exit code is 0
    When the result with the planted file is judged against that baseline
    Then the exit code is 1
    And the added wrong-direction entries are the doc -> smart-base and the doc -> who-iris

  @test:scripts/tests/kg/check-reference-direction.test.ts::X4_—_Markdown_in_cat-harness_may_name_a_cat-harness-tools_script_(owner,_2026-10-11,_ruling_(ii))::a_skill's_command_line_naming_a_tools_script_is_exempt
  Scenario: A harness Markdown command line naming a tools script is exempt
    Given the layers cat-harness <- cat-harness-tools <- smart-base and the X4 exemption
    When skill lines such as "bun run cat-harness-tools/scripts/qa-refresh.ts --check" are classified from cat-harness to cat-harness-tools
    Then each is "exempt", including script paths under pipeline/ and archimate/scripts/
    And "bun run cat-harness-tools/scripts/mount-from-lock.ts" in "cat-harness/AGENTS.md" is "exempt"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X4_—_Markdown_in_cat-harness_may_name_a_cat-harness-tools_script_(owner,_2026-10-11,_ruling_(ii))::a_Windows_command_line_naming_a_tools_script_with_backslashes_is_exempt
  Scenario: A Windows command line naming a tools script with backslashes is exempt
    Given the layers cat-harness <- cat-harness-tools <- smart-base and the X4 exemption
    When ".\\cat-harness-tools\\scripts\\bootstrap.ps1" and a powershell setup.ps1 line are classified in the installation guide
    Then both are "exempt"
    And a backslashed path to a tools src/ file in a skill is "wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X4_—_Markdown_in_cat-harness_may_name_a_cat-harness-tools_script_(owner,_2026-10-11,_ruling_(ii))::FAILS_for_code_and_configuration_in_cat-harness_naming_the_same_script
  Scenario: Code and configuration in cat-harness naming a tools script are wrong-direction
    Given the layers cat-harness <- cat-harness-tools <- smart-base and the X4 exemption
    When the line "bun run cat-harness-tools/scripts/qa-refresh.ts --check" is classified in a .ts, a workflow .yml and a .json file
    Then each is "wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X4_—_Markdown_in_cat-harness_may_name_a_cat-harness-tools_script_(owner,_2026-10-11,_ruling_(ii))::FAILS_for_a_skill_naming_a_tools_path_that_is_not_a_script_or_a_command
  Scenario: A skill naming a tools path that is not a script is wrong-direction
    Given the layers cat-harness <- cat-harness-tools <- smart-base and the X4 exemption
    When skill lines naming "cat-harness-tools/src/core/handover-screen.ts", "cat-harness-tools/test/review-nav.e2e.ts" and the bare layer name are classified
    Then each is "wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X4_—_Markdown_in_cat-harness_may_name_a_cat-harness-tools_script_(owner,_2026-10-11,_ruling_(ii))::FAILS_when_a_script_on_the_line_sits_beside_a_non-script_mention_of_the_layer
  Scenario: A script beside a non-script mention of the layer is wrong-direction
    Given the layers cat-harness <- cat-harness-tools <- smart-base and the X4 exemption
    When a skill line naming "cat-harness-tools/scripts/gates.ts" and "cat-harness-tools/src/workflow/prov-record.ts" is classified
    Then it is "wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X4_—_Markdown_in_cat-harness_may_name_a_cat-harness-tools_script_(owner,_2026-10-11,_ruling_(ii))::FAILS_for_a_skill_naming_another_layer's_scripts,_and_outside_cat-harness
  Scenario: X4 does not cover another layer's scripts or files outside cat-harness
    Given the layers cat-harness <- cat-harness-tools <- smart-base and the X4 exemption
    When a skill line "bun run smart-base/scripts/dak-pdf.ts" is classified with smart-base as the target
    Then it is "wrong-direction"
    And a tools script command in "bootstrap/skills/x.md" is "wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X4_widened_—_a_harness_definition_may_POINT_at_its_tools_implementation_when_nothing_runs_it_(owner,_2026-10-14,_Q6_(a))::Markdown:_a_path_into_the_tools_layer's_code_is_a_pointer_—_src/,_pipeline/,_a_directory,_a_glob
  Scenario: A Markdown path into the tools layer's code is an exempt pointer
    Given the layers cat-harness <- cat-harness-tools <- smart-base and all four X4 exemptions
    When harness Markdown lines pointing at a src/ file, a pipeline/ directory, a types/*.d.ts glob and a "- cat-harness-tools/src/tools" item are classified
    Then each is "exempt"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X4_widened_—_a_harness_definition_may_POINT_at_its_tools_implementation_when_nothing_runs_it_(owner,_2026-10-14,_Q6_(a))::Markdown:_the_layer_named_beside_a_code_file,_and_a_parenthetical_wrapping_after_the_layer's_name
  Scenario: Markdown naming the layer beside a code file, or wrapping after its name, is exempt
    Given the layers cat-harness <- cat-harness-tools <- smart-base and all four X4 exemptions
    When "(cat-harness-tools `gen-folio-viz.ts`)" and a line ending "(cat-harness-tools" are classified in harness Markdown
    Then both are "exempt"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X4_widened_—_a_harness_definition_may_POINT_at_its_tools_implementation_when_nothing_runs_it_(owner,_2026-10-14,_Q6_(a))::Markdown:_a_script_beside_a_src_pointer_is_now_exempt_as_a_whole_line_(X4_alone_refused_it)
  Scenario: A script beside a src pointer is exempt as a whole line under the widened entries
    Given the layers cat-harness <- cat-harness-tools <- smart-base and all four X4 exemptions
    When a line naming "cat-harness-tools/scripts/gates.ts" and "cat-harness-tools/src/workflow/prov-record.ts" is classified with X4 alone
    Then it is "wrong-direction"
    And with all four entries it is "exempt"
    And a script-only command line is exempt by the original X4 entry

  @test:scripts/tests/kg/check-reference-direction.test.ts::X4_widened_—_a_harness_definition_may_POINT_at_its_tools_implementation_when_nothing_runs_it_(owner,_2026-10-14,_Q6_(a))::Markdown:_STILL_READ_when_the_mention_is_executed,_imported_or_loaded
  Scenario: Markdown that executes, imports or loads a tools file is still wrong-direction
    Given the layers cat-harness <- cat-harness-tools <- smart-base and all four X4 exemptions
    When harness Markdown lines running "bun test", "python3" or "node" on tools files, importing one, or naming one in args or inProcess are classified
    Then each is "wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X4_widened_—_a_harness_definition_may_POINT_at_its_tools_implementation_when_nothing_runs_it_(owner,_2026-10-14,_Q6_(a))::Markdown:_STILL_READ_for_the_layer_as_such,_its_tests_and_its_root_files
  Scenario: Markdown naming the layer as such, its tests or its root files is still wrong-direction
    Given the layers cat-harness <- cat-harness-tools <- smart-base and all four X4 exemptions
    When harness Markdown lines naming the bare layer, "cat-harness-tools/test/review-nav.e2e.ts", "cat-harness-tools/package.json" or a test file beside the layer are classified
    Then each is "wrong-direction"
    And a src pointer on a line that also says "maintained in cat-harness-tools" is "wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X4_widened_—_a_harness_definition_may_POINT_at_its_tools_implementation_when_nothing_runs_it_(owner,_2026-10-14,_Q6_(a))::TypeScript:_a_COMMENT_line_pointing_at_the_implementation_is_exempt
  Scenario: A TypeScript comment pointing at the implementation is exempt
    Given the layers cat-harness <- cat-harness-tools <- smart-base and all four X4 exemptions
    When "*", "//" and "/** */" comment lines in a cat-harness .ts file pointing at tools files are classified
    Then each is "exempt"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X4_widened_—_a_harness_definition_may_POINT_at_its_tools_implementation_when_nothing_runs_it_(owner,_2026-10-14,_Q6_(a))::TypeScript:_STILL_READ_for_code,_directives,_and_a_comment_naming_the_layer_as_such
  Scenario: TypeScript code, directives and comments naming the layer as such are wrong-direction
    Given the layers cat-harness <- cat-harness-tools <- smart-base and all four X4 exemptions
    When a .ts line with a shell command, a string path, an import, a triple-slash reference, a JSDoc import type, a comment naming the layer itself, or a comment saying "run by bun run" is classified
    Then each is "wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X4_widened_—_a_harness_definition_may_POINT_at_its_tools_implementation_when_nothing_runs_it_(owner,_2026-10-14,_Q6_(a))::JSON:_a_prose_field,_or_a_bare_array_element_that_is_a_sentence,_pointing_at_the_implementation_is_exempt
  Scenario: A JSON prose field or sentence element pointing at the implementation is exempt
    Given the layers cat-harness <- cat-harness-tools <- smart-base and all four X4 exemptions
    When "description", "requirement" and "_needs_comment" fields and a bare sentence array element pointing at tools files are classified in a cat-harness .json file
    Then each is "exempt"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X4_widened_—_a_harness_definition_may_POINT_at_its_tools_implementation_when_nothing_runs_it_(owner,_2026-10-14,_Q6_(a))::JSON:_STILL_READ_for_commands,_bare_paths_a_tool_reads,_and_keys_that_are_not_prose
  Scenario: JSON commands, bare paths and non-prose keys are wrong-direction
    Given the layers cat-harness <- cat-harness-tools <- smart-base and all four X4 exemptions
    When .json lines with a "command" or "module" key, a bare path element, a bare command element, or a prose field followed by a "run" field are classified
    Then each is "wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X4_widened_—_a_harness_definition_may_POINT_at_its_tools_implementation_when_nothing_runs_it_(owner,_2026-10-14,_Q6_(a))::only_cat-harness_→_cat-harness-tools,_and_only_the_file_types_each_entry_names
  Scenario: The widened exemption covers only cat-harness to cat-harness-tools in the named file types
    Given the layers cat-harness <- cat-harness-tools <- smart-base and all four X4 exemptions
    When a pointer in "bootstrap/skills/x.md", a pointer to smart-base, a comment in a workflow .yml, and a prose field in a .jsonld file are classified
    Then each is "wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X4_widened_—_a_harness_definition_may_POINT_at_its_tools_implementation_when_nothing_runs_it_(owner,_2026-10-14,_Q6_(a))::each_exemption_is_counted_on_its_own_line,_the_widened_entries_included
  Scenario: Each X4 exemption is counted on its own line
    Given two verdicts exempt by the Markdown pointer entry and one by the JSON pointer entry
    When the exemptions are counted
    Then the Markdown entry counts 2 and the JSON entry 1
    And the TypeScript entry and the dated-proposal entry count 0
    And there is one count per declared exemption

  @test:scripts/tests/kg/check-reference-direction.test.ts::X5_—_a_dated_proposal_record_may_name_the_layers_it_was_written_about_(owner,_2026-10-14,_Q1)::a_dated_record_under_docs/proposals/_is_exempt,_whichever_layer_it_names_and_whatever_the_line_says
  Scenario: A dated record under docs/proposals/ is exempt whichever layer it names
    Given the layers cat-harness <- cat-harness-tools <- smart-base and the dated-proposal exemption
    When "cat-harness/docs/proposals/checkout-layout-2026-10-12.md" names smart-base or cat-harness-tools
    Then both are "exempt"
    And a dated .json record and a dated record in cat-harness-tools/docs/proposals/ are "exempt"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X5_—_a_dated_proposal_record_may_name_the_layers_it_was_written_about_(owner,_2026-10-14,_Q1)::FAILS_for_the_undated_pages_beside_the_records_—_the_index_and_living_proposals_are_edited,_so_they_are_read
  Scenario: Undated pages beside the records are wrong-direction
    Given the layers cat-harness <- cat-harness-tools <- smart-base and the dated-proposal exemption
    When index.md, README.md and instance-versioning.md under docs/proposals/ name smart-base
    Then each is "wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X5_—_a_dated_proposal_record_may_name_the_layers_it_was_written_about_(owner,_2026-10-14,_Q1)::FAILS_for_a_date_that_is_not_at_the_end_of_the_name,_or_is_not_a_date
  Scenario: A date not at the end of the name, or not a real date, is wrong-direction
    Given the layers cat-harness <- cat-harness-tools <- smart-base and the dated-proposal exemption
    When files named "2026-10-12-checkout-layout.md", "checkout-layout-2026-10-12-draft.md" and "checkout-layout-2026-13-40.md" name smart-base
    Then each is "wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X5_—_a_dated_proposal_record_may_name_the_layers_it_was_written_about_(owner,_2026-10-14,_Q1)::FAILS_outside_docs/proposals/,_in_a_sub-directory_of_it,_and_for_a_file_type_a_record_is_not_written_in
  Scenario: A dated name outside docs/proposals/, in a sub-directory, or of the wrong type is wrong-direction
    Given the layers cat-harness <- cat-harness-tools <- smart-base and the dated-proposal exemption
    When dated files under docs/requirements/, docs/proposals/old/, a bare proposals/ directory, and a dated .ts file name smart-base
    Then each is "wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X5_index_—_a_generated_index's_row_for_a_dated_record_is_read_as_the_record_(owner,_2026-10-16,_item_6a)::a_row_listing_a_dated_record_is_exempt,_carrying_the_index_reason
  Scenario: A generated index row listing a dated record is exempt
    Given "low/docs/proposals/README.md" is a generated sub-graph index with a row for "high-split-2026-10-01.md"
    When the tree is analysed
    Then the table row is "exempt"
    And it carries the reason "X5 applied to the generated INDEX"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X5_index_—_a_generated_index's_row_for_a_dated_record_is_read_as_the_record_(owner,_2026-10-16,_item_6a)::FAILS_for_the_page's_prose_and_for_a_row_listing_an_undated_proposal
  Scenario: The index prose and a row for an undated proposal are wrong-direction
    Given the generated index lists only "high-notes.md"
    When the tree is analysed
    Then both the prose line and the row are "wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X5_index_—_a_generated_index's_row_for_a_dated_record_is_read_as_the_record_(owner,_2026-10-16,_item_6a)::FAILS_when_the_file_does_not_declare_itself_the_generator's_index_—_the_same_row,_hand-written
  Scenario: A hand-written index with the same row is wrong-direction
    Given the index with its sub-graph begin marker removed
    When it is tested as a sub-graph index
    Then it is not one
    And every verdict is "wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X5_index_—_a_generated_index's_row_for_a_dated_record_is_read_as_the_record_(owner,_2026-10-16,_item_6a)::FAILS_for_a_generated_index_outside_the_records'_directory
  Scenario: A generated index outside docs/proposals/ is wrong-direction
    Given the generated index with the dated row placed at "low/docs/requirements/README.md"
    When it is tested as a sub-graph index
    Then it is one
    And every verdict is "wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X5_index_—_a_generated_index's_row_for_a_dated_record_is_read_as_the_record_(owner,_2026-10-16,_item_6a)::the_row_must_link_the_dated_name_to_itself,_in_the_generator's_shape
  Scenario: An index row must link the dated name to itself in the generator's shape
    Given the layers cat-harness <- smart-base and the index-row exemption
    When rows linking a dated .md or .json record to itself in "cat-harness/docs/proposals/README.md" are classified
    Then each is "exempt"
    And a row linking elsewhere is "wrong-direction"
    And a row in "docs/proposals/old/README.md" is "wrong-direction"
    And prose quoting a row mid-line is "wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::X5_index_—_a_generated_index's_row_for_a_dated_record_is_read_as_the_record_(owner,_2026-10-16,_item_6a)::it_is_counted_on_its_own_line
  Scenario: The index-row exemption is counted on its own line
    Given one verdict exempt by the index-row entry
    When the exemptions are counted
    Then the index-row entry counts 1
    And there is one count per declared exemption

  @test:scripts/tests/kg/check-reference-direction.test.ts::3a_—_a_workflow_`uses:`_names_the_repository_a_reusable_workflow_lives_in,_not_a_layer_(owner,_2026-10-15)::the_reusable-workflow_caller_each_lower_layer_carries_is_exempt
  Scenario: The reusable-workflow caller in each lower layer is exempt
    Given the layers bootstrap <- cat-harness <- cat-harness-tools and the workflow uses: exemption
    When "uses: litlfred/cat-harness-tools/.github/workflows/layer-pr-checks.yml@main" is classified in cat-harness, bootstrap and bootstrap-tools workflow files
    Then each is "exempt"
    And in the repository root's ".github/workflows/ci.yml" it is "exempt"

  @test:scripts/tests/kg/check-reference-direction.test.ts::3a_—_a_workflow_`uses:`_names_the_repository_a_reusable_workflow_lives_in,_not_a_layer_(owner,_2026-10-15)::an_action_address_is_exempt_too:_as_a_step,_quoted,_at_a_SHA,_with_a_path,_with_a_version_comment
  Scenario: An action address in uses: is exempt in its common forms
    Given the layers bootstrap <- cat-harness <- cat-harness-tools and the workflow uses: exemption
    When uses: lines as a step, double- or single-quoted, at a SHA with a version comment, with a path, and at "refs/heads/main" are classified
    Then each is "exempt"

  @test:scripts/tests/kg/check-reference-direction.test.ts::3a_—_a_workflow_`uses:`_names_the_repository_a_reusable_workflow_lives_in,_not_a_layer_(owner,_2026-10-15)::FAILS_for_a_`run:`_that_executes_the_higher_layer's_scripts,_and_for_every_other_key
  Scenario: A run: of the higher layer's scripts and every other key are wrong-direction
    Given the layers bootstrap <- cat-harness <- cat-harness-tools and the workflow uses: exemption
    When "run:", "- run:", "path:", "repository:", "tools-ref:" and "name: uses: ..." lines naming cat-harness-tools are classified
    Then each is "wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::3a_—_a_workflow_`uses:`_names_the_repository_a_reusable_workflow_lives_in,_not_a_layer_(owner,_2026-10-15)::FAILS_for_a_comment,_even_one_that_quotes_a_`uses:`_line
  Scenario: A comment, even one quoting a uses: line, is wrong-direction
    Given the layers bootstrap <- cat-harness <- cat-harness-tools and the workflow uses: exemption
    When "# The checks themselves live in cat-harness-tools" and a commented-out uses: line are classified
    Then both are "wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::3a_—_a_workflow_`uses:`_names_the_repository_a_reusable_workflow_lives_in,_not_a_layer_(owner,_2026-10-15)::FAILS_when_the_value_is_not_a_remote_address,_or_carries_more_than_one
  Scenario: A uses: value that is not a single remote address is wrong-direction
    Given the layers bootstrap <- cat-harness <- cat-harness-tools and the workflow uses: exemption
    When a local "./cat-harness-tools/..." action or workflow, a docker:// image, an address with no ref, an address with a non-version trailing comment, and unbalanced quotes are classified
    Then each is "wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::3a_—_a_workflow_`uses:`_names_the_repository_a_reusable_workflow_lives_in,_not_a_layer_(owner,_2026-10-15)::FAILS_outside_a_`.github/workflows/`_file:_Markdown_quoting_it,_an_action.yml,_a_template,_a_nested_directory
  Scenario: The uses: line outside a .github/workflows/ YAML file is wrong-direction
    Given the layers bootstrap <- cat-harness <- cat-harness-tools and the workflow uses: exemption
    When the reusable-workflow caller is classified in a Markdown skill, an action.yml, a template workflow, a nested workflows/old/ file and a workflows .json file
    Then each is "wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::3a_—_a_workflow_`uses:`_names_the_repository_a_reusable_workflow_lives_in,_not_a_layer_(owner,_2026-10-15)::it_is_counted_on_its_own_line
  Scenario: The workflow uses: exemption is counted on its own line
    Given two verdicts exempt by the workflow uses: entry and one by the dated-proposal entry
    When the exemptions are counted
    Then the workflow entry counts 2 and the dated-proposal entry 1
    And there is one count per declared exemption

  @test:scripts/tests/kg/check-reference-direction.test.ts::ruling_(i)_—_a_baseline_pair_on_a_MOVED_file_is_compared_at_the_file's_new_path::between_layers:_the_old_path_is_gone_and_exactly_one_other_instance_holds_the_same_path
  Scenario: A file moved between layers is found at the same path in the one other layer holding it
    Given only "cat-harness-tools/scripts/a.ts" exists
    When the move target of "cat-harness/scripts/a.ts" is sought
    Then it is "cat-harness-tools/scripts/a.ts"

  @test:scripts/tests/kg/check-reference-direction.test.ts::ruling_(i)_—_a_baseline_pair_on_a_MOVED_file_is_compared_at_the_file's_new_path::a_declared_visualiser_page:_from_its_alias_or_forwarding_address_to_its_localised_route
  Scenario: A declared visualiser page moves from its alias or forwarding address to its localised route
    Given "cat-harness/docs/en/cat-harness/processes/p.md" exists and is the declared route for two older prefixes
    When the move targets of "cat-harness/docs/processes/p.md" and "cat-harness/docs/cat-harness/processes/p.md" are sought
    Then both are the localised route

  @test:scripts/tests/kg/check-reference-direction.test.ts::ruling_(i)_—_a_baseline_pair_on_a_MOVED_file_is_compared_at_the_file's_new_path::FAILS_to_re-key_when_the_old_path_still_exists_—_a_file_re-created_at_its_home_is_a_different_file
  Scenario: A file whose old path still exists is not re-keyed
    Given both "cat-harness/scripts/a.ts" and "cat-harness-tools/scripts/a.ts" exist
    When the move target of "cat-harness/scripts/a.ts" is sought
    Then there is none

  @test:scripts/tests/kg/check-reference-direction.test.ts::ruling_(i)_—_a_baseline_pair_on_a_MOVED_file_is_compared_at_the_file's_new_path::FAILS_to_re-key_when_nothing_exists_at_a_new_path,_or_when_two_places_could_be_it
  Scenario: A file with no new path, or two candidate paths, is not re-keyed
    Given nothing exists, or both cat-harness-tools and smart-base hold "scripts/a.ts"
    When the move target of "cat-harness/scripts/a.ts" is sought
    Then there is none in either case

  @test:scripts/tests/kg/check-reference-direction.test.ts::ruling_(i)_—_a_baseline_pair_on_a_MOVED_file_is_compared_at_the_file's_new_path::end_to_end:_an_inherited_pair_on_a_moved_file_passes;_a_NEW_target_on_it_still_fails
  Scenario: An inherited pair on a moved file passes while a new target on it fails
    Given a baseline pair "cat-harness/scripts/a.ts" -> smart-base and evidence that the file moved to cat-harness-tools
    When the pair at the new path is judged without re-keying
    Then the exit code is 1
    When it is judged with the baseline re-keyed by the move
    Then the exit code is 0
    When the moved file also names who-iris
    Then the exit code is 1 and the only added entry is the moved file -> who-iris

  @test:scripts/tests/kg/check-reference-direction.test.ts::a_sub-graph's_machine-written_directories,_declared_from_within,_are_not_read::cat-harness's_corpus_under_library/graph.json_is_excluded_like_a_top-level_library_entry
  Scenario: A sub-graph's machine-written directory declared in library/graph.json is excluded
    Given "library/graph.json" declares "corpus/" holding the "library" typology and "skills/" holding "skills"
    When the sub-graph machine-written directories are derived for the directories library/ and skills/
    Then they are exactly "library/corpus/"
    And with library/graph.json removed there are none

  @test:scripts/tests/kg/check-reference-direction.test.ts::bean_tdir_—_a_baseline_pair_on_tools/index.ts_is_compared_at_the_Tool's_folder_file::from_index.ts_to_the_one_tools/<id>/<id>.ts_naming_the_same_target
  Scenario: A pair on tools/index.ts is re-keyed to the one Tool folder file naming the same target
    Given a baseline pair "fhir-harness/tools/index.ts" -> smart-trust
    And a fresh pair "fhir-harness/tools/ig-ast/ig-ast.ts" -> smart-trust
    When the baseline is re-keyed for Tool splits
    Then one pair is re-keyed
    And the baseline file is now "fhir-harness/tools/ig-ast/ig-ast.ts"

  @test:scripts/tests/kg/check-reference-direction.test.ts::bean_tdir_—_a_baseline_pair_on_tools/index.ts_is_compared_at_the_Tool's_folder_file::from_tools/<id>.ts_only_to_that_id's_folder
  Scenario: A pair on tools/<id>.ts is re-keyed only to that id's folder
    Given a baseline pair "core/tools/vocab-map.ts" -> who-iris
    When it is re-keyed against "core/tools/vocab-map/vocab-map.ts"
    Then one pair is re-keyed
    And against "core/tools/other/other.ts" none is

  @test:scripts/tests/kg/check-reference-direction.test.ts::bean_tdir_—_a_baseline_pair_on_tools/index.ts_is_compared_at_the_Tool's_folder_file::FAILS_to_re-key_when_the_old_pair_still_holds,_the_target_differs,_or_two_folders_could_be_it
  Scenario: A Tool-split pair is not re-keyed when ambiguous or not a match
    Given a baseline pair "x/tools/index.ts" -> smart-base
    When the fresh pairs still hold the old pair, name a different target, offer two folder files, or a file not named after its folder
    Then no pair is re-keyed in each case

  @test:scripts/tests/kg/check-reference-direction.test.ts::an_instance's_uploads/_is_its_data_store,_not_a_reference_(owner,_2026-11-03)::an_intake_under_<instance>/uploads/_naming_a_higher_instance_is_exempt,_with_the_ruling_as_its_reason
  Scenario: An intake under a layer's uploads/ naming a higher layer is exempt
    Given the uploads data-store exemption
    When "basis: cited by high/scripts/x.ts" in "low/uploads/item/intake.json" is classified from low to high
    Then the verdict is "exempt"
    And its basis mentions "data store"

  @test:scripts/tests/kg/check-reference-direction.test.ts::an_instance's_uploads/_is_its_data_store,_not_a_reference_(owner,_2026-11-03)::the_same_text_outside_uploads/_is_still_wrong-direction
  Scenario: The same text outside uploads/ is wrong-direction
    Given the uploads data-store exemption
    When "basis: cited by high/scripts/x.ts" in "low/library/item/manifest.jsonld" is classified from low to high
    Then the verdict is "wrong-direction"

  @test:scripts/tests/kg/check-reference-direction.test.ts::a_provenance_log_quotes_where_a_rule_came_from,_not_a_reference_(owner,_2026-11-05)::a_<document>.prov.jsonld_naming_a_higher_instance_is_exempt,_with_the_ruling_as_its_reason
  Scenario: A .prov.jsonld provenance log naming a higher layer is exempt
    Given the provenance-log exemption
    When a quote naming high in "low/skills/kg/x.prov.jsonld" is classified from low to high
    Then the verdict is "exempt"
    And its basis mentions "PROVENANCE LOG"

  @test:scripts/tests/kg/check-reference-direction.test.ts::a_provenance_log_quotes_where_a_rule_came_from,_not_a_reference_(owner,_2026-11-05)::the_same_text_in_the_document_itself_is_still_wrong-direction
  Scenario: The same text in the document itself is wrong-direction
    Given the provenance-log exemption
    When the same quote in "low/skills/kg/x.jsonld" is classified from low to high
    Then the verdict is "wrong-direction"
