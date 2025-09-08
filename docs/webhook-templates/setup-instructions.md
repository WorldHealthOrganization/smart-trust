# Detailed Setup Instructions for Participant Repository Webhooks

This document provides comprehensive step-by-step instructions for setting up webhook triggers in WHO SMART Trust participant repositories.

## Overview

The WHO SMART Trust system supports three environments with corresponding participant repositories:

- **PROD**: `tng-participants-prod` → PROD environment
- **UAT**: `tng-participants-uat` → UAT environment  
- **DEV**: `tng-participants-dev` → DEV environment

When participants are added, removed, or modified in any participant repository, webhooks can automatically trigger updates to the corresponding SMART Trust valuesets and codesystems.

## Security Requirements

**Important**: For security, webhooks are only accepted from these exact repositories:

- `WorldHealthOrganization/tng-participants-prod`
- `WorldHealthOrganization/tng-participants-uat`
- `WorldHealthOrganization/tng-participants-dev`

All webhook sources must be from the `WorldHealthOrganization` organization. Webhooks from any other repositories or organizations will be rejected.

## Method 1: GitHub Actions Webhook (Recommended)

This method uses GitHub Actions workflows to trigger webhooks when changes are pushed to the main branch.

### Step-by-Step Setup

#### 1. Create Webhook Token

First, create a GitHub Personal Access Token with the necessary permissions:

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Configure the token:
   - **Name**: `SMART Trust Webhook Token`
   - **Expiration**: Set appropriate expiration (90 days recommended)
   - **Scopes**: Select `repo` (Full control of private repositories)
4. Click "Generate token"
5. **Important**: Copy the token immediately - you won't be able to see it again

#### 2. Add Token to Participant Repository

For each participant repository (`tng-participants-prod`, `tng-participants-uat`, `tng-participants-dev`):

1. Go to the repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Configure the secret:
   - **Name**: `SMART_TRUST_WEBHOOK_TOKEN`
   - **Secret**: Paste the token created in step 1
4. Click "Add secret"

#### 3. Add Workflow File

Copy the workflow template to each participant repository:

1. In each participant repository, create the directory `.github/workflows/` if it doesn't exist
2. Copy `docs/webhook-templates/github-workflow-template.yml` to `.github/workflows/trigger-smart-trust-update.yml`
3. Commit and push the file:

```bash
git add .github/workflows/trigger-smart-trust-update.yml
git commit -m "Add WHO SMART Trust webhook trigger"
git push
```

#### 4. Test the Setup

Test the webhook by making a change to the participant repository:

1. Add, modify, or remove a participant directory
2. Commit and push to the main branch
3. Check the Actions tab in the participant repository to see if the workflow ran
4. Check the Actions tab in the `smart-trust` repository to see if the participant generation workflow was triggered

### Workflow Features

The GitHub Actions workflow includes:

- **Automatic environment detection** based on repository name
- **Manual triggering** with environment override option
- **Comprehensive logging** of webhook triggers
- **Error handling** and status reporting

## Method 2: Simple Shell Script Webhook

For repositories that prefer not to use GitHub Actions, a simple shell script can trigger webhooks.

### Step-by-Step Setup

#### 1. Copy Script Template

1. Copy `docs/webhook-templates/simple-webhook-template.sh` to your participant repository
2. Rename it to something like `trigger-smart-trust-update.sh`
3. Make it executable:

```bash
chmod +x trigger-smart-trust-update.sh
```

#### 2. Configure Token

Set the webhook token as an environment variable:

```bash
export SMART_TRUST_WEBHOOK_TOKEN="your_token_here"
```

Or create a `.env` file (make sure to add it to `.gitignore`):

```bash
echo "SMART_TRUST_WEBHOOK_TOKEN=your_token_here" >> .env
echo ".env" >> .gitignore
```

#### 3. Use the Script

Run the script manually when participants change:

```bash
# Auto-detect environment from repository name
./trigger-smart-trust-update.sh

# Force specific environment
./trigger-smart-trust-update.sh --env UAT

# Specify repository explicitly
./trigger-smart-trust-update.sh --repo "WorldHealthOrganization/tng-participants-dev"
```

#### 4. Integrate with Git Hooks (Optional)

To automatically trigger on commits, add to `.git/hooks/post-commit`:

```bash
#!/bin/bash
# Only trigger on main branch
if [ "$(git branch --show-current)" = "main" ]; then
    ./trigger-smart-trust-update.sh
fi
```

## Repository Requirements

Each participant repository must follow this structure:

```
tng-participants-{env}/
├── XXX/                    # 3-letter country/organization code
├── YYY-ZZZ/               # Codes can include dashes
├── AAA-BBB-CCC/           # Multiple dash-separated parts allowed
└── ...
```

### Participant Directory Requirements

- **Directory names**: Must match pattern `[A-Z][A-Z][A-Z](-[A-Z]+)*`
- **Examples**: `USA`, `GBR`, `XXX-YYY`, `AAA-BBB-CCC`
- **Excluded**: `WHO` directory is always excluded from participant lists

## Environment-Specific Behavior

### PROD Environment
- **Source**: `tng-participants-prod` repository
- **RefMart**: Includes RefMartCountryList codesystem
- **Participants**: All directories from repository
- **Output**: `Participants.fsh`, `refmart_countries.fsh`

### UAT Environment  
- **Source**: `tng-participants-uat` repository
- **RefMart**: No RefMart codesystem generated
- **Participants**: Only directories NOT in RefMart Country List
- **Output**: `Participants-UAT.fsh`

### DEV Environment
- **Source**: `tng-participants-dev` repository
- **RefMart**: No RefMart codesystem generated
- **Participants**: All directories from repository (no RefMart filtering)
- **Output**: `Participants-DEV.fsh`

## Troubleshooting

### Common Issues

#### Webhook Not Triggering

1. **Check token permissions**:
   - Verify token has `repo` scope
   - Ensure token hasn't expired
   - Test token with GitHub API:
   ```bash
   curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user
   ```

2. **Verify secret configuration**:
   - Check secret name is exactly `SMART_TRUST_WEBHOOK_TOKEN`
   - Ensure secret is added to correct repository
   - Verify no extra spaces or characters in token

3. **Check repository name pattern**:
   - Repository must end with `-prod`, `-uat`, or `-dev` for auto-detection
   - Or use manual environment override

#### Workflow Fails

1. **Check workflow logs**:
   - Go to Actions tab in participant repository
   - Check workflow run details and logs
   - Look for authentication or permission errors

2. **Verify target repository access**:
   - Ensure token has access to `WorldHealthOrganization/smart-trust`
   - Check if organization settings block external access

#### Participants Not Updated

1. **Check generation workflow**:
   - Go to smart-trust repository Actions tab
   - Look for "Generate Participants" workflow runs
   - Check logs for API access or parsing errors

2. **Verify participant directory structure**:
   - Ensure directories follow naming pattern
   - Check for typos in directory names
   - Verify directories are in repository root

### Testing

Test webhook setup using these methods:

#### Manual Test via API

```bash
curl -X POST \
  -H "Authorization: token YOUR_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "participant-update",
    "client_payload": {
      "environment": "DEV",
      "source_repository": "WorldHealthOrganization/tng-participants-dev",
      "triggered_by": "test-user"
    }
  }' \
  https://api.github.com/repos/WorldHealthOrganization/smart-trust/dispatches
```

#### Test Script

The `smart-trust` repository includes a test script:

```bash
python3 input/scripts/test_webhook.py --env DEV --verbose
```

## File Templates

All template files are available in the `docs/webhook-templates/` directory:

- `github-workflow-template.yml` - Complete GitHub Actions workflow
- `simple-webhook-template.sh` - Shell script for manual triggers
- `setup-instructions.md` - This document

## Support

For issues with webhook setup:

1. Check the troubleshooting section above
2. Review workflow/script logs for error details
3. Verify all requirements are met
4. Test with manual API calls to isolate issues

## Security Notes

- **Never commit tokens** to repositories
- **Use repository secrets** for GitHub Actions
- **Regularly rotate tokens** (every 90 days recommended)
- **Limit token scope** to minimum required permissions
- **Monitor token usage** in GitHub settings
- **Repository validation**: Webhooks are only accepted from the three official WHO participant repositories
- **Organization validation**: All webhook sources must be from the `WorldHealthOrganization` organization