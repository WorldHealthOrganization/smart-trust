#!/usr/bin/env python3
"""Generate a signed DVC HCERT QR code for the WHO SMART Trust test scenario.

This reproduces, end to end, the pipeline documented in
input/pagecontent/qr_code_generation.md:

    DVC payload -> HCERT claim -> CWT -> CBOR -> COSE_Sign1 -> zlib -> Base45
                -> "HC1:" prefix -> QR

The scenario is the newborn birth-dose example: a Lao infant born while the
family is visiting Thailand receives the Hepatitis B birth dose and BCG under
the host country's routine childhood immunization schedule, and the clinic
issues a generic Digital Vaccine Certificate (DVC) for each dose.

Everything here is TEST DATA. The signing keys are derived from fixed, public
scalars that are hard-coded below so that the artefacts are byte-for-byte
reproducible. They carry no trust whatsoever, they are not on any GDHCN trust
list, and they MUST NOT be used for anything but testing. Certificates are
issued for the user-assigned ISO 3166-1 code XXA, which is the GDHCN test
participant, not for a real Member State.

Usage:
    pip install cbor2 base45 qrcode pillow cryptography
    python3 input/scripts/generate_dvc_qr.py [--out-dir input/images]
"""

import argparse
import datetime
import hashlib
import json
import pathlib
import zlib

import base45
import cbor2
import qrcode
import qrcode.constants
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, utils as asym_utils
from cryptography.x509.oid import NameOID

# --------------------------------------------------------------------------
# Constants from the HCERT specification and the trust IG logical models
# --------------------------------------------------------------------------

CONTEXT_IDENTIFIER = "HC1:"

CWT_CLAIM_ISS = 1  # Issuer
CWT_CLAIM_EXP = 4  # Expiration Time
CWT_CLAIM_IAT = 6  # Issued At
CWT_CLAIM_HCERT = -260  # Health Certificate

HCERT_SUBCLAIM_DVC_MIN = -6  # DVCMin, per StructureDefinition-HCert

COSE_HEADER_ALG = 1
COSE_HEADER_KID = 4
COSE_ALG_ES256 = -7
COSE_SIGN1_TAG = 18

# Extended key usage identifiers from HCERT spec Appendix A.2
EKU_VACCINATIONS = "1.3.6.1.4.1.1847.2021.1.2"

# Test participant. GDHCN participant codes are ISO 3166-1 alpha-3 (XXA is the
# user-assigned test locality), while the CWT `iss` claim and the X.509 country
# attribute both take the alpha-2 form, here the user-assigned code XX.
TEST_PARTICIPANT = "XXA"
TEST_COUNTRY_ALPHA2 = "XX"

# Fixed private scalars so that every run produces identical artefacts.
# PUBLIC TEST VALUES - NOT SECRET, NOT TRUSTED, NOT FOR PRODUCTION USE.
SCA_PRIVATE_SCALAR = 0x00C0FFEE00C0FFEE00C0FFEE00C0FFEE00C0FFEE00C0FFEE00C0FFEE00C0FF01
DSC_PRIVATE_SCALAR = 0x00DECAFBAD00DECAFBAD00DECAFBAD00DECAFBAD00DECAFBAD00DECAFBAD0002

# Scenario timestamps, fixed for reproducibility.
BIRTH_DATE = "2026-09-28"
ISSUED_AT = datetime.datetime(2026, 9, 29, 8, 30, tzinfo=datetime.timezone.utc)
EXPIRES_AT = datetime.datetime(2027, 9, 29, 8, 30, tzinfo=datetime.timezone.utc)
CERT_NOT_BEFORE = datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc)
CERT_NOT_AFTER = datetime.datetime(2028, 1, 1, tzinfo=datetime.timezone.utc)


# --------------------------------------------------------------------------
# Step 0: the DVC payloads (DVCMin logical model)
# --------------------------------------------------------------------------

def dvc_payloads():
    """Return the two birth-dose DVCMin payloads for the scenario.

    Element names are the short keys of the DVCMin and DVCMinVaccineDetails
    logical models in the trust-phw IG. `vx` is 1..1, so one DVC carries
    exactly one immunization event: the birth visit yields two certificates.

    `vp` carries ICD-11 codes from the DVC - Vaccines value set. An
    implementation conforming to DVCMinPreQual MUST instead put a WHO PreQual
    product ID here, looked up in the PreQual vaccine database.
    """
    subject = {
        "n": "Chanthala SOUVANNALATH",  # legal name, first and last
        "dob": BIRTH_DATE,
        "s": "female",
        "nt": "LAO",  # nationality, ISO 3166-1 alpha-3
        # `id`/`dt` omitted: a newborn has no national ID document yet.
        "gn": "Mali SOUVANNALATH",  # parent or guardian
        "v": "1.0.0",  # certificate template version
    }
    hepb = dict(subject)
    hepb["vx"] = {
        "vp": "XM9V38",  # Hepatitis B, purified antigen
        "dv": BIRTH_DATE,  # birth dose, within 24h of birth
        "cn": "Dr Pimchanok WATTANA",
        "is": "org-xxa-provincial-hospital",
        "bo": "HEPB-2026-0914",
    }
    bcg = dict(subject)
    bcg["vx"] = {
        "vp": "XM8142",  # Tuberculosis, live attenuated vaccines (BCG)
        "dv": BIRTH_DATE,
        "cn": "Dr Pimchanok WATTANA",
        "is": "org-xxa-provincial-hospital",
        "bo": "BCG-2026-0477",
    }
    return {"hepb1": hepb, "bcg": bcg}


# --------------------------------------------------------------------------
# Test PKI: SCA -> DSC, and the kid derivation
# --------------------------------------------------------------------------

def build_test_pki():
    """Build a deterministic test SCA and the DSC it signs."""
    sca_key = ec.derive_private_key(SCA_PRIVATE_SCALAR, ec.SECP256R1())
    dsc_key = ec.derive_private_key(DSC_PRIVATE_SCALAR, ec.SECP256R1())

    sca_name = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, TEST_COUNTRY_ALPHA2),
        x509.NameAttribute(
            NameOID.ORGANIZATION_NAME, f"GDHCN Test Participant {TEST_PARTICIPANT}"
        ),
        x509.NameAttribute(NameOID.COMMON_NAME, f"{TEST_PARTICIPANT} Health SCA TEST"),
    ])
    dsc_name = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, TEST_COUNTRY_ALPHA2),
        x509.NameAttribute(
            NameOID.ORGANIZATION_NAME, f"GDHCN Test Participant {TEST_PARTICIPANT}"
        ),
        x509.NameAttribute(NameOID.COMMON_NAME, f"{TEST_PARTICIPANT} DVC DSC TEST 01"),
    ])

    sca_ski = x509.SubjectKeyIdentifier.from_public_key(sca_key.public_key())
    sca_cert = (
        x509.CertificateBuilder()
        .subject_name(sca_name)
        .issuer_name(sca_name)
        .public_key(sca_key.public_key())
        .serial_number(0x5CA7E57)
        .not_valid_before(CERT_NOT_BEFORE)
        .not_valid_after(CERT_NOT_AFTER)
        .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
        .add_extension(sca_ski, critical=False)
        .add_extension(
            x509.KeyUsage(
                digital_signature=False, content_commitment=False,
                key_encipherment=False, data_encipherment=False,
                key_agreement=False, key_cert_sign=True, crl_sign=True,
                encipher_only=False, decipher_only=False,
            ),
            critical=True,
        )
        .sign(sca_key, hashes.SHA256())
    )

    dsc_cert = (
        x509.CertificateBuilder()
        .subject_name(dsc_name)
        .issuer_name(sca_cert.subject)
        .public_key(dsc_key.public_key())
        .serial_number(0xD5C0001)
        .not_valid_before(CERT_NOT_BEFORE)
        .not_valid_after(CERT_NOT_AFTER)
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(
            x509.SubjectKeyIdentifier.from_public_key(dsc_key.public_key()),
            critical=False,
        )
        .add_extension(
            x509.AuthorityKeyIdentifier.from_issuer_subject_key_identifier(sca_ski),
            critical=False,
        )
        .add_extension(
            x509.KeyUsage(
                digital_signature=True, content_commitment=False,
                key_encipherment=False, data_encipherment=False,
                key_agreement=False, key_cert_sign=False, crl_sign=False,
                encipher_only=False, decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(
            x509.ExtendedKeyUsage([x509.ObjectIdentifier(EKU_VACCINATIONS)]),
            critical=False,
        )
        .sign(sca_key, hashes.SHA256())
    )
    return sca_cert, dsc_key, dsc_cert


def derive_kid(dsc_cert):
    """kid = first 8 bytes of the SHA-256 fingerprint of the DER-encoded DSC."""
    der = dsc_cert.public_bytes(serialization.Encoding.DER)
    return hashlib.sha256(der).digest()[:8]


# --------------------------------------------------------------------------
# Steps 1-7 of the pipeline
# --------------------------------------------------------------------------

def build_cwt(dvc_payload):
    """Step 1-2: wrap the DVC payload in an HCERT claim inside a CWT."""
    return {
        CWT_CLAIM_ISS: TEST_COUNTRY_ALPHA2,
        CWT_CLAIM_IAT: int(ISSUED_AT.timestamp()),
        CWT_CLAIM_EXP: int(EXPIRES_AT.timestamp()),
        CWT_CLAIM_HCERT: {HCERT_SUBCLAIM_DVC_MIN: dvc_payload},
    }


def sign_cose_sign1(cwt, dsc_key, kid):
    """Step 3-4: CBOR-encode the CWT and wrap it in a signed COSE_Sign1."""
    payload = cbor2.dumps(cwt, canonical=True)
    protected = cbor2.dumps(
        {COSE_HEADER_ALG: COSE_ALG_ES256, COSE_HEADER_KID: kid}, canonical=True
    )

    # RFC 8152 section 4.4: Sig_structure for a COSE_Sign1.
    sig_structure = cbor2.dumps(["Signature1", protected, b"", payload])
    der_sig = dsc_key.sign(sig_structure, ec.ECDSA(hashes.SHA256()))

    # COSE wants the fixed-width r||s form, not the ASN.1 DER form.
    r, s = asym_utils.decode_dss_signature(der_sig)
    signature = r.to_bytes(32, "big") + s.to_bytes(32, "big")

    return cbor2.dumps(
        cbor2.CBORTag(COSE_SIGN1_TAG, [protected, {}, payload, signature])
    )


def to_hc1(cose_bytes):
    """Step 5-7: zlib-deflate, Base45-encode, prefix with the context id."""
    compressed = zlib.compress(cose_bytes, 9)
    return CONTEXT_IDENTIFIER + base45.b45encode(compressed).decode("ascii")


def render_qr(hc1_string, path):
    """Step 8: render a QR with error correction level Q, as RECOMMENDED."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_Q,
        box_size=8,
        border=4,
    )
    qr.add_data(hc1_string)
    qr.make(fit=True)
    qr.make_image(fill_color="black", back_color="white").save(path)
    return qr.version


# --------------------------------------------------------------------------
# Verification: the same steps in reverse
# --------------------------------------------------------------------------

def verify(hc1_string, dsc_cert):
    """Decode an HC1 string and verify the signature with the DSC public key."""
    assert hc1_string.startswith(CONTEXT_IDENTIFIER), "missing HC1: prefix"
    cose_bytes = zlib.decompress(
        base45.b45decode(hc1_string[len(CONTEXT_IDENTIFIER):])
    )

    tagged = cbor2.loads(cose_bytes)
    assert isinstance(tagged, cbor2.CBORTag) and tagged.tag == COSE_SIGN1_TAG
    protected_bytes, _unprotected, payload, signature = tagged.value

    protected = cbor2.loads(protected_bytes)
    assert protected[COSE_HEADER_ALG] == COSE_ALG_ES256
    assert protected[COSE_HEADER_KID] == derive_kid(dsc_cert), "kid mismatch"

    sig_structure = cbor2.dumps(["Signature1", protected_bytes, b"", payload])
    r = int.from_bytes(signature[:32], "big")
    s = int.from_bytes(signature[32:], "big")
    dsc_cert.public_key().verify(
        asym_utils.encode_dss_signature(r, s),
        sig_structure,
        ec.ECDSA(hashes.SHA256()),
    )
    return cbor2.loads(payload)


# --------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out-dir",
        default="input/images",
        help="directory for the generated QR images (default: input/images)",
    )
    args = parser.parse_args()
    out_dir = pathlib.Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    sca_cert, dsc_key, dsc_cert = build_test_pki()
    kid = derive_kid(dsc_cert)

    summary = {
        "disclaimer": (
            f"TEST DATA ONLY. Issued for GDHCN test participant {TEST_PARTICIPANT} "
            f"(iss={TEST_COUNTRY_ALPHA2}) with throw-away keys on no trust list."
        ),
        "kid_base64": __import__("base64").b64encode(kid).decode(),
        "kid_hex": kid.hex(),
        "certificates": {},
    }

    for name, payload in dvc_payloads().items():
        cwt = build_cwt(payload)
        cose_bytes = sign_cose_sign1(cwt, dsc_key, kid)
        hc1 = to_hc1(cose_bytes)

        qr_path = out_dir / f"dvc-qr-example-{name}-XXA.png"
        version = render_qr(hc1, qr_path)

        decoded = verify(hc1, dsc_cert)
        assert decoded == cwt, "round-trip mismatch"

        summary["certificates"][name] = {
            "hcert_subclaim": HCERT_SUBCLAIM_DVC_MIN,
            "logical_model": "DVCMin",
            "cwt_cbor_bytes": len(cbor2.dumps(cwt, canonical=True)),
            "cose_sign1_bytes": len(cose_bytes),
            "deflated_bytes": len(zlib.compress(cose_bytes, 9)),
            "hc1_chars": len(hc1),
            "qr_version": version,
            "qr_image": str(qr_path),
            "hc1": hc1,
            "payload": payload,
        }
        print(f"{name}: {len(hc1)} chars, QR version {version} -> {qr_path}")

    (out_dir / "dvc-qr-example-XXA.json").write_text(
        json.dumps(summary, indent=2, sort_keys=False) + "\n"
    )
    (out_dir / "dvc-qr-example-XXA-dsc.pem").write_text(
        dsc_cert.public_bytes(serialization.Encoding.PEM).decode()
        + sca_cert.public_bytes(serialization.Encoding.PEM).decode()
    )
    print(f"kid: {summary['kid_base64']} (hex {kid.hex()})")
    print("signature verified for every generated certificate")


if __name__ == "__main__":
    main()
