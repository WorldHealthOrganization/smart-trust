# Participant Repository Webhook Setup

This document provides instructions for setting up automatic webhook triggers in participant repositories to update WHO SMART Trust valuesets and codesystems when participants change.

## Overview

The WHO SMART Trust repository supports three environments with corresponding participant repositories:
- **PROD**: `tng-participants-prod` repository  
- **UAT**: `tng-participants-uat` repository
- **DEV**: `tng-participants-dev` repository

## GitHub Workflow Configuration

**For GitHub workflow setup, use the template and instructions in:** 
📁 **[webhook-templates/setup-instructions.md](webhook-templates/setup-instructions.md)**

This provides step-by-step instructions for configuring GitHub Actions workflows in each participant repository.

## Quick Setup Summary

1. **Create GitHub token** with `repo` permissions
2. **Add secret** `SMART_TRUST_WEBHOOK_TOKEN` to participant repository
3. **Copy workflow file** from `webhook-templates/github-workflow-template.yml` to `.github/workflows/trigger-smart-trust-update.yml`
4. **Test** by pushing changes to main branch

## Environment Behavior

- **PROD**: Includes all participants + RefMart codesystem
- **UAT**: Only participants NOT in RefMart list  
- **DEV**: All participants from dev repo (no RefMart filtering)

## Generated Files

Environment-specific files are created:
- **PROD**: `Participants.fsh`, `RefMartCountryList.fsh`
- **UAT**: `Participants-UAT.fsh` 
- **DEV**: `Participants-DEV.fsh`

## Security

Webhooks are only accepted from:
- `WorldHealthOrganization/tng-participants-prod`
- `WorldHealthOrganization/tng-participants-uat`  
- `WorldHealthOrganization/tng-participants-dev`

## Manual Triggering

Go to [Generate Participants workflow](https://github.com/WorldHealthOrganization/smart-trust/actions/workflows/generate-participants.yml) and click "Run workflow".