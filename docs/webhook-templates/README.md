# GitHub Workflow Configuration for Participant Repositories

**This directory contains the templates and instructions for configuring GitHub workflows in participant repositories.**

## 📋 Primary Configuration Guide

**For complete GitHub workflow setup, follow:** 
📖 **[setup-instructions.md](setup-instructions.md)**

## 📁 Template Files

- **`github-workflow-template.yml`** - GitHub Actions workflow template (copy to `.github/workflows/`)
- **`simple-webhook-template.sh`** - Shell script template for manual triggers
- **`setup-instructions.md`** - Complete step-by-step configuration guide

## 🚀 Quick Setup

1. Copy `github-workflow-template.yml` to `.github/workflows/trigger-smart-trust-update.yml` in your participant repository
2. Create GitHub token with `repo` permissions
3. Add token as repository secret `SMART_TRUST_WEBHOOK_TOKEN`
4. Test by pushing changes to main branch

**For detailed instructions, see [setup-instructions.md](setup-instructions.md)**
