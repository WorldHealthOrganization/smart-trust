### Generating a QR Code

This page is a step-by-step, implementer-facing walkthrough of how a signed
health certificate becomes a QR code on a piece of paper or a phone screen, and
how a verifier turns that QR code back into trustworthy data.

The container, the signature and the transport encoding are the *same* for every
GDHCN trust domain, and are specified normatively in the
[HCERT Specification](hcert_spec.html). What changes from one use case to the
next is only the **payload**: which logical model you put inside the `hcert`
claim, and which subclaim number you put it under. The first step below is
therefore a selection step, and everything after it is mechanical.

Where this page and the [HCERT Specification](hcert_spec.html) appear to differ,
the HCERT Specification is authoritative.

#### 1. The pipeline at a glance

```
                   use case  ──▶  logical model  ──▶  hcert subclaim
                                                           │
   Step 1  Select payload type ──────────────────────────────┘
   Step 2  Assemble payload                 { "n": ..., "dob": ..., "vx": {...} }
   Step 3  Wrap in CWT claim set            { 1: iss, 6: iat, 4: exp, -260: { -6: payload } }
   Step 4  Serialise as CBOR                binary
   Step 5  Sign as COSE_Sign1 (ES256)       binary, tag 18
   Step 6  Compress with ZLIB/Deflate       binary
   Step 7  Encode as Base45                 ASCII
   Step 8  Prefix context identifier        "HC1:" + ASCII
   Step 9  Render QR (Alphanumeric, EC Q)   image
```

Steps 3 to 9 never vary. A verifier runs the same list upwards.

#### 2. Step 1 — Select the logical model for your use case

An HCERT carries exactly one payload, identified by a **subclaim** inside the
`hcert` claim (`-260`). Choosing the subclaim *is* choosing the data model, and
the choice follows from the use case, not from the technology.

##### 2.1 Subclaims defined in this guide

These are the subclaims enumerated by the
[HCert logical model](StructureDefinition-HCert.html). Section
[3.2.7.1](hcert_spec.html#3271-subclaims) of the HCERT Specification remains
authoritative.

| Subclaim | Logical model | Carries | Status |
|----------|---------------|---------|--------|
| `1` | [HCertDCC](http://smart.who.int/ddcc/StructureDefinition-HCertDCC.html) | EU Digital Covid Certificate core data set | Assigned |
| `3` | [DDCCCoreDataSetVS](http://smart.who.int/ddcc/StructureDefinition-DDCCCoreDataSetVS.html) | DDCC vaccination status | Proposed |
| `4` | [DDCCCoreDataSetTR](http://smart.who.int/ddcc/StructureDefinition-DDCCCoreDataSetTR.html) | DDCC test result | Proposed |
| `5` | string | URI of a Verifiable Health Link (VHL) | Assigned |
| `-6` | [DVCMin](http://smart.who.int/trust-phw/StructureDefinition-DVCMin.html) | Minimal Digital Vaccine Certificate | Development range |
| `-7` | [MedicationTreatmentLineMin](http://smart.who.int/ph4h/StructureDefinition-MedicationTreatmentLineMin.html) | Minimal medication treatment line | Development range |

Two properties of this registry matter when you pick a number:

* Subclaims **0 and above are reserved by WHO** and are allocated together with a
  trust domain. Request one through the GDHCN Secretariat.
* Subclaims that are **negative integers are the development range** and are free
  to use. `-6` (DVC) and `-7` are in that range today, which means an
  implementation using them is a pilot or a development deployment, and the
  number is not guaranteed to be stable. Do not treat a negative subclaim as a
  production allocation.

The registered production [trust domains](trust_domains.html) are `DDCC`,
`IPS-PILGRIMAGE`, `PH4H` and `ICVP`. There is no separate production trust
domain code for the generic DVC at the time of writing.

##### 2.2 Choosing between a DVC and a VHL

The decisive question is **whether the data must survive offline, and how much of
it there is**.

| | **DVC in the QR (subclaim `-6`)** | **VHL in the QR (subclaim `5`)** |
|---|---|---|
| What the QR holds | The vaccination data itself, signed | A link to the data, signed |
| Works fully offline | Yes — verifier needs only the trust list | No — verifier must dereference the link |
| Data volume | Small, bounded; one immunization event per certificate | Unbounded; a full IPS or immunization history |
| Revocation / update after issue | Not possible; reissue instead | Possible — the content behind the link can change |
| Selective disclosure | Not in the minimal payload | Yes, the endpoint can tailor what is returned |
| Holder device | Paper is sufficient | Paper is sufficient to carry the link, but a network is needed to use it |
| Privacy exposure | All data is in the QR and is readable by anyone who scans it | Only the link is in the QR; access can be gated |

In short: **use a DVC when the QR must be self-sufficient**, for example a paper
card presented at a rural clinic, a border post with intermittent connectivity,
or an infant's home-based record. **Use a VHL when the content is larger than a
QR can hold, when it must be able to change after issue, or when the holder
should control how much is disclosed.**

A deployment may legitimately issue both for the same person: a DVC for the
dose that must be provable offline, and a VHL pointing at the full record.

##### 2.3 Choosing between a generic DVC and the ICVP

The [ICVP](https://smart.who.int/icvp) is the digital counterpart of the
"Yellow Book" — the International Certificate of Vaccination or Prophylaxis
under the International Health Regulations. Its scope is deliberately narrow:
the vaccinations and prophylaxis that may be *required as a condition of entry*,
principally yellow fever.

The generic DVC is for everything else: routine childhood immunization, national
schedule doses, catch-up campaigns. A Hepatitis B birth dose or a BCG dose is
not an ICVP matter at all, so it belongs in a DVC. Pick the ICVP only when the
certificate's purpose is to satisfy an IHR entry requirement.

##### 2.4 Decision summary

```
Is the certificate proving an IHR entry requirement (e.g. yellow fever)?
   ├── yes ──▶ ICVP trust domain
   └── no
        │
        Does the content fit in a QR and have to verify with no network?
           ├── yes ──▶ DVC payload, hcert subclaim -6   (DVCMin / DVCMinPreQual)
           └── no  ──▶ VHL URI,     hcert subclaim 5
```

COVID-19 vaccination and test results predate this split and have their own
assigned subclaims (`3` and `4`) under the `DDCC` trust domain.

#### 3. Step 2 — Assemble the payload

Populate the logical model you selected. The DVC payload uses short element
names because every byte is paid for twice: once in the CBOR encoding and again
in the QR's module count.

For [DVCMin](http://smart.who.int/trust-phw/StructureDefinition-DVCMin.html):

| Element | Card. | Meaning |
|---------|-------|---------|
| `n` | 1..1 | Legal name of the patient, first and last |
| `dob` | 1..1 | Date of birth |
| `s` | 1..1 | Sex |
| `nt` | 1..1 | Nationality, ISO 3166-1 alpha-3 |
| `id` | 0..1 | National identification document number |
| `dt` | 0..1 | National ID document type |
| `gn` | 0..1 | Parent or guardian name |
| `vx` | 1..1 | Vaccine details |
| `v` | 1..1 | Version of the certificate template |

and within `vx`
([DVCMinVaccineDetails](http://smart.who.int/trust-phw/StructureDefinition-DVCMinVaccineDetails.html)):

| Element | Card. | Meaning |
|---------|-------|---------|
| `vp` | 1..1 | Vaccine product identifier |
| `dv` | 1..1 | Date of vaccination |
| `cn` | 0..1 | Name of the supervising clinician |
| `is` | 0..1 | Identifier of the issuing organization |
| `bo` | 1..1 | Batch or lot number |

Three constraints are easy to miss:

* `vx` is **1..1**. One DVC documents one immunization event. A visit at which
  two vaccines are administered produces two certificates and two QR codes.
* At least one of `is` or `cn` **must** be present — this is the
  `must-have-issuer-or-clinician-name` invariant.
* `id` is optional precisely because many certificate subjects have no
  identification document. A newborn is the obvious case; `gn` carries the
  parent or guardian instead.

For `vp`, the profile decides the terminology.
[DVCMinPreQual](http://smart.who.int/trust-phw/StructureDefinition-DVCMinPreQual.html)
binds `vp` to the WHO PreQual product identifiers (required binding), so a
conformant PreQual implementation must resolve the administered product in the
PreQual vaccine database and use that identifier. The unconstrained `DVCMin`
leaves the binding open; the worked example below uses ICD-11 codes from the
[DVC - Vaccines value set](http://smart.who.int/trust-phw/ValueSet-DVCVaccines.html).

#### 4. Step 3 — Build the CWT claim set

Place the payload under its subclaim, inside the `hcert` claim, inside a
[CWT claim set](StructureDefinition-CWTPayload.html):

| Claim key | Name | Notes |
|-----------|------|-------|
| `1` | `iss` | Issuer. Optionally the ISO 3166-1 alpha-2 code of the issuing country |
| `6` | `iat` | Issued At, integer NumericDate. MUST NOT predate the DSC validity period |
| `4` | `exp` | Expiration Time, integer NumericDate. MUST NOT exceed the DSC validity period |
| `-260` | `hcert` | Map whose single key is the subclaim chosen in Step 1 |

`exp` is the only revocation mechanism this specification offers: certificates
cannot be reliably revoked once issued, so the validity period must be chosen to
bound the damage from a compromised key, balanced against the holder's ability
to come back for a reissue. See
[section 6.1](hcert_spec.html#61-hcert-signature-validity-time).

#### 5. Step 4 — Serialise as CBOR

Encode the claim set as CBOR ([RFC 7049](https://tools.ietf.org/html/rfc7049)).
The JSON shown throughout this page and in the logical models is schema
notation only — **the wire format is CBOR**, and an implementation need never
produce the JSON form at all.

Strings SHOULD be NFC-normalised. Decoders SHOULD be permissive about input that
is not.

#### 6. Step 5 — Sign as a COSE_Sign1

Wrap the CBOR payload in a single-signer COSE structure
([RFC 8152](https://tools.ietf.org/html/rfc8152)), CBOR tag `18`.

**Protected header**

| Label | Name | Value |
|-------|------|-------|
| `1` | `alg` | `-7` for ES256 (primary) or `-37` for PS256 (secondary) |
| `4` | `kid` | Key identifier of the Document Signing Certificate |

Both algorithms MUST be implemented, even though only one is used to sign any
given certificate; the secondary exists so that a break in the primary does not
strand the whole network. `kid` MAY instead sit in the unprotected header, and
verifiers MUST accept both placements — but when it appears in both, the
protected one wins.

**Deriving the `kid`**: take the DER encoding of the DSC and use the **first 8
bytes of its SHA-256 fingerprint**. Because it is truncated, `kid` is not
unique, so a verifier that finds several DSCs with the same `kid` MUST try all
of them. `kid` is not security-critical; it is a lookup hint.

**Computing the signature**: build the `Sig_structure`

```
Sig_structure = [ "Signature1", protected_header_bstr, external_aad (empty), payload ]
```

serialise it as CBOR, and sign those bytes. For ES256 the COSE signature value
is the fixed-width concatenation `r || s`, 32 bytes each — **not** the ASN.1 DER
encoding that most crypto libraries return by default. Converting between the
two is the single most common interoperability bug in HCERT implementations.

The resulting structure is `18([protected, unprotected, payload, signature])`.

#### 7. Step 6 — Compress

Compress the COSE structure with ZLIB
([RFC 1950](https://tools.ietf.org/html/rfc1950)) using Deflate
([RFC 1951](https://tools.ietf.org/html/rfc1951)). Compression comes *after*
signing, so the verifier decompresses before it verifies.

#### 8. Step 7 — Encode as Base45

Encode the compressed bytes with
[Base45](https://datatracker.ietf.org/doc/draft-faltstrom-base45). Base45 exists
for one reason: its 45-character alphabet is exactly the QR Alphanumeric
character set, which stores data far more densely than byte mode.

#### 9. Step 8 — Prefix the context identifier

Prefix the Base45 string with `HC1:`. Verifiers use this to recognise what they
have scanned and which decoding scheme to apply. A future
backwards-incompatible revision will use a new identifier, incrementing through
`[1-9]` and then `[A-Z]`.

#### 10. Step 9 — Render the QR code

| Property | Requirement |
|----------|-------------|
| Symbology | QR Code, ISO/IEC 18004:2015 — SHALL |
| Encoding mode | Alphanumeric (Mode 2, symbols `0010`) — MUST, in conjunction with Base45 |
| Error correction | Level `Q`, approximately 25% — RECOMMENDED |
| Rendered size | 35 mm to 60 mm diagonal — RECOMMENDED |

If you are printing below 300 dpi, make sure each module is rendered as an exact
square. Non-proportional scaling turns modules into rectangles and is a frequent
cause of certificates that scan on screen but not on paper.

#### 11. Verifying: the same steps upwards

1. Confirm the `HC1:` prefix and strip it.
2. Base45-decode, then ZLIB-decompress.
3. Parse the COSE_Sign1 and read `alg` and `kid` from the protected header.
4. **Validate the input before trusting it.** Parsing the protected header
   necessarily happens before signature verification, which makes it an attack
   surface; check types and lengths defensively. See
   [section 6.3](hcert_spec.html#63-input-data-validation).
5. Look the `kid` up on the trust list, retrieving every DSC that matches.
6. Rebuild the `Sig_structure` and verify the signature against each candidate
   DSC until one succeeds. **Verify the signature before processing the
   payload.**
7. If the DSC carries an Extended Key Usage extension, check it against the
   certificate type —  OID `1.3.6.1.4.1.1847.2021.1.1` for test,
   `1.3.6.1.4.1.1847.2021.1.2` for vaccinations, `1.3.6.1.4.1.1847.2021.1.3` for
   recovery. A DSC with no such extension may verify any HCERT type.
8. Decode the CBOR payload and check `exp` and `iat` against the current time.
9. Read the `hcert` claim, dispatch on the subclaim to the right logical model,
   and only then apply business rules.

#### 12. Worked example — a newborn birth dose DVC

The following example is generated by the reference script in section 13, and
every figure quoted here is taken from its output.

##### 12.1 Scenario

A family from the Lao People's Democratic Republic is visiting relatives abroad
when the mother delivers. The newborn receives the routine birth-dose
vaccinations of the **host country's** national childhood immunization schedule
before discharge. The clinic records the doses and issues a signed certificate;
the family has one shared phone between them, so the clinic prints a paper card
with the QR code and offers digital delivery as an option.

This drives the design decisions directly:

* **DVC, not ICVP.** Hepatitis B and BCG are routine schedule vaccines, not IHR
  entry requirements, so the generic DVC is the correct instrument and the
  Yellow Book ICVP is not.
* **DVC, not VHL.** The certificate has to verify at a rural clinic back home
  with no reliable connectivity, and on paper. The data must be *in* the QR.
* **Two certificates.** `vx` is 1..1, so the birth visit yields one certificate
  per vaccine.
* **No `id`, but a `gn`.** The newborn has no identification document. The
  guardian element carries the mother's name instead.
* **Nationality and issuer differ.** `nt` is the infant's nationality (`LAO`);
  the issuer is the country whose clinic administered the dose. This separation
  is exactly what the model is for.

##### 12.2 Host-country schedule

Thailand's Expanded Programme on Immunization gives two vaccines at birth: **BCG
as soon as possible after birth**, and the **first dose of hepatitis B vaccine
within 24 hours of birth**. The DTP-HepB and OPV series begin later, at 2, 4 and
6 months. A birth visit in Thailand therefore produces exactly the two
certificates modelled here.

Implementers should confirm the current schedule against the national authority
before relying on it; schedules are revised.

##### 12.3 Test issuer

The example is issued by the GDHCN **test participant `XXA`**, not by any Member
State. GDHCN participant codes are ISO 3166-1 alpha-3, while the CWT `iss` claim
and the X.509 country attribute take the alpha-2 form, here the user-assigned
code `XX`.

The signing keys are throw-away test keys generated deterministically by the
script. They appear on no trust list, and nothing signed with them verifies
anywhere. In a real deployment `iss` would be the issuing country and the DSC
would be one published by that country and aggregated by the GDHCN Secretariat.

##### 12.4 The payload

Hepatitis B birth dose, `hcert` subclaim `-6`, shown in JSON notation:

```json
{
  "n":   "Chanthala SOUVANNALATH",
  "dob": "2026-09-28",
  "s":   "female",
  "nt":  "LAO",
  "gn":  "Mali SOUVANNALATH",
  "vx": {
    "vp": "XM9V38",
    "dv": "2026-09-28",
    "cn": "Dr Pimchanok WATTANA",
    "is": "org-xxa-provincial-hospital",
    "bo": "HEPB-2026-0914"
  },
  "v": "1.0.0"
}
```

`vp` is ICD-11 `XM9V38` *Hepatitis B, purified antigen*; the BCG certificate uses
`XM8142` *Tuberculosis, live attenuated vaccines*. Both are in the
[DVC - Vaccines value set](http://smart.who.int/trust-phw/ValueSet-DVCVaccines.html).
An implementation conforming to `DVCMinPreQual` would instead carry the WHO
PreQual product identifier of the specific product administered.

Wrapped in the CWT claim set:

```json
{
  "1":    "XX",
  "6":    1790670600,
  "4":    1822206600,
  "-260": { "-6": { "...": "the payload above" } }
}
```

##### 12.5 Size at each stage

| Stage | Size |
|-------|------|
| CWT claim set, CBOR | 210 bytes |
| COSE_Sign1, signed | 295 bytes |
| ZLIB/Deflate compressed | 282 bytes |
| Base45 + `HC1:` prefix | 427 characters |
| QR symbol | Version 16, error correction `Q`, Alphanumeric mode |

The signature and its headers account for 85 of the 295 bytes — on payloads this
small, the cryptography costs more than the clinical data. This is why the
minimal models use two-character element names, and why a payload that grows
much beyond this belongs behind a VHL instead.

##### 12.6 The certificate

Hepatitis B birth dose:

<div style="display:block">
  <img src="dvc-qr-example-hepb1-XXA.png" alt="Sample DVC QR code, Hepatitis B birth dose, test participant XXA" width="300" />
</div>

```
HC1:NCFOXN%TSMAHN-HWM4/GR3.M: AQSSGAH9M91RIHF4NZKC7TFSTYUIBRR34Q-MPD ND%ERJC/HJI+8H-BI+8F.9HJ8 4GFDJ38KLUKAQC419%EEGJB/.D4-9MJCVPLW1KD0K9JAF/BT3EQ*9%NH7$K MI..3EEWVPMD+K$F91EF+:L*.9G%8M+8CNNE1J $47LPNV4YW8490-LN258VUUZX2LV34G8-:V4SI5SPDDK2XEPS5OH6CN5MZUCRQPK50F2TK1AVU%J6WLITK22VE TUVI13M9LREHOPJPQJVFKWOBY5PRALTIHR6L47CX53OVK682Y7IKUQK3.$AP.CE.CG%DAWCD8SSCH3ME6OHG5MNRH.8LTOT06Q/.F4KL4-GSP66G1%WR/+BG2M6ARB84I*2-J5-7J$*0XFSLLD
```

BCG, the second certificate from the same visit:

<div style="display:block">
  <img src="dvc-qr-example-bcg-XXA.png" alt="Sample DVC QR code, BCG birth dose, test participant XXA" width="300" />
</div>

```
HC1:NCFOXN%TSMAHN-HWM4/GR3.M: AQSSZBH9M91RIHF4NZKC7TFSTYUIBRR34Q-MPD ND%ERJC/HJI+8H-BI+8F.9HJ8 4GFDJ38KLUKAQC419%EEGJB/.D4-9MJCVPLW1KD0K9JAF/BT3EQ*9%NH7$K MI..3EEWVPMD+K$F98JN97QVONVZ0I:C:Y0P8TYE98EFA%5-B1NJJ+JP:N3ZSMDOOSM8-T3PR3:KAFNM2LHX%EPS5OH6CN5MZUCRQPK50F2TK1AVU%J6WLITK22VE TUVI13M9LREHOPJPQJVF:O1VYHPRALTIHR6B67CVAYSUNOA*IF.W6R B1Z39$7HT08TD/ ERK1M8SWHPS HDYD%7IB70AYQ6-SSPNIPFEF19*NCR6/6EU0GB$RMWVO*AISB8TL7ZVV50$:D4KD
```

The `kid` for both is `WHM+BYqqZiE=` (hex `58733e058aaa6621`).

The test DSC and the test SCA that signed it are published alongside the images
as `dvc-qr-example-XXA-dsc.pem`, so that a verifier implementation can be
exercised against this example end to end. A machine-readable summary of both
certificates, including the payloads and the full `HC1:` strings, is in
`dvc-qr-example-XXA.json`.

#### 13. Reference script

`input/scripts/generate_dvc_qr.py` in this guide's source repository implements
every step on this page and regenerates the example above byte for byte:

```
pip install cbor2 base45 qrcode pillow cryptography
python3 input/scripts/generate_dvc_qr.py --out-dir input/images
```

The script builds the test SCA and DSC, derives the `kid`, assembles both DVC
payloads, signs, compresses, encodes and renders — and then decodes its own
output and verifies the signature, so a failed run is a failed round trip rather
than a silently broken certificate. It is a documentation aid, not a production
issuer: it uses fixed test keys in source, and a real issuer holds its private
keys in an HSM. See
[section 6.2](hcert_spec.html#62-key-management) and the
[Reference Implementations](reference_implementation.html).
