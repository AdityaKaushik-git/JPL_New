import pymysql
import requests
import json
import os
import re
import sys
import time
from urllib.parse import quote
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding='utf-8')

load_dotenv(dotenv_path='.env')

DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = int(os.getenv('DB_PORT', 3306))
DB_USER = os.getenv('DB_USER', 'root')
DB_PASS = os.getenv('DB_PASS', '')
DB_NAME = os.getenv('DB_NAME', 'defaultdb')
DB_SSL = os.getenv('DB_SSL', 'false').lower() == 'true'

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
}

CRICKET_DOMAINS = [
    'espncricinfo.com', 'cricbuzz.com', 'wikimedia.org', 'wikipedia.org',
    'bcci.tv', 'iplt20.com', 'icc-cricket.com', 'crictracker.com',
    'wisden.com', 'sportskeeda.com', 'espncdn.com', 'gettyimages.com'
]

BAD_KEYWORDS = [
    'clipart', 'logo', 'icon', 'vector', 'flag', 'stadium', 'map', 'tyre',
    'mitochondri', 'anatomy', 'poster', 'wallpaper', 'drawing', 'sketch', 'car'
]

def search_wikimedia_cricketer(name):
    try:
        time.sleep(0.8) # Prevent rate limiting
        url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={quote('\"' + name + '\" cricket')}&format=json"
        res = requests.get(url, headers=headers, timeout=2.5).json()
        items = res.get("query", {}).get("search", [])
        if items:
            title = items[0]["title"]
            img_url = f"https://en.wikipedia.org/w/api.php?action=query&titles={quote(title)}&prop=pageimages|extracts&exintro=1&exchars=200&pithumbsize=500&format=json"
            data = requests.get(img_url, headers=headers, timeout=2.5).json()
            pages = data.get("query", {}).get("pages", {})
            for pid, pdata in pages.items():
                extract = pdata.get("extract", "").lower()
                if any(k in extract for k in ["cricket", "batsman", "bowler", "ipl", "all-rounder"]):
                    if "thumbnail" in pdata:
                        src = pdata["thumbnail"]["source"]
                        if not any(x in src.lower() for x in ['flag', 'logo', 'map', 'icon', 'symbol']):
                            return src, "Wikimedia"
    except Exception:
        pass
    return None, None

def fetch_photo_for_player(name):
    url, src = search_wikimedia_cricketer(name)
    if not url:
        url = f"https://ui-avatars.com/api/?name={quote(name)}&size=500&background=1a1f2e&color=f2c14e&bold=true&format=png"
        src = "UI Avatars"
    return url, src

def update_all_player_photos():
    ssl_config = {'ssl': {'ssl': True}} if DB_SSL else {}
    conn = pymysql.connect(
        host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASS, database=DB_NAME,
        autocommit=True, **ssl_config
    )
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, name, playing_role, country FROM players ORDER BY id")
            players = cursor.fetchall()
            print(f"Fetched {len(players)} players from database.", flush=True)
            
            updated_count = 0
            for p_id, p_name, p_role, p_country in players:
                photo_url, source = fetch_photo_for_player(p_name)
                cursor.execute(
                    "UPDATE players SET image_url = %s, image_source = %s WHERE id = %s",
                    (photo_url, source, p_id)
                )
                updated_count += 1
                print(f"[{updated_count}/{len(players)}] Updated #{p_id} {p_name} ({source})", flush=True)
                
            print(f"\n✅ Successfully updated photo URLs for all {updated_count} players in DB!", flush=True)
    finally:
        conn.close()

if __name__ == '__main__':
    update_all_player_photos()
