Feature: a scheme a layer declares about a layer it mounts but does not need is minted, served and linked on the declaring layer's site

  @test:scripts/glossary-borrowed-scheme.test.ts::a_scheme_declared_about_a_mounted_layer_it_does_not_need::the_mount_is_another_repository
  Scenario: a mount is another repository
    Given a checkout whose lock mounts one layer
    When its repositories are listed
    Then they are the mount and the checkout, longest first

  @test:scripts/glossary-borrowed-scheme.test.ts::a_scheme_declared_about_a_mounted_layer_it_does_not_need::is_the_declaring_layer's,_minted_in_its_namespace
  Scenario: the scheme is the declaring layer's
    Given a host layer's scheme whose source is in the library of a mounted layer the host does not need
    When the glossaries are collected
    Then the scheme is credited to the host layer and its terms are minted in the host's namespace

  @test:scripts/glossary-borrowed-scheme.test.ts::a_scheme_declared_about_a_mounted_layer_it_does_not_need::its_site_serves_every_IRI_its_SKOS_mints:_a_page_at_each_path,_an_id_for_each_fragment
  Scenario: the host's site serves every IRI the scheme mints
    Given the host's site build, scoped to the host
    When the namespace files are computed
    Then every IRI the scheme's SKOS mints has a page at <path>/index.html, holding an id for its fragment

  @test:scripts/glossary-borrowed-scheme.test.ts::a_scheme_declared_about_a_mounted_layer_it_does_not_need::its_term_pages_are_written_under_the_declaring_layer,_which_its_site_build_keeps
  Scenario: the term pages are the host's
    Given the scheme credited to the host
    When the term pages are computed
    Then each term's page is under the host's instance route

  @test:scripts/glossary-borrowed-scheme.test.ts::a_scheme_declared_about_a_mounted_layer_it_does_not_need::a_document's_term_links_stay_on_the_declaring_layer's_site
  Scenario: a translated document's term links stay on the host's site
    Given a document page of the host in a locale directory
    When its term links and glossary table entries are computed
    Then each is relative to the host's own term page or glossary row, and none names the mounted layer

  @test:scripts/glossary-borrowed-scheme.test.ts::a_scheme_declared_about_a_mounted_layer_it_does_not_need::a_mounted_layer's_own_scheme_stays_its_own
  Scenario: a mounted layer's own scheme stays its own
    Given a scheme the mounted layer declares in its own glossary directory
    When the glossaries are collected
    Then it is credited to the mounted layer

  @test:scripts/glossary-borrowed-scheme.test.ts::a_scheme_declared_about_a_mounted_layer_it_does_not_need::a_scheme_about_a_mounted_layer_the_declarer_needs_stays_that_layer's
  Scenario: a scheme about a layer the declarer needs stays that layer's
    Given a host layer's scheme whose source is in a mounted layer the host needs
    When the glossaries are collected
    Then it is credited to that layer, as the layers below name its terms
