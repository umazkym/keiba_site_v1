import os
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

load_dotenv()

class RaceAnalysis(BaseModel):
    race_id: str = Field(description="The race ID")
    analysis_text: str = Field(description="The generated analysis text according to the persona and theme")

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

prompt = "Write a 50-word story about race 101 and race 102."

for model_name in ["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.5-flash-lite"]:
    print(f"Testing {model_name}...")
    try:
        res = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=list[RaceAnalysis],
                temperature=0.7
            )
        )
        print(res.text)
    except Exception as e:
        print(f"Failed! {e}")
