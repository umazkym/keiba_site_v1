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

    def _get_texts_from_cell(self, cell: Tag) -> List[str]:
        """
        <td>要素内を解析し、<br>などで分割されたテキストのリストを返す
        """
        # <br>タグをユニークな区切り文字に置換
        for br in cell.find_all('br'):
            br.replace_with('__BR__')
        
        # get_textでテキストを取得し、区切り文字で分割
        items = [item.strip() for item in cell.get_text(separator='__BR__').split('__BR__')]
        
        # 空の要素を除外
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
            if not th or len(tds) < 2:
                continue
            
            bet_type_text = th.get_text(strip=True)
            key = bet_type_map.get(bet_type_text)
            if not key:
                continue

            numbers_cell = tds[0]
            payouts_cell = tds[1]
            payouts_list = [self._clean_payout(p) for p in self._get_texts_from_cell(payouts_cell)]
            numbers_list = []

            # NARの<ul><li>構造を優先的に処理
            uls = numbers_cell.find_all('ul')
            if uls:
                # ワイドなど、複数の<ul>で結果を表す場合
                for ul in uls:
                    numbers = [li.get_text(strip=True) for li in ul.find_all('li') if li.get_text(strip=True)]
                    delimiter = ' → ' if key in ['umatan', 'sanrentan'] else ' - '
                    numbers_list.append(delimiter.join(numbers))
            else:
                # <ul>がない場合 (JRAのテキストや<br>区切り、NARの<div>区切りなど)
                numbers_list = self._get_texts_from_cell(numbers_cell)

            # 結果を組み立てる
            results = []
            for i in range(min(len(numbers_list), len(payouts_list))):
                num_str = numbers_list[i]
                payout_val = payouts_list[i]
                
                if num_str and payout_val is not None:
                    try:
                        # 複勝・単勝の場合は数値に変換
                        winning_numbers = int(num_str) if key in ['fukusho', 'tansho'] else num_str
                        results.append({
                            'winning_numbers': winning_numbers,
                            'payout': payout_val
                        })
                    except ValueError:
                        # 数値に変換できない場合(例: '1 - 7')はそのまま文字列として格納
                        results.append({
                            'winning_numbers': num_str,
                            'payout': payout_val
                        })
            
            if results:
                all_returns[key] = results
        
        return all_returns