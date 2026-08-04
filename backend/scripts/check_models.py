import os
import sys

from dotenv import load_dotenv
from google import genai

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()


def main() -> int:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEYが設定されていません。", file=sys.stderr)
        return 2

    client = genai.Client(api_key=api_key)
    try:
        models = client.models.list()
        count = 0
        gemma_models: list[str] = []
        for m in models:
            count += 1
            if "gemma" in m.name.lower():
                gemma_models.append(m.name)
        if count == 0:
            print("Gemini APIは応答しましたが利用可能モデルが0件でした。", file=sys.stderr)
            return 1
        print(f"Gemini API読み取り確認成功: models={count}, gemma={len(gemma_models)}")
        for model_name in gemma_models:
            print(model_name)
        return 0
    except Exception as exc:  # noqa: BLE001 - workflowへ失敗を返す
        print(f"Gemini API読み取り確認失敗: {exc}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
