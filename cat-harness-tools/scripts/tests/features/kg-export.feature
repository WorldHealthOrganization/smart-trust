# The knowledge-graph export (scripts/kg-export.ts) must be a whole, self-describing JSON-LD graph:
# every edge declared and resolvable, every self-URL published, roles, packages, tools and schemas
# linked into the documents that own them. Each Scenario names the test that executes it.
Feature: Knowledge-graph export

  @test:scripts/tests/kg-export.test.ts::kg_export::no_source_failed_to_read
  Scenario: No source fails to read during the export
    Given the export of this layer's graph
    Then its problems list is empty

  @test:scripts/tests/kg-export.test.ts::kg_export::the_graph_is_not_trivially_small_—_otherwise_every_assertion_below_is_vacuous
  Scenario: The exported graph is not trivially small
    Given the export of this layer's graph
    Then it holds more than 100 nodes
    And more than 50 Skill nodes
    And more than 5 Process nodes

  @test:scripts/tests/kg-export.test.ts::kg_export::every_skill_a_BPMN_activity_names_appears_in_the_export
  Scenario: Every skill a BPMN activity names appears in the export
    Given the export of this layer's graph
    When the skills required by every ProcessNode are collected
    Then more than 20 distinct skills are referenced
    And every referenced skill is the @id of a Skill node in the export

  @test:scripts/tests/kg-export.test.ts::kg_export::process_nodes_carry_the_edges_that_make_this_a_graph
  Scenario: Process nodes carry the performer and skill edges
    Given the ProcessNode nodes of the export
    Then more than 100 have a performedBy link
    And more than 50 require at least one skill

  @test:scripts/tests/kg-export.test.ts::kg_export::the_document_identifies_itself_—_@id,_@type,_provenance
  Scenario: The document identifies itself by @id, @type and provenance
    Given the export of this layer's graph
    Then its @id is the base, the layer name and the artefact stub with ".jsonld"
    And its @type is prov:Entity
    And it carries no generatedAt
    And its sourceTree is a 40-character hex hash

  @test:scripts/tests/kg-export.test.ts::kg_export::every_edge_term_is_declared_{"@type":_"@id"}_—_otherwise_it_is_not_a_graph
  Scenario: Every edge term is declared as an @id-typed term
    Given the export's @context
    Then each of "partOf", "requires", "performedBy", "inPackage", "declaresSkill", "startNode", "from", "to" and "holdsGraph" is declared with "@type" "@id"
    And the context has no @vocab

  @test:scripts/tests/kg-export.test.ts::kg_export::every_property_in_the_graph_is_declared_—_nothing_is_dropped_on_expansion
  Scenario: Every property in the graph is declared
    Given the export of this layer's graph
    Then its list of undeclared terms is empty

  @test:scripts/tests/kg-export.test.ts::kg_export::the_published_document_carries_no_QA_finding_—_those_live_in_test/results/
  Scenario: The published document carries no QA finding
    Given the published projection of the export
    Then it has no "undeclaredTerms", "undeclaredSchemaModules", "danglingLinks" or "problems" field
    And it still carries "counts" and "repository"

  @test:scripts/tests/kg-export.test.ts::kg_export::no_ROOT-level_field_is_undeclared_either_—_the_level_`undeclaredTerms`_cannot_see
  Scenario: No root-level field of the published document is undeclared
    Given the published projection of the export and its @context
    When its root fields are checked against the context
    Then no undeclared root term is reported

  @test:scripts/tests/kg-export.test.ts::kg_export::...and_the_root_check_FIRES,_rather_than_passing_because_it_looks_at_nothing
  Scenario: The root-level check reports what it should and nothing else
    Given the export's @context with "counts" removed
    When the published projection's root is checked against it
    Then exactly "counts" is reported
    And a root holding only "@id" and "@graph" reports nothing against an empty context
    And a root with an undeclared "somethingNew" field reports "somethingNew"

  @test:scripts/tests/kg-export.test.ts::kg_export::no_term_is_coerced_to_@id_over_values_that_are_not_IRIs
  Scenario: No term is coerced to @id over values that are not IRIs
    Given the terms the export's @context coerces to @id
    Then there are more than 10 of them
    And every string value of every such term on every node has an IRI scheme

  @test:scripts/tests/kg-export.test.ts::kg_export::a_name_is_not_carried_beside_the_link_that_already_reaches_it
  Scenario: A name is not carried beside the link that already reaches it
    Given the export of this layer's graph
    Then no node carries "implementsSkillNames", "satisfiesSkillNames", "graphTypologies", "packagePaths" or "laneName"
    And more than 100 ProcessNodes have a performer
    And every such performer is a node in the graph with a notation

  @test:scripts/tests/kg-export.test.ts::kg_export::the_graph_carries_its_own_vocabulary
  Scenario: The graph carries its own vocabulary
    Given the export of this layer's graph
    Then it holds at least 5 GraphTypology nodes, one named "folio" and renderable
    And it holds Subgraph nodes
    And every Subgraph's holdsGraph is a non-empty list of @ids present in the graph

  @test:scripts/tests/kg-export.test.ts::kg_export::every_node_has_an_@id_and_an_@type,_and_@ids_are_unique
  Scenario: Every node has a string @id and a folio @type, and @ids are unique
    Given the export of this layer's graph
    Then every node's @id is a string
    And every node's @type is in one of the folio namespaces
    And no two nodes share an @id

  @test:scripts/tests/kg-export.test.ts::kg_export::counts_agree_with_the_graph_they_summarise
  Scenario: The counts block agrees with the graph it summarises
    Given the export of this layer's graph
    When the nodes are counted by the last segment of their @type
    Then those counts equal the export's counts block

  @test:scripts/tests/kg-export.test.ts::kg_export::artefacts_are_named_after_the_repository,_the_declaration_is_not
  Scenario: Artefacts are named after the repository and the declaration after the layer
    Given this layer's declaration
    Then its artefact stub is "cat-harness"
    And the export identity's document IRI, document path and legacy IRI are built from the base, layer name and stub
    And the declaration schema's $id is the stub with ".schema.json" under the layer's directory
    And the declaration file is the layer name with ".json"
    And the declaration file is not the stub with ".config.json"

  @test:scripts/tests/kg-export.test.ts::kg_export::EVERY_declared_instance_exports_at_an_absolute_IRI_—_the_base_is_the_SITE's,_not_the_instance's
  Scenario: Every declared instance exports at an absolute IRI on the site's base
    Given every instance root in this repository
    Then there is more than one
    And every instance's export identity has a document IRI starting with "http"

  @test:scripts/tests/kg-export.test.ts::kg_export::an_instance_OUTSIDE_this_repository_gets_no_base_—_the_boundary,_not_a_prefix
  Scenario: An instance outside this repository gets no base
    Given a temporary directory outside the repository holding a declaration named "outside"
    When its export identity is computed
    Then it is not published here
    And its document IRI is not absolute
    And its base is empty

  @test:scripts/tests/kg-export.test.ts::kg_export::a_sibling_directory_whose_name_merely_EXTENDS_the_repo_root_is_outside_it
  Scenario: A sibling directory whose name merely extends the repo root is outside it
    Given the path of the repository root with "-other" appended
    When its export identity is computed
    Then it is not published here

  @test:scripts/tests/kg-export.test.ts::kg_export::an_instance_INSIDE_the_repository_still_inherits_—_the_fallback_is_narrowed,_not_removed
  Scenario: An instance inside the repository still inherits the site's base
    Given the bootstrap directory inside the repository
    When its export identity is computed
    Then it is published here
    And its document IRI is the base followed by "/bootstrap/bootstrap.jsonld"

  @test:scripts/tests/kg-export.test.ts::kg_export::a_foreign_instance's_export_reports_no_unread_source_—_the_publish_step_exits_0
  Scenario: A foreign instance's export reports no unread source
    Given the bootstrap directory inside the repository
    When its graph is exported
    Then its problems list is empty
    And its @id is this layer's base followed by "/bootstrap/bootstrap.jsonld"

  @test:scripts/tests/kg-export.test.ts::kg_export::no_canonicalUrl_and_no_base_→_no_absolute_IRI,_and_it_says_so
  Scenario: A declaration schema built with an empty base still has an absolute $id
    # Gap: the repo declares a canonicalUrl, so the case of no canonicalUrl and no base is not exercised
    When the declaration schema is built with an empty base URL
    Then its $id starts with http:// or https://

  @test:scripts/tests/kg-export.test.ts::kg_export::a_preview_says_so_in_its_type_and_links_every_node_back_to_canonical
  Scenario: A preview says so in its type and links every node back to canonical
    Given a preview export at a STAGING-shaped base and the canonical export
    Then the preview's @type is a list containing PreviewGraph
    And the preview's canonicalDocument is the canonical export's @id
    And the canonical export's @type is prov:Entity, with no canonicalDocument and no alternateOf on any node
    And the preview carries more than 900 alternateOf links
    And every alternateOf lands on a node of the canonical export

  @test:scripts/tests/kg-export.test.ts::kg_export::vocabulary_nodes_get_no_alternateOf_—_they_are_identical_in_both_graphs
  Scenario: Vocabulary nodes are minted under the namespace rather than the document
    # Gap: the absence of alternateOf on these nodes in a preview is not asserted directly
    Given the GraphTypology nodes of the export
    Then there is at least one
    And every one's @id is in a folio namespace

  @test:scripts/tests/kg-export.test.ts::source_provenance_—_what_the_graph_was_generated_FROM::the_commit_SHA_is_carried,_unabbreviated
  Scenario: The source commit SHA is carried unabbreviated
    Given the export of this layer's graph
    Then its sourceCommitSha is a 40-character hex hash

  @test:scripts/tests/kg-export.test.ts::source_provenance_—_what_the_graph_was_generated_FROM::it_is_the_commit_this_checkout_is_actually_on
  Scenario: The source commit is the commit this checkout is on
    Given the HEAD commit of this checkout
    Then the export's sourceCommitSha equals it

  @test:scripts/tests/kg-export.test.ts::source_provenance_—_what_the_graph_was_generated_FROM::the_commit_is_a_dereferenceable_IRI,_typed_prov:wasDerivedFrom
  Scenario: The source commit is a dereferenceable IRI typed prov:wasDerivedFrom
    Given a throwaway git repository with a known origin
    When its source provenance is read
    Then the commit IRI contains the SHA and is a GitHub or GitLab commit URL
    And the export's sourceCommit equals the provenance read from this checkout
    And the context declares sourceCommit as an @id-typed term whose IRI ends in "wasDerivedFrom"

  @test:scripts/tests/kg-export.test.ts::source_provenance_—_what_the_graph_was_generated_FROM::the_commit's_own_time_is_carried,_and_the_export_stamps_no_time_of_its_own
  Scenario: The commit's own time is carried and the export stamps no time of its own
    Given the export of this layer's graph
    Then it carries sourceCommitAt
    And it carries no generatedAt

  @test:scripts/tests/kg-export.test.ts::source_provenance_—_what_the_graph_was_generated_FROM::the_recorded_tree_is_the_tree_this_checkout's_HEAD_is_on
  Scenario: The recorded tree is the tree this checkout's HEAD is on
    Given the tree hash of this checkout's HEAD
    Then the export's sourceTree equals it

  @test:scripts/tests/kg-export.test.ts::source_provenance_—_what_the_graph_was_generated_FROM::a_dirty_tree_is_a_typed_flag,_NOT_a_`problems`_entry
  Scenario: A dirty tree is a typed flag rather than a problems entry
    Given the export of this layer's graph
    Then sourceTreeDirty is a boolean
    And no problem mentions uncommitted or dirty

  @test:scripts/tests/kg-export.test.ts::source_provenance_—_what_the_graph_was_generated_FROM::an_absent_SHA_carries_its_own_reason,_not_a_placeholder
  Scenario: An absent SHA carries its own reason rather than a placeholder
    Given the export of this layer's graph
    Then exactly one of sourceCommitSha and sourceCommitUnavailable is present

  @test:scripts/tests/kg-export.test.ts::source_provenance_—_what_the_graph_was_generated_FROM::every_provenance_term_is_declared_in_@context
  Scenario: Every provenance term is declared in @context
    Given the export's @context
    Then "sourceCommit", "sourceCommitSha", "sourceCommitAt" and "sourceTreeDirty" are each declared

  @test:scripts/tests/kg-export.test.ts::source_provenance_—_what_the_graph_was_generated_FROM::provenance:_false_skips_source_provenance_for_@graph-only_callers_(slice:sqlite,_subgraph:jsonld)
  Scenario: provenance false skips source provenance for graph-only callers
    When bootstrap's graph is exported at instance scope with provenance off
    Then it carries no sourceCommit, sourceCommitSha, sourceCommitAt, sourceTreeDirty or sourceCommitUnavailable
    And its @graph is not empty

  @test:scripts/tests/kg-export.test.ts::every_self-URL_the_export_publishes_resolves_to_something_published::no_absolute_self-URL_names_a_path_the_deploy_does_not_write
  Scenario: No absolute self-URL names a path the deploy does not write
    # Skipped: when cat-harness stands alone outside the aggregate checkout
    Given the canonical export
    And the set of paths the deploy writes, built from the declaration, the export plan, the tool folders, the workflow SVGs and the subject documents
    When every string in the export starting with the base URL is collected, fragment stripped
    Then every such path is in the published set

  @test:scripts/tests/kg-export.test.ts::every_self-URL_the_export_publishes_resolves_to_something_published::nothing_published_still_names_the_retired_`kg/`_directory
  Scenario: Nothing published still names the retired kg/ directory
    Given the canonical export serialised as JSON
    Then it does not contain "github.io/folio-assistant/kg/"
    And it does not contain a value starting with "/kg/"

  @test:scripts/tests/kg-export.test.ts::a_Role_comes_from_the_registry;_a_lane_is_a_Lane_that_binds_one::both_are_present,_and_every_Role_is_a_registry_role
  Scenario: Roles and lanes are both present and every Role is a registry role
    Given the Role and Lane nodes of the export
    Then there are more than 20 registry roles
    And more than 50 lanes
    And no Role has a source kind other than "role-registry"

  @test:scripts/tests/kg-export.test.ts::a_Role_comes_from_the_registry;_a_lane_is_a_Lane_that_binds_one::every_lane_is_part_of_its_process_and_binds_a_registry_role
  Scenario: Every lane is part of its process and binds a registry role
    Given the Lane nodes of the export
    Then every lane is partOf a Process node
    And every lane's bindsRole is a registry role

  @test:scripts/tests/kg-export.test.ts::a_Role_comes_from_the_registry;_a_lane_is_a_Lane_that_binds_one::an_activity_is_performed_by_a_registry_role,_in_a_lane
  Scenario: An activity is performed by a registry role in a lane
    Given the ProcessNodes with a performer
    Then there are more than 100
    And every performer is a registry role
    And every one has an inLane that is a Lane node

  @test:scripts/tests/kg-export.test.ts::a_Role_comes_from_the_registry;_a_lane_is_a_Lane_that_binds_one::every_role_the_registry_declares_is_a_node
  Scenario: Every role the registry declares is a node
    Given the roles the scenarios role graph declares
    Then there are more than 20
    And every declared role id is the notation of a registry Role node

  @test:scripts/tests/kg-export.test.ts::a_Role_comes_from_the_registry;_a_lane_is_a_Lane_that_binds_one::a_role_a_machine_plays_still_reaches_the_graph
  Scenario: A role a machine plays still reaches the graph
    Given the registry roles of the export
    Then roles "corpus", "work-plan" and "log" are present
    And none of them carries actedUpon

  @test:scripts/tests/kg-export.test.ts::a_Role_comes_from_the_registry;_a_lane_is_a_Lane_that_binds_one::the_registry_view_joins_the_lane_view_rather_than_replacing_it
  Scenario: The registry view joins the lane view rather than replacing it
    Given the registry role "user"
    Then at least one node binds that role
    And the registry role "log" has no bindsLane
    And the "log" role's skills include the activity-log skill node

  @test:scripts/tests/kg-export.test.ts::a_Role_comes_from_the_registry;_a_lane_is_a_Lane_that_binds_one::`judgementOnly`_is_published,_and_the_retired_`actedUpon`_is_not
  Scenario: judgementOnly is published and the retired actedUpon is not
    Given the registry roles of the export
    Then "stakeholder" is judgementOnly and carries no actedUpon
    And "corpus" carries no judgementOnly

  @test:scripts/tests/kg-export.test.ts::a_role_node_merged_from_kg-export_and_glossary-export_has_one_name::the_two_exports_do_meet_on_role_IRIs
  Scenario: The kg export and the glossary export meet on role IRIs
    Given the role nodes of the kg export and of the glossary export, expanded and merged
    Then more than 20 role IRIs appear in both

  @test:scripts/tests/kg-export.test.ts::a_role_node_merged_from_kg-export_and_glossary-export_has_one_name::no_merged_role_node_carries_two_different_labels
  Scenario: No merged role node carries two different labels
    Given the role nodes shared by the kg export and the glossary export, expanded and merged
    When each node's rdfs:label, skos:prefLabel and dcterms:title values are gathered
    Then each shared node has exactly one distinct name

  @test:scripts/tests/kg-export.test.ts::a_role_node_merged_from_kg-export_and_glossary-export_has_one_name::the_id_is_a_notation_and_never_a_label,_in_either_export
  Scenario: A role's id is a notation and never a label in either export
    Given the role nodes shared by the kg export and the glossary export, expanded and merged
    Then no shared node carries rdfs:label
    And each shared node's skos:notation is exactly the last path segment of its IRI

  @test:scripts/tests/kg-export.test.ts::a_package's_id_is_declared,_not_derived_from_its_path::no_two_packages_share_an_@id_—_a_collision_is_not_a_merge
  Scenario: No two packages share an @id
    Given the SkillPackage nodes of the export
    Then no two share an @id

  @test:scripts/tests/kg-export.test.ts::a_package's_id_is_declared,_not_derived_from_its_path::in_the_PUBLISHED_graph_the_witness_is_gone:_nothing_forwards_it_(clean_break,_#1378)
  Scenario: In the published graph the who-iris package witness is gone and nothing forwards it
    # Skipped: when cat-harness stands alone outside the aggregate checkout
    Given the published graph of this layer
    Then no node's @id ends in "#package/who-iris" or "/package/who-iris"

  @test:scripts/tests/kg-export.test.ts::a_package's_id_is_declared,_not_derived_from_its_path::a_directory_with_NO_manifest_falls_back_to_its_basename,_and_says_so
  Scenario: A package directory with no manifest is named after its basename
    # Gap: when every package declares a manifest the test only logs a note and asserts nothing
    Given the SkillPackage nodes marked as having no manifest
    Then each one's name is the last segment of its path

  @test:scripts/tests/kg-export.test.ts::a_package's_id_is_declared,_not_derived_from_its_path::every_package_with_a_manifest_is_named_what_that_manifest_says
  Scenario: Every package with a manifest is named what that manifest says
    Given the SkillPackage nodes marked as having a manifest
    Then each one's id after "/package/" equals its name

  @test:scripts/tests/kg-export.test.ts::exporting_ANOTHER_instance's_graph::it_takes_the_OTHER_instance's_identity
  Scenario: Exporting another instance takes that instance's identity
    When bootstrap's graph is exported at the preview base
    Then its @id is the preview base followed by "/bootstrap/bootstrap.jsonld"

  @test:scripts/tests/kg-export.test.ts::exporting_ANOTHER_instance's_graph::and_the_other_instance's_CONTENT_—_not_this_one's_under_that_name
  Scenario: Exporting another instance gives that instance's content rather than this one's
    Given this layer's export and bootstrap's export at the same preview base
    Then bootstrap's graph is non-empty and less than a quarter the size of this layer's
    And it holds the node "bootstrap/skill/discussion" under the preview base

  @test:scripts/tests/kg-export.test.ts::exporting_ANOTHER_instance's_graph::it_emits_no_link_to_a_collector_it_did_not_run
  Scenario: Exporting another instance emits no link to a collector it did not run
    Given bootstrap's export at the preview base
    Then it has no dangling links
    And no node carries inPackage

  @test:scripts/tests/kg-export.test.ts::exporting_ANOTHER_instance's_graph::a_Tool_satisfying_a_sibling's_skill_links_into_the_SIBLING's_document
  Scenario: A Tool satisfying a sibling's skill links into the sibling's document
    Given this layer's export at the preview base
    When the Tool node "discuss" is found by its tool IRI
    Then it satisfies exactly bootstrap's "skill/discussion" under the preview base

  @test:scripts/tests/kg-export.test.ts::exporting_ANOTHER_instance's_graph::a_skill_THIS_instance_also_declares_stays_here
  Scenario: A skill this instance also declares stays in this document
    Given this layer's export at the preview base
    And the published document IRIs of every other instance in the repository
    Then every satisfies link either lands in this document or in one of those other instances' documents

  @test:scripts/tests/kg-export.test.ts::an_instance_export_carries_that_instance's_Tools::every_Tool_discovery_finds,_and_with_harness-base_port_types
  Scenario: An instance export carries every Tool discovery finds with harness-base port types
    # Skipped: outside the aggregate checkout, or when neither smart-base nor fhir-harness is an instance
    Given the smart-base and fhir-harness instances
    When each is exported at the preview base
    Then the number of Tool nodes equals the number of Tools discovery finds there, which is more than zero
    And every input and output port schema starts with the preview base
    And "tools" is not among the omitted collectors

  @test:scripts/tests/kg-export.test.ts::an_instance_export_carries_that_instance's_Tools::with_no_--base-url,_port_types_are_the_HARNESS's_canonical,_not_the_instance's
  Scenario: With no base URL an instance's port types use the harness's canonical base
    # Skipped: outside the aggregate checkout, or when neither smart-base nor fhir-harness is an instance
    Given the smart-base and fhir-harness instances
    When each is exported with no base URL
    Then every Tool port schema starts with this layer's canonical base

  @test:scripts/tests/kg-export.test.ts::each_Tool_is_its_own_document,_at_the_path_its_IRI_names::one_file_per_Tool_node,_its_@id_is_the_node's,_and_nothing_else_is_in_it
  Scenario: Each Tool is written as its own document at the path its IRI names
    Given the published projection of this layer's export at the preview base, holding Tool nodes
    When the Tool documents are written beside the output file
    Then one file is written per Tool node
    And each Tool's IRI, relative to the document's directory, is "tools/" followed by its name and ".jsonld"
    And each file has the Tool's @id, the document's @context, partOf the document, and a @graph of just that Tool

  @test:scripts/tests/kg-export.test.ts::each_Tool_is_its_own_document,_at_the_path_its_IRI_names::the_published_graph_holds_no_forwarding_node:_every_node_is_a_live_subject
  Scenario: The published graph holds no forwarding node
    Given the published projection of the canonical export
    Then no node is deprecated or carries isReplacedBy

  @test:scripts/tests/kg-export.test.ts::each_Tool_is_its_own_document,_at_the_path_its_IRI_names::no_Tool_is_a_fragment_of_the_instance_document_any_more
  Scenario: No Tool is a fragment of the instance document
    Given this layer's export at the preview base
    Then no Tool node's @id starts with the document's @id followed by "#"

  @test:scripts/tests/kg-export.test.ts::schemas_and_standards_are_nodes,_and_graphs_link_to_them::every_external-schemas_record_is_an_ExternalSchema_node,_DMN_1.3_among_them
  Scenario: Every external-schemas record is an ExternalSchema node, DMN 1.3 among them
    Given the JSON files in external-schemas/ whose $schema is absent or the external schema tag
    Then the number of ExternalSchema nodes equals the number of those files
    And the nodes include "omg-bpmn-2.0" and "omg-dmn-1.3"
    And the only other files are "spdx-license-list.terminology.json" and "who-smart-base.terminology.json", both tagged "folio-pinned-terminology/v1"

  @test:scripts/tests/kg-export.test.ts::schemas_and_standards_are_nodes,_and_graphs_link_to_them::the_processes_GraphTypology_conforms_to_BPMN_AND_DMN,_and_says_why_it_has_no_validator
  Scenario: The processes GraphTypology conforms to BPMN and DMN and says why it has no validator
    Given the GraphTypology node named "processes"
    Then its conformsTo includes the BPMN 2.0 and DMN 1.3 ExternalSchema nodes
    And its validatorNotApplicable is a string

  @test:scripts/tests/kg-export.test.ts::schemas_and_standards_are_nodes,_and_graphs_link_to_them::a_kind_with_a_runtime_validator_links_to_its_Schema_node
  Scenario: A kind with a runtime validator links to its Schema node
    Given the GraphTypology nodes that carry a validator
    Then there is at least one
    And every validator is the @id of a Schema node

  @test:scripts/tests/kg-export.test.ts::schemas_and_standards_are_nodes,_and_graphs_link_to_them::a_Schema_node's_docblock_line_is_its_summary_and_its_title_is_the_stem_(D5)
  Scenario: A Schema node's title is its stem and its docblock line is its summary
    Given the Schema nodes of the export
    Then there is at least one
    And every one's title equals its name
    And at least one carries a string summary

  @test:scripts/tests/kg-export.test.ts::schemas_and_standards_are_nodes,_and_graphs_link_to_them::every_Process_links_to_the_standard_its_own_file_declares
  Scenario: Every Process links to the BPMN standard
    # Gap: the standard is checked as BPMN 2.0 for every Process rather than read from each file's own declaration
    Given the Process nodes of the export
    Then there is at least one
    And every one conformsTo the BPMN 2.0 ExternalSchema node

  @test:scripts/tests/kg-export.test.ts::DMN_decisions_are_nodes,_linked_to_their_gateways_and_to_DMN_1.3::every_decision_in_every_.dmn_file_is_a_Decision_node_conforming_to_DMN_1.3
  Scenario: Every decision in every .dmn file is a Decision node conforming to DMN 1.3
    Given every decision id declared in this layer's .dmn files
    Then there is at least one
    And each appears as a Decision node named by its file stem and id
    And every Decision node conformsTo DMN 1.3 and has a source path ending in ".dmn"

  @test:scripts/tests/kg-export.test.ts::DMN_decisions_are_nodes,_linked_to_their_gateways_and_to_DMN_1.3::every_gateway_with_a_decisionRef_links_to_its_Decision,_and_no_decidedBy_dangles
  Scenario: Every gateway with a decisionRef links to its Decision and no decidedBy dangles
    Given the ProcessNodes carrying a decisionRef
    Then there is at least one
    And each one's decidedBy is a Decision node
    And every decidedBy ends in "/decision/" followed by the decisionRef's file stem and id

  @test:scripts/tests/kg-export.test.ts::DMN_decisions_are_nodes,_linked_to_their_gateways_and_to_DMN_1.3::a_Process_carries_its_own_documentation_—_first_sentence_as_summary,_whole_as_description
  Scenario: A Process carries its own documentation with the first sentence as summary
    Given the Process nodes of the export
    Then there is at least one
    And every Process with a description has a string summary that the description starts with
    And the "content/review-task.bpmn" Process has a description, a GitHub blob URL on main as sourceUrl, and a depiction at "assets/img/workflows/review-task.svg"

  @test:scripts/tests/kg-export.test.ts::DMN_decisions_are_nodes,_linked_to_their_gateways_and_to_DMN_1.3::a_call_activity's_calledElement_links_to_a_Process,_or_a_shared_global_Task,_in_this_graph_—_never_to_one_it_lacks
  Scenario: A call activity's calledElement links to a Process or shared Task in this graph
    Given the ProcessNodes carrying a calledElement
    Then there is at least one
    And every calledElement is the @id of a Process or Task node
    And a call activity in the review-task Process calls the review-narrative Process

  @test:scripts/tests/kg-export.test.ts::an_actor's_roles_are_links_to_Role_nodes_(#1168_B8)::actors_carry_mayTakeRole_links,_not_the_old_literal
  Scenario: Actors carry mayTakeRole links
    # Gap: the absence of the old roleName literal is not asserted
    Given the nodes of the export
    Then at least one mayTakeRole link is present

  @test:scripts/tests/kg-export.test.ts::an_actor's_roles_are_links_to_Role_nodes_(#1168_B8)::every_link_lands_on_a_node_of_this_document
  Scenario: Every mayTakeRole link lands on a node of this document
    Given the mayTakeRole links of the export
    Then every target is the @id of a node in the export

  @test:scripts/tests/kg-export.test.ts::the_published_graph_is_this_instance's_own_(bean_4ak5_item_2)::no_node's_source_path_is_outside_this_instance
  Scenario: No node's source path is outside this instance
    Given the canonical export
    When every node's instructionsPath, sourcePath, path and module are resolved against this layer's root
    Then none lies outside it

  @test:scripts/tests/kg-export.test.ts::the_published_graph_is_this_instance's_own_(bean_4ak5_item_2)::every_@id_the_checkout-scope_graph_mints_and_this_one_lacks_is_held_by_its_owner's_PUBLISHED_document
  Scenario: Every @id the checkout-scope graph mints and this one lacks is held by its owner's published document
    # Skipped: when cat-harness stands alone outside the aggregate checkout
    Given the checkout-scope export, the canonical export and every other layer's own export
    When the nodes only the checkout-scope graph holds are collected
    Then there is at least one
    And every one has a subject path under this document's IRI
    And every one either has that subject path in an owner's export or has a source inside another layer

  @test:scripts/tests/kg-export.test.ts::the_published_graph_is_this_instance's_own_(bean_4ak5_item_2)::nothing_left_behind_links_to_a_node_that_moved
  Scenario: Nothing left behind links to a node that moved
    # Skipped: when cat-harness stands alone outside the aggregate checkout
    Given the canonical export
    Then it has no dangling links

  @test:scripts/tests/kg-export.test.ts::a_document_links_the_schemas_its_instance_publishes_(bean_4ak5_follow-up)::a_planned_instance's_document_stops_saying_its_schemas_were_not_looked_for,_and_links_where_they_are
  Scenario: A planned instance's document links its schema index and omits only packages and registry
    # Skipped: when cat-harness stands alone outside the aggregate checkout
    Given every layer in the instance export plan, which is not empty
    When each layer's own export is read
    Then its conformsTo is that layer's published schema index IRI
    And its omitted collectors are exactly "packages" and "registry"

  @test:scripts/tests/kg-export.test.ts::a_document_links_the_schemas_its_instance_publishes_(bean_4ak5_follow-up)::an_exempt_instance_publishes_no_schema/_here:_no_index_link,_and_no_Schema_node_links_a_rendering
  Scenario: An exempt instance publishes no schema index and no Schema node links a rendering
    Given bootstrap's export at the preview base
    Then it has no conformsTo
    And its omitted collectors are exactly "packages" and "registry"
    And no node carries a jsonSchema link

  @test:scripts/tests/kg-export.test.ts::a_document_links_the_schemas_its_instance_publishes_(bean_4ak5_follow-up)::a_planned_instance's_skills_link_the_contract_$id_its_publisher_writes
  Scenario: A planned instance's skills link the contract $id its publisher writes
    # Skipped: when cat-harness stands alone outside the aggregate checkout
    Given every layer in the instance export plan and the skill contracts each holds
    When each published skill's inputSchema and outputSchema are read
    Then each equals the external reference or the $id that layer publishes for that contract
    And at least one link is made
    And folio-assistant-core's "quality-control" skill has inputSchema "folio-assistant-core/schema/skills/quality-control/input.schema.json" under the base

  @test:scripts/tests/kg-export.test.ts::a_document_links_the_schemas_its_instance_publishes_(bean_4ak5_follow-up)::in_checkout_scope_a_skill_held_by_a_stacked_instance_links_that_instance's_published_contract
  Scenario: In checkout scope a skill held by a stacked instance links that instance's published contract
    # Skipped: when cat-harness stands alone outside the aggregate checkout
    Given the checkout-scope export and the skill contracts of the checkout
    Then a host skill's inputSchema starts with the host schema base followed by "/skills/"
    And a skill of another schema-publishing layer links that layer's published contract $id
    And at least one such foreign skill exists
    And a smart-base skill's schema, if any, starts with smart-base's canonical URL followed by "/schema/skills/"

  @test:scripts/tests/kg-export.test.ts::a_document_links_the_schemas_its_instance_publishes_(bean_4ak5_follow-up)::the_host's_document_conformsTo_its_own_declaration_schema,_by_the_$id_the_schema_export_mints_with_the_same_base
  Scenario: The host's document conformsTo its own declaration schema by the $id the schema export mints
    Given the default, canonical and preview exports of this layer
    Then each one's conformsTo equals the declaration schema $id built with the same base
    And the canonical one is the base, layer name and stub with ".schema.json"
    And the preview one starts with the preview base
    And the default export has no omitted collectors

  @test:scripts/tests/kg-export.test.ts::a_lane's_role_links_into_the_document_of_the_layer_that_declares_it_(cat-harness-tools#1894)::a_role_this_layer_declares,_an_unknown_role,_and_no_base_all_stay_in_this_document
  Scenario: A role this layer declares, an unknown role, and no base all stay in this document
    Given every instance root in the checkout
    Then every role a layer declares is homed in that layer's own document
    And a role no layer declares stays in the own document
    And with no base the role "user" stays in the own document

  @test:scripts/tests/kg-export.test.ts::a_lane's_role_links_into_the_document_of_the_layer_that_declares_it_(cat-harness-tools#1894)::a_role_only_another_layer_declares_is_minted_in_that_layer's_document
  Scenario: A role only another layer declares is minted in that layer's document
    # Skipped: when no layer of the checkout declares a role another layer does not
    Given a pair of layers where the other declares a role the own layer does not
    When that role's home is computed from the own layer
    Then it is not the own document
    And it is the published document IRI of a layer that declares the role
