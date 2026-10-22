#!/usr/bin/env python3
"""Generate a signed DVC HCERT QR code for the WHO SMART Trust example.

This reproduces, end to end, the pipeline documented in
input/pagecontent/qr_code_generation.md:

    DVC payload -> HCERT claim -> CWT -> CBOR -> COSE_Sign1 -> zlib -> Base45
                -> "HC1:" prefix -> QR

The scenario is the newborn birth-dose example: a Lao infant born while the
family is visiting Thailand receives the Hepatitis B birth dose and BCG under
the host country's routine childhood immunization schedule, and the clinic
issues a Digital Vaccine Certificate (DVC) for each dose.

This script holds no key material. The signing key, the Document Signing
Certificate and the Signer Certificate Authority are supplied by the
environment, and the key identifier is derived from the supplied DSC, so the
script can only ever issue under an identity that has been onboarded to the
GDHCN trust network. It refuses to run without one.

The payloads conform to DVCMinPreQual, whose `vp` element has a required
binding to the WHO PreQual product identifiers. Those identifiers are required
arguments for the same reason: the script must not be able to emit a payload
that silently violates the binding.

Usage:
    pip install cbor2 base45 qrcode pillow cryptography

    export GDHCN_SIGNING_KEY_PEM="$(cat signing-key.pem)"
    export GDHCN_DSC_PEM="$(cat dsc.pem)"
    export GDHCN_SCA_PEM="$(cat sca.pem)"

    python3 input/scripts/generate_dvc_qr.py \
        --prequal-id-hepb a3K3X000006MiiXUAS \
        --prequal-id-bcg a3K3X000006MiiCUAS \
        --out-dir input/images

Equivalently, pass --key, --dsc and --sca as file paths.

Note that ECDSA signatures are randomized: two runs over identical input
produce different signature bytes and therefore different "HC1:" strings. The
committed JSON and PEM are the reference, not a re-run.
"""

import argparse
import base64
import datetime
import hashlib
import json
import os
import pathlib
import sys
import zlib

import base45
import cbor2
import qrcode
import qrcode.constants
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, utils as asym_utils

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

# GDHCN DEV participant. Participant codes are ISO 3166-1 alpha-3; the CWT
# `iss` claim takes the alpha-2 form, which must match the country attribute
# of the DSC subject (C=XR on the onboarded DEV certificate).
PARTICIPANT = "XXR"
ISS_ALPHA2 = "XR"

# Scenario dates, fixed so that reruns differ only by signature. `iat` must
# fall inside the DSC validity period and `exp` must not exceed it, so these
# sit after the onboarded DEV DSC became valid.
BIRTH_DATE = "2026-10-21"
ISSUED_AT = datetime.datetime(2026, 10, 22, 8, 30, tzinfo=datetime.timezone.utc)
EXPIRES_AT = datetime.datetime(2027, 10, 22, 8, 30, tzinfo=datetime.timezone.utc)


# --------------------------------------------------------------------------
# Signing identity, supplied by the environment
# --------------------------------------------------------------------------

def _load_pem(env_var, path, what):
    """Return PEM bytes from a file path if given, else from the environment."""
    if path:
        return pathlib.Path(path).read_bytes()
    value = os.environ.get(env_var)
    if not value:
        sys.exit(
            f"error: no {what} supplied.\n"
            f"  Set {env_var} to the PEM contents, or pass the matching file "
            f"path argument.\n"
            f"  This script does not generate key material: the public key must "
            f"be onboarded to the GDHCN trust network."
        )
    return value.encode()


def load_identity(args):
    """Load the signing key, the DSC and the SCA, and sanity-check them."""
    key = serialization.load_pem_private_key(
        _load_pem("GDHCN_SIGNING_KEY_PEM", args.key, "signing key"),
        password=None,
    )
    dsc = x509.load_pem_x509_certificate(
        _load_pem("GDHCN_DSC_PEM", args.dsc, "document signing certificate")
    )
    sca = x509.load_pem_x509_certificate(
        _load_pem("GDHCN_SCA_PEM", args.sca, "signer certificate authority")
    )

    if not isinstance(key, ec.EllipticCurvePrivateKey):
        sys.exit("error: signing key is not an EC key; ES256 requires EC P-256.")
    if not isinstance(key.curve, ec.SECP256R1):
        sys.exit(f"error: signing key curve is {key.curve.name}, expected secp256r1.")
    if key.public_key().public_numbers() != dsc.public_key().public_numbers():
        sys.exit("error: the signing key does not match the public key in the DSC.")

    now = datetime.datetime.now(datetime.timezone.utc)
    if not (dsc.not_valid_before_utc <= now <= dsc.not_valid_after_utc):
        print(
            f"warning: the DSC is outside its validity period "
            f"({dsc.not_valid_before_utc:%Y-%m-%d} to "
            f"{dsc.not_valid_after_utc:%Y-%m-%d}).",
            file=sys.stderr,
        )
    if not (dsc.not_valid_before_utc <= ISSUED_AT <= dsc.not_valid_after_utc):
        sys.exit(
            "error: the scenario's `iat` falls outside the DSC validity period, "
            "which the HCERT specification forbids."
        )
    if EXPIRES_AT > dsc.not_valid_after_utc:
        sys.exit(
            "error: the scenario's `exp` exceeds the DSC validity period, "
            "which the HCERT specification forbids."
        )
    return key, dsc, sca


def derive_kid(dsc):
    """kid = first 8 bytes of the SHA-256 fingerprint of the DER-encoded DSC."""
    der = dsc.public_bytes(serialization.Encoding.DER)
    return hashlib.sha256(der).digest()[:8]


# --------------------------------------------------------------------------
# Step 2: the DVC payloads (DVCMinPreQual logical model)
# --------------------------------------------------------------------------

def dvc_payloads(prequal_id_hepb, prequal_id_bcg):
    """Return the two birth-dose payloads for the scenario.

    Element names are the short keys of DVCMinPreQual and
    DVCMinVaccineDetailsPreQual in the trust-phw IG. `vx` is 1..1, so one DVC
    carries exactly one immunization event: the birth visit yields two
    certificates. `vp` carries a WHO PreQual product identifier under the
    required binding.
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
    clinic = {
        "cn": "Dr Pimchanok WATTANA",
        "is": f"org-{PARTICIPANT.lower()}-provincial-hospital",
    }
    hepb = dict(subject)
    hepb["vx"] = {
        "vp": prequal_id_hepb,
        "dv": BIRTH_DATE,  # birth dose, within 24h of birth
        **clinic,
        "bo": "HEPB-2026-0914",
    }
    bcg = dict(subject)
    bcg["vx"] = {
        "vp": prequal_id_bcg,
        "dv": BIRTH_DATE,
        **clinic,
        "bo": "BCG-2026-0477",
    }
    return {"hepb1": hepb, "bcg": bcg}


# --------------------------------------------------------------------------
# Steps 3 to 9 of the pipeline
# --------------------------------------------------------------------------

def build_cwt(dvc_payload):
    """Step 3: wrap the DVC payload in an HCERT claim inside a CWT claim set."""
    return {
        CWT_CLAIM_ISS: ISS_ALPHA2,
        CWT_CLAIM_IAT: int(ISSUED_AT.timestamp()),
        CWT_CLAIM_EXP: int(EXPIRES_AT.timestamp()),
        CWT_CLAIM_HCERT: {HCERT_SUBCLAIM_DVC_MIN: dvc_payload},
    }


def sign_cose_sign1(cwt, key, kid):
    """Step 4-5: CBOR-encode the claim set and wrap it in a signed COSE_Sign1."""
    payload = cbor2.dumps(cwt, canonical=True)
    protected = cbor2.dumps(
        {COSE_HEADER_ALG: COSE_ALG_ES256, COSE_HEADER_KID: kid}, canonical=True
    )

    # RFC 8152 section 4.4: Sig_structure for a COSE_Sign1.
    sig_structure = cbor2.dumps(["Signature1", protected, b"", payload])
    der_sig = key.sign(sig_structure, ec.ECDSA(hashes.SHA256()))

    # COSE wants the fixed-width r||s form, not the ASN.1 DER form.
    r, s = asym_utils.decode_dss_signature(der_sig)
    signature = r.to_bytes(32, "big") + s.to_bytes(32, "big")

    return cbor2.dumps(
        cbor2.CBORTag(COSE_SIGN1_TAG, [protected, {}, payload, signature])
    )


def to_hc1(cose_bytes):
    """Step 6-8: zlib-deflate, Base45-encode, prefix with the context id."""
    compressed = zlib.compress(cose_bytes, 9)
    return CONTEXT_IDENTIFIER + base45.b45encode(compressed).decode("ascii")


def render_qr(hc1_string, path):
    """Step 9: render a QR with error correction level Q, as RECOMMENDED."""
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

def verify(hc1_string, dsc):
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
    assert protected[COSE_HEADER_KID] == derive_kid(dsc), "kid mismatch"

    sig_structure = cbor2.dumps(["Signature1", protected_bytes, b"", payload])
    r = int.from_bytes(signature[:32], "big")
    s = int.from_bytes(signature[32:], "big")
    dsc.public_key().verify(
        asym_utils.encode_dss_signature(r, s),
        sig_structure,
        ec.ECDSA(hashes.SHA256()),
    )
    return cbor2.loads(payload)


# --------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prequal-id-hepb", required=True,
                        help="WHO PreQual product ID of the hepatitis B product")
    parser.add_argument("--prequal-id-bcg", required=True,
                        help="WHO PreQual product ID of the BCG product")
    parser.add_argument("--key", help="signing key PEM (default: $GDHCN_SIGNING_KEY_PEM)")
    parser.add_argument("--dsc", help="DSC PEM (default: $GDHCN_DSC_PEM)")
    parser.add_argument("--sca", help="SCA PEM (default: $GDHCN_SCA_PEM)")
    parser.add_argument("--out-dir", default="input/images",
                        help="directory for the generated artefacts")
    args = parser.parse_args()

    out_dir = pathlib.Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    key, dsc, sca = load_identity(args)
    kid = derive_kid(dsc)

    summary = {
        "participant": PARTICIPANT,
        "environment": "GDHCN DEV",
        "iss": ISS_ALPHA2,
        "kid_base64": base64.b64encode(kid).decode(),
        "kid_hex": kid.hex(),
        "dsc_subject": dsc.subject.rfc4514_string(),
        "dsc_serial": hex(dsc.serial_number),
        "certificates": {},
    }

    payloads = dvc_payloads(args.prequal_id_hepb, args.prequal_id_bcg)
    for name, payload in payloads.items():
        cwt = build_cwt(payload)
        cose_bytes = sign_cose_sign1(cwt, key, kid)
        hc1 = to_hc1(cose_bytes)

        qr_path = out_dir / f"dvc-qr-example-{name}-{PARTICIPANT}.png"
        version = render_qr(hc1, qr_path)

        decoded = verify(hc1, dsc)
        assert decoded == cwt, "round-trip mismatch"

        summary["certificates"][name] = {
            "hcert_subclaim": HCERT_SUBCLAIM_DVC_MIN,
            "logical_model": "DVCMinPreQual",
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

    (out_dir / f"dvc-qr-example-{PARTICIPANT}.json").write_text(
        json.dumps(summary, indent=2, sort_keys=False) + "\n"
    )
    (out_dir / f"dvc-qr-example-{PARTICIPANT}-dsc.pem").write_text(
        dsc.public_bytes(serialization.Encoding.PEM).decode()
        + sca.public_bytes(serialization.Encoding.PEM).decode()
    )
    print(f"kid: {summary['kid_base64']} (hex {kid.hex()})")
    print("signature verified for every generated certificate")


if __name__ == "__main__":
    main()
