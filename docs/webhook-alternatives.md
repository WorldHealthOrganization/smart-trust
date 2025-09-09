# Webhook Trigger Alternatives to Personal Access Tokens (PATs)

This document outlines alternatives to Personal Access Tokens for triggering WHO SMART Trust participant updates.

## Current Architecture

The current setup requires cross-repository workflow triggering:
- **Source**: Participant repositories (`tng-participants-prod/uat/dev`)
- **Target**: SMART Trust repository (`smart-trust`)  
- **Mechanism**: GitHub `repository_dispatch` API calls

## Alternative Authentication Methods

### 1. GitHub Apps (Recommended Alternative)

GitHub Apps provide better security and granular permissions compared to PATs.

#### Advantages:
- **Better security**: Scoped to specific repositories/organizations
- **Granular permissions**: Only request needed permissions
- **Installation-based**: Can be installed only where needed
- **Audit trail**: Better tracking of API usage
- **No user dependency**: Not tied to a specific user account

#### Implementation:
1. Create a GitHub App in the WHO organization
2. Grant `Contents: Read` and `Actions: Write` permissions
3. Install the app on participant repositories and smart-trust repository
4. Use app installation tokens instead of PATs

#### Setup Steps:
```bash
# 1. Create GitHub App (via GitHub UI)
# 2. Generate private key for the app
# 3. Store app ID and private key as secrets
# 4. Use github-app-token action in workflows
```

**Updated workflow template:**
```yaml
- name: Generate GitHub App Token
  id: app-token
  uses: actions/create-github-app-token@v1
  with:
    app-id: ${{ secrets.WHO_SMART_TRUST_APP_ID }}
    private-key: ${{ secrets.WHO_SMART_TRUST_PRIVATE_KEY }}
    repositories: smart-trust

- name: Trigger WHO SMART Trust participant generation
  uses: peter-evans/repository-dispatch@v3
  with:
    token: ${{ steps.app-token.outputs.token }}
    repository: WorldHealthOrganization/smart-trust
    event-type: participant-update
```

### 2. Fine-Grained Personal Access Tokens

GitHub's newer fine-grained PATs provide better security than classic PATs.

#### Advantages:
- **Repository-specific**: Can be scoped to specific repositories
- **Granular permissions**: More precise permission control
- **Time-limited**: Can set shorter expiration periods
- **Resource-specific**: Can limit to specific resources

#### Implementation:
Similar to current PAT setup but with fine-grained tokens:
1. Create fine-grained PAT scoped only to necessary repositories
2. Grant only `Actions: Write` permission
3. Set shorter expiration (e.g., 30 days instead of 90)

### 3. Organization-Level Access Tokens

For WHO organization, organization-level tokens can provide centralized management.

#### Advantages:
- **Centralized management**: Managed at organization level
- **Consistent permissions**: Same permissions across repositories
- **Easier rotation**: Can be rotated organization-wide

#### Implementation:
Requires WHO organization admin to create organization-level tokens.

### 4. Alternative Architecture: Webhook-Based Updates

Instead of repository dispatch, use actual webhooks with a service.

#### Architecture:
```
Participant Repo → GitHub Webhook → Service → GitHub API → Smart Trust Repo
```

#### Advantages:
- **No cross-repo tokens needed**: Service handles authentication
- **Better logging**: Centralized webhook processing
- **Rate limiting**: Can implement proper rate limiting
- **Validation**: Stronger payload validation

#### Implementation:
1. Deploy webhook service (e.g., GitHub Pages, AWS Lambda)
2. Configure GitHub webhooks in participant repositories
3. Service authenticates with GitHub using its own credentials
4. Service triggers smart-trust workflows

### 5. Repository-Specific Deploy Keys

For read-only access, deploy keys can be used, but this doesn't solve the workflow triggering need.

#### Limitations:
- **Read-only**: Cannot trigger workflows
- **Repository-specific**: Each repo needs separate key
- **Not suitable**: For this use case

## Comparison Matrix

| Method | Security | Setup Complexity | Maintenance | Cross-Repo Support |
|--------|----------|------------------|-------------|-------------------|
| Classic PAT | Medium | Low | Medium | Yes |
| Fine-grained PAT | High | Low | Medium | Yes |
| GitHub App | Highest | Medium | Low | Yes |
| Organization Token | High | Low | Low | Yes |
| Webhook Service | High | High | Medium | Yes |
| Deploy Keys | Medium | Medium | High | No |

## Recommended Approach

**For WHO organization, we recommend GitHub Apps** because:

1. **Best security practices**: Scoped permissions and installation-based access
2. **Organization control**: WHO admins control app installations
3. **Audit trail**: Better tracking of API usage
4. **Future-proof**: GitHub's recommended approach for automation

## Migration Plan

To migrate from PATs to GitHub Apps:

### Phase 1: Create GitHub App
1. WHO admin creates GitHub App in organization settings
2. Configure app with minimal required permissions:
   - `Actions: Write` (to trigger workflows)
   - `Contents: Read` (to read repository information)
3. Generate and securely store private key

### Phase 2: Update Repositories
1. Install GitHub App on all participant repositories and smart-trust
2. Add app credentials as organization secrets:
   - `WHO_SMART_TRUST_APP_ID`
   - `WHO_SMART_TRUST_PRIVATE_KEY`
3. Update workflow templates to use GitHub App tokens

### Phase 3: Test and Deploy
1. Test with one participant repository
2. Verify workflow triggering works correctly
3. Roll out to all participant repositories
4. Remove PAT-based secrets

### Phase 4: Documentation Update
1. Update setup instructions to use GitHub App method
2. Provide migration guide for existing repositories
3. Archive PAT-based templates

## Security Considerations

For any chosen method:

1. **Principle of least privilege**: Grant only minimum required permissions
2. **Regular rotation**: Rotate credentials regularly (apps can have longer-lived tokens)
3. **Audit logs**: Monitor API usage and access patterns
4. **Repository validation**: Maintain whitelist of allowed source repositories
5. **Organization validation**: Ensure only WHO organization can trigger webhooks

## Implementation Support

The WHO SMART Trust team can provide:
1. GitHub App creation and configuration
2. Updated workflow templates
3. Migration assistance for existing repositories
4. Testing and validation tools