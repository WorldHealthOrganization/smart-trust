Feature: links from one document of a folio to another (issue #841)

  @test:scripts/cross-document-refs.test.ts::the_folio's_documents::every_folio/<slug>/<slug>.ts,_nothing_else
  Scenario: only folio/<slug>/<slug>.ts is a document
    When the folio's documents are listed
    Then guide and toolkit are listed and a folder with no manifest is not

  @test:scripts/cross-document-refs.test.ts::the_folio's_documents::places_are_counted_in_manifest_order
  Scenario: chapters, sections, subsections and blocks are numbered in manifest order
    When the guide's places are counted
    Then a chapter is "Chapter i", a section "Section i.j", a subsection "Section i.j.k" and a block cites its section

  @test:scripts/cross-document-refs.test.ts::splitting_a_ref::only_a_sibling_slug_makes_a_ref_cross-document
  Scenario: a ref is cross-document only when its first part is a sibling slug
    When refs are split
    Then "guide:sec:access" names the guide and "sec:access" names no document

  @test:scripts/cross-document-refs.test.ts::splitting_a_ref::the_citation_names_the_title_and_the_place,_or_the_label_as_written
  Scenario: the citation names the document title and the place
    When a citation is made
    Then it reads "<title>, Section N", or the label when the label is unknown

  @test:scripts/cross-document-refs.test.ts::the_site::a_sibling's_page_is_beside_this_one
  Scenario: a sibling's page is beside this one
    When the path from toolkit to guide is made
    Then it is ../guide/index.html

  @test:scripts/cross-document-refs.test.ts::the_site::\ref{guide:…}_links_the_guide's_page,_reading_as_its_citation
  Scenario: \ref{guide:...} links the guide's page
    When a block's Markdown is prepared for the site
    Then the cross-document ref links ../guide/index.html#<label> and other refs are unchanged

  @test:scripts/cross-document-refs.test.ts::the_site::a_ref_to_the_page's_own_slug_is_a_same-page_anchor
  Scenario: a ref to the page's own slug is a same-page anchor
    When a self-prefixed ref is prepared
    Then it links #<label>

  @test:scripts/cross-document-refs.test.ts::the_site::fenced_code_is_left_as_written
  Scenario: fenced code is left as written
    When fenced code holds a ref
    Then it is unchanged

  @test:scripts/cross-document-refs.test.ts::the_site::rendered_#guide:…_anchors_go_to_the_guide's_page;_others_are_unchanged
  Scenario: rendered sibling anchors go to the sibling's page
    When rendered HTML is linked
    Then #guide:<label> and its percent-encoded form go to ../guide/index.html#<label>, and same-page anchors stay

  @test:scripts/cross-document-refs.test.ts::the_site::a_folio_of_one_document_is_untouched
  Scenario: a folio of one document is untouched
    When the folio has one document
    Then nothing is rewritten

  @test:scripts/cross-document-refs.test.ts::Word_and_PDF::a_cross-document_ref_is_a_readable_citation
  Scenario: a cross-document ref is a readable citation in Word and PDF
    When the export Markdown is prepared
    Then \ref and links into the guide read "Cybersecurity Guidance, Section N"

  @test:scripts/cross-document-refs.test.ts::Word_and_PDF::same-document_refs_keep_their_anchor,_without_the_slug
  Scenario: same-document refs keep their anchor
    When a self-prefixed ref is exported
    Then the slug is dropped and the anchor kept

  @test:scripts/cross-document-refs.test.ts::Word_and_PDF::an_image_is_not_a_link
  Scenario: an image is not a link
    When an image points at a sibling anchor
    Then it is unchanged
