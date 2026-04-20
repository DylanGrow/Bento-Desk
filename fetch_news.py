import urllib.request
import xml.etree.ElementTree as ET
import json

feeds = {
    "nfl": "https://www.espn.com/espn/rss/nfl/news",
    "nba": "https://www.cbssports.com/rss/headlines/nba/",
    "mlb": "https://api.foxsports.com/v1/rss?partnerKey=zBaFxRyGKCfxBagJG9b8pqLyndmvo7UU&tag=mlb",
    "world": "https://www.reutersagency.com/feed/?best-topics=world-news&post_type=best",
    "infoweek": "https://www.informationweek.com/rss.xml"
}

headers = {'User-Agent': 'Mozilla/5.0'}
output = {}

for category, url in feeds.items():
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            root = ET.fromstring(response.read())
            items = []
            for item in root.findall('.//item')[:20]:
                items.append({"title": item.find('title').text, "link": item.find('link').text})
            output[category] = items
    except:
        output[category] = []

with open('data.json', 'w') as f:
    json.dump(output, f)
