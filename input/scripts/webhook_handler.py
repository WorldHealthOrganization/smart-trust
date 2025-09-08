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

def determine_environment_from_repo(repo_name):
    """Determine environment based on repository name"""
    if repo_name.endswith('-prod'):
        return 'PROD'
    elif repo_name.endswith('-uat'):
        return 'UAT'
    elif repo_name.endswith('-dev'):
        return 'DEV'
    else:
        return 'PROD'  # Default

def handle_webhook(payload_data):
    """Handle webhook payload and trigger participant generation"""
    
    # Extract repository information
    repository = payload_data.get('repository', {})
    repo_name = repository.get('name', '')
    full_name = repository.get('full_name', '')
    
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
    parser.add_argument('--repo', help='Repository name (if not in payload)')
    parser.add_argument('--env', help='Force specific environment (PROD, UAT, DEV)')
    
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
    
    # Override environment if specified
    if args.env:
        # Force environment by modifying repository name
        if 'repository' not in payload:
            payload['repository'] = {}
        payload['repository']['name'] = f"tng-participants-{args.env.lower()}"
    
    # Override repository if specified
    if args.repo:
        if 'repository' not in payload:
            payload['repository'] = {}
        payload['repository']['name'] = args.repo
    
    result = handle_webhook(payload)
    print(json.dumps(result, indent=2))

if __name__ == '__main__':
    main()