# Specifies schemas/ui/safe-url.ts: safeHref and checkHref, a default-deny
# allow-list of URL schemes for every href a renderer writes, and the
# evasions it has to survive.
Feature: An href passes only with an allowed scheme or as a relative reference

  @test:schemas/ui/safe-url.test.ts::the_allowed_schemes_pass::http,_https,_mailto,_tel
  Scenario: http, https, mailto and tel URLs pass unchanged
    When safeHref is given an https, an http, a mailto and a tel URL
    Then each comes back unchanged

  @test:schemas/ui/safe-url.test.ts::the_allowed_schemes_pass::the_list_is_what_decides_—_nothing_is_special-cased_past_it
  Scenario: A scheme passes exactly when it is on the allowed list
    When safeHref is given "<scheme>//example.invalid" for each allowed scheme
    Then each gives a defined href
    When it is given the same for ftp:, file:, data:, javascript:, vbscript:, blob:, ws:, wss:, sms:, about:, chrome:, git:, ssh:, irc: and x-custom:, none of which is listed
    Then each of those is refused

  @test:schemas/ui/safe-url.test.ts::relative_references_pass,_because_they_cannot_introduce_a_scheme::paths,_fragments_and_queries
  Scenario: Relative paths, fragments and queries pass unchanged
    When safeHref is given "/beans/", "./x.html", "x.html", "#frag" and "?q=1"
    Then each comes back unchanged

  @test:schemas/ui/safe-url.test.ts::relative_references_pass,_because_they_cannot_introduce_a_scheme::but_a_PROTOCOL-RELATIVE_url_does_not
  Scenario: A protocol-relative URL is refused
    When safeHref is given "//evil.invalid/x"
    Then it gives no href

  @test:schemas/ui/safe-url.test.ts::default-deny_—_the_point_of_a_list_rather_than_a_blocklist::javascript:_is_refused
  Scenario: A javascript: URL is refused
    When safeHref is given "javascript:alert(1)"
    Then it gives no href

  @test:schemas/ui/safe-url.test.ts::default-deny_—_the_point_of_a_list_rather_than_a_blocklist::and_so_is_every_scheme_nobody_has_thought_about
  Scenario: Schemes off the list are refused
    When safeHref is given vbscript:, data:text/html, file:, chrome:, intent:, blob: and javascript: URLs
    Then each gives no href

  @test:schemas/ui/safe-url.test.ts::default-deny_—_the_point_of_a_list_rather_than_a_blocklist::`data:`_is_refused_even_for_an_image_—_assets_are_ADDRESSABLE
  Scenario: A data: image URL is refused
    When safeHref is given "data:image/png;base64,iVBORw0KGgo="
    Then it gives no href

  @test:schemas/ui/safe-url.test.ts::the_evasions_a_naive_`startsWith`_misses::case_does_not_change_the_scheme
  Scenario: Letter case does not hide the javascript: scheme
    When safeHref is given "JavaScript:", "JAVASCRIPT:" and "jAvAsCrIpT:" URLs
    Then each gives no href

  @test:schemas/ui/safe-url.test.ts::the_evasions_a_naive_`startsWith`_misses::leading_control_characters_and_whitespace_are_stripped_BEFORE_deciding
  Scenario: Leading control characters and whitespace do not hide the scheme
    When safeHref is given "javascript:alert(1)" preceded by a tab, a newline, a CR, a space, NUL or a vertical tab
    Then each gives no href

  @test:schemas/ui/safe-url.test.ts::the_evasions_a_naive_`startsWith`_misses::and_the_same_stripping_does_not_break_a_legitimate_url
  Scenario: Surrounding spaces are trimmed from a legitimate URL
    When safeHref is given "  https://example.invalid/x  "
    Then it gives "https://example.invalid/x"

  @test:schemas/ui/safe-url.test.ts::the_evasions_a_naive_`startsWith`_misses::an_empty_or_whitespace-only_url_is_refused,_not_passed_through
  Scenario: An empty, blank or absent URL is refused
    When safeHref is given "", "   " and undefined
    Then each gives no href

  @test:schemas/ui/safe-url.test.ts::the_evasions_a_naive_`startsWith`_misses::a_tab,_newline_or_CR_INSIDE_the_scheme_is_the_classic_bypass
  Scenario: A tab, newline or CR inside the scheme does not hide it
    When safeHref is given "java<TAB>script:", "java<LF>script:", "java<CR>script:" and a javascript: with a tab between every letter
    Then each gives no href

  @test:schemas/ui/safe-url.test.ts::the_evasions_a_naive_`startsWith`_misses::and_a_legitimate_url_is_normalised_the_same_way_a_browser_would
  Scenario: An inner tab is removed from a legitimate URL
    When safeHref is given "https://example.invalid/a<TAB>b"
    Then it gives "https://example.invalid/ab"

  @test:schemas/ui/safe-url.test.ts::checkHref_reports_the_refusal_rather_than_dropping_it_silently::a_refusal_names_the_url_and_the_allowed_schemes
  Scenario: A refusal names the URL and the allowed schemes
    When checkHref is given "javascript:alert(1)"
    Then it gives no href
    And its refusal names the URL "javascript:alert(1)"
    And the refusal's reason names every allowed scheme

  @test:schemas/ui/safe-url.test.ts::checkHref_reports_the_refusal_rather_than_dropping_it_silently::an_allowed_url_carries_no_refusal
  Scenario: An allowed URL carries no refusal
    When checkHref is given "https://example.invalid/"
    Then the result is that href alone

  @test:schemas/ui/safe-url.test.ts::checkHref_reports_the_refusal_rather_than_dropping_it_silently::absent_is_neither_an_href_nor_a_refusal
  Scenario: An absent URL is neither an href nor a refusal
    When checkHref is given undefined
    Then the result is an empty object

  @test:schemas/ui/safe-url.test.ts::this_check_is_NOT_vacuous_—_the_schema_permits_what_the_renderer_refuses::`TodoRelationSchema`_accepts_a_javascript:_href_today
  Scenario: The todo relation schema accepts a javascript: href that safeHref refuses
    Given a todo relation with href "javascript:alert(1)"
    When it is parsed with the todo relation schema
    Then the parsed href is "javascript:alert(1)"
    And safeHref gives no href for it
