#!/bin/bash
"""
Simple shell script to trigger participant updates.
This can be called from participant repositories as a simple webhook.
"""

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GENERATE_SCRIPT="$SCRIPT_DIR/generate_organizations.py"

# Function to determine environment from repository name or current directory
determine_environment() {
    local repo_name="${1:-$(basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")}"
    
    if [[ "$repo_name" == *"-prod" ]]; then
        echo "PROD"
    elif [[ "$repo_name" == *"-uat" ]]; then
        echo "UAT"
    elif [[ "$repo_name" == *"-dev" ]]; then
        echo "DEV"
    else
        echo "PROD"  # Default
    fi
}

# Parse command line arguments
ENVIRONMENT=""
REPO_NAME=""
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -r|--repo|--repository)
            REPO_NAME="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  -e, --env ENVIRONMENT    Force specific environment (PROD, UAT, DEV)"
            echo "  -r, --repo REPOSITORY    Repository name (for environment detection)"
            echo "  -v, --verbose           Enable verbose output"
            echo "  -h, --help              Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

# Determine environment if not specified
if [[ -z "$ENVIRONMENT" ]]; then
    ENVIRONMENT=$(determine_environment "$REPO_NAME")
fi

if [[ "$VERBOSE" == true ]]; then
    echo "Repository: ${REPO_NAME:-$(basename "$(pwd)")}"
    echo "Environment: $ENVIRONMENT"
    echo "Script: $GENERATE_SCRIPT"
fi

# Validate environment
case "$ENVIRONMENT" in
    PROD|UAT|DEV)
        ;;
    *)
        echo "Error: Invalid environment '$ENVIRONMENT'. Must be PROD, UAT, or DEV." >&2
        exit 1
        ;;
esac

# Check if the generation script exists
if [[ ! -f "$GENERATE_SCRIPT" ]]; then
    echo "Error: Generation script not found at $GENERATE_SCRIPT" >&2
    exit 1
fi

# Run the participant generation
echo "Triggering participant update for $ENVIRONMENT environment..."

if python3 "$GENERATE_SCRIPT" --env "$ENVIRONMENT"; then
    echo "Successfully updated $ENVIRONMENT participants"
else
    echo "Error: Failed to update participants for $ENVIRONMENT environment" >&2
    exit 1
fi