# scripts/arxiv-source.py unpacks an arXiv e-print's source files and records the paper's licence;
# pipeline/gen-library-jsonld.ts turns that source into a graph node. Each Scenario names the test that executes it.
Feature: arXiv source files and licence record

  @test:scripts/tests/arxiv-source-licence.test.ts::arxiv-source:_unpacked_files::keeps_the_TeX,_bibliography_and_licence_files,_and_nothing_else
  Scenario: Only TeX, bibliography and licence files are kept from the e-print
    Given an e-print bundle with main.tex, sec/intro.tex, refs.bib, LICENSE, fig.eps and a member named "../escape.tex"
    When arxiv-source.py runs on the entry
    Then it exits 0
    And source.json lists "files/LICENSE" as licence, "files/main.tex" and "files/sec/intro.tex" as tex, and "files/refs.bib" as bib
    And fig.eps is not unpacked
    And escape.tex is written neither beside nor inside the source files

  @test:scripts/tests/arxiv-source-licence.test.ts::arxiv-source:_licence::a_licence_arXiv_states_is_recorded_as_stated,_with_where_it_was_read
  Scenario: A licence arXiv states is recorded as stated, with where it was read
    Given an OAI record whose license is CC BY 4.0
    When arxiv-source.py runs on the entry
    Then licence.json has status "stated" and the CC BY 4.0 URL as its id
    And its basis names "0705.1468.xml"
    And its note points at "source/files/LICENSE"

  @test:scripts/tests/arxiv-source-licence.test.ts::arxiv-source:_licence::no_<license>_element_is_unknown,_never_a_default_licence
  Scenario: No license element records the licence as unknown
    Given an OAI record with no license element
    When arxiv-source.py runs on the entry
    Then licence.json has status "unknown" and no id
    And its first search result mentions "no <license>"

  @test:scripts/tests/arxiv-source-licence.test.ts::arxiv-source:_licence::a_PDF-only_paper_still_gets_its_licence_recorded
  Scenario: A PDF-only paper still gets its licence recorded
    Given an e-print that is a PDF and an OAI record with the arXiv non-exclusive licence
    When arxiv-source.py runs on the entry
    Then it exits 0 and reports "pdf-only"
    And no source e-print is kept
    And licence.json's id is the arXiv non-exclusive licence URL

  @test:scripts/tests/arxiv-source-licence.test.ts::arxiv-source:_licence::an_editor's_licence.json_is_left_alone
  Scenario: An editor's licence.json is left alone
    Given an entry whose licence.json was written by an editor as CC0-1.0
    When arxiv-source.py runs with --refetch
    Then licence.json is unchanged

  @test:scripts/tests/arxiv-source-licence.test.ts::gen-library-jsonld:_the_LaTeX_source_node::is_a_SourceDocument_partOf_the_paper,_carrying_its_files_and_the_paper's_licence
  Scenario: The LaTeX source node is a SourceDocument part of the paper
    Given a source record with one TeX file and a stated licence
    When the LaTeX source node is generated for "arxiv-0705.1468v1"
    Then its path is "source/manifest.jsonld"
    And its id ends in "arxiv-0705.1468v1/source/manifest" and its types include "SourceDocument"
    And it is part of the paper's manifest
    And its licence record is the paper's licence
    And its first file path is "source/files/main.tex"
