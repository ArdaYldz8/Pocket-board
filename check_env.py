import os
from pathlib import Path
from dotenv import load_dotenv

# Path logic from ai_service.py
env_path = Path(__file__).resolve().parent / '.env'
print(f"Loading .env from: {env_path}")
load_dotenv(dotenv_path=env_path)

keys = ["OPENAI_API_KEY", "GEMINI_API_KEY", "GROQ_API_KEY"]

for key in keys:
    val = os.getenv(key)
    if val:
        print(f"{key}: Found (Starts with {val[:10]}..., Length: {len(val)})")
        # Check for hidden characters
        if val != val.strip():
            print(f"WARNING: {key} has leading/trailing whitespace!")
    else:
        print(f"{key}: NOT FOUND")
