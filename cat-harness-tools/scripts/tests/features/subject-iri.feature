# Subject IRIs are paths, not #fragments (litlfred/cat-harness-tools#603).
# Each Scenario names the test that executes it.
Feature: Subject IRIs are paths

  @test:scripts/tests/subject-iri.test.ts::the_form::a_subject_is_<doc_dir>/<kind>/<id>_—_the_owner's_own_example
  Scenario: A subject IRI is the document's directory, the kind and the id
    Given the document "https://litlfred.github.io/folio-assistant/folio-assistant-core/folio-assistant-core.jsonld"
    When the IRI of globalTask "GT_SeedWorkPlan" is minted
    Then it is ".../folio-assistant-core/globalTask/GT_SeedWorkPlan"

  @test:scripts/tests/subject-iri.test.ts::the_form::a_step_and_a_lane_are_paths_under_their_process;_a_flow_is_a_fragment_of_its_page
  Scenario: Steps and lanes nest under their process; a flow is a fragment
    Given a document and process "P"
    When the IRIs of "P", "P/node/T", "P/lane/L" and "P/flow/F" are minted
    Then the step and lane are paths ".../process/P/node/T" and ".../process/P/lane/L"
    And the flow is the fragment ".../process/P#flow/F"

  @test:scripts/tests/subject-iri.test.ts::the_form::never_`<doc>.jsonld/<kind>/…`,_which_no_static_host_can_serve_beside_the_file
  Scenario: An IRI never nests under the .jsonld file
    Given a document whose file is "folio-assistant-core.jsonld"
    When a skill IRI is minted
    Then it does not contain ".jsonld/"
    And the subject base is the document's directory with a trailing slash

  @test:scripts/tests/subject-iri.test.ts::the_form::only_what_would_end_or_re-delimit_a_segment_is_escaped;_`/`_nests
  Scenario: Only segment-breaking characters are escaped
    When the IRIs of decision "gate/D 1" and skill "a#b?c" are minted
    Then "/" is kept and nests, the space becomes "%20"
    And "#" and "?" become "%23" and "%3F"

  @test:scripts/tests/subject-iri.test.ts::the_form::a_document-relative_export_mints_relative_subjects,_as_it_minted_relative_fragments
  Scenario: A relative document mints relative subjects
    When a skill IRI is minted against the bare document "cat-harness.jsonld"
    Then it is "skill/x"

  @test:scripts/tests/subject-iri.test.ts::the_form::an_unknown_kind_is_refused_rather_than_minted
  Scenario: An unknown kind is refused
    When an IRI of kind "skils" is minted
    Then it throws "not a subject kind"

  @test:scripts/tests/subject-iri.test.ts::the_form::makeIri_and_subgraphIri_are_one_minter
  Scenario: The subgraph IRI is the directory subject IRI
    When the subgraph IRI of "todos" is minted
    Then it equals makeIri and subjectIri of directory "todos"

  @test:scripts/tests/subject-iri.test.ts::telling_this_document's_subjects_from_everything_else::the_host_sits_at_the_site_root,_and_still_does_not_claim_another_instance's_subjects
  Scenario: The host document claims only its own subjects
    Given the host document at the site root
    Then a skill IRI and a flow IRI under the root resolve to their subject paths
    And another instance's subject, a tool file, the document itself and a vocabulary term resolve to nothing

  @test:scripts/tests/subject-iri.test.ts::telling_this_document's_subjects_from_everything_else::the_pre-#603_fragment_is_recovered_exactly,_a_flow's_`#flow/`_folded_back
  Scenario: The old fragment IRI is recovered from a path IRI
    When the legacy fragment of a globalTask, a step and a flow is asked for
    Then each is "<document>#<kind>/<id>", the flow written "#process/P/flow/F"
    And an IRI outside the document has no legacy fragment

  @test:scripts/tests/subject-iri.test.ts::telling_this_document's_subjects_from_everything_else::a_document_that_moved_names_its_old_fragments_by_the_old_document
  Scenario: A moved document's old fragments name the old document
    Given the host document moved to "<site>/cat-harness/cat-harness.jsonld"
    When the legacy fragment of a skill is asked for with the old document
    Then it is "<old document>#skill/a", and a flow's is "<old document>#process/P/flow/F"
    And without the old document it names the moved one

  @test:scripts/tests/subject-iri.test.ts::telling_this_document's_subjects_from_everything_else::a_subject's_files_sit_at_its_path;_a_flow_has_none;_nothing_escapes_the_directory
  Scenario: A subject's file stem is its path
    Then decision "gate/D 1" has the file stem "decision/gate/D 1"
    And a flow has no file stem
    And an IRI ending in ".." has no file stem

  @test:scripts/tests/subject-iri.test.ts::bootstrap's_document_mints_paths_too_(#958)::links_into_bootstrap's_document_name_its_subject_paths
  Scenario: Bootstrap's document mints paths
    Given bootstrap's document
    Then it does not mint fragments
    And a skill and a flow get path and "#flow/" IRIs under "bootstrap/"
    And the skill's IRI resolves back to "skill/discussion"

  @test:scripts/tests/subject-iri.test.ts::bootstrap's_document_mints_paths_too_(#958)::no_document_is_left_on_fragments
  Scenario: No document is left minting fragments
    Then the list of fragment-document stubs is empty

  @test:scripts/tests/subject-iri.test.ts::every_subject_loads:_its_own_.jsonld_and_page::the_writer_puts_a_.jsonld_and_a_page_at_every_subject's_path,_and_nothing_else
  Scenario: Every own subject gets a .jsonld and a page
    Given a published graph with a skill, a process, its step, lane and flow, another layer's skill and a tool
    When the subject documents are written
    Then exactly the context file and a .jsonld and .html for the skill, process, step and lane are written, plus "process/P/index.html"
    And each subject document names the shared context, is part of the document and holds only its node
    And the process document holds the flow, the process page anchors "flow/F", and no flow directory exists
    And the skill page links its .jsonld, carries the search-exclude marker, and escapes a title holding "</script>" both in its script and its HTML

  @test:scripts/tests/subject-iri.test.ts::every_subject_loads:_its_own_.jsonld_and_page::a_preview's_stamp_is_in_each_subject's_.jsonld_but_not_in_its_page_(bean_g196,_Q-S1-1_A)
  Scenario: A preview stamp stays out of the subject pages
    Given a published graph carrying a staging stamp with sha "feedc0de1234"
    When the subject documents are written
    Then the step's .jsonld carries the stamp's sha
    And the step page, the process page and the process index page contain neither the sha nor "staging", but still embed "partOf"

  @test:scripts/tests/subject-iri.test.ts::every_subject_loads:_its_own_.jsonld_and_page::served_somewhere_its_IRI_does_not_name:_a_copy_here,_sameAs_the_canonical_subject_document_(#638_option_B)
  Scenario: A copy served elsewhere is sameAs the canonical subject document
    When the subject documents are written for a mirror URL
    Then the step's document is named and has its context at the mirror, and is part of the mirror document
    And it is sameAs the canonical step document while its node keeps the canonical IRI
    And its page says "owl:sameAs"
    When they are written for the canonical document
    Then the step's document has the canonical name and no sameAs

  @test:scripts/tests/subject-iri.test.ts::every_subject_loads:_its_own_.jsonld_and_page::a_process,_its_steps_and_its_lanes_link_to_the_diagram;_nothing_else_does_(#638,_owner's_3a)
  Scenario: Only a process and its parts link to the diagram
    Given a diagram page known for process "P"
    When the subject documents are written
    Then the process page, its index, its step page and its lane page link to the diagram
    And the skill page has no diagram link

  @test:scripts/tests/subject-iri.test.ts::every_subject_loads:_its_own_.jsonld_and_page::a_page_sits_in_the_site's_content_column,_follows_the_site's_light/dark_switch,_and_names_its_parent_(owner,_2026-10-31)
  Scenario: A subject page is laid out and themed like the site
    When the subject documents are written
    Then the step page has the "fa-page-main" content column and a "data-fa-scheme" dark rule, not a bare media-query dark rule
    And it names its parent process "P" by name with a link, and again with the IRI under it
    And the lane page has no "Part of" line
    And the step and skill pages carry data-fa-pin with their IRI, their node kind and a pin control

  @test:scripts/tests/subject-iri.test.ts::the_diagram_page_a_subject_links_to::a_step_and_a_lane_belong_to_their_process;_a_skill_to_none
  Scenario: The owning process of a subject
    Then a step, a lane and the process itself are owned by process "P"
    And a skill is owned by no process

  @test:scripts/tests/subject-iri.test.ts::the_diagram_page_a_subject_links_to::found_from_the_depiction,_never_guessed:_no_published_picture,_no_link
  Scenario: No published picture, no diagram page
    # Gap: only the negative half is checked; no test shows a depiction that does exist yielding a diagram page.
    Given a process whose depiction names an SVG that does not exist and a process with no depiction
    When the diagram pages are derived
    Then there are none
