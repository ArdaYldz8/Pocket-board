from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Dual-compatible import for local and Render deployment
try:
    from backend.app.api import chat  # Local development
except ImportError:
    from app.api import chat  # Render deployment

app = FastAPI(title="KVP Konsey API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "KVP Konsey API is running 🚀"}
