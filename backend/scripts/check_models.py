import sys
import os
from dotenv import load_dotenv
from google import genai

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

def main():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY NOT FOUND")
        return
        
    client = genai.Client(api_key=api_key)
    try:
        models = client.models.list()
        for m in models:
            if "gemma" in m.name.lower():
                print(m.name)
        print("All matching done.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
