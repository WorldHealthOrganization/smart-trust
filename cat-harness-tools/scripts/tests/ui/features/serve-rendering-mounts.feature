# Covers scripts/serve-rendering.ts and scripts/lib/rendering-handler.ts: several sites mounted under /<repo>/ on one
# local origin, with the GitHub Pages behaviours links depend on. Each Scenario names the test that executes it.
Feature: Several sites on one local origin

  @test:scripts/tests/ui/serve-rendering-mounts.test.ts::several_sites_under_/<repo>/::%s_serves_its_own_site
  Scenario: Each mounted path serves its own site
    Given sites mounted at "/a", "/b/" and "/a/nested", with a preview under "/a/STAGING/claude-x"
    When each of "/a/", "/b/", "/a/nested/" and "/a/STAGING/claude-x/" is fetched
    Then each answers 200
    And the bodies contain "site a", "site b", "nested" and "preview x" respectively

  @test:scripts/tests/ui/serve-rendering-mounts.test.ts::several_sites_under_/<repo>/::declared_media_types_still_win_inside_a_mount
  Scenario: Declared media types still apply inside a mount
    When "/a/doc.jsonld" is fetched
    Then the content type is "application/ld+json"

  @test:scripts/tests/ui/serve-rendering-mounts.test.ts::several_sites_under_/<repo>/::the_root_lists_the_mounts_when_nothing_is_mounted_at_/
  Scenario: The root lists the mounts when nothing is mounted at it
    When "/" is fetched
    Then it answers 200
    And the page links to "/a/", "/b/" and "/a/nested/"

  @test:scripts/tests/ui/serve-rendering-mounts.test.ts::several_sites_under_/<repo>/::an_unmounted_prefix_is_404
  Scenario: An unmounted prefix is not found
    When "/c/" is fetched
    Then it answers 404

  @test:scripts/tests/ui/serve-rendering-mounts.test.ts::several_sites_under_/<repo>/::a_symlink_out_of_a_mount_is_still_refused
  Scenario: A symlink pointing out of a mount is refused
    Given "/a/escape.txt" is a symlink to a file outside every mount
    When it is fetched
    Then it answers 404

  @test:scripts/tests/ui/serve-rendering-mounts.test.ts::the_Pages_behaviours_links_depend_on::%s_redirects_to_%s
  Scenario: A directory path without a trailing slash redirects to one
    When "/a" and "/a/guide" are fetched without following redirects
    Then each answers 301
    And the locations are "/a/" and "/a/guide/" respectively

  @test:scripts/tests/ui/serve-rendering-mounts.test.ts::the_Pages_behaviours_links_depend_on::an_extensionless_page_serves_its_.html
  Scenario: An extensionless page serves its .html file
    When "/a/about" is fetched
    Then it answers 200 with "about a" in the body

  @test:scripts/tests/ui/serve-rendering-mounts.test.ts::the_Pages_behaviours_links_depend_on::a_miss_serves_the_site's_own_404.html_with_status_404
  Scenario: A miss serves the site's own 404.html with status 404
    When "/a/no-such-page" is fetched
    Then it answers 404
    And the body contains "a missing"

  @test:scripts/tests/ui/serve-rendering-mounts.test.ts::the_Pages_behaviours_links_depend_on::a_site_with_no_404.html_gets_a_plain_404
  Scenario: A site with no 404.html gets a plain not-found body
    When "/b/no-such-page" is fetched
    Then it answers 404
    And the body is "Not found" followed by a newline

  @test:scripts/tests/ui/serve-rendering-mounts.test.ts::the_Pages_behaviours_links_depend_on::HEAD_answers_without_a_body
  Scenario: HEAD answers without a body
    When "/a/" is requested with HEAD
    Then it answers 200 with an empty body

  @test:scripts/tests/ui/serve-rendering-mounts.test.ts::the_Pages_behaviours_links_depend_on::other_methods_are_405
  Scenario: Methods other than GET and HEAD are refused
    When "/a/" is requested with POST
    Then it answers 405

  @test:scripts/tests/ui/serve-rendering-mounts.test.ts::one_origin,_not_two::a_request_naming_%s_is_sent_to_127.0.0.1_on_the_same_port
  Scenario: A request naming another loopback host is redirected to 127.0.0.1
    Given a handler with canonical host "127.0.0.1"
    When "/a/about?x=1" is requested on "localhost" and on "[::1]" at port 4007
    Then each answers 308
    And the location is the same path and query on "127.0.0.1:4007"

  @test:scripts/tests/ui/serve-rendering-mounts.test.ts::one_origin,_not_two::a_request_already_on_127.0.0.1_is_served,_not_redirected
  Scenario: A request already on 127.0.0.1 is served without a redirect
    Given a handler with canonical host "127.0.0.1"
    When "/a/" is requested on "127.0.0.1"
    Then it answers 200

  @test:scripts/tests/ui/serve-rendering-mounts.test.ts::one_origin,_not_two::without_canonicalHost_nothing_is_redirected
  Scenario: Without a canonical host nothing is redirected
    Given a handler with no canonical host
    When "/a/" is requested on "localhost"
    Then it answers 200

  @test:scripts/tests/ui/serve-rendering-mounts.test.ts::mount_table::longest_prefix_first,_root_last
  Scenario: The mount table orders the longest prefix first and the root last
    Given mounts at "/", "/x" and "/x/y/"
    When they are normalised
    Then the prefixes are "/x/y", "/x" and "/" in that order

  @test:scripts/tests/ui/serve-rendering-mounts.test.ts::mount_table::a_prefix_matches_whole_segments_only
  Scenario: A mount prefix matches whole path segments only
    Given a mount at "/dth"
    Then "/dth-pc/" matches no mount
    And "/dth/x" matches with the rest "/x"

  @test:scripts/tests/ui/serve-rendering-mounts.test.ts::mount_table::a_bad_prefix_%s_is_refused
  Scenario: A prefix with dot segments is refused
    When a mount is normalised with each of "/..", "/a/../b" and "/a/./b"
    Then each throws

  @test:scripts/tests/ui/serve-rendering-mounts.test.ts::mount_table::the_same_prefix_twice_is_refused
  Scenario: The same prefix twice is refused
    When mounts "/a" and "/a/" are normalised together
    Then it throws

  @test:scripts/tests/ui/serve-rendering-mounts.test.ts::mount_table::--mount_parses_/<prefix>=<dir>,_keeping_=_inside_the_dir
  Scenario: The mount option parses prefix=dir and keeps later equals signs in the dir
    When "/dth-pc=../site=x" is parsed
    Then the prefix is "/dth-pc" and the dir is "../site=x"
    And "no-equals" and "/a=" each throw

  @test:scripts/tests/ui/serve-rendering-mounts.test.ts::ports::the_default_is_the_prime_4007,_clear_of_jekyll_serve's_4000
  Scenario: The default port is 4007
    Then the default port is 4007

  @test:scripts/tests/ui/serve-rendering-mounts.test.ts::ports::a_taken_port_suggests_the_next_prime
  Scenario: A taken port suggests the next prime
    Then the next prime port after 4000 is 4001
    And after 4007 it is 4013
    And after 65535 there is none

  @test:scripts/tests/ui/serve-rendering-mounts.test.ts::portability::the_handler_names_no_Bun_API,_so_a_Node_launcher_can_reuse_it
  Scenario: The rendering handler source names no Bun API
    # Gap: checked on the source text with comments stripped; no Node launcher is run
    Given the source of "scripts/lib/rendering-handler.ts" with comments removed
    Then it contains no "Bun." reference
    And it imports nothing from "bun" or a "bun:" module
