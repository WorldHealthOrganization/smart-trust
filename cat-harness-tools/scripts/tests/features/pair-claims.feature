# prose-claims-resolve (bean ca4a, issue #1042 R3): a claim a skill's prose
# makes about its code is false only where the repository can honestly say
# so; anything else is undetermined. Each Scenario names the test that executes it.
Feature: Claims a skill's prose makes about its code

  @test:scripts/tests/pair-claims.test.ts::resolveCited::found;_missing_from_an_existing_directory;_or_pointing_outside
  Scenario: A cited path is found, missing from a known directory, or outside
    Then schemas/types.ts is found
    And schemas/gone.ts is missing from a known directory
    And content/schema/x.ts is in no known directory

  @test:scripts/tests/pair-claims.test.ts::resolveCited::folio-assistant/_is_this_instance's_root,_as_a_folio_mounts_it
  Scenario: folio-assistant/ is this instance's root
    Then folio-assistant/schemas/types.ts is found

  @test:scripts/tests/pair-claims.test.ts::judgePair_—_location::holds,_false-in-known-dir,_and_undetermined-outside
  Scenario: Location claims hold, are false in a known directory, or are undetermined outside
    Given prose claiming Report and Missing in schemas/types.ts, A in schemas/gone.ts and B in content/schema/x.ts
    When the pair is judged
    Then the outcomes are holds, false, false and undetermined

  @test:scripts/tests/pair-claims.test.ts::judgePair_—_bun_run::a_known_script_holds;_an_unknown_one_is_undetermined,_never_false
  Scenario: A known script holds; an unknown one is undetermined
    Given prose running bun run cat kg:audit and bun run validate-refs, with only kg:audit known
    When the pair is judged
    Then the outcomes are script holds and script undetermined

  @test:scripts/tests/pair-claims.test.ts::judgePair_—_bun_run::a_file_path_holds,_is_false_in_a_known_dir,_or_undetermined_outside
  Scenario: A file run holds, is false in a known directory, or is undetermined outside
    Given prose running an existing script, a missing script in a known directory, and report.ts
    When the pair is judged
    Then the outcomes are holds, false and undetermined

  @test:scripts/tests/pair-claims.test.ts::judgePair_—_the_nodes_a_workflow's_jobs_name::a_node_the_diagram_has_holds;_one_it_lacks_is_false
  Scenario: A workflow job's BPMN node holds when the diagram has it, and is false when it lacks it
    Given a workflow whose jobs name Task_Build, which the diagram has, and Task_Gone, which it lacks
    When the diagram and workflow pair is judged
    Then the outcomes are job holds and job false

  @test:scripts/tests/pair-claims.test.ts::claimsEntry_—_the_kg-qa_criterion::n/a_with_nothing_parsed;_fail_on_any_false;_unknown_when_all_undetermined;_else_pass
  Scenario: The criterion entry rolls up the claims
    Then no claims is n/a, any false is fail, all undetermined is unknown, and holds with undetermined is pass

  @test:scripts/tests/pair-claims.test.ts::rootScripts::a_checkout_with_no_package.json_has_no_scripts,_rather_than_crashing_the_audit_(ho66)
  Scenario: A checkout with no package.json has no root scripts
    Then a directory with no package.json has no scripts
    And with a package.json declaring gates, the scripts are gates
