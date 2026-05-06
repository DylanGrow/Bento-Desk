import urllib.request
import xml.etree.ElementTree as ET
import json
import time
import re
import os
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from email.utils import parsedate_to_datetime

# ---------------------------
# CONFIG
# ---------------------------

FEEDS = {
    "nfl": [
        "https://feeds.nfl.com/feeds-rs/news/nfl/",
        "https://www.espn.com/espn/rss/nfl/news"
    ],
    "nba": [
        "https://www.cbssports.com/rss/headlines/nba/"
    ],
    "mlb": [
        "https://feeds.mlb.com/feed/",
        "https://www.espn.com/espn/rss/mlb/news"
    ],
    "tech": [
        "https://techcrunch.com/feed/"
    ],
    "hacker": [
        "https://feeds.arstechnica.com/arstechnica/index"
    ],
    "cyber": [
        "https://www.bleepingcomputer.com/feed/"
    ],
    "gaming": [
        "https://feeds.ign.com/ign/news"
    ],
    "space": [
        "https://www.space.com/feeds/all"
    ],
    "science": [
        "https://www.sciencedaily.com/rss/top/science.xml"
    ]
}

HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/rss+xml, application/xml;q=0.9, */*;q=0.8"
}

MAX_TOTAL_ITEMS = 100
MAX_PER_CATEGORY = 3
MAX_WORKERS = 8

OUTPUT_FILE = "data.json"
BACKUP_FILE = "data_backup.json"


# ---------------------------
# HELPERS
# ---------------------------

def fetch_xml(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as response:
        return response.read().strip()


def extract_source(link):
    try:
        domain = urlparse(link).netloc.lower()
        domain = domain.replace("www.", "")
        return domain.split(".")[0].upper()
    except:
        return "UNKNOWN"


def normalize_title(title):
    title = title.lower()
    title = re.sub(r"[^\w\s]", "", title)
    title = re.sub(r"\s+", " ", title)
    return title.strip()


def similarity(a, b):
    # simple overlap similarity (fast + cheap)
    set_a = set(a.split())
    set_b = set(b.split())
    if not set_a or not set_b:
        return 0
    return len(set_a & set_b) / len(set_a | set_b)


def parse_date(item):
    fields = ["pubDate", "published", "updated"]
    for f in fields:
        val = item.findtext(f)
        if val:
            try:
                return int(parsedate_to_datetime(val).timestamp())
            except:
                continue
    return int(time.time())


def parse_rss(xml_data, category):
    root = ET.fromstring(xml_data)
    items = []

    for item in root.findall(".//item"):
        title = item.findtext("title", default="No Title").strip()
        link = item.findtext("link", default="#").strip()

        if not title or not link:
            continue

        timestamp = parse_date(item)

        items.append({
            "title": title,
            "link": link,
            "source": extract_source(link),
            "category": category,
            "timestamp": timestamp,
            "_norm": normalize_title(title)  # internal use
        })

    return items


def fetch_category(category, urls):
    for url in urls:
        try:
            xml_data = fetch_xml(url)
            return parse_rss(xml_data, category)
        except Exception:
            continue
    return []


# ---------------------------
# DEDUP
# ---------------------------

def deduplicate(items):
    result = []

    for item in sorted(items, key=lambda x: x["timestamp"], reverse=True):
        is_duplicate = False

        for existing in result:
            if similarity(item["_norm"], existing["_norm"]) > 0.75:
                is_duplicate = True
                break

        if not is_duplicate:
            result.append(item)

    return result


# ---------------------------
# MAIN
# ---------------------------

def main():
    all_items = []

    # concurrent fetch
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {
            executor.submit(fetch_category, cat, urls): cat
            for cat, urls in FEEDS.items()
        }

        for future in as_completed(futures):
            category = futures[future]
            try:
                items = future.result()
                # limit per category early
                items = sorted(items, key=lambda x: x["timestamp"], reverse=True)
                all_items.extend(items[:MAX_PER_CATEGORY])
            except Exception as e:
                print(f"[ERROR] {category}: {e}")

    # dedup globally
    all_items = deduplicate(all_items)

    # final sort
    all_items = sorted(all_items, key=lambda x: x["timestamp"], reverse=True)

    # enforce global cap
    all_items = all_items[:MAX_TOTAL_ITEMS]

    # remove internal fields
    for item in all_items:
        item.pop("_norm", None)

    output = {
        "last_updated": int(time.time()),
        "items": all_items
    }

    # write output + backup
    try:
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)

        with open(BACKUP_FILE, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False)

        print(f"[SUCCESS] Wrote {len(all_items)} items")

    except Exception as e:
        print("[ERROR] Writing failed, attempting fallback...", e)

        if os.path.exists(BACKUP_FILE):
            with open(BACKUP_FILE, "r", encoding="utf-8") as f:
                backup_data = json.load(f)

            with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                json.dump(backup_data, f, ensure_ascii=False, indent=2)

            print("[RECOVERY] Restored from backup")


if __name__ == "__main__":
    main()
