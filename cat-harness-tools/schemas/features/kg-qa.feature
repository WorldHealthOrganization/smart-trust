# The knowledge-graph QA sidecar rules in schemas/sdlc/kg-qa.ts: the criteria registry and its severities, tallies,
# the subject kinds' graph typologies, committed requirements, and where each instance's verdicts live (kgQaHomeFor).
# Each Scenario names the test that executes it.
Feature: Knowledge-graph QA sidecar rules

  @test:schemas/kg-qa.test.ts::the_criteria_registry::ids_are_unique
  Scenario: Criterion ids are unique
    Given the KG criteria registry
    Then no two criteria share an id

  @test:schemas/kg-qa.test.ts::the_criteria_registry::every_criterion_applies_to_at_least_one_subject_kind
  Scenario: Every criterion applies to at least one subject kind
    Given the KG criteria registry
    Then every criterion lists at least one subject kind it applies to

  @test:schemas/kg-qa.test.ts::the_criteria_registry::every_subject_kind_has_at_least_one_criterion,_so_no_kind_is_audited_vacuously
  Scenario: Every subject kind has at least one criterion
    Given the subject kinds "process", "decision", "role" and "graph"
    Then criteriaFor returns at least one criterion for each

  @test:schemas/kg-qa.test.ts::the_criteria_registry::a_broken_reference_is_critical_and_an_absent_one_is_not
  Scenario: A broken reference is critical and an absent one is not
    Then "skill-ref-resolves" is critical
    And "activity-names-skill" is major

  @test:schemas/kg-qa.test.ts::the_criteria_registry::`activity-skill-has-tool`_is_minor,_so_the_backlog_cannot_gate
  Scenario: activity-skill-has-tool is minor and applies only to processes
    Then "activity-skill-has-tool" is minor
    And it applies only to "process"

  @test:schemas/kg-qa.test.ts::the_criteria_registry::`call-activity-resolves`_is_not_critical_—_an_outward_call_is_not_a_defect
  Scenario: call-activity-resolves is major, not critical
    Then "call-activity-resolves" is major

  @test:schemas/kg-qa.test.ts::tally_and_worstSeverity::totals_cannot_disagree_with_the_criteria_block
  Scenario: Totals agree with the criteria block
    Given a process report with one pass, one fail and one n/a criterion
    When its totals are tallied
    Then they are 1 pass, 1 fail, 1 n/a and 0 unknown

  @test:schemas/kg-qa.test.ts::tally_and_worstSeverity::a_clean_report_has_no_severity
  Scenario: A clean report has no severity
    Given a report whose only criterion "skill-ref-resolves" passes
    Then its worst severity is undefined

  @test:schemas/kg-qa.test.ts::tally_and_worstSeverity::`unknown`_counts_as_a_failure_—_it_is_never_read_as_a_pass
  Scenario: An unknown result counts as a failure
    Given a report whose only criterion "skill-ref-resolves" is unknown
    Then its worst severity is "critical"

  @test:schemas/kg-qa.test.ts::tally_and_worstSeverity::`unknown`_is_NOT_promoted_past_its_criterion's_own_severity
  Scenario: An unknown result is not promoted past its criterion's own severity
    Given a report whose only criterion "role-binds-a-lane" is unknown
    Then its worst severity is "minor"

  @test:schemas/kg-qa.test.ts::tally_and_worstSeverity::the_worst_severity_wins,_not_the_most_frequent
  Scenario: The worst severity wins, not the most frequent
    Given a report failing "activity-names-skill", "lane-binds-role" and "skill-ref-resolves"
    Then its worst severity is "critical"

  @test:schemas/kg-qa.test.ts::reachability_reads_the_serving_registry,_not_just_manifests::`skill-servable`_is_major_—_a_body_nobody_can_fetch_is_a_real_gap,_not_a_broken_link
  Scenario: skill-servable is major and applies to processes
    Then "skill-servable" is major
    And it applies only to "process"

  @test:schemas/kg-qa.test.ts::reachability_reads_the_serving_registry,_not_just_manifests::`manifest-skill-exists`_is_critical_and_scoped_to_the_graph_roll-up
  Scenario: manifest-skill-exists is critical and scoped to the graph
    Then "manifest-skill-exists" is critical
    And it applies only to "graph"

  @test:schemas/kg-qa.test.ts::reachability_reads_the_serving_registry,_not_just_manifests::every_skill_fetch_local_package_points_at_a_directory_that_exists
  Scenario: Every skill_fetch local package points at an existing directory
    Given the LOCAL_PACKAGES table of src/tools/skill-fetch.ts
    Then no package points at a directory that does not exist

  @test:schemas/kg-qa.test.ts::reachability_reads_the_serving_registry,_not_just_manifests::every_directory_holding_`<skill>.md`_that_a_diagram_can_name_is_served
  Scenario: The skill_fetch local packages include content-lifecycle and folio-core
    # Gap: checks only that "content-lifecycle" and "folio-core" are served, not every directory holding a skill a diagram can name
    Given the LOCAL_PACKAGES table of src/tools/skill-fetch.ts
    Then it serves "content-lifecycle"
    And it serves "folio-core"

  @test:schemas/kg-qa.test.ts::requirements_are_the_fifth_node_kind_and_only_point::`requirement`_is_a_subject_kind_with_criteria_of_its_own
  Scenario: requirement is a subject kind with criteria of its own
    Then criteriaFor "requirement" returns at least one criterion

  @test:schemas/kg-qa.test.ts::requirements_are_the_fifth_node_kind_and_only_point::a_broken_reference_out_of_a_requirement,_or_INTO_one,_is_critical_like_any_other
  Scenario: A broken reference out of or into a requirement is critical
    Then "satisfies-resolves", "requirement-actors-resolve" and "requirement-derived-from-resolves" are each critical

  @test:schemas/kg-qa.test.ts::requirements_are_the_fifth_node_kind_and_only_point::an_unclaimed_statement_is_minor_coverage,_not_a_broken_reference
  Scenario: An unclaimed requirement statement is minor coverage
    Then "requirement-statement-satisfied" is minor
    And there is no "requirement-satisfied-by-resolves" criterion

  @test:schemas/kg-qa.test.ts::requirements_are_the_fifth_node_kind_and_only_point::an_ungraded_statement_is_major,_not_critical_—_readable,_just_not_testable
  Scenario: An ungraded requirement statement is major
    Then "requirement-statements-graded" is major

  @test:schemas/kg-qa.test.ts::requirements_are_the_fifth_node_kind_and_only_point::every_committed_requirement_resolves_every_reference_it_makes
  Scenario: Every committed requirement resolves every reference it makes
    Given the cat-harness skills/requirements directory exists
    And the actors declared in the checkout
    When every requirement JSON file is read
    Then every derivedFrom names a known requirement id
    And every requirement and statement actor is a known actor
    And every statement has a conformance grade
    And no statement carries satisfiedBy

  @test:schemas/kg-qa.test.ts::requirements_are_the_fifth_node_kind_and_only_point::`req:agent-workflow`_exists_—_three_requirements_derive_from_it
  Scenario: The agent-workflow requirement exists
    # Gap: checks only that agent-workflow.json exists, not that three requirements derive from it
    Then cat-harness's skills/requirements/agent-workflow.json exists

  @test:schemas/kg-qa.test.ts::KG_SUBJECT_GRAPH_TYPOLOGIES_—_the_bridge_to_the_graph-typology_registry::every_subject_kind_says_which_graph_it_inhabits
  Scenario: Every subject kind names the graph it inhabits
    Then every KG subject kind has a non-empty graph typology

  @test:schemas/kg-qa.test.ts::KG_SUBJECT_GRAPH_TYPOLOGIES_—_the_bridge_to_the_graph-typology_registry::every_named_graph_is_one_the_registry_knows
  Scenario: Every named graph typology is registered
    Given the default graph-typology registry
    Then every graph named by a subject kind is registered

  @test:schemas/kg-qa.test.ts::KG_SUBJECT_GRAPH_TYPOLOGIES_—_the_bridge_to_the_graph-typology_registry::every_criterion's_subject_kinds_resolve_to_a_graph
  Scenario: Every criterion's subject kinds resolve to a graph
    Then every subject kind every criterion applies to has a graph typology

  @test:schemas/kg-qa.test.ts::where_an_instance's_verdicts_live_(kgQaHomeFor)::an_instance_that_declares_a_qa_directory_keeps_its_own
  Scenario: An instance that declares a qa directory keeps its own verdicts
    When kgQaHomeFor is asked for cat-harness
    Then its home is cat-harness's "test/results", by "own"

  @test:schemas/kg-qa.test.ts::where_an_instance's_verdicts_live_(kgQaHomeFor)::bootstrap_declares_none,_and_is_hosted_beside_the_host's_own_tree
  Scenario: Bootstrap's verdicts are hosted beside the host's own tree
    When kgQaHomeFor is asked for bootstrap with cat-harness as host
    Then its home is cat-harness's "test/results/bootstrap", by "hosted"
    And that home is not inside the host's own kg-qa results directory

  @test:schemas/kg-qa.test.ts::where_an_instance's_verdicts_live_(kgQaHomeFor)::with_no_host,_an_instance_without_a_qa_directory_falls_back_to_the_convention
  Scenario: With no host, an instance without a qa directory falls back to the convention
    When kgQaHomeFor is asked for bootstrap with no host
    Then its home is found by "convention"

  @test:schemas/kg-qa.test.ts::where_an_instance's_verdicts_live_(kgQaHomeFor)::nothing_audits_bootstrap_inside_bootstrap_any_more
  Scenario: Nothing audits bootstrap inside bootstrap
    Then bootstrap has no "test" directory

  @test:schemas/kg-qa.test.ts::where_an_instance's_verdicts_live_(kgQaHomeFor)::every_instance's_home_resolves,_and_bootstrap's_is_the_hosted_one
  Scenario: Every instance's home resolves, and bootstrap's is the hosted one
    # Gap: other instances' homes are only checked to resolve without throwing
    Given every instance root in the checkout
    When kgQaHomeFor resolves each with cat-harness as host
    Then the homes include cat-harness's "test/results/bootstrap"
