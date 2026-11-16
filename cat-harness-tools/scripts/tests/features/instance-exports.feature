# scripts/instance-exports.ts plans one published graph per declared layer, and
# scripts/check-published-instance-exports.ts gates that the deploy workflows publish every
# planned graph, its contracts and its Zod schemas. Each Scenario names the test that executes it.
Feature: One published graph per declared layer

  @test:scripts/tests/instance-exports.test.ts::the_plan_is_the_declarations,_partitioned::every_declared_instance_is_exactly_one_of:_planned,_published_elsewhere,_or_declared_not_published
  Scenario: Every declared instance is exactly one of planned, published elsewhere or not published
    Given the checkout's declared instances and its export plan
    When each declared stub is classified
    Then each is in exactly one of the plan, the published-elsewhere exemptions, or the declarations with publishing disabled

  @test:scripts/tests/instance-exports.test.ts::the_plan_is_the_declarations,_partitioned::the_instances_this_bean_found_unpublished_are_in_it
  Scenario: The instances found unpublished are in the plan
    Given the checkout's export plan
    Then it includes "smart-base", "who-iris", "folio-assistant-core" and "fhir-harness"

  @test:scripts/tests/instance-exports.test.ts::the_plan_is_the_declarations,_partitioned::an_instance_with_its_own_canonical_URL_is_marked_so,_and_one_without_is_not
  Scenario: An instance with its own canonical URL is marked so in the plan
    Given the checkout's export plan
    Then "smart-base" is marked as having its own canonical URL
    And "who-iris" is not

  @test:scripts/tests/instance-exports.test.ts::a_plan_line_expands_to_one_invocation_per_planned_instance::without_a_base,_nothing_stands_in
  Scenario: A plan line without a base URL expands with no stand-in base
    Given a plan of instance "a" and instance "b", which has its own canonical URL
    When a plan line with no base URL is expanded
    Then it yields "./a" and "./b", neither standing in for the base
    And every yielded invocation is marked as planned

  @test:scripts/tests/instance-exports.test.ts::a_plan_line_expands_to_one_invocation_per_planned_instance::with_a_base,_it_stands_in_only_where_the_publisher_passes_it
  Scenario: A plan line with a base URL stands it in only for instances without their own canonical URL
    Given a plan of instance "a" and instance "b", which has its own canonical URL
    When a plan line passing "--base-url" is expanded
    Then "./a" stands in the base and "./b" does not

  @test:scripts/tests/instance-exports.test.ts::a_plan_line_expands_to_one_invocation_per_planned_instance::a_workflow_with_no_plan_line_never_asks_for_the_plan
  Scenario: A workflow line that is not a plan line never asks for the plan
    Given a workflow line that runs kg-export.ts for one instance
    When it is expanded
    Then the plan is never requested

  @test:scripts/tests/instance-exports.test.ts::completeness_—_bean_4ak5_item_5::a_deploy_running_every_publisher_is_complete
  Scenario: A deploy running every publisher is complete
    Given a deploy workflow running the plan line, the cat-harness publisher and the bootstrap publisher
    When its completeness is checked
    Then there are no findings

  @test:scripts/tests/instance-exports.test.ts::completeness_—_bean_4ak5_item_5::a_deploy_without_the_plan_line_is_incomplete_—_the_state_this_bean_found
  Scenario: A deploy without the plan line is incomplete
    Given a deploy workflow without the plan line
    When its completeness is checked
    Then a finding says it "does not run `instance-exports.ts --out-dir`"

  @test:scripts/tests/instance-exports.test.ts::completeness_—_bean_4ak5_item_5::dropping_an_exempt_instance's_own_publisher_leaves_it_published_by_nobody
  Scenario: Dropping an exempt instance's own publisher leaves it published by nobody
    Given, for each published-elsewhere exemption, a deploy workflow without that instance's publisher
    When its completeness is checked
    Then there is exactly one finding, saying that stub is exempt

  @test:scripts/tests/instance-exports.test.ts::completeness_—_bean_4ak5_item_5::the_host_publisher_is_accepted_with_the_default_scope_and_with_`instance`,_never_`checkout`
  Scenario: The host publisher is accepted with the default or instance scope, never checkout
    Given a deploy workflow whose cat-harness publisher line is varied
    Then the default scope, and "--scope instance" with a base URL, are both complete
    And "--scope checkout" yields a finding that "cat-harness" is exempt
    And an output at the old root path "./_site/${STUB}.jsonld" is accepted
    And an output under any other directory yields a finding that "cat-harness" is exempt

  @test:scripts/tests/instance-exports.test.ts::completeness_—_bean_4ak5_item_5::a_publisher_named_only_in_a_COMMENT_is_not_a_publisher
  Scenario: A publisher named only in a comment is not a publisher
    Given a deploy workflow whose bootstrap publisher appears only in a commented-out line
    When its completeness is checked
    Then a finding says "bootstrap" is exempt

  @test:scripts/tests/instance-exports.test.ts::completeness_—_bean_4ak5_item_5::an_exemption_naming_no_declared_instance_is_a_finding,_not_a_pass
  Scenario: An exemption naming no declared instance is a finding, not a pass
    Given at least one published-elsewhere exemption
    And, for each, a declared set without that stub
    When a complete deploy workflow is checked against it
    Then a finding says that stub is one "which no instance in this checkout declares"

  @test:scripts/tests/instance-exports.test.ts::completeness_—_bean_4ak5_item_5::the_REAL_workflows_are_complete
  Scenario: The real deploy and feature-staging workflows are complete
    Given the repository's real deploy workflow and feature-staging.yml
    When their completeness is checked against the checkout's declared instances
    Then there are no findings

  @test:scripts/tests/instance-exports.test.ts::every_contract_a_planned_instance's_skills_name_reaches_its_schema/::the_deploy's_own_publisher_leaves_nothing_out
  Scenario: The deploy's own publisher leaves no planned instance's contract unpublished
    # Skipped: when the layers are not checked out together
    Given the checkout's export plan
    When its instance schemas are checked against the deploy's publisher
    Then there are no findings

  @test:scripts/tests/instance-exports.test.ts::every_contract_a_planned_instance's_skills_name_reaches_its_schema/::the_instances_measured_on_2026-10-05_with_unpublished_contracts_now_publish_them
  Scenario: The instances measured with unpublished contracts now publish them
    # Skipped: when the layers are not checked out together
    Given the checkout's export plan
    When each instance's published contracts are counted
    Then "folio-assistant-core", "fhir-harness", "folio-assistant-sci" and "smart-base" each publish at least one

  @test:scripts/tests/instance-exports.test.ts::every_contract_a_planned_instance's_skills_name_reaches_its_schema/::FALSIFIED:_a_publisher_that_drops_a_contract_fails_the_gate,_naming_it
  Scenario: A publisher that drops a contract fails the gate, naming it
    # Skipped: when the layers are not checked out together
    Given a publisher that drops each instance's first contract and its file
    When the plan's instance schemas are checked against it
    Then a finding says a contract is one "which the publisher does not write into"
    And the findings name "folio-assistant-sci"

  @test:scripts/tests/instance-exports.test.ts::every_contract_a_planned_instance's_skills_name_reaches_its_schema/::FALSIFIED:_a_publisher_that_writes_no_index_fails_the_gate
  Scenario: A publisher that writes no index fails the gate
    # Skipped: when the layers are not checked out together
    Given a publisher that drops the first written file, the index
    When the first planned instance is checked against it
    Then there is exactly one finding, naming that instance's "<stub>.schema.json" index

  @test:scripts/tests/instance-exports.test.ts::every_contract_a_planned_instance's_skills_name_reaches_its_schema/::the_document_links_an_index_exactly_for_the_planned_instances_—_the_plan_is_the_one_answer
  Scenario: The document links a schema index exactly for the planned instances
    # Skipped: when the layers are not checked out together
    Given the checkout's export plan
    Then every planned instance publishes an instance schema
    And the checkout root, cat-harness and bootstrap do not

  @test:scripts/tests/instance-exports.test.ts::an_exported_Zod_*Schema_the_publisher_would_not_write_fails_the_gate::the_deploy's_own_publisher_writes_it:_no_finding,_and_the_non-Zod_BarSchema_is_not_one
  Scenario: The deploy's own publisher writes an exported Zod schema, and a non-Zod one is not a finding
    Given a fixture layer exporting the Zod "FooSchema" and the plain object "BarSchema"
    When its Zod schemas are checked against the deploy's own publisher
    Then there are no findings

  @test:scripts/tests/instance-exports.test.ts::an_exported_Zod_*Schema_the_publisher_would_not_write_fails_the_gate::FALSIFIED:_a_publisher_that_drops_the_rendering_is_named
  Scenario: A publisher that drops a Zod rendering is named
    Given the fixture layer exporting the Zod "FooSchema"
    And a publisher that writes no Zod renderings
    When its Zod schemas are checked
    Then the only finding is that "schemas/widgets.ts#FooSchema" is not written to "<stub>/schema/zod/widgets/FooSchema.schema.json"

  @test:scripts/tests/instance-exports.test.ts::an_exported_Zod_*Schema_the_publisher_would_not_write_fails_the_gate::FALSIFIED:_a_publisher_that_did_not_scan,_or_reports_a_failure,_fails_the_gate
  Scenario: A publisher that did not scan, or reports a failure, fails the gate
    Given the fixture layer exporting the Zod "FooSchema"
    When it is checked against a publisher that did not scan for Zod schemas
    Then a finding says "the publisher did not scan"
    And when it is checked against a publisher reporting "schemas/x.ts: could not be imported: boom"
    Then that failure is the only finding, prefixed by the layer's root

  @test:scripts/tests/instance-exports.test.ts::a_re-exported_Zod_*Schema_is_read_from_the_text_too::every_value-export_form_yields_the_name_the_importer_gets;_`type`_exports_and_bare_`export_*`_do_not
  Scenario: Every value-export form yields the exported name, while type exports and bare export star do not
    Given module text with a direct export, a local export list, renamed, multi-line and default re-exports, type-only exports, a namespace re-export and "export type *"
    When its declared export names are read
    Then they are "DirectSchema", "LocalSchema", "other", "RenamedSchema", "MultiLineSchema", "DefaultSchema" and "NamespaceSchema"
    And no bare "export *" is reported
    And text with a bare "export * from" is reported as a star export

  @test:scripts/tests/instance-exports.test.ts::a_re-exported_Zod_*Schema_is_read_from_the_text_too::the_deploy's_own_publisher_writes_every_re-export,_so_the_only_finding_is_the_undetermined_`export_*`
  Scenario: The deploy's own publisher writes every re-export, leaving only the undetermined export star
    Given a fixture layer whose relay.ts exports a local and a renamed re-exported Zod schema plus a type-only one
    And whose star.ts has a bare "export * from"
    When its Zod schemas are checked against the deploy's own publisher
    Then the only finding is that star.ts's bare "export * from" cannot be read, asking for an "export { … }" list

  @test:scripts/tests/instance-exports.test.ts::a_re-exported_Zod_*Schema_is_read_from_the_text_too::FALSIFIED:_a_publisher_that_drops_the_re-exported_renderings_is_named,_one_finding_per_re-export
  Scenario: A publisher that drops the re-exported renderings is named once per re-export
    Given the fixture layer with relay.ts and star.ts
    And a publisher that writes nothing under "zod/relay/"
    When its Zod schemas are checked
    Then the findings are the export-star finding
    And "schemas/relay.ts#LocalSchema" not written to "<stub>/schema/zod/relay/LocalSchema.schema.json"
    And "schemas/relay.ts#RenamedSchema" not written to "<stub>/schema/zod/relay/RenamedSchema.schema.json"

  @test:scripts/tests/instance-exports.test.ts::every_planned_instance's_exported_Zod_*Schema_reaches_its_schema/zod/::the_deploy's_own_publisher_leaves_nothing_out,_and_reports_no_failure
  Scenario: The deploy's own publisher leaves no planned instance's Zod schema out
    # Skipped: when the layers are not checked out together
    Given the checkout's export plan
    When its Zod schemas are checked with the default publisher
    Then there are no findings

  @test:scripts/tests/instance-exports.test.ts::every_planned_instance's_exported_Zod_*Schema_reaches_its_schema/zod/::the_re-exports_measured_on_2026-10-05_are_read_from_the_text,_and_the_publisher_writes_them
  Scenario: The measured re-exports in materialization.ts are read from the text and written
    # Skipped: when the layers are not checked out together
    Given folio-assistant-core's schemas/materialization.ts
    When its declared export names are read
    Then they include "SignatureSchema", "SourceProvenanceSchema" and "FixitySchema" with no bare export star
    And the publisher writes "zod/materialization/<name>.schema.json" for each of them

  @test:scripts/tests/instance-exports.test.ts::an_instance's_published_files_are_placed_by_cat-harness's_resolver::the_segment_is_the_instance's_NAME_and_the_file_is_named_by_its_stub
  Scenario: The document's directory is the instance's name and its file is named by its stub
    When the document path for name "the-name" and stub "the-stub" is resolved
    Then it is "the-name/the-stub.jsonld"
    And the site path for "the-name" and "schema" is "the-name/schema"

  @test:scripts/tests/instance-exports.test.ts::an_instance's_published_files_are_placed_by_cat-harness's_resolver::it_is_publishedPath's_`instance`_case,_site-relative,_not_a_second_spelling_of_it
  Scenario: The document path is publishedPath's instance case, site-relative
    When the document path for name "n" and stub "s" is resolved
    Then with a leading slash it equals publishedPath's instance case for instance "n" and path "s.jsonld"

  @test:scripts/tests/instance-exports.test.ts::an_instance's_published_files_are_placed_by_cat-harness's_resolver::no_published_address_moved:_every_planned_instance's_name_is_its_stub_today
  Scenario: No published address moved because every planned instance's name is its stub
    Given the checkout's export plan
    Then every planned instance's document path is "<stub>/<stub>.jsonld"

  @test:scripts/tests/instance-exports.test.ts::an_instance_declaring_`enabled:_false`_is_not_planned::the_default_is_published,_and_`false`_leaves_it_out
  Scenario: An instance declaring enabled false is left out of the plan
    Given a fixture checkout with instance "on" declared by default and instance "off" declaring enabled false
    When the export plan is built
    Then it holds only "on"

  @test:scripts/tests/instance-exports.test.ts::an_instance_declaring_`enabled:_false`_is_not_planned::FALSIFIED:_the_same_instance_with_`enabled:_true`_is_planned_again
  Scenario: The same instance declaring enabled true is planned again
    Given the fixture checkout with instance "off" now declaring enabled true
    When the export plan is built
    Then it holds "off" and "on"

  @test:scripts/tests/instance-exports.test.ts::a_layer's_own_code_lists_are_published_beside_its_document_(#960)::each_concept_is_a_path_under_that_document_(slash_IRIs,_#1379);_a_layer_with_none_writes_nothing
  Scenario: A layer's code lists are published as paths under its own document
    Given a layer "demo" declaring a "code-lists" directory of code-list graphs
    When its code-lists document is built before the directory exists
    Then there is none
    And once "code-lists/level.json" holds code list "level" with code "high"
    Then the document's "@id" is the given document URL
    And its graph holds "<doc>/level" and "<doc>/level/high"
