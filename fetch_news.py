import urllib.request
import xml.etree.ElementTree as ET
import json

feeds = {
    "nfl": "https://www.espn.com/espn/rss/nfl/news",
    "nba": "https://www.cbssports.com/rss/headlines/nba/",
    "mlb": "https://www.espn.com/espn/rss/mlb/news",
    "tech": "https://www.informationweek.com/rss.xml",
    "hacker": "https://hnrss.org/frontpage",
    "cyber": "https://thehackernews.com/feeds/posts/default?alt=rss",
    "gaming": "https://www.polygon.com/rss/index.xml",
    "space": "https://www.space.com/feeds/all",
    "science": "https://www.sciencedaily.com/rss/top/science.xml"
}

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
output = {}

for category, url in feeds.items():
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            root = ET.fromstring(response.read())
            items = []
            for item in root.findall('.//item')[:25]:
                title = item.find('title')
                link = item.find('link')
                if title is not None and link is not None:
                    items.append({"title": title.text, "link": link.text})
            output[category] = items
    except Exception as e:
        output[category] = [] 

with open('data.json', 'w') as f:
    json.dump(output, f)
