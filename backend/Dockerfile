# 1. ベースとなるOSイメージを選択
# 「Python 3.11.4が最初から入っている軽量なLinux」を土台にします。
FROM python:3.11.4-slim

# 2. Chromeブラウザと関連ツールをインストール
# Linuxのコマンドを使い、Google Chromeをシステムにインストールします。
# これが buildpacks の代わりとなります。
RUN apt-get update && apt-get install -y \
    wget gnupg curl \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 3. ChromeDriverをインストール
# SeleniumがChromeを操作するための「リモコン」のようなツールです。
# インストールしたChromeのバージョンに合ったものを自動でダウンロードします。
RUN CHROME_VERSION=$(google-chrome --version | awk '{print $3}' | awk -F. '{print $1}') \
    && wget -O /tmp/chromedriver.zip https://chromedriver.storage.googleapis.com/LATEST_RELEASE_${CHROME_VERSION}/chromedriver_linux64.zip \
    && unzip /tmp/chromedriver.zip -d /usr/local/bin/ \
    && rm /tmp/chromedriver.zip \
    && chmod +x /usr/local/bin/chromedriver

# 4. 作業ディレクトリを設定
# コンテナ内の /app というフォルダで作業しますよ、という宣言です。
WORKDIR /app

# 5. Pythonのライブラリをインストール
# まず requirements.txt だけをコピーして先にインストールします。
# (Dockerのキャッシュ機能を効率的に使うためのテクニックです)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 6. アプリケーションのコードをコピー
# backendフォルダの中身を、コンテナ内の /app フォルダにすべてコピーします。
COPY . .

# 7. Cron Jobが実行する最終的なコマンド
# このコンテナが起動したときに、`python run_pipeline.py` を実行するよう設定します。
CMD ["python", "run_pipeline.py"]