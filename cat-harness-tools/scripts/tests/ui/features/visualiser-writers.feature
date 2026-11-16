# scripts/visualiser-writers.ts reads the writer of each declared visualiser, and how it is pointed at
# a site, from the declarations (visualiser, renderedBy, Tool, invoke.shell and its inputs), and runs them.
# Each Scenario names the test that executes it.
Feature: Visualiser writers read from the declarations

  @test:scripts/tests/ui/visualiser-writers.test.ts::visualiserWriters::the_command_is_the_Tool's_invocation_and_the_site_flag_its_declared_`site`_input
  Scenario: The writer command is the Tool's invocation and the site flag its site input
    Given the "library-viewer" Tool invoked as "bun run cat library:viz" with a "--site" site input
    When the visualiser writers are read
    Then its writer invokes "bun", "run", "cat", "library:viz"
    And its site flag is "--site"
    And it is runnable

  @test:scripts/tests/ui/visualiser-writers.test.ts::visualiserWriters::one_Tool_drawing_several_visualisers_runs_once
  Scenario: One Tool drawing several visualisers runs once
    Given "state-viewer" renders both cat-harness's "beans" and "qa"
    When the visualiser writers are read
    Then there is one "state-viewer" writer
    And it draws "beans" and "qa"

  @test:scripts/tests/ui/visualiser-writers.test.ts::visualiserWriters::a_Tool_with_an_`instance`_input_runs_once_per_declaring_harness,_and_`out`_serves_as_its_site
  Scenario: A Tool with an instance input runs once per declaring harness
    Given "archimate-pages" has a required "--instance" input and an "--out" input, declared by harnesses "a" and "b"
    When the visualiser writers are read
    Then there are two writers, with instance roots "/r/a" and "/r/b"
    And both use "--out" as their site flag

  @test:scripts/tests/ui/visualiser-writers.test.ts::visualiserWriters::what_cannot_be_run_is_said,_with_the_reason,_never_dropped
  Scenario: What cannot be run is said with its reason
    Given Tools that cannot be run for different reasons
    When the visualiser writers are read
    Then an "instance" input with no flag is unrunnable as declaring no flag
    And a required "label" input is unrunnable as a required input
    And a manual Tool is unrunnable as having no shell invocation
    And a shell with "; rm -rf /" is unrunnable as not a plain command
    And a renderedBy naming no Tool is unrunnable as naming no discovered Tool

  @test:scripts/tests/ui/visualiser-writers.test.ts::visualiserWriters::a_Tool_with_no_`site`_input_runs_into_its_own_site,_and_is_refused_one_being_built
  Scenario: A Tool with no site input runs into its own site and is refused a built one
    Given the "bare" Tool, whose only input is "--check"
    Then its writer is runnable with no site flag
    And its argv is "bun run cat bare:viz" in a checkout with a cat script
    And asking it to write into the site "/s" throws that it declares no site input

  @test:scripts/tests/ui/visualiser-writers.test.ts::writerArgv::`bun_run_cat`_goes_through_run-script.ts_where_the_checkout_has_no_`cat`_script
  Scenario: A cat invocation goes through run-script.ts where the checkout has no cat script
    Given a "bun run cat library:viz" writer with site flag "--site"
    When its argv for site "/s" is built in a checkout with and without a cat script
    Then it is the writer command for "library:viz" followed by "--site /s"
    And it goes through run-script.ts only where there is no cat script

  @test:scripts/tests/ui/visualiser-writers.test.ts::writerArgv::a_path_invocation_runs_as_declared,_with_the_instance_and_the_site
  Scenario: A path invocation runs as declared with the instance and the site
    Given a writer "bun run x/gen.ts" with instance "--instance /r/a" and site flag "--out"
    When its argv for site "/s" is built
    Then it is "bun run x/gen.ts --instance /r/a --out /s"

  @test:scripts/tests/ui/visualiser-writers.test.ts::writersFor_and_runVisualiserWriters::only_the_writers_of_missing_pages_run,_each_once
  Scenario: Only the writers of missing pages run, each once
    Given writers "state" for h/beans and h/qa, "lib" for h/library and an unrunnable "ig" for sb/artifact-index
    When the writers owed the missing pages h/qa and sb/artifact-index are taken
    Then they are "state" and "ig"
    And "state" draws only "qa"

  @test:scripts/tests/ui/visualiser-writers.test.ts::writersFor_and_runVisualiserWriters::a_per-instance_writer_runs_again_for_each_other_instance_owed_a_sub-graph_page
  Scenario: A per-instance writer runs again for each other instance owed a sub-graph page
    Given a per-instance "ig" writer for "/r/sb"
    And missing sub-graph pages for "sb", "trust" and an instance with no root
    When the writers owed are taken
    Then they run for instance roots "/r/sb" and "/r/trust"
    And the second's argv is "bun run ig.ts --instance /r/trust --site /s"

  @test:scripts/tests/ui/visualiser-writers.test.ts::writersFor_and_runVisualiserWriters::a_failure,_a_decline_and_an_unrunnable_writer_are_returned_for_the_caller_to_judge
  Scenario: A failure, a decline and an unrunnable writer are returned to the caller
    Given a runner that fails "s.ts" and declines everything else
    When the writers are run into site "/s"
    Then only the two runnable writers are invoked, each with "--site /s"
    And the outcomes are "failed", "skipped" and "unrunnable"

  @test:scripts/tests/ui/visualiser-writers.test.ts::site-target::`--site`_is_read_in_either_spelling,_absolute;_absent,_the_writer's_own_site
  Scenario: The site argument is read in either spelling, else the writer's own site
    # Gap: making a relative site absolute is not checked
    Given command-line arguments
    Then "--site /a/b" gives "/a/b" and "--site=/c" gives "/c"
    And no "--site" gives none
    And the site target is the writer's own "/own" with no argument, else the given "/x"

  @test:scripts/tests/ui/visualiser-writers.test.ts::over_this_checkout::every_writer_whose_Tool_declares_a_`site`_input_reads_it
  Scenario: Every cat writer that declares a site input reads it
    # Gap: the source text is checked, not that the script honours --site when run
    Given each writer in this checkout invoked through "bun run cat" with a "--site" flag
    When its script file is found
    Then its source text references "lib/site-target"

  @test:scripts/tests/ui/visualiser-writers.test.ts::inPublishOrder_—_a_viewer_runs_after_the_viewers_whose_pages_it_links_(owner,_2026-11-10)::puts_library:viz_before_methodologies:viz,_as_derive:publish_does,_and_leaves_the_others_in_place
  Scenario: library:viz runs before methodologies:viz and the others keep their place
    Given writers methodologies-viewer, other, library-viewer and an unrunnable one
    When they are put in the publish order "library:viz", "methodologies:viz"
    Then the order is library-viewer, other, methodologies-viewer, unrunnable

  @test:scripts/tests/ui/visualiser-writers.test.ts::inPublishOrder_—_a_viewer_runs_after_the_viewers_whose_pages_it_links_(owner,_2026-11-10)::changes_nothing_when_the_plan_names_none_of_them
  Scenario: A publish order naming none of the writers changes nothing
    Given writers "a:viz" and "b:viz"
    When they are put in an empty publish order
    Then they are unchanged
