# Certificate Conformance Testing via the Interoperability Test Bed (ITB) during the GDHCN GH action driven Onboarding Process

Sequence diagram showing a GDHCN Part (Trust Network Part, TNP) sending
generated certificates to the [Interoperability Test Bed (ITB)](https://interoperable-europe.ec.europa.eu/collection/interoperability-test-bed-repository/solution/interoperability-test-bed)
during the onboarding process, with the ITB validating the certificates and reporting
results back to both the onboarding process and the participant.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#00ffee', 'actorBkg': '#5c8eb49e', 'signalColor': '#2580c5', 'background':'#ffffff', 'mainBkg': '#ffffff', 'textcolor':'#f1eaea'}}}%%
sequenceDiagram
    autonumber
    participant Part as GDHCN Participant (TNP)
    participant Sig as GDHCN Signer<br/>(automated/WHO representative)
    participant Onboarding as GitHub Action<br/>(automated) driven by <br/> GDHCN Onboarding Process (OB/OPS)
    participant ITB as WHO Interoperability Test Bed (ITB)
    participant TNG as GDHCN Trust Network Gateway
   

    Part->>Part: Generate certificates (Upload, TLS, DSC)
    Part->>Onboarding: Notify readiness for conformance testing
    Onboarding->>Part: fetch certificate files from private repository ('onboarding bot')

    par GH Action Onboarding workflow 
        loop Every participant
            Onboarding->>Onboarding: Check participant's repo for latest tag/commits
            Onboarding->>Onboarding: Check participants repo for private keys
            Onboarding->>Onboarding: Check participant's certificates for correct structure, key usage, extensions, expiration
        end

        alt Onboarding Tests passed
            Onboarding->>Onboarding: Pull request generated (by GH Bot user)
            Sig->>Onboarding: Sign UPLOAD, TLS, SCA

            Onboarding--)Part: GH Action reports success on signing)
            Onboarding-)Onboarding: Certificates are signed and prepared for uploading
            Onboarding-->>TNG: Whitelist TLS Thumbprint
            Onboarding-)Onboarding: keysync uploads signed certificates to TNG
        else Onboarding Tests failed
            Onboarding-->>Part: GH Action reports failures, request corrections
            Part->>Part: Regenerate/fix certificats
            Onboarding->>Onboarding: Onboarding bot re-reads from private repository, re-runs tests
        end
    and ITB conformance testing
        Onboarding->>ITB: Submit generated certificates for testing
        ITB->>ITB: Validate certificate structure,<br/>key usage & extensions
        ITB->>ITB: Execute conformance test suite
        ITB-->>Part: Send test report (pass/fail + details)
        ITB-->>Onboarding: Report test results
        alt Tests passed
            Onboarding->>Onboarding: Mark certificates as verified
            Onboarding->>TNG: Proceed with certificate whitelisting
            Onboarding-->>Part: Confirm acceptance, onboarding continues
        else Tests failed
            Onboarding-->>Part: Notify failures, request corrections
            Part->>Part: Regenerate/fix certificates
            Part->>ITB: Resubmit certificates for re-testing
        end
    end
```
