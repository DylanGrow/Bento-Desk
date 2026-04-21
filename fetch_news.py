import urllib.request
import xml.etree.ElementTree as ET
import json

feeds = {
    "nfl": "https://www.espn.com/espn/rss/nfl/news",
    "nba": "https://www.cbssports.com/rss/headlines/nba/",
    "mlb": "https://www.espn.com/espn/rss/mlb/news",
    "info": "https://www.informationweek.com/rss.xml",
    "wire": "https://news.yahoo.com/rss/world",
    "ap": "https://feeds.apnews.com/rss/topnews",
    "bbc": "http://feeds.bbci.co.uk/news/rss.xml",
    "npr": "https://feeds.npr.org/1001/rss.xml",
    "guardian": "https://www.theguardian.com/world/rss",
    "foxnews": "https://moxie.foxnews.com/google-publisher/latest.xml",
    "aljazeera": "https://www.aljazeera.com/xml/rss/all.xml"
}

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
output = {}

for category, url in feeds.items():
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            root = ET.fromstring(response.read())
            items = []
            for item in root.findall('.//item')[:25]:
                items.append({
                    "title": item.find('title').text,
                    "link": item.find('link').text
                })
            output[category] = items
    except Exception as e:
        output[category] = [{"title": f"Error loading {category}", "link": "#"}]

with open('data.json', 'w') as f:
    json.dump(output, f)
