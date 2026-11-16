# Connect and test

The text of the tasks of `GDHCN.ONB.ConnectTest.bpmn`. Each section belongs to one task of that diagram, which links to it by the task's id. Edit the text here; the diagram holds only a one-line summary of each task.

<a name="X.O.White"></a>
## Whitelist the certificates

**[43]** In case the verification was successful the whitelisting of the certificates is initiated.

**[67]** If the Dry Run Test has passed successfully, the whitelisting of the certificates in the gateway (PROD environment) continues.

<a name="X.O.Inform"></a>
## Send the connection information

**[44 - 46]** and the participant will be informed that the preparation has been completed successfully.

**[68 - 69]** The Onboarding team informs the TNP to be ready to connect to TNG PROD environment.

<a name="X.P.Connect"></a>
## Connect to the gateway

**[60]** The participant is connecting to UAT environment and the following steps has to be performed to check the connection:

<details> 

<summary> 1) check the connectivity with the following command:  </summary> 
input:

curl -v https://tng-uat.who.int/trustList --cert TLS.pem --key TLS_key.pem 

You should see an output like:

\`\`\`

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

\`\`\`

</details> 

2) Test the other Trustlist Routes in the same style (e. g. with DSC/SCA/Upload/Authentication…)

**[70]** The participant is allowed and enabled to connect to TNG PROD environment (for detailed information see [60]).

<a name="X.P.Fix"></a>
## Correct the connection with the operations team

**[61]** In case the connection fails, some corrective actions must be performed to analyze and solve the issue(s). The operations team is supporting the TNP.

**[71]** In case the connection fails, some corrective actions must be performed to analyze and solve the issue(s). The operations team is supporting the TNP.

<a name="X.P.Test"></a>
## Run the test

**[62]** After the connection to the TNG is established the participant can start the dry run test on UAT.

This test includes the listed steps:

a) Upload one or more DSCs to the TNG

b) Delete at least one DSC again (revocation of a DSC)

c) Optional: Upload it again (if it is required for further testing)

d) Download the trust list from the TNG gateway [(API)](openapi)

e) Provide sample VDHC s to be verified by the service provider

f) Validate some sample VDHC 's to ensure the validation implementation is working fine

**[72]** After the connection to the TNG PROD is established the Production Readiness Test can start. 

<details> 
<summary> This test includes the listed steps: </summary> 

a) Create a Document Signer Certificate (DSC) and sign it by the SCA


b) Create an CMS package with the following command: 

Input:

openssl x509 -outform der -in cert.pem -out cert.der

openssl cms -sign -nodetach -in cert.der -signer signing.crt -inkey signing.key -out signed.der -outform DER -binary

openssl base64 -in signed.der -out cms.b64 -e -A

Note: cert.der is your DSC, signing.crt is the TNPUP


 c) Upload the CMS package to the gateway 

Input:

curl -v -X POST -H "Content-Type: application/cms" --cert TLS.pem --key TLS_key.pem --data @cms.b64 https://tng-uat.who.int/signerCertificate  



 d) Download the trustlist again and check if your DSC is available. <


**Note**: Some versions of curl don’t attach the client certificates automatically. This can be checked via curl –version. Ensure that the used version is linked to OpenSSL. Especially under Windows (https://curl.se/windows/):  
  
OpenSSL Test Example (working)


e) Delete at least one DSC again (Revocation)

f) Upload it again in case the DSC is required

</details>

<a name="X.P.Send"></a>
## Send the test results

**[63]** After executing all required steps, the participant must provide the test results to the onboarding team.

**[73 - 74]** After executing all required steps, the participant must provide the test results to the service provider by mail.

<a name="X.O.Check"></a>
## Check the test results

**[64 - 65]** The onboarding team checks the results and provides feedback to the participant.

**[75]** The service provider checks the results.

<a name="X.O.Fix"></a>
## Agree corrective actions

**[66]** In case of any issues additional corrective actions are bespoken and solved with the participant.

**[76]** and in case of any issues additional corrective actions are bespoken and solved with the participant.
