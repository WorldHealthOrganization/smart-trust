Onboarding Checklist

### Common Hints

See [Certificate Governance](concepts_certificate_governance.html)

**Note:** In the embedded image the following relabels apply:
* DCCG -> TNG
* CSCA -> SCA
* DCC -> GDHCN
* NB -> TNP


It is highly recommended:
- **to use certificates issued from a public CA which follows the CAB Forum Rules**
- **not to reuse any certificates across the different staging environments**

### Links to the Environments

- Development Environment (Unstable): https://tng-dev.who.int
- User Acceptance Test Environment: https://tng-uat.who.int
- Production Environment: https://tng.who.int

### User Acceptance Test Environment (UAT)

#### Transitive Trust

With the application as transitive trust participant, the key material is migrated from the DCCG to the TNG already.
The connection should be tested with the following command:

``` curl -v https://tng-uat.who.int/trustList --cert TLS.pem --key TLS_key.pem``` <br>

You should see a response like: <br>

```
[
{
    "kid": "+jrpHSqdqZY=",
    "timestamp": "2023-05-25T07:55:21Z",
    "country": "XC",
    "certificateType": "UPLOAD",
    "thumbprint": "fa3ae91d...",
    "signature": "MIAGCSqGSIb3D...",
    "rawData": "MIIErTCCA5WgAwIBAgII..."
}
]
```

The typed [Trustlist Routes]( https://worldhealthorganization.github.io/smart-trust-network-gateway/#/Trust%20Lists/downloadTrustListFilteredByType) (e.g. DSC/SCA/Upload/Authentication) may also be tested. 
As a transitive trust participant, you should limit the usage to http *GET* requests only.

#### Full Onboarding

For a successful connection to the gateway using full onboarding, there are several steps to prepare:

 1) Certificates must be prepared for Acceptance Environment (self signed allowed) following the requirements in [Certificate Governance](concepts_certificate_governance.html)
    - Authentication: TNP<sub>TLS</sub>
    - Upload:   TNP<sub>UP</sub>
    - SCA(s):  TNP<sub>SCA</sub>
    
 2) Prepare public keys in PEM format in a private Github repository dedicated to acceptance environment keys. Follow the  procedure described in this Github repository: https://github.com/WorldHealthOrganization/tng-participant-template (for support contact the tng-support@who.int functional mailbox). After technical onboarding you will be notified.

 3) After onboarding in the Acceptance Environment, check the connectivity with the Trust Network Gateway using its [API](openapi).  This can be acheived with following command:<br>
  ``` curl -v https://tng-uat.who.int/trustList --cert TLS.pem --key TLS_key.pem``` <br>
    You should see a output like: <br>
 
    ```
    [
    {
        "kid": "+jrpHSqdqZY=",
        "timestamp": "2023-05-25T07:55:21Z",
        "country": "XC",
        "certificateType": "UPLOAD",
        "thumbprint": "fa3ae91d...",
        "signature": "MIAGCSqGSIb3D...",
        "rawData": "MIIErTCCA5WgAwIBAgII..."
    }
    ]
    ```

 4) Test the other Trustlist Routes in the same style (e.g. with DSC/SCA/Upload/Authentication...) <br>
 5) Create an Document Signer Certificate and sign it by the SCA <br>
 6) Create an CMS Package with the following Command: <br>

  ``` 
      openssl x509 -outform der -in cert.pem -out cert.der
      openssl cms -sign -nodetach -in cert.der -signer signing.crt -inkey signing.key -out signed.der -outform DER -binary
      openssl base64 -in signed.der -out cms.b64 -e -A 
  ``` 
   Note: cert.der is your DSC, signing.crt is the TNP<sub>UP</sub>)
  
 7) Upload the CMS Package to the Gateway<br>
    ```curl -v -X POST -H "Content-Type: application/cms" --cert TLS.pem --key TLS_key.pem --data @cms.b64 https://tng-uat.who.int/signerCertificate``` <br>
 8) Download the Trustlist again, and check if your DSC is available.
 
 
**Note**: Some versions of curl don't attach the client certificates automatically. This can be checked via
``` curl --version ```
Ensure that the used version is linked to OpenSSL. Especially under Windows (https://curl.se/windows/): 
<br><br>
OpenSSL Test Example (working)<br>
<br>
{% include img.html img="OpenSSL.PNG" caption="Working Setup" width="70%" %}
<br><br>
WinSSL Test Example (Not working)
<br><br>
{% include img.html img="WinSSL.PNG" caption="Non Working Setup" width="70%" %}



### Production Environment

1) Prepare public keys in PEM format in a private Github repository dedicated to production environment keys. Follow the  procedure described in this Github repository: https://github.com/WorldHealthOrganization/tng-participant-template
2) After onboarding succeeded connect your production setup as described above



    

