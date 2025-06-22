# C:\Users\tnszk\program\GitHub\backend\scripts\parser.py
from bs4 import BeautifulSoup
import re
import pandas as pd
from typing import List, Dict, Any, Optional
import io

def parse_race_ids_from_list(html_content: str) -> List[str]:
    soup = BeautifulSoup(html_content, 'lxml')
    race_ids = set()
    links = soup.find_all('a', href=re.compile(r"race_id=(\d{12})"))
    for link in links:
        match = re.search(r"race_id=(\d{12})", link.get("href", ""))
        if match:
            race_ids.add(match.group(1))
    return sorted(list(race_ids))

def parse_shutuba_page(html_content: str, race_id: str) -> Optional[Dict[str, Any]]:
    soup = BeautifulSoup(html_content, 'lxml')
    race_info_dict = {}
    horse_list = []
    try:
        race_list_item = soup.select_one(".RaceList_Item02")
        if race_list_item:
            race_name_elm = race_list_item.select_one(".RaceName")
            if race_name_elm: race_info_dict['race_name'] = race_name_elm.get_text(strip=True)
            race_data01_elm = race_list_item.select_one(".RaceData01")
            if race_data01_elm:
                race_data01 = race_data01_elm.get_text(strip=True)
                m_course = re.search(r'(芝|ダ|障)(\d+)m', race_data01)
                if m_course:
                    race_info_dict['course_type'] = m_course.group(1)
                    race_info_dict['distance'] = int(m_course.group(2))
                m_weather = re.search(r'天候:(\S+)', race_data01)
                if m_weather: race_info_dict['weather'] = m_weather.group(1)
                m_ground = re.search(r'馬場:(\S+)', race_data01)
                if m_ground: race_info_dict['ground_condition'] = m_ground.group(1)
        
        try:
            race_info_dict['race_number'] = int(race_id[-2:])
        except (ValueError, TypeError):
            print(f"[Warning] Could not determine race number for {race_id}")
            race_info_dict['race_number'] = None
            
        shutuba_table = soup.find("table", class_=re.compile(r"Shutuba_Table|RaceTable0[12]"))
        if not shutuba_table:
            return {'race_info': race_info_dict, 'horses': horse_list}

        rows = shutuba_table.find_all("tr", class_="HorseList")
        if not rows:
            all_tr = shutuba_table.find_all("tr")
            if len(all_tr) > 1: rows = all_tr[1:]
        
        race_info_dict['total_horses'] = len(rows)

        for row in rows:
            cols = row.find_all('td')
            if len(cols) < 8: continue
            horse_info_a = cols[3].find('a', href=re.compile(r'/horse/'))
            jockey_a = cols[5].find('a', href=re.compile(r'/jockey/'))
            trainer_a = cols[6].find('a', href=re.compile(r'/trainer/'))
            horse_weight_raw = cols[7].get_text(strip=True)
            weight_match = re.match(r'(\d+)\((.+)\)', horse_weight_raw)
            horse_weight = int(weight_match.group(1)) if weight_match else None
            horse_weight_diff_str = weight_match.group(2) if weight_match and weight_match.group(2) not in ('計不', ' F', ' ', '') else None
            horse_weight_diff = int(horse_weight_diff_str) if horse_weight_diff_str and horse_weight_diff_str.replace('-', '').isdigit() else None
            horse_list.append({
                'waku_number': int(cols[0].get_text(strip=True)) if cols[0].get_text(strip=True).isdigit() else None,
                'horse_number': int(cols[1].get_text(strip=True)) if cols[1].get_text(strip=True).isdigit() else None,
                'horse_id': re.search(r'/horse/(\w+)', horse_info_a['href']).group(1) if horse_info_a else None,
                'horse_name': horse_info_a.get_text(strip=True) if horse_info_a else None,
                'sex': cols[4].get_text(strip=True)[0] if cols[4].get_text(strip=True) else None,
                'age': int(cols[4].get_text(strip=True)[1:]) if len(cols[4].get_text(strip=True)) > 1 and cols[4].get_text(strip=True)[1:].isdigit() else None,
                'weight_carried': float(cols[5].get_text(strip=True)) if re.match(r'^\d+\.?\d*$', cols[5].get_text(strip=True)) else None,
                'jockey_name': jockey_a.get_text(strip=True) if jockey_a else None,
                'jockey_id': re.search(r'/jockey/result/recent/(\w+)', jockey_a['href']).group(1) if jockey_a and '/jockey/result/recent/' in jockey_a['href'] else None,
                'trainer_name': trainer_a.get_text(strip=True) if trainer_a else None,
                'trainer_id': re.search(r'/trainer/result/recent/(\w+)', trainer_a['href']).group(1) if trainer_a and '/trainer/result/recent/' in trainer_a['href'] else None,
                'horse_weight': horse_weight,
                'horse_weight_diff': horse_weight_diff,
            })
        return {'race_info': race_info_dict, 'horses': horse_list}
    except Exception as e:
        import traceback
        print(f"A critical error occurred while parsing shutuba page for race {race_id}:")
        traceback.print_exc()
        return None

def parse_horse_results_page(html_content: str) -> Optional[List[Dict[str, Any]]]:
    soup = BeautifulSoup(html_content, 'lxml')
    results_table = soup.find('table', class_='db_h_race_results')
    if not results_table:
        print("  - [Warning] Could not find the results table (.db_h_race_results).")
        return None
    
    results = []
    rows = results_table.find_all('tr')[1:]

    for row in rows:
        cols_text = [c.get_text(strip=True) for c in row.find_all('td')]
        cols_elm = row.find_all('td')
        if len(cols_text) < 27: continue
        
        try:
            race_link_a = cols_elm[4].find('a')
            race_id = None
            if race_link_a and 'href' in race_link_a.attrs:
                match = re.search(r'/race/(\d+)', race_link_a['href'])
                if match: race_id = match.group(1)
            
            if not race_id: continue

            dist_match = re.match(r'([^\d]+)(\d+)', cols_text[14])
            time_match = re.match(r'(\d+):(\d+\.\d+)', cols_text[17])
            weight_match = re.match(r'(\d+)\((.+)\)', cols_text[23])
            
            corner_positions_str = cols_text[20]
            corner_positions = [int(p) for p in corner_positions_str.split('-') if p.isdigit()]
            
            def safe_int(val): return int(val) if val and val.isdigit() else None
            def safe_float(val):
                try: return float(val)
                except (ValueError, TypeError): return None

            result_dict = {
                'race_id': race_id, 'race_date': pd.to_datetime(cols_text[0], errors='coerce').date(),
                'venue_name': re.sub(r'^\d+', '', cols_text[1]).strip(), 'weather': cols_text[2],
                'race_number': safe_int(cols_text[3]), 'race_name': cols_text[4],
                'total_horses': safe_int(cols_text[6]), 'waku_number': safe_int(cols_text[7]),
                'horse_number': safe_int(cols_text[8]), 'odds': safe_float(cols_text[9]),
                'popularity': safe_int(cols_text[10]), 'rank': safe_int(cols_text[11]),
                'jockey_name': cols_text[12].strip(), 'weight_carried': safe_float(cols_text[13]),
                'distance': int(dist_match.group(2)) if dist_match else None,
                'course_type': dist_match.group(1) if dist_match else None,
                'ground_condition': cols_text[15],
                'finish_time_sec': int(time_match.group(1)) * 60 + float(time_match.group(2)) if time_match else None,
                'time_diff': safe_float(cols_text[18]),
                'corner_positions': corner_positions,
                'agari_3f': safe_float(cols_text[22]),
                'horse_weight': int(weight_match.group(1)) if weight_match else None,
                'horse_weight_diff': int(w_diff) if weight_match and (w_diff := weight_match.group(2)) not in ('計不', ' F', ' ', '--') and w_diff.replace('-', '').isdigit() else None,
            }
            results.append(result_dict)
        except (ValueError, TypeError, IndexError, AttributeError) as e:
            print(f"  - [Warning] Skipping a row due to parsing error: {e}")
            continue
            
    print(f"  - Successfully parsed {len(results)} past results.")
    return results