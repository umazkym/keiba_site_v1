# C:\Users\tnszk\program\GitHub\backend\scripts\parser.py
from bs4 import BeautifulSoup
import re
import pandas as pd
from typing import List, Dict, Any, Optional
from collections import defaultdict
import datetime

def _extract_id_from_href(href: Optional[str]) -> Optional[str]:
    """
    馬、騎手、調教師のリンクURLからIDを抽出するヘルパー関数。
    複数のURLパターンに対応します。
    例: /horse/2020104511, /jockey/01187/, /jockey/result/recent/01187, /trainer/01133/
    """
    if not href:
        return None
    # r'/(?:horse|jockey|trainer)/.../(\w+)' という正規表現でID部分を抽出
    match = re.search(r'/(?:horse|jockey|trainer)/(?:[a-zA-Z0-9_/]+/)?(\w+)', href)
    if match:
        # 最後のグループ（ID部分）を返す
        return match.groups()[-1]
    return None

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
            if race_name_elm: race_info_dict['race_name'] = race_name_elm.get_text(strip=True).replace("\n", "").strip()
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
            
        shutuba_table = soup.find("table", class_=re.compile(r"Shutuba_Table|RaceTable0[12]|race_table_01", re.IGNORECASE))
        if not shutuba_table:
            horse_links = soup.select('a[href*="/horse/"]')
            for link in horse_links:
                table = link.find_parent('table')
                if table and len(table.find_all('tr')) > 3:
                    shutuba_table = table
                    print("[Info] Found shutuba table using fallback method.")
                    break
        
        if not shutuba_table:
            print("[Error] Shutuba table could not be found.")
            return {'race_info': race_info_dict, 'horses': []}

        rows = shutuba_table.find_all("tr")
        rows = [row for row in rows if row.find('td', class_=re.compile("HorseInfo"))]
        
        race_info_dict['total_horses'] = len(rows)

        for row in rows:
            cols = row.find_all('td')
            if len(cols) < 8: continue
            
            horse_info_cell = row.find('td', class_=re.compile("HorseInfo", re.IGNORECASE)) or cols[3]
            jockey_cell = row.find('td', class_=re.compile("Jockey", re.IGNORECASE)) or cols[6]
            trainer_cell = row.find('td', class_=re.compile("Trainer", re.IGNORECASE)) or cols[7]
            weight_cell = row.find('td', class_=re.compile("Weight", re.IGNORECASE)) or cols[8]
            waku_cell = row.find('td', class_=re.compile("Waku", re.IGNORECASE)) or cols[0]
            umaban_cell = row.find('td', class_=re.compile("Umaban", re.IGNORECASE)) or cols[1]
            sex_age_cell = cols[4] 
            kinryo_cell = cols[5] 
            
            horse_info_a = horse_info_cell.find('a', href=re.compile(r'/horse/'))
            jockey_a = jockey_cell.find('a', href=re.compile(r'/jockey/'))
            trainer_a = trainer_cell.find('a', href=re.compile(r'/trainer/'))

            horse_id = _extract_id_from_href(horse_info_a.get('href')) if horse_info_a else None
            jockey_id = _extract_id_from_href(jockey_a.get('href')) if jockey_a else None
            trainer_id = _extract_id_from_href(trainer_a.get('href')) if trainer_a else None

            horse_weight_raw = weight_cell.get_text(strip=True)
            weight_match = re.match(r'(\d+)\((.+)\)', horse_weight_raw)
            horse_weight = int(weight_match.group(1)) if weight_match else None
            horse_weight_diff_str = weight_match.group(2) if weight_match and weight_match.group(2) not in ('計不', ' F', ' ', '') else None
            horse_weight_diff = int(horse_weight_diff_str) if horse_weight_diff_str and horse_weight_diff_str.replace('-', '').isdigit() else None
            
            horse_list.append({
                'waku_number': int(waku_cell.get_text(strip=True)) if waku_cell and waku_cell.get_text(strip=True).isdigit() else None,
                'horse_number': int(umaban_cell.get_text(strip=True)) if umaban_cell and umaban_cell.get_text(strip=True).isdigit() else None,
                'horse_id': horse_id,
                'horse_name': horse_info_a.get_text(strip=True) if horse_info_a else None,
                'sex': sex_age_cell.get_text(strip=True)[0] if sex_age_cell and sex_age_cell.get_text(strip=True) else None,
                'age': int(sex_age_cell.get_text(strip=True)[1:]) if sex_age_cell and len(sex_age_cell.get_text(strip=True)) > 1 and sex_age_cell.get_text(strip=True)[1:].isdigit() else None,
                'weight_carried': float(kinryo_cell.get_text(strip=True)) if kinryo_cell and re.match(r'^\d+\.?\d*$', kinryo_cell.get_text(strip=True)) else None,
                'jockey_name': jockey_a.get_text(strip=True) if jockey_a else None,
                'jockey_id': jockey_id,
                'trainer_name': trainer_a.get_text(strip=True) if trainer_a else None,
                'trainer_id': trainer_id,
                'horse_weight': horse_weight,
                'horse_weight_diff': horse_weight_diff,
            })
        return {'race_info': race_info_dict, 'horses': horse_list}
    except Exception as e:
        import traceback
        print(f"A critical error occurred while parsing shutuba page for race {race_id}:")
        traceback.print_exc()
        return None

# ★★★★★ ここから修正 ★★★★★
def parse_horse_results_page(html_content: str) -> Optional[List[Dict[str, Any]]]:
    soup = BeautifulSoup(html_content, 'lxml')
    
    # --- 追加: ページ上部のプロフィール欄から現在の調教師情報を取得 ---
    current_trainer_id = None
    current_trainer_name = None
    # '調教師'というテキストを持つ<th>を探す
    trainer_th = soup.find('th', string='調教師')
    if trainer_th:
        # その隣の<td>要素を取得
        trainer_td = trainer_th.find_next_sibling('td')
        if trainer_td:
            # <td>内の調教師リンク<a>を探す
            trainer_a = trainer_td.find('a', href=re.compile(r'/trainer/'))
            if trainer_a:
                current_trainer_id = _extract_id_from_href(trainer_a.get('href'))
                current_trainer_name = trainer_a.get_text(strip=True)
    # --- 追加ここまで ---

    results_table = None
    required_headers = {'日付', 'レース名', '着順', '頭数', '人気', '斤量', '騎手', 'タイム'}
    
    all_tables = soup.find_all('table', class_=re.compile("db_h_race_results|race_table_01"))
    for table in all_tables:
        header_texts = {th.get_text(strip=True) for th in table.select('tr > th')}
        if len(header_texts.intersection(required_headers)) >= 5:
            results_table = table
            break

    if not results_table:
        print("  - [Warning] Could not find the horse results table. The website layout may have changed.")
        return None
    
    results = []
    headers = [th.get_text(strip=True) for th in results_table.find_all('th')]
    col_map = {name: i for i, name in enumerate(headers)}
    
    rows = results_table.find_all('tr')[1:]

    for row in rows:
        cols_text = [c.get_text(strip=True) for c in row.find_all('td')]
        cols_elm = row.find_all('td')
        
        if len(cols_text) < 15: continue
        
        try:
            race_link_a = cols_elm[col_map.get('レース名', 4)].find('a')
            race_id = None
            if race_link_a and 'href' in race_link_a.attrs:
                match = re.search(r'/race/(\d+)', race_link_a['href'])
                if match: race_id = match.group(1)
            
            if not race_id: continue

            # 騎手IDを抽出
            jockey_link_a = cols_elm[col_map.get('騎手', 12)].find('a')
            jockey_id = _extract_id_from_href(jockey_link_a.get('href')) if jockey_link_a else None
            
            # --- 削除: このテーブルからは調教師IDは取得できないため、該当コードを削除 ---
            # trainer_link_a = row.find('a', href=re.compile(r'/trainer/'))
            # trainer_id = _extract_id_from_href(trainer_link_a.get('href')) if trainer_link_a else None
            # --- 削除ここまで ---
            
            dist_match = re.match(r'([^\d]+)(\d+)', cols_text[col_map.get('距離', 14)])
            time_match = re.match(r'(\d+):(\d+\.\d+)', cols_text[col_map.get('タイム', 17)])
            weight_match = re.match(r'(\d+)\((.+)\)', cols_text[col_map.get('馬体重', 23)])
            
            corner_col_idx = col_map.get('通過', -1)
            corner_positions = []
            if corner_col_idx != -1 and corner_col_idx < len(cols_text):
                corner_positions_str = cols_text[corner_col_idx]
                corner_positions = [int(p) for p in re.split(r'[,()-]', corner_positions_str) if p.isdigit()]
            
            def safe_int(val): return int(val) if val and str(val).isdigit() else None
            def safe_float(val):
                try: return float(val)
                except (ValueError, TypeError): return None

            result_dict = {
                'race_id': race_id, 'race_date': pd.to_datetime(cols_text[col_map.get('日付', 0)], errors='coerce').date(),
                'venue_name': re.sub(r'^\d+', '', cols_text[col_map.get('開催', 1)]).strip(), 'weather': cols_text[col_map.get('天候', 2)],
                'race_number': safe_int(cols_text[col_map.get('R', 3)]), 'race_name': cols_text[col_map.get('レース名', 4)],
                'total_horses': safe_int(cols_text[col_map.get('頭数', 6)]), 'waku_number': safe_int(cols_text[col_map.get('枠番', 7)]),
                'horse_number': safe_int(cols_text[col_map.get('馬番', 8)]), 'odds': safe_float(cols_text[col_map.get('オッズ', 9)]),
                'popularity': safe_int(cols_text[col_map.get('人気', 10)]), 'rank': safe_int(cols_text[col_map.get('着順', 11)]),
                'jockey_name': cols_text[col_map.get('騎手', 12)].strip(), 'weight_carried': safe_float(cols_text[col_map.get('斤量', 13)]),
                'distance': int(dist_match.group(2)) if dist_match else None,
                'course_type': dist_match.group(1)[0] if dist_match else None,
                'ground_condition': cols_text[col_map.get('馬場', 15)],
                'finish_time_sec': int(time_match.group(1)) * 60 + float(time_match.group(2)) if time_match else None,
                'time_diff': safe_float(cols_text[col_map.get('着差', 18)]),
                'corner_positions': corner_positions,
                'agari_3f': safe_float(cols_text[col_map.get('上り', 22)]),
                'horse_weight': int(weight_match.group(1)) if weight_match else None,
                'horse_weight_diff': int(w_diff) if weight_match and (w_diff := weight_match.group(2)) not in ('計不', ' F', ' ', '--') and w_diff.replace('-', '').isdigit() else None,
                'jockey_id': jockey_id,
                # --- 修正: 取得した現在の調教師情報をデフォルト値として使用 ---
                'trainer_id': current_trainer_id,
                'trainer_name': current_trainer_name
            }
            results.append(result_dict)
        except (ValueError, TypeError, IndexError, AttributeError) as e:
            print(f"  - [Warning] Skipping a row due to parsing error in horse results page: {e} | Row Data: {cols_text}")
            continue
            
    if len(results) > 0:
      print(f"  - Successfully parsed {len(results)} past results for horse.")
    return results
# ★★★★★ ここまで修正 ★★★★★

def parse_race_result_page(html_content: str, race_id: str) -> Optional[Dict[str, Any]]:
    if not html_content: return None
    soup = BeautifulSoup(html_content, 'lxml')
    race_info_dict = {}
    results_list = []
    
    try:
        race_header = soup.select_one("div.db_head") or soup.select_one(".RaceList_NameBox")

        if race_header:
            race_name_elm = race_header.select_one("h1") or race_header.select_one(".RaceName")
            if race_name_elm:
                race_name_text = race_name_elm.get_text(strip=True).replace("\n", "").strip()
                race_info_dict['race_name'] = re.sub(r'\(.+?\)$', '', race_name_text).strip()

            race_data_text = ""
            race_data_header = soup.select_one("div.RaceData01")
            if race_data_header:
                race_data_text += race_data_header.get_text(strip=True, separator=' ')
            
            race_data_details = soup.select_one("div.RaceData02")
            if race_data_details:
                race_data_text += " " + race_data_details.get_text(strip=True, separator=' ')
            
            diary_snap_text = soup.select_one("div.diary_snap")
            if diary_snap_text:
                race_data_text += " " + diary_snap_text.get_text(strip=True, separator=' ')

            if race_data_text:
                m_course = re.search(r'(芝|ダ|障)\S*(\d+)m', race_data_text)
                if m_course:
                    race_info_dict['course_type'] = m_course.group(1)
                    race_info_dict['distance'] = int(m_course.group(2))
                
                m_weather = re.search(r'天候:(\S+)', race_data_text)
                if m_weather: race_info_dict['weather'] = m_weather.group(1)
                
                m_ground = re.search(r'馬場:(\S+)', race_data_text)
                if m_ground: race_info_dict['ground_condition'] = m_ground.group(1)
                
                m_date = re.search(r'(\d{4})年(\d{1,2})月(\d{1,2})日', race_data_text)
                if m_date:
                    race_info_dict['race_date'] = datetime.date(int(m_date.group(1)), int(m_date.group(2)), int(m_date.group(3)))
        
        race_info_dict['race_number'] = int(race_id[-2:])

        result_table = soup.find("table", class_=re.compile(r"race_table_01|RaceTable01"))
        if not result_table:
            return None 
        
        rows = result_table.find_all("tr")[1:] 
        race_info_dict['total_horses'] = len(rows)

        corner_positions_by_horse_num = defaultdict(list)
        try:
            corner_passage_element = soup.select_one(".Corner_Passage, #corner_passage") 
            if corner_passage_element:
                corner_trs = corner_passage_element.find_all('tr')
                corner_names = []
                corner_data_rows = []
                
                for tr in corner_trs:
                    th = tr.find('th')
                    td = tr.find('td')
                    if th and td and 'コーナー' in th.get_text():
                        corner_names.append(th.get_text(strip=True))
                        positions_text = td.get_text(strip=True).replace('(', ',').replace(')', ',')
                        corner_data_rows.append([p for p in re.split(r'[, -]', positions_text) if p.isdigit()])

                if corner_data_rows:
                    all_horse_nums_in_table = [int(r.find_all('td')[2].get_text(strip=True)) for r in rows if len(r.find_all('td')) > 2 and r.find_all('td')[2].get_text(strip=True).isdigit()]
                    for num in all_horse_nums_in_table:
                        corner_positions_by_horse_num[num] = [None] * len(corner_names)

                    for corner_idx, horse_nums_in_order in enumerate(horse_nums_in_order, 1):
                        for rank, horse_num_str in enumerate(horse_nums_in_order, 1):
                            horse_num = int(horse_num_str)
                            if horse_num in corner_positions_by_horse_num:
                                corner_positions_by_horse_num[horse_num][corner_idx] = rank
        except Exception as e:
            print(f"[Warning] Corner passage parsing failed for race {race_id}: {e}")
        
        for row in rows:
            cols = row.find_all('td')
            if len(cols) < 11: continue

            time_str = cols[7].get_text(strip=True)
            time_match = re.match(r'(\d+):(\d+\.\d+)', time_str)
            finish_time_sec = int(time_match.group(1)) * 60 + float(time_match.group(2)) if time_match else None
            
            horse_link = cols[3].find('a', href=re.compile(r'/horse/'))
            jockey_link = cols[6].find('a', href=re.compile(r'/jockey/'))
            trainer_link = row.find('a', href=re.compile(r'/trainer/'))
            
            horse_id = _extract_id_from_href(horse_link.get('href')) if horse_link else None
            jockey_id = _extract_id_from_href(jockey_link.get('href')) if jockey_link else None
            trainer_id = _extract_id_from_href(trainer_link.get('href')) if trainer_link else None
            
            horse_num_val = int(cols[2].get_text(strip=True)) if cols[2].get_text(strip=True).isdigit() else 0
            
            result_dict = {
                'rank': int(cols[0].get_text(strip=True)) if cols[0].get_text(strip=True).isdigit() else None,
                'waku_number': int(cols[1].get_text(strip=True)) if cols[1].get_text(strip=True).isdigit() else None,
                'horse_number': horse_num_val,
                'horse_id': horse_id,
                'horse_name': horse_link.get_text(strip=True) if horse_link else None,
                'weight_carried': float(cols[5].get_text(strip=True)) if re.match(r'^\d+\.?\d*$', cols[5].get_text(strip=True)) else None,
                'jockey_id': jockey_id,
                'jockey_name': jockey_link.get_text(strip=True) if jockey_link else None,
                'trainer_id': trainer_id,
                'trainer_name': trainer_link.get_text(strip=True) if trainer_link else None,
                'finish_time_sec': finish_time_sec,
                'odds': float(cols[9].get_text(strip=True)) if re.match(r'^\d+\.?\d*$', cols[9].get_text(strip=True)) else None,
                'popularity': int(cols[10].get_text(strip=True)) if cols[10].get_text(strip=True).isdigit() else None,
            }

            if horse_num_val in corner_positions_by_horse_num:
                valid_positions = [p for p in corner_positions_by_horse_num[horse_num_val] if p is not None]
                result_dict['corner_positions'] = valid_positions
            else:
                result_dict['corner_positions'] = []

            results_list.append(result_dict)
        
        return {'race_info': race_info_dict, 'results': results_list}
    
    except Exception as e:
        import traceback
        print(f"An error occurred while parsing race result page for race {race_id}:")
        traceback.print_exc()
        return None