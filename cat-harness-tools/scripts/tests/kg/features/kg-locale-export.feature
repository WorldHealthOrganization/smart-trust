# scripts/kg-locale-export.ts builds per-locale copies of the core JSON-LD graph from the
# asset-scoped .po catalogues, without the core ever referencing a translation.
# Each Scenario names the test that executes it.
Feature: Per-locale exports of the knowledge graph

  @test:scripts/tests/kg/kg-locale-export.test.ts::translateDocument_—_the_same_graph,_in_another_language::it_substituted_something_—_the_suite_is_not_vacuous
  Scenario: A French translation of the miniature core makes real substitutions
    Given a five-node miniature core document and a French catalogue of four msgids
    When the document is translated to "fr" from source language "en"
    Then the report counts more than zero substitutions
    And it counts 4 applicable msgids

  @test:scripts/tests/kg/kg-locale-export.test.ts::translateDocument_—_the_same_graph,_in_another_language::a_translated_value_carries_its_OWN_language_tag
  Scenario: A translated value carries its own language tag
    Given the miniature core translated to "fr"
    When the process node P1 is read
    Then its name is the value "Réviser une modification" tagged with language "fr"

  @test:scripts/tests/kg/kg-locale-export.test.ts::translateDocument_—_the_same_graph,_in_another_language::an_untranslated_string_falls_through,_PLAIN_and_untagged
  Scenario: An untranslated string falls through plain and untagged
    Given the miniature core translated to "fr"
    When the skill node whose title has no catalogue entry is read
    Then its name is still the plain string "Untranslated title"

  @test:scripts/tests/kg/kg-locale-export.test.ts::translateDocument_—_the_same_graph,_in_another_language::the_document_declares_the_SOURCE_language,_never_this_locale
  Scenario: The translated document declares the source language, never the locale
    Given the miniature core translated to "fr" from "en"
    Then the document's sourceLanguage is "en"
    And neither the document nor its @context carries an @language

  @test:scripts/tests/kg/kg-locale-export.test.ts::translateDocument_—_the_same_graph,_in_another_language::every_@id_is_the_core's_—_a_translation_is_not_a_new_term
  Scenario: Every @id in a translated document is the core's
    Given the miniature core translated to "fr"
    Then the list of node @ids is identical, in order, to the core's
    And that list is not empty

  @test:scripts/tests/kg/kg-locale-export.test.ts::translateDocument_—_the_same_graph,_in_another_language::identity-bearing_keys_are_never_rewritten,_even_on_a_msgid_hit
  Scenario: Identity-bearing keys are never rewritten, even on a msgid hit
    Given the miniature core translated to "fr" with "Reviewer" in the catalogue
    When the Reviewer role node is read
    Then its notation is still "Reviewer"
    And its name is "Relecteur" tagged "fr"
    And its @type is still "cat:Role"

  @test:scripts/tests/kg/kg-locale-export.test.ts::translateDocument_—_the_same_graph,_in_another_language::links_are_left_alone,_and_the_@context_is_not_repointed
  Scenario: Links are left alone and the @context is not repointed
    Given the miniature core translated to "fr"
    When the task node T1 is read
    Then its performedBy is still the Reviewer role IRI
    And the document's @context equals the core's

  @test:scripts/tests/kg/kg-locale-export.test.ts::translateDocument_—_the_same_graph,_in_another_language::a_link_is_NOT_rewritten_even_when_the_catalogue_carries_it_as_a_msgid
  Scenario: A link is not rewritten even when the catalogue carries it as a msgid
    Given the French catalogue extended with the Reviewer role IRI and "cat:Role" as msgids
    When the miniature core is translated to "fr"
    Then task T1's performedBy is still the original Reviewer role IRI
    And the Reviewer node's @type is still "cat:Role"

  @test:scripts/tests/kg/kg-locale-export.test.ts::translateDocument_—_the_same_graph,_in_another_language::the_core_document_itself_is_not_mutated
  Scenario: Translating does not mutate the core document
    Given the miniature core has been translated to "fr"
    When the core's process node P1 is read
    Then its name is still "Review a change"

  @test:scripts/tests/kg/kg-locale-export.test.ts::isIri_—_prose_is_not_a_link::both_IRI_forms_are_recognised
  Scenario: Both IRI forms are recognised as links
    When isIri is asked about "https://x.test/a#b" and "skos:Concept"
    Then both are IRIs

  @test:scripts/tests/kg/kg-locale-export.test.ts::isIri_—_prose_is_not_a_link::a_sentence_with_a_colon_is_NOT
  Scenario: A sentence with a colon is not an IRI
    When isIri is asked about "Note: this happens" and "Review a change"
    Then neither is an IRI

  @test:scripts/tests/kg/kg-locale-export.test.ts::a_catalogue_is_scoped_to_the_asset_it_was_extracted_from::the_diagram's_catalogue_is_read;_the_docs_page's_is_not
  Scenario: Only the diagram's catalogue is read, not a docs page's
    Given a throwaway layer with workflows/demo.bpmn
    And a French demo.po translating "Review a change"
    And a French docs-page index.po translating "yes"
    When the projected stems and the French catalogue are read
    Then the projected stems are exactly "demo"
    And the catalogue maps "Review a change" to "Réviser une modification"
    And it has no entry for "yes"
    And it holds exactly one entry

  @test:scripts/tests/kg/kg-locale-export.test.ts::a_catalogue_is_scoped_to_the_asset_it_was_extracted_from::an_empty_`msgstr`_is_not_a_translation
  Scenario: An empty msgstr is not a translation
    Given a throwaway layer with workflows/demo.bpmn
    And a French demo.po whose only msgid has an empty msgstr
    When the French catalogue is read
    Then it is empty

  @test:scripts/tests/kg/kg-locale-export.test.ts::localeDocumentsUnreferenced_—_the_owner's_constraint,_checked::a_clean_core_has_no_findings
  Scenario: A clean core has no locale-reference findings
    Given the miniature core and the locales ar, es, fr, ru, zh
    When localeDocumentsUnreferenced checks it
    Then there are no findings

  @test:scripts/tests/kg/kg-locale-export.test.ts::localeDocumentsUnreferenced_—_the_owner's_constraint,_checked::a_translation_property_on_a_node_is_caught
  Scenario: A translation property on a node is caught
    Given a graph node carrying a hasTranslation property
    When localeDocumentsUnreferenced checks it
    Then there is exactly one finding

  @test:scripts/tests/kg/kg-locale-export.test.ts::localeDocumentsUnreferenced_—_the_owner's_constraint,_checked::an_availableLocales_array_is_caught
  Scenario: An availableLocales array is caught
    Given a graph node carrying availableLocales ["fr"]
    When localeDocumentsUnreferenced checks it
    Then there is exactly one finding

  @test:scripts/tests/kg/kg-locale-export.test.ts::localeDocumentsUnreferenced_—_the_owner's_constraint,_checked::a_locale_key_anywhere_is_caught,_including_in_the_@context
  Scenario: A locale key in the @context is caught
    Given a document whose @context has a "fr" key
    When localeDocumentsUnreferenced checks it
    Then there is exactly one finding

  @test:scripts/tests/kg/kg-locale-export.test.ts::localeDocumentsUnreferenced_—_the_owner's_constraint,_checked::a_per-locale_@id_is_caught
  Scenario: A per-locale @id is caught
    Given a node whose @id is under cat-harness.fr.jsonld
    When localeDocumentsUnreferenced checks it
    Then there is at least one finding

  @test:scripts/tests/kg/kg-locale-export.test.ts::the_real_corpus_—_what_it_can_still_answer_with_zero_translations::there_are_locales_to_report_on
  Scenario: The real cat-harness corpus has locales to report on
    When the known locales of cat-harness are listed
    Then there is at least one

  @test:scripts/tests/kg/kg-locale-export.test.ts::the_real_corpus_—_what_it_can_still_answer_with_zero_translations::the_core_graph_references_no_translation,_and_that_is_CHECKED
  Scenario: The real core graph references no translation
    When the locale exports are built from the real corpus
    Then there are no core problems
    And there is no @id drift

  @test:scripts/tests/kg/kg-locale-export.test.ts::the_real_corpus_—_what_it_can_still_answer_with_zero_translations::every_locale_is_reported,_emitted_or_not
  Scenario: Every known locale is reported, emitted or not
    When the locale exports are built from the real corpus
    Then the reported locales equal cat-harness's known locales, in order
    And each reports a numeric catalogue size

  @test:scripts/tests/kg/kg-locale-export.test.ts::the_real_corpus_—_what_it_can_still_answer_with_zero_translations::--all-locales_emits_one_document_per_locale,_@ids_unchanged
  Scenario: --all-locales emits one document per locale with @ids unchanged
    When the locale exports are built with allLocales
    Then there is one document per known locale
    And there is no @id drift

  @test:scripts/tests/kg/kg-locale-export.test.ts::the_real_corpus_—_what_it_can_still_answer_with_zero_translations::no_locale_document_carries_a_root_field_its_own_@context_omits
  Scenario: No locale document carries a root field its own @context omits
    When the locale exports are built with allLocales
    Then rootUndeclared is empty
    And in every emitted document each non-@ root key is declared in its @context

  @test:scripts/tests/kg/kg-locale-export.test.ts::the_real_corpus_—_what_it_can_still_answer_with_zero_translations::a_locale_document_carries_the_QA_findings_the_core_strips_—_none_of_them
  Scenario: A locale document re-publishes none of the QA findings the core strips
    When the locale exports are built with allLocales
    Then at least one document is emitted
    And no document has an undeclaredTerms, undeclaredSchemaModules, danglingLinks or problems key

  @test:scripts/tests/kg/kg-locale-export.test.ts::the_real_corpus_—_what_it_can_still_answer_with_zero_translations::sourceLanguage_IS_carried,_and_IS_declared
  Scenario: Every locale document carries and declares sourceLanguage
    When the locale exports are built with allLocales
    Then each document's sourceLanguage equals the build's source language
    And each document's @context declares sourceLanguage

  @test:scripts/tests/kg/kg-locale-export.test.ts::the_real_corpus_—_what_it_can_still_answer_with_zero_translations::the_guard_can_actually_fail_—_a_planted_root_field_is_reported
  Scenario: The undeclared-root-field guard reports a planted field
    Given a document whose @context declares only "name"
    When undeclaredRootTerms checks it with an extra plantedRootField
    Then it reports ["plantedRootField"]
    And without that field it reports nothing

  @test:scripts/tests/kg/kg-locale-export.test.ts::the_real_corpus_—_what_it_can_still_answer_with_zero_translations::`buildLocaleExports`_actually_asks_it_—_the_CALL,_not_just_the_function
  Scenario: buildLocaleExports still calls the undeclared-root-field guard
    # Gap: a source-text check only; it does not prove the call is reached or that its findings fail the CLI
    Given the source of scripts/kg-locale-export.ts from buildLocaleExports onward
    Then it contains a call to undeclaredRootTerms
    And it pushes into rootUndeclared

  @test:scripts/tests/kg/kg-locale-export.test.ts::localeDocPath::it_sits_beside_the_core_document,_suffixed_by_locale
  Scenario: A locale document sits beside the core document, suffixed by locale
    When localeDocPath is asked for cat-harness in "fr"
    Then it is "cat-harness.fr.jsonld"

  @test:scripts/tests/kg/kg-locale-export.test.ts::hosted_translations_—_an_instance's_templates_may_live_in_its_HOST's_corpus::cat-harness_owns_its_corpus_—_scope_is_empty
  Scenario: cat-harness owns its translation corpus with an empty scope
    When the translations home of cat-harness is resolved with cat-harness as host
    Then it is by "own"
    And its scope is empty

  @test:scripts/tests/kg/kg-locale-export.test.ts::hosted_translations_—_an_instance's_templates_may_live_in_its_HOST's_corpus::bootstrap_is_HOSTED_by_cat-harness,_scoped_by_its_stub
  Scenario: bootstrap is hosted by cat-harness, scoped by its stub
    When the translations home of bootstrap is resolved with cat-harness as host
    Then it is by "hosted"
    And its scope is ["bootstrap"]
    And its root is cat-harness/translations

  @test:scripts/tests/kg/kg-locale-export.test.ts::hosted_translations_—_an_instance's_templates_may_live_in_its_HOST's_corpus::with_no_host_offered,_bootstrap_falls_back_to_the_convention_and_SAYS_so
  Scenario: With no host offered, bootstrap falls back to the convention
    When the translations home of bootstrap is resolved with no host
    Then it is by "convention"
    And its scope is empty

  @test:scripts/tests/kg/kg-locale-export.test.ts::hosted_translations_—_an_instance's_templates_may_live_in_its_HOST's_corpus::a_hosted_instance's_locales_are_its_host's,_and_it_finds_them
  Scenario: A hosted instance finds its host's locales
    When the known locales of bootstrap are listed
    Then there is at least one

  @test:scripts/tests/kg/kg-locale-export.test.ts::hosted_translations_—_an_instance's_templates_may_live_in_its_HOST's_corpus::localeDirIn_inserts_the_scope_for_a_hosted_instance_and_not_for_an_owner
  Scenario: localeDirIn inserts the scope for a hosted instance and not for an owner
    Given the translations homes of bootstrap (hosted) and cat-harness (own)
    When the "fr" locale directory is resolved in each
    Then bootstrap's is cat-harness/translations/fr/bootstrap
    And cat-harness's is cat-harness/translations/fr

  @test:scripts/tests/kg/kg-locale-export.test.ts::hosted_translations_—_an_instance's_templates_may_live_in_its_HOST's_corpus::the_two_real_instances_disagree_on_`by`_AND_on_`scope`
  Scenario: The two real instances disagree on by and on scope
    Given the translations homes of bootstrap and cat-harness, both with cat-harness as host
    Then their by values differ
    And their scopes differ

  @test:scripts/tests/kg/kg-locale-export.test.ts::hosted_translations_—_an_instance's_templates_may_live_in_its_HOST's_corpus::a_directory_that_declares_nothing_and_is_hosted_by_nobody_is_the_convention
  Scenario: A directory that declares nothing and is hosted by nobody is the convention
    Given an empty temporary directory
    When its translations home is resolved with cat-harness as host
    Then it is by "convention"
    And its root is the directory's own translations folder
