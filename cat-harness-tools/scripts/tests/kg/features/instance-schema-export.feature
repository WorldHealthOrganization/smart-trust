# What scripts/tests/kg/instance-schema-export.test.ts covers: scripts/harness-schema-export.ts builds each layer's
# published schema directory (skill I/O contracts, an index, and public Zod schemas) under that layer's own identity.
# Each Scenario names the test that executes it.
Feature: Each layer publishes its own schema directory

  @test:scripts/tests/kg/instance-schema-export.test.ts::the_schema_base_sits_beside_the_instance's_document::an_instance_published_under_this_site:_<site>/<stub>/schema
  Scenario: An instance published under this site has its schema base at <site>/<stub>/schema
    Given an instance identity with stub "fx" and base "https://site.example/pub"
    When its schema base and index IRI are computed
    Then the base is "https://site.example/pub/fx/schema"
    And the index IRI is "https://site.example/pub/fx/schema/fx.schema.json"

  @test:scripts/tests/kg/instance-schema-export.test.ts::the_schema_base_sits_beside_the_instance's_document::an_instance_with_its_own_canonicalUrl:_<canonicalUrl>/schema_—_its_publication_identity,_not_the_staging_path
  Scenario: An instance with its own canonicalUrl has its schema base under that URL
    Given an instance identity with base "https://own.example/fx" and doc path "fx.jsonld"
    When its schema base is computed
    Then it is "https://own.example/fx/schema"

  @test:scripts/tests/kg/instance-schema-export.test.ts::the_schema_base_sits_beside_the_instance's_document::no_base:_no_$id_at_all,_never_a_relative_one
  Scenario: An instance with no base gets no $id at all
    Given an instance identity with an empty base
    When its schema base and index IRI are computed
    Then the base is the empty string
    And the index IRI is undefined

  @test:scripts/tests/kg/instance-schema-export.test.ts::buildInstanceSchemas_over_a_fixture_instance::contracts_are_read_from_that_instance,_and_their_$id_is_computed,_never_trusted_from_the_file
  Scenario: Contracts are read from the instance and their $id is computed, not trusted
    Given a fixture instance holding widget input and output contracts, the input carrying a wrong hand-written $id
    When its schemas are built
    Then both contracts are listed with their "schemas/skills/widget" source and "skills/widget" published paths
    And each contract's $id is the computed skill I/O IRI under "<site>/fx/schema"
    And the input contract keeps its own "type" of "object"

  @test:scripts/tests/kg/instance-schema-export.test.ts::buildInstanceSchemas_over_a_fixture_instance::the_index_$refs_the_SHARED_declaration_schema_and_lists_every_contract_by_$id
  Scenario: The index refs the shared declaration schema and lists every contract by $id
    Given the fixture instance published under the site
    When its schemas are built with the site as base URL
    Then the first file is "fx.schema.json" with the index IRI as its $id
    And its allOf is a single $ref to the shared declaration schema's $id
    And its $defs map "skills/widget/input" and "skills/widget/output" to their contract IRIs
    And its omitted list is ["schemas"]
    And its $comment names the instance graph document
    And the files are the index followed by each contract's published path

  @test:scripts/tests/kg/instance-schema-export.test.ts::buildInstanceSchemas_over_a_fixture_instance::with_no_base_the_index_still_lists_every_contract,_by_the_path_both_share
  Scenario: With no base the index still lists every contract by its relative path
    Given the fixture instance with an empty base
    When its schemas are built
    Then the index and every contract have no $id
    And the index $defs refs are "skills/widget/input.schema.json" and "skills/widget/output.schema.json"

  @test:scripts/tests/kg/instance-schema-export.test.ts::buildInstanceSchemas_over_a_fixture_instance::an_instance_with_no_contracts_still_gets_an_index
  Scenario: An instance with no contracts still gets an index
    Given an empty instance directory with stub "e"
    When its schemas are built
    Then there are no contracts
    And the only file is "e.schema.json"

  @test:scripts/tests/kg/instance-schema-export.test.ts::the_host's_schema_outputs_are_unchanged_by_the_generalisation::the_default_root_IS_the_host:_same_contracts,_same_$ids,_same_paths
  Scenario: The default root is the host, with unchanged contracts, $ids and paths
    Given the host instance's canonical URL as base
    When skill I/O contracts are built by default and with the host as explicit root
    Then there is at least one contract and both builds are equal
    And each contract's source is "schemas/skills/<skill>/<io>.schema.json" and published path "skills/<skill>/<io>.schema.json"
    And each $id is the skill I/O IRI under the host schema base
    And each contract has the same keys in the same order as its source file, differing only in $id

  @test:scripts/tests/kg/instance-schema-export.test.ts::a_real_foreign_instance_mints_under_its_OWN_base::smart-base_declares_its_own_canonicalUrl,_so_its_contracts_are_under_it_—_not_under_this_site
  Scenario: smart-base mints its contracts under its own canonicalUrl, not this site
    # Skipped: unless run inside the aggregate checkout (inAggregate())
    Given the smart-base layer, which declares a canonicalUrl
    When its published schemas are built for the site
    Then it has at least one contract
    And every contract $id is under "<canonicalUrl>/schema" and none starts with the site

  @test:scripts/tests/kg/instance-schema-export.test.ts::a_real_foreign_instance_mints_under_its_OWN_base::folio-assistant-core_has_no_base_of_its_own,_so_it_publishes_under_the_given_site,_in_its_own_segment
  Scenario: folio-assistant-core publishes under the given site in its own segment
    # Skipped: unless run inside the aggregate checkout (inAggregate())
    Given the folio-assistant-core layer, which has no base of its own
    When its published schemas are built for the site
    Then it has at least one contract, each with $id under "<site>/folio-assistant-core/schema"
    And its index IRI is the one derived from its published identity

  @test:scripts/tests/kg/instance-schema-export.test.ts::a_real_foreign_instance_mints_under_its_OWN_base::folio-assistant-sci's_contracts_are_found_although_its_declared_`schemas`_graph_is_`sources/`
  Scenario: folio-assistant-sci's contracts are found although its schemas graph is sources/
    # Skipped: unless run inside the aggregate checkout (inAggregate())
    Given the folio-assistant-sci layer
    When its published schemas are built for the site
    Then it has at least one contract

  @test:scripts/tests/kg/instance-schema-export.test.ts::public_Zod_schemas_over_a_fixture_instance::only_an_exported_Zod_*Schema_is_public:_FooSchema_rendered;_fooShape_misnamed;_BarSchema_and_notASchema_not_Zod
  Scenario: Only an exported Zod value named *Schema is a public schema
    Given a fixture whose schemas/widgets.ts exports FooSchema (Zod), fooShape (Zod), notASchema (a string) and BarSchema (a plain object), and a widgets.test.ts module
    When its Zod schemas are scanned
    Then the scan is determined over the "schemas" directory
    And the only schema found is "schemas/widgets.ts#FooSchema"
    And BarSchema (object) and notASchema (string) are listed as not Zod, with no problems
    When the instance schemas are built from that scan
    Then the only Zod output is "zod/widgets/FooSchema.schema.json", with its $id under the instance schema base
    And it refs "#/definitions/Foo" whose properties are a string "a"
    And the index lists it in $defs, with no omitted and no unrendered entries

  @test:scripts/tests/kg/instance-schema-export.test.ts::public_Zod_schemas_over_a_fixture_instance::an_import_failure,_an_unrepresentable_schema_and_a_safeParse-only_fake_are_each_reported,_and_the_rest_still_renders
  Scenario: Import failures, unrepresentable schemas and safeParse-only fakes are each reported
    Given a fixture with widgets.ts, a broken.ts that throws at import, and an odd.ts exporting a z.date() WhenSchema and a safeParse-only FakeSchema
    When its Zod schemas are scanned
    Then exactly one problem says "schemas/broken.ts: could not be imported: boom at import"
    When the instance schemas are built from that scan
    Then there are three Zod problems, including WhenSchema "Date cannot be represented" and FakeSchema "not a zod-4 schema"
    And FooSchema is still rendered
    And the index's unrendered list equals the Zod problems

  @test:scripts/tests/kg/instance-schema-export.test.ts::public_Zod_schemas_over_a_fixture_instance::an_undetermined_scan_keeps_`omitted`,_and_its_reason_reaches_the_index
  Scenario: An undetermined scan keeps omitted and its reason reaches the index
    Given a scan that is not determined with the problem "the schemas directory could not be resolved: x"
    When the instance schemas are built from it
    Then the build is not marked as Zod-scanned
    And the index omits ["schemas"] and lists that problem as unrendered

  @test:scripts/tests/kg/instance-schema-export.test.ts::public_Zod_schemas_over_a_fixture_instance::the_JSON-LD's_`omitted`_asks_the_scan's_own_question,_without_importing:_determined_exactly_when_the_scan_is
  Scenario: The JSON-LD's determined check agrees with the scan without importing
    Given a readable fixture instance and an instance whose declaration's directories is not a list
    When determinedness is asked both without importing and by scanning
    Then both answers are true for the readable instance
    And both are false for the broken one

  @test:scripts/tests/kg/instance-schema-export.test.ts::public_Zod_schemas_over_a_fixture_instance::an_instance_with_no_schemas_directory_is_a_determined_zero
  Scenario: An instance with no schemas directory is a determined zero
    Given an empty instance directory
    When its Zod schemas are scanned
    Then the scan is determined with nothing found and no problems

  @test:scripts/tests/kg/instance-schema-export.test.ts::every_planned_instance's_public_Zod_schemas_render_(real_corpus)::every_planned_instance_is_scanned,_with_no_import_or_render_failure
  Scenario: Every planned instance is scanned with no import or render failure
    # Skipped: unless run inside the aggregate checkout (inAggregate())
    Given every instance in the export plan of the real checkout
    When each one's schemas are built with a scan
    Then each is Zod-scanned with no problems

  @test:scripts/tests/kg/instance-schema-export.test.ts::every_planned_instance's_public_Zod_schemas_render_(real_corpus)::the_instances_measured_on_2026-10-05_with_Zod_schema_modules_publish_some;_sources/-declared_ones_publish_none
  Scenario: Layers with Zod schema modules publish some and sources/-declared layers publish none
    # Skipped: unless run inside the aggregate checkout (inAggregate())
    Given every instance in the export plan of the real checkout
    When the Zod schemas each publishes are counted
    Then bootstrap-tools, fhir-harness, folio-assistant-core and smart-base each publish more than zero
    And folio-assistant-sci and who-iris each publish exactly zero
