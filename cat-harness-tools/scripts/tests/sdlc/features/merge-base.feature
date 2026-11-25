# The declared merge-conflict patterns (scripts/merge-conflict-patterns.ts) and the resolver in
# scripts/merge-base.ts: classifying conflicted paths, resolving generated regions, take-base,
# owned-tree and submodule gitlinks, and refusing any merge that drops a path. Each Scenario names the test that executes it.
Feature: Merge-conflict patterns and the base-side resolver

  @test:scripts/tests/sdlc/merge-base.test.ts::generated-page_globs_come_from_the_declared_visualisers,_not_instance_names::a_glossary_visualiser_yields_its_route,_English_and_per_locale
  Scenario: A glossary visualiser yields its route, in English and per locale
    Given a checkout whose layer "acme" declares a glossary visualiser "terms" and another visualiser
    When the route globs for glossary visualisers are derived
    Then the English glob is "cat-harness/docs/acme/terms/**"
    And with locales "{ar,es}" and file "index.md" the glob is "cat-harness/docs/{ar,es}/acme/terms/index.md"

  @test:scripts/tests/sdlc/merge-base.test.ts::generated-page_globs_come_from_the_declared_visualisers,_not_instance_names::a_catalogue_visualiser_yields_its_route;_a_checkout_declaring_none_yields_no_glob
  Scenario: A catalogue visualiser yields its route, and a checkout declaring none yields no glob
    Given a checkout whose layer "acme" declares the catalogue visualiser
    And a checkout whose layer declares no visualisers
    When the route globs for the catalogue visualiser are derived
    Then the first yields "cat-harness/docs/acme/catalogue/**"
    And the second yields no glob

  @test:scripts/tests/sdlc/merge-base.test.ts::generated-page_globs_come_from_the_declared_visualisers,_not_instance_names::standing_alone,_the_routes_come_from_the_generated_pages_the_harness_site_holds
  Scenario: Standing alone, routes come from the generated pages the harness site holds
    Given no layer declaring visualisers, but a harness site with a generated glossary page at "acme/terms", a rendered catalogue page at "acme/catalogue" and an authored page at "acme/notes"
    When the route globs are derived
    Then the glossary glob is "cat-harness/docs/acme/terms/**"
    And the catalogue glob is "cat-harness/docs/acme/catalogue/**"
    And the authored "notes" page yields no glob

  @test:scripts/tests/sdlc/merge-base.test.ts::generated-page_globs_come_from_the_declared_visualisers,_not_instance_names::standing_alone,_a_page_under_the_page_locale_records_its_route_too
  Scenario: Standing alone, a generated page under the page locale records its route
    Given a harness site with a generated glossary page at "en/acme/terms/index.md"
    When the glossary route globs are derived for locale "en"
    Then the glob is "cat-harness/docs/en/acme/terms/**"

  @test:scripts/tests/sdlc/merge-base.test.ts::generated-page_globs_come_from_the_declared_visualisers,_not_instance_names::a_translated_glossary_page_other_than_the_generated_index_stays_refused
  Scenario: Only the generated index of a translated glossary is covered
    Given the "translated-glossary" pattern
    Then every one of its globs ends in "/index.md"

  @test:scripts/tests/sdlc/merge-base.test.ts::classify::measured_generated_families_resolve_by_their_declared_strategy
  Scenario: Measured generated families resolve by their declared strategy
    When paths from the measured generated families are classified
    Then a qa-results file is "qa-results"
    And an lsi sidecar is taken from the base
    And a translation-qa file is "derived-results", taken from the base
    And an auto-docs page is "auto-docs"
    And "beans/README.md" resolves by generated regions

  @test:scripts/tests/sdlc/merge-base.test.ts::classify::the_content_core's_generated_glossary_is_taken,_under_the_page_locale_and_at_its_old_address
  Scenario: The content core's generated glossary is taken under the page locale and at its old address
    # Skipped: when the content core's glossary route is absent from the checkout
    When the core glossary index and an instance page under "en/", and the old index address, are classified
    Then each is pattern "glossary"

  @test:scripts/tests/sdlc/merge-base.test.ts::classify::the_three_generated_glossary/skill_families_classify,_and_their_carry-forward_neighbours_do_not
  Scenario: The generated SKOS export, glossary and skill instruction families classify
    # Gap: the carry-forward neighbours are not checked in this test
    When a SKOS export, a generated glossary JSON and a skill instruction page are classified
    Then they are "skos-glossary-export", "glossary-generated" and "skill-instructions"

  @test:scripts/tests/sdlc/merge-base.test.ts::classify::the_glossary_LEDGER_is_refused:_it_is_the_one_artefact_that_carries_forward
  Scenario: The glossary ledger is refused because it carries forward
    When the glossary ledger at the root and under "bootstrap/" is classified
    Then each is refused

  @test:scripts/tests/sdlc/merge-base.test.ts::classify::a_skill_SOURCE_is_refused_while_its_generated_instruction_page_is_taken
  Scenario: A skill source is refused while its generated instruction page is taken
    When the generated instruction page for "merge-conflict-patterns" is classified
    Then it is taken from the base
    And the authored skill source is refused

  @test:scripts/tests/sdlc/merge-base.test.ts::classify::every_generated_docs_page_classifies_to_`docs-pages`_—_read_from_the_tree,_not_listed
  Scenario: Every generated docs page classifies to docs-pages, read from the tree
    Given every markdown page under the harness site whose own front matter names gen-docs-pages.ts as its writer
    Then there are at least 8 of them
    And every one classifies to "docs-pages"
    And "docs/process/publication-workflow.md" and "docs/guides/writing-a-paper.md" classify to "docs-pages"

  @test:scripts/tests/sdlc/merge-base.test.ts::classify::the_AUTHORED_source_a_docs_page_is_generated_from_is_refused,_and_so_are_its_authored_siblings
  Scenario: The authored source of a docs page and its authored siblings are refused
    When an authored block under "docs/source/" is classified
    Then it is refused
    And the authored pages architecture, getting-started, the docs index, agent-onboarding and voices are each refused
    And no generated docs page lies under a "content/" directory

  @test:scripts/tests/sdlc/merge-base.test.ts::classify::the_page_that_QUOTES_the_generated_marker_really_quotes_it
  Scenario: The skill-instructions page really quotes the generated marker
    # Skipped: when the gitignored skill-instructions page has not been built
    Given the built skill-instructions page for merge-conflict-patterns
    Then its text contains "generated: scripts/gen-docs-pages.ts"

  @test:scripts/tests/sdlc/merge-base.test.ts::classify::a_page_that_QUOTES_the_generated_marker_is_not_a_subject_of_it
  Scenario: A page that quotes the generated marker is not a docs-pages subject
    Given the skill-instructions page for merge-conflict-patterns
    Then it is not among the generated docs pages found by front matter
    And it classifies as "skill-instructions"

  @test:scripts/tests/sdlc/merge-base.test.ts::classify::site-data_still_owns_docs/assets_JSON:_the_new_SKOS_entry_did_not_widen_it
  Scenario: site-data still owns docs/assets JSON
    When "cat-harness/docs/assets/library/index.json" is classified
    Then it is "site-data"

  @test:scripts/tests/sdlc/merge-base.test.ts::classify::a_kg-qa_sidecar_is_taken;_the_attestation_store_beside_it_is_refused_(bean_7mwa)
  Scenario: A kg-qa sidecar is taken while the attestation store beside it is refused
    When a kg-qa sidecar under "test/results/" is classified
    Then it is "derived-results"
    And an attestations file under "test/attestations/" is refused

  @test:scripts/tests/sdlc/merge-base.test.ts::classify::a_kg-qa_MANIFEST_is_taken,_like_the_sidecars_it_indexes
  Scenario: A kg-qa manifest is taken like the sidecars it indexes
    When kg-qa manifests in fhir-harness and under cat-harness "test/results/bootstrap/" are classified
    Then each is "kg-qa-manifest"

  @test:scripts/tests/sdlc/merge-base.test.ts::classify::the_content_core's_translated_glossaries_are_taken
  Scenario: The content core's translated glossaries are taken
    # Skipped: when the content core's glossary route is absent from the checkout
    When the core glossary index under each of "ar", "es", "fr", "ru" and "zh" is classified
    Then each is "translated-glossary"

  @test:scripts/tests/sdlc/merge-base.test.ts::classify::viewer_pages_are_taken;_their_authored_neighbours_are_not
  Scenario: Viewer pages are taken and their authored neighbours are not
    When generated viewer pages (external-schemas, processes, translation-status, methodologies, qa) are classified
    Then each is "viewer-pages"
    And the fsh-guts viewer page has no pattern, and the fsh-guts archive and other pages are refused
    And "published-graphs.md" is "handler-index" and the repository health report is "health-report"
    And a qa witness is "qa-witnesses" and a ".pot" template is "pot-templates"
    And a methodology page, the health producer, a ".po" translation, authored translated pages and a "de" glossary are refused

  @test:scripts/tests/sdlc/merge-base.test.ts::classify::the_PROV-O_report_is_taken;_the_workflow_instances_it_is_derived_FROM_are_refused
  Scenario: The PROV-O report is taken while the workflow instances it derives from are refused
    When the prov-qaqc index and a ".prov.jsonld" asset are classified, in cat-harness and in who-iris
    Then each is "prov-qaqc"
    And a workflow instance under "beans/workflows/" is refused
    And the prov-qaqc generator script is refused

  @test:scripts/tests/sdlc/merge-base.test.ts::classify::artefact-verification.json_refuses_BY_NAME,_which_an_unclassified_path_does_not
  Scenario: artefact-verification.json refuses by name, unlike an unclassified path
    When "cat-harness/scripts/artefact-verification.json" is classified
    Then it is refused with pattern "artefact-verification"
    And an unclassified script beside it is refused with no pattern

  @test:scripts/tests/sdlc/merge-base.test.ts::classify::generated_VIEWERS_of_uploads/_are_taken;_uploads/_itself_stays_refused
  Scenario: Generated viewers of uploads/ are taken while uploads/ itself stays refused
    When viewer pages for the uploads queue, beans, todos, health, issue-marks and swimlane-glossary are classified
    Then each is "viewer-pages"
    And the uploads, folio, library, schemas and voices pages are "viewer-namespace"
    And the generated navbar footer is "navbar-include" and the viewer-nav QA file is "viewer-nav-qa"
    And real uploads at the root and in a layer are "uploads"
    And an authored beans note and an authored site-chrome include are refused

  @test:scripts/tests/sdlc/merge-base.test.ts::classify::a_folio's_generated_catalogue_viewer_is_in_the_viewer_namespace
  Scenario: A folio's generated catalogue viewer is in the viewer namespace
    # Skipped: when who-iris's catalogue route is absent from the checkout
    When "cat-harness/docs/who-iris/catalogue/index.html" is classified
    Then it is "viewer-namespace"

  @test:scripts/tests/sdlc/merge-base.test.ts::classify::the_standalone_baseline_is_taken_from_the_base;_its_sibling_baseline_and_its_writer_are_not
  Scenario: The standalone baseline is taken from the base; its sibling baseline and writer are not
    When "cat-harness-tools/scripts/standalone-baseline.json" is classified
    Then it is "standalone-baseline", taken from the base
    And "declared-path-baseline.json" and "check-standalone.ts" are refused

  @test:scripts/tests/sdlc/merge-base.test.ts::classify::a_path_no_pattern_names_is_REFUSED,_with_no_pattern_attached
  Scenario: A path no pattern names is refused with no pattern attached
    When "cat-harness/scripts/merge-base.ts" is classified
    Then it is refused
    And it carries no pattern

  @test:scripts/tests/sdlc/merge-base.test.ts::classify::authored_families_are_refused_BY_DECLARATION,_with_the_reason
  Scenario: Authored families are refused by declaration, with the reason
    When a bean definition file is classified
    Then it is refused
    And its pattern's reason contains "Authored"

  @test:scripts/tests/sdlc/merge-base.test.ts::classify::every_pattern_says_why
  Scenario: Every pattern says why
    Given every declared pattern
    Then each reason is longer than 20 characters

  @test:scripts/tests/sdlc/merge-base.test.ts::plan_is_all-or-nothing_input::one_authored_conflict_among_generated_ones_is_reported_as_refused
  Scenario: One authored conflict among generated ones is reported as refused
    Given conflicts on a generated lsi page and on "cat-harness/scripts/merge-base.ts"
    When the resolution is planned
    Then the generated page is resolvable
    And the script is refused

  @test:scripts/tests/sdlc/merge-base.test.ts::resolveGeneratedRegions::a_hunk_inside_a_generated_region_takes_the_base_side;_authored_text_survives
  Scenario: A hunk inside a generated region takes the base side and authored text survives
    Given a README whose generated region holds a conflict between "1150 files" and "1151 files"
    When its generated regions are resolved
    Then the result holds the base's "1151 files" and not "1150"
    And the authored prose is kept
    And no conflict marker is left

  @test:scripts/tests/sdlc/merge-base.test.ts::resolveGeneratedRegions::diff3_style_(a_|||||||_base_section)_resolves_the_same_way
  Scenario: A diff3-style conflict resolves the same way
    Given a generated-region conflict with a "|||||||" common-ancestor section
    When its generated regions are resolved
    Then the result holds the base side "| a | 3 |"

  @test:scripts/tests/sdlc/merge-base.test.ts::resolveGeneratedRegions::a_hunk_in_AUTHORED_text_is_refused
  Scenario: A hunk in authored text is refused
    Given a conflict in prose outside any generated region
    When its generated regions are resolved
    Then there is no result

  @test:scripts/tests/sdlc/merge-base.test.ts::resolveGeneratedRegions::a_hunk_that_moves_a_region_boundary_is_refused:_structure,_not_content
  Scenario: A hunk that moves a region boundary is refused
    Given a conflict whose one side includes the region's end marker
    When its generated regions are resolved
    Then there is no result

  @test:scripts/tests/sdlc/merge-base.test.ts::resolveGeneratedRegions::an_unterminated_conflict_block_is_refused
  Scenario: An unterminated conflict block is refused
    Given a generated-region conflict with no closing marker
    When its generated regions are resolved
    Then there is no result

  @test:scripts/tests/sdlc/merge-base.test.ts::resolveGeneratedRegions::a_file_with_no_conflict_comes_back_unchanged
  Scenario: A file with no conflict comes back unchanged
    Given a README with no conflict
    When its generated regions are resolved
    Then the text is returned unchanged

  @test:scripts/tests/sdlc/merge-base.test.ts::take-base_when_one_side_deleted_the_file::the_stage_set_decides:_no_stage_3_means_the_base_deleted_it
  Scenario: The stage set decides the take-base action
    When the take-base action is read for stages 1 and 2
    Then it is "delete"
    And for stages 1 and 3, or 1, 2 and 3, it is "theirs"

  @test:scripts/tests/sdlc/merge-base.test.ts::take-base_when_one_side_deleted_the_file::deleted_by_the_base:_the_deletion_is_taken,_not_a_throw
  Scenario: A file the base deleted is deleted, not a throw
    Given a merge where the branch changed "gen.html" and main deleted it
    Then its unmerged stages are 1 and 2
    When the base side is taken
    Then "gen.html" is gone
    And no path is left unmerged

  @test:scripts/tests/sdlc/merge-base.test.ts::take-base_when_one_side_deleted_the_file::deleted_on_the_branch,_changed_on_the_base:_the_base's_copy_is_taken
  Scenario: A file deleted on the branch and changed on the base takes the base's copy
    Given a merge where the branch deleted "gen.html" and main changed it
    Then its unmerged stages are 1 and 3
    When the base side is taken
    Then "gen.html" holds main's content
    And no path is left unmerged

  @test:scripts/tests/sdlc/merge-base.test.ts::take-base_when_one_side_deleted_the_file::an_already-resolved_path_(no_stages)_is_left_alone,_never_deleted_—_bean_vsv7
  Scenario: An already-resolved path is left alone, never deleted
    Given no unmerged stages, the take-base action is "resolved"
    And a modify/delete merge whose "gen.html" was resolved and staged by an earlier step
    When the base side is taken
    Then "gen.html" still holds the earlier resolution

  @test:scripts/tests/sdlc/merge-base.test.ts::modify/delete_on_DECLARED_paths:_generated_resolves,_authored_refuses_(#1854)::the_generated_page_takes_main's_deletion;_the_bean_is_refused
  Scenario: On declared paths a generated page takes main's deletion and the bean is refused
    Given a merge where main deleted an auto-docs page and a bean the branch edited
    Then both paths are conflicted
    When the resolution is planned
    Then the auto-docs page is resolvable under "auto-docs"
    And the bean is refused under "beans"
    When the resolvable paths take the base side
    Then the auto-docs page is gone
    And only the bean is left unmerged

  @test:scripts/tests/sdlc/merge-base.test.ts::a_merge_never_drops_a_path_neither_side_deleted_(beans_vsv7,_8j9e)::a_path_on_both_parents_and_absent_from_the_result_is_reported
  Scenario: A path on both parents and absent from the result is reported
    Given base, ours and theirs all holding "a" and "b", and a result holding only "a"
    When the dropped paths are computed
    Then "b" is reported, held by both
    And "c", which theirs deleted since the base, is not

  @test:scripts/tests/sdlc/merge-base.test.ts::a_merge_never_drops_a_path_neither_side_deleted_(beans_vsv7,_8j9e)::a_side's_DELETION_since_the_merge_base_may_be_taken,_from_either_side
  Scenario: A side's deletion since the merge base may be taken from either side
    Given a path the branch deleted and another main deleted since the merge base
    When the dropped paths are computed
    Then none are reported

  @test:scripts/tests/sdlc/merge-base.test.ts::a_merge_never_drops_a_path_neither_side_deleted_(beans_vsv7,_8j9e)::a_path_one_side_ADDED_is_not_a_deletion,_and_dropping_it_is_refused_(8j9e)
  Scenario: A path one side added is not a deletion, and dropping it is refused
    Given a path added on the branch and another added on main, both absent from the result
    When the dropped paths are computed
    Then the branch's is reported as held by ours and main's as held by theirs

  @test:scripts/tests/sdlc/merge-base.test.ts::a_merge_never_drops_a_path_neither_side_deleted_(beans_vsv7,_8j9e)::no_merge_base_(empty)_refuses_every_dropped_path:_stricter,_never_looser
  Scenario: With no merge base every dropped path is refused
    Given an empty merge base and a path "x" only ours holds
    When the dropped paths are computed
    Then "x" is reported

  @test:scripts/tests/sdlc/merge-base.test.ts::a_merge_never_drops_a_path_neither_side_deleted_(beans_vsv7,_8j9e)::nothing_dropped_is_an_empty_list,_and_the_order_is_stable
  Scenario: Nothing dropped is an empty list, and the order is stable
    Given parents and a result holding the same paths in different orders
    When the dropped paths are computed
    Then none are reported
    And paths dropped from an empty result are reported sorted as "a", "m", "z"

  @test:scripts/tests/sdlc/merge-base.test.ts::a_merge_never_drops_a_path_neither_side_deleted_(beans_vsv7,_8j9e)::before_staging_every_drop_is_refused;_after_the_writers,_only_a_drop_the_disk_still_holds
  Scenario: Before staging every drop is refused; after the writers only a drop still on disk is
    Given a dropped payload a writer replaced and a dropped results file still on disk
    When refusals are taken at the "resolved" checkpoint
    Then both are refused
    And at the "staged" checkpoint only the results file is

  @test:scripts/tests/sdlc/merge-base.test.ts::a_merge_never_drops_a_path_neither_side_deleted_(beans_vsv7,_8j9e)::the_refusal_line_has_the_shape_merge-main-comment_reads,_and_says_when_the_disk_hides_the_loss
  Scenario: The dropped-path line has the refusal shape and says when the disk hides the loss
    When the line for a path held by both and still on disk is written
    Then it starts with two spaces and "✗" and has the "  [" shape
    And it says "still on disk"
    And the line for a path held only by theirs says "added on the base"

  @test:scripts/tests/sdlc/merge-base.test.ts::a_gitignored-but-tracked_file_through_a_merge_and_its_regeneration_(8j9e)::a_writer_rewriting_a_tracked-ignored_file:_`git_add_-A`_keeps_it_staged,_and_the_guard_passes
  Scenario: A writer rewriting a tracked-ignored file keeps it staged and the guard passes
    Given a merge under a gitignored "results/" whose files are tracked, with "x.json" conflicted and "new.json" added by main
    When the base side of "x.json" is taken, both tracked files are rewritten, and "git add -A" runs
    Then "new.json", "x.json" and "y.json" are staged
    And the index holds the rewritten "y.json"
    And no path is dropped in the merge

  @test:scripts/tests/sdlc/merge-base.test.ts::a_gitignored-but-tracked_file_through_a_merge_and_its_regeneration_(8j9e)::the_#1898_shape:_a_path_an_earlier_step_resolved_is_`git_rm`ed,_regen_rewrites_it,_and_`add_-A`_never_restages_it
  Scenario: A path an earlier step resolved and git rm'ed is reported though regen rewrites it
    Given the tracked-ignored merge where "x.json" is resolved, staged, then removed with git rm
    When regen writes "x.json" again and "git add -A" runs
    Then "x.json" is not tracked but is on disk
    And the merge reports it dropped, held by both
    And its line says "still on disk"

  @test:scripts/tests/sdlc/merge-base.test.ts::a_gitignored-but-tracked_file_through_a_merge_and_its_regeneration_(8j9e)::a_file_the_base_ADDED_under_the_ignored_directory_and_the_merge_lost_is_refused_too
  Scenario: A file the base added under the ignored directory and the merge lost is refused
    Given the tracked-ignored merge with "x.json" taken from the base
    When "new.json" is removed from the index and "git add -A" runs
    Then the merge reports "new.json" dropped, held by theirs

  @test:scripts/tests/sdlc/merge-base.test.ts::a_gitignored-but-tracked_file_through_a_merge_and_its_regeneration_(8j9e)::the_base's_own_deletion_of_a_tracked-ignored_file_is_still_taken
  Scenario: The base's own deletion of a tracked-ignored file is still taken
    Given a merge where main untracked "results/gone.json" under a gitignored directory and the branch changed another file
    When main is merged
    Then "results/gone.json" is not tracked
    And no path is dropped in the merge

  @test:scripts/tests/sdlc/merge-base.test.ts::a_conflicted_submodule_gitlink_is_resolved_by_ancestry_—_bean_wczm::the_branch's_pin_fast-forwards_main's:_keep_the_branch's
  Scenario: When the branch's submodule pin fast-forwards main's, the branch's is kept
    Given a shallow submodule whose branch pin descends from main's pin, conflicted in a merge
    When the gitlink is resolved
    Then it takes "ours" at the branch's pin, because "the branch's pin fast-forwards the base's"
    When that pin is staged
    Then nothing is left unmerged and the index records the branch's pin

  @test:scripts/tests/sdlc/merge-base.test.ts::a_conflicted_submodule_gitlink_is_resolved_by_ancestry_—_bean_wczm::main's_pin_fast-forwards_the_branch's:_take_main's
  Scenario: When main's submodule pin fast-forwards the branch's, main's is taken
    Given a shallow submodule whose main pin descends from the branch's pin, conflicted in a merge
    When the gitlink is resolved
    Then it takes "theirs" at main's pin, because "the base's pin fast-forwards the branch's"

  @test:scripts/tests/sdlc/merge-base.test.ts::a_conflicted_submodule_gitlink_is_resolved_by_ancestry_—_bean_wczm::diverged_pins_are_refused_—_either_side_drops_the_other's_commits
  Scenario: Diverged submodule pins are refused
    Given a submodule whose branch and main pins diverged from the base pin
    When the gitlink is resolved
    Then it is refused with a reason containing "diverged"

  @test:scripts/tests/sdlc/merge-base.test.ts::a_conflicted_submodule_gitlink_is_resolved_by_ancestry_—_bean_wczm::a_path_that_is_not_a_gitlink_is_not_this_resolver's
  Scenario: A path that is not a gitlink is not the gitlink resolver's
    Given a gitlink conflict on "sub"
    When ".gitmodules" is resolved as a gitlink
    Then there is no result

  @test:scripts/tests/sdlc/merge-base.test.ts::a_conflicted_path_the_branch's_.gitignore_matches_(#1801)::the_crash,_reproduced:_a_plain_`git_add`_exits_1_on_the_unmerged_ignored_path
  Scenario: A plain git add exits non-zero on an unmerged path the branch's .gitignore matches
    Given a merge where the branch ignores "results/" while "results/x.json" stays tracked and conflicted
    Then "results/x.json" has stages 1, 2 and 3
    And a plain "git add" of it throws

  @test:scripts/tests/sdlc/merge-base.test.ts::a_conflicted_path_the_branch's_.gitignore_matches_(#1801)::takeBase_stages_the_base's_copy_anyway,_and_nothing_else
  Scenario: takeBase stages the base's copy of an ignored conflicted path and nothing else
    Given the same ignored, conflicted "results/x.json" and an untracked "results/untracked.json"
    When the base side of "results/x.json" is taken
    Then it holds main's content
    And nothing is left unmerged
    And "results/untracked.json" is not tracked

  @test:scripts/tests/sdlc/merge-base.test.ts::a_resolution_that_fails_is_reported_as_a_refusal,_not_an_unexplained_exit::the_line_has_the_refusal_shape_merge-main.yml_and_merge-main-comment_read
  Scenario: A resolution that fails is reported in the refusal line shape
    Given a git error whose stderr says the paths are ignored by a .gitignore file
    When the failure line for "results/x.json" under "derived-results" is written
    Then it is "  ✗ results/x.json  [derived-results: could not resolve] — " followed by the first stderr line
    And it matches the refusal shape merge-main.yml greps for
    And the merge-main comment parser reads "results/x.json" as refused

  @test:scripts/tests/sdlc/merge-base.test.ts::owned-tree:_subgraph_indexes_and_content-addressed_payloads_(#2176)::both_directories_classify_as_owned-tree,_pruned_by_a_writer_package.json_declares
  Scenario: Subgraph indexes and payloads classify as owned-tree, pruned by a declared writer
    When a subgraph index and the root subgraph index are classified
    Then each is "subgraph-index"
    And a payload and its sidecar are "subgraph-payload"
    And every owned-tree pattern names a writer, which package.json declares along with its ":check"
    And a hashed navbar rail file is "navbar-rail-data" while "navbar.js" is refused
    And no other strategy declares a writer
    And the index and payload are in the "generated" path class

  @test:scripts/tests/sdlc/merge-base.test.ts::owned-tree:_subgraph_indexes_and_content-addressed_payloads_(#2176)::the_neighbours_stay_refused:_the_authored_skill_a_subgraph_is_built_FROM,_and_the_rest_of_docs/payload
  Scenario: The authored skill and the rest of docs/payload stay refused
    When the merge-conflict-patterns skill source and "docs/payload/README.txt" are classified
    Then each is refused

  @test:scripts/tests/sdlc/merge-base.test.ts::owned-tree:_subgraph_indexes_and_content-addressed_payloads_(#2176)::the_action_reads_the_parents:_base's_copy,_else_the_branch's,_removed_only_when_neither_has_it
  Scenario: The owned-tree action reads the parents
    When the action is read for a path in the base
    Then it is "theirs", whether or not the branch holds it
    And a path only the branch holds is "ours"
    And a path neither holds is "delete"

  @test:scripts/tests/sdlc/merge-base.test.ts::owned-tree:_subgraph_indexes_and_content-addressed_payloads_(#2176)::git_reports_the_payload_as_rename/rename,_with_marked_bytes_at_the_new_names
  Scenario: git reports moved payloads as rename/rename with marked bytes at the new names
    Given a merge where the branch and main each moved a payload and rewrote the subgraph index
    Then the index and the base, branch and main payloads are conflicted
    And the base payload has stage 1 only, the branch's stage 2 only and main's stage 3 only
    And main's stage-3 bytes contain a conflict marker
    And the plan refuses nothing

  @test:scripts/tests/sdlc/merge-base.test.ts::owned-tree:_subgraph_indexes_and_content-addressed_payloads_(#2176)::the_refusal_sibling:_take-base_would_drop_the_branch's_payload,_and_the_resolved_checkpoint_refuses_it
  Scenario: Plain take-base would drop the branch's payload, and the resolved checkpoint refuses it
    Given the moved-payload merge
    When every conflicted path takes the base side
    Then the resolved checkpoint refuses the branch's payload, held by ours
    And main's payload holds conflict-marked bytes

  @test:scripts/tests/sdlc/merge-base.test.ts::owned-tree:_subgraph_indexes_and_content-addressed_payloads_(#2176)::owned-tree_completes_the_merge,_passes_both_#2145_checkpoints,_then_regenerates
  Scenario: Owned-tree completes the merge, passes both checkpoints, then regenerates
    Given the moved-payload merge
    When every resolvable path, each with strategy "owned-tree", is resolved as owned-tree
    Then nothing is left unmerged and the resolved checkpoint refuses nothing
    And the branch's and main's payloads hold their committed bytes, which hash to their names
    And the base's payload is gone and the index is main's
    When the writer regenerates and "git add -A" runs
    Then the branch's payload and sidecar are dropped
    And the staged checkpoint refuses neither, while the resolved checkpoint would refuse both
    And after commit only main's payload and sidecar are tracked

  @test:scripts/tests/sdlc/merge-base.test.ts::owned-tree:_subgraph_indexes_and_content-addressed_payloads_(#2176)::a_payload_only_the_branch_has_is_kept_from_its_commit;_an_already-resolved_path_is_left_alone
  Scenario: A payload only the branch has is kept, and an already-resolved path is left alone
    Given the moved-payload merge
    When the branch's payload is resolved as owned-tree
    Then it holds the branch's bytes and has no unmerged stages
    When the index is resolved and staged by hand and then resolved as owned-tree
    Then it keeps the hand resolution

  @test:scripts/tests/sdlc/merge-base.test.ts::take-base_on_gitignored-tracked_paths_without_stage-2_error_(bean_u4up)::resolves_a_gitignored-tracked_conflict_without_throwing_or_stage-2_error
  Scenario: Take-base resolves a gitignored-tracked conflict without a stage-2 error
    Given the tracked-ignored merge with "results/x.json" at stages 1, 2 and 3
    When the base side is taken
    Then it does not throw
    And no stages are left, the file holds main's content, and it is staged

  @test:scripts/tests/sdlc/merge-base.test.ts::take-base_on_gitignored-tracked_paths_without_stage-2_error_(bean_u4up)::modify/delete_on_a_gitignored-tracked_path_takes_base_without_stage-2_error
  Scenario: Take-base resolves modify/delete on a gitignored-tracked path without a stage-2 error
    Given a merge where the branch deleted the tracked-ignored "results/x.json" and main changed it
    Then its stages are 1 and 3
    When the base side is taken
    Then it does not throw
    And no stages are left and the file holds main's content
