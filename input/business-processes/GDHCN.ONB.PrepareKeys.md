# Prepare the keys and the repository

The text of the tasks of `GDHCN.ONB.PrepareKeys.bpmn`. Each section belongs to one task of that diagram, which links to it by the task's id. Edit the text here; the diagram holds only a one-line summary of each task.

<a name="K.Certs"></a>
## Create the TLS, upload and SCA certificates

**[9]** Create certificates per environment. Details can be found here: https://smart.who.int/trust/concepts_CertificatePreperation.html

1) Certificates must be prepared for all environments (self-signed allowed) following the requirements in Certificate Governance - Authentication: TNPTLS - Upload: TNPUP - SCA(s): TNPSCA

**Note** The participant must provide the CA certificate as well as the TLS certificate.

If the participant uses a self-signed TLS certificate, the TLS certificate can simply be copied and renamed to CA.crt.

In all other cases, the participant provides the appropriate CA certificate.




2) Prepare public keys in PEM format in your private GitHub repository (see [11]) dedicated to the used environment keys.

3) The prepared public keys must be tagged by the generated GPG keys:

1.  Tag the version of your latest information by using git tag + signing commands either from terminal or developer IDE. Please note that an update in GitHub web desktop itself is not working, because the platform will use an intermediate key.
2.  The bot user clones the latest tag of your private repo and verifies the signature of the tag against the onboarded GPG keys
3.  After verification of the provisioned material, the content will be taken over for the participant

<a name="K.Gpg"></a>
## Create a GPG key for each authorized person

**[10]** Create the GPG keys per environment and per each user needed.

Follow the instructions to create a key: https://docs.github.com/en/authentication/managing-commit-signature-verification/generating-a-new-gpg-key

The key must meet the [GPG key requirements](concepts_certificate_governance.html#gpg-keys) in the Certificate Governance.

<a name="K.Repo"></a>
## Create the private GitHub repository

**[11]** The TNP creates the private GitHub repositories per environment

1.  Create a private git repository on GitHub.
2.  Prepare the following information to be provided in the onboarding request:
    -   Environment repository URL’s (all private to hide uploader's identity) (DEV (optional), UAT, PROD)
    -   Invite the WHO bot user to the private repository (with read rights). The bot user is: [tng-bot](https://github.com/tng-bot) for PROD and [tng-bot-dev](https://github.com/tng-bot-dev) for DEV (optional) and UAT environments.

<a name="K.Invite"></a>
## Invite the GitHub bot

**[12]** Upon GitHub repository creation and invitation to GitHub bot user to WHO is sent, validity for accepting this invitation is 7 days by default. If no action is taken it loses validity.

<a name="KB.Accept"></a>
## Accept the invitation

**[13]** Invitation for GitHub bot user must be accepted by WHO within 7 days since invitation was emitted.
