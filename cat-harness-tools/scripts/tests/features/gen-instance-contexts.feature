# scripts/gen-instance-contexts.ts writes each instance's JSON-LD context, binding the
# prefixes and terms its documents use, flattened over its needs, and reports drift and
# problems for --check. Each Scenario names the test that executes it.
Feature: Per-instance JSON-LD contexts

  @test:scripts/tests/gen-instance-contexts.test.ts::gen-instance-contexts_over_a_fixture_tree::instances_are_reported_dependency-first
  Scenario: Instances are reported dependency-first
    Given a fixture tree where "top" needs "base"
    When the instance contexts are generated
    Then the first report is for "base"
    And "top" is flattened from "base" then "top"

  @test:scripts/tests/gen-instance-contexts.test.ts::gen-instance-contexts_over_a_fixture_tree::each_context_binds_only_its_documents'_prefixes,_flattened_over_needs
  Scenario: Each context binds only the prefixes its documents use, flattened over needs
    Given "base" whose documents use skos, and "top" whose documents use bibo and dcterms
    When the instance contexts are generated
    Then base's context binds only skos
    And top's context binds bibo and dcterms, with dcterms from base, and not fabio

  @test:scripts/tests/gen-instance-contexts.test.ts::gen-instance-contexts_over_a_fixture_tree::a_context_document_under_ns/_is_not_a_corpus_document
  Scenario: A context document under ns/ is not counted as a corpus document
    Given "base" holding one node document and a context file under ns/
    When the instance contexts are generated
    Then base counts 1 document

  @test:scripts/tests/gen-instance-contexts.test.ts::gen-instance-contexts_over_a_fixture_tree::the_document's_own_fhir_binding_resolves_it;_the_Lean_ref_is_literal-only;_nothing_is_unresolved
  Scenario: A document's own prefix binding resolves it and a Lean ref is literal-only
    Given a "top" document binding fhir in its own context and holding a Lean ref "qou:QOU.x"
    When the instance contexts are generated
    Then top has no unresolved prefixes
    And its only literal-only prefix is "qou"

  @test:scripts/tests/gen-instance-contexts.test.ts::gen-instance-contexts_over_a_fixture_tree::unparseable_and_unowned_documents_are_counted,_not_dropped
  Scenario: Unparseable and unowned documents are counted
    Given an unparseable "top/bad.jsonld" and an "orphan.jsonld" outside every instance
    When the instance contexts are generated
    Then top lists "top/bad.jsonld" as unparseable
    And "orphan.jsonld" is listed as unowned

  @test:scripts/tests/gen-instance-contexts.test.ts::gen-instance-contexts_over_a_fixture_tree::an_instance_with_no_documents_gets_no_context
  Scenario: An instance with no documents gets no context
    Given an instance "empty" with no documents
    When the instance contexts are generated
    Then it counts 0 documents and has no expected context

  @test:scripts/tests/gen-instance-contexts.test.ts::gen-instance-contexts_over_a_fixture_tree::an_instance_that_declares_its_context_built_at_publish_gets_one_even_with_no_documents_mounted
  Scenario: An instance declaring its context built at publish gets one without documents
    Given an instance "declared" with no documents that declares "ns/context/v1.jsonld" builtAtPublish
    When the instance contexts are generated
    Then it counts 0 documents
    And it has an expected context holding an "@context"

  @test:scripts/tests/gen-instance-contexts.test.ts::gen-instance-contexts_over_a_fixture_tree::--check_does_not_count_an_absent_(built-at-publish)_context_as_drift,_but_does_count_a_stale_one
  Scenario: An absent context is not drift but a stale one is
    Given the fixture tree with no context files written
    Then there is no drift
    And after a stale context is written for "top", the drift is exactly that path marked "stale — run gen-instance-contexts"
    And after every expected context is written there is neither drift nor problem
    And top still counts 1 document, so its written context is not read back as a document

  @test:scripts/tests/gen-instance-contexts.test.ts::gen-instance-contexts_over_a_fixture_tree::an_unresolved_IRI-position_prefix_and_a_conflict_are_problems,_naming_file_and_prefix
  Scenario: An unresolved prefix and a conflicting binding are problems naming file and prefix
    Given a "top" document typed "oa:Annotation" with oa bound nowhere
    And "top" binding dcterms differently from "base"
    When the findings are computed
    Then a problem starts with "top/refs/s.jsonld: prefix `oa`"
    And a problem says "prefix `dcterms` is bound differently"

  @test:scripts/tests/gen-instance-contexts.test.ts::gen-instance-contexts_over_a_fixture_tree::the_path_is_instance-relative:_ns/context/v1.jsonld
  Scenario: The context path is instance-relative
    Given the fixture tree
    When the instance contexts are generated
    Then top's context path is "top/" followed by the instance context path

  @test:scripts/tests/gen-instance-contexts.test.ts::an_instance_whose_`ns`_is_a_document_gets_its_context_BESIDE_it_(D1)::the_path_follows_what_the_instance_holds,_not_its_name
  Scenario: The context path follows whether the instance holds an ns document
    Given an instance "low" holding ns.jsonld and an instance "high" without one
    Then the beside path is "ns.context.v1.jsonld"
    And low's context path is the beside path
    And high's context path is the usual instance context path

  @test:scripts/tests/gen-instance-contexts.test.ts::an_instance_whose_`ns`_is_a_document_gets_its_context_BESIDE_it_(D1)::the_report,_and_so_the_writer,_puts_it_beside_the_vocabulary;_the_other_instance_keeps_ns/context/
  Scenario: The report puts the context beside the vocabulary for an ns-document instance
    Given "low" holding ns.jsonld and declaring the beside path builtAtPublish, and "high" needing it
    When the instance contexts are generated
    Then low's report path is "low/ns.context.v1.jsonld" with an expected context
    And high's report path is under "high/" at the usual instance context path

  @test:scripts/tests/gen-instance-contexts.test.ts::an_instance_whose_`ns`_is_a_document_gets_its_context_BESIDE_it_(D1)::declaring_the_beside_path_is_declaring_the_context;_the_written_file_is_not_read_back_as_a_document
  Scenario: The written beside context is not read back as a document
    Given low's expected context written at its beside path
    When the instance contexts are generated again
    Then low counts the same number of documents as before
    And there is no drift

  @test:scripts/tests/gen-instance-contexts.test.ts::gen-instance-contexts_—_remote-context_terms::the_context_DEFINES_the_terms_its_documents_use,_flattened_over_needs,_prefixes_bound_alongside
  Scenario: A context defines the remote-context terms its documents use
    Given a "leaf" needing "harness", with a document using the terms "title" and "cites" from a remote content context the harness owns
    When the instance contexts are generated
    Then leaf's context binds cito and dcterms and defines "cites" and "title" as the remote context does
    And the harness, having no documents, gets no context

  @test:scripts/tests/gen-instance-contexts.test.ts::gen-instance-contexts_—_remote-context_terms::a_term_whose_context's_owner_is_not_needed_is_a_PROBLEM_naming_file_and_term
  Scenario: A term whose context owner is not needed is a problem naming file and term
    Given "lone", which needs nothing, with a document using "title" from the harness's remote context
    When the instance contexts are generated
    Then lone takes no terms
    And a problem starts with "lone/a.jsonld: term `title`" and says "which lone does not need"

  @test:scripts/tests/gen-instance-contexts.test.ts::gen-instance-contexts_—_a_fixed_point_once_the_emitters_switch::the_instance_URL_reads_as_the_content_context:_`title`_is_still_defined
  Scenario: A document naming its layer's own context URL still yields that context's terms
    Given a "leaf" whose document names leaf's own context URL and uses "title"
    When the instance contexts are generated
    Then leaf's terms are exactly "title"
    And its context defines "title" as "dcterms:title"
