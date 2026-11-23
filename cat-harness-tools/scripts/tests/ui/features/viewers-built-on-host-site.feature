# `viewersOf` in `scripts/viewer-declarations.ts` credits a `builtOnHostSite` visualiser's sub-graph
# page in a checkout whose site another layer owns, naming the `renderedBy` Tool's `bun run cat
# <script>` as its writer (derive:publish builds it there), and credits nothing else it did not before.
# Each Scenario names the test that executes it.
Feature: Viewers of a visualiser built on the host site

  @test:scripts/tests/ui/viewers-built-on-host-site.test.ts::viewersOf_and_a_visualiser_built_on_the_host_site::not_builtOnHostSite,_its_page_built_only_on_its_own_site:_no_viewer_downstream,_as_before
  Scenario: A visualiser not built on the host site has no viewer downstream
    Given a lower layer declaring a kind-covering, per-instance visualiser
    And another layer owning the site
    When the viewers of the lower layer's directory are read
    Then there are none

  @test:scripts/tests/ui/viewers-built-on-host-site.test.ts::viewersOf_and_a_visualiser_built_on_the_host_site::builtOnHostSite:_its_sub-graph_view_is_credited,_with_the_Tool's_script_as_writer
  Scenario: A builtOnHostSite visualiser's sub-graph view is credited with its Tool's script
    Given the same visualiser declared builtOnHostSite
    And its Tool's shell is "bun run cat lower:extraction:pages"
    When the viewers of the lower layer's directory are read
    Then one viewer opens its per-instance page
    And its writer is the script that command runs
    And the visualisation resolves

  @test:scripts/tests/ui/viewers-built-on-host-site.test.ts::viewersOf_and_a_visualiser_built_on_the_host_site::builtOnHostSite_with_a_Tool_shell_derive:publish_refuses:_not_credited
  Scenario: A Tool shell derive:publish refuses is not credited
    Given the visualiser declared builtOnHostSite
    And its Tool's shell runs a file rather than "bun run cat <script>"
    When the viewers of the lower layer's directory are read
    Then there are none
