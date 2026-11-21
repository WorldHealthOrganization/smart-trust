# scripts/gen-subgraph-jsonld.ts frames the exported knowledge graph into named subgraphs (an index.jsonld of
# pointers and a hydrated file of whole nodes per folder) and writes skill bodies as content-addressed payloads.
# Each Scenario names the test that executes it.
Feature: Named JSON-LD subgraphs and content-addressed payloads

  @test:scripts/tests/gen-subgraph-jsonld.test.ts::gen-subgraph-jsonld::the_run_is_clean:_every_node_placed,_nothing_refused
  Scenario: The generation run is clean
    Given the subgraphs generated for this instance
    Then the plan reports no problems

  @test:scripts/tests/gen-subgraph-jsonld.test.ts::gen-subgraph-jsonld::the_sdlc_skills:_index_(followed_down)_and_hydrated_hold_exactly_the_sdlc_nodes
  Scenario: The sdlc skills index and hydrated file hold exactly the sdlc nodes
    Given the sdlc nodes worked out from their source paths, independent of the generator
    Then there is at least one of them
    And the sdlc skills index, followed down through its child subgraphs, lists exactly those nodes
    And the sdlc skills hydrated file, followed down, holds exactly those nodes

  @test:scripts/tests/gen-subgraph-jsonld.test.ts::gen-subgraph-jsonld::tools/_is_a_named_subgraph:_every_Tool_of_this_instance,_one_fetch,_each_in_its_own_folder_(bean_mo75_G1)
  Scenario: tools/ is a named subgraph holding every Tool of this instance not in an opt-in sub-graph
    # Gap: only the first Tool's own folder is checked for its node and invoke
    Given the Tools discovery lists and the opt-in tools directories the declaration names
    Then work-plan/tools/ is an opt-in tools directory exactly when the layout is the subgraph one
    And each opt-in directory holds at least one Tool, and in the subgraph layout its index lists those Tools
    And the root index names "tools/" as a child subgraph
    And the tools/ index has the tools/ IRI and holds the graphTypology tools graph
    And the tools/ hydrated file and index each hold every remaining Tool
    And no Tool is a member of the root index
    And the first Tool's own folder hydrated file holds that Tool with an invoke

  @test:scripts/tests/gen-subgraph-jsonld.test.ts::gen-subgraph-jsonld::the_hydrated_file_carries_whole_nodes;_the_index_carries_pointers
  Scenario: The hydrated file carries whole nodes while the index carries pointers
    Given the sdlc skills hydrated file and the sdlc-core index
    Then the sdlc-core child in the hydrated file has a member carrying an instructionsPath
    And every member of the sdlc-core index has only @id, @type, name, title and payload keys

  @test:scripts/tests/gen-subgraph-jsonld.test.ts::gen-subgraph-jsonld::the_parent_index_lists_the_sdlc_skills_as_a_child_IRI
  Scenario: The parent index lists the sdlc skills as a child IRI
    Given the index of the sdlc skills' parent folder
    Then its @id is the parent's IRI and its hasSubgraph includes the sdlc skills IRI
    And the sdlc skills index has the sdlc skills IRI

  @test:scripts/tests/gen-subgraph-jsonld.test.ts::gen-subgraph-jsonld::the_root_has_index.jsonld_and_no_hydrated_file
  Scenario: The root has an index and no hydrated file
    Given the generated files
    Then the root index.jsonld exists and the root hydrated file does not
    And the root IRI ends in "/subgraph/<harness>/"
    And the root index names "skills/" as a child subgraph

  @test:scripts/tests/gen-subgraph-jsonld.test.ts::gen-subgraph-jsonld::no_file_inlines_its_@context_—_every_one_names_the_shared_context_URL
  Scenario: Every file names the shared context URL instead of inlining its @context
    Given the generated files
    Then the context URL ends with the shared context path
    And every file other than the context itself has that URL as its @context
    And the shared context is an object defining hasMember and no "id" keyword alias

  @test:scripts/tests/gen-subgraph-jsonld.test.ts::gen-subgraph-jsonld::every_file_expands_under_its_context_with_no_warning_—_publish-verify's_`jsonld-expand`
  Scenario: Every file expands under its context with no warning
    Given a document loader that serves only the shared context
    When every generated file other than the context is expanded as publish-verify does
    Then at least one file is checked, and the first carries a _generated note
    And there are no expansion findings
    And the context declares _generated as an @json term

  @test:scripts/tests/gen-subgraph-jsonld.test.ts::gen-subgraph-jsonld::subgraph_membership_and_structural_containment_stay_two_properties_(bean_3f5f)
  Scenario: Subgraph membership and structural containment stay two properties
    Given the shared context and the processes hydrated file
    Then inSubgraph and partOf map to different IRIs
    And at least one node in the processes hydrated file carries both partOf and inSubgraph

  @test:scripts/tests/gen-subgraph-jsonld.test.ts::gen-subgraph-jsonld::round_trip:_every_file_parses_back_through_its_schema
  Scenario: Every index and hydrated file parses back through its schema
    Given the generated files
    Then every index file parses as a subgraph index and every hydrated file as a subgraph hydrated document
    And every file but the shared context is one of those
    And the index schema refuses the sdlc skills index with an inline @context

  @test:scripts/tests/gen-subgraph-jsonld.test.ts::gen-subgraph-jsonld::an_overlaid_instance_heads_its_own_tree,_and_the_repository_index_lists_every_root_(bean_ax6r)
  Scenario: An overlaid instance heads its own tree and the repository index lists every root
    # Skipped: outside the aggregate checkout
    Given the repository-level index
    Then its @id is the repository IRI, it parses as a subgraph index and its hasSubgraph is the harness roots
    And the first root is this instance's root, and folio-assistant-core's root is among them
    And the folio-review-publish.bpmn process is a member of folio-assistant-core's processes hydrated file, not under this document's IRI
    And that process is not a member of this instance's root index
    And there is no root for bootstrap or bootstrap-tools

  @test:scripts/tests/gen-subgraph-jsonld.test.ts::gen-subgraph-jsonld::each_instance_is_framed_from_its_OWN_export:_no_tree_names_this_document_for_a_node_that_left_it_(bean_4ak5_item_2)
  Scenario: Each instance's tree is framed from its own export
    Given the generated files of every other instance's tree
    Then there is at least one such file
    And none of them names an @id under this layer's document
    And no planned node is a deprecated tombstone

  @test:scripts/tests/gen-subgraph-jsonld.test.ts::gen-subgraph-jsonld::an_unplaceable_node_is_a_problem,_never_silently_dropped
  Scenario: An unplaceable node is a problem, never silently dropped
    Given a skill whose instructions file does not exist and a process node part of a missing process
    When the subgraphs are planned
    Then the problems name both "#skill/ghost" and "#node/orphan"

  @test:scripts/tests/gen-subgraph-jsonld.test.ts::own-namespace_prefixes_stay_inside_the_writing_instance's_reach::an_out-of-scope_prefix_is_not_bound,_and_no_term_is_defined_through_it
  Scenario: An out-of-scope prefix is not bound and no term is defined through it
    Given the own-namespace prefix table
    When a subgraph context is built in scope of only the first prefix
    Then that prefix is bound to its namespace
    And no other prefix is bound or used in a term definition
    And a context built with no scope binds every own prefix

  @test:scripts/tests/gen-subgraph-jsonld.test.ts::own-namespace_prefixes_stay_inside_the_writing_instance's_reach::a_foreign_IRI_is_spelt_in_full,_and_the_triples_are_the_ones_the_CURIE_gave
  Scenario: A foreign IRI is spelt in full and the triples match the CURIE form
    Given a Subgraph node holding a graph under the last own prefix's namespace
    When it is compacted under the full context and under a context without that prefix
    Then the full compaction uses the prefix as a CURIE
    And the narrow compaction spells the IRI in full and never uses the prefix
    And both give the same N-Quads

  @test:scripts/tests/gen-subgraph-jsonld.test.ts::own-namespace_prefixes_stay_inside_the_writing_instance's_reach::this_instance's_reach_includes_itself,_and_every_generated_file_keeps_to_it
  Scenario: This instance's reach includes itself and every generated file keeps to it
    Given the prefixes in scope for this instance
    Then the scope is defined and equals the plan's
    And no generated file uses an out-of-scope prefix as a CURIE

  @test:scripts/tests/gen-subgraph-jsonld.test.ts::payloads::a_skill_node_links_to_its_payload_in_the_index_and_the_hydrated_file,_by_its_body's_digest
  Scenario: A skill node links to its payload by its body's digest in both the index and the hydrated file
    Given the kg-export skill in the skills/kg/kg-core/ index
    Then its payload link parses as a payload link
    And its sha256 and bytes are those of the skill's instructions file
    And its @id is the payload path under the site base followed by the sha256
    And the hydrated file's kg-export node carries the same link

  @test:scripts/tests/gen-subgraph-jsonld.test.ts::payloads::the_hydrated_file_does_not_inline_a_body_—_it_carries_the_link_instead
  Scenario: The hydrated file links to a skill body instead of inlining it
    Given the skills/kg/kg-core/ hydrated file and the kg-export.md body containing a distinctive heading
    Then the hydrated file does not contain that heading
    And it contains the payload path of the body's sha256

  @test:scripts/tests/gen-subgraph-jsonld.test.ts::payloads::each_payload_file's_sha256_matches_its_bytes,_and_its_sidecar_names_the_media_type
  Scenario: Each payload file's name is its sha256 and its sidecar names the media type
    Given the payload plan and rendered payload files
    Then the plan has no problems and at least one payload
    And each payload file's bytes hash to its name
    And each sidecar parses, names its payload's sha256, and gives the media type of the referencing node's source file extension

  @test:scripts/tests/gen-subgraph-jsonld.test.ts::payloads::the_committed_payload_tree_is_that_set,_with_no_orphan_either_way
  Scenario: The committed payload tree has no orphan either way
    # Skipped: outside the aggregate checkout
    Given the committed payload tree and the plan's links
    When the tree is audited
    Then there are no problems

  @test:scripts/tests/gen-subgraph-jsonld.test.ts::payloads::synthetic::identical_bodies_are_one_payload,_linked_from_both_nodes
  Scenario: Identical bodies are one payload linked from both nodes
    Given skills a and b with the same body, skill c with another, and a Role pointing at c's file
    When payloads are planned
    Then there are no problems, 2 payloads and 3 links, since a Role is not a heavy class
    And skills a and b share the same link, at the payload path of the hash of "# same body"
    And that payload is referenced by skill a and skill b
    And rendering writes 4 files, two bodies and two sidecars

  @test:scripts/tests/gen-subgraph-jsonld.test.ts::payloads::synthetic::generation_is_deterministic
  Scenario: Payload generation is deterministic
    Given the synthetic graph in its order and reversed
    When payload files are rendered from each
    Then both have the same file names in the same order with identical bytes

  @test:scripts/tests/gen-subgraph-jsonld.test.ts::payloads::synthetic::orphan_detection,_both_ways_—_and_a_payload_that_is_not_what_it_says
  Scenario: Orphans either way and a payload whose bytes do not match its name are problems
    Given a payload tree written from the synthetic plan
    Then auditing it finds no problems
    When a stray payload no node references is added and a link to a never-written payload is added
    Then the audit reports an orphan payload for the stray and a missing payload for "#skill/ghost"
    When skill c's payload file is overwritten with other bytes
    Then the audit reports that its bytes hash to something else

  @test:scripts/tests/gen-subgraph-jsonld.test.ts::payloads::synthetic::an_undeclared_media_type_is_a_problem,_never_a_guess
  Scenario: An undeclared media type is a problem, never a guess
    Given a skill whose instructions file has the extension .xyz
    When payloads are planned
    Then there are no links and a problem names ".xyz"
