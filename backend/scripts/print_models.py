import os
from dotenv import load_dotenv
from google import genai

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

print("=== All Models ===")
for m in client.models.list():
    if "flash" in m.name.lower() or "gemini" in m.name.lower():
        print(m.name)
