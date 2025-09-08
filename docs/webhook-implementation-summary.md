# WHO SMART Trust Webhook Implementation Summary

This implementation provides comprehensive webhook support for automatic participant updates across DEV, UAT, and PROD environments.

## What's Included

### Core Webhook Scripts
- `input/scripts/webhook_handler.py` - Python webhook handler for GitHub webhook payloads
- `input/scripts/trigger_webhook.sh` - Shell script for manual webhook triggers
- `input/scripts/test_webhook.py` - Test script for validating webhook setup

### GitHub Workflow
- `.github/workflows/generate-participants.yml` - Automated workflow that responds to webhook triggers

### Template Files for Participant Repositories
- `docs/webhook-templates/github-workflow-template.yml` - Complete GitHub Actions workflow template
- `docs/webhook-templates/simple-webhook-template.sh` - Shell script template for direct webhook calls
- `docs/webhook-templates/setup-instructions.md` - Comprehensive setup guide
- `docs/webhook-templates/README.md` - Quick start guide

### Documentation
- `docs/participant-webhook-setup.md` - Updated main documentation with references to templates
- Complete troubleshooting guides and security notes

## Webhook Methods Supported

### 1. GitHub Actions (Recommended)
- Automatic triggering on push to main branch
- Environment auto-detection from repository name
- Manual triggering with environment override
- Comprehensive error handling and logging

### 2. Direct Shell Script
- Simple script that can be called manually or from git hooks
- Auto-detects environment from repository context
- Supports manual environment and repository specification
- Minimal dependencies (curl, bash)

### 3. Direct API Calls
- Pure HTTP webhook calls to GitHub repository dispatch API
- Can be integrated into any CI/CD system
- Flexible payload configuration

## Environment Configuration

### Repository Mapping
- `tng-participants-prod` → PROD environment
- `tng-participants-uat` → UAT environment
- `tng-participants-dev` → DEV environment

### Environment-Specific Behavior
- **PROD**: Includes RefMart codesystem, all participants
- **UAT**: No RefMart, participants NOT in RefMart list
- **DEV**: No RefMart, all participants from dev repo

## Security Features
- Token-based authentication using GitHub Personal Access Tokens
- Repository secrets for secure token storage
- Scope-limited token permissions (repo access only)
- No hardcoded credentials in any scripts

## Setup for Participant Repositories

Each participant repository needs to:

1. **Choose webhook method** (GitHub Actions recommended)
2. **Create GitHub token** with repo permissions
3. **Add token as repository secret** (`SMART_TRUST_WEBHOOK_TOKEN`)
4. **Copy appropriate template** from `docs/webhook-templates/`
5. **Test the setup** using provided test scripts

## Testing and Validation

- Test scripts included for validating webhook setup
- Dry-run mode for testing without actual execution
- Comprehensive logging for troubleshooting
- Manual trigger options for testing

## Usage Examples

### Automatic (GitHub Actions)
```yaml
# Just push to main branch in participant repo
git push origin main
```

### Manual (Shell Script)
```bash
# Auto-detect environment
./trigger-smart-trust-update.sh

# Force specific environment  
./trigger-smart-trust-update.sh --env UAT
```

### API (Direct)
```bash
curl -X POST \
  -H "Authorization: token YOUR_TOKEN" \
  -d '{"event_type":"participant-update","client_payload":{"environment":"DEV"}}' \
  https://api.github.com/repos/WorldHealthOrganization/smart-trust/dispatches
```

This implementation provides a robust, secure, and flexible webhook system that can be easily adopted by all participant repositories with minimal setup overhead.