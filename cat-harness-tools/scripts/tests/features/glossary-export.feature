# scripts/glossary-export.ts builds a layer's swimlane glossary as a SKOS concept scheme of roles, lanes, graph kinds
# and the harness, keeping a ledger so a retired term stays, deprecated and dated. Each Scenario names the test that executes it.
Feature: Swimlane glossary export

  @test:scripts/tests/glossary-export.test.ts::the_corpus_it_is_actually_run_against::there_is_a_corpus_at_all
  Scenario: The glossary built from the corpus is not empty
    Given the glossary built from this checkout's corpus
    When its report and document are read
    Then the report counts more than zero concepts and more than zero usages
    And the document holds more than zero skos:Concept nodes

  @test:scripts/tests/glossary-export.test.ts::the_corpus_it_is_actually_run_against::the_document_IS_its_own_concept_scheme
  Scenario: The glossary document is its own concept scheme
    Given the glossary built from the corpus
    When its document type and concepts are read
    Then the document's type is "skos:ConceptScheme"
    And every concept's inScheme is the document's own @id

  @test:scripts/tests/glossary-export.test.ts::the_corpus_it_is_actually_run_against::the_scheme's_dcterms:title_IS_its_skos:prefLabel_—_one_source,_two_vocabularies_(`sl9u`)
  Scenario: The scheme's title and prefLabel are the same string
    Given the glossary built from the corpus
    When the document's title and prefLabel are read
    Then prefLabel is a string
    And title equals prefLabel

  @test:scripts/tests/glossary-export.test.ts::the_corpus_it_is_actually_run_against::every_live_concept_has_a_prefLabel,_and_no_two_share_an_@id
  Scenario: Every live concept has a prefLabel and a unique @id
    Given the glossary built from the corpus
    When its concepts are read
    Then no two concepts share an @id
    And every concept has a string prefLabel

  @test:scripts/tests/glossary-export.test.ts::the_corpus_it_is_actually_run_against::a_concept's_@id_is_the_one_kg-export_already_mints_for_that_role
  Scenario: A role concept's @id is a role path, not a fragment
    # Gap: the @id is checked only for the "/role/<name>" path shape, not compared with what kg-export mints
    Given the glossary built from the corpus
    When the concept @ids containing "/role/" are read
    Then there is at least one
    And each ends in "/role/<name>" with no "#" anywhere

  @test:scripts/tests/glossary-export.test.ts::the_corpus_it_is_actually_run_against::ten_names_for_one_pipeline_are_ten_altLabels,_not_ten_terms
  Scenario: The many lane names of build-pipeline are altLabels of one concept
    # Gap: at least 5 altLabels are checked, not ten
    Given the glossary built from the corpus
    When the concept whose @id ends in "/role/build-pipeline" is read
    Then it exists
    And it has at least 5 altLabels
    And it has a string definition

  @test:scripts/tests/glossary-export.test.ts::the_corpus_it_is_actually_run_against::notation_is_the_CODE,_and_no_two_concepts_share_one
  Scenario: Every concept has a unique string notation
    Given the glossary built from the corpus
    When every concept's notation is read
    Then there is at least one notation
    And each is a string
    And no two concepts share one

  @test:scripts/tests/glossary-export.test.ts::the_corpus_it_is_actually_run_against::a_scope_note_is_on_the_USAGE_and_never_on_the_concept
  Scenario: Scope notes sit on lane usages and never on concepts
    Given the glossary built from the corpus
    When its concepts and lane usages are read
    Then no concept has a scopeNote
    And at least one usage has a string scopeNote

  @test:scripts/tests/glossary-export.test.ts::the_corpus_it_is_actually_run_against::every_usage_names_the_process_and_the_concept_it_belongs_to
  Scenario: Every usage names its concept and its process
    Given the glossary built from the corpus
    When its lane usages are read
    Then there is at least one usage
    And each usage's ofConcept is a concept @id in the document
    And each usage's inProcess ends in "/process/<id>" with no "#"

  @test:scripts/tests/glossary-export.test.ts::the_corpus_it_is_actually_run_against::a_usage's_scope_note_is_VERBATIM,_so_it_has_a_msgid
  Scenario: A usage's scope note is the lane's documentation verbatim
    # Gap: only the first 40 documented lanes are compared, and no .pot msgid is looked up
    Given the lanes of this checkout's diagrams that carry documentation
    When the glossary's usage scope notes are collected
    Then there is at least one documented lane
    And each of the first 40 lanes' documentation appears unchanged among the scope notes

  @test:scripts/tests/glossary-export.test.ts::the_corpus_it_is_actually_run_against::every_`usage`_link_resolves_to_a_node_in_this_document
  Scenario: Every usage link on a concept resolves within the document
    Given the glossary built from the corpus
    When every concept's usage links are followed
    Then each names a node @id in the document
    And more than zero links were followed

  @test:scripts/tests/glossary-export.test.ts::the_corpus_it_is_actually_run_against::a_declared_role_no_swimlane_draws_is_still_a_concept,_and_is_reported
  Scenario: A declared role that no swimlane draws is still a concept and is reported
    Given the glossary built from the corpus
    When its report's undrawn roles are read
    Then there is at least one undrawn role
    And each has a concept whose @id ends in "/role/<role>"

  @test:scripts/tests/glossary-export.test.ts::bootstrap_—_the_instance_with_the_one_varying_performer::it_is_bootstrap's_own_graph,_not_cat-harness's_under_bootstrap's_name
  Scenario: bootstrap's glossary is built from bootstrap's own graph
    Given the glossary built for the bootstrap instance
    When its report and document are read
    Then it has more than zero concepts
    And fewer than 10 role concepts
    And its document @id contains "/bootstrap/"

  @test:scripts/tests/glossary-export.test.ts::bootstrap_—_the_instance_with_the_one_varying_performer::the_lane_whose_performer_varies_has_a_usage_and_NO_definition
  Scenario: The lane whose performer varies has usages and no definition
    Given the glossary built for the bootstrap instance
    When the concept for "/process/Process_LogMessage/lane/Lane_Actor" is read
    Then it exists with no definition
    And performerVaries is true
    And it has at least one usage

  @test:scripts/tests/glossary-export.test.ts::bootstrap_—_the_instance_with_the_one_varying_performer::no_ordinary_unbound_lane_is_silently_swallowed
  Scenario: bootstrap's glossary reports no problems
    Given the glossary built for the bootstrap instance
    When its report is read
    Then its problems list is empty

  @test:scripts/tests/glossary-export.test.ts::retirement_—_reported,_never_deleted::a_term_the_corpus_no_longer_derives_is_KEPT,_deprecated_and_dated
  Scenario: A term the corpus no longer derives is kept, deprecated and dated
    Given a layer that derives nothing, whose ledger holds "role/reviewer" live and "role/long-gone" retired on "2025-12-25"
    When the glossary is built on "2026-09-22"
    Then "role/reviewer" is reported newly retired and its ledger retiredOn is "2026-09-22"
    And "role/long-gone" keeps its retiredOn of "2025-12-25"
    And both keys remain in the ledger and both are concept nodes
    And each node is deprecated, has a "Retired <date>: " change note and a string prefLabel
    And the report lists both as retired and the ledger as stale

  @test:scripts/tests/glossary-export.test.ts::retirement_—_reported,_never_deleted::a_retired_term_that_comes_BACK_is_un-retired_and_reported
  Scenario: A retired term that comes back is un-retired and reported restored
    Given the real corpus's live ledger, and a planted ledger marking one live role retired on "2025-01-01"
    When the real glossary is rebuilt on "2026-09-22" against the planted ledger
    Then the chosen role's ledger entry has a null retiredOn and keeps its firstSeen
    And the chosen role is not reported retired
    And the chosen role, and only it, is reported restored
    And the planted ledger is reported stale

  @test:scripts/tests/glossary-export.test.ts::retirement_—_reported,_never_deleted::firstSeen_is_preserved_across_a_rebuild_—_a_term_is_not_re-minted_daily
  Scenario: firstSeen is kept across rebuilds on different days
    Given glossaries built on "2026-09-21" and on "2030-01-01"
    When the keys held by both builds and by the committed ledger are compared
    Then each keeps the same firstSeen in both builds and in the committed ledger
    And at least one key was compared

  @test:scripts/tests/glossary-export.test.ts::retirement_—_reported,_never_deleted::the_committed_ledger_is_CURRENT_—_this_is_the_staleness_gate
  Scenario: The committed ledger is current
    # Skipped: when the higher instances' roles are absent or the ledger belongs to a mounted layer
    Given the committed glossary ledgers
    When the cat-harness and the bootstrap glossaries are built
    Then neither reports its ledger as stale

  @test:scripts/tests/glossary-export.test.ts::retirement_—_reported,_never_deleted::the_ledger_keys_on_the_LOCAL_PART,_never_an_absolute_IRI
  Scenario: Ledger keys are local parts, never absolute IRIs
    Given the glossary built from the corpus
    When its ledger keys are read
    Then none contains "http"
    And each matches the ledger key pattern

  @test:scripts/tests/glossary-export.test.ts::retirement_—_reported,_never_deleted::a_ledger_with_the_wrong_$schema_is_REFUSED,_not_overwritten
  Scenario: A ledger with the wrong $schema is refused
    Given a layer whose ledger file has no $schema
    When the glossary is built for it
    Then the build throws an error naming "$schema"

  @test:scripts/tests/glossary-export.test.ts::glossaryIri::it_is_derived_from_the_document_PATH,_not_rebuilt_from_the_stub
  Scenario: glossaryIri is derived from the document path
    Given the base "https://x.test" and the documents "cat-harness.jsonld" and "bootstrap/bootstrap.jsonld"
    When glossaryIri is computed for each
    Then they are "https://x.test/cat-harness-glossary.jsonld" and "https://x.test/bootstrap/bootstrap-glossary.jsonld"
    And a trailing slash on the base makes no difference

  @test:scripts/tests/glossary-export.test.ts::the_host_glossary's_address::is_beside_its_graph_document,_and_holds_no_forwarding_node
  Scenario: The host glossary sits beside its graph document with no forwarding node
    Given the base URL "https://x.test/site"
    When the glossary is built
    Then its @id is "https://x.test/site/cat-harness/cat-harness-glossary.jsonld"
    And the graph holds no untyped deprecated node

  @test:scripts/tests/glossary-export.test.ts::an_old-layout_--out_names_the_same_site_(placedOut)::the_old_root_path_is_read_as_the_site_root;_the_new_path_and_any_other_are_kept
  Scenario: placedOut reads an old root --out path as the site root
    Given the new path "cat-harness/cat-harness.jsonld" and the old path "cat-harness.jsonld"
    When placedOut reads several --out values
    Then "./_site/cat-harness.jsonld" becomes "./_site/cat-harness/cat-harness.jsonld" and is marked moved
    And "./_site/cat-harness/cat-harness.jsonld" and "/tmp/x/doc.jsonld" are kept, not moved
    And with no old path, "./_site/cat-harness.jsonld" is kept, not moved

  @test:scripts/tests/glossary-export.test.ts::ledger_keys_and_renames::a_varying_lane_is_keyed_by_its_BPMN_identity,_as_kg-export_mints_the_Lane_node
  Scenario: A varying lane is keyed by its BPMN process and lane identity
    Given the glossary built for the bootstrap instance
    When its ledger keys are read
    Then they include "process/Process_LogMessage/lane/Lane_Actor"
    And none starts with "lane/"

  @test:scripts/tests/glossary-export.test.ts::ledger_keys_and_renames::the_schema_refuses_a_key_that_is_not_a_role_or_a_lane_identity
  Scenario: The ledger schema accepts only role and lane-identity keys
    Given ledgers each holding one entry under a different key
    When the ledger schema parses them
    Then "role/reviewer" and "process/Process_A/lane/Lane_B" are accepted
    And "lane/Actor" and "Reviewer" are refused

  @test:scripts/tests/glossary-export.test.ts::ledger_keys_and_renames::a_rename_keeps_the_key_and_the_old_label_becomes_a_former_label
  Scenario: A rename keeps the key and records the old label as a former label
    Given a ledger entry labelled "Caller"
    When liveLedgerEntry relabels it "Actor"
    Then the entry is labelled "Actor" with former label "Caller" and keeps its firstSeen and null retiredOn
    And renaming it back to "Caller" makes "Actor" the only former label
    And relabelling it with the same "Caller" adds no former labels

  @test:scripts/tests/glossary-export.test.ts::ledger_keys_and_renames::every_committed_ledger_parses,_and_every_lane_key_names_a_lane_a_diagram_declares
  Scenario: Every committed ledger parses and its live lane keys name declared lanes
    Given the lanes declared by every ".bpmn" in the checkout, outside node_modules and docs
    And every committed "glossary-ledger.json"
    When each ledger is parsed with the ledger schema
    Then more than 10 lanes are declared and at least one ledger exists
    And every live "process/..." key names a declared lane

  @test:scripts/tests/glossary-export.test.ts::the_vocabulary-mapping_tables_agree_with_the_document's_@context::every_key_a_table_writes_expands,_in_the_context,_to_the_table's_target_+_code
  Scenario: Every key a vocabulary-mapping table writes expands in the context to its target and code
    Given the seven glossary vocabulary-mapping tables and the glossary document's @context
    When each target key is expanded through the context
    Then it equals the table's target namespace plus the row's code
    And 27 keys are checked in all

  @test:scripts/tests/glossary-export.test.ts::graph_kinds,_node_kinds_and_the_harness_are_glossary_terms::a_graph_kind_belongs_to_the_instance_that_declares_it,_never_to_every_instance_that_sees_it
  Scenario: A graph kind belongs to the instance that declares it
    Given the harness root, the bootstrap root and an empty directory
    When kindsDeclaredBy reads each
    Then the harness's kinds include "bean-defs" and "beans"
    And none of bootstrap's kinds is among the harness's
    And the empty directory declares no kinds

  @test:scripts/tests/glossary-export.test.ts::graph_kinds,_node_kinds_and_the_harness_are_glossary_terms::the_families_with_no_table_are_REPORTED,_not_silently_empty
  Scenario: A glossary family with no mapping table is reported as not built
    Given the glossary built from the corpus
    When its report's notBuilt list is read
    Then each of the kind, harness and node-kind concept families is listed exactly when its table is absent

  @test:scripts/tests/glossary-export.test.ts::graph_kinds,_node_kinds_and_the_harness_are_glossary_terms::Work_item_is_a_node_kind,_narrower_than_Memory_record,_and_Bean_still_finds_it
  Scenario: Work item is a node kind narrower than Memory record with Bean as an altLabel
    # Skipped: when the harness lacks the kind, harness or node-kind mapping tables
    Given the full glossary with every family built
    When the concept with notation "node-kind/bean" is read
    Then its prefLabel is "Work item", "Bean" is an altLabel and its definition mentions "memory record"
    And its broader concept is the one with notation "node-kind/memory-record-core", labelled "Memory record"
    And its @id is a fragment of the glossary document
    And the report counts more than zero node kinds

  @test:scripts/tests/glossary-export.test.ts::graph_kinds,_node_kinds_and_the_harness_are_glossary_terms::a_graph_kind_keeps_the_IRI_it_already_has,_and_its_title_is_its_label
  Scenario: A graph kind keeps its graphTypology IRI and is labelled by its title
    # Skipped: when the harness lacks the kind, harness or node-kind mapping tables
    Given the glossary built from the corpus
    When the concept with notation "kind/bean-defs" is read
    Then its prefLabel is "Work items"
    And its @id ends in "/graphTypology/bean-defs"

  @test:scripts/tests/glossary-export.test.ts::graph_kinds,_node_kinds_and_the_harness_are_glossary_terms::the_harness_is_one_term,_labelled_by_its_title,_at_its_own_address
  Scenario: The harness is one term labelled by its title
    # Skipped: when the harness lacks the kind, harness or node-kind mapping tables
    # Gap: the term's address is not checked
    Given the glossary built from the corpus
    When the concepts with a "harness/" notation are read
    Then there is exactly one, "harness/cat-harness"
    And its prefLabel is "C@T Harness" with "cat-harness" as an altLabel
    And the report counts 1 harness

  @test:scripts/tests/glossary-export.test.ts::graph_kinds,_node_kinds_and_the_harness_are_glossary_terms::no_two_live_concepts_share_a_label_—_SKOS_allows_one_prefLabel_per_scheme
  Scenario: No two live concepts share a label
    # Skipped: when the harness lacks the kind, harness or node-kind mapping tables
    Given the full glossary with every family built
    When the prefLabels of non-deprecated concepts are compared case-insensitively
    Then there are no duplicates

  @test:scripts/tests/glossary-export.test.ts::graph_kinds,_node_kinds_and_the_harness_are_glossary_terms::the_committed_ledger_is_current_with_every_family_built
  Scenario: The committed ledger is current with every family built
    # Skipped: when the kind tables or the higher instances' roles are absent, or the ledger belongs to a mounted layer
    Given the committed glossary ledger
    When the full glossary is built with every family
    Then the ledger is not reported stale

  @test:scripts/tests/glossary-export.test.ts::pending_—_a_graph_kind_defined_in_code,_not_yet_in_the_ledger::a_code-defined_kind's_term_MISSING_from_the_ledger_is_pending,_not_stale,_and_is_still_written
  Scenario: A code-defined kind missing from the ledger is pending, not stale, and is written
    # Skipped: when the harness lacks the kind, harness or node-kind mapping tables
    Given the current ledger with one code-defined "kind/" entry removed
    When the glossary is built against it on "2026-09-21"
    Then the report's pending list is exactly that key
    And the ledger is not stale
    And the written ledger records the key with its label, firstSeen "2026-09-21" and null retiredOn

  @test:scripts/tests/glossary-export.test.ts::pending_—_a_graph_kind_defined_in_code,_not_yet_in_the_ledger::the_same_ledger,_current,_has_nothing_pending
  Scenario: A current ledger has nothing pending
    # Skipped: when the harness lacks the kind, harness or node-kind mapping tables
    Given the current ledger
    When the glossary is built against it
    Then nothing is pending
    And the ledger is not stale

  @test:scripts/tests/glossary-export.test.ts::pending_—_a_graph_kind_defined_in_code,_not_yet_in_the_ledger::a_recorded_kind_term_whose_label_CHANGED_is_stale,_never_pending
  Scenario: A recorded kind term whose label changed is stale, not pending
    # Skipped: when the harness lacks the kind, harness or node-kind mapping tables
    Given the current ledger with a code-defined kind's prefLabel changed to "Something else"
    When the glossary is built against it
    Then nothing is pending
    And the ledger is stale

  @test:scripts/tests/glossary-export.test.ts::pending_—_a_graph_kind_defined_in_code,_not_yet_in_the_ledger::a_kind_term_the_ledger_holds_and_the_registry_no_longer_defines_is_retired:_stale
  Scenario: A kind term the registry no longer defines is newly retired and stale
    # Skipped: when the harness lacks the kind, harness or node-kind mapping tables
    Given the current ledger plus a live entry "kind/no-such-kind"
    When the glossary is built against it
    Then "kind/no-such-kind" is reported newly retired
    And the ledger is stale

  @test:scripts/tests/glossary-export.test.ts::pending_—_a_graph_kind_defined_in_code,_not_yet_in_the_ledger::a_term_of_a_family_derived_from_the_instance's_OWN_files_missing_is_stale,_never_pending
  Scenario: A missing term derived from the instance's own files is stale, not pending
    Given the current ledger with one live "role/" entry removed
    When the glossary is built against it
    Then nothing is pending
    And the ledger is stale

  @test:scripts/tests/glossary-export.test.ts::pending_—_a_graph_kind_defined_in_code,_not_yet_in_the_ledger::a_kind_a_typologies/_node_declares_is_the_instance's_own:_never_pending
  Scenario: A kind declared by a typologies node is never pending
    Given the registry's definition of the "beans" kind
    When pendingKind reads it, a copy marked as declared by an instance, and undefined
    Then the registry definition is pending
    And the declared copy and undefined are not

  @test:scripts/tests/glossary-export.test.ts::a_mounted_layer's_ledger,_judged_from_a_content_root_(cat-harness-tools#1701)::content_root_+_a_mounted_layer's_ledger:_not_applicable,_with_a_reason
  Scenario: A mounted layer's ledger seen from a content root is not applicable
    Given a content root with a mounted "cat-harness" directory and no code-quality-gates workflow
    When ledgerNotOursReason judges the mounted layer's ledger
    Then the reason mentions "content root"

  @test:scripts/tests/glossary-export.test.ts::a_mounted_layer's_ledger,_judged_from_a_content_root_(cat-harness-tools#1701)::a_content_root's_OWN_ledger_is_still_judged
  Scenario: A content root's own ledger is still judged
    Given a content root with no code-quality-gates workflow
    When ledgerNotOursReason judges the root's own ledger
    Then there is no reason, so it is judged

  @test:scripts/tests/glossary-export.test.ts::a_mounted_layer's_ledger,_judged_from_a_content_root_(cat-harness-tools#1701)::a_harness_root_judges_the_mounted_ledger_as_before
  Scenario: A harness root judges the mounted layer's ledger
    Given a root with a mounted "cat-harness" directory and a ".github/workflows/code-quality-gates.yml"
    When ledgerNotOursReason judges the mounted layer's ledger
    Then there is no reason, so it is judged
