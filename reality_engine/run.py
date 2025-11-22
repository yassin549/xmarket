#!/usr/bin/env python3
"""
Reality-engine poller entry point.

Usage:
    python run.py --backend-url http://localhost:8000
    python run.py --dry-run
    python run.py --backend-url http://localhost:8000 --dry-run --verbose
"""

import argparse
import logging
import sys

from reality_engine.poller import Poller


def setup_logging(verbose: bool = False):
    """
    Setup logging configuration.
    
    Args:
        verbose: If True, set DEBUG level, otherwise INFO
    """
    level = logging.DEBUG if verbose else logging.INFO
    
    logging.basicConfig(
        level=level,
        format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Reduce noise from libraries
    logging.getLogger('urllib3').setLevel(logging.WARNING)
    logging.getLogger('requests').setLevel(logging.WARNING)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Reality-engine poller for Everything Market',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry run (no actual POSTs)
  python run.py --dry-run
  
  # Connect to local backend
  python run.py --backend-url http://localhost:8000
  
  # Connect to remote backend with verbose logging
  python run.py --backend-url https://api.example.com --verbose
        """
    )
    
    parser.add_argument(
        '--backend-url',
        default='http://localhost:8000',
        help='Backend API base URL (default: http://localhost:8000)'
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Dry run mode (fetch and process but don\'t POST to backend)'
    )
    
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose (DEBUG) logging'
    )
    
    args = parser.parse_args()
    
    # Setup logging
    setup_logging(args.verbose)
    logger = logging.getLogger(__name__)
    
    # Print banner
    print("="*60)
    print("  Everything Market - Reality-Engine Poller")
    print("="*60)
    print(f"Backend URL: {args.backend_url}")
    print(f"Dry run:     {args.dry_run}")
    print(f"Verbose:     {args.verbose}")
    print("="*60)
    print()
    
    # Create and run poller
    try:
        poller = Poller(
            backend_url=args.backend_url,
            dry_run=args.dry_run
        )
        
        logger.info("Starting reality-engine poller...")
        poller.run()
    
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
        sys.exit(0)
    
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
