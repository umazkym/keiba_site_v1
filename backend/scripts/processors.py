# C:\Users\tnszk\program\GitHub\backend\scripts\processors.py
import re
from bs4 import BeautifulSoup, Tag
from typing import List, Dict, Optional

class ReturnProcessor:
    def __init__(self, soup_element: Optional[Tag]):
        """
        初期処理
        BeautifulSoupで解析済みの払い戻し情報が含まれるHTML要素を受け取る
        """
        self.soup_element = soup_element

    def _clean_payout(self, text: str) -> Optional[int]:
        """払い戻し金額の文字列から '円' と ',' を除去して数値に変換"""
        if not text:
            return None
        try:
            return int(re.sub(r'[円,]', '', text.strip()))
        except (ValueError, TypeError):
            return None
            
    def _clean_popularity(self, text: str) -> Optional[int]:
        """人気順の文字列から '人気' を除去して数値に変換"""
        if not text:
            return None
        try:
            return int(re.sub(r'人気', '', text.strip()))
        except (ValueError, TypeError):
            return None

    def _get_texts_from_cell(self, cell: Tag) -> List[str]:
        """
        <td>要素内を解析し、<br>などで分割されたテキストのリストを返す
        """
        for br in cell.find_all('br'):
            br.replace_with('__BR__')
        
        items = [item.strip() for item in cell.get_text(separator='__BR__').split('__BR__')]
        
        return [item for item in items if item]

    def get_all_returns(self) -> Dict[str, List[Dict]]:
        """
        全ての馬券種の整形処理を呼び出し、結果を辞書にまとめる
        """
        if not self.soup_element:
            return {}

        all_returns = {}
        rows = self.soup_element.find_all('tr')

        bet_type_map = {
            '単勝': 'tansho',
            '複勝': 'fukusho',
            '枠連': 'wakuren', '枠複': 'wakuren',
            '馬連': 'umaren',
            'ワイド': 'wide',
            '馬単': 'umatan',
            '三連複': 'sanrenpuku', '3連複': 'sanrenpuku',
            '三連単': 'sanrentan', '3連単': 'sanrentan'
        }

        for row in rows:
            th = row.find('th')
            tds = row.find_all('td')
            if not th or len(tds) < 3:
                continue
            
            bet_type_text = th.get_text(strip=True)
            key = bet_type_map.get(bet_type_text)
            if not key:
                continue

            numbers_cell = tds[0]
            payouts_cell = tds[1]
            popularity_cell = tds[2]

            payouts_list = [self._clean_payout(p) for p in self._get_texts_from_cell(payouts_cell)]
            popularity_list = [self._clean_popularity(p) for p in self._get_texts_from_cell(popularity_cell)]
            numbers_list = []

            uls = numbers_cell.find_all('ul')
            if uls:
                for ul in uls:
                    numbers = [li.get_text(strip=True) for li in ul.find_all('li') if li.get_text(strip=True)]
                    delimiter = ' → ' if key in ['umatan', 'sanrentan'] else ' - '
                    numbers_list.append(delimiter.join(numbers))
            else:
                numbers_list = self._get_texts_from_cell(numbers_cell)

            results = []
            num_items = len(payouts_list)
            for i in range(num_items):
                num_str = numbers_list[i] if i < len(numbers_list) else ''
                payout_val = payouts_list[i]
                pop_val = popularity_list[i] if i < len(popularity_list) else None
                
                if num_str and payout_val is not None:
                    # --- 修正: winning_numbersを分割してnumber_1,2,3に格納 ---
                    try:
                        # '→' または '-' で分割
                        parsed_numbers = [int(n.strip()) for n in re.split(r'\s*→\s*|\s*-\s*', num_str) if n.strip().isdigit()]
                        
                        # 馬連、枠連、ワイド、三連複は順序を問わないのでソートする
                        if key in ['umaren', 'wakuren', 'wide', 'sanrenpuku']:
                            parsed_numbers.sort()

                        # 辞書を作成
                        return_dict = {
                            'payout': payout_val,
                            'popularity': pop_val,
                            'number_1': parsed_numbers[0] if len(parsed_numbers) > 0 else None,
                            'number_2': parsed_numbers[1] if len(parsed_numbers) > 1 else None,
                            'number_3': parsed_numbers[2] if len(parsed_numbers) > 2 else None,
                        }
                        # number_1がNoneでない場合のみ結果リストに追加
                        if return_dict['number_1'] is not None:
                            results.append(return_dict)

                    except (ValueError, IndexError) as e:
                        print(f"[Warning] Could not parse numbers for {key}: '{num_str}'. Error: {e}")
                        continue
            
            if results:
                all_returns[key] = results
        
        return all_returns
