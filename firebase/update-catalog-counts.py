#!/usr/bin/env python3

"""
Update catalog.json with actual card counts from actual-card-counts.json
"""

import json
import os

def main():
    script_dir = os.path.dirname(__file__)
    counts_path = os.path.join(script_dir, 'actual-card-counts.json')
    catalog_path = os.path.join(script_dir, 'hosting', 'decks', 'decks.json')
    
    if not os.path.exists(counts_path):
        print("❌ actual-card-counts.json not found")
        print("   Run: python3 get-card-counts.py /path/to/decks/folder")
        return
    
    if not os.path.exists(catalog_path):
        print(f"❌ Catalog not found: {catalog_path}")
        return
    
    # Load actual counts
    with open(counts_path) as f:
        actual_counts = json.load(f)
    
    # Build lookup map: filename -> (count, size)
    count_map = {item['file']: {'count': item['count'], 'size': item['size']} for item in actual_counts}
    
    # Load catalog
    with open(catalog_path) as f:
        catalog = json.load(f)
    
    # Update counts
    updated = 0
    for deck in catalog['decks']:
        # Extract filename from URL
        url = deck['downloadUrl']
        filename = url.split('/')[-1].split('?')[0]  # Remove query params
        # URL decode
        import urllib.parse
        filename = urllib.parse.unquote(filename)
        # Extract just the filename (not the full path)
        filename = filename.split('/')[-1]
        
        if filename in count_map:
            old_count = deck.get('cardCount', 0)
            old_size = deck.get('size', 0)
            new_count = count_map[filename]['count']
            new_size = count_map[filename]['size']
            
            changed = False
            if old_count != new_count or old_size != new_size:
                print(f"📝 {deck['name']}")
                if old_count != new_count:
                    print(f"   Cards: {old_count} → {new_count}")
                if old_size != new_size:
                    old_mb = old_size / (1024 * 1024)
                    new_mb = new_size / (1024 * 1024)
                    print(f"   Size:  {old_mb:.1f} MB → {new_mb:.1f} MB")
                deck['cardCount'] = new_count
                deck['size'] = new_size
                updated += 1
    
    if updated > 0:
        # Save updated catalog
        with open(catalog_path, 'w') as f:
            json.dump(catalog, f, indent=2)
        
        print(f"\n✅ Updated {updated} deck counts in catalog.json")
        print("   Next: firebase deploy --only hosting")
    else:
        print("✅ All card counts are already accurate!")

if __name__ == '__main__':
    main()
