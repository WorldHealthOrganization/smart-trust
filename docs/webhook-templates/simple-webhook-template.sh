#!/bin/bash
#
# Simple webhook trigger script for WHO SMART Trust participant updates
# This script can be added to participant repositories to trigger updates
# when participants change.
#

set -e

# Configuration - UPDATE THESE VALUES
SMART_TRUST_REPO="WorldHealthOrganization/smart-trust"
WEBHOOK_TOKEN="${SMART_TRUST_WEBHOOK_TOKEN:-}"  # Set this environment variable or secret

# Auto-detect environment from current repository
detect_environment() {
    local current_repo
    
    # Try to get repository name from git remote
    if command -v git >/dev/null 2>&1; then
        current_repo=$(git remote get-url origin 2>/dev/null | sed 's/.*\///' | sed 's/\.git$//' || echo "")
    fi
    
    # Fallback to current directory name
    if [ -z "$current_repo" ]; then
        current_repo=$(basename "$(pwd)")
    fi
    
    # Determine environment
    if [[ "$current_repo" == *"-prod" ]]; then
        echo "PROD"
    elif [[ "$current_repo" == *"-uat" ]]; then
        echo "UAT"
    elif [[ "$current_repo" == *"-dev" ]]; then
        echo "DEV"
    else
        echo "PROD"  # Default
    fi
}

# Function to trigger webhook
trigger_webhook() {
    local environment="$1"
    local repo_name="$2"
    
    if [ -z "$WEBHOOK_TOKEN" ]; then
        echo "Error: SMART_TRUST_WEBHOOK_TOKEN not set" >&2
        echo "Please set the webhook token as an environment variable or repository secret" >&2
        exit 1
    fi
    
    # Create payload
    local payload=$(cat <<JSON_EOF
{
  "event_type": "participant-update",
  "client_payload": {
    "environment": "$environment",
    "source_repository": "$repo_name",
    "triggered_by": "$(whoami)",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  }
}
JSON_EOF
)
    
    echo "Triggering WHO SMART Trust update..."
    echo "Environment: $environment"
    echo "Repository: $repo_name"
    
    # Send webhook using GitHub API
    if curl -s -X POST \
        -H "Authorization: token $WEBHOOK_TOKEN" \
        -H "Accept: application/vnd.github.v3+json" \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "https://api.github.com/repos/$SMART_TRUST_REPO/dispatches"; then
        echo "Successfully triggered WHO SMART Trust participant update"
    else
        echo "Error: Failed to trigger webhook" >&2
        exit 1
    fi
}

# Main execution
main() {
    local environment
    local repo_name
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--env|--environment)
                environment="$2"
                shift 2
                ;;
            -r|--repo|--repository)
                repo_name="$2"
                shift 2
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  -e, --env ENVIRONMENT    Force specific environment (PROD, UAT, DEV)"
                echo "  -r, --repo REPOSITORY    Repository name"
                echo "  -h, --help              Show this help message"
                echo ""
                echo "Environment Variables:"
                echo "  SMART_TRUST_WEBHOOK_TOKEN  GitHub token with access to smart-trust repo"
                exit 0
                ;;
            *)
                echo "Unknown option: $1" >&2
                exit 1
                ;;
        esac
    done
    
    # Auto-detect environment if not provided
    if [ -z "$environment" ]; then
        environment=$(detect_environment)
    fi
    
    # Auto-detect repository name if not provided
    if [ -z "$repo_name" ]; then
        if command -v git >/dev/null 2>&1; then
            repo_name=$(git remote get-url origin 2>/dev/null | sed 's/.*github\.com[\/:]//; s/\.git$//' || echo "unknown-repo")
        else
            repo_name="unknown-repo"
        fi
    fi
    
    # Validate environment
    case "$environment" in
        PROD|UAT|DEV)
            ;;
        *)
            echo "Error: Invalid environment '$environment'. Must be PROD, UAT, or DEV." >&2
            exit 1
            ;;
    esac
    
    trigger_webhook "$environment" "$repo_name"
}

# Check dependencies
if ! command -v curl >/dev/null 2>&1; then
    echo "Error: curl is required but not installed" >&2
    exit 1
fi

main "$@"
