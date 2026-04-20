import urllib.request
import xml.etree.ElementTree as ET
import json

feeds = {
    "wire": "http://feeds.bbci.co.uk/news/world/rss.xml",
    "stack": "https://feeds.arstechnica.com/arstechnica/index"
}

output = {}

for category, url in feeds.items():
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        xml_data = response.read()
        root = ET.fromstring(xml_data)
        
        items = []
        for item in root.findall('.//item')[:3]: 
            items.append({
                "title": item.find('title').text,
                "link": item.find('link').text
            })
        output[category] = items

with open('data.json', 'w') as f:
    json.dump(output, f)
