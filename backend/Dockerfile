# ベースイメージとしてPython 3.11-slimを使用
FROM python:3.11.4-slim

# 環境変数を設定
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV TZ=Asia/Tokyo

# ステップ1: 必要なシステムパッケージとGoogle Chrome本体を一度にインストール
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl \
    wget \
    gnupg \
    unzip \
    jq \
    # Google Chromeのリポジトリキーを追加
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome-keyring.gpg && \
    # Google Chromeのリポジトリを追加
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list && \
    # パッケージリストを再度更新し、Chromeをインストール
    apt-get update && \
    apt-get install -y google-chrome-stable && \
    # 不要になったaptキャッシュを削除してイメージサイズを削減
    rm -rf /var/lib/apt/lists/*

# ステップ2: インストール済みのChromeにバージョンを合わせたChromeDriverをインストール
# (このステップでは、前のステップでインストールしたコマンドが利用可能です)
RUN CHROME_VERSION=$(google-chrome --version | cut -f 3 -d ' ' | cut -d '.' -f 1) && \
    CHROME_DRIVER_VERSION=$(curl -s "https://googlechromelabs.github.io/chrome-for-testing/latest-versions-per-milestone.json" | jq -r ".milestones.\"${CHROME_VERSION}\".version") && \
    wget -q "https://storage.googleapis.com/chrome-for-testing-public/${CHROME_DRIVER_VERSION}/linux64/chromedriver-linux64.zip" -O chromedriver.zip && \
    unzip chromedriver.zip && \
    mv chromedriver-linux64/chromedriver /usr/local/bin/ && \
    rm -rf chromedriver.zip chromedriver-linux64

# ステップ3: アプリケーションのセットアップ
WORKDIR /app

# Pythonの依存関係をインストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコードをコピー
COPY . .

# ★★★★★ ここから追加 ★★★★★
# コンテナが実行されたときに、run_pipeline.py を実行するよう指示
CMD ["python", "run_pipeline.py"]
# ★★★★★ ここまで追加 ★★★★★