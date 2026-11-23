# scripts/check-content-keys.ts checks that every plain key a content .jsonld document writes is a
# declared term, and that no file path sits under an "@id"-typed term. Each Scenario names the test that executes it.
Feature: Content document keys are declared terms and paths are not links

  @test:scripts/tests/check-content-keys.test.ts::which_documents_are_judged::the_shared_content_context,_or_an_instance's_own_generated_one_—_nothing_else
  Scenario: Only the shared content context or an instance's generated context is judged
    Given the shared content context URL, an instance's "/ns/context/v1.jsonld" URL and the PROV-JSONLD context URL
    When each is asked whether it names the content terms
    Then the shared and the instance context do
    And the PROV-JSONLD context does not

  @test:scripts/tests/check-content-keys.test.ts::which_documents_are_judged::a_document_switched_to_its_instance_context_is_still_judged_against_the_content_terms
  Scenario: A document on its instance context is judged against the content terms
    Given a document whose context list starts with an instance context and declares "title" but also writes "stray"
    When its declared keys are checked against terms holding only "title"
    Then one document is judged
    And the only undeclared key is "stray"

  @test:scripts/tests/check-content-keys.test.ts::a_key_a_content_document_writes_must_be_a_declared_term::an_undeclared_key_is_caught_—_the_392-figure-narrative_defect
  Scenario: An undeclared key is caught
    Given a document on the content context writing "title" and "drafted_by" with a nested "id"
    When its declared keys are checked
    Then one document is judged
    And the undeclared keys are "drafted_by" and "id"

  @test:scripts/tests/check-content-keys.test.ts::a_key_a_content_document_writes_must_be_a_declared_term::keys_INSIDE_a_`@json`_value_are_data,_never_flagged
  Scenario: Keys inside a "@json" value are not flagged
    Given a document whose "narrative" term is typed "@json" and holds "drafted_by" and "id" keys
    When its declared keys are checked
    Then one document is judged
    And no key is undeclared

  @test:scripts/tests/check-content-keys.test.ts::a_key_a_content_document_writes_must_be_a_declared_term::a_document_on_another_context_is_not_this_check's_to_judge
  Scenario: A document on another context is skipped
    Given a document whose context is "https://other.example/ctx"
    When its declared keys are checked
    Then no document is judged

  @test:scripts/tests/check-content-keys.test.ts::a_key_a_content_document_writes_must_be_a_declared_term::the_real_corpus:_every_key_declared,_over_a_non-empty_corpus
  Scenario: Every key in the real corpus is declared
    Given the repository's real content corpus
    When its declared keys are checked
    Then more than zero documents are judged
    And no key is undeclared

  @test:scripts/tests/check-content-keys.test.ts::a_file_path_under_an_`@id`_term_is_caught::the_589f_shape_—_`../sections/x.md`_under_a_coerced_`text`_—_fails
  Scenario: A file path under an "@id"-coerced term fails
    Given a document whose "text" is "../sections/sec-001-intro.md" and "uses" names a node id
    And "text" and "uses" are both "@id"-typed
    When paths under link terms are checked
    Then one document is judged
    And only "text" is reported

  @test:scripts/tests/check-content-keys.test.ts::a_file_path_under_an_`@id`_term_is_caught::the_same_value_under_a_LITERAL_`text`_passes,_and_node_ids_never_trip_it
  Scenario: A path under a literal term passes, and node ids are not flagged
    Given the same document, with "text" a literal term and "uses" "@id"-typed
    When paths under link terms are checked
    Then one document is judged
    And nothing is reported

  @test:scripts/tests/check-content-keys.test.ts::a_file_path_under_an_`@id`_term_is_caught::what_counts_as_a_path
  Scenario: Which values look like a path
    Given the values "../sections/a.md", "./x", "thm-foo.md", "Proof.lean" and "img.PNG"
    Then each looks like a path
    And "library/doc/blocks/prose-sec-001", "papers/p/blocks/def-a" and "https://example.org/x" do not

  @test:scripts/tests/check-content-keys.test.ts::a_file_path_under_an_`@id`_term_is_caught::the_real_corpus:_no_path_under_an_`@id`_term
  Scenario: The real corpus has no path under an "@id" term
    Given the repository's real content corpus
    When paths under link terms are checked
    Then more than zero documents are judged
    And nothing is reported
