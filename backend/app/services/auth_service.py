
import os
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Initialize Supabase Client
url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not url or not key:
    raise ValueError("Supabase URL or Key missing in environment variables.")

supabase: Client = create_client(url, key)

# Initialize Supabase Admin Client (Bypasses RLS) - FOR BACKEND USE ONLY
service_key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase_admin: Client = None
if service_key:
    supabase_admin = create_client(url, service_key)
else:
    print("WARNING: SUPABASE_SERVICE_ROLE_KEY missing. Backend RLS bypass will fail.")


security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    """
    Verifies the JWT token sent in the Authorization header.
    Returns the user payload if valid, raises 401 otherwise.
    """
    token = credentials.credentials
    try:
        # Verify user token with Supabase
        user = supabase.auth.get_user(token)
        if not user:
             raise HTTPException(status_code=401, detail="Invalid token")
        return user
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")
