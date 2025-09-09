# WHO SMART Trust Documentation

## Quick Navigation

**For setting up participant repository webhooks (most common need):**
📖 [GitHub Workflow Configuration Guide](webhook-templates/setup-instructions.md)

**For webhook security and alternative authentication methods:**
📖 [Webhook Alternatives to PATs](webhook-alternatives.md)

**For overview and context:**
📖 [Participant Webhook Setup Overview](participant-webhook-setup.md)

## Documentation Structure

- **webhook-templates/setup-instructions.md** - Complete step-by-step setup guide for GitHub workflows
- **webhook-alternatives.md** - Alternatives to Personal Access Tokens (GitHub Apps, etc.)
- **participant-webhook-setup.md** - Overview and context about webhook functionality
- **webhook-templates/** - Template files and examples for easy setup

## Key Features

- **Environment-specific resources**: Separate DEV, UAT, and PROD valuesets and codesystems
- **Automated participant updates**: Webhooks trigger automatic updates when participants change
- **Security validation**: Repository and organization whitelist enforcement
- **Multiple authentication methods**: PAT, GitHub Apps, and other secure options