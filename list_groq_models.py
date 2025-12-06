import os
from pathlib import Path
from dotenv import load_dotenv
from groq import Groq

# Load .env
env_path = Path(__file__).resolve().parent / '.env'
load_dotenv(dotenv_path=env_path)

api_key = os.getenv("GROQ_API_KEY", "").strip()

if not api_key:
    print("❌ GROQ_API_KEY missing")
else:
    try:
        client = Groq(api_key=api_key)
        models = client.models.list()
        print(f"✅ Available Groq Models ({len(models.data)} found):")
        for model in models.data:
            print(f"- {model.id}")
    except Exception as e:
        print(f"❌ Groq Failed: {e}")
