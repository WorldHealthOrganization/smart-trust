#!/usr/bin/env python3
"""
Webhook handler script for participant repository updates.
This script can be used to handle direct HTTP webhooks from participant repositories.
"""

import json
import sys
import subprocess
import argparse
from pathlib import Path

# Security: Allowed repositories for webhook triggers
ALLOWED_REPOSITORIES = {
    "WorldHealthOrganization/tng-participants-prod",
    "WorldHealthOrganization/tng-participants-uat", 
    "WorldHealthOrganization/tng-participants-dev"
}

# Security: Required organization
REQUIRED_ORGANIZATION = "WorldHealthOrganization"

def validate_webhook_source(repository_info):
    """Validate that webhook comes from an allowed repository and organization"""
    full_name = repository_info.get('full_name', '')
    owner = repository_info.get('owner', {}).get('login', '')
    
    # Check organization
    if owner != REQUIRED_ORGANIZATION:
        return False, f"Webhook rejected: Repository owner '{owner}' is not '{REQUIRED_ORGANIZATION}'"
    
    # Check repository whitelist
    if full_name not in ALLOWED_REPOSITORIES:
        return False, f"Webhook rejected: Repository '{full_name}' is not in allowed list: {list(ALLOWED_REPOSITORIES)}"
    
    return True, "Webhook source validated successfully"

def determine_environment_from_repo(repo_name):
    """Determine environment based on repository name (part after last dash)"""
    # Extract suffix after last dash and convert to uppercase
    env_suffix = repo_name.split('-')[-1]
    return env_suffix.upper()

def handle_webhook(payload_data):
    """Handle webhook payload and trigger participant generation"""
    
    # Extract repository information
    repository = payload_data.get('repository', {})
    repo_name = repository.get('name', '')
    full_name = repository.get('full_name', '')
    
    # Security validation
    is_valid, validation_message = validate_webhook_source(repository)
    if not is_valid:
        print(validation_message)
        return {
            'status': 'error',
            'repository': full_name,
            'message': validation_message
        }
    
    print(f"Webhook validated and accepted from repository: {full_name}")
    
    # Determine environment
    environment = determine_environment_from_repo(repo_name)
    
    print(f"Webhook received from repository: {full_name}")
    print(f"Determined environment: {environment}")
    
    # Check if this is a push to main branch
    ref = payload_data.get('ref', '')
    if ref != 'refs/heads/main':
        print(f"Ignoring push to non-main branch: {ref}")
        return
    
    # Run the participant generation script
    try:
        script_path = Path(__file__).parent / 'generate_organizations.py'
        cmd = [sys.executable, str(script_path), '--env', environment]
        
        print(f"Running command: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        
        print("Successfully generated participants")
        print("STDOUT:", result.stdout)
        
        return {
            'status': 'success',
            'environment': environment,
            'repository': full_name,
            'message': 'Participants updated successfully'
        }
        
    except subprocess.CalledProcessError as e:
        print(f"Error running generation script: {e}")
        print("STDERR:", e.stderr)
        return {
            'status': 'error',
            'environment': environment,
            'repository': full_name,
            'message': f'Failed to update participants: {e}'
        }

def main():
    parser = argparse.ArgumentParser(description='Handle webhook from participant repositories')
    parser.add_argument('--payload', help='JSON payload from webhook (can be file path or JSON string)')
    
    args = parser.parse_args()
    
    if args.payload:
        # Load payload from file or parse as JSON
        try:
            if Path(args.payload).exists():
                with open(args.payload, 'r') as f:
                    payload = json.load(f)
            else:
                payload = json.loads(args.payload)
        except (json.JSONDecodeError, FileNotFoundError) as e:
            print(f"Error parsing payload: {e}")
            sys.exit(1)
    else:
        # Read from stdin
        try:
            payload = json.load(sys.stdin)
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON from stdin: {e}")
            sys.exit(1)
    
    result = handle_webhook(payload)
    print(json.dumps(result, indent=2))

if __name__ == '__main__':
    main()