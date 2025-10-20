# backend/scripts/parser.py

from bs4 import BeautifulSoup
import re
import pandas as pd
from typing import List, Dict, Any, Optional
from collections import defaultdict
import datetime
from .processors import ReturnProcessor
from io import StringIO

def _safe_int(value: any) -> Optional[int]:
    """文字列を整数に安全に変換する。失敗した場合はNoneを返す。"""
    if value is None:
        return None
    try:
        return int(str(value).strip())
    except (ValueError, TypeError):
        return None

def _safe_float(value: any) -> Optional[float]:
    """文字列を浮動小数点数に安全に変換する。失敗した場合はNoneを返す。"""
    if value is None:
        return None
    try:
        cleaned_value = str(value).strip()
        if re.match(r'^-?\d+\.?\d*$', cleaned_value):
            return float(cleaned_value)
        return None
    except (ValueError, TypeError):
        return None

def _normalize_race_name(race_name_text: str) -> str:
    """
    レース名を正規化し、不要な空白・改行・括弧内の情報を整形する。

    処理内容：
    1. 改行・タブ・複数の空白を正規化
    2. グレード情報（（G1）など）を末尾から除去
    3. 先頭と末尾の空白を除去

    Parameters
    ----------
    race_name_text : str
        HTML から抽出した生のレース名テキスト

    Returns
    -------
    str
        正規化されたレース名
    """
    if not race_name_text:
        return ""

    # ステップ1: 改行・タブを空白に置換し、複数の連続空白を1つに統一
    normalized = re.sub(r'[\n\r\t]+', ' ', race_name_text)
    normalized = re.sub(r'\s+', ' ', normalized)

    # ステップ2: グレード情報（末尾の括弧）を除去
    # パターン: （G1）、（G2）、（G3）、（OP）など、または (G1), (G2) など
    normalized = re.sub(r'\s*[（(](?:G[1-3]|OP|重賞)[）)]$', '', normalized)

    # ステップ3: 先頭と末尾の空白を除去
    normalized = normalized.strip()

    return normalized

def _extract_id_from_href(href: Optional[str]) -> Optional[str]:
    """
    馬、騎手、調教師のリンクURLからIDを抽出するヘルパー関数。
    """
    if not href:
        return None
    match = re.search(r'/(?:horse|jockey|trainer)/(?:[a-zA-Z0-9_/]+/)?(\w+)', href)
    if match:
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
        # --- [最終修正 Ver.4] JRAとNAR両対応の最も堅牢な情報取得ロジック ---

        # 1. レース名: h1 タグを最優先で探す
        race_name_elm = soup.find("h1")
        if race_name_elm:
            race_name_text = race_name_elm.get_text(strip=True)
            race_info_dict['race_name'] = _normalize_race_name(race_name_text)

        # 2. 日付: ページ全体から "YYYY年MM月DD日" の形式を正規表現で探す (最も確実)
        race_date_obj = None
        date_match_in_text = re.search(r'(\d{4})年(\d{1,2})月(\d{1,2})日', html_content)
        if date_match_in_text:
            try:
                race_date_obj = datetime.date(
                    _safe_int(date_match_in_text.group(1)),
                    _safe_int(date_match_in_text.group(2)),
                    _safe_int(date_match_in_text.group(3))
                )
            except (ValueError, TypeError):
                pass # パース失敗時はNoneのまま
        race_info_dict['race_date'] = race_date_obj

        # 3. コース、天候、馬場状態: 特徴的なテキストブロックから情報を抽出
        race_data_text = ""
        data_elements = soup.select(".RaceData01, .RaceData02, .RaceList_Item02 span, .diary_snap span")
        if data_elements:
            for elem in data_elements:
                race_data_text += " " + elem.get_text(strip=True, separator=' ')
        
        if race_data_text:
            # ==============================================================================
            # ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ ここから修正 ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
            m_course = re.search(r'(芝|ダ|障).*?(\d+)m', race_data_text)
            # ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ ここまで修正 ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
            # ==============================================================================
            if m_course:
                dist = _safe_int(m_course.group(2))
                if dist and dist > 0:
                    race_info_dict['course_type'] = m_course.group(1)
                    race_info_dict['distance'] = dist

            m_weather = re.search(r'天候\s*:\s*([^/\s]+)', race_data_text)
            if m_weather:
                race_info_dict['weather'] = m_weather.group(1).strip().rstrip('/')
            
            m_ground = re.search(r'(?:芝|ダ)\s*:\s*([^/\s]+)|馬場\s*:\s*([^/\s]+)', race_data_text)
            if m_ground:
                ground_condition = next((g for g in m_ground.groups() if g is not None), None)
                if ground_condition:
                    race_info_dict['ground_condition'] = ground_condition.strip().rstrip('/')
        
        race_info_dict['race_number'] = _safe_int(race_id[-2:])
        # --- 修正ここまで ---
            
        shutuba_table = soup.find("table", class_=re.compile(r"Shutuba_Table|RaceTable0[12]|race_table_01", re.IGNORECASE))
        if not shutuba_table:
            horse_links = soup.select('a[href*="/horse/"]')
            for link in horse_links:
                table = link.find_parent('table')
                if table and len(table.find_all('tr')) > 3:
                    shutuba_table = table
                    break
        
        if not shutuba_table:
            return {'race_info': race_info_dict, 'horses': []}

        rows = shutuba_table.find_all("tr")
        rows = [row for row in rows if row.find('td', class_=re.compile("HorseInfo|HorseList"))]
        
        race_info_dict['total_horses'] = len(rows)

        for row in rows:
            cols = row.find_all('td')
            if len(cols) < 8: continue
            
            horse_info_cell = row.find('td', class_=re.compile("HorseInfo|HorseName", re.IGNORECASE)) or cols[3]
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

            horse_weight, horse_weight_diff = None, None
            horse_weight_raw = weight_cell.get_text(strip=True)
            weight_match = re.match(r'(\d+)\((.+)\)', horse_weight_raw)
            if weight_match:
                horse_weight = _safe_int(weight_match.group(1))
                horse_weight_diff_str = weight_match.group(2)
                if horse_weight_diff_str not in ('計不', ' F', ' ', ''):
                    horse_weight_diff = _safe_int(horse_weight_diff_str)
            
            sex, age = None, None
            sex_age_raw = sex_age_cell.get_text(strip=True)
            if sex_age_raw and len(sex_age_raw) > 1:
                sex = sex_age_raw[0]
                age = _safe_int(sex_age_raw[1:])

            horse_list.append({
                'waku_number': _safe_int(waku_cell.get_text(strip=True)),
                'horse_number': _safe_int(umaban_cell.get_text(strip=True)),
                'horse_id': horse_id,
                'horse_name': horse_info_a.get_text(strip=True) if horse_info_a else None,
                'sex': sex,
                'age': age,
                'weight_carried': _safe_float(kinryo_cell.get_text(strip=True)),
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
        return {'race_info': race_info_dict, 'horses': horse_list}

def parse_horse_results_page(html_content: str) -> Optional[Dict[str, Any]]:
    soup = BeautifulSoup(html_content, 'lxml')

    horse_name = None
    horse_title_div = soup.find('div', class_='horse_title')
    if horse_title_div:
        h1 = horse_title_div.find('h1')
        if h1:
            horse_name = h1.get_text(strip=True)
    
    current_trainer_id = None
    current_trainer_name = None
    trainer_th = soup.find('th', string='調教師')
    if trainer_th:
        trainer_td = trainer_th.find_next_sibling('td')
        if trainer_td:
            trainer_a = trainer_td.find('a', href=re.compile(r'/trainer/'))
            if trainer_a:
                current_trainer_id = _extract_id_from_href(trainer_a.get('href'))
                current_trainer_name = trainer_a.get_text(strip=True)

    results_table = None
    required_headers = {'日付', 'レース名', '着順', '頭数', '人気', '斤量', '騎手', 'タイム'}
    
    all_tables = soup.find_all('table', class_=re.compile("db_h_race_results|race_table_01"))
    for table in all_tables:
        header_texts = {th.get_text(strip=True) for th in table.select('tr > th')}
        if len(header_texts.intersection(required_headers)) >= 5:
            results_table = table
            break

    if not results_table:
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

            jockey_link_a = cols_elm[col_map.get('騎手', 12)].find('a')
            jockey_id = _extract_id_from_href(jockey_link_a.get('href')) if jockey_link_a else None
            
            dist_match = re.match(r'([^\d]+)(\d+)', cols_text[col_map.get('距離', 14)])
            time_match = re.match(r'(\d+):(\d+\.\d+)', cols_text[col_map.get('タイム', 17)])
            weight_match = re.match(r'(\d+)\((.+)\)', cols_text[col_map.get('馬体重', 23)])
            
            corner_col_idx = col_map.get('通過', -1)
            if corner_col_idx == -1 and len(cols_text) > 19:
                corner_col_idx = 19
                
            corner_positions = []
            if corner_col_idx != -1 and corner_col_idx < len(cols_text):
                corner_positions_str = cols_text[corner_col_idx]
                corner_positions = [_safe_int(p) for p in re.split(r'[,()-]', corner_positions_str) if p.isdigit()]
                corner_positions = [p for p in corner_positions if p is not None]
            
            result_dict = {
                'race_id': race_id, 'race_date': pd.to_datetime(cols_text[col_map.get('日付', 0)], errors='coerce').date(),
                'venue_name': re.sub(r'^\d+|\d+$', '', cols_text[col_map.get('開催', 1)]).strip(),
                'weather': cols_text[col_map.get('天候', 2)],
                'race_number': _safe_int(cols_text[col_map.get('R', 3)]), 'race_name': cols_text[col_map.get('レース名', 4)],
                'total_horses': _safe_int(cols_text[col_map.get('頭数', 6)]), 'waku_number': _safe_int(cols_text[col_map.get('枠番', 7)]),
                'horse_number': _safe_int(cols_text[col_map.get('馬番', 8)]), 'odds': _safe_float(cols_text[col_map.get('オッズ', 9)]),
                'popularity': _safe_int(cols_text[col_map.get('人気', 10)]), 'rank': _safe_int(cols_text[col_map.get('着順', 11)]),
                'jockey_name': cols_text[col_map.get('騎手', 12)].strip(), 'weight_carried': _safe_float(cols_text[col_map.get('斤量', 13)]),
                'distance': _safe_int(dist_match.group(2)) if dist_match else None,
                'course_type': dist_match.group(1)[0] if dist_match else None,
                'ground_condition': cols_text[col_map.get('馬場', 15)],
                'finish_time_sec': (_safe_int(time_match.group(1)) * 60 + _safe_float(time_match.group(2))) if time_match else None,
                'time_diff': _safe_float(cols_text[col_map.get('着差', 18)]),
                'corner_positions': corner_positions,
                'agari_3f': _safe_float(cols_text[col_map.get('上り', 22)]),
                'horse_weight': _safe_int(weight_match.group(1)) if weight_match else None,
                'horse_weight_diff': _safe_int(w_diff) if weight_match and (w_diff := weight_match.group(2)) not in ('計不', ' F', ' ', '--') else None,
                'jockey_id': jockey_id,
                'trainer_id': current_trainer_id,
                'trainer_name': current_trainer_name
            }
            results.append(result_dict)
        except (ValueError, TypeError, IndexError, AttributeError) as e:
            continue
            
    return {'horse_name': horse_name, 'results': results}

def parse_race_result_page(html_content: str, race_id: str) -> Optional[Dict[str, Any]]:
    if not html_content: return None
    soup = BeautifulSoup(html_content, 'lxml')
    race_info_dict = {}
    results_list = []
    
    try:
        # --- レース中止・取り止め判定 ---
        info_box = soup.select_one(".Race_Infomation_Box")
        if info_box and ("中止" in info_box.get_text() or "取り止め" in info_box.get_text()):
            print(f"  -> [Info] Race {race_id} was cancelled. Skipping result parsing.")
            # 中止の場合でもレース情報は取得を試みる
            race_header = soup.select_one("div.db_head") or soup.select_one(".RaceList_NameBox")
            if race_header:
                race_name_elm = race_header.select_one("h1") or race_header.select_one(".RaceName")
                if race_name_elm:
                    race_name_text = race_name_elm.get_text(strip=True)
                    race_info_dict['race_name'] = _normalize_race_name(race_name_text)
            return {'race_info': race_info_dict, 'results': [], 'returns': {}}

        # --- レース情報取得 ---
        race_header = soup.select_one("div.db_head") or soup.select_one(".RaceList_NameBox")
        if race_header:
            race_name_elm = race_header.select_one("h1") or race_header.select_one(".RaceName")
            if race_name_elm:
                race_name_text = race_name_elm.get_text(strip=True)
                race_info_dict['race_name'] = _normalize_race_name(race_name_text)

            race_data_text = ""
            race_data_elements = soup.select(".RaceData01, .RaceData02, .diary_snap span")
            for elem in race_data_elements:
                race_data_text += " " + elem.get_text(strip=True, separator=' ')

            if race_data_text:
                # ==============================================================================
                # ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ ここから修正 ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
                m_course = re.search(r'(芝|ダ|障).*?(\d+)m', race_data_text)
                # ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ ここまで修正 ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
                # ==============================================================================
                if m_course:
                    dist = _safe_int(m_course.group(2))
                    if dist and dist > 0:
                        race_info_dict['course_type'] = m_course.group(1)
                        race_info_dict['distance'] = dist
                
                m_weather = re.search(r'天候\s*:\s*([^/\s]+)', race_data_text)
                if m_weather:
                    race_info_dict['weather'] = m_weather.group(1).strip().rstrip('/')
                
                m_ground = re.search(r'(?:芝|ダ)\s*:\s*([^/\s]+)|馬場\s*:\s*([^/\s]+)', race_data_text)
                if m_ground:
                    ground_condition = next((g for g in m_ground.groups() if g is not None), None)
                    if ground_condition:
                        race_info_dict['ground_condition'] = ground_condition.strip().rstrip('/')
                
                m_date = re.search(r'(\d{4})年(\d{1,2})月(\d{1,2})日', race_data_text)
                if m_date:
                    race_info_dict['race_date'] = datetime.date(_safe_int(m_date.group(1)), _safe_int(m_date.group(2)), _safe_int(m_date.group(3)))
        
        race_info_dict['race_number'] = _safe_int(race_id[-2:])

        # --- 結果テーブル解析 ---
        result_table = soup.find("table", class_=re.compile(r"race_table_01|RaceTable01"))
        if not result_table:
            # 結果テーブルがない場合は、まだ結果が確定していないか特殊なページ
            return {'race_info': race_info_dict, 'results': [], 'returns': {}}

        id_map = {}
        for row_idx, tr in enumerate(result_table.find_all('tr')):
            for col_idx, td in enumerate(tr.find_all(['td', 'th'])):
                for a in td.find_all('a', href=True):
                    href = a['href']
                    extracted_id = _extract_id_from_href(href)
                    if extracted_id:
                        if 'jockey' in href: id_map[(row_idx, 'jockey_id')] = extracted_id
                        elif 'trainer' in href: id_map[(row_idx, 'trainer_id')] = extracted_id
                        elif 'horse' in href: id_map[(row_idx, 'horse_id')] = extracted_id
        
        try:
            df = pd.read_html(StringIO(str(result_table)), header=0)[0]
        except ValueError:
            # tableタグがあっても中身が空などの理由でpandasが失敗する場合
            return {'race_info': race_info_dict, 'results': [], 'returns': {}}
        
        def clean_header(col):
            if isinstance(col, tuple): col = ''.join(map(str, col))
            cleaned_col = re.sub(r'Unnamed:.*|_level_.*', '', col)
            cleaned_col = re.sub(r'[\s_]', '', cleaned_col)
            return cleaned_col

        df.columns = [clean_header(c) for c in df.columns]

        rename_map = {
            '着順': 'rank', '枠番': 'waku_number', '馬番': 'horse_number', '馬名': 'horse_name',
            '性齢': 'sex_age', '斤量': 'weight_carried', '騎手': 'jockey_name', 'タイム': 'finish_time',
            '着差': 'time_diff', '人気': 'popularity', '単勝オッズ': 'odds', '後3F': 'agari_3f',
            '上り': 'agari_3f', '通過': 'corner_positions', '厩舎': 'trainer_name', '馬体重(増減)': 'horse_weight_str'
        }
        df.rename(columns=rename_map, inplace=True)
        
        if 'trainer_name' in df.columns and df['trainer_name'].dtype == 'object':
            df['trainer_name'] = df['trainer_name'].str.replace(r'^(門別|盛岡|水沢|浦和|船橋|大井|川崎|金沢|笠松|名古屋|園田|姫路|高知|佐賀|岩手|帯広\(ば\))', '', regex=True)
            df['trainer_name'] = df['trainer_name'].str.replace(r'^\[(西|東)\]', '', regex=True)

        if 'rank' not in df.columns: return None

        df['rank'] = pd.to_numeric(df['rank'], errors='coerce').astype('Int64')
        df = df.dropna(subset=['rank'])

        for idx, row in df.iterrows():
            row_index_in_html = idx + 1
            
            horse_weight, horse_weight_diff = None, None
            if 'horse_weight_str' in row and isinstance(row['horse_weight_str'], str):
                weight_match = re.match(r'(\d+)\((.+)\)', row['horse_weight_str'])
                if weight_match:
                    horse_weight = _safe_int(weight_match.group(1))
                    diff_str = weight_match.group(2)
                    if diff_str.replace('-', '').isdigit():
                        horse_weight_diff = _safe_int(diff_str)

            finish_time_sec = None
            if 'finish_time' in row and isinstance(row['finish_time'], str):
                time_match = re.match(r'(\d+):(\d+\.\d+)', row['finish_time'])
                if time_match:
                    finish_time_sec = (_safe_int(time_match.group(1)) * 60 + _safe_float(time_match.group(2)))

            result_dict = {
                'rank': row.get('rank'), 'waku_number': _safe_int(row.get('waku_number')),
                'horse_number': _safe_int(row.get('horse_number')), 'horse_id': id_map.get((row_index_in_html, 'horse_id')),
                'horse_name': row.get('horse_name'), 'weight_carried': pd.to_numeric(row.get('weight_carried'), errors='coerce'),
                'jockey_id': id_map.get((row_index_in_html, 'jockey_id')), 'jockey_name': row.get('jockey_name'),
                'trainer_id': id_map.get((row_index_in_html, 'trainer_id')), 'trainer_name': row.get('trainer_name'),
                'finish_time_sec': finish_time_sec, 'odds': pd.to_numeric(row.get('odds'), errors='coerce'),
                'popularity': pd.to_numeric(row.get('popularity'), errors='coerce'), 'agari_3f': pd.to_numeric(row.get('agari_3f'), errors='coerce'),
                'horse_weight': horse_weight, 'horse_weight_diff': horse_weight_diff,
            }
            results_list.append(result_dict)

        # --- 払い戻し情報解析 ---
        all_returns_data = {}
        payout_container = soup.select_one(".ResultPaybackLeftWrap, dl.pay_block")
        if payout_container:
            processor = ReturnProcessor(payout_container)
            all_returns_data = processor.get_all_returns()

        return {'race_info': race_info_dict, 'results': results_list, 'returns': all_returns_data}
    
    except Exception as e:
        import traceback
        print(f"An error occurred while parsing race result page for race {race_id}:")
        traceback.print_exc()
        return None