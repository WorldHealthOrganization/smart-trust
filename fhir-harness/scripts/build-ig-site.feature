Feature: Staging an IG as one just-the-docs site

  @test:scripts/build-ig-site.test.ts::staging_one_IG_as_one_just-the-docs_site::fhirDataFromSushiConfig
  Scenario: site.data.fhir is written from sushi-config, only what is sourced
    Given the example IG staged as a site
    When its site.data.fhir file is read
    Then it names the package "example.ig", version "0.1.0" and publisher "Example Org"
    And it holds no empty string

  @test:scripts/build-ig-site.test.ts::staging_one_IG_as_one_just-the-docs_site::navFromSushiPages
  Scenario: navigation comes from sushi-config pages: titles, parents, order
    When navigation is read from sushi-config pages with a nested page
    Then Home is first, Overview is second under Home, and Change Log is third
    And the staged overview page opens with front matter giving its title, parent, order and the IG footer

  @test:scripts/build-ig-site.test.ts::staging_one_IG_as_one_just-the-docs_site::unlistedPageKeptAndReported
  Scenario: a page sushi-config does not list is kept, titled by file name, and reported
    Given the example IG staged as a site
    Then "orphan.md" is reported as unlisted
    And its staged page is titled "orphan"

  @test:scripts/build-ig-site.test.ts::staging_one_IG_as_one_just-the-docs_site::pagesIncludesImagesPlaced
  Scenario: pages, includes and images land where Jekyll resolves them
    Given the example IG staged as a site
    Then its pages are changes, index, orphan and overview
    And notes, overview and index are each written to _includes
    And the logo image is published at the site root

  @test:scripts/build-ig-site.test.ts::staging_one_IG_as_one_just-the-docs_site::imageSubdirKept
  Scenario: a subdirectory of input/images is published as a subdirectory, as the Publisher does
    Given the example IG staged as a site
    Then the files of the "demo" image subdirectory are published under "demo"
    And the subdirectory's svg is not copied into _includes

  @test:scripts/build-ig-site.test.ts::an_SVG_in_input/images_is_published_minified::svgPublishedMinified
  Scenario: an SVG from input/images is published minified, and its include copy is left as given
    Given an IG whose input/images holds a drawing saved with Visio's records, at the top level and in a subdirectory
    When it is staged as a site
    Then both published copies hold the drawing without the editor's records or the whitespace between tags
    And the copy under _includes is the IG's file as given
    And the stage reports two SVGs minified and the bytes saved

  @test:scripts/build-ig-site.test.ts::staging_one_IG_as_one_just-the-docs_site::unparseableDataNotPublished
  Scenario: a data file that does not parse is not published, and is reported
    Given the example IG staged as a site
    Then the good .jsonld is published and the broken .jsonld and broken demo JSON are not
    And 2 unparseable files are reported, "broken.jsonld" then "demo/broken.json"

  @test:scripts/build-ig-site.test.ts::staging_one_IG_as_one_just-the-docs_site::unrenderedDiagramIsMarker
  Scenario: a diagram the Publisher renders, with no renderer given, is a VISIBLE marker and reported
    Given the example IG staged with no diagram renderer
    Then "flow.svg" is reported as not rendered and nothing as rendered
    And its include holds the visible marker "⟦not rendered: flow.svg⟧"

  @test:scripts/build-ig-site.test.ts::staging_one_IG_as_one_just-the-docs_site::configIsJustTheDocsAtBaseurl
  Scenario: the config is one just-the-docs site at the given baseurl
    Given the example IG staged as a site
    Then its _config.yml has the title "Example IG", the baseurl "/site/example" and the theme just-the-docs

  @test:scripts/build-ig-site.test.ts::staging_one_IG_as_one_just-the-docs_site::includeTargetsWithLangFragment
  Scenario: include targets are read from the page, including lang-fragment
    Given a page with two include tags and a lang-fragment tag
    Then the include targets are "a.svg", "b.md" and "table.xhtml"

  @test:scripts/build-ig-site.test.ts::staging_one_IG_as_one_just-the-docs_site::dedupeIdsRenamesRepeats
  Scenario: a repeated id keeps its first copy and the rest are renamed, each reported
    Given HTML that repeats the id "x" three times
    When ids are de-duplicated
    Then the first keeps "x" and the others become "x--2" and "x--3"
    And both renames are reported

  @test:scripts/build-ig-site.test.ts::staging_one_IG_as_one_just-the-docs_site::noPaletteNoScheme
  Scenario: with no palette there is no scheme, and the report says so
    Given the example IG staged with no palette
    Then no scheme is reported
    And _config.yml sets no color_scheme

  @test:scripts/build-ig-site.test.ts::the_instance's_palette_as_a_just-the-docs_colour_scheme::wcagContrastPerSpec
  Scenario: WCAG contrast is computed as the spec defines it
    Then black on white has a contrast of 21
    And "#fff" on white has a contrast of 1
    And a named colour has no computable contrast

  @test:scripts/build-ig-site.test.ts::the_instance's_palette_as_a_just-the-docs_colour_scheme::rolesLandOnSchemeVars
  Scenario: each role lands on the scheme variable just-the-docs reads
    When the palette is turned into a colour scheme
    Then its SCSS sets the feedback, body background, body text, link, border and sidebar colours from the palette roles

  @test:scripts/build-ig-site.test.ts::the_instance's_palette_as_a_just-the-docs_colour_scheme::sidebarTextMoreContrastRole
  Scenario: sidebar text is the palette role with more contrast on accent, never a literal
    Given a dark accent
    Then the sidebar text is the "surface" role and child links use the surface colour
    Given a light accent
    Then the sidebar text is the "ink" role

  @test:scripts/build-ig-site.test.ts::the_instance's_palette_as_a_just-the-docs_colour_scheme::lowContrastIsFinding
  Scenario: a pairing below AA, or one that cannot be computed, is a finding
    Then the palette has no findings
    And an accent "#999999" gives a finding for accent on surface (links)
    And a named accent gives a finding saying it is not computable

  @test:scripts/build-ig-site.test.ts::the_instance's_palette_as_a_just-the-docs_colour_scheme::paletteSelectsScheme
  Scenario: a staged site with a palette selects the scheme and ships its files
    When the IG is staged with a palette
    Then the scheme's sidebar text is "surface"
    And _config.yml selects "color_scheme: ig"
    And the scheme and custom SCSS files are written with the palette's values

  @test:scripts/build-ig-site.test.ts::pages_the_Publisher_generates,_written_from_data_the_build_holds_(bean_jut3)::tocNestsAndLinksExisting
  Scenario: toc lists every page in the tree, nested, and links only pages that exist
    When a TOC is written for a nested page tree where the artifacts page does not exist
    Then it links Home with Overview nested under it
    And it names Artifacts as generated by the IG Publisher and not part of this build, with no link

  @test:scripts/build-ig-site.test.ts::pages_the_Publisher_generates,_written_from_data_the_build_holds_(bean_jut3)::tocAlwaysGenerated
  Scenario: a staged site always gets a toc, reported as generated rather than as a source page
    Given the example IG staged as a site
    Then "toc.md" is reported as generated and not as a source page
    And it links the Change Log page

  @test:scripts/build-ig-site.test.ts::pages_the_Publisher_generates,_written_from_data_the_build_holds_(bean_jut3)::artifactVariablesKeepFamilies
  Scenario: the lifted variables keep generate_smart_liquid's families and keys, minus the smart__ prefix
    Given a categorised ValueSet and an uncategorised Endpoint
    When the artifact variables are lifted
    Then the ValueSet's page, canonical and JSON urls, display text, escaped label, link and elements are set
    And 1 artefact is listed, in the one category "Terminology"
    And an absent description is an empty cell
    And the Endpoint has variables
    And "status" is reported as not sourced and no artefact has a status element

  @test:scripts/build-ig-site.test.ts::pages_the_Publisher_generates,_written_from_data_the_build_holds_(bean_jut3)::artifactsTemplateRendersLiquid
  Scenario: the artifacts TEMPLATE renders the variables through real Liquid
    Given the artifact variables of one ValueSet whose description has a pipe and a line break
    When the artifacts template is rendered through Ruby Liquid
    Then nothing is written to stderr
    And it says "1 artefact(s)." and has one collapsed section for "Terminology: Value Sets" with a count of 1
    And the section holds a Name and Description table with the escaped link and description on one line

  @test:scripts/build-ig-site.test.ts::pages_the_Publisher_generates,_written_from_data_the_build_holds_(bean_jut3)::artifactsTemplateOpensWithComment
  Scenario: the artifacts template is a file that opens with the comment describing it
    Given the artifacts template file
    Then it starts with a Liquid comment
    And it uses no plus, minus, size or replace filter

  @test:scripts/build-ig-site.test.ts::pages_the_Publisher_generates,_written_from_data_the_build_holds_(bean_jut3)::noIndexNoArtifactsPage
  Scenario: without an index there is no artifacts page, and the menu still reports it missing
    Given the example IG staged with no artifact index
    Then no artifacts page is written or reported as generated

  @test:scripts/build-ig-site.test.ts::post-processing_fills:_content_a_step_writes_after_the_Publisher,_at_a_marker_the_source_holds::fillReplacesMarker
  Scenario: the marker is replaced, the data reaches the page's front matter, and an unused fill is reported
    Given a page holding a marker and two fills, one for that marker and one for a marker nowhere
    When the IG is staged
    Then the page's front matter holds the fill's data
    And the fill body replaces the marker
    And the fill reports the page as filled and the other marker as unused

  @test:scripts/build-ig-site.test.ts::the_releases_page:_pointers_to_release_binaries,_never_the_bytes_(bean_b8ip)::sizeLabels
  Scenario: sizes are labelled as a reader reads them
    Then 915317 bytes is "915 KB", 13864960 bytes is "13.9 MB" and 10 bytes is "1 KB"

  @test:scripts/build-ig-site.test.ts::the_releases_page:_pointers_to_release_binaries,_never_the_bytes_(bean_b8ip)::releaseVariablesComputed
  Scenario: every value the template shows is computed here
    When the release variables are computed
    Then the first release is "v1.0.0", published 2026-03-23, not a prerelease
    And its assets are package.tgz at 915 KB with a digest and package.db at 13.9 MB with none

  @test:scripts/build-ig-site.test.ts::the_releases_page:_pointers_to_release_binaries,_never_the_bytes_(bean_b8ip)::releasesPageOnlyWhenGiven
  Scenario: given releases, the page and its data are written and reported as generated; absent, neither is
    When the IG is staged with releases
    Then "releases.md" is reported as generated and holds the releases template
    And the releases data file equals the release variables
    When the IG is staged without releases
    Then no releases page is reported and no releases data file is written

  @test:scripts/build-ig-site.test.ts::the_local_template's_includes::localTemplateFromIgIni
  Scenario: found from ig.ini's #<dir>, and not from a commented line, a package template or a path
    Given ig.ini files with a local template, a commented local template, a template path, and a local template whose directory is missing
    Then only the first gives the local template's includes directory

  @test:scripts/build-ig-site.test.ts::the_local_template's_includes::relinkTemplatedArtifactLinks
  Scenario: a templated link to an artefact page is pointed at this site's copy, for a type with pages only
    Given templated links to Requirements and CapabilityStatement pages, a templated link to another type and a literal link
    When templated artefact links are relinked for the types with pages
    Then 2 links are pointed at this site's artifact pages and the others are unchanged

  @test:scripts/build-ig-site.test.ts::the_local_template's_includes::localIncludesStagedRelinked
  Scenario: staged into _includes under the IG's own, relinked, and no longer a marker
    Given an IG whose ig.ini names a local template with two includes, one of which the IG also has
    When the IG is staged with a Requirements artefact
    Then 2 template includes are staged from local-template/includes
    And the summary include is not reported as not rendered and its artefact link points at this site
    And the IG's own copy of the shared include wins
    And the stage description names the 2 local template includes

  @test:scripts/build-ig-site.test.ts::relinkArtifacts::relinkArtifactsOnlyArtefactPages
  Scenario: rewrites a markdown link and an href to an artefact page, and nothing else
    Given markdown and HTML links to artefact pages, a concept page, an absolute URL and a subdirectory path
    When artefact links are relinked
    Then 3 links are rewritten to the artifact directory and the rest are unchanged

  @test:scripts/build-ig-site.test.ts::relinkArtifacts::relinkArtifactsNoOp
  Scenario: is a no-op when the source links no artefact
    Then a source that links no artefact is unchanged with a count of 0

  @test:scripts/build-ig-site.test.ts::copyDocsInto_(an_igSite_instance's_pages_built_into_its_IG_site)::copyDocsSkipsReadmeNoOverwrite
  Scenario: copies every file but the README, and refuses to overwrite one the IG site wrote
    Given a docs directory with a README, an artifact page and an artifacts page the IG site already wrote
    When the docs are copied into the IG site
    Then 1 file is copied and "artifacts.md" is a collision
    And the artifact page is copied, the IG site's artifacts page is kept and the README is not copied

  @test:scripts/build-ig-site.test.ts::copyDocsInto:_a_front-matter-only_page_declares_something_ABOUT_a_generated_page::frontMatterOnlyMergesOntoGenerated
  Scenario: its keys land on the generated page's front matter, the page's own keys winning
    Given a front-matter-only docs page for the generated artifacts page, and one for a page that does not exist
    When the docs are copied into the IG site
    Then "artifacts.md" is merged and the other is a collision with no generated page
    And the generated page keeps its own title and parent and gains the docs page's other key

  @test:scripts/build-ig-site.test.ts::igSiteDocs::onlyDeclaredIgSiteBuilds
  Scenario: only an instance that DECLARES igSite builds its IG site at its root
    Then instances that declare igSite build their IG site from their docs directory
    And a docs directory that does not declare igSite, or no docs directory, gives none

  @test:scripts/build-ig-site.test.ts::webpagePalette_inherits_along_needs_(bean_`mftp`)::paletteInheritedAlongNeeds
  Scenario: an instance that declares no theme wears the nearest one along its needs, through one that declares none
    Given an instance that declares no theme and needs one that does, through one that declares none
    Then its palette accent is "#0066aa" and the note says it is inherited from base
    And the base's own note does not say inherited

  @test:scripts/build-ig-site.test.ts::webpagePalette_inherits_along_needs_(bean_`mftp`)::noThemeNoPalette
  Scenario: with no theme anywhere along its needs, there is no palette, and the note says why
    Given an instance with no theme anywhere along its needs
    Then it has no palette and the note says there is no webpage theme

  @test:scripts/build-ig-site.test.ts::every_IG_site:_the_IG's_top_bar,_and_its_TOC_declared_for_the_navbar::tocNavDeclaration
  Scenario: the TOC is a visualiser declaration the navbar reads, rows under each group, hrefs under the baseurl
    When the TOC navigation is declared for a menu under a baseurl with a leading Table of Contents row and a trailing Releases row
    Then it is a JSON script the navbar reads
    And its rows are the Table of Contents first, where the Publisher's breadcrumb starts, then the groups with their items under the baseurl, an absolute href unchanged, then the Releases row

  @test:scripts/build-ig-site.test.ts::every_IG_site:_the_IG's_top_bar,_and_its_TOC_declared_for_the_navbar::topBarDropdownNotFolioNav
  Scenario: the top bar is one dropdown per group, and never reads as the folio navbar
    When the top bar is written for a menu
    Then it has a dropdown summary "Home" with links under the baseurl
    And it has no folio navbar class or site-nav id

  @test:scripts/build-ig-site.test.ts::every_IG_site:_the_IG's_top_bar,_and_its_TOC_declared_for_the_navbar::pageEntryIsLink
  Scenario: a top-level entry that is a page (`Home: index.html`) is a link in the bar and the TOC, with no section page
    Given a menu whose Home and Artifacts entries are pages and whose Logic entry is a group
    Then the bar shows Home and Artifacts as links and has no plain group label
    And the TOC rows for Home and Artifacts are links under the baseurl
    When an IG is staged with that menu
    Then no section page is written for Home or Artifacts, and one is written for Logic

  @test:scripts/build-ig-site.test.ts::every_IG_site:_the_IG's_top_bar,_and_its_TOC_declared_for_the_navbar::titleLineThenMenu
  Scenario: the title sits on its own line, the menu on the line below (owner, 2026-10-14)
    When the top bar is written
    Then the title comes before every group
    And the bar wraps and the title takes the whole first line

  @test:scripts/build-ig-site.test.ts::every_IG_site:_the_IG's_top_bar,_and_its_TOC_declared_for_the_navbar::folioTabRowAtEveryWidth
  Scenario: the Folio tab gets the bar's top row to itself, at every width (folio-assistant#2534)
    Then the top bar CSS reserves its top row with padding when the Folio tab is present
    And that reservation is not inside a media query

  @test:scripts/build-ig-site.test.ts::every_IG_site:_the_IG's_top_bar,_and_its_TOC_declared_for_the_navbar::chromeLayoutNoSidebar
  Scenario: a harness-chrome site has a layout with no sidebar of its own
    Given an IG staged with a menu
    Then its default layout carries the navbar declaration and the top bar
    And it has no site-nav sidebar
    And it carries the visualiser label "X IG"

  @test:scripts/build-ig-site.test.ts::the_Publisher's_page_footer_on_the_IG_site's_own_pages_(#1901)::footerFactsPackageFirst
  Scenario: the facts come from the package first, then the IG's source; links only to what is held
    Given an IG staged with footer facts from its package
    Then the footer names the publisher and url, package id, the package's version "0.2.1", FHIR 5.0.0 and its url, the generated date, copyright year, scope and stylesheets
    And its links are only the Table of Contents and the external License

  @test:scripts/build-ig-site.test.ts::the_Publisher's_page_footer_on_the_IG_site's_own_pages_(#1901)::prevNextFollowTocOrder
  Scenario: prev and next follow the IG's table-of-contents order, skipping what is not built
    Given an IG staged with a menu that lists a page that is not built
    Then the first page has the footer, no previous link and the next link "concepts.html"
    And the concepts page links back to "index.html" and on to "changes.html", skipping the missing page
    And the last page has no next link
    And the generated TOC page has the footer and no previous link
    And the layout includes the footer last in main, only where the page asks, and the footer include exists

  @test:scripts/build-ig-site.test.ts::the_Publisher's_page_footer_on_the_IG_site's_own_pages_(#1901)::noMenuFooterInPage
  Scenario: without a menu there is no generated layout, so the footer goes into the page
    Given an IG staged with no menu
    Then the concepts page ends by including the footer

  @test:scripts/build-ig-site.test.ts::the_Publisher's_page_footer_on_the_IG_site's_own_pages_(#1901)::composedFooterNamespaced
  Scenario: composed into a host site, the footer include is namespaced and gated by the page
    Given an IG staged with a menu and composed into a host site with full pages
    Then there are no collisions
    And the composed page includes the namespaced footer only where the page asks
    And the namespaced footer include reads the IG's own footer data

  @test:scripts/build-ig-site.test.ts::the_Publisher's_page_footer_on_the_IG_site's_own_pages_(#1901)::footerTemplateRendersLiquid
  Scenario: the footer TEMPLATE renders the Publisher's three rows through real Liquid
    Given a footer with all its facts and two links
    When the footer template is rendered through Ruby Liquid with previous and next pages
    Then nothing is written to stderr
    And it links the stylesheet and opens the footer with the scope class
    And it shows prev, top and next links
    And it shows the copyright, publisher, package and FHIR version line
    And it lists the links, the external one marked external
    When it is rendered with no previous or next page
    Then the navigation row holds only the top link

  @test:scripts/build-ig-site.test.ts::a_path_a_later_site_step_writes_is_left_to_it::reservedPrefixNotPublished
  Scenario: input/images files under a reserved prefix are not published, and are reported
    Given image files under "openapi/", an image named "openapi.png" and a "demo" subdirectory
    When the IG is staged with "openapi/" reserved for a later step
    Then nothing is published under "openapi"
    And "openapi.png" and the demo file are published
    And the two reserved files are reported with the step that writes them
    And the stage description says a later step writes 2 files

  @test:scripts/build-ig-site.test.ts::a_reserved_FILE_leaves_the_rest_of_its_directory_to_the_IG::reservedFileOnlyWithheld
  Scenario: only the named file is withheld; the IG's other files at that route publish
    Given two files in the "openapi" image subdirectory
    When the IG is staged with only "openapi/api.openapi.json" reserved
    Then the other file in that directory is published
    And the reserved file is not published and is reported

  @test:scripts/build-ig-site.test.ts::a_link_into_a_subdirectory_of_input/images_stays_on_the_site::imageSubdirLinkStaysOnSite
  Scenario: it is served, so it is not relinked to the source
    Given a page linking a stylesheet in an image subdirectory, and an edit base
    When the IG is staged
    Then the page's markdown link and href are unchanged
    And the stylesheet is published

  @test:scripts/build-ig-site.test.ts::edit_links_to_the_IG's_own_source_(bean_`mftp`)::pagecontentHasEditUrl
  Scenario: a pagecontent page carries its edit URL, a generated page none
    Given an IG staged with an edit base on GitHub
    Then the concepts page carries its edit URL and the generated TOC page none
    And the layout offers "Edit this page on GitHub" and opts the main content into figure images
    And the layout carries the source-lines element, the block URL function and the edit link marker
    And the concepts page names its source repository, branch, path and blob URL

  @test:scripts/build-ig-site.test.ts::sourceHeadings:_each_section's_line_in_the_IG's_source_(bean_`mftp`)::sourceHeadingsWithLines
  Scenario: ATX headings with their 1-based line, text as a reader sees it, fences skipped
    Given markdown with a heading with an id, a heading inside a code fence, a heading with a link and bold, and a closed heading
    Then the headings are "Title" at line 1, "A link and bold" at line 7 and "Last" at line 8

  @test:scripts/build-ig-site.test.ts::heading_links_on_an_IG's_first_page,_whose_headings_live_in_an_include_(bean_`x78e`)::includeHeadingsLinkToInclude
  Scenario: index.md that only includes index-ig.md: each heading's source line is its own line in the include
    Given a first page that only includes another markdown page holding three headings
    When the IG is staged with an edit base
    Then the page's source lines are the three headings at lines 8, 11 and 15 of the include
    And the layout hands those lines to the page as ig-source-lines data
    And nothing is appended to a heading's text: the shared edit-links runtime draws the links in the right gutter

  @test:scripts/build-ig-site.test.ts::heading_links_on_an_IG's_first_page,_whose_headings_live_in_an_include_(bean_`x78e`)::includeCycleEnds
  Scenario: an include cycle ends, and a non-markdown include is not read
    Given two markdown includes that include each other, one of which also includes an xhtml file
    Then the headings are A and B from their includes and the page's own heading at line 2

  @test:scripts/build-ig-site.test.ts::composeIgSite:_a_staged_IG_moved_into_a_host_Jekyll_source::composeNestsAndNamespaces
  Scenario: pages nest under the IG, includes and data are namespaced, chrome is injected (--full-pages)
    Given an IG staged with a two-group menu and composed into a host site with full pages
    Then there are no collisions
    And the index page is titled "X IG" with children, reads the namespaced data and includes the top and bottom chrome
    And the concepts page sits under "Business" and "X IG", uses the default layout and the namespaced include
    And the group page sits under "X IG"
    And the includes and data are under the IG's namespace and the top include holds the top bar and the figure images stamp
    And the figure images stamp uses the attribute the site chrome's script reads
    And no config or layouts are copied under the IG
    And composing the same IG again collides
    When the IG is composed at the root
    Then there are no collisions and the pages are at the root with no IG directory, while the includes stay namespaced

  @test:scripts/build-ig-site.test.ts::composeIgSite:_a_staged_IG_moved_into_a_host_Jekyll_source::hostBaseIsLiquidBaseurl
  Scenario: the host's base reaches the composed top bar and section as {{ site.baseurl }}, not as one deploy's path
    Given an IG staged under a branch's staging base and composed into a host at "ig"
    Then there are no collisions
    And the thin layout and top include do not name the branch and use the site baseurl in links
    And the pages land under "x/ig" and not at "x"

  @test:scripts/build-ig-site.test.ts::composeIgSite:_a_staged_IG_moved_into_a_host_Jekyll_source::composedAtInstanceCarriesStylesheet
  Scenario: an IG composed at /<instance>/ lands there and carries the thin stylesheet its layout links
    Given an IG composed at "."
    Then there are no collisions
    And the pages land at "x" with no "x/ig" directory, and the thin stylesheet is copied
    And the thin layout links that stylesheet and uses the site baseurl

  @test:scripts/build-ig-site.test.ts::composeIgSite:_a_staged_IG_moved_into_a_host_Jekyll_source::liquidSiteBaseQuotedOnly
  Scenario: liquidSiteBase: only a quoted value starting with the base, and never a sibling path
    Then a quoted href starting with the base is rewritten to the site baseurl, a sibling path and a bare string are not
    And a JSON href starting with the base is rewritten
    And an empty or absent base changes nothing

  @test:scripts/build-ig-site.test.ts::relinkPublisherOutputs_—_the_Publisher's_downloads_live_on_the_published_IG::relinksBareDownloads
  Scenario: points a bare .zip/.tgz link at the canonical site
    Given links to "package.tgz" and "definitions.json.zip"
    When Publisher outputs are relinked to the canonical site
    Then both point at the canonical site and the count is 2

  @test:scripts/build-ig-site.test.ts::relinkPublisherOutputs_—_the_Publisher's_downloads_live_on_the_published_IG::leavesPagesPathsAbsolute
  Scenario: leaves pages, paths and absolute URLs alone
    Given links to a page, a zip in a subdirectory, an absolute zip URL and an href to a tgz
    When Publisher outputs are relinked
    Then only the bare tgz href is pointed at the canonical site

  @test:scripts/build-ig-site.test.ts::relinkArtifacts_—_a_case-only_mismatch::caseOnlyMismatchResolves
  Scenario: resolves to the one artefact page it can mean
    Given a link to "StructureDefinition-hcert.html" and one artefact page "StructureDefinition-HCert"
    Then the link is relinked to that artefact page

  @test:scripts/build-ig-site.test.ts::relinkArtifacts_—_a_case-only_mismatch::ambiguousCaseLeftAlone
  Scenario: is left alone when two pages differ only in case
    Given a link "A-b.html" and two artefact pages differing only in case
    Then the link is unchanged and the count is 0

  @test:scripts/build-ig-site.test.ts::relinkOffSite_—_what_this_build_cannot_serve_goes_where_it_is_served::publisherOnlyPageToPublished
  Scenario: a Publisher-only page goes to the published IG
    Then a link to "qa.html" is pointed at the published IG

  @test:scripts/build-ig-site.test.ts::relinkOffSite_—_what_this_build_cannot_serve_goes_where_it_is_served::repoFileToGithub
  Scenario: a repository file goes to GitHub, found at its path or under input/
    Given links to a repository file at its path and to one found under input/
    When off-site links are relinked
    Then both point at the file on GitHub and the count is 2

  @test:scripts/build-ig-site.test.ts::relinkOffSite_—_what_this_build_cannot_serve_goes_where_it_is_served::artifactsHtmlToPublished
  Scenario: artifacts.html this build does not write goes to the published IG (folio-assistant#2741)
    Then a link to "artifacts.html" this build does not write is pointed at the published IG
    And an artifacts page this build serves, a downloads page that is served, or no canonical leaves the href unchanged

  @test:scripts/build-ig-site.test.ts::relinkOffSite_—_what_this_build_cannot_serve_goes_where_it_is_served::unservedPageReportedDead
  Scenario: a page nothing serves is left as written and REPORTED
    Given links to "video_tutorial.html", which nothing serves, and to "index.html"
    When off-site links are relinked
    Then the text is unchanged
    And "video_tutorial.html" is reported as dead

  @test:scripts/build-ig-site.test.ts::rubyLiquidStrings_—_a_Publisher_Liquid_string_Jekyll_can_read::escapedQuoteAssignSingleQuoted
  Scenario: an escaped-quote assign becomes single-quoted with plain quotes
    Given a Liquid assign whose double-quoted string holds escaped quotes
    When it is made readable by Ruby Liquid
    Then the string is single-quoted with plain quotes and the count is 1

  @test:scripts/build-ig-site.test.ts::rubyLiquidStrings_—_a_Publisher_Liquid_string_Jekyll_can_read::plainAndApostropheLeftAlone
  Scenario: a plain string, and one holding an apostrophe, are left as written
    Given a plain string assign and one holding an apostrophe
    Then both are left as written

  @test:scripts/build-ig-site.test.ts::the_Publisher's_artefact_lists,_written_from_the_artefact_index_(bean_9hfi)::listSimpleListsArtefacts
  Scenario: a list-simple include on a published IG page lists that type's artefacts, never the placeholder
    Given an IG page that includes the Publisher's artefact lists, staged with an artefact index
    Then the CodeSystems list has no not-rendered marker
    And it lists one item per code system, linked to its page and ordered by title, without descriptions
    And the Libraries list links the "Logic" library
    And the four list includes are reported as listed and the code system list is not reported as not rendered

  @test:scripts/build-ig-site.test.ts::the_Publisher's_artefact_lists,_written_from_the_artefact_index_(bean_9hfi)::fullFormCarriesDescription
  Scenario: the full form carries each artefact's description, escaped
    Then the ValueSets list item carries the value set's description, HTML-escaped

  @test:scripts/build-ig-site.test.ts::the_Publisher's_artefact_lists,_written_from_the_artefact_index_(bean_9hfi)::emptyTypeIsSaid
  Scenario: a resource type the index holds none of is SAID, never an empty list or the placeholder
    Then the StructureMaps list says the artefact index holds no StructureMap resources
    And it has no not-rendered marker

  @test:scripts/build-ig-site.test.ts::the_Publisher's_artefact_lists,_written_from_the_artefact_index_(bean_9hfi)::untypedListStaysMarker
  Scenario: a list that names no resource type stays a visible marker, and is reported
    Then the Profiles list holds the marker "⟦not rendered: list-simple-profiles.xhtml⟧"
    And it is the only include reported as not rendered

  @test:scripts/build-ig-site.test.ts::the_Publisher's_artefact_lists,_written_from_the_artefact_index_(bean_9hfi)::noIndexListsStayMarkers
  Scenario: without an artefact index, the lists stay markers rather than empty lists
    When the IG is staged with no artefact index
    Then nothing is listed and the code system list is reported as not rendered

  @test:scripts/build-ig-site.test.ts::the_Publisher's_artefact_lists,_written_from_the_artefact_index_(bean_9hfi)::publisherPluralsMapBack
  Scenario: the Publisher's plurals map back to their resource type
    Then the plurals of CodeSystem, Library, SubscriptionStatus and RelatedPerson are the Publisher's
    And "list-simple-valuesets.xhtml" is the simple ValueSet list and "list-structuremaps.xhtml" the full StructureMap list
    And "list-simple-profiles.xhtml" and "list-simple-valuesets-json.xhtml" name no list

  @test:scripts/build-ig-site.test.ts::the_Publisher's_artefact_lists,_written_from_the_artefact_index_(bean_9hfi)::listTemplateOpensWithComment
  Scenario: the list template is a file that opens with its description and computes nothing
    Given the artefact list template file
    Then it starts with a Liquid comment
    And it uses no plus, minus, size, replace or sort filter

  @test:scripts/build-ig-site.test.ts::input/data_->__data_(bean_yy4u):_the_IG's_own_site.data,_and_every_overwrite_flagged::igDataStagedAndClashesFlagged
  Scenario: staged, namespaced on compose, and a clash with the harness's data is a QA finding
    Given an IG with data files "features.yaml", "features.json", "fhir.yml" and "notes.txt", and a page reading the features data
    When the IG is staged
    Then only "features.json" is staged
    And two overwrites are recorded: the YAML features file by the JSON one, and the IG's fhir data by the build's own
    And the build's fhir data keeps its package id and the text file is not staged
    And the stage description reports a data-overwrite QA finding for site.data.fhir
    And the QA record counts 2 data-overwrite findings
    When the staged site is composed at the root of a host
    Then there are no collisions, the page reads the namespaced features data and the data file is under the IG's namespace

  @test:scripts/build-ig-site.test.ts::input/data_->__data_(bean_yy4u):_the_IG's_own_site.data,_and_every_overwrite_flagged::noDataNothingFlagged
  Scenario: no input/data: nothing staged, nothing flagged -- and the record still says it looked
    When the data-overwrite QA record is made with no overwrites
    Then it counts 0 in total and 0 data-overwrite findings

  @test:scripts/build-ig-site.test.ts::the_FHIR_AST's_resources_as_site.data_(system-actors_rendered_EMPTY_without_them)::astResourcesAsSiteData
  Scenario: canonicals and one <Type>-<id> per resource are written, and the loop lists every actor
    Given an IG with an AST and a system-actors page that loops over the actor definitions
    When the IG is staged
    Then 3 canonicals and 4 resources are written as site data
    And the canonicals are the two actor definitions and the IG, and a Patient's data file is written
    And the stage description mentions site.data.canonicals (3)
    And rendering the loop with Liquid lists "[Holder][Issuer]"
    When the site is composed at the root of a host
    Then there are no collisions and the page's lookups use the IG's namespaced data
    And rendering the composed loop still lists "[Holder][Issuer]"

  @test:scripts/build-ig-site.test.ts::the_FHIR_AST's_resources_as_site.data_(system-actors_rendered_EMPTY_without_them)::noAstNothingWritten
  Scenario: no AST: nothing written, and the stage log says what that costs
    Given an IG with no AST
    When it is staged
    Then no AST data is reported and no canonicals file is written
    And the stage description says the page renders EMPTY

  @test:scripts/build-ig-site.test.ts::dependency-table.xhtml_is_written_from_the_IG's_declaration,_not_left_a_marker_(bean_4475)::dependencyTableFromDeclaration
  Scenario: the include and its data are written, and the stage log says where the rows came from
    Given an IG declaring one dependency and a page including both dependency tables, with an empty package cache
    When it is staged
    Then both dependency tables are written and not reported as not rendered
    And the full table's include has the full form
    And the fhir data lists the dependency at depth 0, not resolved
    And the stage description says the 1 row came from sushi-config.yaml and is not in the package cache

  @test:scripts/build-ig-site.test.ts::linkTableCells_(owner,_2026-10-10:_table_ids_should_be_clickable)::markdownCellLinksByTitle
  Scenario: a markdown cell naming an artefact by title links to its page, keeping the bold
    Given a markdown table cell naming an artefact by its bold title
    When table cells are linked
    Then the cell links to the artefact's page keeping the bold
    And the description cell is unchanged and the count is 1

  @test:scripts/build-ig-site.test.ts::linkTableCells_(owner,_2026-10-10:_table_ids_should_be_clickable)::htmlCellMatchesIdWithoutPunctuation
  Scenario: an HTML cell matches an id with its punctuation dropped
    Given an HTML table cell holding an id with dots
    When table cells are linked
    Then it links to the artefact whose id drops the punctuation, and the other cell is unchanged

  @test:scripts/build-ig-site.test.ts::linkTableCells_(owner,_2026-10-10:_table_ids_should_be_clickable)::processNameLinksToHeading
  Scenario: a process name links to its heading on the page, and the row's id cell follows it
    Given a table of process names and ids and the process headings below it
    When table cells are linked
    Then each process name and its id cell link to the process's heading
    And the single-letter first column stays text

  @test:scripts/build-ig-site.test.ts::linkTableCells_(owner,_2026-10-10:_table_ids_should_be_clickable)::sharedKeyAndLinkedCellLeftAlone
  Scenario: a key two artefacts share links neither, and a cell already holding a link is left alone
    Given a cell naming a key two artefacts share and a cell that already holds a link
    When table cells are linked
    Then nothing is linked

  @test:scripts/build-ig-site.test.ts::linkTableCells_(owner,_2026-10-10:_table_ids_should_be_clickable)::kramdownIdMatchesHeadings
  Scenario: kramdownId matches the deployed heading ids
    Then the kramdown id of "A.  Vaccination location registration" is "a--vaccination-location-registration"

  @test:scripts/build-ig-site.test.ts::annexes_(owner,_2026-10-10:_the_data_dictionary_loaded_on_demand)::annexMountPointsAtJson
  Scenario: annexMount points at the copied JSON and the renderer, with a fallback link
    When an annex mount is written for a JSON file with two columns
    Then it points the loader at the copied JSON with those columns, offers a fallback link and loads the renderer script
    And it does not use the site baseurl

  @test:scripts/build-ig-site.test.ts::annexes_(owner,_2026-10-10:_the_data_dictionary_loaded_on_demand)::annexRendererUsesTextContent
  Scenario: the renderer exists and sets data only through textContent
    Given the annex renderer script
    Then it does not use innerHTML and does use textContent

  @test:scripts/build-ig-site.test.ts::annexes_in_a_staged_page::jsonAnnexMountsMarkdownAppended
  Scenario: a JSON annex mounts the loader; a markdown annex is appended as written
    Given a JSON annex for the index page, a markdown annex for the people page and an annex for a page that does not exist
    When the IG is staged with them
    Then the index page mounts the annex loader and the renderer script is copied
    And the people page has the markdown appended and no loader
    And the annex for the missing page is reported as unplaced

  @test:scripts/build-ig-site.test.ts::the_annex_contract:_an_ig-annex_directory_the_instance_declares_(fm9n)::annexesInReadsBothShapes
  Scenario: annexesIn reads ig-annexes/v1 and the bare array it replaces; files are relative to the directory
    Given an annex directory with a table file
    Then with no annexes.json it reads nothing
    And an ig-annexes/v1 file and a bare array both read with paths relative to the directory
    And an annex naming a file that is not there throws "declared but not held"
    And an annex with no file throws

  @test:scripts/build-ig-site.test.ts::the_annex_contract:_an_ig-annex_directory_the_instance_declares_(fm9n)::annexesForReadsDeclaredDirs
  Scenario: annexesFor reads every declared ig-annex directory, a file in a nested directory of another kind, and nothing undeclared
    Given an instance declaring an ig-annex directory whose annex names a file in a nested directory of another kind, and an undeclared directory holding an annexes.json
    Then only the declared directory is an annex directory and only its annex is read
    When the IG is staged with those annexes
    Then the dictionary page mounts the copied table, the table is copied and the annex is reported

  @test:scripts/build-ig-site.test.ts::the_annex_contract:_an_ig-annex_directory_the_instance_declares_(fm9n)::absentAnnexDirSaidAndSkipped
  Scenario: a declared directory absent from the checkout is said and skipped, not read as empty
    Given an instance declaring an ig-annex directory that is not in the checkout
    Then no annexes are read
    And it is said that the directory is declared and not in this checkout

  @test:scripts/build-ig-site.test.ts::the_annex_contract:_an_ig-annex_directory_the_instance_declares_(fm9n)::legacyArtifactIndexAnnexesRead
  Scenario: the fhir-artifact-index/annexes.json an existing caller holds is still read
    Given an annexes.json in the instance's fhir-artifact-index directory
    Then its annex is read with its columns

  @test:scripts/build-ig-site.test.ts::an_inlined_runtime_is_kept_out_of_Liquid's_reach_(smart-trust,_2026-10-14)::inertScriptRendersOwnBytes
  Scenario: a script carrying {% and {{ renders to its own bytes
    Given a script holding Liquid tag and output delimiters
    When it is made inert and rendered through Liquid
    Then the output is the script's own bytes

  @test:scripts/build-ig-site.test.ts::an_inlined_runtime_is_kept_out_of_Liquid's_reach_(smart-trust,_2026-10-14)::refusesScriptClosingRaw
  Scenario: a script that would close the raw block is refused
    Then a script holding "{% endraw %}" or "{%- endraw -%}" is refused with a message naming endraw

  @test:scripts/build-ig-site.test.ts::an_inlined_runtime_is_kept_out_of_Liquid's_reach_(smart-trust,_2026-10-14)::fullPagesBottomCarriesRuntimes
  Scenario: the full pages' bottom parses, and carries the edit-links runtime verbatim
    When the full pages' bottom include is rendered with source lines and an edit URL
    Then it carries the edit links runtime verbatim and the ig-source-lines data

  @test:scripts/build-ig-site.test.ts::include_names_are_refused_unless_they_are_one_safe_path_segment::safeIncludeNames
  Scenario: ordinary include names pass; separators, dot segments and template text do not
    Then ordinary include names are safe
    And an empty name, dot segments, separators, absolute paths, template text, a NUL and a leading dash are not

  @test:scripts/build-ig-site.test.ts::include_names_are_refused_unless_they_are_one_safe_path_segment::refusedIncludeWritesNothing
  Scenario: staging writes nothing for a refused include name, and reports it
    Given a page including "../../escaped.md", "sub/nested.md" and "kept.md"
    When the IG is staged
    Then the two unsafe names are reported as refused and nothing is written for them
    And only "kept.md" is reported as not rendered
    And the stage description names the refused include names

  @test:scripts/build-ig-site.test.ts::relinkPublisherTemplateAssets_—_staged_input/images_HTML_pages_point_Publisher_template_assets_at_canonical_(#2741)::relinksTemplateAssets
  Scenario: rewrites ../ relative links to fhir.css, fhir-table-scripts.js and assets/{css,js,ico}/* while preserving sibling Swagger UI assets
    Given an HTML page linking Publisher template assets by "../" paths and its own assets by "./" and bare paths
    When template asset links are relinked to the canonical
    Then 5 links are pointed at the canonical site
    And the page's own assets are unchanged

  @test:scripts/build-ig-site.test.ts::relinkPublisherTemplateAssets_—_staged_input/images_HTML_pages_point_Publisher_template_assets_at_canonical_(#2741)::stageRelinksTemplateAssets
  Scenario: stageIgSite rewrites Publisher template asset links in staged input/images/<dir>/*.html files
    Given an HTML page under an image subdirectory linking two Publisher template assets and its own stylesheet
    When the IG is staged
    Then 2 links are relinked
    And the template assets point at the canonical and the page's own stylesheet is unchanged

  @test:scripts/build-ig-site.test.ts::the_Publisher's_page_footer_on_the_IG_site's_own_pages_(#1901)::qaReportWrittenInEachLocaleWithTheNotice
  Scenario: the QA report is written in each locale with the machine-translation notice and its text direction
    Given the QA page in English, French and Arabic
    When the site is staged
    Then fr/qa.md and ar/qa.md are written, unverified and not reviewed, ltr and rtl
    And the English page names every locale it is available in
    And no layout reads Jekyll's own page.dir for the text direction

  @test:scripts/build-ig-site.test.ts::the_Publisher's_page_footer_on_the_IG_site's_own_pages_(#1901)::qaReportWrittenAsQaMd
  Scenario: the QA report: written as qa.md, linked as the Publisher's qa.html, and the AST's build day stands in for the package's
    Given an IG whose AST manifest was generated on 2026-11-05 and whose index page links the QA report as qa.html
    When the IG is staged with a QA page
    Then qa.md is written with the IG footer turned on
    And the index page's qa.html link stays a link to this site's page, not the published IG's
    And the footer lists Table of Contents, QA Report and License, dated 2026-11-05 from the AST

  @test:scripts/build-ig-site.test.ts::the_Publisher's_page_footer_on_the_IG_site's_own_pages_(#1901)::igOwnQaPageWins
  Scenario: the IG's own qa page wins over the QA report
    Given an IG whose own source holds a qa.md page
    When the IG is staged with a QA page
    Then the QA report is not written, because the IG's source holds its own qa page
    And the staged qa.md is the IG's own

  @test:scripts/build-ig-site.test.ts::the_Publisher's_page_footer_on_the_IG_site's_own_pages_(#1901)::thinLayoutDrawsFooterAfterMain
  Scenario: composed thin, the IG's own layout draws the footer after <main>, not the page
    Given a staged IG
    When it is composed into a host site under "x" with no collisions
    Then its pages do not include the footer themselves
    And the IG's own thin layout includes the footer after </main>, only on pages that ask for it

  @test:scripts/build-ig-site.test.ts::the_process_task_panel_on_an_IG's_pages_(owner,_2026-11-12,_Q-RAIL-2)::bothLayoutsCarryTheLoader
  Scenario: both IG layouts carry the process task panel's loader, raw
    Then the thin IG layout and the standalone harness layout each hold the task panel script inside a raw block
    And the task panel script holds no Liquid tag or output

  @test:scripts/build-ig-site.test.ts::the_process_task_panel_on_an_IG's_pages_(owner,_2026-11-12,_Q-RAIL-2)::loadsOnlyFromASameSiteSidecar
  Scenario: the task panel loads only a same-site .tasks.json sidecar
    Given the path test the task panel script applies before it loads a sidecar
    Then a relative path to a .tasks.json file, down or up the site, is accepted
    And an absolute or protocol-relative URL, a rooted path, a javascript: or data: URL, a plain .json, a query, or a name that only resembles .tasks.json is refused

  @test:scripts/build-ig-site.test.ts::the_Contents_card_on_an_IG's_narrative_pages_(owner,_2026-11-10)::bothLayoutsCarryTheCard
  Scenario: both IG layouts carry the Contents card's script at the end of main
    Then the thin IG layout and the standalone harness layout each hold the Contents script, raw, just before </main>
    And the standalone layout carries the card's own style, floated right

  @test:scripts/build-ig-site.test.ts::the_Contents_card_on_an_IG's_narrative_pages_(owner,_2026-11-10)::cardNeedsTwoHeadings
  Scenario: the Contents card needs at least two headings
    Then the Contents script draws no card with fewer than two headings
    And it holds no Liquid tag or output

  @test:scripts/build-ig-site.test.ts::the_Contents_card_on_an_IG's_narrative_pages_(owner,_2026-11-10)::shallowestLevelWithOneNested
  Scenario: the card lists the page's shallowest heading level with the next level nested
    Given a page whose sections start at h3, as a markdown IG page's do
    Then the card lists the h3 headings with their h4 headings nested, and nothing deeper
    And on a page with h2 headings the h2 are the top level

  @test:scripts/build-ig-site.test.ts::the_Contents_card_on_an_IG's_narrative_pages_(owner,_2026-11-10)::cardPrintsAsABlock
  Scenario: on paper the card is a plain block, not a float
