import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
import json
import time
import re
import os
import html
from urllib.parse import urlparse, urljoin
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
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8"
}

MAX_TOTAL_ITEMS = 300
MAX_PER_CATEGORY = 16
MAX_WORKERS = 8

OUTPUT_FILE = "data.json"
BACKUP_FILE = "data_backup.json"


# ---------------------------
# HELPERS
# ---------------------------

def fetch_xml(url):
    req = urllib.request.Request(url, headers=HEADERS)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                return response.read().strip()
        except (urllib.error.URLError, Exception) as e:
            if attempt == 2:
                raise e
            time.sleep(1)


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
        if not val:
            # atom namespace
            val = item.findtext("{http://www.w3.org/2005/Atom}" + f)
        if val:
            try:
                return int(parsedate_to_datetime(val).timestamp())
            except:
                continue
    return int(time.time())


def parse_rss(xml_data, category, base_url):
    try:
        root = ET.fromstring(xml_data)
    except ET.ParseError:
        return []

    items = []

    # Handle both RSS <item> and Atom <entry>
    elements = root.findall(".//item")
    if not elements:
        elements = root.findall(".//{http://www.w3.org/2005/Atom}entry")
        if not elements:
            elements = root.findall(".//entry")

    for item in elements:
        # Title extraction
        title_el = item.find("title")
        if title_el is None:
            title_el = item.find("{http://www.w3.org/2005/Atom}title")
            
        title = title_el.text.strip() if title_el is not None and title_el.text else "No Title"
        title = html.unescape(title)[:250]  # Unescape HTML entities and truncate

        # Link extraction
        link = item.findtext("link")
        if not link:
            link_el = item.find("{http://www.w3.org/2005/Atom}link")
            if link_el is not None:
                link = link_el.attrib.get("href", "")
            else:
                link_el = item.find("link")
                if link_el is not None and "href" in link_el.attrib:
                    link = link_el.attrib.get("href", "")

        link = link.strip() if link else "#"
        if link != "#":
            link = urljoin(base_url, link)  # Handle relative URLs natively

        if title == "No Title" or link == "#":
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
            return parse_rss(xml_data, category, url)
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
            # Restrict dedup to a 72-hour rolling window
            time_diff = abs(item["timestamp"] - existing["timestamp"])
            if time_diff < 259200 and similarity(item["_norm"], existing["_norm"]) > 0.75:
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

    # write output + backup atomically
    temp_out = OUTPUT_FILE + ".tmp"
    temp_backup = BACKUP_FILE + ".tmp"
    
    try:
        with open(temp_out, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
            
        with open(temp_backup, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False)
            
        os.replace(temp_out, OUTPUT_FILE)
        os.replace(temp_backup, BACKUP_FILE)

        print(f"[SUCCESS] Wrote {len(all_items)} items")

    except Exception as e:
        print("[ERROR] Writing failed, attempting fallback...", e)
        
        # Cleanup partial temps
        if os.path.exists(temp_out): os.remove(temp_out)
        if os.path.exists(temp_backup): os.remove(temp_backup)

        if os.path.exists(BACKUP_FILE):
            try:
                with open(BACKUP_FILE, "r", encoding="utf-8") as f:
                    backup_data = json.load(f)

                with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                    json.dump(backup_data, f, ensure_ascii=False, indent=2)

                print("[RECOVERY] Restored from backup")
            except Exception as fallback_e:
                print("[FATAL] Fallback failed:", fallback_e)


if __name__ == "__main__":
    main()
