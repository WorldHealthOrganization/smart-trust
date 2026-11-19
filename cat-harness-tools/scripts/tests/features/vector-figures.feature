# The vector figure arm (bean ay3x): the extractor assigns no role, a role
# arrives only by inspection, and the arm is measured against bare figures.
# Each Scenario names the test that executes it.
Feature: Vector figures

  @test:scripts/tests/vector-figures.test.ts::the_extractor_assigns_no_role_—_the_schema_refuses_one::an_assembly-basis_render_is_undetermined
  Scenario: An assembly render with no role validates
    Then a render with role "undetermined" and an assembly basis by the extractor script is accepted

  @test:scripts/tests/vector-figures.test.ts::the_extractor_assigns_no_role_—_the_schema_refuses_one::an_assembly_basis_claiming_`figure`_is_refused
  Scenario: An assembly render claiming "figure" is refused
    Then the same render with role "figure" is refused, saying "assigns no role"

  @test:scripts/tests/vector-figures.test.ts::the_extractor_assigns_no_role_—_the_schema_refuses_one::`shows`_and_a_narrative_need_somebody_to_have_looked
  Scenario: shows and a narrative need an inspection
    Then an assembly render with "shows" is refused
    And an assembly render with a draft narrative is refused

  @test:scripts/tests/vector-figures.test.ts::the_extractor_assigns_no_role_—_the_schema_refuses_one::an_assembly_basis_must_name_a_SCRIPT_—_the_machine_says_it_was_the_machine
  Scenario: An assembly basis must be by a script
    Then an assembly basis by an agent is refused

  @test:scripts/tests/vector-figures.test.ts::the_extractor_assigns_no_role_—_the_schema_refuses_one::an_unrendered_page_says_why,_and_cannot_be_inspected
  Scenario: An unrendered page needs a reason
    Then a render with no file and no region is refused
    And with an unrendered reason it is accepted

  @test:scripts/tests/vector-figures.test.ts::the_extractor_assigns_no_role_—_the_schema_refuses_one::`figures:_null`_must_carry_a_reason_—_could-not-determine_is_not_empty
  Scenario: A null figures list needs a reason
    Then a sidecar with figures null and no reason is refused
    And a sidecar with an empty figures list is accepted

  @test:scripts/tests/vector-figures.test.ts::a_role_arrives_by_inspection,_through_apply-image-verdicts::the_verdict_becomes_an_inspection_basis_naming_who_looked,_with_a_draft
  Scenario: A verdict becomes an inspection basis
    Given a sidecar with render "vfig-p034" and a figure verdict for it
    When the verdicts are applied by an agent
    Then 1 is applied with none unjudged or orphaned
    And the render's role is "figure", its basis is an inspection by the agent naming what was seen and page 34
    And it shows "3" and its narrative is a draft

  @test:scripts/tests/vector-figures.test.ts::a_role_arrives_by_inspection,_through_apply-image-verdicts::a_render_with_no_verdict_is_reported_unjudged,_and_a_verdict_with_no_render_is_orphaned
  Scenario: Unjudged renders and orphaned verdicts are reported
    Given render "vfig-p034" and a verdict only for "vfig-p099"
    When the verdicts are applied
    Then "vfig-p034" is unjudged and "vfig-p099" is orphaned

  @test:scripts/tests/vector-figures.test.ts::a_role_arrives_by_inspection,_through_apply-image-verdicts::staging_mode_writes_both_sidecars_from_one_verdict_file,_and_refuses_an_orphan_before_writing_either
  Scenario: Staging mode refuses an orphan before writing
    # Gap: the title says both sidecars are written; only the vector sidecar is read back.
    Given a staging entry with a vector sidecar and a verdict file holding a verdict for "vfig-p034" and an orphan "vfig-p099"
    When staging runs
    Then it returns 1 and the vector sidecar is unchanged
    When the verdict file holds only "vfig-p034"
    Then staging returns 0 and the render's basis is an inspection

  @test:scripts/tests/vector-figures.test.ts::measured_against_the_BARE_figures,_and_only_an_inspected_render_reaches_one::reach_splits_the_bare_set_three_ways,_and_a_caption_candidate_is_not_coverage
  Scenario: Reach splits the bare figures three ways
    Given an inspected render showing Fig. 2 and an uninspected render whose caption names Fig. 3
    When the reach over bare figures 2, 3 and 4 is computed
    Then 2 is shown, 3 is a candidate, 4 is neither, with 2 renders and 1 inspected

  @test:scripts/tests/vector-figures.test.ts::measured_against_the_BARE_figures,_and_only_an_inspected_render_reaches_one::no_sidecar_is_undefined_—_not_'reached_nothing'
  Scenario: No sidecar has no reach
    Then the reach of an entry with no vector sidecar is undefined

  @test:scripts/tests/vector-figures.test.ts::measured_against_the_BARE_figures,_and_only_an_inspected_render_reaches_one::neither_reaches_→_not-derivable,_naming_the_bare_figures_and_the_uninspected_render
  Scenario: No inspected render leaves image descriptions not derivable
    Given only an uninspected render naming Fig. 2 and 3
    Then image-descriptions is "not-derivable", naming "Fig. 2, 3" as on a render nobody has inspected

  @test:scripts/tests/vector-figures.test.ts::measured_against_the_BARE_figures,_and_only_an_inspected_render_reaches_one::an_inspected_render_reaching_SOME_bare_figures_still_leaves_the_rest_not-derivable
  Scenario: A partial reach leaves the rest not derivable
    Given an inspected render showing only Fig. 2
    Then image-descriptions is "not-derivable", naming "Fig. 3." and not "Fig. 2, 3"

  @test:scripts/tests/vector-figures.test.ts::measured_against_the_BARE_figures,_and_only_an_inspected_render_reaches_one::every_bare_figure_shown_by_an_inspected,_described_render_→_met,_saying_how
  Scenario: Every bare figure shown by an inspected render is met
    Given inspected renders showing Fig. 2 and Fig. 3
    Then image-descriptions is "met", saying "shown by a vector render somebody inspected"

  @test:scripts/tests/vector-figures.test.ts::measured_against_the_BARE_figures,_and_only_an_inspected_render_reaches_one::the_arm_never_produces_`unmet`_—_an_uninspected_render_is_a_gap,_not_a_blocker
  Scenario: Uninspected renders are never unmet
    Given uninspected renders naming Fig. 2 and Fig. 3
    Then image-descriptions is not "unmet"

  @test:scripts/tests/vector-figures.test.ts::the_entry_may_carry_the_arm's_outputs::`vector-figures.json`_and_`figures/`_are_declared_entry_contents
  Scenario: The arm's outputs are declared entry contents
    Then "vector-figures.json" is an entry sidecar
    And "figures", "sheets", "figure-data" and "tables" are entry directories

  @test:scripts/tests/vector-figures.test.ts::corpus::Fig._3_of_the_SF_handbook:_nesting_recovered_by_containment
  Scenario: The SF handbook's Fig. 3 nesting is recovered
    # Gap: returns early with no assertion when the PDF is in neither uploads/ nor fsh-guts/uploads/ or the extractor fails, so it passes without checking anything there.
    When the extractor runs over "9789240120747-eng.pdf"
    Then the page-34 render is undetermined with an assembly basis
    And "Health Worker" sits in "Registry Services", which sits in "Shared Services"

  @test:scripts/tests/vector-figures.test.ts::corpus::a_landscape_page_renders_in_the_visible_frame_and_counts_what_the_crop_leaves_out
  Scenario: A landscape page renders in its visible frame
    # Gap: returns early with no assertion when the PDF is in neither uploads/ nor fsh-guts/uploads/ or the extractor fails, so it passes without checking anything there.
    When the extractor runs over "9789240010567-eng.pdf"
    Then the page-25 render has rotation 90, a region wider than tall, and some drawings outside the crop

  @test:scripts/tests/vector-figures.test.ts::corpus::the_chapter_tabs_on_the_page_edge_stay_out_of_the_crop,_and_are_still_recorded
  Scenario: Page-edge chapter tabs stay out of the crop
    # Gap: returns early with no assertion when the PDF is in neither uploads/ nor fsh-guts/uploads/ or the extractor fails, so it passes without checking anything there.
    When the extractor runs over "9789240093362-eng.pdf"
    Then page 20 has at least 7 page-edge groups, none rendered, one labelled "Scale-up", and its region starts past 28.35
    And page 14, holding only tabs, renders all of them

  @test:scripts/tests/vector-figures.test.ts::corpus::no_render_anywhere_in_the_corpus_carries_a_role
  Scenario: No corpus render carries a role
    # Gap: checks only two named PDFs, not the whole corpus, and skips each one silently when it is absent, so it can pass with no assertion.
    When the extractor runs over "9789240120747-eng.pdf" and "9789240093362-eng.pdf"
    Then every render is undetermined with an assembly basis
