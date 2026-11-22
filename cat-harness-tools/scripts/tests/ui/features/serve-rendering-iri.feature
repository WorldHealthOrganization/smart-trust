# Covers the published-IRI rewriting in scripts/serve-rendering.ts and scripts/lib/rendering-handler.ts: links to a
# mounted repo's published address are served pointing at the local server, and IRIs asked for as JSON-LD get their .jsonld.
# Each Scenario names the test that executes it.
Feature: Published IRIs open the local copy

  @test:scripts/tests/ui/serve-rendering-iri.test.ts::links_in_a_served_page::every_link_to_a_mounted_repo_stays_on_127.0.0.1
  Scenario: Links to a mounted repo are rewritten to the local server
    Given a server mounting "folio-assistant" and "dth" with IRI bases at "https://litlfred.github.io"
    And a page linking to mounted repos and to "dth-pc", "smart-ra" and "folio-assistantx"
    When the page is fetched
    Then the "x-rendering-rewritten" header is "iri"
    And the links to "folio-assistant/v0/ns#Thing", bare "folio-assistant" and "dth/glossary.html" point at 127.0.0.1
    And the links to "dth-pc", "smart-ra" and "folio-assistantx" are left as published

  @test:scripts/tests/ui/serve-rendering-iri.test.ts::links_in_a_served_page::the_file_on_disk_is_unchanged
  Scenario: Serving a rewritten page leaves the file on disk unchanged
    Given the page has been served with rewriting
    Then the "index.html" on disk still reads exactly as written

  @test:scripts/tests/ui/serve-rendering-iri.test.ts::links_in_a_served_page::JSON-LD_@id_values_are_rewritten_too
  Scenario: JSON-LD @id values are rewritten
    Given a ".jsonld" file whose "@id" is a mounted IRI and whose "seeAlso" is an unmounted one
    When the file is fetched
    Then its "@id" points at 127.0.0.1
    And its "seeAlso" is left as published

  @test:scripts/tests/ui/serve-rendering-iri.test.ts::links_in_a_served_page::a_binary_file_is_sent_as_published
  Scenario: A binary file is sent as published
    Given a "logo.png" whose bytes contain the published origin
    When it is fetched
    Then there is no "x-rendering-rewritten" header
    And the body still contains the published origin

  @test:scripts/tests/ui/serve-rendering-iri.test.ts::links_in_a_served_page::--no-rewrite_serves_the_published_bytes
  Scenario: With rewriting off the published bytes are served
    Given a second server with rewriting turned off
    When the page is fetched from it
    Then there is no "x-rendering-rewritten" header
    And the body is exactly the page as written

  @test:scripts/tests/ui/serve-rendering-iri.test.ts::an_IRI_asked_for_as_JSON-LD::an_extensionless_IRI_with_Accept:_application/ld+json_serves_its_.jsonld
  Scenario: An extensionless IRI asked for as JSON-LD is answered as JSON-LD
    # Gap: the body is not checked to be the contents of the .jsonld file
    Given "v0/ns.html" and "v0/ns.jsonld" on disk
    When "/folio-assistant/v0/ns" is fetched with Accept "application/ld+json"
    Then the content type is "application/ld+json"
    And the "vary" header is "Accept"

  @test:scripts/tests/ui/serve-rendering-iri.test.ts::an_IRI_asked_for_as_JSON-LD::a_directory_IRI_serves_index.jsonld
  Scenario: A directory IRI asked for as JSON-LD is answered as JSON-LD
    # Gap: the body is not checked to be index.jsonld
    Given "v0/proc/index.html" and "v0/proc/index.jsonld" on disk
    When "/folio-assistant/v0/proc/" is fetched with Accept "application/ld+json"
    Then the content type is "application/ld+json"

  @test:scripts/tests/ui/serve-rendering-iri.test.ts::an_IRI_asked_for_as_JSON-LD::a_browser's_Accept_still_gets_the_page,_as_on_Pages
  Scenario: A browser's Accept header still gets the HTML page
    When "/folio-assistant/v0/ns" is fetched with a typical browser Accept header
    Then the body contains "ns page"

  @test:scripts/tests/ui/serve-rendering-iri.test.ts::an_IRI_asked_for_as_JSON-LD::HTML_preferred_over_JSON-LD_by_q-value_gets_the_page
  Scenario: HTML preferred over JSON-LD by q-value gets the HTML page
    When "/folio-assistant/v0/ns" is fetched with Accept "application/ld+json;q=0.5, text/html"
    Then the body contains "ns page"

  @test:scripts/tests/ui/serve-rendering-iri.test.ts::the_rewriter::the_longest_base_wins
  Scenario: The longest matching base wins
    Given a rewriter with bases ".../a" to "/a" and ".../a/b" to "/b"
    Then ".../a/b/x" is rewritten to "http://127.0.0.1:4007/b/x"
    And ".../a/c" is rewritten to "http://127.0.0.1:4007/a/c"

  @test:scripts/tests/ui/serve-rendering-iri.test.ts::the_rewriter::a_base_followed_by_%p_is_rewritten
  Scenario: A base followed by a delimiter is rewritten
    Given a rewriter with the base ".../a" mapped to "/a"
    When the base is followed by each of "?q=1", "#frag", a double quote, a single quote, ")", a space, "<", "," and "&amp;"
    Then it is rewritten to "http://127.0.0.1:4007/a" followed by the same text

  @test:scripts/tests/ui/serve-rendering-iri.test.ts::the_rewriter::a_base_that_is_only_the_start_of_a_longer_segment_is_not
  Scenario: A base that is only the start of a longer segment is not rewritten
    Given a rewriter with the base ".../a" mapped to "/a"
    Then ".../ab/x" is left unchanged

  @test:scripts/tests/ui/serve-rendering-iri.test.ts::the_rewriter::no_bases_is_the_identity
  Scenario: A rewriter with no bases changes nothing
    Given a rewriter with no bases
    Then "anything" is returned unchanged

  @test:scripts/tests/ui/serve-rendering-iri.test.ts::where_the_bases_come_from::one_base_per_prefixed_mount,_none_for_a_root_mount
  Scenario: Each prefixed mount gives one base and a root mount gives none
    Given a root mount and a mount at "/fa" with the origin "https://litlfred.github.io/"
    When the IRI bases are derived
    Then the only base maps "https://litlfred.github.io/fa" to "/fa"

  @test:scripts/tests/ui/serve-rendering-iri.test.ts::where_the_bases_come_from::no_origin_means_no_automatic_bases,_explicit_ones_still_apply
  Scenario: Without an origin only explicit bases apply
    Given a mount at "/fa", no origin, and an explicit base "https://w3id.org/x" to "/fa"
    When the IRI bases are derived
    Then the bases are exactly that explicit one

  @test:scripts/tests/ui/serve-rendering-iri.test.ts::where_the_bases_come_from::the_declared_canonicalUrl_gives_the_origin
  Scenario: The declared canonicalUrl gives the origin
    Given a directory whose "cat-harness.json" declares canonicalUrl "https://litlfred.github.io/folio-assistant"
    When the declared IRI origin is read
    Then it is "https://litlfred.github.io"

  @test:scripts/tests/ui/serve-rendering-iri.test.ts::where_the_bases_come_from::no_declaration_gives_no_origin
  Scenario: No declaration gives no origin
    Given an empty directory
    When the declared IRI origin is read
    Then there is none
