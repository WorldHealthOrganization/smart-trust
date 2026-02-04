#!/usr/bin/env python3
"""
Calculate disk space savings from transforming embedded HTML to fetch-based loading.

This script analyzes:
1. Current size of *.json.html, *.xml.html, *.ttl.html files
2. Estimates space saved by removing embedded content
3. Shows statistics on savings per directory/format
"""

import os
import re
from pathlib import Path
from collections import defaultdict

def estimate_embedded_content_size(file_path: Path) -> tuple:
    """
    Estimate the size of embedded content in an HTML file.
    Returns (total_size, embedded_size, has_embedded_content)
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        total_size = len(content.encode('utf-8'))

        # Check if this file has been transformed (uses data-src)
        if 'data-src=' in content:
            # Already transformed - embedded content is gone
            # The file now just has the loader structure
            return total_size, 0, False

        # Look for embedded content in <pre><code>...</code></pre> blocks
        # Match the format-specific pre blocks
        patterns = [
            r'<pre[^>]*class="json"[^>]*><code[^>]*>.*?</code></pre>',
            r'<pre[^>]*class="xml"[^>]*><code[^>]*>.*?</code></pre>',
            r'<pre[^>]*class="rdf"[^>]*><code[^>]*>.*?</code></pre>',
        ]

        embedded_size = 0
        has_content = False

        for pattern in patterns:
            matches = re.findall(pattern, content, re.DOTALL)
            for match in matches:
                embedded_size += len(match.encode('utf-8'))
                has_content = True

        return total_size, embedded_size, has_content

    except Exception as e:
        print(f"  ❌ Error reading {file_path}: {e}")
        return 0, 0, False

def format_bytes(bytes_size):
    """Format bytes to human readable format."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_size < 1024.0:
            return f"{bytes_size:,.2f} {unit}"
        bytes_size /= 1024.0
    return f"{bytes_size:,.2f} TB"

def main():
    """Main function to calculate space savings."""
    script_dir = Path(__file__).parent

    print("=" * 80)
    print("DISK SPACE SAVINGS ANALYSIS")
    print("=" * 80)
    print(f"Root directory: {script_dir}")
    print()

    # Statistics storage
    formats = ['json', 'xml', 'ttl']
    stats = {
        'total_files': 0,
        'transformed_files': 0,
        'untransformed_files': 0,
        'total_size': 0,
        'embedded_size': 0,
        'by_format': defaultdict(lambda: {
            'count': 0,
            'transformed': 0,
            'total_size': 0,
            'embedded_size': 0
        }),
        'by_directory': defaultdict(lambda: {
            'count': 0,
            'total_size': 0,
            'embedded_size': 0
        })
    }

    # Find and analyze all format HTML files
    print("Analyzing files...")
    print("-" * 80)

    all_files = []
    for format_type in formats:
        pattern = f"**/*.{format_type}.html"
        files = list(script_dir.glob(pattern))
        all_files.extend([(f, format_type) for f in files])

    for file_path, format_type in sorted(all_files):
        total_size, embedded_size, has_embedded = estimate_embedded_content_size(file_path)

        stats['total_files'] += 1
        stats['total_size'] += total_size
        stats['embedded_size'] += embedded_size

        # By format
        stats['by_format'][format_type]['count'] += 1
        stats['by_format'][format_type]['total_size'] += total_size
        stats['by_format'][format_type]['embedded_size'] += embedded_size

        # By directory (top-level only)
        try:
            relative_path = file_path.relative_to(script_dir)
            top_dir = str(relative_path.parts[0]) if len(relative_path.parts) > 1 else 'root'
        except:
            top_dir = 'root'

        stats['by_directory'][top_dir]['count'] += 1
        stats['by_directory'][top_dir]['total_size'] += total_size
        stats['by_directory'][top_dir]['embedded_size'] += embedded_size

        if has_embedded:
            stats['untransformed_files'] += 1
            if embedded_size > 1024 * 100:  # Show files > 100KB embedded
                print(f"  📄 {file_path.relative_to(script_dir)}")
                print(f"     Total: {format_bytes(total_size)}, Embedded: {format_bytes(embedded_size)}")
        else:
            stats['transformed_files'] += 1
            if not ('data-src=' in open(file_path, 'r', encoding='utf-8').read()):
                stats['by_format'][format_type]['transformed'] += 1

    # Calculate savings
    potential_savings = stats['embedded_size']
    actual_savings = stats['embedded_size'] if stats['transformed_files'] > 0 else 0

    # Print summary
    print()
    print("=" * 80)
    print("OVERALL SUMMARY")
    print("=" * 80)
    print(f"Total HTML files:         {stats['total_files']:,}")
    print(f"  Transformed:            {stats['transformed_files']:,}")
    print(f"  Untransformed:          {stats['untransformed_files']:,}")
    print()
    print(f"Total disk space:         {format_bytes(stats['total_size'])}")
    print(f"Embedded content size:    {format_bytes(stats['embedded_size'])}")
    print(f"Space savings:            {format_bytes(potential_savings)}")
    print(f"Savings percentage:       {(potential_savings / stats['total_size'] * 100) if stats['total_size'] > 0 else 0:.1f}%")
    print()

    # By format breakdown
    print("=" * 80)
    print("BREAKDOWN BY FORMAT")
    print("=" * 80)
    for format_type in formats:
        fmt_stats = stats['by_format'][format_type]
        if fmt_stats['count'] > 0:
            print(f"\n{format_type.upper()} files:")
            print(f"  Count:                  {fmt_stats['count']:,}")
            print(f"  Total size:             {format_bytes(fmt_stats['total_size'])}")
            print(f"  Embedded content:       {format_bytes(fmt_stats['embedded_size'])}")
            if fmt_stats['total_size'] > 0:
                pct = (fmt_stats['embedded_size'] / fmt_stats['total_size'] * 100)
                print(f"  Savings:                {format_bytes(fmt_stats['embedded_size'])} ({pct:.1f}%)")

    # Top directories by savings
    print()
    print("=" * 80)
    print("TOP DIRECTORIES BY EMBEDDED CONTENT")
    print("=" * 80)
    sorted_dirs = sorted(
        stats['by_directory'].items(),
        key=lambda x: x[1]['embedded_size'],
        reverse=True
    )[:10]

    for dir_name, dir_stats in sorted_dirs:
        if dir_stats['embedded_size'] > 0:
            print(f"\n{dir_name}/")
            print(f"  Files:                  {dir_stats['count']:,}")
            print(f"  Total size:             {format_bytes(dir_stats['total_size'])}")
            print(f"  Embedded content:       {format_bytes(dir_stats['embedded_size'])}")

    print()
    print("=" * 80)
    print("✅ Analysis complete!")
    print("=" * 80)

if __name__ == '__main__':
    main()
