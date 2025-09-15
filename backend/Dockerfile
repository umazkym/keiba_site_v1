# ベースとなる公式Pythonイメージを指定
FROM python:3.11.4-slim

# タイムゾーンを日本時間に設定
ENV TZ=Asia/Tokyo

# Pythonのログがバッファリングされないように設定
ENV PYTHONUNBUFFERED 1

# 必要なシステムパッケージとGoogle Chrome本体をインストール
RUN apt-get update && \
    apt-get install -y --no-install-recommends jq unzip && \
    CHROME_VERSION=$(google-chrome --version | cut -f 3 -d ' ' | cut -d '.' -f 1) && \
    CHROME_DRIVER_VERSION=$(curl -s "https://googlechromelabs.github.io/chrome-for-testing/latest-versions-per-milestone.json" | jq -r ".milestones.\"${CHROME_VERSION}\".version") && \
    wget -q "https://storage.googleapis.com/chrome-for-testing-public/${CHROME_DRIVER_VERSION}/linux64/chromedriver-linux64.zip" -O chromedriver.zip && \
    unzip chromedriver.zip && \
    mv chromedriver-linux64/chromedriver /usr/local/bin/ && \
    rm -rf chromedriver.zip chromedriver-linux64 && \
    apt-get purge -y --auto-remove jq && \
    rm -rf /var/lib/apt/lists/*

# インストールされたChromeのバージョンに合うChromeDriverを自動でダウンロード・インストール
RUN CHROME_VERSION=$(google-chrome --version | cut -f 3 -d ' ' | cut -d '.' -f 1) \
    && CHROME_DRIVER_VERSION=$(curl -s "https://googlechromelabs.github.io/chrome-for-testing/latest-versions-per-milestone.json" | grep -A 1 "\"${CHROME_VERSION}\"" | grep "version" | cut -d '"' -f 4) \
    && wget -q https://storage.googleapis.com/chrome-for-testing-public/${CHROME_DRIVER_VERSION}/linux64/chromedriver-linux64.zip -O chromedriver.zip \
    && unzip chromedriver.zip \
    && mv chromedriver-linux64/chromedriver /usr/local/bin/ \
    && rm chromedriver.zip chromedriver-linux64 -rf

# 作業ディレクトリを設定
WORKDIR /app

# Pythonライブラリをインストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# OGP画像生成に必要なフォントとロゴ画像をコンテナにコピーする
COPY fonts ./fonts

# アプリケーションの全ソースコードをコピー
COPY . .

# コンテナ起動時に実行されるメインコマンド
CMD ["python", "run_pipeline.py"]