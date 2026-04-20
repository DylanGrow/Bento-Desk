import urllib.request
import xml.etree.ElementTree as ET
import json

# Expanded feed list with InformationWeek and deep spam depth
feeds = {
    "world": "https://www.reutersagency.com/feed/?best-topics=world-news&post_type=best",
    "infoweek": "https://www.informationweek.com/rss.xml",
    "tech": "https://www.reutersagency.com/feed/?best-topics=tech&post_type=best",
    "sports_news": "https://www.reutersagency.com/feed/?best-topics=sports&post_type=best",
    "local": "https://www.pilotonline.com/arc/outboundfeeds/rss/category/news/local/",
}

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
output = {}

for category, url in feeds.items():
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            root = ET.fromstring(response.read())
            items = []
            # Pulling 25 items for that "spam" feel
            for item in root.findall('.//item')[:25]:
                items.append({
                    "title": item.find('title').text,
                    "link": item.find('link').text
                })
            output[category] = items
    except:
        output[category] = []

with open('data.json', 'w') as f:
    json.dump(output, f)
