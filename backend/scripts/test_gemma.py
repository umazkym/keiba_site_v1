import os
from google import genai

def test():
    api_key = os.getenv("GEMINI_API_KEY")
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model='gemma-3-27b-it',
        contents='簡単な日本語の挨拶をしてください。',
    )
    print("RESPONSE:", response.text)

if __name__ == "__main__":
    test()
