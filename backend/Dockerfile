# 1. ベースイメージの選択 (変更なし)
FROM python:3.11.4-slim

# 2. Chromeブラウザと関連ツールのインストール
# ★ 修正点1: JSONを扱うためのツール「jq」を追加します ★
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    unzip \
    curl \
    jq \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 3. ChromeDriverを新しい方法でインストール
# ★ 修正点2: 廃止されたURLではなく、公式JSONエンドポイントから最新版のURLを取得するように変更 ★
RUN CHROME_MAJOR_VERSION=$(google-chrome --product-version | cut -d. -f1) \
    && DRIVER_URL=$(curl -sS "https://googlechromelabs.github.io/chrome-for-testing/latest-patch-versions-per-build-with-downloads.json" | jq -r --arg major_version "$CHROME_MAJOR_VERSION" '.builds[$major_version].downloads.chromedriver[] | select(.platform == "linux64") | .url') \
    && wget -O /tmp/chromedriver.zip "$DRIVER_URL" \
    && unzip /tmp/chromedriver.zip -d /tmp/ \
    && mv /tmp/chromedriver-linux64/chromedriver /usr/local/bin/ \
    && rm -rf /tmp/chromedriver.zip /tmp/chromedriver-linux64/ \
    && chmod +x /usr/local/bin/chromedriver

# 4. 作業ディレクトリの設定 (変更なし)
WORKDIR /app

# 5. Pythonのライブラリをインストール (変更なし)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 6. アプリケーションのコードをコピー (変更なし)
COPY . .

# 7. Cron Jobが実行する最終的なコマンド (変更なし)
CMD ["python", "run_pipeline.py"]