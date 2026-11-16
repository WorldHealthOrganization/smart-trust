# scripts/lib/site-presets.ts: a site's site.build extends a shared, layered preset, so no
# content site can drop a step every other site runs (smart-ra lacked glossary and
# bibliography); scripts/build-instance-site.ts: links refuse counts every kind of unresolved
# internal link, never a namespace IRI (cat-harness-tools#2345). Each Scenario names the test
# that executes it.
Feature: Shared site build steps and a link check that refuses

  @test:scripts/tests/site-presets.test.ts::a_site_preset_—_shared,_layered_steps::a_preset_that_extends_another_runs_the_base's_steps_first,_and_merges_scripts_and_when
  Scenario: A preset that extends another runs the base's steps first
    Given a base preset with context and archimate steps, links refuse, and archimate only when archimate/ exists
    And a document preset that extends it with document, glossary and bibliography
    When the document preset is resolved
    Then the chain is the base, then the document preset
    And the source steps are context, archimate, document, glossary, bibliography
    And links is refuse, and the scripts and when of both presets are merged

  @test:scripts/tests/site-presets.test.ts::a_site_preset_—_shared,_layered_steps::a_site's_own_steps_come_after_the_preset's,_a_step_named_twice_runs_once,_and_its_own_links_wins
  Scenario: A site's own steps come after the preset's and run once
    Given a site whose own steps name mapper, context and, as a site step, glossary, with links report
    When it extends the document preset
    Then mapper and context run after the preset's steps, context moved to the site's place
    And glossary runs once, as a source step, where the preset puts it
    And the site's own links report wins

  @test:scripts/tests/site-presets.test.ts::a_site_preset_—_shared,_layered_steps::a_site_that_leaves_links_undeclared_gets_the_preset's_refuse
  Scenario: A site that declares no links gets the preset's refuse
    Given a site whose site.build declares no links
    When it extends the document preset
    Then links is refuse

  @test:scripts/tests/site-presets.test.ts::a_site_preset_—_shared,_layered_steps::a_missing_preset,_a_preset_declared_twice_and_a_loop_are_refused_by_name
  Scenario: A missing preset, a loop and a preset two layers declare are refused
    Given a checkout with presets that extend each other in a loop
    Then a preset no layer declares is refused naming it
    And the loop is refused naming each preset in it
    And a preset name that is not one path segment is refused
    And a directory that declares no layer is not looked in
    And a preset a mounted layer declares a second time is refused as declared twice

  @test:scripts/tests/site-presets.test.ts::a_site_preset_—_shared,_layered_steps::a_preset's_fields_are_checked:_step_names,_one-line_commands,_paths_inside_the_checkout
  Scenario: A preset's fields are checked
    Then a step that is not a package script name is refused
    And a command over two lines is refused
    And a when path outside the checkout is refused
    And links "ignore", a bad extends and a preset that is not an object are refused

  @test:scripts/tests/site-presets.test.ts::a_site_preset_—_shared,_layered_steps::a_step_whose_when_path_is_absent_is_skipped_with_its_reason;_present,_it_runs
  Scenario: A step whose when path is absent is skipped with its reason
    Given archimate runs only when archimate/ exists
    When the checkout holds no archimate/
    Then archimate is skipped because the checkout holds no archimate/
    And once archimate/ exists it runs

  @test:scripts/tests/site-presets.test.ts::a_site_preset_—_shared,_layered_steps::the_checkout's_own_script_wins_over_the_preset's_command;_without_either,_run-script_finds_it
  Scenario: The checkout's own script wins over the preset's command
    Given a preset command for glossary
    Then with no package script of that name the preset's command runs
    And with one, bun run runs the checkout's own
    And a step neither names goes through run-script

  @test:scripts/tests/site-presets.test.ts::the_link_check_—_refuse_counts_every_kind,_never_a_namespace_IRI::namespace_IRIs_are_not_pages
  Scenario: Namespace IRIs are not pages
    Then /smart-ra/v0/ns, an absolute v0/ns IRI with a term, a relative v0/ns path and v1/ns/ are namespace IRIs
    And a glossary page, v0nsx, v0/nsx and a bare ns/ are not

  @test:scripts/tests/site-presets.test.ts::the_link_check_—_refuse_counts_every_kind,_never_a_namespace_IRI::refuse_counts_the_platform's,_the_content's,_self-address_and_diagram_misses;_report_counts_none
  Scenario: Refuse counts every kind of unresolved link
    Given one platform miss, two content misses, one self-address miss and one diagram miss
    Then refuse counts 5 and report counts 0
