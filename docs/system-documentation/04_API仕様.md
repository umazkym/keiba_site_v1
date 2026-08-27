# 04. API仕様

## 4.1 API概要

### 4.1.1 基本情報

- **ベースURL (本番)**: `https://keiba-site-v1-761440273070.us-west1.run.app`
- **ベースURL (開発)**: `http://localhost:8000`
- **APIバージョン**: v1
- **プロトコル**: HTTPS
- **データフォーマット**: JSON
- **文字エンコーディング**: UTF-8

### 4.1.2 認証

**現状**: 認証なし (全エンドポイントがパブリック)

**理由**: 無料サービスのため、全データを公開

**将来の拡張**: JWT認証の追加を検討

---

## 4.2 エンドポイント一覧

### 4.2.1 予測関連API

| メソッド | エンドポイント | 説明 |
|---------|--------------|------|
| GET | `/api/v1/predictions/{target_date}` | 指定日のレース予測取得 |
| GET | `/api/v1/predictions/hits/top-payouts` | 過去7日間の高配当TOP5 |
| GET | `/api/v1/predictions/hits/high-payouts/{target_date}` | 指定日の高配当一覧 |
| GET | `/api/v1/predictions/special-pick/{target_date}` | 指定日の注目馬 |
| GET | `/api/v1/predictions/matchups/{race_id}` | 対決成績取得 |

### 4.2.2 ユーティリティAPI

| メソッド | エンドポイント | 説明 |
|---------|--------------|------|
| GET | `/api/v1/predictions/sitemap/all-race-urls` | サイトマップ用URL一覧 |

---

## 4.3 エンドポイント詳細

### 4.3.1 GET /api/v1/predictions/{target_date}

**説明**: 指定日の全レース予測を取得(JRA + NAR)

**パスパラメータ**:
```
target_date: string (YYYY-MM-DD形式)
例: 2025-01-15
```

**レスポンス**:
```json
{
  "target_date": "2025-01-15",
  "jra_venues": [
    {
      "venue_name": "東京",
      "venue_type": "JRA",
      "races": [
        {
          "race_id": "202501150106",
          "race_number": 6,
          "race_name": "東京新聞杯",
          "race_type": "JRA",
          "course_type": "芝",
          "distance": 1600,
          "weather": null,
          "ground_condition": null,
          "total_horses": 16,
          "predictions": [
            {
              "horse_id": "2019105303",
              "horse_name": "イクイノックス",
              "horse_number": 5,
              "deviation_score": 72.5,
              "mark": "◎",
              "start_1c_indicator": 45,
              "unpredictable_reason": null
            },
            // ... 他の馬
          ],
          "horse_number_advantages": [
            {
              "horse_number": 1,
              "advantage_score": -2.3
            },
            {
              "horse_number": 2,
              "advantage_score": 5.1
            },
            // ... 18番まで
          ]
        },
        // ... 他のレース
      ]
    },
    // ... 他のJRA競馬場
  ],
  "nar_venues": [
    {
      "venue_name": "大井",
      "venue_type": "NAR",
      "races": [
        // ... NARレース
      ]
    },
    // ... 他のNAR競馬場
  ]
}
```

**ステータスコード**:
- `200 OK`: 成功
- `404 Not Found`: 指定日にレースが存在しない
- `500 Internal Server Error`: サーバーエラー

**使用例**:
```typescript
// frontend/lib/api.ts
export async function getRacePredictions(date: string) {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/predictions/${date}`,
    { next: { revalidate: 300 } }  // 5分キャッシュ
  );

  if (!res.ok) {
    throw new Error('Failed to fetch predictions');
  }

  return res.json();
}
```

---

### 4.3.2 GET /api/v1/predictions/hits/top-payouts

**説明**: 過去7日間の高配当TOP5を取得

**パラメータ**: なし

**レスポンス**:
```json
[
  {
    "race_id": "202501140508",
    "race_date": "2025-01-14",
    "venue_name": "中山",
    "race_number": 8,
    "race_name": "中山記念",
    "bet_type": "3連単",
    "numbers": "7-12-3",
    "payout": 145600,
    "prediction_mark": "◎-☆-△",
    "hit_type": "的中"
  },
  {
    "race_id": "202501130312",
    "race_date": "2025-01-13",
    "venue_name": "京都",
    "race_number": 12,
    "race_name": "日経新春杯",
    "bet_type": "馬連",
    "numbers": "5-8",
    "payout": 23400,
    "prediction_mark": "◎-○",
    "hit_type": "的中"
  },
  // ... 残り3件
]
```

**ステータスコード**:
- `200 OK`: 成功 (データがなくても空配列を返す)
- `500 Internal Server Error`: サーバーエラー

**ビジネスロジック**:
- 過去7日間のレースから払戻金10,000円以上を抽出
- 払戻金の降順でソート
- TOP5件のみ返却
- AI予測の印と照合して「的中」判定

---

### 4.3.3 GET /api/v1/predictions/hits/high-payouts/{target_date}

**説明**: 指定日の高配当一覧を取得

**パスパラメータ**:
```
target_date: string (YYYY-MM-DD形式)
```

**クエリパラメータ**:
```
min_payout: integer (オプション, デフォルト: 10000)
  最小払戻金額(円)
```

**レスポンス**:
```json
[
  {
    "race_id": "202501150508",
    "race_date": "2025-01-15",
    "venue_name": "東京",
    "race_number": 8,
    "race_name": "東京新聞杯",
    "bet_type": "3連単",
    "numbers": "5-12-8",
    "payout": 145600,
    "prediction_mark": "◎-☆-▲",
    "hit_type": "的中"
  },
  // ... 他の高配当
]
```

**ステータスコード**:
- `200 OK`: 成功
- `404 Not Found`: 指定日にレースが存在しないまたは高配当なし
- `500 Internal Server Error`: サーバーエラー

---

### 4.3.4 GET /api/v1/predictions/special-pick/{target_date}

**説明**: 指定日の最高偏差値馬を取得

**パスパラメータ**:
```
target_date: string (YYYY-MM-DD形式)
```

**レスポンス**:
```json
{
  "race_id": "202501150508",
  "race_date": "2025-01-15",
  "venue_name": "東京",
  "race_number": 8,
  "race_name": "東京新聞杯",
  "course_type": "芝",
  "distance": 1600,
  "horse_id": "2019105303",
  "horse_name": "イクイノックス",
  "horse_number": 5,
  "deviation_score": 78.5,
  "mark": "◎",
  "odds": 1.8,
  "popularity": 1
}
```

**データがない場合**:
```json
null
```

**ステータスコード**:
- `200 OK`: 成功 (データがない場合はnullを返す)
- `500 Internal Server Error`: サーバーエラー

**ビジネスロジック**:
- 指定日の全レースから最高偏差値の馬を抽出
- 新馬戦・障害戦は除外
- 偏差値が未計算の場合は除外

---

### 4.3.5 GET /api/v1/predictions/matchups/{race_id}

**説明**: 指定レースの対決成績を取得

**パスパラメータ**:
```
race_id: string
例: 202501150508
```

**クエリパラメータ**:
```
start_date: string (オプション, YYYY-MM-DD形式)
  対決成績の開始日(この日以降のレースのみカウント)

end_date: string (オプション, YYYY-MM-DD形式)
  対決成績の終了日(この日以前のレースのみカウント)
```

**レスポンス**:
```json
{
  "race_id": "202501150508",
  "matchups": {
    "2019105303_vs_2020101234": {
      "horse1_id": "2019105303",
      "horse1_name": "イクイノックス",
      "horse2_id": "2020101234",
      "horse2_name": "タイトルホルダー",
      "horse1_wins": 3,
      "horse2_wins": 1,
      "draws": 0,
      "races": [
        {
          "race_id": "202210100211",
          "race_name": "天皇賞(秋)",
          "race_date": "2022-10-30",
          "venue_name": "東京",
          "distance": 2000,
          "course_type": "芝",
          "horse1_rank": "1",
          "horse2_rank": "2",
          "horse1_time": 118.5,
          "horse2_time": 118.7
        },
        // ... 他の対決レース
      ]
    },
    // ... 他の組み合わせ
  }
}
```

**ステータスコード**:
- `200 OK`: 成功
- `404 Not Found`: レースが存在しない
- `500 Internal Server Error`: サーバーエラー

**フィルタリング動作**:
```python
# start_date, end_dateが指定された場合
filtered_races = [
    race for race in matchup['races']
    if start_date <= race['race_date'] <= end_date
]

# 勝敗数を再計算
horse1_wins = sum(1 for r in filtered_races if r['horse1_rank'] < r['horse2_rank'])
horse2_wins = sum(1 for r in filtered_races if r['horse2_rank'] < r['horse1_rank'])
```

---

### 4.3.6 GET /api/v1/predictions/sitemap/all-race-urls

**説明**: サイトマップ生成用の全レースURL一覧を取得

**パラメータ**: なし

**レスポンス**:
```json
[
  {
    "url": "https://umafree.com/races/2025-01-15",
    "lastmod": "2025-01-15T03:00:00Z"
  },
  {
    "url": "https://umafree.com/races/2025-01-14",
    "lastmod": "2025-01-14T03:00:00Z"
  },
  // ... 他の日付
]
```

**ステータスコード**:
- `200 OK`: 成功
- `500 Internal Server Error`: サーバーエラー

**使用例**:
```typescript
// frontend/app/sitemap.ts
export default async function sitemap() {
  const res = await fetch(`${API_BASE_URL}/api/v1/predictions/sitemap/all-race-urls`);
  const raceUrls = await res.json();

  return [
    {
      url: 'https://umafree.com',
      lastModified: new Date(),
    },
    ...raceUrls.map(race => ({
      url: race.url,
      lastModified: new Date(race.lastmod),
    })),
  ];
}
```

---

## 4.4 エラーレスポンス

### 4.4.1 標準エラーフォーマット

```json
{
  "detail": "エラーメッセージ",
  "status_code": 404,
  "timestamp": "2025-01-15T12:00:00Z"
}
```

### 4.4.2 一般的なエラーコード

| コード | 説明 | 例 |
|-------|------|-----|
| 400 | Bad Request | 不正なパラメータ |
| 404 | Not Found | リソースが存在しない |
| 422 | Unprocessable Entity | バリデーションエラー |
| 500 | Internal Server Error | サーバー内部エラー |
| 503 | Service Unavailable | メンテナンス中 |

---

## 4.5 レート制限

### 4.5.1 現在の制限

**制限なし**

**理由**:
- 無料サービス
- ユーザー数が限定的
- Cloud Runの無料枠内での運用

### 4.5.2 将来の実装

```python
from fastapi import Request
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.get("/api/v1/predictions/{target_date}")
@limiter.limit("100/hour")  # 1時間に100リクエスト
async def get_predictions(target_date: str, request: Request):
    # ...
```

---

## 4.6 CORS設定

### 4.6.1 許可されたオリジン

```python
# backend/main.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://uma-free.com",
        "https://www.uma-free.com"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)
```

---

## 4.7 キャッシング戦略

### 4.7.1 フロントエンドでのキャッシュ

**Next.js ISR**:
```typescript
export const revalidate = 300;  // 5分ごとに再生成
```

**fetch APIのキャッシュ**:
```typescript
fetch(url, {
  next: { revalidate: 300 }  // 5分キャッシュ
})
```

### 4.7.2 HTTPキャッシュヘッダー

```python
from fastapi import Response

@app.get("/api/v1/predictions/{target_date}")
async def get_predictions(target_date: str, response: Response):
    response.headers["Cache-Control"] = "public, max-age=300"  # 5分
    # ...
```

---

## 4.8 APIクライアント実装例

### 4.8.1 TypeScript (フロントエンド)

```typescript
// frontend/lib/api.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface RacePrediction {
  target_date: string;
  jra_venues: Venue[];
  nar_venues: Venue[];
}

export interface Venue {
  venue_name: string;
  venue_type: 'JRA' | 'NAR';
  races: Race[];
}

export interface Race {
  race_id: string;
  race_number: number;
  race_name: string;
  course_type: string;
  distance: number;
  predictions: Prediction[];
  horse_number_advantages: HorseNumberAdvantage[];
}

export interface Prediction {
  horse_id: string;
  horse_name: string;
  horse_number: number;
  deviation_score: number | null;
  mark: string | null;
  start_1c_indicator: number | null;
  unpredictable_reason: string | null;
}

export async function getRacePredictions(date: string): Promise<RacePrediction> {
  const res = await fetch(`${API_BASE_URL}/api/v1/predictions/${date}`, {
    next: { revalidate: 300 }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch predictions: ${res.statusText}`);
  }

  return res.json();
}

export async function getTopPayouts() {
  const res = await fetch(`${API_BASE_URL}/api/v1/predictions/hits/top-payouts`, {
    next: { revalidate: 60 }  // 1分キャッシュ
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch top payouts: ${res.statusText}`);
  }

  return res.json();
}

export async function getSpecialPick(date: string) {
  const res = await fetch(`${API_BASE_URL}/api/v1/predictions/special-pick/${date}`, {
    next: { revalidate: 300 }
  });

  if (!res.ok) {
    return null;
  }

  return res.json();
}

export async function getMatchups(raceId: string, startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);

  const url = `${API_BASE_URL}/api/v1/predictions/matchups/${raceId}?${params}`;

  const res = await fetch(url, {
    next: { revalidate: 600 }  // 10分キャッシュ
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch matchups: ${res.statusText}`);
  }

  return res.json();
}
```

### 4.8.2 Python (バックエンドテスト)

```python
# tests/test_api.py
import requests
from datetime import date

API_BASE_URL = "http://localhost:8000"

def test_get_predictions():
    target_date = date.today().isoformat()
    response = requests.get(f"{API_BASE_URL}/api/v1/predictions/{target_date}")

    assert response.status_code == 200
    data = response.json()

    assert "target_date" in data
    assert "jra_venues" in data
    assert "nar_venues" in data

def test_get_top_payouts():
    response = requests.get(f"{API_BASE_URL}/api/v1/predictions/hits/top-payouts")

    assert response.status_code == 200
    data = response.json()

    assert isinstance(data, list)
    assert len(data) <= 5

def test_get_matchups():
    race_id = "202501150508"
    response = requests.get(f"{API_BASE_URL}/api/v1/predictions/matchups/{race_id}")

    assert response.status_code in [200, 404]

    if response.status_code == 200:
        data = response.json()
        assert "race_id" in data
        assert "matchups" in data
```

---

## 4.9 Swagger/OpenAPI ドキュメント

### 4.9.1 アクセス方法

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`
- **OpenAPI JSON**: `http://localhost:8000/openapi.json`

### 4.9.2 設定

```python
# backend/main.py
from fastapi import FastAPI

app = FastAPI(
    title="UMA-FREE API",
    description="競馬AI予測API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)
```

---

## 4.10 次のドキュメント

APIの活用については、以下のドキュメントを参照してください:

- **05_フロントエンド.md**: フロントエンドでのAPI利用方法
- **06_データ処理パイプライン.md**: APIで提供されるデータの生成方法
- **09_開発環境セットアップ.md**: ローカルでのAPI起動方法
