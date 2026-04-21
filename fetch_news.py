import urllib.request
import xml.etree.ElementTree as ET
import json

feeds = {
    "nfl": "https://www.espn.com/espn/rss/nfl/news",
    "nba": "https://www.cbssports.com/rss/headlines/nba/",
    "mlb": "https://www.espn.com/espn/rss/mlb/news",
    "tech": "https://techcrunch.com/feed/",
    "hacker": "https://feeds.arstechnica.com/arstechnica/index",
    "cyber": "https://www.bleepingcomputer.com/feed/",
    "gaming": "https://feeds.ign.com/ign/news",
    "space": "https://www.space.com/feeds/all",
    "science": "https://www.sciencedaily.com/rss/top/science.xml"
}

# Upgraded headers to bypass basic anti-bot blocks
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
}
output = {}

for category, url in feeds.items():
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as response:
            # Some feeds have leading whitespace, so we strip it before parsing
            xml_data = response.read().strip()
            root = ET.fromstring(xml_data)
            items = []
            
            # Find all item tags (handles standard RSS structure)
            for item in root.findall('.//item')[:25]:
                title_elem = item.find('title')
                link_elem = item.find('link')
                
                if title_elem is not None and link_elem is not None:
                    items.append({
                        "title": title_elem.text.strip() if title_elem.text else "No Title", 
                        "link": link_elem.text.strip() if link_elem.text else "#"
                    })
            output[category] = items
    except Exception as e:
        # If a single feed fails, it prints an error but doesn't crash the whole script
        output[category] = [] 
        print(f"Failed to load {category}: {e}")

with open('data.json', 'w') as f:
    json.dump(output, f)
