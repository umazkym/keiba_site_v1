# C:\Users\tnszk\program\keiba-ai-site\backend\scripts\parser.py
from bs4 import BeautifulSoup
import re
from typing import List, Dict, Any, Tuple, Optional

def parse_race_ids_from_list(html_content: str) -> List[str]:
    """ レースリストページからrace_idのリストを抽出する """
    soup = BeautifulSoup(html_content, 'lxml')
    race_ids = []
    # aタグのhrefからrace_idを正規表現で探す
    links = soup.find_all('a', href=re.compile(r'/race/result\.html\?race_id=\d{12}'))
    for link in links:
        match = re.search(r'race_id=(\d{12})', link['href'])
        if match:
            race_ids.append(match.group(1))
    return list(set(race_ids)) # 重複を削除

def parse_race_result(html_content: str, race_id: str) -> Optional[Dict[str, Any]]:
    """
    レース結果ページを解析し、レース情報と全馬の成績を返す。
    #コードの parse_race_result_top2_common, parse_race_result_horse_ai_common
    などを統合・拡張する。
    """
    soup = BeautifulSoup(html_content, 'lxml')
    
    try:
        # レース基本情報の解析 ( #コードの_parse_intro_block を参考にする )
        race_data01 = soup.find('div', class_='RaceData01').text
        race_data02 = soup.find('div', class_='RaceData02').text
        
        # ... (正規表現でコース、距離、馬場状態などを抽出)
        # この部分は #コード のロジックをほぼ流用できる
        
        venue_name = "東京" # 仮
        course_type = "芝" # 仮
        distance = 2400 # 仮
        race_name = soup.find('div', class_='RaceName').text.strip() # 仮のセレクタ
        race_number_text = soup.find('span', class_='RaceNum').text # 仮のセレクタ
        race_number = int(re.search(r'\d+', race_number_text).group())

        # 成績テーブルの解析
        results_table = soup.find('table', class_='race_table_01')
        if not results_table:
            # 地方競馬のテーブルIDも考慮
            results_table = soup.find('table', id='All_Result_Table')
        
        horse_results = []
        rows = results_table.find_all('tr')[1:]
        for row in rows:
            cols = row.find_all('td')
            if len(cols) < 10: continue
            
            rank = cols[0].text.strip()
            if not rank.isdigit(): continue

            horse_result = {
                'rank': int(rank),
                'gate_number': int(cols[1].text.strip()),
                'horse_number': int(cols[2].text.strip()),
                'horse_name': cols[3].find('a').text.strip(),
                'horse_id': re.search(r'/horse/(\w+)', cols[3].find('a')['href']).group(1),
                'finish_time_sec': _time_to_sec(cols[7].text.strip()),
                'corner_positions': _parse_corner_positions(cols[10].text.strip()) # 仮の列番号
            }
            horse_results.append(horse_result)

        return {
            'race_info': {
                'id': race_id,
                'venue_name': venue_name,
                'race_number': race_number,
                'race_name': race_name,
                'course_type': course_type,
                'distance': distance,
                # ... 他のレース情報
            },
            'horse_results': horse_results
        }

    except Exception as e:
        print(f"Error parsing race {race_id}: {e}")
        return None

# --- ヘルパー関数 ---
def _time_to_sec(t: str) -> Optional[float]:
    try:
        parts = t.split(':')
        if len(parts) == 2:
            m, s = parts
            return int(m) * 60 + float(s)
        elif len(parts) == 1:
            return float(parts[0])
    except (ValueError, TypeError):
        return None
    return None

def _parse_corner_positions(pos_str: str) -> List[int]:
    # "1-2-3-4"のような文字列を [1, 2, 3, 4] に変換
    try:
        return [int(p) for p in pos_str.split('-')]
    except:
        return []