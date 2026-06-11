import os
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

prompt = "Hello, please reply with 'Model OK'."

models_to_test = [
    "gemini-3.5-flash",
    "gemini-3-flash-preview",
    "gemma-4-31b-it"
]

for model_name in models_to_test:
    print(f"Testing {model_name}...")
    try:
        res = client.models.generate_content(
            model=model_name,
            contents=prompt,
        )
        print(f"[{model_name}] OK: {res.text.strip()}")
    except Exception as e:
        print(f"[{model_name}] Failed: {e}")
