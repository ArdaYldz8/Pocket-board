from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import json
import asyncio

# Dual-compatible imports for local and Render deployment
try:
    from backend.app.services.ai_service import simulate_debate_streaming
    from backend.app.services.auth_service import get_current_user, supabase, supabase_admin
except ImportError:
    from app.services.ai_service import simulate_debate_streaming
    from app.services.auth_service import get_current_user, supabase, supabase_admin

router = APIRouter()



class ChatRequest(BaseModel):
    message: str
    company_info: Dict[str, str]
    history: Optional[List[Dict[str, str]]] = []
    target_agent: Optional[str] = None 
    image: Optional[str] = None # Base64 encoded image
    conversation_id: Optional[str] = None

@router.get("/history")
async def get_chat_history(conversation_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Fetches chat history for the user's latest conversation"""
    try:
        user_id = current_user.user.id
        admin_client = supabase_admin if supabase_admin else supabase
        
        # If no conversation_id, get the most recent one
        target_conv_id = conversation_id
        if not target_conv_id:
            # 1. Get User's Organization
            profile_resp = admin_client.table("profiles").select("organization_id").eq("id", user_id).single().execute()
            if not profile_resp.data:
                 return {"messages": []}
            org_id = profile_resp.data["organization_id"]
            
            # 2. Get Latest Conversation
            conv_resp = admin_client.table("conversations").select("id").eq("organization_id", org_id).order("created_at", desc=True).limit(1).execute()
            if conv_resp.data:
                target_conv_id = conv_resp.data[0]["id"]
            else:
                return {"messages": []}
        
        # 3. Fetch Messages
        msg_resp = admin_client.table("messages").select("*").eq("conversation_id", target_conv_id).order("created_at", desc=False).execute()
        
        # Transform for Frontend
        formatted_messages = []
        for m in msg_resp.data:
            role = m["role"]
            content = m["content"]
            metadata = m.get("metadata") or {}
            
            # Special handling for Vote Results stored as stringified JSON
            if role == "vote_results":
                 formatted_messages.append({
                     "type": "vote_results",
                     "votes": json.loads(content)
                 })
                 continue
                 
            formatted_messages.append({
                "role": role,
                "content": content,
                "agentName": metadata.get("agent_name", role),
                "type": "message" # Frontend expects this
                # "confidence": metadata.get("confidence") # If we stored it
            })
            
            
        return {"messages": formatted_messages, "conversation_id": target_conv_id}

    except Exception as e:
        print(f"History Fetch Error: {e}")
        return {"messages": []}

@router.get("/conversations")
async def get_conversations(current_user: dict = Depends(get_current_user)):
    """Fetches list of conversations for the sidebar"""
    try:
        user_id = current_user.user.id
        
        # Get Org ID using Admin Client (Bypass RLS)
        admin_client = supabase_admin if supabase_admin else supabase
        profile_resp = admin_client.table("profiles").select("organization_id").eq("id", user_id).execute()
        
        if not profile_resp.data:
             return []
        org_id = profile_resp.data[0]["organization_id"]
        
        if not org_id:
            return []
        
        # Fetch Conversations (Use Admin Client to ensure we can read them)
        conv_resp = admin_client.table("conversations").select("*").eq("organization_id", org_id).order("created_at", desc=True).execute()
        
        return conv_resp.data if conv_resp.data else []
    except Exception as e:
        print(f"Conversations Fetch Error: {e}")
        return []

@router.post("/chat-stream")
async def chat_stream(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    """Streaming endpoint - messages arrive one by one in real-time"""
    
    # 1. Ensure Conversation Exists
    conversation_id = request.conversation_id
    if not conversation_id:
        try:
            user_id = current_user.user.id
            
            # Use Admin Client for EVERYTHING in this sensitive block to bypass RLS
            admin_client = supabase_admin if supabase_admin else supabase
            
            # Get Org ID
            profile_resp = admin_client.table("profiles").select("organization_id").eq("id", user_id).execute()
            
            org_id = None
            profile_exists = len(profile_resp.data) > 0
            existing_org_id = profile_resp.data[0].get("organization_id") if profile_exists else None
            
            if not profile_exists or not existing_org_id:
                # JIT Provisioning: User has no profile OR no Organization
                print(f"JIT Provisioning for User {user_id}")
                
                # 1. Create Organization (if needed)
                org_data = {"name": "My Company", "industry": "General"}
                
                org_resp = admin_client.table("organizations").insert(org_data).execute()
                if org_resp.data:
                    org_id = org_resp.data[0]["id"]
                    
                    # 2. Link Profile
                    prof_data = {
                        "id": user_id,
                        "organization_id": org_id,
                        "role": "admin"
                    }
                    # Upsert ensures we update if profile existed (but was hidden/unlinked)
                    admin_client.table("profiles").upsert(prof_data).execute()
                else:
                     raise Exception("Failed to create Organization during JIT provisioning")
            else:
                org_id = existing_org_id
            
            # Create New Conversation
            conv_data = {
                "organization_id": org_id,
                "title": request.message[:50] or "New Debate",
                "status": "active"
            } 
            
            conv_resp = admin_client.table("conversations").insert(conv_data).execute()
            
            if conv_resp.data:
                conversation_id = conv_resp.data[0]["id"]
        except Exception as e:
            # Fallback (won't save history properly but wont crash stream)
            print(f"Conversation Creation Error: {e}")
            conversation_id = None

    async def generate():
        try:
            c_info = request.company_info or {
                "name": "Choice Foods",
                "industry": "Food Wholesale",
                "description": "A wholesale distributor of Mediterranean and Turkish food products."
            }
            
            # Send Conversation ID to frontend first
            yield f"data: {json.dumps({'type': 'meta', 'conversation_id': conversation_id}, ensure_ascii=False)}\n\n"

            # Use async generator to stream messages
            async for message in simulate_debate_streaming(request.message, request.history, c_info, image_base64=request.image, conversation_id=conversation_id):
                yield f"data: {json.dumps(message, ensure_ascii=False)}\n\n"
                
        except Exception as e:
            error_msg = {"error": str(e)}
            yield f"data: {json.dumps(error_msg)}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")

