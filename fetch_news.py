import urllib.request
import xml.etree.ElementTree as ET
import json

feeds = {
    "world": "https://www.reutersagency.com/feed/?best-topics=world-news&post_type=best",
    "tech": "https://www.reutersagency.com/feed/?best-topics=tech&post_type=best",
    "sports": "https://www.reutersagency.com/feed/?best-topics=sports&post_type=best",
    "science": "https://www.popsci.com/feed/",
    "local": "https://www.pilotonline.com/arc/outboundfeeds/rss/category/news/local/",
    "quotes": "https://www.quotationspage.com/data/qotd.rss"
}

headers = {'User-Agent': 'Mozilla/5.0'}
output = {}

for category, url in feeds.items():
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            root = ET.fromstring(response.read())
            items = []
            for item in root.findall('.//item')[:8]:
                items.append({
                    "title": item.find('title').text,
                    "link": item.find('link').text
                })
            output[category] = items
    except:
        output[category] = []

with open('data.json', 'w') as f:
    json.dump(output, f)
