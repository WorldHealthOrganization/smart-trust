#!/usr/bin/env python3

import argparse
import logging
import sys
from datetime import datetime

def setup_logging(verbose=False):
    """Setup logging configuration"""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

def main():
    parser = argparse.ArgumentParser(description='Test webhook triggers for WHO SMART Trust')
    parser.add_argument('--env', choices=['PROD', 'UAT', 'DEV'], default='PROD',
                       help='Environment to test (default: PROD)')
    parser.add_argument('--repo', help='Repository name to simulate')
    parser.add_argument('--verbose', '-v', action='store_true', help='Enable verbose logging')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without executing')
    
    args = parser.parse_args()
    setup_logging(args.verbose)
    
    logger = logging.getLogger(__name__)
    
    # Simulate webhook payload
    repo_name = args.repo or f"tng-participants-{args.env.lower()}"
    
    payload = {
        "ref": "refs/heads/main",
        "repository": {
            "name": repo_name,
            "full_name": f"WorldHealthOrganization/{repo_name}"
        },
        "pusher": {
            "name": "test-user"
        },
        "head_commit": {
            "id": "abcd1234",
            "message": "Test participant update",
            "timestamp": datetime.now().isoformat()
        }
    }
    
    logger.info(f"Testing webhook for environment: {args.env}")
    logger.info(f"Repository: {repo_name}")
    
    if args.dry_run:
        logger.info("DRY RUN - would trigger webhook with payload:")
        import json
        print(json.dumps(payload, indent=2))
        return
    
    # Import and call webhook handler
    try:
        from webhook_handler import handle_webhook
        result = handle_webhook(payload)
        
        if result['status'] == 'success':
            logger.info("Webhook test completed successfully")
            logger.info(f"Result: {result['message']}")
        else:
            logger.error("Webhook test failed")
            logger.error(f"Error: {result['message']}")
            sys.exit(1)
            
    except ImportError as e:
        logger.error(f"Cannot import webhook_handler: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Webhook test failed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()