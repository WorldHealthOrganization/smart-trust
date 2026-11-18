# Third-party notices

Material in this repository that carries somebody else's licence, and the
notice that licence requires. Each vendored package keeps its own licence file
beside its files, and a `vendored.json` records where the bytes came from
(npm tarball, integrity, and a SHA-256 per file). The bytes are unmodified.

## `scripts/assets/vendor/lhc-forms/44.1.0/` — LHC-Forms (`lforms` 44.1.0), NLM

The LHC-Forms web component and its FHIR support library, which draw a
Questionnaire's form view on an IG site (skill `fhir-questionnaire-wireframe`).
Served from the site itself, never from a CDN. The full notice is
[`LICENSE.md`](scripts/assets/vendor/lhc-forms/44.1.0/LICENSE.md) in that
directory, reproduced here as its terms require for redistribution in binary
form:

```
Licensing and Copyright Notice and Terms of Use

Owner Notice: This software (including any associated website-service or
downloadable source (code) was developed by the Lister Hill National Center
for Biomedical Communications (LHNCBC), a research and development division
of the U.S. National Library of Medicine (NLM), with the permission and based
on the copyrighted content of the Regenstrief Institute.

This material may contain content from LOINC &#174; (http://loinc.org). The
LOINC table, LOINC codes, LOINC panels and forms file, LOINC linguistic variants
file, LOINC/RSNA Radiology Playbook, and LOINC/IEEE Medical Device Code Mapping
Table are copyright &#169; 1995-2016, Regenstrief Institute, Inc. and the
Logical Observation Identifiers Names and Codes (LOINC) Committee and is
available at no cost under the license at http://loinc.org/terms-of-use.
LOINC &#174; is a registered United States trademark of Regenstrief Institute, Inc.

If LOINC content is included, this software is distributed under the conditions
set forth at https://loinc.org/terms-of-use and the following terms and conditions.

If this product includes all or a portion of the UCUM table, UCUM codes, and
UCUM definitions or is derived from it, it is subject to a license from
Regenstrief Institute, Inc. and The UCUM Organization. Your use of the UCUM table,
UCUM codes, UCUM definitions also is subject to this license, a copy of which is
available at http://unitsofmeasure.org. The current complete UCUM table, UCUM
Specification are available for download at http://unitsofmeasure.org. The UCUM
table and UCUM codes are copyright &#169; 1995-2009, Regenstrief Institute, Inc.
and the Unified Codes for Units of Measures (UCUM) Organization. All rights reserved.

If UCUM content is included, this software is distributed under the conditions
set forth at http://unitsofmeasure.org/trac/wiki/TermsOfUse and the following
terms and conditions.

The following terms and conditions are based on the BSD open-source license.

If publishing research that used this software, please include a citation that
acknowledges it.

Redistribution and use in source and binary forms, with or without modification,
are permitted for commercial and non-commercial purposes and products alike,
provided that the following conditions are met:

  * Redistributions of source code shall retain the above Owner Notice, this
  list of conditions and the following disclaimer, and display them prominently.
  * Redistributions in binary form shall prominently reproduce the above Owner
  Notice, this list of conditions and the following disclaimer in the
  documentation and/or other materials provided with the distribution.
  * Neither the names of the National Library of Medicine (NLM), the Lister
  Hill National Center for Biomedical Communications (LHNCBC), the National
  Institutes of Health (NIH), nor the names of any of the software contributors
  may be used to endorse or promote products derived from this software without
  specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE OWNER AND CONTRIBUTORS "AS IS" AND ANY EXPRESS
OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
SHALL THE OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR
BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.

THE UCUM TABLE (IN ALL FORMATS), UCUM DEFINITIONS, AND SPECIFICATION ARE
PROVIDED "AS IS." ANY EXPRESS OR IMPLIED WARRANTIES ARE DISCLAIMED, INCLUDING,
BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
PARTICULAR PURPOSE.

```


## `scripts/assets/vendor/formbuilder-lhcforms/12.9.0/` — NLM Form Builder (`formbuilder-lhcforms` 12.9.0), NLM

The NLM Form Builder, self-hosted as the editor of the ✍ Questionnaire mode.
Its notice is [`LICENSE.md`](scripts/assets/vendor/formbuilder-lhcforms/12.9.0/LICENSE.md)
in that directory: the same NLM owner notice, BSD-style conditions and
disclaimer as LHC-Forms above, which this file reproduces once rather than
twice. What its bundle includes, with each licence, is
[`3rdpartylicenses.txt`](scripts/assets/vendor/formbuilder-lhcforms/12.9.0/3rdpartylicenses.txt),
kept as the package ships it. The site serves a rewritten copy of its
`index.html` (local jQuery, no Google fonts, a service-worker guard); the
vendored file itself is unmodified.

## `scripts/assets/vendor/jquery/3.6.0/` — jQuery 3.6.0, MIT

Loaded by the Form Builder's `index.html`, served from this site instead of
ajax.googleapis.com.

```
Copyright OpenJS Foundation and other contributors, https://openjsf.org/

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## `scripts/assets/vendor/ucum-lhc/8.0.0/` — UCUM definitions (`@lhncbc/ucum-lhc` 8.0.0), NLM; UCUM, Regenstrief Institute and the UCUM Organization

The full UCUM unit and prefix definitions, from which the site build writes
the index the Form Builder's unit search is answered from. Its notice is
[`LICENSE.md`](scripts/assets/vendor/ucum-lhc/8.0.0/LICENSE.md): the NLM owner
notice and BSD-style conditions above, and the UCUM terms of use at
https://ucum.org/license, which this content is subject to. The UCUM table and
UCUM codes are copyright © 1995-2009, Regenstrief Institute, Inc. and the
Unified Codes for Units of Measures (UCUM) Organization. All rights reserved.
