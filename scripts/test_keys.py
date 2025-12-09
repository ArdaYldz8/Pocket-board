import os
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI
import google.generativeai as genai
from groq import Groq

# Load .env
env_path = Path(__file__).resolve().parent / '.env'
load_dotenv(dotenv_path=env_path)

print("--- API KEY TEST ---")

# 1. OpenAI Test
print("\nTesting OpenAI...")
openai_key = os.getenv("OPENAI_API_KEY", "").strip()
if not openai_key:
    print("❌ OPENAI_API_KEY missing")
else:
    try:
        client = OpenAI(api_key=openai_key)
        client.models.list()
        print("✅ OpenAI: Connected (Key is valid)")
    except Exception as e:
        print(f"❌ OpenAI Failed: {e}")

# 2. Gemini Test
print("\nTesting Gemini...")
gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
if not gemini_key:
    print("❌ GEMINI_API_KEY missing")
else:
    try:
        genai.configure(api_key=gemini_key)
        model = genai.GenerativeModel('models/gemini-flash-latest')
        response = model.generate_content("Hello")
        print("✅ Gemini: Connected (Key is valid)")
    except Exception as e:
        print(f"❌ Gemini Failed: {e}")

# 3. Groq Test
print("\nTesting Groq...")
groq_key = os.getenv("GROQ_API_KEY", "").strip()
if not groq_key:
    print("❌ GROQ_API_KEY missing")
else:
    try:
        client = Groq(api_key=groq_key)
        client.models.list()
        print("✅ Groq: Connected (Key is valid)")
    except Exception as e:
        print(f"❌ Groq Failed: {e}")
