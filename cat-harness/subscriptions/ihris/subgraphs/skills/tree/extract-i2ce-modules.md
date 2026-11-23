---
name: extract-i2ce-modules
description: >
  Turn a verified iHRIS/I2CE release tarball into module nodes
  (ihris-i2ce-module/v1) and a data model (ihris-form-class/v1) without
  committing the source. Use when a release tarball is uploaded.
input: src/schemas/skills/extract-i2ce-modules/input.schema.json
output: src/schemas/skills/extract-i2ce-modules/output.schema.json
---

# Extract I2CE modules and the data model from a release

iHRIS 4.x is built from **I2CE modules**. Each is an XML file whose root is
`<I2CEConfiguration name="...">` with a `<metadata>` block:
`displayName`, `description`, `version`, `className`, `category`, and the
edges `requirement`, `enable`, `conflict`, `optional` (each with version
operators `atLeast`, `lessThan`, …, kept verbatim, including the lowercase
`atleast` and the PHP `eval` a few modules use).

The rest of the file is a **configuration tree**. A `configurationGroup`'s
`path` attribute is absolute if it starts with `/`, otherwise relative to its
parent. `/I2CE` (or `//I2CE`) is the root. After resolving paths:

| resolved path | what it is |
|---|---|
| `/modules/forms/forms/<form>` | a form registration (`class` = its form class) |
| `/modules/forms/formClasses/<Class>/fields/<field>` | a field: `formfield` type, `headers` label, `required`, `unique`; `meta/form` names the list a MAP field draws from |
| `/page/<page>` | a page (`class`, `style`) |
| `/formsData/forms/<form>/<id>` | a shipped data record (standard list or sample data) |

## Steps

1. Put the tarball in `uploads/<name>/` (it is git-ignored) and write
   `uploads/<name>/manifest.json` with `bytes`, `md5`, `sha256`, and
   `upstreamMd5` from `uploads/launchpad/release-file-md5.tsv`. **Stop if the
   MD5s differ.**
2. Run `python3 src/tools/build_kg.py`. It re-checks the sha256 against the
   manifest before extracting, and refuses on mismatch.
3. Module ids are `<instance>/module/<name>`. Sites (`sites/Demo`,
   `sites/Blank`, …) override core module names, so a repeated name is
   qualified `@<site>`, then by directory. Filenames compare case-insensitively.
4. `python3 src/tools/validate.py`.

**Nothing from the tarball is committed except derived descriptions.** Each
module node pins its XML by `source.path` and `source.sha256`, so the claim can
be re-checked against any copy.
