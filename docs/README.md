# WHO SMART Trust Documentation

## Participant Repository Webhook Configuration

### 🎯 Quick Start: GitHub Workflow Setup

**For configuring GitHub workflows in participant repositories, use:**

📁 **[webhook-templates/setup-instructions.md](webhook-templates/setup-instructions.md)**

This provides complete step-by-step instructions for setting up automatic webhook triggers when participants change.

### 📚 Documentation Structure

| File | Purpose | Audience |
|------|---------|----------|
| **[participant-webhook-setup.md](participant-webhook-setup.md)** | Overview and quick reference | Repository administrators |
| **[webhook-templates/setup-instructions.md](webhook-templates/setup-instructions.md)** | **Main configuration guide** | **Implementers** |
| **[webhook-templates/README.md](webhook-templates/README.md)** | Template directory guide | Implementers |
| **[webhook-templates/github-workflow-template.yml](webhook-templates/github-workflow-template.yml)** | GitHub Actions workflow template | Copy to participant repos |
| **[webhook-templates/simple-webhook-template.sh](webhook-templates/simple-webhook-template.sh)** | Shell script template | Alternative to GitHub Actions |

### 🔧 What You Need

**For each participant repository (`tng-participants-prod/uat/dev`):**

1. **GitHub workflow file** - Copy from `webhook-templates/github-workflow-template.yml`
2. **Repository secret** - Add `SMART_TRUST_WEBHOOK_TOKEN` with GitHub token
3. **Token permissions** - GitHub Personal Access Token with `repo` scope

**Complete instructions:** [webhook-templates/setup-instructions.md](webhook-templates/setup-instructions.md)