# Webhook Templates Directory

This directory contains templates and setup instructions for configuring webhooks between WHO SMART Trust participant repositories and the smart-trust repository.

## Template Files

### GitHub Actions Workflows

- **`github-workflow-template.yml`** - Standard GitHub Actions workflow using Personal Access Token
- **`github-app-workflow-template.yml`** - Enhanced GitHub Actions workflow using GitHub App (recommended for security)

### Scripts

- **`simple-webhook-template.sh`** - Shell script for direct webhook calls

### Documentation

- **`setup-instructions.md`** - Complete step-by-step setup guide for all methods

## Quick Start

1. **Read the setup guide**: [setup-instructions.md](setup-instructions.md)
2. **Choose authentication method**:
   - **PAT (current)**: Use `github-workflow-template.yml`  
   - **GitHub App (recommended)**: Use `github-app-workflow-template.yml` and see [webhook alternatives guide](../webhook-alternatives.md)
3. **Copy template** to your participant repository
4. **Follow setup instructions** for your chosen method

## Security Recommendations

For enhanced security, consider migrating from Personal Access Tokens to GitHub Apps. See the [webhook alternatives documentation](../webhook-alternatives.md) for detailed comparison and setup instructions.

## Repository Structure

Copy templates to participant repositories following this structure:

```
tng-participants-{env}/
├── .github/
│   └── workflows/
│       └── trigger-smart-trust-update.yml  # Copy from template
├── XXX/                                     # Participant directories
├── YYY-ZZZ/
└── ...
```

## Support

For setup assistance or troubleshooting, refer to the troubleshooting section in [setup-instructions.md](setup-instructions.md).
