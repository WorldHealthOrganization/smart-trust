# scripts/content-compile-gates.ts declares the content-type compile gates (G5 Lean, G6 FHIR IG, G7 KG, advisory A1 renders and
# A2 IG Publisher) as data, routes changed paths to them, and evaluates them on a PR head or a merge-train union.
# Each Scenario names the test that executes it.
Feature: Content-type compile gates

  @test:scripts/tests/sdlc/content-compile-gates.test.ts::Done-when_(1):_path_→_gate_map_declared_as_data,_read_by_gates.ts::CONTENT_COMPILE_GATES_is_declared_as_data_array_with_required_gate_metadata
  Scenario: The compile gates are declared as a data array carrying each gate's metadata
    Given the declared CONTENT_COMPILE_GATES
    When it is read
    Then it is an array of at least 5 gates including G5, G6, G7, A1 and A2
    And every gate has a string id, name and description, a boolean blocking, an array of path patterns and a matchesPath function

  @test:scripts/tests/sdlc/content-compile-gates.test.ts::Done-when_(1):_path_→_gate_map_declared_as_data,_read_by_gates.ts::blocking_property_matches_design_specification_(§5.1)
  Scenario: G5, G6 and G7 block while A1 and A2 are advisory
    Given the declared compile gates
    When each gate's blocking flag is read
    Then G5, G6 and G7 are blocking
    And A1 and A2 are not

  @test:scripts/tests/sdlc/content-compile-gates.test.ts::Done-when_(1):_path_→_gate_map_declared_as_data,_read_by_gates.ts::gates.ts_imports_and_re-exports_the_exact_same_declared_data_map
  Scenario: gates.ts re-exports the same declared gate map
    Given the gate map imported from gates.ts
    When it is compared with the declared map
    Then it is the very same object
    And the gates.ts query for "test/file.lean" includes G5

  @test:scripts/tests/sdlc/content-compile-gates.test.ts::Done-when_(1):_path_→_gate_map_declared_as_data,_read_by_gates.ts::path_classifiers_route_correctly_to_gates
  Scenario: Path classifiers route paths to their gate
    Given a set of changed-file paths
    When each classifier is asked
    Then .lean files, lakefile.lean and lean-toolchain are Lean paths, and readme.md is not
    And .fsh files, sushi-config.yaml and ig-ast/ JSON are FHIR IG paths, and other/doc.md is not
    And a .jsonld context, schemas/node.ts, a skill.json and a .bpmn process are KG paths
    And docs/index.md, _site/index.html and paper.pdf are render paths

  @test:scripts/tests/sdlc/content-compile-gates.test.ts::Done-when_(2):_each_gate_has_a_test_that_fails_it_on_purpose::G5_(Lean_compile_&_audit)::fails_on_purpose_when_lake_build_fails
  Scenario: G5 fails and blocks when lake build fails
    Given a Lean file and a lake build runner that reports an unknown identifier
    When the Lean gate is evaluated
    Then its status is "fail" and it is blocked
    And a detail says "Lake build failed"

  @test:scripts/tests/sdlc/content-compile-gates.test.ts::Done-when_(2):_each_gate_has_a_test_that_fails_it_on_purpose::G5_(Lean_compile_&_audit)::fails_on_purpose_when_uncited_sorry_is_found
  Scenario: G5 fails and blocks on an uncited sorry
    Given a Lean file with a theorem proved by sorry and no citation
    When the Lean gate is evaluated
    Then its status is "fail" and it is blocked
    And a detail says "Uncited sorry"

  @test:scripts/tests/sdlc/content-compile-gates.test.ts::Done-when_(2):_each_gate_has_a_test_that_fails_it_on_purpose::G5_(Lean_compile_&_audit)::fails_on_purpose_when_undeclared_axiom_is_found
  Scenario: G5 fails and blocks on an undeclared axiom
    Given a Lean file declaring "axiom evil_axiom : False" and declared axioms propext, Quot.sound and Classical.choice
    When the Lean gate is evaluated
    Then its status is "fail" and it is blocked
    And a detail says "Undeclared axiom 'evil_axiom'"

  @test:scripts/tests/sdlc/content-compile-gates.test.ts::Done-when_(2):_each_gate_has_a_test_that_fails_it_on_purpose::G5_(Lean_compile_&_audit)::passes_when_Lean_file_is_clean_with_cited_sorry_and_declared_axioms
  Scenario: G5 passes a clean Lean file whose sorry is cited
    # Gap: the clean file declares no axioms, so the declared-axioms half of the title is not exercised
    Given a Lean file whose sorry follows a "Ref: [CIT-123]" citation, and a lake build that succeeds
    When the Lean gate is evaluated
    Then its status is "pass" and it is not blocked

  @test:scripts/tests/sdlc/content-compile-gates.test.ts::Done-when_(2):_each_gate_has_a_test_that_fails_it_on_purpose::G6_(FHIR_IG_compile_&_AST_extract)::fails_on_purpose_when_SUSHI_reports_errors
  Scenario: G6 fails and blocks when SUSHI reports errors
    Given a FSH file and a SUSHI run reporting 2 errors and 1 warning
    When the FHIR IG gate is evaluated
    Then its status is "fail" and it is blocked
    And a detail says "SUSHI reported 2 error(s)"

  @test:scripts/tests/sdlc/content-compile-gates.test.ts::Done-when_(2):_each_gate_has_a_test_that_fails_it_on_purpose::G6_(FHIR_IG_compile_&_AST_extract)::fails_on_purpose_when_IG_AST_extraction_fails
  Scenario: G6 fails and blocks when IG AST extraction fails
    Given an ig-ast bundle and an extractor that fails with a SyntaxError
    When the FHIR IG gate is evaluated
    Then its status is "fail" and it is blocked
    And a detail says "IG AST extraction failed"

  @test:scripts/tests/sdlc/content-compile-gates.test.ts::Done-when_(2):_each_gate_has_a_test_that_fails_it_on_purpose::G6_(FHIR_IG_compile_&_AST_extract)::passes_when_SUSHI_reports_0_errors_and_AST_extracts_cleanly
  Scenario: G6 passes with zero SUSHI errors and a clean AST extraction
    Given a SUSHI run with 0 errors and 2 warnings, and an extractor that succeeds
    When the FHIR IG gate is evaluated
    Then its status is "pass" and it is not blocked

  @test:scripts/tests/sdlc/content-compile-gates.test.ts::Done-when_(2):_each_gate_has_a_test_that_fails_it_on_purpose::G7_(KG_JSON-LD_expand/compact_&_schema_validation)::fails_on_purpose_when_JSON-LD_drops_an_unmapped_term
  Scenario: G7 fails and blocks when JSON-LD expansion drops an unmapped term
    Given a JSON-LD file whose context maps "title" but not "unmappedSecretField"
    When the KG gate is evaluated
    Then its status is "fail" and it is blocked
    And a detail names "dropped term(s) [unmappedSecretField]"

  @test:scripts/tests/sdlc/content-compile-gates.test.ts::Done-when_(2):_each_gate_has_a_test_that_fails_it_on_purpose::G7_(KG_JSON-LD_expand/compact_&_schema_validation)::fails_on_purpose_when_schema_validation_fails
  Scenario: G7 fails and blocks when schema validation fails
    Given a schema file and a validator reporting a missing required "title"
    When the KG gate is evaluated
    Then its status is "fail" and it is blocked
    And a detail says "Schema validation failed"

  @test:scripts/tests/sdlc/content-compile-gates.test.ts::Done-when_(2):_each_gate_has_a_test_that_fails_it_on_purpose::G7_(KG_JSON-LD_expand/compact_&_schema_validation)::fails_on_purpose_when_kg:audit_reports_critical_findings
  Scenario: G7 fails and blocks when kg:audit reports a critical finding
    Given a BPMN process and a kg:audit run reporting 1 critical finding
    When the KG gate is evaluated
    Then its status is "fail" and it is blocked
    And a detail says "kg:audit:check failed with 1 critical finding"

  @test:scripts/tests/sdlc/content-compile-gates.test.ts::Done-when_(2):_each_gate_has_a_test_that_fails_it_on_purpose::G7_(KG_JSON-LD_expand/compact_&_schema_validation)::passes_when_JSON-LD_terms_are_preserved_and_schemas_validate
  Scenario: G7 passes when JSON-LD terms survive and schemas validate
    Given a JSON-LD file whose context maps every term, a passing validator and a clean kg:audit
    When the KG gate is evaluated
    Then its status is "pass" and it is not blocked

  @test:scripts/tests/sdlc/content-compile-gates.test.ts::Done-when_(2):_each_gate_has_a_test_that_fails_it_on_purpose::A1_&_A2_(Advisory_Downstream_Renders_&_IG_Publisher)::A1_warns_on_render_error_but_NEVER_blocks_merge
  Scenario: A1 warns on a render error but never blocks
    Given a render run that fails with a Jekyll error and a broken-anchor warning
    When the downstream renders gate is evaluated
    Then its status is "warn"
    And it is not blocking and not blocked

  @test:scripts/tests/sdlc/content-compile-gates.test.ts::Done-when_(2):_each_gate_has_a_test_that_fails_it_on_purpose::A1_&_A2_(Advisory_Downstream_Renders_&_IG_Publisher)::A2_warns_on_IG_Publisher_qa.html_errors/warnings_but_NEVER_blocks_merge
  Scenario: A2 warns on IG Publisher qa.html findings but never blocks
    Given an IG Publisher run reporting 3 errors and 12 warnings in output/qa.html
    When the IG Publisher gate is evaluated
    Then its status is "warn"
    And it is not blocking and not blocked
    And a detail says "qa.html errors: 3"

  @test:scripts/tests/sdlc/content-compile-gates.test.ts::Done-when_(3):_an_unknown_(toolchain_absent_/_cache_cold_timeout)_blocks_and_is_never_green::G5_(Lean)_blocks_on_absent_toolchain_with_status_unknown
  Scenario: G5 is unknown and blocks when the Lean toolchain is absent
    Given a Lean file and no Lean toolchain
    When the Lean gate is evaluated
    Then its status is "unknown" and it is blocked
    And its summary says "Toolchain absent"

  @test:scripts/tests/sdlc/content-compile-gates.test.ts::Done-when_(3):_an_unknown_(toolchain_absent_/_cache_cold_timeout)_blocks_and_is_never_green::G5_(Lean)_blocks_on_cache_cold_/_timeout_with_status_unknown
  Scenario: G5 is unknown and blocks when the cache restore times out
    Given a Lean file and a cache timeout
    When the Lean gate is evaluated
    Then its status is "unknown" and it is blocked
    And its summary says "cache restore timed out"

  @test:scripts/tests/sdlc/content-compile-gates.test.ts::Done-when_(3):_an_unknown_(toolchain_absent_/_cache_cold_timeout)_blocks_and_is_never_green::G6_(FHIR_IG)_blocks_on_absent_SUSHI_toolchain_with_status_unknown
  Scenario: G6 is unknown and blocks when the SUSHI toolchain is absent
    Given a FSH file and no SUSHI toolchain
    When the FHIR IG gate is evaluated
    Then its status is "unknown" and it is blocked
    And its summary says "Toolchain absent"

  @test:scripts/tests/sdlc/content-compile-gates.test.ts::Done-when_(3):_an_unknown_(toolchain_absent_/_cache_cold_timeout)_blocks_and_is_never_green::G7_(KG)_blocks_on_absent_KG_context_with_status_unknown
  Scenario: G7 is unknown and blocks when the KG context is absent
    Given a JSON-LD schema file and no KG context
    When the KG gate is evaluated
    Then its status is "unknown" and it is blocked
    And its summary says "KG context or schema validator unavailable"

  @test:scripts/tests/sdlc/content-compile-gates.test.ts::Done-when_(3):_an_unknown_(toolchain_absent_/_cache_cold_timeout)_blocks_and_is_never_green::evaluateCompileGates_overall_is_blocked_and_overallPassed_is_false_when_any_blocking_gate_is_unknown
  Scenario: An unknown blocking gate blocks the whole evaluation
    Given a changed Lean file and no Lean toolchain
    When all compile gates are evaluated
    Then the result is blocked and overallPassed is false
    And the first evaluation's status is "unknown"

  @test:scripts/tests/sdlc/content-compile-gates.test.ts::Done-when_(3):_an_unknown_(toolchain_absent_/_cache_cold_timeout)_blocks_and_is_never_green::A1_(advisory)_with_absent_renderer_reports_unknown_but_does_NOT_block_merge
  Scenario: A1 with no renderer is unknown but does not block
    Given a render path and no renderer available
    When the downstream renders gate is evaluated
    Then its status is "unknown"
    And it is not blocking and not blocked

  @test:scripts/tests/sdlc/content-compile-gates.test.ts::Done-when_(3):_an_unknown_(toolchain_absent_/_cache_cold_timeout)_blocks_and_is_never_green::A2_(advisory)_with_absent_publisher_reports_unknown_but_does_NOT_block_merge
  Scenario: A2 with no publisher is unknown but does not block
    Given a FSH file and no IG Publisher available
    When the IG Publisher gate is evaluated
    Then its status is "unknown"
    And it is not blocking and not blocked

  @test:scripts/tests/sdlc/content-compile-gates.test.ts::Done-when_(4):_each_gate_runs_on_the_merge-train_result,_not_only_on_each_PR_head::unionOfChangedPaths_combines_and_deduplicates_changed_paths_from_multiple_PRs_in_a_merge_train
  Scenario: The changed paths of a merge train are unioned and deduplicated
    Given three PRs' changed paths, two of them sharing "content/ch1/Proof.lean"
    When their union is taken
    Then it is the four distinct paths, sorted

  @test:scripts/tests/sdlc/content-compile-gates.test.ts::Done-when_(4):_each_gate_runs_on_the_merge-train_result,_not_only_on_each_PR_head::single_PR_head_triggers_only_gates_for_its_own_changed_paths
  Scenario: A single PR head triggers only the gates for its own paths
    Given one PR changing only a Lean file and another changing only a JSON-LD file
    When the gates for each PR head are chosen
    Then the Lean PR triggers G5 and not G7
    And the JSON-LD PR triggers G7 and not G5

  @test:scripts/tests/sdlc/content-compile-gates.test.ts::Done-when_(4):_each_gate_runs_on_the_merge-train_result,_not_only_on_each_PR_head::merge_train_result_triggers_the_union_of_gates_across_all_train_members
  Scenario: A merge train triggers the union of its members' gates
    Given a train of a Lean PR, a FSH PR and a JSON-LD schema PR
    When the gates for the merge train are chosen
    Then they include G5, G6, A2 and G7

  @test:scripts/tests/sdlc/content-compile-gates.test.ts::Done-when_(4):_each_gate_runs_on_the_merge-train_result,_not_only_on_each_PR_head::evaluateCompileGatesForMergeTrain_evaluates_all_gates_on_the_combined_train_result
  Scenario: A clean merge train is evaluated on all its gates and passes
    Given a train of a Lean PR and a FSH PR, with a clean Lean file, a passing lake build, a clean SUSHI run and AST extraction
    When the merge train's compile gates are evaluated
    Then the triggered gates include G5 and G6
    And overallPassed is true and the train is not blocked

  @test:scripts/tests/sdlc/content-compile-gates.test.ts::Done-when_(4):_each_gate_runs_on_the_merge-train_result,_not_only_on_each_PR_head::merge_train_is_blocked_if_ANY_PR's_touched_cone_in_the_union_fails_on_the_combined_result
  Scenario: A merge train is blocked when any member's gate fails on the combined result
    Given a train of a clean Lean PR and a FSH PR whose SUSHI run reports 1 error
    When the merge train's compile gates are evaluated
    Then the train is blocked and overallPassed is false
    And the G6 evaluation is "fail" and blocked
