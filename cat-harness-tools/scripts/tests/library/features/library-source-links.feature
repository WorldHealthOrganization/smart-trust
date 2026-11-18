# Every library page links, visibly, the published files it renders (owner,
# 2026-10-15). Each Scenario names the test that executes it.
Feature: Library pages link their sources

  @test:scripts/tests/library/library-source-links.test.ts::an_entry_page's_sources_are_the_files_the_writer_publishes::manifest,_sub-graph_file,_both_projections_and_the_avatar,_each_at_its_published_path
  Scenario: Each entry source link resolves to the path the writer publishes
    Given the sources of entry e1 with a manifest, an L1 extraction file and a cover avatar
    When each link is resolved from the entry's shell directory
    Then the manifest resolves to the library asset path
    And the extraction file to its entry graph site path
    And e1.doc.json and e1.json to the entry's two data files
    And e1.png to the one avatar copy the writer makes

  @test:scripts/tests/library/library-source-links.test.ts::an_entry_page's_sources_are_the_files_the_writer_publishes::the_entry's_own_subgraph_index_is_linked_when_published_(cat-harness#180)
  Scenario: The entry's subgraph index is linked when published
    Given entry sources built with a published subgraph index
    Then the link described as the entry's subgraph resolves to that index

  @test:scripts/tests/library/library-source-links.test.ts::an_entry_page's_sources_are_the_files_the_writer_publishes::a_file_that_is_not_published_is_not_linked
  Scenario: Unpublished files are not linked
    Given entry sources with no manifest, no graph files and no avatar
    Then the only links are e1.doc.json and e1.json

  @test:scripts/tests/library/library-source-links.test.ts::an_entry_page's_sources_are_the_files_the_writer_publishes::the_entry_page_draws_them_where_a_reader_sees_them,_not_only_in_<noscript>
  Scenario: The entry page draws its sources outside noscript
    Given an entry page built with the entry's sources
    When its noscript blocks are removed
    Then what remains holds the lib-sources section and every source href

  @test:scripts/tests/library/library-source-links.test.ts::an_instance_page_and_the_whole-library_page::the_instance_page_links_the_projection,_its_subgraph_and_each_entry's_JSON-LD
  Scenario: The instance page links projection, subgraph and entry JSON-LD
    Given an instance page with a data file, a subgraph and one entry manifest
    Then its links resolve, in order, to the data file, the subgraph and the manifest
    And with no subgraph and no manifests it has one link

  @test:scripts/tests/library/library-source-links.test.ts::an_instance_page_and_the_whole-library_page::the_whole-library_page_tabulates_every_instance's_library,_and_says_when_its_JSON-LD_is_not_published
  Scenario: The whole-library page tabulates each instance's library
    Given the whole-library page for instance a (2 entries, a page and JSON-LD) and b (0 entries, nothing published)
    Then it holds the lib-subgraphs table linking a's page and JSON-LD
    And b's row reads b, 0, —, "not published"

  @test:scripts/tests/library/library-source-links.test.ts::an_instance_page_and_the_whole-library_page::a_page_with_nothing_to_link_draws_no_empty_section
  Scenario: Nothing to link draws no section
    Then the sources HTML of no links is empty
    And a viewer page given no sources holds no lib-sources

  @test:scripts/tests/library/library-source-links.test.ts::which_instances_a_site_composes_(owner,_2026-10-15)::a_root_that_declares_an_instance_composes_it_and_its_transitive_needs,_not_every_mount
  Scenario: A declared root composes itself and its transitive needs
    Given a root folio needing mid, mid needing low, and an unrelated mount other
    Then the composed instance roots are the root, mid and low
    And library paths of the root and low are in the composition, and other's is not

  @test:scripts/tests/library/library-source-links.test.ts::which_instances_a_site_composes_(owner,_2026-10-15)::a_hub_root_that_declares_nothing_composes_every_instance
  Scenario: An undeclared hub root composes every instance
    Given a root declaring nothing, holding instances a and b
    Then its composed roots are undefined
    And b's library path is in the composition

  @test:scripts/tests/library/library-source-links.test.ts::an_entry's_repository_links_name_the_repository_that_holds_it::a_mounted_entry_is_in_the_mounted_repository,_under_its_upstream_root_—_not_the_handler's
  Scenario: A mounted entry is placed in the mounted repository
    Given a mount lock placing smart-base at smart-base/ in repository o/smart-base
    Then the entry smart-base/library/e1 is in o/smart-base at that path, not the handler's repository
    And a path no mount covers is in the checkout's own repository
    And with no checkout repository it has no place

  @test:scripts/tests/library/library-source-links.test.ts::an_entry's_repository_links_name_the_repository_that_holds_it::the_Document_panel's_[source]_and_[feedback]_are_built_in_that_repository
  Scenario: The document view's repository links name the holding repository
    Given the mounted entry's page-granular structure
    When its document view is read with the placed repository and path
    Then its links name repo o/smart-base, branch main and the entry's path

  @test:scripts/tests/library/library-source-links.test.ts::an_entry's_repository_links_name_the_repository_that_holds_it::the_source_file_is_found_in_the_intake_by_its_sha256
  Scenario: The source file is found in the intake
    Given an upload intake whose files list the source's sha256
    Then the entry's source file is uploads/e1/e 1.pdf
    And it is the same when the entry records no sha256
    And with no uploads it is undefined

  @test:scripts/tests/library/library-source-links.test.ts::an_entry's_repository_links_name_the_repository_that_holds_it::a_PDF_opens_in_the_site's_PDF_viewer,_pointed_at_the_raw_file_in_its_repository
  Scenario: A PDF source opens in the site's PDF viewer
    Given the entry's repository links for its held PDF
    Then the PDF link is the viewer with src set to the encoded raw URL in o/host
    And the viewer part resolves to the site's PDF viewer path
    And a separate raw link is the raw URL

  @test:scripts/tests/library/library-source-links.test.ts::an_entry's_repository_links_name_the_repository_that_holds_it::a_non-PDF_source_links_to_the_file_directly
  Scenario: A non-PDF source links to its raw file
    Given the entry's source is notes.docx inside the entry
    Then the first link is notes.docx at its raw URL in o/smart-base
    And no link goes through the viewer

  @test:scripts/tests/library/library-source-links.test.ts::an_entry's_repository_links_name_the_repository_that_holds_it::the_KG_files_link_into_the_entry's_own_repository
  Scenario: The KG files link into the entry's own repository
    Then structure.json links to its blob in o/smart-base
    And sections/ and blocks/ link to their trees in o/smart-base

  @test:scripts/tests/library/library-source-links.test.ts::an_entry's_repository_links_name_the_repository_that_holds_it::the_entry_page_draws_them_beside_the_published_manifest
  Scenario: The repository links are listed beside the published manifest
    Given entry sources with a manifest and the repository links
    Then the labels are manifest.jsonld, e 1.pdf, e 1.pdf (raw), structure.json, sections/, blocks/, e1.doc.json, e1.json

  @test:scripts/tests/library/library-source-links.test.ts::an_entry's_repository_links_name_the_repository_that_holds_it::a_withheld_entry_links_none_of_it
  Scenario: A withheld entry has no repository links
    When the repository links are built for a withheld entry
    Then there are none

  @test:scripts/tests/library/library-source-links.test.ts::the_primary_asset_has_a_view_panel_near_the_top_(owner,_2026-10-16)::only_a_kind_with_a_viewer_is_viewable
  Scenario: Only a kind with a viewer is viewable
    Then a.PDF is viewed as pdf and cover.jpeg as image
    And notes.docx has no view kind

  @test:scripts/tests/library/library-source-links.test.ts::the_primary_asset_has_a_view_panel_near_the_top_(owner,_2026-10-16)::the_PDF_link_entryRepoLinks_writes_is_the_one_marked_to_view;_its_raw_twin_is_not
  Scenario: Only the viewer PDF link is marked to view
    Given the repository links for a held PDF source
    Then exactly one link carries a view: e1.pdf, a pdf view of the raw URL through the viewer

  @test:scripts/tests/library/library-source-links.test.ts::the_primary_asset_has_a_view_panel_near_the_top_(owner,_2026-10-16)::the_entry_page_draws_the_panel_under_the_head,_above_the_listing,_closed,_with_the_shared_pdf.js_embed
  Scenario: The view panel sits under the title and above the listing, closed
    Given an entry page whose sources include a viewable PDF
    Then the lib-view panel comes after lib-title and before the listing
    And it holds the shared PDF embed marker, the PDF as data-src, about:blank as src, and the viewer path
    And its details element is not open

  @test:scripts/tests/library/library-source-links.test.ts::the_primary_asset_has_a_view_panel_near_the_top_(owner,_2026-10-16)::no_viewable_source,_no_panel_—_nor_on_a_page_that_is_not_an_entry's
  Scenario: No viewable source gives no panel
    Then the view panel of non-viewable sources is empty
    And an entry page with only those sources has no lib-view
    And an instance page has no lib-view

  @test:scripts/tests/library/library-source-links.test.ts::the_primary_asset_has_a_view_panel_near_the_top_(owner,_2026-10-16)::the_index's_viewable_is_the_panel's_condition:_held,_linkable,_a_viewer's_kind,_not_withheld
  Scenario: An entry is viewable only when held, linkable, of a viewer's kind and not withheld
    Then a held PDF in a known repository is viewable as pdf
    And it is not viewable when withheld, or with no repository to link
    And a held .docx is not viewable
    And a PDF not held is not viewable

  @test:scripts/tests/library/library-source-links.test.ts::the_primary_asset_has_a_view_panel_near_the_top_(owner,_2026-10-16)::arriving_at_#lib-view_opens_the_panel_—_the_folio_glass's_eye_links_there
  Scenario: The viewer script opens the panel on #lib-view
    # Gap: the title says arriving at #lib-view opens the panel; the body checks only that the two code fragments occur in the script, not that the hash check guards the open.
    Given the viewer script
    Then it tests location.hash against "#lib-view" and sets d.open = true

  @test:scripts/tests/library/library-source-links.test.ts::the_primary_asset_has_a_view_panel_near_the_top_(owner,_2026-10-16)::a_source_not_held_is_said_so_where_the_panel_would_be,_linking_out_—_never_into_the_viewer
  Scenario: A source not held is said so, with outward links
    Then the elsewhere links of a DOI and an arXiv id are the arXiv abstract only
    And a DOI alone links doi.org
    And empty ids give no links
    And an entry page with a not-held source says "is not held on this site", links arXiv in a new tab, and has no PDF embed
    And with no outward links it says "No public link is recorded"
    And a held viewable source shows the panel, not the not-held note

  @test:scripts/tests/library/library-source-links.test.ts::the_primary_asset_has_a_view_panel_near_the_top_(owner,_2026-10-16)::an_image_is_drawn_as_itself
  Scenario: An image source is drawn as an image
    When the view panel is built for an image source
    Then it holds a lazy-loaded img of that image

  @test:scripts/tests/library/library-source-links.test.ts::an_unknown_page_count_is_not_zero_(owner,_2026-10-15:_"(0_pages)")::a_page-granularity_ingestion_with_no_source.pages_reads_null,_and_says_how_far_its_sections_reach
  Scenario: An unknown page count is null, with the pages its sections cover
    Given a page-granular structure of three sections with no source.pages
    When its document view is read
    Then its pages is null and it covers 3 pages

  @test:scripts/tests/library/library-source-links.test.ts::an_entry_page_links_its_catalogue_record_at_the_top::the_Dublin_Core_record_on_the_repository_host,_and_the_Handle_at_its_resolver
  Scenario: The Dublin Core record links on the repository host, and the Handle at its resolver
    Given a repository "o/host" holding the record "catalogue/records/e1.dc.json"
    When the catalogue record links are made for that record and Handle "10665/332098"
    Then they are the record's GitHub blob URL on main, then "https://hdl.handle.net/10665/332098"
    And the first link's label mentions "Dublin Core"

  @test:scripts/tests/library/library-source-links.test.ts::an_entry_page_links_its_catalogue_record_at_the_top::the_Dublin_Core_link_is_the_published_XML_when_there_is_one,_and_the_KG_node_is_linked
  Scenario: The Dublin Core link is the published XML when there is one, and the KG node is linked
    Given the same repository, also holding the node "catalogue/nodes/item-e1.json"
    When the catalogue record links are made with a published XML href
    Then they are the XML href, the node's GitHub blob URL, then the Handle resolver URL
    And the first link is labelled "Dublin Core XML — e1.dc.xml"

  @test:scripts/tests/library/library-source-links.test.ts::an_entry_page_links_its_catalogue_record_at_the_top::nothing_recorded,_nothing_linked;_a_malformed_Handle_is_not_linked
  Scenario: Nothing recorded links nothing, and a malformed Handle is not linked
    When the catalogue record links are made with no catalogue, or with the Handle "javascript:x"
    Then there are no links
    And the record HTML of no links is empty

  @test:scripts/tests/library/library-source-links.test.ts::an_entry_page_links_its_catalogue_record_at_the_top::the_record_line_sits_under_the_head,_above_the_view_panel_and_the_listing
  Scenario: The record line sits under the head, above the view panel and the listing
    Given a not-held entry page with a catalogue record link
    When the entry page HTML is written
    Then the "lib-record" element comes after "lib-title" and before "lib-view" and "listing"
    And an entry page with no record has no "lib-record" element
