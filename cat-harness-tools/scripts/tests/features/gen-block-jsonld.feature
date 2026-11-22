# pipeline/gen-block-jsonld.ts emits each block manifest of a paper as a JSON-LD node,
# exercised end to end on a synthetic paper. Each Scenario names the test that executes it.
Feature: Block JSON-LD emission

  @test:scripts/tests/gen-block-jsonld.test.ts::gen-block-jsonld::loads_only_real_block_manifests
  Scenario: Only real block manifests are loaded
    Given a synthetic chapter holding block manifests "def:widget" and "thm:main" and a chapter manifest
    When the blocks under it are loaded
    Then the loaded labels are exactly "def:widget" and "thm:main"

  @test:scripts/tests/gen-block-jsonld.test.ts::gen-block-jsonld::emits_a_minted_@id_and_preserves_the_authored_label_verbatim
  Scenario: A block gets a minted @id and keeps its authored label
    Given the "def:widget" block of paper "test-paper"
    When it is emitted as JSON-LD
    Then its @id is "papers/test-paper/blocks/def-widget"
    And its label is "def:widget"
    And its context is the published content-document context URL plus a local context with the same @base
    And the local context binds only "@base" and "folio-assistant-sci"

  @test:scripts/tests/gen-block-jsonld.test.ts::gen-block-jsonld::co-types_with_DoCO_where_the_mapping_is_unambiguous
  Scenario: A theorem is co-typed with DoCO
    Given the "thm:main" theorem block
    When it is emitted as JSON-LD
    Then its types are "folio-assistant-sci:Theorem" and "doco:Section"

  @test:scripts/tests/gen-block-jsonld.test.ts::gen-block-jsonld::resolves_uses[]_to_IRIs,_dedupes,_and_preserves_authored_order
  Scenario: Uses references resolve to IRIs, deduplicated, in authored order
    Given "thm:main" using "def:widget" twice, "other-paper:cor:pbw", "bare-ref" and "ns:mystery:bogus"
    When it is emitted as JSON-LD
    Then its uses are the IRIs of def-widget, other-paper's cor-pbw and test-paper's bare-ref, in that order

  @test:scripts/tests/gen-block-jsonld.test.ts::gen-block-jsonld::an_unresolvable_reference_is_reported,_not_silently_emitted
  Scenario: An ambiguous reference is reported as dangling and not emitted
    Given the "thm:main" block and an empty dangling list
    When it is emitted as JSON-LD
    Then exactly one dangling reference is reported, "ns:mystery:bogus" in field "uses"
    And the emitted document does not mention "mystery"

  @test:scripts/tests/gen-block-jsonld.test.ts::gen-block-jsonld::a_prefix-less_reference_is_reported_as_unconventional,_not_dropped
  Scenario: A prefix-less reference is reported as unconventional and still emitted
    Given the "thm:main" block and empty dangling and unconventional lists
    When it is emitted as JSON-LD
    Then exactly one unconventional reference is reported, "bare-ref" in field "uses"
    And the document still holds "papers/test-paper/blocks/bare-ref"
    And "bare-ref" is not among the dangling references

  @test:scripts/tests/gen-block-jsonld.test.ts::gen-block-jsonld::lean.ref_stays_a_literal_—_a_Lean_decl_is_not_a_web_resource
  Scenario: The Lean reference stays a literal
    Given the "thm:main" block with Lean ref "qou:QOU.Main" marked sorry-free
    When it is emitted as JSON-LD
    Then its leanRef is the literal "qou:QOU.Main"
    And sorryFree is true

  @test:scripts/tests/gen-block-jsonld.test.ts::gen-block-jsonld::links_companions_that_exist_and_omits_those_that_do_not
  Scenario: Companion files are linked only when they exist
    Given "def:widget" with a .md sibling and no .lean sibling
    When it is emitted as JSON-LD
    Then its text is "def-widget.md"
    And it has no leanSource

  @test:scripts/tests/gen-block-jsonld.test.ts::gen-block-jsonld::cites_become_reference_IRIs,_and_tags_dedupe
  Scenario: Cites become reference IRIs and tags are deduplicated
    Given "def:widget" citing "kock2004" and tagged "algebra" twice
    When it is emitted as JSON-LD
    Then its cites are "references/kock2004"
    And its tags are just "algebra"

  @test:scripts/tests/gen-block-jsonld.test.ts::gen-block-jsonld::marks_provenance_so_ingested_nodes_stay_distinguishable
  Scenario: Emitted blocks are marked as authored
    Given the "def:widget" block
    When it is emitted as JSON-LD
    Then its provenance is "authored"

  @test:scripts/tests/gen-block-jsonld.test.ts::gen-block-jsonld::output_is_byte-stable_—_the_--check_gate_depends_on_it
  Scenario: Emitting the same block twice gives identical output
    # Gap: only two emissions in one process are compared; the --check gate itself is not run.
    Given the "thm:main" block
    When it is emitted and serialised twice
    Then both serialisations are identical
