# Participant Repository Webhook Setup

This document provides instructions for setting up webhooks in the participant repositories to automatically trigger updates to the WHO SMART Trust valuesets and codesystems when participants change.

## Overview

The WHO SMART Trust repository now supports environment-specific participant lists:
- **PROD**: Generated from `tng-participants-prod` repository
- **UAT**: Generated from `tng-participants-uat` repository  
- **DEV**: Generated from `tng-participants-dev` repository

When changes are made to the main branch of any participant repository, a webhook should trigger the generation of updated participant files in this repository.

## Quick Start

For detailed setup instructions and multiple webhook options, see the **[webhook-templates/](webhook-templates/)** directory which contains:

- **Template files** for easy setup in participant repositories
- **Multiple webhook methods** (GitHub Actions, shell scripts, direct API calls)
- **Comprehensive setup guide** with step-by-step instructions
- **Troubleshooting guide** for common issues

## Webhook Scripts

The repository now includes several webhook handling scripts:

- `input/scripts/webhook_handler.py` - Python webhook handler for processing GitHub webhook payloads
- `input/scripts/trigger_webhook.sh` - Shell script for manual webhook triggers  
- `input/scripts/test_webhook.py` - Test script for validating webhook setup

## Setup Instructions

### 1. In Each Participant Repository

Add the following GitHub workflow file to trigger updates:

**File**: `.github/workflows/trigger-smart-trust-update.yml`

```yaml
name: Trigger SMART Trust Update

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  trigger-update:
    runs-on: ubuntu-latest
    
    steps:
    - name: Determine environment
      id: env
      run: |
        REPO_NAME="${{ github.repository }}"
        if [[ "$REPO_NAME" == *"-prod" ]]; then
          echo "environment=PROD" >> $GITHUB_OUTPUT
        elif [[ "$REPO_NAME" == *"-uat" ]]; then
          echo "environment=UAT" >> $GITHUB_OUTPUT
        elif [[ "$REPO_NAME" == *"-dev" ]]; then
          echo "environment=DEV" >> $GITHUB_OUTPUT
        else
          echo "environment=PROD" >> $GITHUB_OUTPUT
        fi
        
    - name: Trigger SMART Trust participant generation
      uses: peter-evans/repository-dispatch@v2
      with:
        token: ${{ secrets.SMART_TRUST_WEBHOOK_TOKEN }}
        repository: WorldHealthOrganization/smart-trust
        event-type: participant-update
        client-payload: |
          {
            "environment": "${{ steps.env.outputs.environment }}",
            "source_repository": "${{ github.repository }}",
            "triggered_by": "${{ github.actor }}",
            "commit_sha": "${{ github.sha }}"
          }
```

### 2. Required Secrets

Each participant repository needs a secret named `SMART_TRUST_WEBHOOK_TOKEN` with a GitHub Personal Access Token that has:
- Repository access to `WorldHealthOrganization/smart-trust`
- `repo` permissions (to trigger workflows)

### 3. Repository Mapping

The workflow automatically determines the environment based on repository name:
- Repositories ending in `-prod` → PROD environment
- Repositories ending in `-uat` → UAT environment  
- Repositories ending in `-dev` → DEV environment
- All others → PROD environment (default)

## Manual Triggering

You can also manually trigger participant generation:

1. Go to the [Generate Participants workflow](https://github.com/WorldHealthOrganization/smart-trust/actions/workflows/generate-participants.yml)
2. Click "Run workflow"
3. Select the desired environment (PROD, UAT, DEV)
4. Click "Run workflow"

## Generated Files

The workflow generates environment-specific files:

### PROD Environment (default)
- `input/fsh/instances/participants.fsh`
- `input/fsh/instances/endpoints.fsh`
- `input/fsh/codesystems/RefMartList.fsh`

### UAT Environment  
- `input/fsh/instances/participants-UAT.fsh`
- `input/fsh/instances/endpoints-UAT.fsh`
- `input/fsh/codesystems/RefMartList-UAT.fsh`

### DEV Environment
- `input/fsh/instances/participants-DEV.fsh`
- `input/fsh/instances/endpoints-DEV.fsh`
- `input/fsh/codesystems/RefMartList-DEV.fsh`

## Script Usage

The enhanced `generate_organizations.py` script can be run locally:

```bash
# Generate PROD participants (default)
python3 input/scripts/generate_organizations.py

# Generate UAT participants
python3 input/scripts/generate_organizations.py --env UAT

# Generate DEV participants  
python3 input/scripts/generate_organizations.py --env DEV

# Show help
python3 input/scripts/generate_organizations.py --help
```

## Troubleshooting

### Webhook Not Triggering
1. Verify the `SMART_TRUST_WEBHOOK_TOKEN` secret is set correctly
2. Check that the token has sufficient permissions
3. Verify the repository name matches the expected pattern

### Workflow Fails
1. Check the workflow logs in the Actions tab
2. Verify the WHO RefMart API is accessible
3. Ensure the participant directory structure follows the expected pattern

### Missing Participants
The script looks for directories matching the pattern `[A-Z][A-Z][A-Z]` (three capital letters) in the participant repository root, excluding WHO.