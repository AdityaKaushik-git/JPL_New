import openpyxl
import pymysql
import os
import re
import sys
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding='utf-8')

load_dotenv(dotenv_path='.env')

DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = int(os.getenv('DB_PORT', 3306))
DB_USER = os.getenv('DB_USER', 'root')
DB_PASS = os.getenv('DB_PASS', '')
DB_NAME = os.getenv('DB_NAME', 'defaultdb')
DB_SSL = os.getenv('DB_SSL', 'false').lower() == 'true'

def parse_price(val_str):
    if not val_str:
        return 1000000
    s = str(val_str).replace('₹', '').replace(',', '').strip()
    if 'Cr' in s or 'cr' in s or 'Crore' in s:
        m = re.search(r'[\d\.]+', s)
        if m:
            return int(float(m.group()) * 10000000)
    if 'Lakh' in s or 'lakh' in s or 'L' in s:
        m = re.search(r'[\d\.]+', s)
        if m:
            return int(float(m.group()) * 100000)
    try:
        return int(float(s))
    except:
        return 1000000

def parse_points(val):
    if val is None:
        return 0
    s = re.sub(r'[^\d]', '', str(val))
    try:
        return int(s) if s else 0
    except:
        return 0

COUNTRY_CODES = {
    'India': 'IND', 'Pakistan': 'PAK', 'England': 'ENG', 'Australia': 'AUS',
    'Afghanistan': 'AFG', 'South Africa': 'SA', 'West Indies': 'WI', 'New Zealand': 'NZ',
    'Zimbabwe': 'ZIM', 'Bangladesh': 'BAN', 'Ireland': 'IRE', 'Scotland': 'SCO',
    'Sri Lanka': 'SL', 'Netherlands': 'NED', 'Namibia': 'NAM', 'Nepal': 'NEP',
    'Oman': 'OMA', 'USA': 'USA', 'UAE': 'UAE', 'Canada': 'CAN', 'Jersey': 'JEY'
}

def get_country_code(c_name):
    if not c_name: return 'IND'
    c_clean = str(c_name).strip()
    return COUNTRY_CODES.get(c_clean, c_clean[:3].upper())

def import_players():
    print("Reading Excel file: player list.xlsx ...")
    wb = openpyxl.load_workbook('player list.xlsx')
    
    parsed_players = []
    
    for sheet_name in wb.sheetnames:
        sheet = wb[sheet_name]
        rows = list(sheet.iter_rows(values_only=True))
        if not rows: continue
        headers = [str(h).strip() if h else '' for h in rows[0]]
        
        for r in rows[1:]:
            if not any(r): continue
            d = dict(zip(headers, r))
            name = d.get('Player Name') or d.get('Player')
            if not name: continue
            name = str(name).strip()
            
            country = str(d.get('Country') or 'India').strip()
            points = parse_points(d.get('Points'))
            raw_price = d.get('Auction price') or d.get('Base Price')
            base_price = parse_price(raw_price)
            
            if sheet_name == 'uncapped':
                is_uncapped = 1
                raw_role = str(d.get('Role', '')).strip()
                if 'Wicket' in raw_role or 'Keeper' in raw_role:
                    role = 'Wicket Keeper'
                elif 'Bowler' in raw_role:
                    role = 'Bowler'
                elif 'Rounder' in raw_role or 'All' in raw_role:
                    role = 'All-Rounder'
                else:
                    role = 'Batsman'
            else:
                is_uncapped = 0
                if sheet_name == 'batsman':
                    role = 'Batsman'
                elif sheet_name == 'Wicket keeper':
                    role = 'Wicket Keeper'
                elif sheet_name == 'bowler':
                    role = 'Bowler'
                elif sheet_name == 'all rounder':
                    role = 'All-Rounder'
                else:
                    role = 'Batsman'
                    
            parsed_players.append({
                'name': name,
                'role': role,
                'country': country,
                'country_code': get_country_code(country),
                'is_uncapped': is_uncapped,
                'points': points,
                'base_price': base_price
            })
            
    print(f"Total players parsed from Excel: {len(parsed_players)}")
    
    # Calculate ranks
    sorted_overall = sorted(parsed_players, key=lambda x: (-x['points'], x['name']))
    for idx, p in enumerate(sorted_overall, start=1):
        p['current_rank'] = idx
        
    by_category = {}
    for p in parsed_players:
        by_category.setdefault(p['role'], []).append(p)
        
    for role_name, cat_list in by_category.items():
        cat_sorted = sorted(cat_list, key=lambda x: (-x['points'], x['name']))
        for idx, p in enumerate(cat_sorted, start=1):
            p['category_rank'] = idx
            
    # Connect to DB
    ssl_config = {'ssl': {'ssl': True}} if DB_SSL else {}
    conn = pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASS,
        database=DB_NAME,
        autocommit=False,
        **ssl_config
    )
    
    try:
        with conn.cursor() as cursor:
            print("Cleaning existing players and dependent auction/team data from DB...")
            cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")
            cursor.execute("TRUNCATE TABLE bids;")
            cursor.execute("TRUNCATE TABLE auction_results;")
            cursor.execute("TRUNCATE TABLE auctions;")
            cursor.execute("TRUNCATE TABLE teams;")
            cursor.execute("TRUNCATE TABLE player_matches;")
            cursor.execute("TRUNCATE TABLE ranking_history;")
            cursor.execute("TRUNCATE TABLE players;")
            cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")
            
            # Reset franchise stats
            cursor.execute("""
                UPDATE users SET
                    purse = starting_purse,
                    total_spent = 0,
                    squad_count = 0,
                    batsmen_count = 0,
                    bowlers_count = 0,
                    allrounders_count = 0,
                    keepers_count = 0,
                    foreign_count = 0,
                    uncapped_count = 0
                WHERE role = 'user';
            """)
            
            print("Inserting 280 Excel players into DB...")
            insert_sql = """
                INSERT INTO players (
                    player_code, auction_order, name, playing_role, country, country_code,
                    is_uncapped, course, year, enrollment_number, base_price, status,
                    ranking_points, previous_ranking_points, form_points, matches,
                    current_rank, previous_rank, category_rank, previous_category_rank,
                    base_price_auto
                ) VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s, 'N/A', 'N/A', %s, %s, 'Available',
                    %s, %s, %s, 10,
                    %s, %s, %s, %s,
                    0
                )
            """
            
            for i, p in enumerate(parsed_players, start=1):
                p_code = f"JPL{i:03d}"
                e_num = f"EXCEL{i:03d}"
                form_pts = min(100, max(0, int(p['points'] / 10)))
                
                cursor.execute(insert_sql, (
                    p_code, i, p['name'], p['role'], p['country'], p['country_code'],
                    p['is_uncapped'], e_num, p['base_price'],
                    p['points'], p['points'], form_pts,
                    p['current_rank'], p['current_rank'], p['category_rank'], p['category_rank']
                ))
                
        conn.commit()
        print("✅ Database successfully wiped and re-populated with 280 Excel players!")
    except Exception as e:
        conn.rollback()
        print("❌ Error during DB import:", e)
        raise e
    finally:
        conn.close()

if __name__ == '__main__':
    import_players()
