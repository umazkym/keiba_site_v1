import requests
from bs4 import BeautifulSoup
import datetime
import json

def get_grade_races_from_netkeiba():
    year = datetime.datetime.now().year
    month = datetime.datetime.now().month
    url = f"https://race.netkeiba.com/top/calendar.html?year={year}&month={month}"
    headers = {"User-Agent": "Mozilla/5.0"}
    res = requests.get(url, headers=headers)
    soup = BeautifulSoup(res.content, "html.parser")
    
    races = []
    return races

if __name__ == "__main__":
    print(get_grade_races_from_netkeiba())
