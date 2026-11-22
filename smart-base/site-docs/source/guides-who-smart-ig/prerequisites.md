The L3 toolchain is heavier than the platform baseline. The
`authoring-who-smart-guidelines` package's Docker manifest provisions it; to run
locally you need:

| Tool | Purpose | Install |
|------|---------|---------|
| Java 21 (JRE) | IG Publisher | `apt install openjdk-21-jre-headless` |
| FHIR IG Publisher | build the IG | download `publisher.jar` from [HL7/fhir-ig-publisher](https://github.com/HL7/fhir-ig-publisher/releases/latest) |
| SUSHI (`fsh-sushi`) | compile FSH → FHIR | `npm i -g fsh-sushi` |
| Jekyll | IG site rendering | `gem install jekyll bundler` |

Run `bun run cat check-deps` and the agent's `check_dependencies` tool to confirm.

These are the tools of the plain IG Publisher build. To render an IG
**through the harness**, which builds the site from the Publisher's AST and
pins its versions, see [Building and publishing the SMART Base IG](smart-base-build.html).
