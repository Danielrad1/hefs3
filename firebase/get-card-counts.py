#!/usr/bin/env python3

"""
Extract actual card counts from .apkg files
Usage: python3 get-card-counts.py /path/to/decks/folder
"""

import sys
import os
import sqlite3
import zipfile
import tempfile
import shutil
import json
from pathlib import Path

def get_card_count(apkg_path):
    """Extract card count from .apkg file"""
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            # Extract .apkg (it's a zip file)
            with zipfile.ZipFile(apkg_path, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)
            
            # Find the collection database
            db_path = None
            for db_name in ['collection.anki21', 'collection.anki2']:
                potential_path = os.path.join(temp_dir, db_name)
                if os.path.exists(potential_path):
                    db_path = potential_path
                    break
            
            if not db_path:
                return None
            
            # Query card count
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM cards")
            count = cursor.fetchone()[0]
            conn.close()
            
            return count
    except Exception as e:
        print(f"  ⚠️  Error: {e}", file=sys.stderr)
        return None

def main():
    if len(sys.argv) < 2:
        print("❌ Usage: python3 get-card-counts.py /path/to/decks/folder")
        sys.exit(1)
    
    decks_path = sys.argv[1]
    
    if not os.path.exists(decks_path):
        print(f"❌ Directory not found: {decks_path}")
        sys.exit(1)
    
    print(f"🔍 Scanning decks in: {decks_path}\n")
    
    # Find all .apkg files
    apkg_files = []
    for root, dirs, files in os.walk(decks_path):
        for file in files:
            if file.endswith('.apkg'):
                apkg_files.append(os.path.join(root, file))
    
    if not apkg_files:
        print("❌ No .apkg files found")
        sys.exit(1)
    
    print(f"Found {len(apkg_files)} .apkg files\n")
    print("=" * 80)
    
    results = []
    
    for file_path in sorted(apkg_files):
        rel_path = os.path.relpath(file_path, decks_path)
        file_name = os.path.basename(file_path)
        folder = os.path.basename(os.path.dirname(file_path))
        file_size = os.path.getsize(file_path)
        size_mb = file_size / (1024 * 1024)
        
        print(f"📦 {file_name}... ", end='', flush=True)
        
        count = get_card_count(file_path)
        
        if count is not None:
            print(f"✓ {count} cards ({size_mb:.1f} MB)")
            results.append({
                'folder': folder,
                'file': file_name,
                'path': rel_path,
                'count': count,
                'size': file_size
            })
        else:
            print("✗ Failed")
    
    print("=" * 80)
    print(f"\n✅ Successfully read {len(results)} out of {len(apkg_files)} decks\n")
    
    # Group by folder
    by_folder = {}
    for r in results:
        if r['folder'] not in by_folder:
            by_folder[r['folder']] = []
        by_folder[r['folder']].append(r)
    
    print("📊 Card Counts by Folder:\n")
    
    for folder in sorted(by_folder.keys()):
        print(f"\n📁 {folder}:")
        for r in sorted(by_folder[folder], key=lambda x: x['file']):
            size_mb = r['size'] / (1024 * 1024)
            print(f"  {r['file']:<60} {r['count']:>6} cards  {size_mb:>7.1f} MB")
    
    # Save to JSON
    output_path = os.path.join(os.path.dirname(__file__), 'actual-card-counts.json')
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n💾 Full results saved to: {output_path}")
    print("\n🔧 To update catalog.json, run:")
    print("   python3 update-catalog-counts.py")

if __name__ == '__main__':
    main()
