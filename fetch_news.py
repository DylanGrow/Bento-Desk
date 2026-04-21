import urllib.request
import xml.etree.ElementTree as ET
import json

# Sources mapped to your specific 3-axis request
feeds = {
    "nfl": "https://www.espn.com/espn/rss/nfl/news",
    "nba": "https://www.cbssports.com/rss/headlines/nba/",
"mlb": "https://www.espn.com/espn/rss/mlb/news",
"wire": "https://feeds.reuters.com/reuters/topNews",
    "info": "https://www.informationweek.com/rss.xml"
}

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
output = {}

for category, url in feeds.items():
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            root = ET.fromstring(response.read())
            items = []
            for item in root.findall('.//item')[:25]: # Deep spam depth
                items.append({
                    "title": item.find('title').text,
                    "link": item.find('link').text
                })
            output[category] = items
    except Exception as e:
        output[category] = [{"title": f"Error loading {category}", "link": "#"}]

with open('data.json', 'w') as f:
    json.dump(output, f)
