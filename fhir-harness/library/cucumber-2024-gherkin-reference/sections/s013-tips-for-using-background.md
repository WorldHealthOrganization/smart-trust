---
doc_id: cucumber-2024-gherkin-reference
doc_title: "Gherkin Reference"
section_id: s013-tips-for-using-background
section_title: "Tips for using Background"
file: "content/docs/gherkin/reference.md"
lines: 368-380
source_sha256: 50bdb1f828b4178c
granularity: heading
---
## Tips for using Background

* Don't use `Background` to set up **complicated states**, unless that state is actually something the client needs to know.
  * For example, if the user and site names don't matter to the client, use a higher-level step such as
`Given I am logged in as a site owner`.
* Keep your `Background` section **short**.
  * The client needs to actually remember this stuff when reading the scenarios. If the `Background` is more than 4 lines long, consider moving some of the irrelevant details into higher-level steps.
* Make your `Background` section **vivid**.
  * Use colourful names, and try to tell a story. The human brain keeps track of stories much better than it keeps track of names like `"User A"`, `"User B"`, `"Site 1"`, and so on.
* Keep your scenarios **short**, and don't have too many.
  * If the `Background` section has scrolled off the screen, the reader no longer has a full overview of what's happening.
Think about using higher-level steps, or splitting the `*.feature` file.
