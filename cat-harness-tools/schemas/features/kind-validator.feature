# schemas/kg/kind-validator.ts parses a graph typology's `module#Export` validator reference and resolves it to one of three states: resolved, undeclared or unresolvable.
# It also covers kg-validate's directory-to-kind routing, per-$schema-family qa schemas and instance-qualified references.
# Each Scenario names the test that executes it.
Feature: Resolving a graph kind's validator

  @test:schemas/kind-validator.test.ts::parseValidatorRef::`module#Export`_splits
  Scenario: A module#Export reference splits into its module and export name
    Given the validator reference "schemas/x.ts#XSchema"
    When parseValidatorRef reads it
    Then the result is module "schemas/x.ts" and exportName "XSchema"

  @test:schemas/kind-validator.test.ts::parseValidatorRef::a_bare_module_is_REFUSED_—_the_export_is_not_optional
  Scenario: A bare module with no export name is refused
    Given the validator reference "schemas/x.ts" with no "#Export" part
    When parseValidatorRef reads it
    Then it throws a ValidatorRefError
    And the error message mentions "#Export"

  @test:schemas/kind-validator.test.ts::parseValidatorRef::an_absolute_or_escaping_module_is_refused
  Scenario: An absolute or parent-escaping module path is refused
    Given the references "/etc/x.ts#S" and "../other/x.ts#S"
    When parseValidatorRef reads each
    Then each throws an error saying the path must be instance-relative

  @test:schemas/kind-validator.test.ts::parseValidatorRef::an_empty_half_is_refused
  Scenario: A reference with an empty module or empty export is refused
    Given the references "#S" and "schemas/x.ts#"
    When parseValidatorRef reads each
    Then each throws a ValidatorRefError

  @test:schemas/kind-validator.test.ts::isZodSchema::an_interface-shaped_object_is_not_one
  Scenario: Only an object with a safeParse function counts as a Zod schema
    Given an empty object, undefined, and an object with a safeParse function
    When isZodSchema checks each
    Then the empty object is not a Zod schema
    And undefined is not a Zod schema
    And the object with safeParse is a Zod schema

  @test:schemas/kind-validator.test.ts::resolveKindValidator_—_three_states::undeclared_is_its_OWN_state,_not_a_pass_and_not_a_failure
  Scenario: A kind that declares no validator is in the undeclared state
    Given a registry with kind "test-kind" declaring no validator
    When resolveKindValidator resolves "test-kind"
    Then the state is "undeclared"
    And the reason says the kind declares no validator

  @test:schemas/kind-validator.test.ts::resolveKindValidator_—_three_states::a_declared_validator_that_loads_resolves_to_something_runnable
  Scenario: A declared validator that loads resolves to a runnable schema
    Given "test-kind" declares the validator "schemas/sdlc/health-report.ts#HealthReportSchema"
    When resolveKindValidator resolves "test-kind"
    Then the state is "resolved"
    And the resolved schema has a safeParse function

  @test:schemas/kind-validator.test.ts::resolveKindValidator_—_three_states::a_missing_module_is_unresolvable,_and_says_which_path
  Scenario: A validator naming a missing module is unresolvable and names the path
    Given "test-kind" declares the validator "schemas/nope.ts#S"
    When resolveKindValidator resolves "test-kind"
    Then the state is "unresolvable"
    And the reason mentions "nope.ts"

  @test:schemas/kind-validator.test.ts::resolveKindValidator_—_three_states::a_missing_export_is_unresolvable
  Scenario: A validator naming a missing export is unresolvable
    Given "test-kind" declares the validator "schemas/sdlc/health-report.ts#NotAThing"
    When resolveKindValidator resolves "test-kind"
    Then the state is "unresolvable"
    And the reason says the module exports no "NotAThing"

  @test:schemas/kind-validator.test.ts::resolveKindValidator_—_three_states::an_export_that_is_not_a_Zod_schema_is_unresolvable,_not_silently_accepted
  Scenario: An export that is not a Zod schema is unresolvable
    Given "test-kind" declares the validator "schemas/sdlc/health-report.ts#HEALTH_CHECKS"
    When resolveKindValidator resolves "test-kind"
    Then the state is "unresolvable"
    And the reason says it is not a Zod schema or that the export is missing

  @test:schemas/kind-validator.test.ts::resolveKindValidator_—_three_states::an_unknown_kind_is_unresolvable_rather_than_undeclared
  Scenario: An unknown kind is unresolvable rather than undeclared
    Given a registry that holds only "test-kind"
    When resolveKindValidator resolves the kind "ghost"
    Then the state is "unresolvable"

  @test:schemas/kind-validator.test.ts::this_instance's_own_kinds::every_declared_validator_resolves,_and_the_count_is_not_asserted
  Scenario: Every validator this instance declares resolves
    Given this instance's own graph kinds
    When the check-kind-validators sweep runs over the instance
    Then no kind is unresolvable
    And at least one kind is resolved or undeclared
    And "qa" is not listed as undeclared
    And the resolved list contains "qa (per $schema family)"

  @test:schemas/kind-validator.test.ts::kindForPath::the_LONGEST_matching_directory_wins,_because_declarations_nest
  Scenario: The longest matching declared directory decides a file's kind
    Given declared directories "beans/" of kind "beans" and "beans/defs/" of kind "bean-defs"
    And a file "beans/defs/a.md" under a temporary root
    When kindForPath looks up that file
    Then the kind is "bean-defs"

  @test:schemas/kind-validator.test.ts::kindForPath::a_directory_declaring_SEVERAL_graphs_yields_nothing,_rather_than_guessing
  Scenario: A directory declaring several graph kinds yields no kind
    Given the directory "schemas/" declared with the kinds "schemas" and "cat-harness"
    When kindForPath looks up "schemas/x.ts" under the root
    Then no kind is returned

  @test:schemas/kind-validator.test.ts::kindForPath::a_path_outside_the_root_belongs_to_no_kind
  Scenario: A path outside the root belongs to no kind
    Given the root "/tmp/x" with "a/" declared as kind "beans"
    When kindForPath looks up "/etc/passwd"
    Then no kind is returned

  @test:schemas/kind-validator.test.ts::per-family_node_schemas_(bean_rdkm)::qa_names_every_family,_and_each_resolves_to_a_schema,_a_shape,_or_a_recorded_absence
  Scenario: The qa kind names every $schema family and none is unresolvable
    Given the harness's "qa" kind
    When resolveNodeSchemas lists its families
    Then the sorted family tags are exactly the 14 expected tags, from "block-qa/v1" to "viewer-nav-qa/v1"
    And no family is unresolvable
    And "kg-qa/v1", "kg-qa-manifest/v1" and "folio-qa-index/v1" are resolved
    And "qa-witness/v1" is a shape

  @test:schemas/kind-validator.test.ts::per-family_node_schemas_(bean_rdkm)::a_shape_is_read_from_source,_fields_and_optionality_included
  Scenario: A TypeScript interface shape is read from source with field optionality
    Given a module "m.ts" exporting the interface Thing with a required string "id" and an optional number "note"
    When readShape reads "m.ts#Thing"
    Then it returns the reference and both fields with their names, types and optionality
    And reading "m.ts#Missing" returns an error string

  @test:schemas/kind-validator.test.ts::per-family_node_schemas_(bean_rdkm)::kg-validate_routes_a_qa_node_by_its_$schema_tag
  Scenario: kg-validate routes a qa node by its $schema tag
    Given fixture files planted in a temporary directory under "test/results"
    And a well-formed "kg-qa/v1" node with tallied totals
    And a node tagged "qa-witness/v1"
    When validatePath checks each fixture
    Then the kg-qa node is "valid"
    And the qa-witness node is "undetermined" because its family is only a TypeScript shape

  @test:schemas/kind-validator.test.ts::instance-qualified_references_(bean_quda)::`name:module#Export`_resolves_through_the_instance_that_declares_the_name
  Scenario: An instance-qualified reference names its instance, and rootOf finds that instance
    Given the reference "folio-assistant-core:schemas/catalogue.ts#CatalogueSchema"
    When parseValidatorRef reads it
    Then it yields instance "folio-assistant-core", module "schemas/catalogue.ts" and export "CatalogueSchema"
    And rootOf "folio-assistant-core" is the sibling directory of the harness root
    And rootOf an unknown instance is undefined
    And rootOf no instance is the harness root itself

  @test:schemas/kind-validator.test.ts::instance-qualified_references_(bean_quda)::the_running_layer's_own_name_resolves_where_no_sibling_search_reaches_it_(bean_w1gy)
  Scenario: The running layer's own name resolves from a standalone checkout
    Given a temporary standalone checkout "alone" with its own ".git" and declaration
    When rootOf is asked for names from that checkout
    Then "cat-harness-tools" and "litlfred/cat-harness-tools" resolve to this layer's root
    And "alone" resolves to the standalone checkout
    And "folio-assistant-core" is undefined

  @test:schemas/kind-validator.test.ts::instance-qualified_references_(bean_quda)::the_harness's_slice_validators,_which_name_this_layer,_resolve_(bean_w1gy)
  Scenario: The slice validators that name cat-harness-tools resolve
    Given "test-kind" declaring "cat-harness-tools:scripts/gen-slice-sqlite.ts#SliceIndexKind"
    And "test-kind" declaring "cat-harness-tools:scripts/gen-slice-sqlite.ts#SliceManifestKind"
    When resolveKindValidator resolves each
    Then each state is "resolved"

  @test:schemas/kind-validator.test.ts::instance-qualified_references_(bean_quda)::an_escaping_path_is_still_refused_—_the_name_is_the_only_way_out
  Scenario: A parent-escaping path to a sibling is still refused
    Given the reference "../folio-assistant-core/schemas/catalogue.ts#CatalogueSchema"
    When parseValidatorRef reads it
    Then it throws

  @test:schemas/kind-validator.test.ts::instance-qualified_references_(bean_quda)::top-level_`_`_annotations_are_dropped_before_a_node_is_checked
  Scenario: Top-level underscore annotations are stripped, nested ones kept
    Given the node with "_comment", "a" and a nested object holding "_keep"
    When stripAnnotations runs on it
    Then "_comment" is dropped and the nested "_keep" stays
    And an array is returned unchanged
